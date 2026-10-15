<?php
/** Publish the reviewed canonical notice using WP-CLI, with a private rollback receipt. */
if (!defined('WP_CLI') || !WP_CLI) { exit(1); }

$source = $args[0] ?? '';
$mode = $args[1] ?? 'dry-run';
$backup_directory = $args[2] ?? '';
$host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
if (!in_array($host, array('villa-claudia.eu', 'qa20261015.villa-claudia.eu'), true)) {
    WP_CLI::error('This publisher is restricted to the Villa Claudia production and QA sites.');
}
if (!in_array($mode, array('dry-run', 'publish'), true) || !is_readable($source)) {
    WP_CLI::error('Usage: wp eval-file publish-privacy.php canonical.json [dry-run|publish] [private-backup-directory]');
}
$policy = json_decode(file_get_contents($source), true);
if (!is_array($policy) || ($policy['status'] ?? '') !== 'published' ||
    !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $policy['updatedAt'] ?? '')) {
    WP_CLI::error('The canonical notice must have a reviewed publication status and date.');
}
$definitions = array('en' => 'privacy-policy', 'de' => 'datenschutz');
$pages = array();
foreach ($definitions as $language => $slug) {
    $translation = $policy['languages'][$language] ?? array();
    $title = $translation['title'] ?? '';
    $html = $translation['html'] ?? '';
    if (!is_string($title) || trim($title) === '' || !is_string($html) || trim($html) === '' ||
        preg_match('/<\s*(script|iframe|object|embed|form|input|style)\b|\son\w+\s*=|\b(href|src)\s*=\s*["\']\s*(javascript|data)\s*:/i', $html)) {
        WP_CLI::error('Both translations must contain static reviewed content only.');
    }
    $page = get_page_by_path($slug, OBJECT, 'page');
    $pages[$language] = array(
        'existing' => $page,
        'slug' => $slug,
        'title' => $title,
        'body' => '<div id="villa-privacy-policy-' . $language . '" class="villa-privacy-policy" lang="' . $language . '">' . $html . '</div>',
    );
}
if ($mode === 'dry-run') {
    WP_CLI::log(wp_json_encode(array('mode' => 'dry-run', 'host' => $host, 'languages' => array_keys($pages))));
    return;
}

// Backups must be outside every public_html directory, including a nested QA copy.
if ($backup_directory === '' || strpos(str_replace('\\', '/', $backup_directory), '/public_html') !== false) {
    WP_CLI::error('Provide a private backup directory outside public_html.');
}
if (!is_dir($backup_directory) && !mkdir($backup_directory, 0700, true)) {
    WP_CLI::error('Could not create the private backup directory.');
}
$resolved_backup = realpath($backup_directory);
if (!$resolved_backup || strpos(str_replace('\\', '/', $resolved_backup), '/public_html') !== false) {
    WP_CLI::error('The resolved backup directory must be outside public_html.');
}
if (!chmod($resolved_backup, 0700)) { WP_CLI::error('Could not protect the backup directory.'); }
$before = array('time' => gmdate('c'), 'host' => $host, 'pages' => array(), 'options' => array());
foreach ($pages as $language => $item) {
    $existing = $item['existing'];
    $before['pages'][$language] = $existing ? array('post' => $existing->to_array(), 'meta' => get_post_meta($existing->ID)) : null;
}
foreach (array('wp_page_for_privacy_policy', 'woocommerce_checkout_privacy_policy_text', 'woocommerce_registration_privacy_policy_text') as $key) {
    $before['options'][$key] = get_option($key, null);
}
$backup_file = $resolved_backup . '/privacy-before-' . gmdate('Ymd-His') . '-' . wp_generate_password(8, false) . '.json';
$backup_json = wp_json_encode($before, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
if (!is_string($backup_json) || !is_array(json_decode($backup_json, true)) ||
    file_put_contents($backup_file, $backup_json, LOCK_EX) !== strlen($backup_json)) {
    WP_CLI::error('The rollback receipt could not be written. Nothing was published.');
}
if (!chmod($backup_file, 0600) || hash_file('sha256', $backup_file) !== hash('sha256', $backup_json)) {
    WP_CLI::error('The private rollback receipt could not be protected and verified. Nothing was published.');
}
$receipt = array('host' => $host, 'updatedAt' => $policy['updatedAt'], 'pages' => array());
foreach ($pages as $language => $item) {
    $post = array('post_type' => 'page', 'post_status' => 'publish', 'post_name' => $item['slug'],
        'post_title' => $item['title'], 'post_content' => $item['body'], 'comment_status' => 'closed', 'ping_status' => 'closed');
    if ($item['existing']) { $post['ID'] = $item['existing']->ID; }
    $id = wp_insert_post(wp_slash($post), true);
    if (is_wp_error($id)) { WP_CLI::error('Publication failed. Restore the private rollback receipt before retrying.'); }
    update_post_meta($id, '_et_pb_use_builder', 'off');
    if (get_post_field('post_status', $id) !== 'publish' || get_post_field('post_name', $id) !== $item['slug'] ||
        get_post_meta($id, '_et_pb_use_builder', true) !== 'off' ||
        hash('sha256', get_post_field('post_content', $id)) !== hash('sha256', $item['body'])) {
        WP_CLI::error('Published content did not match the canonical notice. Reconcile before retrying.');
    }
    $receipt['pages'][$language] = array('id' => $id, 'url' => get_permalink($id), 'sha256' => hash('sha256', $item['body']));
}
update_option('wp_page_for_privacy_policy', $receipt['pages']['en']['id']);
update_option('woocommerce_checkout_privacy_policy_text', 'We use your booking information to arrange your stay and meet legal obligations. Details are in our [privacy_policy].');
update_option('woocommerce_registration_privacy_policy_text', 'We use your details to manage your account and booking. Details are in our [privacy_policy].');
if ((int) get_option('wp_page_for_privacy_policy') !== (int) $receipt['pages']['en']['id'] ||
    get_option('woocommerce_checkout_privacy_policy_text') !== 'We use your booking information to arrange your stay and meet legal obligations. Details are in our [privacy_policy].' ||
    get_option('woocommerce_registration_privacy_policy_text') !== 'We use your details to manage your account and booking. Details are in our [privacy_policy].') {
    WP_CLI::error('The WordPress privacy-page assignment could not be verified.');
}
WP_CLI::log(wp_json_encode($receipt, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
