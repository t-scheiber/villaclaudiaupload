<?php
// Local contract checks. No WordPress database, network request or email is used.
define('ABSPATH', __DIR__ . '/');
$environment = 'production';
$filters = array();
function wp_get_environment_type() { return $GLOBALS['environment']; }
function add_filter($name, $callback, $priority = 10, $accepted_args = 1) { $GLOBALS['filters'][$name] = $callback; }
function wp_json_encode($value) { return json_encode($value); }
function wp_parse_url($url, $component) { return parse_url($url, $component); }
class WP_Error {
    public $code;
    public function __construct($code, $message) { $this->code = $code; }
}
function check($condition, $description) {
    if (!$condition) { throw new RuntimeException('FAIL: ' . $description); }
    echo 'PASS: ' . $description . PHP_EOL;
}

$guard = dirname(__DIR__) . '/scripts/staging-guard.php';
require $guard;
check($filters === array(), 'staging guard installs no filters on production');
$environment = 'staging';
require $guard;
$mail = $filters['pre_wp_mail'];
$request = $filters['pre_http_request'];
$settings = $filters['option_woocommerce_stripe_settings'];

check($mail(null, array('subject' => 'Synthetic test')) === false, 'unconfigured receipt path never reports captured mail');
$root = sys_get_temp_dir() . '/vc-guard-' . bin2hex(random_bytes(8));
define('VILLA_QA_RECEIPTS', $root . '/receipts.jsonl');
try {
    check($mail(null, array('subject' => 'Synthetic test')) === false, 'missing receipt directory fails closed');
    file_put_contents($root, 'Synthetic non-directory fixture');
    check($mail(null, array('subject' => 'Synthetic test')) === false, 'unwritable receipt path fails closed when its parent is not a directory');
    unlink($root);
    mkdir($root, 0700);
    check($mail(null, array('subject' => 'Synthetic test', 'to' => 'synthetic@example.invalid', 'message' => 'Not retained')) === true, 'writable private receipt captures mail successfully');
    $receipt = json_decode(trim(file_get_contents(VILLA_QA_RECEIPTS)), true, 512, JSON_THROW_ON_ERROR);
    check($receipt['captured'] === true && $receipt['subject'] === 'Synthetic test' && isset($receipt['time']) && !isset($receipt['to']) && !isset($receipt['message']), 'receipt records capture evidence without recipient or message contents');
    $mail(null, array('subject' => 'Second synthetic test'));
    check(count(file(VILLA_QA_RECEIPTS, FILE_IGNORE_NEW_LINES)) === 2, 'subsequent captures append instead of replacing earlier receipts');
} finally {
    if (is_file(VILLA_QA_RECEIPTS)) { unlink(VILLA_QA_RECEIPTS); }
    if (is_file($root)) { unlink($root); }
    elseif (is_dir($root)) { rmdir($root); }
}

$stripe = 'https://api.stripe.com/v1/payment_intents';
foreach (array('sk_test_Synthetic123', 'rk_test_Synthetic123') as $key) {
    check($request(false, array('headers' => array('Authorization' => 'Bearer ' . $key)), $stripe) === false, 'Stripe test Bearer authentication is allowed');
    check($request(false, array('headers' => array('authorization' => 'Basic ' . base64_encode($key . ':'))), $stripe) === false, 'Stripe test Basic authentication is allowed');
}
foreach (array('Bearer sk_live_Synthetic123', 'Bearer rk_live_Synthetic123', 'Basic ' . base64_encode('sk_live_Synthetic123:'), 'Basic ' . base64_encode('rk_live_Synthetic123:'), 'Bearer sk_test_', 'Basic invalid-base64!', 'Basic ' . base64_encode('sk_test_Synthetic123:unexpected-password'), '') as $auth) {
    $result = $request(false, array('headers' => array('Authorization' => $auth)), $stripe);
    check($result instanceof WP_Error && $result->code === 'qa_outbound_blocked', 'live, malformed and absent Stripe credentials are blocked');
}
foreach (array('https://villa-claudia.eu/wp-json/', 'https://calendar.example.invalid/feed.ics', 'https://api.stripe.com.attacker.invalid/v1/payment_intents') as $url) {
    check($request(false, array('headers' => array('Authorization' => 'Bearer sk_test_Synthetic123')), $url) instanceof WP_Error, 'test credentials do not allow production, calendar or lookalike hosts');
}
check($request(false, array(), 'https://qa20261015.villa-claudia.eu/wp-json/') === false, 'requests to the isolated QA site are allowed');
$previous_error = new WP_Error('earlier_block', 'Synthetic error');
check($request($previous_error, array('headers' => array('Authorization' => 'Bearer sk_test_Synthetic123')), $stripe) === $previous_error, 'an earlier HTTP filter error is preserved');
$result = $settings(array('testmode' => 'no', 'secret_key' => 'sk_live_Synthetic123', 'publishable_key' => 'pk_live_Synthetic123', 'test_secret_key' => 'sk_test_Synthetic123'));
check($result['testmode'] === 'yes' && $result['secret_key'] === '' && $result['publishable_key'] === '' && $result['test_secret_key'] === 'sk_test_Synthetic123', 'WooCommerce is forced to test mode with live keys removed and the test key retained');
check($settings(null) === array('testmode' => 'yes', 'secret_key' => '', 'publishable_key' => ''), 'malformed WooCommerce settings remain safely in test mode');
