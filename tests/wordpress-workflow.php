<?php
// Isolated contract tests. No WordPress installation or customer database is loaded.
define('ABSPATH', __DIR__ . '/');
$meta = array(); $options = array(); $posts = array(42 => (object) array('post_type' => 'mphb_booking', 'post_status' => 'confirmed'));
class WP_Error { public $code; public $data; public function __construct($code,$message,$data) { $this->code=$code;$this->data=$data; } }
class WP_REST_Request { private $params=array(); public function __construct($method='GET') {} public function set_param($k,$v) {$this->params[$k]=$v;} public function get_param($k){return $this->params[$k]??null;} public function get_file_params(){return array();} }
function is_wp_error($x){return $x instanceof WP_Error;}
function get_post($id){global $posts;return $posts[$id]??null;}
function get_post_meta($id,$key,$single=false){global $meta;return $meta[$id][$key]??($single?'':array());}
function update_post_meta($id,$key,$value){global $meta;$meta[$id][$key]=$value;return true;}
function current_time($format){return $format==='Y-m-d'?'2026-09-22':'2026-09-22 12:00:00';}
function wp_timezone(){return new DateTimeZone('Europe/Zagreb');}
function absint($x){return abs((int)$x);}
function is_email($x){return filter_var($x,FILTER_VALIDATE_EMAIL);}
function add_option($key,$value,$deprecated='',$autoload=false){global $options;if(isset($options[$key]))return false;$options[$key]=$value;return true;}
function get_option($key){global $options;return $options[$key]??false;}
function delete_option($key){global $options;unset($options[$key]);}
function delete_post_meta($id,$key,$value=null){
    global $meta,$delete_failure,$concurrent_document;
    if ($concurrent_document) { $meta[$id][$key][]=$concurrent_document; $concurrent_document=null; }
    if ($delete_failure) { return false; }
    if ($value===null) { unset($meta[$id][$key]); return true; }
    foreach ($meta[$id][$key] as $index=>$stored) { if ($stored===$value) { unset($meta[$id][$key][$index]);return true; } }
    return false;
}
function wp_upload_dir(){return array('basedir'=>sys_get_temp_dir().'/vc-isolated-nonexistent');}
$wpdb=new class {public $postmeta='fake_postmeta';public function prepare($sql,$value){return $value;}public function get_var($query){return 42;}};
require $argv[1];
class Harness { use Villa_Claudia_Workflow; public function remove($id,$name){return $this->remove_stored_document($id,$name);} public function issue($id){return $this->get_secure_booking_id($id);} public function resolve($token){return $this->resolve_upload_booking($token);} public function get_booking_data($r){$id=$r->get_param('id');return array('bookingId'=>$id,'checkInDate'=>get_post_meta($id,'mphb_check_in_date',true),'checkOutDate'=>get_post_meta($id,'mphb_check_out_date',true),'guestEmail'=>get_post_meta($id,'mphb_email',true),'guestName'=>'Fixture','status'=>'confirmed');} }
function check($condition,$description){if(!$condition){fwrite(STDERR,"FAIL: $description\n");exit(1);}echo "PASS: $description\n";}
$h=new Harness();
update_post_meta(42,'mphb_check_in_date',date('Y-m-d',strtotime('+2 days')));
update_post_meta(42,'mphb_check_out_date','2030-01-01');
update_post_meta(42,'mphb_email','fixture@example.invalid');
update_post_meta(42,'villa_claudia_secure_id','422026092920261006');
check(is_wp_error($h->resolve('422026092920261006')),'persisted legacy tokens rejected');
$token=$h->issue(42);check((bool)preg_match('/\Avc_[a-f0-9]{64}\z/',$token),'opaque random token issued');
check($h->resolve($token)===42,'valid token resolves canonical booking');
check(is_wp_error($h->resolve(strtoupper($token))),'case-altered token rejected');
check(is_wp_error($h->resolve('vc_'.str_repeat('0',64))),'exact token comparison after database lookup');
check(is_wp_error($h->resolve($token."\n")),'trailing newline rejected');
$posts[42]->post_status='cancelled';check(is_wp_error($h->resolve($token)),'cancelled booking rejected');$posts[42]->post_status='confirmed';
update_post_meta(42,'mphb_check_out_date','2026-09-01');check(is_wp_error($h->resolve($token)),'expired booking rejected');
update_post_meta(42,'mphb_check_out_date','2030-01-01');update_post_meta(42,'mphb_email','changed@example.invalid');
check(is_wp_error($h->resolve($token)),'changed booking identity revokes previous token');
$fresh=$h->issue(42);check($fresh!==$token && $h->resolve($fresh)===42,'admin reissue rotates changed booking token');
$r=new WP_REST_Request();$r->set_param('bookingId',42);$c=$h->claim_reminder($r);
check($c['claimed']===true,'eligible reminder atomically claimed');
$second=$h->claim_reminder($r);check($second['claimed']===false && $second['pending']===true,'concurrent or uncertain reminder blocked visibly');
$r->set_param('claimId','wrong');$r->set_param('delivered',true);check(is_wp_error($h->complete_reminder($r)),'other worker cannot complete a claim');
$r->set_param('claimId',$c['claimId']);check($h->complete_reminder($r)['success']===true,'delivery acknowledgement recorded');
check($h->claim_reminder($r)['claimed']===false,'completed reminder never reclaimed');
update_post_meta(42,'mphb_email','corrected@example.invalid');
check($h->claim_reminder($r)['claimed']===true,'corrected identity receives a replacement reminder');
$fresh=$h->issue(42);
$r->set_param('uploadToken','422026092920261006');check(is_wp_error($h->handle_document_upload($r)),'numeric upload cannot choose a filesystem destination');
$r->set_param('uploadToken',$fresh);check($h->handle_document_upload($r)->code==='invalid_files','empty upload rejected before storage');
$delete_failure=false;$concurrent_document=['filename'=>'new.png'];
$meta[42]['villa_claudia_document']=[['filename'=>'old.png'],['filename'=>'keep.png']];
check($h->remove(42,'old.png')===true,'selected document removed');
check(array_values($meta[42]['villa_claudia_document'])===[['filename'=>'keep.png'],['filename'=>'new.png']],'concurrent upload and other documents retain metadata');
$delete_failure=true;
check($h->remove(42,'keep.png')->code==='delete_failed','database deletion failure is reported');
check(count($meta[42]['villa_claudia_document'])===2,'failed deletion preserves other records');
check($h->remove(42,'missing.png')->code==='document_not_found','missing document does not report successful deletion');
