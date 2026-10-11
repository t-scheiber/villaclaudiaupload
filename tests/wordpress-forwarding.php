<?php
// Synthetic files and a mail stub. This test never loads WordPress or sends email.
define('ABSPATH', __DIR__ . '/');
$root = sys_get_temp_dir() . '/vc-forwarding-' . bin2hex(random_bytes(8));
mkdir($root, 0700);
$meta = array(); $mails = array(); $mail_result = true; $mail_throws = false;
class WP_Error {
    public $code; public $message;
    public function __construct($code, $message, $data) { $this->code = $code; $this->message = $message; }
}
function is_wp_error($value) { return $value instanceof WP_Error; }
function is_email($value) { return filter_var($value, FILTER_VALIDATE_EMAIL); }
function absint($value) { return abs((int) $value); }
function wp_upload_dir() { global $root; return array('basedir' => $root); }
function wp_mkdir_p($path) { return is_dir($path) || mkdir($path, 0700, true); }
function sanitize_file_name($name) { return preg_replace('/[^a-zA-Z0-9._-]/', '-', $name); }
function get_post_meta($id, $key, $single = false) { global $meta; return $meta[$id][$key] ?? ($single ? '' : array()); }
function update_post_meta($id, $key, $value) { global $meta; $meta[$id][$key] = $value; return true; }
function current_time($format) { return '2026-10-11 12:00:00'; }
function wp_mail($to, $subject, $message, $headers, $attachments) {
    global $mails, $mail_result, $mail_throws;
    $mails[] = array('paths' => $attachments, 'contents' => array_map('file_get_contents', $attachments));
    if ($mail_throws) { throw new RuntimeException('Synthetic mail failure'); }
    return $mail_result;
}
require $argv[1];
class Harness { use Villa_Claudia_Workflow; public function send($to = 'operator@example.invalid') { return $this->send_verified_documents(42, $to, 'Synthetic', 'Synthetic'); } }
function check($condition, $description) { if (!$condition) { throw new RuntimeException('FAIL: ' . $description); } echo 'PASS: ' . $description . PHP_EOL; }
function clean($path) { if (is_dir($path)) { foreach (array_diff(scandir($path), array('.', '..')) as $name) { clean($path . '/' . $name); } rmdir($path); } else { unlink($path); } }
try {
    mkdir($root . '/booking-documents/42', 0700, true);
    file_put_contents($root . '/booking-documents/42/front.jpg', 'SYNTHETIC FRONT');
    file_put_contents($root . '/booking-documents/42/back.jpg', 'SYNTHETIC BACK');
    $info = array('traveler_name' => 'Synthetic Guest', 'document_type' => 'id_card', 'document_number' => 'NOT-AN-ID', 'status' => 'verified');
    $meta[42]['villa_claudia_document'] = array($info + array('filename' => 'front.jpg'), $info + array('filename' => 'back.jpg'));
    $h = new Harness();
    check($h->send()['recorded'], 'complete forwarding records its accepted email');
    check(count(array_unique($mails[0]['paths'])) === 2, 'front and back use different attachment names');
    check($mails[0]['contents'] === array('SYNTHETIC FRONT', 'SYNTHETIC BACK'), 'both original document pages reach the mail stub');
    check(!glob($root . '/booking-documents/send-*'), 'successful send removes all temporary files');
    $meta[42]['villa_claudia_document'][0]['traveler_name'] = str_repeat('Long-name-', 30);
    $meta[42]['villa_claudia_document'][0]['document_number'] = str_repeat('X', 100);
    $h->send();
    check(dirname($mails[0]['paths'][0]) !== dirname($mails[1]['paths'][0]), 'each forwarding attempt has a unique directory');
    check(strlen(basename($mails[1]['paths'][0])) < 255, 'long guest metadata stays within filesystem filename limits');
    check($h->send('invalid')->code === 'invalid_recipient' && count($mails) === 2, 'invalid recipient prevents file preparation and mail');
    unlink($root . '/booking-documents/42/back.jpg');
    unset($meta[42]['villa_claudia_documents_sent']);
    check($h->send()->code === 'missing_document' && count($mails) === 2, 'one missing verified document blocks the entire send');
    check(!isset($meta[42]['villa_claudia_documents_sent']), 'incomplete attachment set never gets a sent status');
    check(!glob($root . '/booking-documents/send-*'), 'failed preparation leaves no temporary document copies');
    file_put_contents($root . '/booking-documents/42/back.jpg', 'SYNTHETIC BACK');
    $mail_result = false;
    check($h->send()->code === 'mail_failed' && !glob($root . '/booking-documents/send-*'), 'mail rejection reports failure and cleans up');
    $mail_throws = true;
    check($h->send()->code === 'forwarding_failed' && !glob($root . '/booking-documents/send-*'), 'mail exception reports failure and cleans up');
    $meta[42]['villa_claudia_document'][1]['filename'] = '../front.jpg';
    check($h->send()->code === 'missing_document', 'unsafe stored filename is rejected');
} finally { clean($root); }
