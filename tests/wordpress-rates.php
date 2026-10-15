<?php
define('ABSPATH', __DIR__ . '/');
function add_shortcode($name, $callback) {}
function shortcode_atts($defaults, $atts) { return array_merge($defaults, $atts); }
function absint($value) { return abs((int) $value); }
function current_time($format) { return '2026'; }
function get_option($name) { return 'j F Y'; }
function esc_html($value) { return htmlspecialchars((string) $value, ENT_QUOTES); }
function date_i18n($format, $timestamp) { return date($format, $timestamp); }
function current_user_can($capability) { return false; }
function mphb_format_price($price) { return '<span>EUR ' . number_format($price, 2) . '</span>'; }
require $argv[1];
class Season {
    private $year;
    public function __construct($year = 2026) { $this->year = $year; }
    public function getStartDate() { return new DateTime($this->year . '-04-01'); }
    public function getEndDate() { return new DateTime($this->year . '-04-30'); }
    public function getTitle() { return 'Synthetic season'; }
}
class Price {
    private $year;
    private $price;
    public function __construct($year = 2026, $price = 430) { $this->year = $year; $this->price = $price; }
    public function getSeason() { return new Season($this->year); }
    public function getPrice() { return $this->price; }
}
$test_season_prices = array(new Price());
class Rate {
    public function getSeasonPrices() { return $GLOBALS['test_season_prices']; }
    public function getTitle() { return 'Synthetic rate'; }
}
class Repository { public function findAllActiveByRoomType($id) { return array(new Rate()); } }
class Plugin { public function getRateRepository() { return new Repository(); } }
function MPHB() { return new Plugin(); }
function check($condition, $description) { if (!$condition) { throw new RuntimeException('FAIL: ' . $description); } echo 'PASS: ' . $description . PHP_EOL; }
check(str_contains(vcr_rates_render('Villa Claudia', 66, 2026, true), 'EUR 430.00'), 'rate output uses the configured vendor currency formatter');
check(!str_contains(vcr_rates_render('Villa Claudia', 66, 2027, true), '430'), 'a year without rates never displays another year prices');
check(count(vcr_rates_build_rows(MPHB(), array(new Price()), 2027)) === 0, 'season filtering excludes unrelated years');

$test_season_prices = array(new Price(2027, 500), new Price(2025, 390), new Price(2026, 430));
$html = vcr_rates_shortcode(array());
check(str_contains($html, '2026') && str_contains($html, '2027') && !str_contains($html, '2025'), 'default shortcode shows current and next year but excludes historical rates');
check(substr_count($html, '<table ') === 2 && strpos($html, '2026</h3>') < strpos($html, '2027</h3>'), 'year headings label two tables in ascending year order');
check(str_contains($html, 'EUR 430.00') && str_contains($html, 'EUR 500.00') && !str_contains($html, 'EUR 390.00'), 'each displayed year uses only its existing authoritative price');
$html = vcr_rates_shortcode(array('year' => '2027', 'show_note' => 'off'));
check(str_contains($html, 'EUR 500.00') && !str_contains($html, '2026') && !str_contains($html, 'Important:'), 'explicit year and note settings retain their original filtering behavior');
$test_season_prices = array(new Price(2026, 430));
$html = vcr_rates_shortcode(array());
check(substr_count($html, '<table ') === 1 && !str_contains($html, '2027'), 'missing next-year rates do not create an empty table or copy current prices');
check(vcr_rates_shortcode(array('year' => '2027')) === '', 'explicit year with no prices keeps the existing empty guest response');

class RecurrentFixtureSeason extends Season {
    public $periods;
    public function __construct($periods) { parent::__construct(2026); $this->periods = $periods; }
    public function getPeriods() { return $this->periods; }
}
class RecurrentFixturePrice extends Price {
    private $season;
    public function __construct($season) { $this->season = $season; }
    public function getSeason() { return $this->season; }
    public function getPrice() { return 500; }
}
$season = new RecurrentFixtureSeason(array(
    array('start_date' => new DateTime('2026-06-01'), 'end_date' => new DateTime('2026-06-30')),
    array('start_date' => new DateTime('2027-06-01'), 'end_date' => new DateTime('2027-06-15')),
));
$rows = vcr_rates_build_rows(MPHB(), array(new RecurrentFixturePrice($season)), 2027);
check(count($rows) === 1 && str_contains($rows[0]['dates'], '1 June 2027 - 15 June 2027') && str_contains($rows[0]['price'], 'EUR 500.00'), 'recurring season uses actual vendor periods and their cutoff, not the original year');
check(vcr_rates_build_rows(MPHB(), array(new RecurrentFixturePrice($season)), 2028) === array(), 'recurring seasons never invent periods beyond the vendor booking horizon');
check($season->periods[1]['end_date']->format('Y-m-d') === '2027-06-15', 'formatting does not mutate authoritative vendor dates');
$season = new RecurrentFixtureSeason(array(array('start_date' => new DateTime('2026-12-20'), 'end_date' => new DateTime('2027-01-10'))));
$rows = vcr_rates_build_rows(MPHB(), array(new RecurrentFixturePrice($season)), 2027);
check(str_contains($rows[0]['dates'], '1 January 2027 - 10 January 2027'), 'a recurring cross-year period is clipped to the labelled year');
$season = new RecurrentFixtureSeason(array());
check(vcr_rates_build_rows(MPHB(), array(new RecurrentFixturePrice($season)), 2026) === array(), 'an empty vendor recurrence has no fallback to the original season dates');
