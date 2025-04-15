<?php
/**
 * Plugin Name: Restaurant Posts Zigzag
 * Description: Displays restaurant posts in a zigzag layout for both default WordPress and Divi editor
 * Version: 1.4.3
 * Author: Thomas Scheiber
 * Text Domain: restaurant-posts-zigzag
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Plugin constants
define('RPZ_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('RPZ_PLUGIN_URL', plugin_dir_url(__FILE__));

// Enqueue inline CSS and JS
function rpz_enqueue_scripts() {
    // CSS Styles
    $css = '/* Restaurant Posts Zigzag Layout Styles */
.rpz-zigzag-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 30px 15px;
}
.rpz-zigzag-item {
    margin-bottom: 60px;
    clear: both;
    overflow: hidden;
}
.rpz-item-inner {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    justify-content: space-between !important;
}
/* Left layout (image left, content right) */
.rpz-item-left .rpz-item-inner {
    flex-direction: row !important;
}
/* Right layout (content left, image right) */
.rpz-item-right .rpz-item-inner {
    flex-direction: row-reverse !important;
}
.rpz-image {
    flex: 0 0 48% !important;
    max-width: 48% !important;
    overflow: hidden;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.rpz-no-image {
    width: 100%;
    height: 100%;
    min-height: 200px;
    background-color: #f5f5f5;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.rpz-no-image:after {
    content: "No Image";
    color: #999;
    font-style: italic;
}
.rpz-image:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}
.rpz-image img {
    width: 100%;
    height: auto;
    display: block;
    transition: transform 0.5s ease;
}
.rpz-image:hover img {
    transform: scale(1.05);
}
.rpz-content {
    flex: 0 0 48% !important;
    max-width: 48% !important;
    padding: 20px;
}
.rpz-title {
    font-size: 24px;
    margin-bottom: 15px;
    font-weight: 600;
}
.rpz-title a {
    color: #333;
    text-decoration: none;
    transition: color 0.3s ease;
}
.rpz-title a:hover {
    color: #0073aa;
}
.rpz-excerpt {
    font-size: 16px;
    line-height: 1.6;
    color: #666;
}
.rpz-excerpt p {
    margin-bottom: 1em;
}
.rpz-excerpt strong, 
.rpz-excerpt b {
    font-weight: 700;
    color: #333;
}
.rpz-excerpt em,
.rpz-excerpt i {
    font-style: italic;
}
.rpz-excerpt br {
    display: block;
    content: "";
    margin-top: 10px;
}
/* Divi-specific overrides */
.et_pb_module .rpz-item-inner {
    display: flex !important;
    flex-wrap: wrap !important;
}
.et_pb_module .rpz-item-left .rpz-item-inner {
    flex-direction: row !important;
}
.et_pb_module .rpz-item-right .rpz-item-inner {
    flex-direction: row-reverse !important;
}
.et_pb_module .rpz-image,
.et_pb_module .rpz-content {
    width: 48% !important;
    max-width: 48% !important;
    float: none !important;
}
/* Responsive styles */
@media only screen and (max-width: 768px) {
    .rpz-item-inner,
    .et_pb_module .rpz-item-inner {
        flex-direction: column !important;
    }
    .rpz-image,
    .rpz-content,
    .et_pb_module .rpz-image,
    .et_pb_module .rpz-content {
        flex: 0 0 100% !important;
        max-width: 100% !important;
        width: 100% !important;
    }
    .rpz-image,
    .et_pb_module .rpz-image {
        margin-bottom: 20px;
    }
}';

    // Inline CSS
    wp_register_style('rpz-inline-style', false);
    wp_enqueue_style('rpz-inline-style');
    wp_add_inline_style('rpz-inline-style', $css);
    
    // JS functionality
    $js = 'document.addEventListener("DOMContentLoaded", function() {
    // Add smooth scroll effect when clicking on restaurant links
    const restaurantLinks = document.querySelectorAll(".rpz-title a");
    if (restaurantLinks.length > 0) {
        restaurantLinks.forEach(function(link) {
            link.addEventListener("click", function(e) {
                // Only apply if not opening in new tab
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    const href = this.getAttribute("href");
                    
                    // Smooth scroll animation
                    document.querySelector("html, body").animate({
                        scrollTop: 0
                    }, 800, function() {
                        window.location = href;
                    });
                }
            });
        });
    }
    
    // Add animation on scroll
    const zigzagItems = document.querySelectorAll(".rpz-zigzag-item");
    if (zigzagItems.length > 0) {
        // Simple visibility check function
        function isElementInView(el) {
            const rect = el.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        }
        
        // Add visible class when element is in view
        function handleAnimation() {
            zigzagItems.forEach(function(item) {
                if (isElementInView(item)) {
                    item.classList.add("rpz-visible");
                }
            });
        }
        
        // Add animation class and event listeners
        zigzagItems.forEach(function(item) {
            item.style.opacity = "0";
            item.style.transform = "translateY(20px)";
            item.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        });
        
        // Add CSS for visible class
        const style = document.createElement("style");
        style.innerHTML = ".rpz-visible { opacity: 1 !important; transform: translateY(0) !important; }";
        document.head.appendChild(style);
        
        // Check on scroll and initially
        window.addEventListener("scroll", handleAnimation);
        handleAnimation();
    }
});';

    // Inline JS
    wp_register_script('rpz-inline-script', '', [], '1.0.0', true);
    wp_enqueue_script('rpz-inline-script');
    wp_add_inline_script('rpz-inline-script', $js);
}
add_action('wp_enqueue_scripts', 'rpz_enqueue_scripts');

/**
 * Get formatted content preserving HTML formatting
 * 
 * @param int $post_id The post ID
 * @param int $excerpt_length Optional excerpt length
 * @return string Formatted content with preserved HTML
 */
function rpz_get_formatted_content($post_id, $excerpt_length = 55) {
    // Get the full post content with formatting
    $content = '';
    
    // Check if we should use an excerpt or full content
    if (has_excerpt($post_id)) {
        // If there's a manual excerpt, use it with HTML preserved
        $content = get_post_field('post_excerpt', $post_id);
    } else {
        // Get the full content
        $post = get_post($post_id);
        $content = $post->post_content;
        
        // Check for more tag
        if (strpos($content, '<!--more-->') !== false) {
            $content = explode('<!--more-->', $content)[0];
        }
    }
    
    // Process shortcodes if any
    $content = do_shortcode($content);
    
    // Convert any remaining line breaks to <br> tags before applying wpautop
    $content = nl2br($content);
    
    // Apply paragraph tags to text blocks
    $content = wpautop($content);
    
    // Allow specific HTML tags
    $allowed_html = array(
        'strong' => array(),
        'b'      => array(),
        'em'     => array(),
        'i'      => array(),
        'br'     => array(),
        'p'      => array(
            'style' => array(),
            'class' => array(),
        ),
        'ul'     => array(),
        'ol'     => array(),
        'li'     => array(),
        'a'      => array(
            'href'  => array(),
            'title' => array(),
            'class' => array(),
            'target' => array(),
        ),
        'span'   => array(
            'style' => array(),
            'class' => array(),
        ),
        'div'    => array(
            'style' => array(),
            'class' => array(),
        ),
    );
    
    // Filter the content to preserve specified HTML
    $content = wp_kses($content, $allowed_html);
    
    // If we need to truncate the content (for long posts)
    if ($excerpt_length > 0 && !has_excerpt($post_id) && strpos($content, '<!--more-->') === false) {
        // Manually truncate content while preserving HTML
        $content = rpz_truncate_html($content, $excerpt_length);
    }
    
    return $content;
}

/**
 * Truncate HTML content while preserving HTML tags
 * 
 * @param string $html The HTML content to truncate
 * @param int $limit Word limit
 * @param string $ellipsis Text to append when truncated
 * @return string Truncated HTML
 */
function rpz_truncate_html($html, $limit, $ellipsis = '...') {
    // Load HTML into DOMDocument
    $dom = new DOMDocument();
    libxml_use_internal_errors(true); // Suppress warnings for malformed HTML
    $dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
    libxml_clear_errors();
    
    // Get text content
    $text = $dom->textContent;
    
    // If text is already shorter than limit, return original HTML
    $words = preg_split('/\s+/', $text);
    if (count($words) <= $limit) {
        return $html;
    }
    
    // Otherwise, we need to truncate
    $truncated_text = implode(' ', array_slice($words, 0, $limit)) . $ellipsis;
    
    // For simple truncation, we'll just wrap the truncated text in paragraph tags
    // This is a basic approach - for complex HTML, a more sophisticated solution would be needed
    return '<p>' . $truncated_text . '</p>';
}

// Register shortcode [restaurant_zigzag]
function rpz_restaurant_zigzag_shortcode($atts) {
    $atts = shortcode_atts(
        array(
            'count' => 6, // Default number of posts to display
            'category' => '', // Optional category filter
        ),
        $atts,
        'restaurant_zigzag'
    );
    
    $args = array(
        'post_type' => 'post',
        'posts_per_page' => intval($atts['count']),
        'orderby' => 'date',
        'order' => 'DESC',
    );
    
    // Add category filter if specified
    if (!empty($atts['category'])) {
        $args['category_name'] = $atts['category'];
    }
    
    $posts_query = new WP_Query($args);
    $output = '';
    
    if ($posts_query->have_posts()) {
        $output .= '<div class="rpz-zigzag-container">';
        $count = 0;
        
        while ($posts_query->have_posts()) {
            $posts_query->the_post();
            $post_id = get_the_ID();
            $post_title = get_the_title();
            $post_content = rpz_get_formatted_content($post_id);
            $post_image = get_the_post_thumbnail_url($post_id, 'large');
            $post_link = get_permalink();
            
            // Alternate layout based on even/odd count
            $layout_class = ($count % 2 == 0) ? 'rpz-item-left' : 'rpz-item-right';
            
            $output .= '<div class="rpz-zigzag-item ' . $layout_class . '">';
            $output .= '<div class="rpz-item-inner">';
            
            // Create image HTML
            $image_html = '<div class="rpz-image">';
            if ($post_image) {
                $image_html .= '<a href="' . esc_url($post_link) . '"><img src="' . esc_url($post_image) . '" alt="' . esc_attr($post_title) . '"></a>';
            } else {
                // Placeholder if no image
                $image_html .= '<div class="rpz-no-image"></div>';
            }
            $image_html .= '</div>';
            
            // Create content HTML
            $content_html = '<div class="rpz-content">';
            $content_html .= '<h3 class="rpz-title"><a href="' . esc_url($post_link) . '">' . esc_html($post_title) . '</a></h3>';
            $content_html .= '<div class="rpz-excerpt">' . $post_content . '</div>';
            $content_html .= '</div>';
            
            // Always add both parts - they will be ordered by CSS based on the item class
            $output .= $image_html . $content_html;
            
            $output .= '</div>'; // End item-inner
            $output .= '</div>'; // End zigzag-item
            $count++;
        }
        
        $output .= '</div>'; // End container
        wp_reset_postdata();
    } else {
        $output = '<p>' . __('No posts found.', 'restaurant-posts-zigzag') . '</p>';
    }
    
    return $output;
}
add_shortcode('restaurant_zigzag', 'rpz_restaurant_zigzag_shortcode');

// Add Divi Builder compatibility - register as a Divi module
function rpz_initialize_divi_extension() {
    if (class_exists('ET_Builder_Module')) {
        class RPZ_Divi_Module extends ET_Builder_Module {
            function init() {
                $this->name = esc_html__('Restaurant ZigZag', 'restaurant-posts-zigzag');
                $this->plural = esc_html__('Restaurant ZigZag', 'restaurant-posts-zigzag');
                $this->slug = 'rpz_divi_module';
                $this->vb_support = 'on';
                $this->icon = 'j';
                
                // Define all fields that will be used
                $this->fields_defaults = array(
                    'posts_count' => array('6', 'add_default_setting'),
                    'category' => array('', 'add_default_setting'),
                );
                
                // Add custom CSS to fix Divi conflicts
                add_action('wp_footer', array($this, 'add_custom_divi_fixes'));
            }
            
            // Add custom CSS fixes for Divi
            function add_custom_divi_fixes() {
                if (et_core_is_fb_enabled()) {
                    echo '<style>
                    .et-fb-app-frame .rpz-item-inner {
                        display: flex !important;
                        flex-wrap: wrap !important;
                    }
                    .et-fb-app-frame .rpz-item-left .rpz-item-inner {
                        flex-direction: row !important;
                    }
                    .et-fb-app-frame .rpz-item-right .rpz-item-inner {
                        flex-direction: row-reverse !important;
                    }
                    .et-fb-app-frame .rpz-image,
                    .et-fb-app-frame .rpz-content {
                        width: 48% !important;
                        max-width: 48% !important;
                        float: none !important;
                    }
                    @media only screen and (max-width: 768px) {
                        .et-fb-app-frame .rpz-item-inner {
                            flex-direction: column !important;
                        }
                        .et-fb-app-frame .rpz-image,
                        .et-fb-app-frame .rpz-content {
                            width: 100% !important;
                            max-width: 100% !important;
                        }
                    }
                    </style>';
                }
            }
            
            function get_fields() {
                return array(
                    'posts_count' => array(
                        'label' => esc_html__('Number of Posts', 'restaurant-posts-zigzag'),
                        'type' => 'text',
                        'option_category' => 'basic_option',
                        'description' => esc_html__('Control how many posts to display.', 'restaurant-posts-zigzag'),
                        'default' => '6',
                        'toggle_slug' => 'main_content',
                    ),
                    'category' => array(
                        'label' => esc_html__('Category', 'restaurant-posts-zigzag'),
                        'type' => 'text',
                        'option_category' => 'basic_option',
                        'description' => esc_html__('Enter a category slug to filter posts (optional).', 'restaurant-posts-zigzag'),
                        'toggle_slug' => 'main_content',
                    ),
                );
            }
            
            function get_advanced_fields_config() {
                return array(
                    'fonts' => array(
                        'title' => array(
                            'label' => esc_html__('Title', 'restaurant-posts-zigzag'),
                            'css' => array(
                                'main' => '%%order_class%% .rpz-title',
                                'important' => 'all',
                            ),
                            'font_size' => array(
                                'default' => '24px',
                            ),
                            'line_height' => array(
                                'default' => '1.3em',
                            ),
                        ),
                        'content' => array(
                            'label' => esc_html__('Content', 'restaurant-posts-zigzag'),
                            'css' => array(
                                'main' => '%%order_class%% .rpz-excerpt',
                                'important' => 'all',
                            ),
                            'font_size' => array(
                                'default' => '16px',
                            ),
                            'line_height' => array(
                                'default' => '1.6em',
                            ),
                        ),
                    ),
                    'margin_padding' => array(
                        'css' => array(
                            'important' => 'all',
                        ),
                    ),
                    'borders' => array(
                        'default' => array(
                            'css' => array(
                                'main' => array(
                                    'border_radii' => '%%order_class%% .rpz-image',
                                    'border_styles' => '%%order_class%% .rpz-image',
                                ),
                            ),
                        ),
                    ),
                    'box_shadow' => array(
                        'default' => array(
                            'css' => array(
                                'main' => '%%order_class%% .rpz-image',
                                'important' => 'all',
                            ),
                        ),
                    ),
                );
            }
            
            function render($attrs, $content = null, $render_slug) {
                $posts_count = $this->props['posts_count'];
                $category = $this->props['category'];
                
                $shortcode = '[restaurant_zigzag count="' . esc_attr($posts_count) . '" category="' . esc_attr($category) . '"]';
                
                return do_shortcode($shortcode);
            }
        }
        
        new RPZ_Divi_Module();
    }
}
add_action('et_builder_ready', 'rpz_initialize_divi_extension'); 