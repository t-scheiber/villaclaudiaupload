<?php
/**
 * Plugin Name: Villa Claudia privacy defaults
 * Description: Keeps optional tracking off, hosts the existing fonts locally and replaces automatic maps with an external link.
 * Version: 1.0.0
 * Author: Thomas Scheiber
 */
if (!defined('ABSPATH')) { exit; }

// These controls do not disconnect Site Kit or change saved account credentials.
foreach (array('analytics-4', 'tagmanager', 'adsense', 'ads') as $module) {
    add_filter('googlesitekit_' . $module . '_tag_blocked', '__return_true', PHP_INT_MAX);
    add_filter('googlesitekit_' . $module . '_tag_amp_blocked', '__return_true', PHP_INT_MAX);
}
add_filter('pre_option_woocommerce_feature_order_attribution_enabled', function () { return 'no'; }, PHP_INT_MAX);
add_filter('wcpay_shopper_tracking_enabled', '__return_false', PHP_INT_MAX);
add_filter('wcpay_frontend_tracks', '__return_empty_array', PHP_INT_MAX);

function vcp_remove_optional_scripts() {
    if (is_admin()) { return; }
    foreach (array('google_gtagjs', 'hostinger-reach-embed', 'abandoned-carts', 'sourcebuster-js', 'wc-order-attribution', 'google-maps-api', 'woo-tracks', 'jp-tracks', 'jp-tracks-functions', 'wcpay-frontend-tracks') as $handle) {
        wp_dequeue_script($handle);
    }
}
add_action('wp_enqueue_scripts', 'vcp_remove_optional_scripts', PHP_INT_MAX);
add_action('wp_print_scripts', 'vcp_remove_optional_scripts', PHP_INT_MAX);
add_action('wp_print_footer_scripts', 'vcp_remove_optional_scripts', 0);

function vcp_remove_reach_frontend_hooks() {
    global $wp_filter;
    $frontend = !is_admin() || wp_doing_ajax();
    // Reach also captures email/cart events and sends purchase/abandoned-cart
    // automations without its embed. Stop collection and these optional jobs,
    // including AJAX, while keeping its admin account/settings connection.
    foreach ($wp_filter as $hook => $registered) {
        foreach ($registered->callbacks as $priority => $callbacks) {
            foreach ($callbacks as $entry) {
                $callback = $entry['function'];
                if (is_array($callback) && is_object($callback[0]) &&
                    (is_a($callback[0], 'Hostinger\\Reach\\Tracking\\AbandonedCarts') ||
                     is_a($callback[0], 'Hostinger\\Reach\\Api\\Webhooks\\Handlers\\WebhookHandler') ||
                     is_a($callback[0], 'Hostinger\\Reach\\Jobs\\AbandonedCartsJob') ||
                     ($frontend && is_a($callback[0], 'Hostinger\\Reach\\Integrations\\WooCommerce\\WooCommerceIntegration')))) {
                    remove_action($hook, $callback, $priority);
                }
            }
        }
    }
}
add_action('plugins_loaded', 'vcp_remove_reach_frontend_hooks', PHP_INT_MAX);
add_action('init', 'vcp_remove_reach_frontend_hooks', 0);
add_action('wp_loaded', 'vcp_remove_reach_frontend_hooks', PHP_INT_MAX);

function vcp_is_german() {
    global $TRP_LANGUAGE;
    $language = is_string($TRP_LANGUAGE ?? null) ? $TRP_LANGUAGE : get_locale();
    return strpos(strtolower($language), 'de') === 0;
}

function vcp_external_map($result, $tag, $attributes, $match) {
    if ($tag !== 'et_pb_map' || is_admin()) { return $result; }
    $url = 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode('Valentići 32, 52464 Kaštelir, Croatia');
    $label = vcp_is_german() ? 'Wegbeschreibung in Google Maps öffnen' : 'Open directions in Google Maps';
    $note = vcp_is_german()
        ? 'Google Maps öffnet sich erst nach einem Klick in einem neuen Tab. Dabei erhält Google Ihre Verbindungsdaten.'
        : 'Google Maps opens in a new tab only after you click. Google then receives your connection data.';
    return '<div class="vcp-map-link"><p>' . esc_html($note) . '</p><a href="' . esc_url($url) . '" target="_blank" rel="noopener noreferrer external">' . esc_html($label) . '</a></div>';
}
add_filter('pre_do_shortcode_tag', 'vcp_external_map', PHP_INT_MAX, 4);

function vcp_local_font_url($url) {
    return is_admin() ? $url : plugins_url('assets/fonts.css', __FILE__);
}
function vcp_local_font_css($css, $url) {
    if (is_admin() || $url !== plugins_url('assets/fonts.css', __FILE__)) { return $css; }
    // Divi may inline the fetched stylesheet. Relative URLs then need the same
    // local plugin base that the standalone stylesheet would use.
    return str_replace('url(fonts/', 'url(' . plugins_url('assets/fonts/', __FILE__), $css);
}
add_filter('et_builder_google_fonts_get_url', 'vcp_local_font_url', PHP_INT_MAX);
add_filter('et_builder_google_fonts_fetch_content', 'vcp_local_font_css', PHP_INT_MAX, 2);

function vcp_resource_hints($urls, $relation) {
    if (is_admin()) { return $urls; }
    $blocked = array('fonts.gstatic.com', 'fonts.googleapis.com', 'www.googletagmanager.com', 'www.google-analytics.com', 'region1.google-analytics.com', 'cdn-reach.hostinger.com', 'maps.googleapis.com', 'maps.gstatic.com', 'stats.wp.com', 'pixel.wp.com');
    return array_values(array_filter($urls, function ($hint) use ($blocked) {
        $url = is_array($hint) ? ($hint['href'] ?? '') : $hint;
        return !in_array(strtolower((string) wp_parse_url($url, PHP_URL_HOST)), $blocked, true);
    }));
}
add_filter('wp_resource_hints', 'vcp_resource_hints', PHP_INT_MAX, 2);

function vcp_tracking_cookie_name($name) {
    return is_string($name) && preg_match('/\A(?:_ga(?:_[A-Za-z0-9_]+)?|_gid|_gat(?:_[A-Za-z0-9_]+)?|sbjs_[a-z_]+)\z/D', $name) === 1;
}
function vcp_clear_old_tracking_cookies() {
    if (is_admin() || headers_sent()) { return; }
    $host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    $domains = array('');
    if ($host === 'villa-claudia.eu' || substr($host, -17) === '.villa-claudia.eu') { $domains[] = '.villa-claudia.eu'; }
    foreach (array_keys($_COOKIE) as $name) {
        if (!vcp_tracking_cookie_name($name)) { continue; }
        foreach ($domains as $domain) {
            setcookie($name, '', array('expires' => time() - DAY_IN_SECONDS, 'path' => '/', 'domain' => $domain, 'secure' => is_ssl(), 'samesite' => 'Lax'));
        }
    }
}
add_action('send_headers', 'vcp_clear_old_tracking_cookies');

function vcp_policy_url($original = '', $policy_page_id = 0) {
    $german = vcp_is_german();
    $page = get_page_by_path($german ? 'datenschutz' : 'privacy-policy');
    if ($page && $page->post_status === 'publish') {
        return home_url($german ? '/de/datenschutz/' : '/privacy-policy/');
    }
    $english = get_page_by_path('privacy-policy');
    return $english && $english->post_status === 'publish' ? home_url('/privacy-policy/') : '';
}
add_filter('privacy_policy_url', 'vcp_policy_url', PHP_INT_MAX, 2);

function vcp_checkout_privacy_text($text, $type) {
    if ($type !== 'checkout') { return $text; }
    return vcp_is_german()
        ? 'Wir verwenden Ihre Angaben, um Ihre Buchung und Zahlung zu bearbeiten. Lesen Sie unsere [privacy_policy].'
        : 'We use the information you enter to process your booking and payment. Read our [privacy_policy].';
}
add_filter('woocommerce_get_privacy_policy_text', 'vcp_checkout_privacy_text', PHP_INT_MAX, 2);

function vcp_reservation_privacy_notice() {
    if (is_admin()) { return; }
    $url = vcp_policy_url();
    if (!$url) { return; }
    $text = vcp_is_german()
        ? 'Wir verwenden Ihre Angaben für Ihre Buchung, Zahlung und die gesetzliche Gästeanmeldung. Lesen Sie unsere '
        : 'We use your details for your booking, payment and statutory guest registration. Read our ';
    echo '<p class="vcp-reservation-privacy">' . esc_html($text) . '<a href="' . esc_url($url) . '" target="_blank" rel="noopener noreferrer">' . esc_html(vcp_is_german() ? 'Datenschutzerklärung' : 'privacy policy') . '</a>.</p>';
}
// Native MotoPress hook appears immediately before its contact fields.
add_action('mphb_sc_checkout_form_customer_details', 'vcp_reservation_privacy_notice', 5);

function vcp_privacy_footer() {
    $url = vcp_policy_url();
    if (!$url) { return; }
    echo '<nav class="vcp-privacy-footer" aria-label="' . esc_attr(vcp_is_german() ? 'Datenschutz' : 'Privacy') . '"><a href="' . esc_url($url) . '">' . esc_html(vcp_is_german() ? 'Datenschutzerklärung' : 'Privacy policy') . '</a></nav>';
}
add_action('wp_footer', 'vcp_privacy_footer', 30);
function vcp_valid_paid_receipt() {
    if (!function_exists('wc_get_order')) { return false; }
    if (function_exists('is_order_received_page') && is_order_received_page()) {
        $key = $_GET['key'] ?? '';
        if (!is_string($key) || $key === '') { return false; }
        $order = wc_get_order(absint(get_query_var('order-received')));
        return $order && $order->is_paid() && hash_equals((string) $order->get_order_key(), wp_unslash($key));
    }
    // The MotoPress Woo bridge can redirect directly to its own paid receipt.
    if (!function_exists('MPHB') || !is_page(MPHB()->settings()->pages()->getReservationReceivedPageId())) { return false; }
    $id = $_GET['payment_id'] ?? '';
    $key = $_GET['payment_key'] ?? '';
    if (!is_string($id) || !preg_match('/\A[1-9][0-9]*\z/D', $id) || !is_string($key) || $key === '') { return false; }
    $payment = MPHB()->getPaymentRepository()->findById(absint($id));
    if (!$payment || $payment->getGatewayId() !== 'woocommerce' || $payment->getStatus() !== 'mphb-p-completed' ||
        !hash_equals((string) $payment->getKey(), wp_unslash($key))) { return false; }
    $order = wc_get_order(absint($payment->getTransactionId()));
    if (!$order || !$order->is_paid()) { return false; }
    foreach ($order->get_items() as $item) {
        if ((string) $item->get_meta('_mphb_payment_id') === (string) $payment->getId()) { return true; }
    }
    return false;
}
function vcp_completed_checkout_cache() {
    if (!vcp_valid_paid_receipt()) { return; }
    // Only the valid, paid receipt page clears the completed checkout cache.
    // Active checkout, failed payments and unrelated browser storage are kept.
    wp_enqueue_script('villa-claudia-completed-checkout', plugins_url('assets/checkout-complete.js', __FILE__), array('wp-data'), '1.0.0', true);
}
add_action('wp_enqueue_scripts', 'vcp_completed_checkout_cache', 20);
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('villa-claudia-privacy', plugins_url('assets/privacy.css', __FILE__), array(), '1.0.0');
});
