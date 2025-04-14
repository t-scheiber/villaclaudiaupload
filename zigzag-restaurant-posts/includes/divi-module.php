<?php
/**
 * ZigZag Restaurants Divi Module
 */

class ZGRP_ZigZag_Restaurants_Module extends ET_Builder_Module {
    public $slug = 'zgrp_zigzag_restaurants';
    public $vb_support = 'on';
    
    protected $module_credits = array(
        'module_uri' => '',
        'author' => 'Thomas Scheiber',
        'author_uri' => '',
    );
    
    public function init() {
        $this->name = esc_html__('ZigZag Restaurants', 'zigzag-restaurant-posts');
        $this->icon = 'n';
        $this->main_css_element = '%%order_class%%';
    }
    
    public function get_fields() {
        return array(
            'category' => array(
                'label' => esc_html__('Category Slug', 'zigzag-restaurant-posts'),
                'type' => 'text',
                'option_category' => 'basic_option',
                'description' => esc_html__('Enter the category slug to display specific restaurants. Leave empty for all.', 'zigzag-restaurant-posts'),
                'toggle_slug' => 'main_content',
            ),
            'posts_per_page' => array(
                'label' => esc_html__('Number of Restaurants', 'zigzag-restaurant-posts'),
                'type' => 'range',
                'option_category' => 'configuration',
                'range_settings' => array(
                    'min' => 1,
                    'max' => 20,
                    'step' => 1,
                ),
                'default' => '6',
                'description' => esc_html__('Choose how many restaurants to display.', 'zigzag-restaurant-posts'),
                'toggle_slug' => 'main_content',
            ),
        );
    }
    
    public function get_settings_modal_toggles() {
        return array(
            'general' => array(
                'toggles' => array(
                    'main_content' => esc_html__('Display Settings', 'zigzag-restaurant-posts'),
                ),
            ),
        );
    }
    
    public function render($attrs, $content = null, $render_slug) {
        // Get attributes
        $category = $this->props['category'];
        $posts_per_page = $this->props['posts_per_page'];
        
        // Check if ZigZag_Restaurant_Posts class exists
        if (!class_exists('ZigZag_Restaurant_Posts')) {
            return '<p>' . esc_html__('Error: ZigZag Restaurant Posts plugin is required.', 'zigzag-restaurant-posts') . '</p>';
        }
        
        // Get the main plugin class instance
        global $zigzag_restaurant_posts;
        
        // Return the HTML
        return $zigzag_restaurant_posts->get_zigzag_html($category, $posts_per_page, 'divi-module');
    }
}

// Register the module
function zgrp_register_divi_module() {
    if (class_exists('ET_Builder_Module')) {
        new ZGRP_ZigZag_Restaurants_Module();
    }
}
add_action('et_builder_ready', 'zgrp_register_divi_module'); 