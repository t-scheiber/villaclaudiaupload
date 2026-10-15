<?php
// Isolated contracts for privacy defaults. No database, payment or mail is used.
namespace Hostinger\Reach\Tracking { class AbandonedCarts { public function capture() {} } }
namespace Hostinger\Reach\Integrations\WooCommerce { class WooCommerceIntegration { public function capture() {} } }
namespace Hostinger\Reach\Api\Webhooks\Handlers { class WebhookHandler { public function capture() {} } }
namespace Hostinger\Reach\Jobs { class AbandonedCartsJob { public function capture() {} } }
namespace {
define('ABSPATH', __DIR__ . '/');
define('DAY_IN_SECONDS', 86400);
$filters = $actions = $dequeued = $removed = $pages = array();
$admin = false;
$ajax = false;
$locale = 'en_GB';
$TRP_LANGUAGE = 'en_GB';
$orderReceived = false; $orderId = 123; $order = null; $enqueued = array();
$reservationReceived = false; $payment = null;
function add_filter($name, $callback, $priority = 10, $accepted = 1) { $GLOBALS['filters'][$name] = array($callback, $priority, $accepted); }
function add_action($name, $callback, $priority = 10, $accepted = 1) { $GLOBALS['actions'][$name] = array($callback, $priority, $accepted); }
function is_admin() { return $GLOBALS['admin']; }
function wp_doing_ajax() { return $GLOBALS['ajax']; }
function get_locale() { return $GLOBALS['locale']; }
function wp_dequeue_script($handle) { $GLOBALS['dequeued'][] = $handle; }
function remove_action($name, $callback, $priority) { $GLOBALS['removed'][] = array($name, $callback, $priority); }
function plugins_url($path, $file) { return 'https://site.example.invalid/wp-content/plugins/villa-claudia-privacy/' . $path; }
function home_url($path = '/') { return 'https://site.example.invalid' . $path; }
function wp_parse_url($url, $component) { return parse_url($url, $component); }
function get_page_by_path($slug) { return $GLOBALS['pages'][$slug] ?? null; }
function esc_html($text) { return htmlspecialchars($text, ENT_QUOTES, 'UTF-8'); }
function esc_attr($text) { return esc_html($text); }
function esc_url($url) { return esc_html($url); }
function __return_true() { return true; }
function __return_false() { return false; }
function __return_empty_array() { return array(); }
function is_order_received_page() { return $GLOBALS['orderReceived']; }
function is_page($id) { return $id === 555 && $GLOBALS['reservationReceived']; }
function get_query_var($name) { return $GLOBALS['orderId']; }
function wc_get_order($id) { return $id === $GLOBALS['orderId'] ? $GLOBALS['order'] : false; }
function absint($value) { return abs((int) $value); }
function wp_unslash($value) { return stripslashes($value); }
function wp_enqueue_script($handle, $url, $dependencies, $version, $footer) { $GLOBALS['enqueued'][] = $handle; }
class SyntheticOrder {
    public $paid = false;
    public $paymentId = 777;
    public function is_paid() { return $this->paid; }
    public function get_order_key() { return 'synthetic-order-key'; }
    public function get_items() { return array(new class($this->paymentId) {
        private $id;
        public function __construct($id) { $this->id = $id; }
        public function get_meta($name) { return $name === '_mphb_payment_id' ? $this->id : ''; }
    }); }
}
class SyntheticPayment {
    public $status = 'mphb-p-completed'; public $gateway = 'woocommerce';
    public function getId() { return 777; }
    public function getStatus() { return $this->status; }
    public function getGatewayId() { return $this->gateway; }
    public function getKey() { return 'synthetic-payment-key'; }
    public function getTransactionId() { return 123; }
}
function MPHB() { return new class {
    public function settings() { return $this; }
    public function pages() { return $this; }
    public function getReservationReceivedPageId() { return 555; }
    public function getPaymentRepository() { return $this; }
    public function findById($id) { return $id === 777 ? $GLOBALS['payment'] : false; }
}; }
function check($condition, $description) {
    if (!$condition) { throw new \RuntimeException('FAIL: ' . $description); }
    echo 'PASS: ' . $description . PHP_EOL;
}
require dirname(__DIR__) . '/villa-claudia-privacy/villa-claudia-privacy.php';

foreach (array('analytics-4', 'tagmanager', 'adsense', 'ads') as $module) {
    check(call_user_func($filters['googlesitekit_' . $module . '_tag_blocked'][0]) === true && call_user_func($filters['googlesitekit_' . $module . '_tag_amp_blocked'][0]) === true, 'optional Site Kit module tags are blocked: ' . $module);
}
check(call_user_func($filters['pre_option_woocommerce_feature_order_attribution_enabled'][0]) === 'no', 'WooCommerce native order attribution is disabled');
check(call_user_func($filters['wcpay_shopper_tracking_enabled'][0]) === false && call_user_func($filters['wcpay_frontend_tracks'][0], array('event')) === array(), 'WooPayments optional shopper events are disabled through native filters');
vcp_remove_optional_scripts();
check(count($dequeued) === 10 && in_array('sourcebuster-js', $dequeued, true) && in_array('hostinger-reach-embed', $dequeued, true) && in_array('jp-tracks-functions', $dequeued, true), 'frontend attribution, maps and marketing handles are removed');
check(!in_array('stripe', $dequeued, true) && !in_array('wc-checkout', $dequeued, true) && !in_array('wc-cart-fragments', $dequeued, true), 'transactional checkout and Stripe handles are preserved');
$admin = true; $dequeued = array(); vcp_remove_optional_scripts();
check($dequeued === array(), 'admin scripts and account connections are preserved');
$admin = false;

$reach = new \Hostinger\Reach\Tracking\AbandonedCarts();
$integration = new \Hostinger\Reach\Integrations\WooCommerce\WooCommerceIntegration();
$unrelated = new \stdClass();
$wp_filter = array('woocommerce_checkout_update_order_review' => (object) array('callbacks' => array(10 => array(
    array('function' => array($reach, 'capture')),
    array('function' => array($integration, 'capture')),
    array('function' => array($unrelated, 'unrelated')),
    array('function' => 'unrelated_function'),
))));
vcp_remove_reach_frontend_hooks();
check(count($removed) === 2 && $removed[0][1][0] === $reach && $removed[1][1][0] === $integration, 'Reach frontend collection callbacks are removed without removing unrelated hooks');
$admin = true; $removed = array(); vcp_remove_reach_frontend_hooks();
check(count($removed) === 1 && $removed[0][1][0] === $reach, 'Reach admin account integration stays available while optional collection remains disabled');
$ajax = true; $removed = array(); vcp_remove_reach_frontend_hooks();
check(count($removed) === 2, 'unauthenticated AJAX cannot bypass optional Reach collection controls');
$ajax = false;
$job = new \Hostinger\Reach\Jobs\AbandonedCartsJob();
$webhook = new \Hostinger\Reach\Api\Webhooks\Handlers\WebhookHandler();
$wp_filter['optional_job'] = (object) array('callbacks' => array(10 => array(array('function' => array($job, 'capture')), array('function' => array($webhook, 'capture')))));
$removed = array(); vcp_remove_reach_frontend_hooks();
check(count($removed) === 3 && $removed[1][1][0] === $job && $removed[2][1][0] === $webhook, 'server-side Reach abandoned-cart and purchase automation callbacks are disabled too');
check(vcp_external_map('existing', 'et_pb_map', array(), array()) === 'existing', 'builder admin keeps its native map module');
$admin = false;
check(vcp_external_map('existing', 'et_pb_text', array(), array()) === 'existing', 'other Divi shortcode modules are unchanged');
$map = vcp_external_map(false, 'et_pb_map', array(), array());
check(strpos($map, 'Open directions in Google Maps') !== false && strpos($map, 'only after you click') !== false && strpos($map, '<iframe') === false && strpos($map, '<script') === false, 'English map is a disclosed external link without automatic third-party content');
check(strpos($map, 'noopener noreferrer external') !== false && strpos($map, 'query=Valenti') !== false, 'map link has the verified address and safe new-tab attributes');
$TRP_LANGUAGE = 'de_DE';
check(strpos(vcp_external_map(false, 'et_pb_map', array(), array()), 'Wegbeschreibung') !== false, 'German map explanation follows TranslatePress language');
$TRP_LANGUAGE = null; $locale = 'de_AT';
check(vcp_is_german(), 'language falls back to the WordPress locale');
$TRP_LANGUAGE = 'en_GB';

$local = vcp_local_font_url('https://fonts.googleapis.com/css?family=Poppins');
check(strpos($local, 'site.example.invalid/') !== false && strpos($local, 'fonts.googleapis.com') === false, 'Divi uses the local font stylesheet');
$css = '@font-face{font-family:Poppins;src:url(fonts/sample.woff2) format("woff2");font-weight:600;}';
$inline = vcp_local_font_css($css, $local);
check(strpos($inline, 'url(https://site.example.invalid/wp-content/plugins/villa-claudia-privacy/assets/fonts/sample.woff2)') !== false && strpos($inline, 'font-weight:600') !== false, 'inline fonts retain face properties and resolve against the local plugin URL');
check(vcp_local_font_css($css, 'https://unrelated.example.invalid/fonts.css') === $css, 'unrelated stylesheet content remains unchanged');
$admin = true;
check(vcp_local_font_url('original') === 'original', 'admin font controls retain their original URL');
$admin = false;
$hints = array('//fonts.gstatic.com', array('href' => 'https://maps.googleapis.com', 'crossorigin' => 'anonymous'), 'https://js.stripe.com', 'https://site.example.invalid');
check(vcp_resource_hints($hints, 'preconnect') === array('https://js.stripe.com', 'https://site.example.invalid'), 'optional resource hints disappear while payment and first-party hints remain');
foreach (array('_ga', '_ga_ABC123', '_gid', '_gat_gtag_measurement', 'sbjs_current', 'sbjs_session') as $name) {
    check(vcp_tracking_cookie_name($name), 'legacy optional cookie is eligible for expiration: ' . $name);
}
foreach (array('WP_SESSION_COOKIE', 'wordpress_logged_in_example', 'wp_woocommerce_session_example', 'woocommerce_cart_hash', 'woocommerce_items_in_cart', '__stripe_mid', 'trp_language', '_gaX', 'other_sbjs_current') as $name) {
    check(!vcp_tracking_cookie_name($name), 'necessary or unrelated cookie is preserved: ' . $name);
}

check(vcp_policy_url('https://site.example.invalid/draft') === '', 'draft or missing policies are never linked');
$pages['privacy-policy'] = (object) array('post_status' => 'publish');
check(vcp_policy_url() === 'https://site.example.invalid/privacy-policy/', 'published English policy uses its canonical route');
$TRP_LANGUAGE = 'de_DE';
check(vcp_policy_url() === 'https://site.example.invalid/privacy-policy/', 'German visitor falls back to published English until German policy exists');
$pages['datenschutz'] = (object) array('post_status' => 'draft');
check(vcp_policy_url() === 'https://site.example.invalid/privacy-policy/', 'German draft does not replace a published fallback');
$pages['datenschutz']->post_status = 'publish';
check(vcp_policy_url() === 'https://site.example.invalid/de/datenschutz/', 'German visitor uses the published German policy route');
ob_start(); vcp_reservation_privacy_notice(); $notice = ob_get_clean();
check(strpos($notice, '/de/datenschutz/') !== false && strpos($notice, 'Gästeanmeldung') !== false && strpos($notice, '<input') === false, 'MotoPress contact fields receive contextual German policy information without an extra consent condition');
$TRP_LANGUAGE = 'en_GB'; ob_start(); vcp_reservation_privacy_notice(); $notice = ob_get_clean();
check(strpos($notice, '/privacy-policy/') !== false && strpos($notice, 'statutory guest registration') !== false, 'MotoPress contextual policy information follows the English language');
$TRP_LANGUAGE = 'de_DE';
check(strpos(vcp_checkout_privacy_text('old', 'checkout'), '[privacy_policy]') !== false && strpos(vcp_checkout_privacy_text('old', 'checkout'), 'Buchung') !== false, 'German checkout keeps the native privacy placeholder');
check(vcp_checkout_privacy_text('account text', 'registration') === 'account text', 'registration privacy text is unchanged');
ob_start(); vcp_privacy_footer(); $footer = ob_get_clean();
check(strpos($footer, '/de/datenschutz/') !== false && strpos($footer, 'Datenschutzerklärung') !== false, 'footer links to the published German policy');
$pages = array(); ob_start(); vcp_privacy_footer(); $footer = ob_get_clean();
check($footer === '', 'footer hides unpublished policy links');
ob_start(); vcp_reservation_privacy_notice(); $notice = ob_get_clean();
check($notice === '', 'MotoPress notice never links an unpublished policy');

$order = new SyntheticOrder(); $_GET['key'] = 'synthetic-order-key';
vcp_completed_checkout_cache();
check($enqueued === array(), 'active checkout and unrelated pages never clear payment/cart state');
$orderReceived = true; vcp_completed_checkout_cache();
check($enqueued === array(), 'unpaid or failed order receipt never loads checkout cleanup');
$order->paid = true; $_GET['key'] = 'wrong-key'; vcp_completed_checkout_cache();
check($enqueued === array(), 'paid receipt with the wrong order key cannot trigger cleanup');
$_GET['key'] = array('synthetic-order-key'); vcp_completed_checkout_cache();
check($enqueued === array(), 'malformed order key is rejected safely');
$_GET['key'] = 'synthetic-order-key'; vcp_completed_checkout_cache();
check($enqueued === array('villa-claudia-completed-checkout'), 'only a valid paid receipt loads the narrow Woo cache cleanup');
$orderReceived = false; $reservationReceived = true; $payment = new SyntheticPayment();
$_GET = array('payment_id' => '777', 'payment_key' => 'synthetic-payment-key');
check(vcp_valid_paid_receipt(), 'native MotoPress receipt validates its payment key and associated paid Woo order');
$_GET['payment_key'] = 'wrong-key';
check(!vcp_valid_paid_receipt(), 'wrong MotoPress payment key cannot trigger cache cleanup');
$_GET['payment_key'] = 'synthetic-payment-key'; $payment->status = 'mphb-p-failed';
check(!vcp_valid_paid_receipt(), 'failed MotoPress payment cannot trigger cache cleanup');
$payment->status = 'mphb-p-completed'; $order->paid = false;
check(!vcp_valid_paid_receipt(), 'unpaid associated Woo order cannot trigger MotoPress receipt cleanup');
$order->paid = true; $order->paymentId = 999;
check(!vcp_valid_paid_receipt(), 'Woo order must point back to this exact MotoPress payment');
$order->paymentId = 777; $reservationReceived = false;
check(!vcp_valid_paid_receipt(), 'valid payment parameters on an unrelated page do not clear checkout state');
$reservationReceived = true; $_GET['payment_id'] = array('777');
check(!vcp_valid_paid_receipt(), 'malformed MotoPress payment ID fails safely');

$assetRoot = dirname(__DIR__) . '/villa-claudia-privacy/assets/';
$manifest = json_decode(file_get_contents($assetRoot . 'fonts-manifest.json'), true, 512, JSON_THROW_ON_ERROR);
$families = array();
foreach ($manifest as $entry) {
    $file = $assetRoot . $entry['file'];
    check(is_file($file) && substr(file_get_contents($file), 0, 4) === 'wOF2' && hash_file('sha256', $file) === $entry['sha256'] && filesize($file) === $entry['bytes'], 'bundled font matches the observed font bytes and checksum: ' . $entry['file']);
    $families[$entry['family']] = true;
}
check(count($manifest) === 36 && count($families) === 3 && isset($families['Poppins'], $families['Roboto'], $families['Roboto Condensed']), 'all observed faces from the three existing font families are bundled');
$fontCss = file_get_contents($assetRoot . 'fonts.css');
check(strpos($fontCss, 'https://') === false && substr_count($fontCss, '@font-face') === 36, 'bundled font CSS has no remote URLs and preserves all observed faces');
foreach (array('Poppins', 'Roboto', 'Roboto-Condensed') as $license) {
    check(strpos(file_get_contents($assetRoot . 'OFL-' . $license . '.txt'), 'SIL OPEN FONT LICENSE') !== false, 'redistributed font includes its license: ' . $license);
}
echo 'Privacy defaults contracts passed.' . PHP_EOL;
}
