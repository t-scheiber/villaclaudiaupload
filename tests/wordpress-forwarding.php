<?php
// Synthetic files and a mail stub. This test never loads WordPress or sends email.
define('ABSPATH', __DIR__ . '/');
$root = sys_get_temp_dir() . '/vc-forwarding-' . bin2hex(random_bytes(8));
mkdir($root, 0700);
$meta = array(); $mails = array(); $mail_result = true; $mail_throws = false;
class WP_Error {
    public $code; public $message; public $data;
    public function __construct($code, $message, $data) { $this->code = $code; $this->message = $message; $this->data = $data; }
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
    foreach (array('operator@example.invalid', 'invalid', '') as $recipient) {
        $result = $h->send($recipient);
        check($result->code === 'copy_forwarding_disabled' && $result->data['status'] === 403, 'identity-copy forwarding is always forbidden regardless of recipient');
    }
    foreach (array('pending','verified','rejected') as $status) {
        $meta[42]['villa_claudia_document'][0]['status']=$status;
        check($h->send()->code === 'copy_forwarding_disabled', 'document review status never enables email copies');
    }
    check(count($mails) === 0, 'no forwarding attempt calls the mail provider');
    check(!glob($root . '/booking-documents/send-*'), 'no forwarding attempt creates temporary copies');
    check(!isset($meta[42]['villa_claudia_documents_sent']), 'blocked forwarding never records a successful send');
    check(file_get_contents($root . '/booking-documents/42/front.jpg') === 'SYNTHETIC FRONT', 'blocked forwarding leaves original storage untouched');
} finally { clean($root); }
