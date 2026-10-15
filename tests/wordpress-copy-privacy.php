<?php
// Synthetic files and in-memory WordPress records only. No guest or email service is used.
define('ABSPATH', __DIR__ . '/');
$meta = array(); $posts = array(42 => (object) array('post_type'=>'mphb_booking','post_status'=>'confirmed'));
$legacy_root=sys_get_temp_dir().'/vc-legacy-erasure-'.bin2hex(random_bytes(8));mkdir($legacy_root,0700);
define('VILLA_CLAUDIA_ERASURE_RECEIPT',$legacy_root.'/receipt.json');
file_put_contents(VILLA_CLAUDIA_ERASURE_RECEIPT,json_encode(array('approved_orphan_files'=>array(array('path_hash'=>str_repeat('0',64),'size'=>0)))));
$delete_failure = false; $write_failure = false; $mails = 0;
class WP_Error { public $code; public $message; public $data; public function __construct($code,$message,$data) {$this->code=$code;$this->message=$message;$this->data=$data;} }
class WP_REST_Request { private $params=array(); public function __construct($method='GET') {} public function set_param($key,$value){$this->params[$key]=$value;} public function get_param($key){return $this->params[$key]??null;} public function get_file_params(){return array();} }
function is_wp_error($value){return $value instanceof WP_Error;}
function get_post($id){global $posts;return $posts[$id]??null;}
function get_post_meta($id,$key,$single=false){global $meta;return $meta[$id][$key]??($single?'':array());}
function update_post_meta($id,$key,$value){global $meta,$write_failure;if($write_failure && $key==='villa_claudia_copy_exception')return false;$meta[$id][$key]=$value;return true;}
function delete_post_meta($id,$key,$value=null){global $meta,$delete_failure;if($delete_failure)return false;if($value===null){unset($meta[$id][$key]);return true;}foreach($meta[$id][$key]??array() as $index=>$stored){if($stored===$value){unset($meta[$id][$key][$index]);return true;}}return false;}
function absint($value){return abs((int)$value);}
function current_time($format){return date($format==='mysql'?'Y-m-d H:i:s':$format);}
function wp_cache_delete($id,$group){global $cache_hook;if($cache_hook){$hook=$cache_hook;$cache_hook=null;$hook();}return true;}
function wp_upload_dir(){global $legacy_root;return array('basedir'=>$legacy_root);}
function wp_mail(){global $mails;$mails++;return true;}
$wpdb = new class {
    public $prefix; public $postmeta='synthetic'; public $available=true; public $calls=array(); public $acquire_hook=null;
    public function __construct(){$this->prefix='privacy_'.bin2hex(random_bytes(8));}
    public function prepare($sql,$value){return array($sql,$value);}
    public function get_var($query){
        if(str_contains($query[0],'GET_LOCK')){$this->calls[]='acquire';if($this->acquire_hook){$hook=$this->acquire_hook;$this->acquire_hook=null;$hook();}return $this->available?1:0;}
        if(str_contains($query[0],'RELEASE_LOCK')){$this->calls[]='release';return 1;}
        return 42;
    }
    public function get_col($sql){global $meta;return array_keys($meta);}
};
require $argv[1];
class Harness { use Villa_Claudia_Workflow;
    public function root(){return $this->copy_storage_root();}
    public function active($id=42){return $this->active_copy_case($id);}
    public function fingerprint(){return $this->booking_fingerprint(42);}
    public function issue(){return $this->get_secure_booking_id(42);}
    public function reapply(){return $this->reapply_legacy_erasure();}
    public function send(){return $this->send_verified_documents(42,'operator@example.invalid','Synthetic','Synthetic');}
}
function check($condition,$description){if(!$condition){throw new RuntimeException('FAIL: '.$description);}echo 'PASS: '.$description.PHP_EOL;}
function clean($path){if(is_link($path)){unlink($path);}elseif(is_dir($path)){foreach(array_diff(scandir($path),array('.','..')) as $name){clean($path.'/'.$name);}rmdir($path);}elseif(is_file($path)){unlink($path);}}
$h=new Harness();$root=$h->root();
function seed_case(){global $meta,$posts,$h;$posts[42]->post_status='confirmed';$meta[42]=array('mphb_check_in_date'=>date('Y-m-d'),'mphb_check_out_date'=>date('Y-m-d',strtotime('+10 days')),'mphb_email'=>'synthetic@example.invalid','mphb_first_name'=>'Synthetic','mphb_last_name'=>'Adult');$meta[42]['villa_claudia_copy_exception']=array('case_id'=>str_repeat('b',32),'state'=>'open','fingerprint'=>$h->fingerprint(),'arrival_at'=>time()-60,'expires_at'=>time()+3600,'traveler_name'=>'Synthetic Adult','objective_reason'=>'PRIVATE OPERATOR DETAIL MUST NOT REACH THE GUEST');return $h->issue();}
function store_fixture(){global $meta,$root;if(!is_dir($root.'/42'))mkdir($root.'/42',0700,true);file_put_contents($root.'/42/synthetic.pdf','SYNTHETIC NOT AN ID');file_put_contents($root.'/42/interrupted-upload.tmp','SYNTHETIC ORPHAN');$meta[42]['villa_claudia_document']=array(array('filename'=>'synthetic.pdf','traveler_name'=>'Synthetic Adult','document_number'=>'LEGACY-TEST-NUMBER','copy_case_id'=>str_repeat('b',32)));$meta[42]['villa_claudia_has_documents']=true;}
function withdrawal($token,$case=null){global $h;$r=new WP_REST_Request('POST');$r->set_param('uploadToken',$token);$r->set_param('copyCaseId',$case??str_repeat('b',32));return $h->withdraw_copy_agreement($r);}
try {
    seed_case();unset($meta[42]['villa_claudia_copy_exception']);
    check($h->active()===false && $h->public_copy_exception(42)['active']===false,'normal bookings expose no document-copy exception');
    $token=seed_case();$public=$h->public_copy_exception(42);
    check($public['active']===true && $public['caseId']===str_repeat('b',32) && $public['travelerName']==='Synthetic Adult','active exception exposes its canonical adult and case reference');
    check(!str_contains(json_encode($public),'PRIVATE OPERATOR DETAIL') && !$public['hasCopies'],'private objective reason is not exposed and absent files are not claimed');
    foreach(array('future-arrival','expired','over-deadline','changed-identity','wrong-case-shape','closed','empty-adult','changed-adult-name','cancelled') as $scenario){
        seed_case();$case=&$meta[42]['villa_claudia_copy_exception'];
        if($scenario==='future-arrival')$case['arrival_at']=time()+60;
        if($scenario==='expired')$case['expires_at']=time()-1;
        if($scenario==='over-deadline')$case['expires_at']=$case['arrival_at']+85801;
        if($scenario==='changed-identity')$meta[42]['mphb_email']='corrected@example.invalid';
        if($scenario==='wrong-case-shape')$case['case_id']='invalid';
        if($scenario==='closed')$case['state']='withdrawn';
        if($scenario==='empty-adult')$case['traveler_name']=' ';
        if($scenario==='changed-adult-name')$meta[42]['mphb_first_name']='Corrected';
        if($scenario==='cancelled')$posts[42]->post_status='cancelled';
        check($h->active()===false,'case gate rejects '.$scenario);
        unset($case);
    }
    $token=seed_case();store_fixture();
    check($h->public_copy_exception(42)['hasCopies']===true,'actual temporary file is visible only in its valid case');
    $wpdb->available=false;$before=$meta;
    check(withdrawal($token)->code==='copy_busy' && $meta===$before && is_file($root.'/42/synthetic.pdf'),'busy copy lock prevents competing withdrawal and preserves storage');
    $wpdb->available=true;$wpdb->calls=array();
    check(withdrawal($token,str_repeat('c',32))->code==='copy_case_changed' && $wpdb->calls===array('acquire','release'),'stale case cannot erase another agreement and releases its lock');
    $wpdb->calls=array();$result=withdrawal($token);
    check($result['success'] && $result['withdrawn'] && $result['deletedCount']===1,'withdrawal confirms the exact removed copy count');
    check(!is_dir($root.'/42') && empty($meta[42]['villa_claudia_document']),'withdrawal removes both committed and interrupted files plus document fields');
    check(!isset($meta[42]['villa_claudia_copy_exception']['traveler_name']) && $meta[42]['villa_claudia_copy_exception']['state']==='withdrawn','closed exception audit drops the duplicated adult name');
    check($wpdb->calls===array('acquire','release'),'successful erasure always releases the booking copy lock');
    check(withdrawal($token)['deletedCount']===0,'repeated withdrawal is idempotent');
    check($h->public_copy_exception(42)['caseId']===str_repeat('b',32),'closed canonical response retains the case reference for idempotent withdrawal');
    $token=seed_case();store_fixture();$meta[42]['villa_claudia_copy_exception']['expires_at']=time()-1;
    $public=$h->public_copy_exception(42);
    check(!$public['active'] && !$public['hasCopies'] && !is_dir($root.'/42'),'canonical lookup erases an expired open case before reporting no copy');
    check($public['caseId']===str_repeat('b',32) && withdrawal($token)['withdrawn'],'expired automatically erased case still allows withdrawal acknowledgement');
    seed_case();store_fixture();$meta[42]['villa_claudia_copy_exception']['fingerprint']='obsolete';
    $result=$h->purge_expired_copies();
    check($result['success'] && $result['processed']===1 && !is_dir($root.'/42'),'scheduled cleanup removes identity-changed copies and leftover files');
    seed_case();store_fixture();$meta[42]['villa_claudia_copy_exception']['expires_at']=time()-1;$wpdb->available=false;
    $result=$h->purge_expired_copies();check(!$result['success'] && $result['failed']===1 && is_file($root.'/42/synthetic.pdf'),'scheduled cleanup reports a busy lock instead of claiming erasure');
    $wpdb->available=true;$delete_failure=true;$wpdb->calls=array();
    $result=withdrawal(get_post_meta(42,'villa_claudia_secure_id',true));
    check($result->code==='copy_cleanup_failed' && $wpdb->calls===array('acquire','release'),'metadata deletion failure is explicit and still releases the lock');
    $delete_failure=false;withdrawal(get_post_meta(42,'villa_claudia_secure_id',true));
    seed_case();store_fixture();$write_failure=true;$wpdb->calls=array();
    $result=withdrawal(get_post_meta(42,'villa_claudia_secure_id',true));
    check($result->code==='copy_cleanup_failed' && !is_dir($root.'/42') && $wpdb->calls===array('acquire','release'),'audit write failure does not falsely confirm withdrawal after physical deletion');
    $write_failure=false;withdrawal(get_post_meta(42,'villa_claudia_secure_id',true));
    seed_case();store_fixture();$meta[42]['villa_claudia_document'][0]['filename']='../synthetic.pdf';
    check(withdrawal(get_post_meta(42,'villa_claudia_secure_id',true))->code==='copy_cleanup_failed' && is_file($root.'/42/synthetic.pdf'),'unsafe stored filename fails closed without deleting a different path');
    clean($root);$meta[42]['villa_claudia_document']=array();
    seed_case();store_fixture();$meta[42]['villa_claudia_copy_exception']['expires_at']=time()-1;
    $wpdb->acquire_hook=function(){global $meta;$meta[42]['villa_claudia_copy_exception']['expires_at']=time()+3600;};
    $result=$h->purge_expired_copies();check($result['processed']===0 && is_file($root.'/42/synthetic.pdf'),'cleanup rechecks the current case after acquiring its lock');
    seed_case();store_fixture();
    $cache_hook=function(){global $meta;$meta[42]['villa_claudia_copy_exception']['state']='withdrawn';};
    $request=new WP_REST_Request('POST');$request->set_param('uploadToken',get_post_meta(42,'villa_claudia_secure_id',true));$request->set_param('copyCaseId',str_repeat('b',32));$request->set_param('copyAgreement','true');
    check($h->handle_document_upload($request)->code==='copy_not_authorized','upload refreshes stale metadata after acquiring the lock and sees concurrent withdrawal');
    seed_case();store_fixture();$token=get_post_meta(42,'villa_claudia_secure_id',true);
    $cache_hook=function(){global $meta;$meta[42]['villa_claudia_copy_exception']['case_id']=str_repeat('c',32);};
    check(withdrawal($token)->code==='copy_case_changed' && is_file($root.'/42/synthetic.pdf'),'withdrawal refreshes stale metadata and cannot erase a replacement case');
    $legacy=$legacy_root.'/booking-documents';mkdir($legacy.'/42',0700,true);
    file_put_contents($legacy.'/42/restored.pdf','OLD');file_put_contents($legacy.'/42/unapproved.pdf','UNAPPROVED');file_put_contents($legacy.'/42/size-mismatch.pdf','DIFFERENT SIZE');
    $approved=array(array('path_hash'=>hash('sha256','42/restored.pdf'),'size'=>3),array('path_hash'=>hash('sha256','42/size-mismatch.pdf'),'size'=>3));
    file_put_contents(VILLA_CLAUDIA_ERASURE_RECEIPT,json_encode(array('approved_orphan_files'=>$approved)));
    $result=$h->reapply();
    check($result['deleted']===1 && !is_file($legacy.'/42/restored.pdf'),'restored legacy file with approved relative-path hash and exact size is erased');
    check(is_file($legacy.'/42/unapproved.pdf'),'legacy restore erasure preserves every unapproved file');
    check($result['failed']===1 && is_file($legacy.'/42/size-mismatch.pdf'),'legacy restore erasure preserves and reports an approved path with a different size');
    file_put_contents($legacy_root.'/outside.pdf','OLD');
    if(function_exists('symlink') && @symlink($legacy_root.'/outside.pdf',$legacy.'/42/linked.pdf')){
        $approved[]=array('path_hash'=>hash('sha256','42/linked.pdf'),'size'=>3);
        file_put_contents(VILLA_CLAUDIA_ERASURE_RECEIPT,json_encode(array('approved_orphan_files'=>$approved)));
        $h->reapply();check(is_link($legacy.'/42/linked.pdf') && is_file($legacy_root.'/outside.pdf'),'legacy erasure does not follow or remove an approved symlink');
    }else{echo 'SKIP: operating system does not permit creating a synthetic symlink'.PHP_EOL;}
    file_put_contents(VILLA_CLAUDIA_ERASURE_RECEIPT,'not JSON');
    check($h->reapply()['failed']===1 && is_file($legacy.'/42/unapproved.pdf'),'invalid private restore receipt fails without erasing unrelated data');
    file_put_contents(VILLA_CLAUDIA_ERASURE_RECEIPT,json_encode(array('approved_orphan_files'=>array(array('path_hash'=>hash('sha256','42/unapproved.pdf'),'size'=>10)))));
    seed_case();$result=$h->purge_expired_copies();
    check($result['success'] && $result['restoredFilesErased']===1 && !is_file($legacy.'/42/unapproved.pdf'),'scheduled privacy cleanup reapplies the approved legacy restore erasure');
    check($h->send()->code==='copy_forwarding_disabled' && $mails===0,'privacy workflow cannot email identity copies');
    check(!str_contains($root,str_replace('\\','/',ABSPATH)),'temporary copies are stored outside the WordPress source and backup tree');
} finally { clean($root);clean($legacy_root); }
