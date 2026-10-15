<?php
// This router is used only by the isolated local upload contract test.
define('ABSPATH', __DIR__ . '/');
$root = getenv('VC_UPLOAD_TEST_ROOT');
if (!$root || !is_dir($root)) { http_response_code(500); exit; }
$scenario = $_GET['scenario'] ?? '';
$meta = array(42 => array(
    'mphb_check_in_date' => date('Y-m-d'), 'mphb_check_out_date' => date('Y-m-d', strtotime('+10 days')),
    'mphb_email' => 'synthetic@example.invalid', 'mphb_first_name'=>'Synthetic', 'mphb_last_name'=>'Guest', 'villa_claudia_secure_id' => 'vc_' . str_repeat('a', 64),
));
$meta[42]['villa_claudia_token_fingerprint'] = hash('sha256', implode('|', array($meta[42]['mphb_check_in_date'], $meta[42]['mphb_check_out_date'], $meta[42]['mphb_email'])));
$documents = array(); $next_id = 1;
class WP_Error { public $code; public $message; public $data; public function __construct($code, $message, $data) { $this->code=$code; $this->message=$message; $this->data=$data; } }
class WP_REST_Request { public function get_param($key) { return $_POST[$key] ?? null; } public function get_file_params() { return $_FILES; } }
function get_post($id) { return $id === 42 ? (object) array('post_type'=>'mphb_booking', 'post_status'=>'confirmed') : null; }
function get_post_meta($id, $key, $single=false) { global $meta, $documents; return $key === 'villa_claudia_document' ? array_values($documents) : ($meta[$id][$key] ?? ($single ? '' : array())); }
function update_post_meta($id, $key, $value) { global $meta, $scenario; if ($scenario === 'status-failure' && $key === 'villa_claudia_has_documents') { return false; } $meta[$id][$key]=$value; if ($scenario === 'expires-after-agreement' && $key === 'villa_claudia_copy_exception' && isset($value['agreed_at'])) { usleep(2200000); } if ($scenario === 'expires-at-completion' && $key === 'villa_claudia_has_documents' && $value === true) { $meta[$id]['villa_claudia_copy_exception']['expires_at']=time()-1; } return true; }
function add_post_meta($id, $key, $value) { global $documents, $next_id, $scenario; if ($scenario === 'metadata-failure') { return false; } $documents[$next_id]=$value; return $next_id++; }
function delete_metadata_by_mid($type, $id) { global $documents; unset($documents[$id]); return true; }
function is_wp_error($value) { return $value instanceof WP_Error; }
function absint($value) { return abs((int)$value); }
function current_time($format) { return date($format === 'mysql' ? 'Y-m-d H:i:s' : $format); }
function wp_upload_dir() { global $root; return array('basedir'=>$root); }
function wp_cache_delete($id,$group) { return true; }
function wp_mkdir_p($directory) { return is_dir($directory) || mkdir($directory, 0700, true); }
function wp_delete_file($path) { return unlink($path); }
function sanitize_file_name($value) { return preg_replace('/[^a-zA-Z0-9._-]/', '-', $value); }
function sanitize_text_field($value) { return trim(strip_tags($value)); }
$wpdb = new class { public $postmeta='isolated'; public $prefix; public function __construct() { $this->prefix='upload_' . basename(getenv('VC_UPLOAD_TEST_ROOT')); } public function prepare($sql, $value) { return $sql; } public function get_var($sql) { return str_contains($sql, 'LOCK(') ? 1 : 42; } };
require dirname(__DIR__, 2) . '/villa-claudia-docs/workflow.php';
class Harness { use Villa_Claudia_Workflow; public function storage_root() { return $this->copy_storage_root(); } }
$h = new Harness(); $storage = $h->storage_root();
function clean_storage($path) { if (is_dir($path)) { foreach (array_diff(scandir($path), array('.', '..')) as $name) { clean_storage($path . '/' . $name); } rmdir($path); } elseif (is_file($path)) { unlink($path); } }
if (is_dir($storage)) { clean_storage($storage); }
$meta[42]['villa_claudia_copy_exception']=array('case_id'=>str_repeat('b',32),'state'=>'open','fingerprint'=>$meta[42]['villa_claudia_token_fingerprint'],'arrival_at'=>time()-60,'expires_at'=>time()+3600,'traveler_name'=>'Synthetic Guest');
if ($scenario === 'no-case') { unset($meta[42]['villa_claudia_copy_exception']); }
if ($scenario === 'expired-case') { $meta[42]['villa_claudia_copy_exception']['expires_at']=time()-1; }
if ($scenario === 'future-arrival') { $meta[42]['villa_claudia_copy_exception']['arrival_at']=time()+60; }
if ($scenario === 'expires-after-agreement') { $meta[42]['villa_claudia_copy_exception']['expires_at']=time()+2; }
if ($scenario === 'changed-booking') { $meta[42]['villa_claudia_copy_exception']['fingerprint']='stale'; }
$result = $h->handle_document_upload(new WP_REST_Request());
$files = glob($storage . '/42/*') ?: array();
$protected = is_dir($storage) && is_dir($storage . '/42');
if ($protected && PHP_OS_FAMILY !== 'Windows') { $protected = (fileperms($storage) & 0777) === 0700 && (fileperms($storage . '/42') & 0777) === 0700; foreach ($files as $file) { $protected=$protected && (fileperms($file) & 0777) === 0600; } }
header('Content-Type: application/json');
http_response_code(is_wp_error($result) ? $result->data['status'] : 200);
echo json_encode(array('result'=>$result, 'documents'=>array_values($documents), 'files'=>array_map('basename', $files), 'protected'=>$protected, 'agreementRecorded'=>isset($meta[42]['villa_claudia_copy_exception']['agreed_at'])));
if (is_dir($storage)) { clean_storage($storage); }
