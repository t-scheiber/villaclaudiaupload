<?php
/**
 * Plugin Name: ZigZag Restaurant Posts
 * Description: Display restaurant posts in an attractive zig-zag layout (compatible with Divi and WordPress Editor)
 * Version: 1.0.0
 * Author: Thomas Scheiber
 * Text Domain: zigzag-restaurant-posts
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class ZigZag_Restaurant_Posts {
    
    public function __construct() {
        // Register shortcode
        add_shortcode('zigzag_restaurants', array($this, 'render_zigzag_shortcode'));
        
        // Add CSS
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // Register Gutenberg block
        add_action('init', array($this, 'register_block'));
        
        // Load Divi module if Divi is active
        add_action('divi_extensions_init', array($this, 'load_divi_module'));
    }
    
    /**
     * Load the Divi module
     */
    public function load_divi_module() {
        if (class_exists('ET_Builder_Module')) {
            require_once plugin_dir_path(__FILE__) . 'includes/divi-module.php';
        }
    }
    
    /**
     * Enqueue required scripts and styles
     */
    public function enqueue_scripts() {
        wp_enqueue_style(
            'zigzag-restaurants-style',
            plugin_dir_url(__FILE__) . 'css/zigzag-style.css',
            array(),
            '1.0.0'
        );
    }
    
    /**
     * Register the Gutenberg block
     */
    public function register_block() {
        // Skip if Gutenberg is not available
        if (!function_exists('register_block_type')) {
            return;
        }
        
        // Register block script
        wp_register_script(
            'zigzag-restaurants-block',
            plugin_dir_url(__FILE__) . 'js/block.js',
            array('wp-blocks', 'wp-element', 'wp-editor'),
            '1.0.0'
        );
        
        // Register the block
        register_block_type('zigzag-restaurant-posts/restaurants-block', array(
            'editor_script' => 'zigzag-restaurants-block',
            'render_callback' => array($this, 'render_zigzag_block'),
            'attributes' => array(
                'category' => array(
                    'type' => 'string',
                    'default' => ''
                ),
                'postsPerPage' => array(
                    'type' => 'number',
                    'default' => 6
                ),
                'className' => array(
                    'type' => 'string',
                    'default' => ''
                )
            )
        ));
    }
    
    /**
     * Render the block content
     */
    public function render_zigzag_block($attributes) {
        $category = !empty($attributes['category']) ? $attributes['category'] : '';
        $posts_per_page = !empty($attributes['postsPerPage']) ? intval($attributes['postsPerPage']) : 6;
        $class_name = !empty($attributes['className']) ? $attributes['className'] : '';
        
        return $this->get_zigzag_html($category, $posts_per_page, $class_name);
    }
    
    /**
     * Render the shortcode output
     */
    public function render_zigzag_shortcode($atts) {
        $atts = shortcode_atts(array(
            'category' => '',
            'posts_per_page' => 6,
            'class' => '',
        ), $atts);
        
        return $this->get_zigzag_html($atts['category'], $atts['posts_per_page'], $atts['class']);
    }
    
    /**
     * Generate the HTML for the zig-zag layout
     */
    public function get_zigzag_html($category = '', $posts_per_page = 6, $class = '') {
        $args = array(
            'post_type' => 'post',
            'posts_per_page' => $posts_per_page,
            'post_status' => 'publish',
        );
        
        // Add category if specified
        if (!empty($category)) {
            $args['category_name'] = $category;
        }
        
        $posts_query = new WP_Query($args);
        
        if (!$posts_query->have_posts()) {
            return '<p>' . __('No restaurants found.', 'zigzag-restaurant-posts') . '</p>';
        }
        
        $output = '<div class="zigzag-restaurants ' . esc_attr($class) . '">';
        
        $i = 0;
        while ($posts_query->have_posts()) {
            $posts_query->the_post();
            
            // Determine if this is an odd or even item
            $is_even = ($i % 2 == 0);
            $row_class = $is_even ? 'zigzag-row zigzag-row-even' : 'zigzag-row zigzag-row-odd';
            
            $output .= '<div class="' . $row_class . '">';
            
            // Image column
            $output .= '<div class="zigzag-image-col">';
            if (has_post_thumbnail()) {
                $output .= get_the_post_thumbnail(null, 'large', array('class' => 'zigzag-image'));
            } else {
                $output .= '<div class="zigzag-no-image">' . __('No image available', 'zigzag-restaurant-posts') . '</div>';
            }
            $output .= '</div>';
            
            // Content column
            $output .= '<div class="zigzag-content-col">';
            $output .= '<h2 class="zigzag-title">' . get_the_title() . '</h2>';
            $output .= '<div class="zigzag-excerpt">';
            $output .= get_the_excerpt();
            $output .= '</div>';
            $output .= '<a href="' . get_permalink() . '" class="zigzag-readmore">' . __('Learn More', 'zigzag-restaurant-posts') . '</a>';
            $output .= '</div>';
            
            $output .= '</div>'; // End row
            
            $i++;
        }
        
        $output .= '</div>'; // End container
        
        wp_reset_postdata();
        
        return $output;
    }
}

// Initialize the plugin
$zigzag_restaurant_posts = new ZigZag_Restaurant_Posts(); 