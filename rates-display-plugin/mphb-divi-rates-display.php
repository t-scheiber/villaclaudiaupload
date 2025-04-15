<?php
/**
 * Plugin Name: MotoPress Hotel Booking Rates Display
 * Plugin URI: 
 * Description: A custom Divi Builder module to display MotoPress Hotel Booking seasonal rates in a nicer way.
 * Version: 1.1.0
 * Author: Thomas Scheiber
 * Text Domain: mphb-divi-rates
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Main Plugin Class
 */
class MPHB_Divi_Rates_Display {
    
    /**
     * Instance of this class
     *
     * @var MPHB_Divi_Rates_Display
     */
    public static $instance;

    /**
     * Get the instance of this class
     *
     * @return MPHB_Divi_Rates_Display
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    public function __construct() {
        add_action('divi_extensions_init', array($this, 'initialize_extension'));
    }

    /**
     * Initialize the Divi extension
     */
    public function initialize_extension() {
        new MphbDiviRatesExtension();
    }
}

/**
 * Divi Extension Class
 */
class MphbDiviRatesExtension extends DiviExtension {
    /**
     * The gettext domain for the extension's translations.
     *
     * @var string
     */
    public $gettext_domain = 'mphb-divi-rates';

    /**
     * The extension's WP Plugin name.
     *
     * @var string
     */
    public $name = 'mphb-divi-rates-display';

    /**
     * The extension's version
     *
     * @var string
     */
    public $version = '1.0.0';

    /**
     * Constructor
     */
    public function __construct() {
        $this->plugin_dir = plugin_dir_path(__FILE__);
        $this->plugin_dir_url = plugin_dir_url(__FILE__);

        parent::__construct(
            $this->name,
            $this->plugin_dir,
            $this->plugin_dir_url, 
            $this->gettext_domain
        );
        
        // Register the module
        add_action('et_builder_ready', array($this, 'register_module'));
    }
    
    /**
     * Register the module
     */
    public function register_module() {
        if (class_exists('ET_Builder_Module')) {
            new MPHB_Rates_Display_Module();
        }
    }
}

/**
 * Divi Module Class
 */
class MPHB_Rates_Display_Module extends ET_Builder_Module {
    /**
     * Module slug
     *
     * @var string
     */
    public $slug = 'mphb_rates_display';

    /**
     * VB support
     *
     * @var string
     */
    public $vb_support = 'on';

    /**
     * Init function
     */
    public function init() {
        $this->name = esc_html__('MotoPress Rates Display', 'mphb-divi-rates');
        $this->icon = 'p'; // Use a generic icon
        $this->main_css_element = '%%order_class%%';
    }

    /**
     * Get the module fields
     *
     * @return array
     */
    public function get_fields() {
        return array(
            'rate_id' => array(
                'label' => esc_html__('Rate ID', 'mphb-divi-rates'),
                'type' => 'text',
                'option_category' => 'basic_option',
                'description' => esc_html__('Enter the Rate ID you want to display. Leave empty to show all rates.', 'mphb-divi-rates'),
                'toggle_slug' => 'main_content',
            ),
            'accommodation_id' => array(
                'label' => esc_html__('Accommodation ID', 'mphb-divi-rates'),
                'type' => 'text',
                'option_category' => 'basic_option',
                'description' => esc_html__('Enter the Accommodation ID you want to display rates for. Leave empty to use Rate ID.', 'mphb-divi-rates'),
                'toggle_slug' => 'main_content',
            ),
            'title_style' => array(
                'label' => esc_html__('Title Style', 'mphb-divi-rates'),
                'type' => 'select',
                'option_category' => 'configuration',
                'options' => array(
                    'h2' => esc_html__('H2', 'mphb-divi-rates'),
                    'h3' => esc_html__('H3', 'mphb-divi-rates'),
                    'h4' => esc_html__('H4', 'mphb-divi-rates'),
                    'h5' => esc_html__('H5', 'mphb-divi-rates'),
                    'p' => esc_html__('Paragraph', 'mphb-divi-rates'),
                ),
                'default' => 'h3',
                'toggle_slug' => 'design',
            ),
            'show_description' => array(
                'label' => esc_html__('Show Description', 'mphb-divi-rates'),
                'type' => 'yes_no_button',
                'option_category' => 'configuration',
                'options' => array(
                    'on' => esc_html__('Yes', 'mphb-divi-rates'),
                    'off' => esc_html__('No', 'mphb-divi-rates'),
                ),
                'default' => 'on',
                'toggle_slug' => 'main_content',
            ),
        );
    }

    /**
     * Render the module
     *
     * @param array $attrs
     * @param string $content
     * @param string $render_slug
     * @return string
     */
    public function render($attrs, $content = null, $render_slug) {
        $rate_id = $this->props['rate_id'];
        $accommodation_id = $this->props['accommodation_id'];
        $title_style = $this->props['title_style'];
        $show_description = $this->props['show_description'];
        
        // Check if MotoPress Hotel Booking plugin is active
        if (!function_exists('MPHB') || !class_exists('MPHB\\Entities\\Rate')) {
            return '<div class="mphb-error">MotoPress Hotel Booking plugin is not active.</div>';
        }
        
        // If no rate ID but accommodation ID is provided, get all rates for that accommodation
        if (empty($rate_id) && !empty($accommodation_id)) {
            return $this->render_accommodation_rates($accommodation_id, $title_style, $show_description);
        }
        
        // If rate ID is provided, display that specific rate
        if (!empty($rate_id)) {
            return $this->render_single_rate($rate_id, $title_style, $show_description);
        }
        
        // Default - show all rates
        return $this->render_all_rates($title_style, $show_description);
    }
    
    /**
     * Render a single rate
     *
     * @param int $rate_id
     * @param string $title_style
     * @param string $show_description
     * @return string
     */
    private function render_single_rate($rate_id, $title_style, $show_description) {
        // Get rate object
        $rate = MPHB()->getRateRepository()->findById($rate_id);
        
        if (!$rate) {
            return '<div class="mphb-error">Rate not found.</div>';
        }
        
        $html = '<div class="mphb-divi-rate">';
        
        // Rate title
        $html .= '<' . esc_attr($title_style) . ' class="mphb-rate-title">' . esc_html($rate->getTitle()) . '</' . esc_attr($title_style) . '>';
        
        // Rate description
        if ($show_description === 'on' && $rate->getDescription()) {
            $html .= '<div class="mphb-rate-description">' . wp_kses_post($rate->getDescription()) . '</div>';
        }
        
        // Get seasons and prices
        $html .= $this->get_seasonal_prices_html($rate);
        
        $html .= '</div>';
        
        return $html;
    }
    
    /**
     * Render all rates for a specific accommodation
     *
     * @param int $accommodation_id
     * @param string $title_style
     * @param string $show_description
     * @return string
     */
    private function render_accommodation_rates($accommodation_id, $title_style, $show_description) {
        // Get accommodation object
        $accommodation = MPHB()->getRoomTypeRepository()->findById($accommodation_id);
        
        if (!$accommodation) {
            return '<div class="mphb-error">Accommodation not found.</div>';
        }
        
        $html = '<div class="mphb-divi-accommodation-rates">';
        
        // Accommodation title
        $html .= '<' . esc_attr($title_style) . ' class="mphb-accommodation-title">' . esc_html($accommodation->getTitle()) . '</' . esc_attr($title_style) . '>';
        
        // Get rates for this accommodation
        $rates = MPHB()->getRateRepository()->findAllActiveByRoomType($accommodation_id);
        
        if (empty($rates)) {
            $html .= '<p class="mphb-no-rates">' . esc_html__('No rates found for this accommodation.', 'mphb-divi-rates') . '</p>';
        } else {
            foreach ($rates as $rate) {
                $html .= '<div class="mphb-divi-rate">';
                
                // Rate title
                $html .= '<' . esc_attr($title_style) . ' class="mphb-rate-title">' . esc_html($rate->getTitle()) . '</' . esc_attr($title_style) . '>';
                
                // Rate description
                if ($show_description === 'on' && $rate->getDescription()) {
                    $html .= '<div class="mphb-rate-description">' . wp_kses_post($rate->getDescription()) . '</div>';
                }
                
                // Get seasons and prices
                $html .= $this->get_seasonal_prices_html($rate);
                
                $html .= '</div>';
            }
        }
        
        $html .= '</div>';
        
        return $html;
    }
    
    /**
     * Render all active rates
     *
     * @param string $title_style
     * @param string $show_description
     * @return string
     */
    private function render_all_rates($title_style, $show_description) {
        // Get all active rates
        $rates = MPHB()->getRateRepository()->findAll(array('active' => true));
        
        $html = '<div class="mphb-divi-all-rates">';
        
        if (empty($rates)) {
            $html .= '<p class="mphb-no-rates">' . esc_html__('No active rates found.', 'mphb-divi-rates') . '</p>';
        } else {
            foreach ($rates as $rate) {
                $html .= '<div class="mphb-divi-rate">';
                
                // Rate title
                $html .= '<' . esc_attr($title_style) . ' class="mphb-rate-title">' . esc_html($rate->getTitle()) . '</' . esc_attr($title_style) . '>';
                
                // Rate description
                if ($show_description === 'on' && $rate->getDescription()) {
                    $html .= '<div class="mphb-rate-description">' . wp_kses_post($rate->getDescription()) . '</div>';
                }
                
                // Get accommodation type
                $accommodation = $rate->getRoomType();
                if ($accommodation) {
                    $html .= '<div class="mphb-accommodation-type">';
                    $html .= '<span class="mphb-accommodation-label">' . esc_html__('Accommodation:', 'mphb-divi-rates') . '</span> ';
                    $html .= '<span class="mphb-accommodation-name">' . esc_html($accommodation->getTitle()) . '</span>';
                    $html .= '</div>';
                }
                
                // Get seasons and prices
                $html .= $this->get_seasonal_prices_html($rate);
                
                $html .= '</div>';
            }
        }
        
        $html .= '</div>';
        
        return $html;
    }
    
    /**
     * Get seasonal prices HTML for a rate
     *
     * @param MPHB\Entities\Rate $rate
     * @return string
     */
    private function get_seasonal_prices_html($rate) {
        $html = '<div class="mphb-seasonal-prices">';
        
        // Get all seasonal prices for this rate
        $seasonalPrices = $rate->getSeasonPrices();
        
        if (empty($seasonalPrices)) {
            $html .= '<p class="mphb-no-seasonal-prices">' . esc_html__('No seasonal prices found.', 'mphb-divi-rates') . '</p>';
        } else {
            $html .= '<table class="mphb-seasonal-prices-table">';
            $html .= '<thead>';
            $html .= '<tr>';
            $html .= '<th class="mphb-season-name">' . esc_html__('Season', 'mphb-divi-rates') . '</th>';
            $html .= '<th class="mphb-season-dates">' . esc_html__('Dates', 'mphb-divi-rates') . '</th>';
            $html .= '<th class="mphb-price">' . esc_html__('Price per Night', 'mphb-divi-rates') . '</th>';
            
            // Check if we have weekly rate
            if ($rate->isEnabledForPeriod(7)) {
                $html .= '<th class="mphb-price-weekly">' . esc_html__('Weekly Price', 'mphb-divi-rates') . '</th>';
            }
            
            // Check if we have monthly rate
            if ($rate->isEnabledForPeriod(30)) {
                $html .= '<th class="mphb-price-monthly">' . esc_html__('Monthly Price', 'mphb-divi-rates') . '</th>';
            }
            
            $html .= '</tr>';
            $html .= '</thead>';
            $html .= '<tbody>';
            
            foreach ($seasonalPrices as $seasonalPrice) {
                $season = $seasonalPrice->getSeason();
                $html .= '<tr>';
                
                // Season name
                $html .= '<td class="mphb-season-name">' . esc_html($season->getName()) . '</td>';
                
                // Season dates
                $html .= '<td class="mphb-season-dates">';
                $datesList = $season->getDatesList();
                if (!empty($datesList)) {
                    $formattedDates = array();
                    foreach ($datesList as $dateRange) {
                        $formattedDates[] = $dateRange->formatDateRange(get_option('date_format'));
                    }
                    $html .= implode('<br>', $formattedDates);
                }
                $html .= '</td>';
                
                // Price per night
                $html .= '<td class="mphb-price">' . $this->format_price($seasonalPrice->getPrice()) . '</td>';
                
                // Weekly price if enabled
                if ($rate->isEnabledForPeriod(7)) {
                    $weeklyPrice = $seasonalPrice->getPriceForPeriod(7);
                    $html .= '<td class="mphb-price-weekly">' . $this->format_price($weeklyPrice) . '</td>';
                }
                
                // Monthly price if enabled
                if ($rate->isEnabledForPeriod(30)) {
                    $monthlyPrice = $seasonalPrice->getPriceForPeriod(30);
                    $html .= '<td class="mphb-price-monthly">' . $this->format_price($monthlyPrice) . '</td>';
                }
                
                $html .= '</tr>';
            }
            
            $html .= '</tbody>';
            $html .= '</table>';
        }
        
        $html .= '</div>';
        
        // Add custom CSS for the table
        $this->add_custom_css();
        
        return $html;
    }
    
    /**
     * Format a price with the currency symbol
     *
     * @param float $price
     * @return string
     */
    private function format_price($price) {
        if (function_exists('MPHB')) {
            return MPHB()->format_price($price);
        }
        
        return number_format($price, 2);
    }
    
    /**
     * Add custom CSS for the rates display
     */
    private function add_custom_css() {
        if (!wp_style_is('mphb-divi-rates-css', 'enqueued')) {
            $custom_css = '
                .mphb-seasonal-prices-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                .mphb-seasonal-prices-table th,
                .mphb-seasonal-prices-table td {
                    padding: 10px;
                    border: 1px solid #ddd;
                    text-align: left;
                }
                .mphb-seasonal-prices-table th {
                    background-color: #f5f5f5;
                    font-weight: bold;
                }
                .mphb-seasonal-prices-table tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                .mphb-seasonal-prices-table tr:hover {
                    background-color: #f1f1f1;
                }
                .mphb-rate-title {
                    margin-bottom: 10px;
                }
                .mphb-rate-description {
                    margin-bottom: 20px;
                }
                .mphb-accommodation-type {
                    margin-bottom: 15px;
                    font-style: italic;
                }
                .mphb-accommodation-label {
                    font-weight: bold;
                }
                .mphb-divi-rate {
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #eee;
                }
                .mphb-divi-rate:last-child {
                    border-bottom: none;
                }
                .mphb-error {
                    color: #f44336;
                    padding: 10px;
                    background-color: #ffebee;
                    border-radius: 4px;
                    margin-bottom: 20px;
                }
            ';
            
            wp_register_style('mphb-divi-rates-css', false);
            wp_enqueue_style('mphb-divi-rates-css');
            wp_add_inline_style('mphb-divi-rates-css', $custom_css);
        }
    }
}

// Initialize the plugin
MPHB_Divi_Rates_Display::get_instance(); 