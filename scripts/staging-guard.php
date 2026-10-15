<?php
/**
 * Plugin Name: Villa Claudia staging isolation
 * Description: Install only as a must-use plugin on the dedicated QA copy.
 */
if (!defined('ABSPATH')) { exit; }
if (wp_get_environment_type() !== 'staging') { return; }

// Capture mail locally. Never contact guests or registration authorities in QA.
add_filter('pre_wp_mail', function ($return, $mail) {
    $receipt = array('time' => gmdate('c'), 'subject' => $mail['subject'] ?? '', 'captured' => true);
    if (!defined('VILLA_QA_RECEIPTS')) { return false; }
    return @file_put_contents(VILLA_QA_RECEIPTS, wp_json_encode($receipt) . "\n", FILE_APPEND | LOCK_EX) !== false;
}, PHP_INT_MAX, 2);

// Block live payments, external calendars and copied production integrations.
add_filter('pre_http_request', function ($return, $args, $url) {
    $host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));
    if ($host === 'api.stripe.com') {
        $headers = $args['headers'] ?? array();
        $auth = '';
        foreach ($headers as $name => $value) {
            if (strtolower($name) === 'authorization') { $auth = (string) $value; }
        }
        $credential = preg_replace('/^Bearer\s+/i', '', $auth);
        if (stripos($auth, 'Basic ') === 0) {
            $credential = (string) base64_decode(substr($auth, 6), true);
        }
        if (preg_match('/^(sk_test_|rk_test_)[A-Za-z0-9]+:?$/D', $credential)) { return $return; }
    }
    if ($host === 'qa20261015.villa-claudia.eu') { return $return; }
    return new WP_Error('qa_outbound_blocked', 'External request blocked on the QA copy.');
}, PHP_INT_MAX, 3);

// The copied WooCommerce connection must always use test keys on this site.
add_filter('option_woocommerce_stripe_settings', function ($settings) {
    $settings = is_array($settings) ? $settings : array();
    $settings['testmode'] = 'yes';
    $settings['secret_key'] = '';
    $settings['publishable_key'] = '';
    return $settings;
}, PHP_INT_MAX);
