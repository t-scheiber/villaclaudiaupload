<?php
/**
 * Plugin Name: Villa Claudia Rates Display
 * Description: Displays seasonal rates for Villa Claudia from MotoPress Hotel Booking
 * Version: 1.9.3
 * Author: Thomas Scheiber
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('VCR_ACCOMMODATION_ID')) {
    define('VCR_ACCOMMODATION_ID', 66);
}

if (!function_exists('vcr_rates_shortcode')) {

    add_shortcode('villa_claudia_rates', 'vcr_rates_shortcode');

    function vcr_rates_shortcode($atts) {
        if (defined('REST_REQUEST') && REST_REQUEST) {
            return '';
        }

        $atts = shortcode_atts(
            array(
                'title' => 'Villa Claudia',
                'accommodation_id' => (string) VCR_ACCOMMODATION_ID,
                'year' => '',
                'show_note' => 'on',
            ),
            $atts
        );

        $year = absint($atts['year']);
        if ($year < 1) {
            $year = (int) current_time('Y');
        }

        try {
            return vcr_rates_render(
                $atts['title'],
                absint($atts['accommodation_id']),
                $year,
                ($atts['show_note'] === 'on')
            );
        } catch (Throwable $e) {
            return vcr_rates_error();
        }
    }

    function vcr_get_mphb() {
        if (!function_exists('MPHB')) {
            return null;
        }

        $mphb = MPHB();

        if (!$mphb || !is_object($mphb) || !method_exists($mphb, 'getRateRepository')) {
            return null;
        }

        return $mphb;
    }

    function vcr_to_list($value) {
        if (is_array($value)) {
            return $value;
        }

        if ($value instanceof Traversable) {
            $list = array();
            foreach ($value as $item) {
                $list[] = $item;
            }
            return $list;
        }

        return array();
    }

    function vcr_get_season($season_price) {
        if (!is_object($season_price)) {
            return null;
        }

        if (method_exists($season_price, 'getSeason')) {
            $season = $season_price->getSeason();
            if ($season) {
                return $season;
            }
        }

        if (method_exists($season_price, 'getSeasonId') && function_exists('mphb_get_season')) {
            return mphb_get_season($season_price->getSeasonId());
        }

        return null;
    }

    function vcr_get_season_name($season) {
        if (!is_object($season)) {
            return '';
        }

        if (method_exists($season, 'getTitle')) {
            $title = $season->getTitle();
            if ($title !== '') {
                return $title;
            }
        }

        if (method_exists($season, 'getName')) {
            return $season->getName();
        }

        return '';
    }

    function vcr_format_single_date($date) {
        $format = get_option('date_format');

        if (is_object($date) && method_exists($date, 'format')) {
            // Use date-only value to avoid timezone shifting (e.g. Jan 1 becoming Dec 31).
            $date_only = $date->format('Y-m-d');

            if (function_exists('wp_date')) {
                return wp_date($format, strtotime($date_only . ' 12:00:00'));
            }

            return date_i18n($format, strtotime($date_only . ' 12:00:00'));
        }

        if (is_string($date)) {
            $timestamp = strtotime($date);
            return $timestamp ? date_i18n($format, $timestamp) : $date;
        }

        return '';
    }

    function vcr_format_season_dates($season) {
        if (!is_object($season)) {
            return '';
        }

        if (method_exists($season, 'getStartDate') && method_exists($season, 'getEndDate')) {
            $start = $season->getStartDate();
            $end = $season->getEndDate();

            if ($start && $end) {
                return esc_html(vcr_format_single_date($start) . ' - ' . vcr_format_single_date($end));
            }
        }

        if (method_exists($season, 'getDatesList')) {
            $parts = array();
            foreach (vcr_to_list($season->getDatesList()) as $range) {
                if (is_object($range) && method_exists($range, 'formatDateRange')) {
                    $parts[] = esc_html($range->formatDateRange(get_option('date_format')));
                }
            }
            if (!empty($parts)) {
                return implode('<br>', $parts);
            }
        }

        return '';
    }

    function vcr_rates_year_from_date($date) {
        if (is_object($date) && method_exists($date, 'format')) {
            return (int) $date->format('Y');
        }

        if (is_string($date) && strlen($date) >= 4) {
            return (int) substr($date, 0, 4);
        }

        return 0;
    }

    function vcr_rates_season_sort_key($season) {
        if (!is_object($season)) {
            return 0;
        }

        if (method_exists($season, 'getStartDate')) {
            $start = $season->getStartDate();
            if (is_object($start) && method_exists($start, 'getTimestamp')) {
                return (int) $start->getTimestamp();
            }
            if (is_string($start)) {
                return (int) strtotime($start);
            }
        }

        if (method_exists($season, 'getDatesList')) {
            $dates = vcr_to_list($season->getDatesList());
            if (!empty($dates)) {
                $first = reset($dates);
                if (is_object($first) && method_exists($first, 'getStartDate')) {
                    $start = $first->getStartDate();
                    if (is_object($start) && method_exists($start, 'getTimestamp')) {
                        return (int) $start->getTimestamp();
                    }
                }
            }
        }

        return 0;
    }

    function vcr_rates_season_matches_year($season, $year) {
        if (!is_object($season)) {
            return false;
        }

        if (method_exists($season, 'getStartDate') && method_exists($season, 'getEndDate')) {
            $start = $season->getStartDate();
            $end = $season->getEndDate();

            if ($start && $end) {
                $start_year = vcr_rates_year_from_date($start);
                $end_year = vcr_rates_year_from_date($end);
                return ($start_year <= $year && $end_year >= $year);
            }
        }

        if (method_exists($season, 'getDatesList')) {
            $dates = vcr_to_list($season->getDatesList());
            if (empty($dates)) {
                return true;
            }

            foreach ($dates as $range) {
                if (!is_object($range) || !method_exists($range, 'getStartDate') || !method_exists($range, 'getEndDate')) {
                    return true;
                }

                $start_year = vcr_rates_year_from_date($range->getStartDate());
                $end_year = vcr_rates_year_from_date($range->getEndDate());

                if ($start_year <= $year && $end_year >= $year) {
                    return true;
                }
            }

            return false;
        }

        return true;
    }

    function vcr_rates_render($title, $accommodation_id, $year, $show_note) {
        $mphb = vcr_get_mphb();
        if (!$mphb) {
            return vcr_rates_error();
        }

        if ($accommodation_id < 1) {
            $accommodation_id = VCR_ACCOMMODATION_ID;
        }

        $rates = vcr_to_list(
            $mphb->getRateRepository()->findAllActiveByRoomType($accommodation_id)
        );

        if (empty($rates)) {
            return vcr_rates_error();
        }

        $html = '<div class="villa-claudia-rates">';
        $found = false;

        foreach ($rates as $rate) {
            if (!is_object($rate) || !method_exists($rate, 'getSeasonPrices')) {
                continue;
            }

            $season_prices = vcr_to_list($rate->getSeasonPrices());
            if (empty($season_prices)) {
                continue;
            }

            $rows = vcr_rates_build_rows($mphb, $season_prices, $year);
            if (empty($rows)) {
                $rows = vcr_rates_build_rows($mphb, $season_prices, 0);
            }

            if (empty($rows)) {
                continue;
            }

            $found = true;
            $rate_title = method_exists($rate, 'getTitle') ? $rate->getTitle() : 'Rates';
            $html .= '<h3>' . esc_html($title) . ' - ' . esc_html($rate_title) . '</h3>';
            $html .= '<table class="villa-claudia-rates-table" style="width:100%;border-collapse:collapse;margin:20px 0">';
            $html .= '<thead><tr>';
            $html .= '<th style="border:1px solid #ddd;padding:10px;background:#f5f5f5;text-align:left">Season</th>';
            $html .= '<th style="border:1px solid #ddd;padding:10px;background:#f5f5f5;text-align:left">Dates</th>';
            $html .= '<th style="border:1px solid #ddd;padding:10px;background:#f5f5f5;text-align:left">Price per Night</th>';
            $html .= '</tr></thead><tbody>';

            foreach ($rows as $row) {
                $html .= '<tr>';
                $html .= '<td style="border:1px solid #ddd;padding:10px">' . esc_html($row['name']) . '</td>';
                $html .= '<td style="border:1px solid #ddd;padding:10px">' . $row['dates'] . '</td>';
                $html .= '<td style="border:1px solid #ddd;padding:10px">' . $row['price'] . '</td>';
                $html .= '</tr>';
            }

            $html .= '</tbody></table>';
        }

        if (!$found) {
            return vcr_rates_error();
        }

        if ($show_note) {
            $html .= '<p><strong>Important:</strong> Rates are per night. Please contact us for more information or special requests.</p>';
        }

        $html .= '</div>';
        return $html;
    }

    function vcr_rates_build_rows($mphb, $season_prices, $year) {
        $rows = array();

        foreach ($season_prices as $season_price) {
            $season = vcr_get_season($season_price);
            if (!$season) {
                continue;
            }

            if ($year > 0 && !vcr_rates_season_matches_year($season, $year)) {
                continue;
            }

            $price = method_exists($season_price, 'getPrice') ? $season_price->getPrice() : 0;
            $price_html = method_exists($mphb, 'format_price') ? $mphb->format_price($price) : esc_html($price);

            $rows[] = array(
                'name' => vcr_get_season_name($season),
                'dates' => vcr_format_season_dates($season),
                'price' => $price_html,
                'sort' => vcr_rates_season_sort_key($season),
            );
        }

        usort($rows, function ($a, $b) {
            if ($a['sort'] === $b['sort']) {
                return 0;
            }
            return ($a['sort'] < $b['sort']) ? -1 : 1;
        });

        return $rows;
    }

    function vcr_rates_error() {
        if (current_user_can('manage_options')) {
            return '<p style="color:#b71c1c;background:#ffebee;padding:12px;border-radius:4px">Villa Claudia rates could not be loaded. Check that MotoPress is active and rates exist for ID ' . VCR_ACCOMMODATION_ID . '.</p>';
        }
        return '';
    }
}
