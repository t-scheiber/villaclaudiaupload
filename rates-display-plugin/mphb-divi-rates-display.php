<?php
/**
 * Plugin Name: Villa Claudia Rates Display
 * Plugin URI: 
 * Description: A static display of seasonal rates for Villa Claudia
 * Version: 1.4.0
 * Author: Thomas Scheiber
 * Text Domain: villa-claudia-rates
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Register the shortcode
add_shortcode('villa_claudia_rates', 'villa_claudia_rates_shortcode');

/**
 * Villa Claudia Rates shortcode callback function
 * 
 * @param array $atts Shortcode attributes
 * @return string Shortcode output
 */
function villa_claudia_rates_shortcode($atts) {
    // Extract attributes
    $atts = shortcode_atts(
        array(
            'title' => 'Villa Claudia',
        ),
        $atts,
        'villa_claudia_rates'
    );
    
    $title = esc_html($atts['title']);
    
    // Static HTML output with the rates from the screenshots
    $output = '<div class="villa-claudia-rates">';
    
    // Title
    $output .= '<h3>' . $title . ' - Seasonal Rates 2025</h3>';
    
    // Rates table
    $output .= '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">';
    $output .= '<thead>';
    $output .= '<tr>';
    $output .= '<th style="border: 1px solid #ddd; padding: 10px; background-color: #f5f5f5; text-align: left;">Season</th>';
    $output .= '<th style="border: 1px solid #ddd; padding: 10px; background-color: #f5f5f5; text-align: left;">Dates</th>';
    $output .= '<th style="border: 1px solid #ddd; padding: 10px; background-color: #f5f5f5; text-align: left;">Price per Night</th>';
    $output .= '</tr>';
    $output .= '</thead>';
    $output .= '<tbody>';
    
    // Off-Season Jan-May
    $output .= '<tr>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">Off-Season Jan-May</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">1 January 2025 - 30 April 2025</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">€ 380</td>';
    $output .= '</tr>';
    
    // Season May
    $output .= '<tr>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">Season May</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">1 May 2025 - 31 May 2025</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">€ 380</td>';
    $output .= '</tr>';
    
    // Season June
    $output .= '<tr>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">Season June</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">1 June 2025 - 30 June 2025</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">€ 400</td>';
    $output .= '</tr>';
    
    // Season July
    $output .= '<tr>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">Season July</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">1 July 2025 - 31 July 2025</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">€ 560</td>';
    $output .= '</tr>';
    
    // Season August
    $output .= '<tr>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">Season August</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">1 August 2025 - 31 August 2025</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">€ 520</td>';
    $output .= '</tr>';
    
    // Season Sept-Dez
    $output .= '<tr>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">Season Sept-Dez</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">1 September 2025 - 11 December 2025</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">€ 380</td>';
    $output .= '</tr>';
    
    // Season December
    $output .= '<tr>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">Season December</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">12 December 2025 - 31 December 2025</td>';
    $output .= '<td style="border: 1px solid #ddd; padding: 10px;">€ 450</td>';
    $output .= '</tr>';
    
    $output .= '</tbody>';
    $output .= '</table>';
    
    // Notes
    $output .= '<p><strong>Important:</strong> Rates are per night. Please contact us for more information or special requests.</p>';
    
    $output .= '</div>';
    
    return $output;
} 