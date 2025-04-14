<?php
/**
 * Plugin Name: Villa Claudia Document Upload
 * Description: Integrates with MotoPress Hotel Booking to provide document upload functionality
 * Version: 1.0.6
 * Author: Thomas Scheiber
 * Text Domain: villa-claudia-docs
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class Villa_Claudia_Docs {
    private $api_key;
    
    public function __construct() {
        // Initialize the plugin
        add_action('init', array($this, 'init'));
        
        // Register REST API endpoints
        add_action('rest_api_init', array($this, 'register_api_endpoints'));
        
        // Add settings page
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        
        // Add a meta box to the booking edit screen
        add_action('add_meta_boxes', array($this, 'add_documents_meta_box'));
        
        // Add AJAX handlers
        add_action('wp_ajax_villa_claudia_view_document', array($this, 'ajax_view_document'));
    }
    
    public function init() {
        $this->api_key = get_option('villa_claudia_api_key', '');
        if (empty($this->api_key)) {
            // Generate a secure random API key if none exists
            $this->api_key = wp_generate_password(32, false);
            update_option('villa_claudia_api_key', $this->api_key);
        }
    }
    
    public function register_api_endpoints() {
        register_rest_route('villa-claudia/v1', '/booking/(?P<id>\w+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_booking_data'),
            'permission_callback' => array($this, 'validate_api_key')
        ));
        
        register_rest_route('villa-claudia/v1', '/bookings/upcoming', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_upcoming_bookings'),
            'permission_callback' => array($this, 'validate_api_key')
        ));
        
        register_rest_route('villa-claudia/v1', '/has-documents/(?P<id>\w+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'check_documents_exist'),
            'permission_callback' => array($this, 'validate_api_key')
        ));
        
        register_rest_route('villa-claudia/v1', '/upload-documents', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_document_upload'),
            'permission_callback' => array($this, 'validate_api_key')
        ));
    }
    
    public function validate_api_key($request) {
        $api_key = $request->get_header('x-api-key');
        return $api_key === $this->api_key;
    }
    
    public function get_booking_data($request) {
        $booking_id = $request->get_param('id');
        
        error_log('API Request for booking ID: ' . $booking_id);
        error_log('Direct post lookup: ' . ($booking_post ? 'Found' : 'Not found'));
        
        // First try to get the booking as a post
        $booking_post = get_post($booking_id);
        
        if (!$booking_post || $booking_post->post_type !== 'mphb_booking') {
            // If not found directly, try to find it in MotoPress tables
            global $wpdb;
            
            // Try to find by ID in the mphb custom tables
            $mphb_booking_id = $wpdb->get_var($wpdb->prepare(
                "SELECT post_id FROM {$wpdb->postmeta} 
                 WHERE meta_key = 'mphb_booking_id' 
                 AND meta_value = %s",
                $booking_id
            ));
            
            if ($mphb_booking_id) {
                $booking_post = get_post($mphb_booking_id);
            }
            
            if (!$booking_post) {
                return new WP_Error('no_booking', 'Booking not found', array('status' => 404));
            }
        }
        
        // Get booking details from post meta
        $check_in_date = get_post_meta($booking_post->ID, 'mphb_check_in_date', true);
        $check_out_date = get_post_meta($booking_post->ID, 'mphb_check_out_date', true);
        $customer_email = get_post_meta($booking_post->ID, 'mphb_email', true);
        $guest_info = get_post_meta($booking_post->ID, 'mphb_guest_info', true);
        
        // Format response
        return array(
            'bookingId' => $booking_post->ID,
            'checkInDate' => $check_in_date,
            'checkOutDate' => $check_out_date,
            'guestName' => trim($guest_info['first_name'] . ' ' . $guest_info['last_name']),
            'guestEmail' => $customer_email,
            'status' => $booking_post->post_status
        );
    }
    
    /**
     * Get upcoming bookings for the next 14 days
     */
    public function get_upcoming_bookings() {
        global $wpdb;
        
        $today = date('Y-m-d');
        $two_weeks_later = date('Y-m-d', strtotime('+14 days'));
        
        // Query upcoming bookings in the next 14 days
        $query = $wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts} WHERE 
            post_type = 'mphb_booking' AND 
            post_status = 'confirmed' AND 
            ID IN (
                SELECT post_id FROM {$wpdb->postmeta} 
                WHERE meta_key IN ('mphb_check_in_date', '_mphb_check_in_date') 
                AND meta_value BETWEEN %s AND %s
            )",
            $today, $two_weeks_later
        );
        
        $upcoming_booking_ids = $wpdb->get_col($query);
        
        if (empty($upcoming_booking_ids)) {
            return array();
        }
        
        $bookings = array();
        foreach ($upcoming_booking_ids as $booking_id) {
            // Create a fake request object to reuse the get_booking_data method
            $request = new WP_REST_Request('GET', '/villa-claudia/v1/booking/' . $booking_id);
            $request->set_param('id', $booking_id);
            
            $booking_data = $this->get_booking_data($request);
            
            // Skip if there was an error
            if (is_wp_error($booking_data)) {
                continue;
            }
            
            $bookings[] = $booking_data;
        }
        
        return $bookings;
    }
    
    public function add_admin_menu() {
        add_submenu_page(
            'options-general.php',
            'Villa Claudia Documents',
            'Villa Claudia Docs',
            'manage_options',
            'villa-claudia-docs',
            array($this, 'admin_page')
        );
    }
    
    public function register_settings() {
        register_setting('villa_claudia_settings', 'villa_claudia_api_key');
    }
    
    public function admin_page() {
        ?>
        <div class="wrap">
            <h2>Villa Claudia Document Upload Settings</h2>
            <form method="post" action="options.php">
                <?php settings_fields('villa_claudia_settings'); ?>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">API Key</th>
                        <td>
                            <input type="text" style="width: 320px;" 
                                   name="villa_claudia_api_key" 
                                   value="<?php echo esc_attr(get_option('villa_claudia_api_key')); ?>" />
                            <p class="description">This key is used to authenticate API requests from the document upload application.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
            
            <h3>Integration Information</h3>
            <p>To connect the Villa Claudia Document Upload system, add these settings to your Environment Variables (file):</p>
            <code>
            WORDPRESS_API_URL=<?php echo esc_url(get_rest_url(null, 'villa-claudia/v1')); ?><br>
            WORDPRESS_API_KEY=<?php echo esc_attr(get_option('villa_claudia_api_key')); ?>
            </code>
            
            <h3>Testing the API</h3>
            <p>You can test if the API is working by making a request to:</p>
            <code><?php echo esc_url(get_rest_url(null, 'villa-claudia/v1/booking/BOOKING_ID')); ?></code>
            <p>Replace BOOKING_ID with an actual booking ID from MotoPress.</p>
            <p>Include the header: <code>x-api-key: <?php echo esc_attr(get_option('villa_claudia_api_key')); ?></code></p>
        </div>
        <?php
    }
    
    public function add_documents_meta_box() {
        add_meta_box(
            'villa_claudia_documents',
            'Travel Documents',
            array($this, 'display_documents_meta_box'),
            'mphb_booking',
            'normal',
            'high'
        );
    }
    
    public function display_documents_meta_box($post) {
        $documents = get_post_meta($post->ID, 'villa_claudia_document');
        
        if (empty($documents)) {
            echo '<p>No documents uploaded for this booking.</p>';
            return;
        }
        
        echo '<table class="widefat">';
        echo '<thead><tr>';
        echo '<th>Traveler</th>';
        echo '<th>Document Type</th>';
        echo '<th>Document Number</th>';
        echo '<th>Filename</th>';
        echo '<th>Uploaded</th>';
        echo '<th>Actions</th>';
        echo '</tr></thead>';
        echo '<tbody>';
        
        foreach ($documents as $doc) {
            echo '<tr>';
            echo '<td>' . esc_html($doc['traveler_name']) . '</td>';
            echo '<td>' . esc_html($doc['document_type']) . '</td>';
            echo '<td>' . esc_html($doc['document_number']) . '</td>';
            echo '<td>' . esc_html($doc['original_name']) . '</td>';
            echo '<td>' . esc_html($doc['uploaded_at']) . '</td>';
            echo '<td>';
            echo '<a href="' . admin_url('admin-ajax.php?action=villa_claudia_view_document&document_id=' . $doc['filename'] . '&booking_id=' . $post->ID . '&_wpnonce=' . wp_create_nonce('view_document')) . '" target="_blank">View</a>';
            echo '</td>';
            echo '</tr>';
        }
        
        echo '</tbody></table>';
    }
    
    public function check_documents_exist($request) {
        $booking_id = $request->get_param('id');
        
        if (empty($booking_id)) {
            return new WP_Error('missing_id', 'Booking ID is required', array('status' => 400));
        }
        
        $has_documents = (bool) get_post_meta($booking_id, 'villa_claudia_has_documents', true);
        
        return array(
            'bookingId' => $booking_id,
            'hasDocuments' => $has_documents
        );
    }
    
    public function handle_document_upload($request) {
        $booking_id = $request->get_param('bookingId');
        $files = $request->get_file_params();
        
        if (empty($booking_id)) {
            return new WP_Error('missing_id', 'Booking ID is required', array('status' => 400));
        }
        
        if (empty($files)) {
            return new WP_Error('no_files', 'No files were uploaded', array('status' => 400));
        }
        
        // Create upload directory
        $upload_dir = wp_upload_dir();
        $booking_dir = $upload_dir['basedir'] . '/booking-documents/' . $booking_id;
        
        if (!file_exists($booking_dir)) {
            wp_mkdir_p($booking_dir);
            
            // Create .htaccess file to protect directory
            $htaccess = "Order deny,allow\nDeny from all";
            file_put_contents($booking_dir . '/.htaccess', $htaccess);
        }
        
        $uploaded_files = array();
        
        // Process each file
        foreach ($files as $file_key => $file) {
            $file_info = $request->get_param('file_info_' . $file_key);
            $decoded_info = json_decode($file_info, true);
            
            // Generate secure filename
            $filename = sanitize_file_name(
                ($decoded_info['travelerName'] ?? 'guest') . '-' . 
                ($decoded_info['documentType'] ?? 'document') . '-' . 
                time() . '.' . 
                pathinfo($file['name'], PATHINFO_EXTENSION)
            );
            
            // Save file
            if (move_uploaded_file($file['tmp_name'], $booking_dir . '/' . $filename)) {
                $uploaded_files[] = array(
                    'name' => $filename,
                    'original_name' => $file['name'],
                    'type' => $file['type'],
                    'size' => $file['size'],
                    'traveler_name' => $decoded_info['travelerName'] ?? '',
                    'document_type' => $decoded_info['documentType'] ?? '',
                    'document_number' => $decoded_info['documentNumber'] ?? ''
                );
                
                // Save file metadata to post meta
                add_post_meta($booking_id, 'villa_claudia_document', array(
                    'filename' => $filename,
                    'original_name' => $file['name'],
                    'uploaded_at' => current_time('mysql'),
                    'traveler_name' => $decoded_info['travelerName'] ?? '',
                    'document_type' => $decoded_info['documentType'] ?? '',
                    'document_number' => $decoded_info['documentNumber'] ?? ''
                ));
            }
        }
        
        // Update flag to indicate documents have been uploaded
        update_post_meta($booking_id, 'villa_claudia_has_documents', true);
        
        return array(
            'success' => true,
            'message' => 'Files uploaded successfully',
            'files' => $uploaded_files
        );
    }
    
    /**
     * AJAX handler for viewing a document
     */
    public function ajax_view_document() {
        // Check nonce for security
        if (!isset($_GET['_wpnonce']) || !wp_verify_nonce($_GET['_wpnonce'], 'view_document')) {
            wp_die('Security check failed');
        }
        
        // Check if user has permission
        if (!current_user_can('manage_options')) {
            wp_die('You do not have permission to view this document');
        }
        
        $document_id = isset($_GET['document_id']) ? sanitize_text_field($_GET['document_id']) : '';
        $booking_id = isset($_GET['booking_id']) ? intval($_GET['booking_id']) : 0;
        
        if (empty($document_id) || empty($booking_id)) {
            wp_die('Missing document information');
        }
        
        // Get the document path
        $upload_dir = wp_upload_dir();
        $document_path = $upload_dir['basedir'] . '/booking-documents/' . $booking_id . '/' . $document_id;
        
        if (!file_exists($document_path)) {
            wp_die('Document not found');
        }
        
        // Get file info
        $file_info = pathinfo($document_path);
        $file_extension = strtolower($file_info['extension']);
        
        // Set content type based on file extension
        $content_types = array(
            'pdf' => 'application/pdf',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png'
        );
        
        $content_type = isset($content_types[$file_extension]) ? $content_types[$file_extension] : 'application/octet-stream';
        
        // Output appropriate headers
        header('Content-Type: ' . $content_type);
        header('Content-Disposition: inline; filename="' . basename($document_path) . '"');
        header('Content-Length: ' . filesize($document_path));
        
        // Clear any previous output
        ob_clean();
        flush();
        
        // Output the file
        readfile($document_path);
        exit;
    }
}

// Initialize the plugin
$villa_claudia_docs = new Villa_Claudia_Docs(); 