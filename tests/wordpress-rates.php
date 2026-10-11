<?php
define('ABSPATH', __DIR__ . '/');
function add_shortcode($name, $callback) {}
function get_option($name) { return 'j F Y'; }
function esc_html($value) { return htmlspecialchars((string) $value, ENT_QUOTES); }
function date_i18n($format, $timestamp) { return date($format, $timestamp); }
function current_user_can($capability) { return false; }
function mphb_format_price($price) { return '<span>EUR ' . number_format($price, 2) . '</span>'; }
require $argv[1];
class Season {
    public function getStartDate() { return new DateTime('2026-04-01'); }
    public function getEndDate() { return new DateTime('2026-04-30'); }
    public function getTitle() { return 'Synthetic season'; }
}
class Price {
    public function getSeason() { return new Season(); }
    public function getPrice() { return 430; }
}
class Rate {
    public function getSeasonPrices() { return array(new Price()); }
    public function getTitle() { return 'Synthetic rate'; }
}
class Repository { public function findAllActiveByRoomType($id) { return array(new Rate()); } }
class Plugin { public function getRateRepository() { return new Repository(); } }
function MPHB() { return new Plugin(); }
function check($condition, $description) { if (!$condition) { throw new RuntimeException('FAIL: ' . $description); } echo 'PASS: ' . $description . PHP_EOL; }
check(str_contains(vcr_rates_render('Villa Claudia', 66, 2026, true), 'EUR 430.00'), 'rate output uses the configured vendor currency formatter');
check(!str_contains(vcr_rates_render('Villa Claudia', 66, 2027, true), '430'), 'a year without rates never displays another year prices');
check(count(vcr_rates_build_rows(MPHB(), array(new Price()), 2027)) === 0, 'season filtering excludes unrelated years');
