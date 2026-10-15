<?php
// Real multipart HTTP uploads against an isolated PHP server. No WordPress or mail service is contacted.
$root = sys_get_temp_dir() . '/vc-upload-' . bin2hex(random_bytes(8));
mkdir($root, 0700);
function check($condition, $description) { if (!$condition) { throw new RuntimeException('FAIL: ' . $description); } echo 'PASS: ' . $description . PHP_EOL; }
function clean($path) { if (is_dir($path)) { foreach (array_diff(scandir($path), array('.', '..')) as $name) { clean($path . '/' . $name); } rmdir($path); } else { unlink($path); } }
function upload($files, $details=null, $scenario='') {
    global $root, $address;
    if (is_dir($root . '/booking-documents')) { clean($root . '/booking-documents'); }
    $boundary='vc-' . bin2hex(random_bytes(12));
    $part=function($name, $value) use ($boundary) { return "--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n"; };
    $body=$part('uploadToken', 'vc_' . str_repeat('a', 64));
    foreach ($files as $index=>$contents) {
        $body.=$part('file_info_file_' . $index, is_string($details) ? $details : json_encode($details ?? array('travelerName'=>'Synthetic Guest','documentType'=>'passport','documentNumber'=>'NOT-AN-ID')));
        $body.="--$boundary\r\nContent-Disposition: form-data; name=\"file_$index\"; filename=\"synthetic.pdf\"\r\nContent-Type: application/pdf\r\n\r\n$contents\r\n";
    }
    $body.="--$boundary--\r\n";
    $context=stream_context_create(array('http'=>array('method'=>'POST','header'=>"Content-Type: multipart/form-data; boundary=$boundary\r\n",'content'=>$body,'ignore_errors'=>true,'timeout'=>15)));
    $result=file_get_contents('http://' . $address . '/?scenario=' . urlencode($scenario), false, $context);
    try { return json_decode($result, true, 512, JSON_THROW_ON_ERROR); }
    catch (JsonException $error) { throw new RuntimeException('Isolated upload response was not JSON: ' . $result, 0, $error); }
}
$server=stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
if (!$server) { throw new RuntimeException('Cannot reserve local upload test port.'); }
$address=stream_socket_get_name($server, false); fclose($server);
$command=array(PHP_BINARY);
if (!class_exists('finfo') && PHP_OS_FAMILY === 'Windows') { $command=array_merge($command, array('-d', 'extension_dir="' . dirname(PHP_BINARY) . '/ext"', '-d', 'extension=fileinfo')); }
$command=array_merge($command, array('-d','post_max_size=32M','-d','upload_max_filesize=12M','-d','max_file_uploads=20','-S',$address,__DIR__ . '/fixtures/wordpress-upload-router.php'));
$previous=getenv('VC_UPLOAD_TEST_ROOT'); putenv('VC_UPLOAD_TEST_ROOT=' . $root);
$process=proc_open($command, array(0=>array('pipe','r'), 1=>array('file',$root . '/server.log','a'), 2=>array('file',$root . '/server.log','a')), $pipes);
if (!is_resource($process)) { throw new RuntimeException('Cannot start isolated upload server.'); }
try {
    $ready=false;
    for ($i=0; $i<50; $i++) { $socket=@stream_socket_client('tcp://' . $address, $errno, $error, 0.1); if ($socket) { fclose($socket); $ready=true; break; } usleep(100000); }
    check($ready, 'isolated multipart upload server starts');
    $pdf="%PDF-1.4\nSYNTHETIC DOCUMENT, NOT AN ID";
    $result=upload(array($pdf,$pdf));
    check(($result['result']['success'] ?? false) && $result['result']['storedCount'] === 2 && $result['result']['bookingId'] === 42, 'real multipart upload stores the complete batch for its canonical booking');
    check(count($result['files']) === 2 && count(array_unique($result['files'])) === 2, 'duplicate input filenames receive independent random storage names');
    check($result['protected'] && $result['documents'][0]['status'] === 'pending', 'stored documents start pending in protected directories');
    check(upload(array())['result']['code'] === 'invalid_files', 'empty multipart upload is rejected');
    check(upload(array_fill(0,9,$pdf))['result']['code'] === 'invalid_files', 'more than eight multipart files are rejected');
    foreach (array('not a PDF', '', $pdf . str_repeat('x',10*1024*1024)) as $contents) {
        $result=upload(array($contents));
        check(($result['result']['code'] ?? '') === 'invalid_file' && !$result['files'] && !$result['documents'], 'content sniffing, empty file and individual size checks reject before storage');
    }
    foreach (array('null', 'malformed', array('travelerName'=>' ','documentType'=>'passport','documentNumber'=>'TEST'), array('travelerName'=>'Synthetic','documentType'=>'passport','documentNumber'=>' '), array('travelerName'=>'<b></b>','documentType'=>'passport','documentNumber'=>'TEST'), array('travelerName'=>'Synthetic','documentType'=>'passport','documentNumber'=>'<b></b>'), array('travelerName'=>str_repeat('x',201),'documentType'=>'passport','documentNumber'=>'TEST'), array('travelerName'=>'Synthetic','documentType'=>'passport','documentNumber'=>str_repeat('x',101))) as $details) {
        $result=upload(array($pdf),$details);
        check(($result['result']['code'] ?? '') === 'invalid_file' && !$result['files'], 'malformed, blank and oversized metadata are rejected before storage');
    }
    $result=upload(array_fill(0,3,$pdf . str_repeat('x', (int)(8.5*1024*1024))));
    check(($result['result']['code'] ?? '') === 'invalid_file' && !$result['files'], 'combined document limit rejects the entire multipart batch');
    foreach (array('metadata-failure','status-failure') as $scenario) {
        $result=upload(array($pdf,$pdf),null,$scenario);
        check(($result['result']['code'] ?? '') === 'storage_failed' && !$result['files'] && !$result['documents'], 'database failure rolls back every file and document record in the batch');
    }
} finally {
    proc_terminate($process); foreach ($pipes as $pipe) { fclose($pipe); } proc_close($process);
    putenv($previous === false ? 'VC_UPLOAD_TEST_ROOT' : 'VC_UPLOAD_TEST_ROOT=' . $previous);
    clean($root);
}
