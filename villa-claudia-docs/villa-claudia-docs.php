<?php
/**
 * Plugin Name: Villa Claudia Document Upload
 * Description: Integrates with MotoPress Hotel Booking to provide document upload functionality
 * Version: 1.4.0
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
        
        // Add handler for updating document status
        add_action('admin_init', array($this, 'handle_document_status_update'));
        
        // Add handler for test email
        add_action('admin_init', array($this, 'handle_test_email'));
    }
    
    public function init() {
        $this->api_key = get_option('villa_claudia_api_key', '');
        if (empty($this->api_key)) {
            // Generate a secure random API key if none exists
            $this->api_key = wp_generate_password(32, false);
            update_option('villa_claudia_api_key', $this->api_key);
        }
    }
    
    /**
     * Get or generate a secure booking ID for a booking
     */
    private function get_secure_booking_id($booking_id) {
        $secure_id = get_post_meta($booking_id, 'villa_claudia_secure_id', true);
        
        if (empty($secure_id)) {
            // Get booking details
            $check_in_date = get_post_meta($booking_id, 'mphb_check_in_date', true);
            $check_out_date = get_post_meta($booking_id, 'mphb_check_out_date', true);
            
            // Format dates (remove hyphens)
            $check_in_formatted = str_replace('-', '', $check_in_date);
            $check_out_formatted = str_replace('-', '', $check_out_date);
            
            // Concatenate booking ID, check-in date, and check-out date
            $secure_id = $booking_id . $check_in_formatted . $check_out_formatted;
            
            // Store the secure ID
            update_post_meta($booking_id, 'villa_claudia_secure_id', $secure_id);
        }
        
        return $secure_id;
    }
    
    public function register_api_endpoints() {
        register_rest_route('villa-claudia/v1', '/booking/(?P<id>\w+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_booking_data'),
            'permission_callback' => array($this, 'validate_api_key')
        ));
        
        // Add endpoint to get booking by secure ID
        register_rest_route('villa-claudia/v1', '/secure-booking/(?P<secure_id>\w+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_booking_by_secure_id'),
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
        
        // Simple ping endpoint to check if API is working
        register_rest_route('villa-claudia/v1', '/ping', array(
            'methods' => 'GET',
            'callback' => array($this, 'ping'),
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
        
        // First try to get the booking as a post
        $booking_post = get_post($booking_id);
        
        error_log('Direct post lookup: ' . ($booking_post ? 'Found' : 'Not found'));
        
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
        
        // Try multiple approaches to get guest name
        $guest_info = get_post_meta($booking_post->ID, 'mphb_guest_info', true);
        $first_name = '';
        $last_name = '';
        
        // Check if guest_info is an array with the expected keys
        if (is_array($guest_info) && isset($guest_info['first_name'])) {
            $first_name = $guest_info['first_name'];
            $last_name = isset($guest_info['last_name']) ? $guest_info['last_name'] : '';
        } else {
            // Fallback to direct meta fields
            $first_name = get_post_meta($booking_post->ID, 'mphb_first_name', true);
            $last_name = get_post_meta($booking_post->ID, 'mphb_last_name', true);
        }
        
        $guest_name = trim($first_name . ' ' . $last_name);
        if (empty($guest_name)) {
            $guest_name = 'Guest'; // Default if we can't find a name
        }
        
        // Format response
        return array(
            'bookingId' => $booking_post->ID,
            'checkInDate' => $check_in_date,
            'checkOutDate' => $check_out_date,
            'guestName' => $guest_name,
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
        
        // Add new Documents Upload admin page
        add_menu_page(
            'Document Uploads',
            'Document Uploads',
            'manage_options',
            'document-uploads',
            array($this, 'document_uploads_page'),
            'dashicons-media-document',
            30
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
            <p>You can test if the API is working correctly by making a request to:</p>
            <code><?php echo esc_url(get_rest_url(null, 'villa-claudia/v1/ping')); ?></code>
            <p>Include the header: <code>x-api-key: <?php echo esc_attr(get_option('villa_claudia_api_key')); ?></code></p>
            
            <p>To test with a specific booking ID:</p>
            <code><?php echo esc_url(get_rest_url(null, 'villa-claudia/v1/booking/BOOKING_ID')); ?></code>
            <p>Replace BOOKING_ID with an actual booking ID from MotoPress.</p>
            
            <hr>
            
            <h3>Send Test Email</h3>
            <p>Send a test email with the document upload link for a specific booking:</p>
            
            <?php
            // Display success/error messages
            if (isset($_GET['email_sent']) && $_GET['email_sent'] === 'success') {
                echo '<div class="notice notice-success is-dismissible"><p>Test email sent successfully!</p></div>';
            } elseif (isset($_GET['email_sent']) && $_GET['email_sent'] === 'error') {
                echo '<div class="notice notice-error is-dismissible"><p>Error sending test email. Please check the booking ID and recipient email.</p></div>';
            }
            ?>
            
            <form method="post" action="">
                <?php wp_nonce_field('villa_claudia_test_email', 'villa_claudia_test_email_nonce'); ?>
                <input type="hidden" name="action" value="villa_claudia_test_email">
                
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">Booking ID</th>
                        <td>
                            <input type="text" name="booking_id" required style="width: 150px;" />
                            <p class="description">Enter the booking ID you want to test.</p>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">Email Recipient</th>
                        <td>
                            <input type="email" name="recipient_email" required style="width: 320px;" />
                            <p class="description">Enter the email address to receive the test link.</p>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button('Send Test Email', 'secondary'); ?>
            </form>
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
        echo '</tr></thead>';
        echo '<tbody>';
        
        foreach ($documents as $doc) {
            echo '<tr>';
            echo '<td>' . esc_html($doc['traveler_name']) . '</td>';
            echo '<td>' . esc_html($doc['document_type']) . '</td>';
            echo '<td>' . esc_html($doc['document_number']) . '</td>';
            echo '<td>' . esc_html($doc['original_name']) . '</td>';
            echo '<td>' . esc_html($doc['uploaded_at']) . '</td>';
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
    
    // Simple ping endpoint to test API connectivity
    public function ping() {
        return array(
            'status' => 'success',
            'message' => 'API is working correctly',
            'version' => '1.0.6',
            'wordpress' => get_bloginfo('version'),
            'timestamp' => current_time('mysql')
        );
    }
    
    /**
     * Render the Document Uploads admin page
     */
    public function document_uploads_page() {
        // Check if document deletion requested
        if (isset($_GET['action']) && $_GET['action'] === 'delete' && isset($_GET['document_id']) && isset($_GET['booking_id'])) {
            $this->delete_document($_GET['booking_id'], $_GET['document_id']);
        }
        
        // Get all bookings with documents
        global $wpdb;
        $bookings_with_docs = $wpdb->get_col(
            "SELECT post_id FROM {$wpdb->postmeta} 
             WHERE meta_key = 'villa_claudia_has_documents' 
             AND meta_value = '1'"
        );
        
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline">Guest Documents</h1>
            
            <!-- Filters -->
            <div class="tablenav top">
                <div class="alignleft actions">
                    <form method="get">
                        <input type="hidden" name="page" value="document-uploads">
                        <select name="booking_filter" id="booking-filter">
                            <option value="">All Bookings</option>
                            <?php
                            foreach ($bookings_with_docs as $booking_id) {
                                $selected = isset($_GET['booking_filter']) && $_GET['booking_filter'] == $booking_id ? 'selected' : '';
                                echo '<option value="' . esc_attr($booking_id) . '" ' . $selected . '>Booking #' . esc_html($booking_id) . '</option>';
                            }
                            ?>
                        </select>
                        
                        <select name="status_filter" id="status-filter">
                            <option value="">All Statuses</option>
                            <option value="verified" <?php echo isset($_GET['status_filter']) && $_GET['status_filter'] == 'verified' ? 'selected' : ''; ?>>Verified</option>
                            <option value="pending" <?php echo isset($_GET['status_filter']) && $_GET['status_filter'] == 'pending' ? 'selected' : ''; ?>>Pending</option>
                            <option value="rejected" <?php echo isset($_GET['status_filter']) && $_GET['status_filter'] == 'rejected' ? 'selected' : ''; ?>>Rejected</option>
                        </select>
                        
                        <input type="search" id="doc-search" name="s" value="<?php echo isset($_GET['s']) ? esc_attr($_GET['s']) : ''; ?>" placeholder="Search by traveler name...">
                        
                        <input type="submit" id="search-submit" class="button" value="Filter">
                    </form>
                </div>
                <br class="clear">
            </div>
            
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th scope="col" class="manage-column">Traveler</th>
                        <th scope="col" class="manage-column">Booking ID</th>
                        <th scope="col" class="manage-column">Document Type</th>
                        <th scope="col" class="manage-column">Document Number</th>
                        <th scope="col" class="manage-column">Uploaded</th>
                        <th scope="col" class="manage-column">Status</th>
                        <th scope="col" class="manage-column">Booking URL</th>
                        <th scope="col" class="manage-column">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    foreach ($bookings_with_docs as $booking_id) {
                        // Skip if filtering by booking ID and doesn't match
                        if (isset($_GET['booking_filter']) && !empty($_GET['booking_filter']) && $_GET['booking_filter'] != $booking_id) {
                            continue;
                        }
                        
                        $documents = get_post_meta($booking_id, 'villa_claudia_document');
                        
                        if (empty($documents)) {
                            continue;
                        }
                        
                        $booking_post = get_post($booking_id);
                        $guest_email = get_post_meta($booking_id, 'mphb_email', true);
                        
                        foreach ($documents as $document) {
                            // Skip if filtering by status
                            $doc_status = isset($document['status']) ? $document['status'] : 'pending';
                            if (isset($_GET['status_filter']) && !empty($_GET['status_filter']) && $_GET['status_filter'] != $doc_status) {
                                continue;
                            }
                            
                            // Skip if searching and doesn't match
                            if (isset($_GET['s']) && !empty($_GET['s'])) {
                                $search_term = strtolower($_GET['s']);
                                $traveler_name = strtolower($document['traveler_name'] ?? '');
                                
                                if (strpos($traveler_name, $search_term) === false) {
                                    continue;
                                }
                            }
                            
                            $uploaded_at = isset($document['uploaded_at']) ? date('F j, Y', strtotime($document['uploaded_at'])) : 'Unknown';
                            ?>
                            <tr>
                                <td>
                                    <?php echo esc_html($document['traveler_name'] ?? 'Unknown'); ?>
                                    <div class="row-actions">
                                        <span class="email"><?php echo esc_html($guest_email); ?></span>
                                    </div>
                                </td>
                                <td>
                                    <a href="<?php echo admin_url('post.php?post=' . $booking_id . '&action=edit'); ?>">#<?php echo esc_html($booking_id); ?></a>
                                </td>
                                <td><?php echo esc_html($document['document_type'] ?? 'Unknown'); ?></td>
                                <td><?php echo esc_html($document['document_number'] ?? 'Unknown'); ?></td>
                                <td><?php echo esc_html($uploaded_at); ?></td>
                                <td>
                                    <?php
                                    $status_colors = [
                                        'pending' => '#ffc107',
                                        'verified' => '#4CAF50',
                                        'rejected' => '#f44336'
                                    ];
                                    $status_color = isset($status_colors[$doc_status]) ? $status_colors[$doc_status] : '#999';
                                    ?>
                                    <span style="color: <?php echo $status_color; ?>; font-weight: bold;">
                                        <?php echo ucfirst($doc_status); ?>
                                    </span>
                                </td>
                                <td>
                                    <?php 
                                    $secure_id = $this->get_secure_booking_id($booking_id);
                                    
                                    // Use the documents subdomain for the booking URL
                                    $upload_url = 'https://documents.villa-claudia.eu/' . $secure_id;
                                    echo '<a href="#" onclick="navigator.clipboard.writeText(\'' . $upload_url . '\');alert(\'URL copied!\');return false;" title="Click to copy">' . $upload_url . '</a>';
                                    ?>
                                </td>
                                <td>
                                    <a href="<?php echo admin_url('admin-ajax.php?action=villa_claudia_view_document&document_id=' . urlencode($document['filename']) . '&booking_id=' . $booking_id . '&_wpnonce=' . wp_create_nonce('view_document')); ?>" class="button button-small" target="_blank">View</a>
                                    
                                    <a href="<?php echo add_query_arg(['action' => 'update_status', 'document_id' => $document['filename'], 'booking_id' => $booking_id, 'status' => 'verified', '_wpnonce' => wp_create_nonce('update_document_status')]); ?>" class="button button-small" style="background-color:#4CAF50;color:white;border-color:#4CAF50;">Verify</a>
                                    
                                    <a href="<?php echo add_query_arg(['action' => 'update_status', 'document_id' => $document['filename'], 'booking_id' => $booking_id, 'status' => 'rejected', '_wpnonce' => wp_create_nonce('update_document_status')]); ?>" class="button button-small" style="background-color:#f44336;color:white;border-color:#f44336;">Reject</a>
                                    
                                    <a href="<?php echo add_query_arg(['action' => 'delete', 'document_id' => $document['filename'], 'booking_id' => $booking_id, '_wpnonce' => wp_create_nonce('delete_document')]); ?>" class="button button-small" style="color:red;" onclick="return confirm('Are you sure you want to delete this document?');">Delete</a>
                                </td>
                            </tr>
                            <?php
                        }
                    }
                    ?>
                </tbody>
            </table>
        </div>
        <?php
    }
    
    /**
     * Delete a document
     */
    private function delete_document($booking_id, $document_id) {
        // Verify nonce
        if (!isset($_GET['_wpnonce']) || !wp_verify_nonce($_GET['_wpnonce'], 'delete_document')) {
            wp_die('Security check failed');
        }
        
        // Check if user has permission
        if (!current_user_can('manage_options')) {
            wp_die('You do not have permission to delete documents');
        }
        
        $documents = get_post_meta($booking_id, 'villa_claudia_document');
        $updated_documents = [];
        $document_found = false;
        
        // Remove the document from metadata
        foreach ($documents as $document) {
            if ($document['filename'] !== $document_id) {
                $updated_documents[] = $document;
            } else {
                $document_found = true;
            }
        }
        
        if ($document_found) {
            // Delete the physical file
            $upload_dir = wp_upload_dir();
            $document_path = $upload_dir['basedir'] . '/booking-documents/' . $booking_id . '/' . $document_id;
            
            if (file_exists($document_path)) {
                unlink($document_path);
            }
            
            // Update the metadata
            delete_post_meta($booking_id, 'villa_claudia_document');
            
            foreach ($updated_documents as $doc) {
                add_post_meta($booking_id, 'villa_claudia_document', $doc);
            }
            
            // If no documents left, update the has_documents flag
            if (empty($updated_documents)) {
                update_post_meta($booking_id, 'villa_claudia_has_documents', false);
            }
            
            // Add admin notice
            add_action('admin_notices', function() {
                echo '<div class="notice notice-success is-dismissible"><p>Document deleted successfully.</p></div>';
            });
        }
        
        // Redirect back to the document list
        wp_redirect(admin_url('admin.php?page=document-uploads'));
        exit;
    }
    
    /**
     * Handle document status updates
     */
    public function handle_document_status_update() {
        if (isset($_GET['action']) && $_GET['action'] === 'update_status' && 
            isset($_GET['document_id']) && isset($_GET['booking_id']) && isset($_GET['status'])) {
            
            // Verify nonce
            if (!isset($_GET['_wpnonce']) || !wp_verify_nonce($_GET['_wpnonce'], 'update_document_status')) {
                wp_die('Security check failed');
            }
            
            // Check if user has permission
            if (!current_user_can('manage_options')) {
                wp_die('You do not have permission to update document status');
            }
            
            $booking_id = intval($_GET['booking_id']);
            $document_id = sanitize_text_field($_GET['document_id']);
            $new_status = sanitize_text_field($_GET['status']);
            
            // Validate status
            if (!in_array($new_status, ['pending', 'verified', 'rejected'])) {
                wp_die('Invalid status');
            }
            
            $documents = get_post_meta($booking_id, 'villa_claudia_document');
            $updated = false;
            
            foreach ($documents as $index => $document) {
                if ($document['filename'] === $document_id) {
                    // Update the status
                    $document['status'] = $new_status;
                    // Update in database
                    update_post_meta($booking_id, 'villa_claudia_document', $document, $documents[$index]);
                    $updated = true;
                    break;
                }
            }
            
            if ($updated) {
                // Add admin notice
                add_action('admin_notices', function() use ($new_status) {
                    echo '<div class="notice notice-success is-dismissible"><p>Document status updated to ' . ucfirst($new_status) . '.</p></div>';
                });
            }
            
            // Redirect back to the document list
            wp_redirect(admin_url('admin.php?page=document-uploads'));
            exit;
        }
    }
    
    /**
     * Get booking data by secure ID
     */
    public function get_booking_by_secure_id($request) {
        $secure_id = $request->get_param('secure_id');
        
        if (empty($secure_id)) {
            return new WP_Error('no_id', 'Secure ID is required', array('status' => 400));
        }
        
        // Find booking with this secure ID
        global $wpdb;
        $booking_id = $wpdb->get_var($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta} 
             WHERE meta_key = 'villa_claudia_secure_id' 
             AND meta_value = %s",
            $secure_id
        ));
        
        if (!$booking_id) {
            return new WP_Error('not_found', 'Booking not found', array('status' => 404));
        }
        
        // Create a fake request object to reuse the get_booking_data method
        $request = new WP_REST_Request('GET', '/villa-claudia/v1/booking/' . $booking_id);
        $request->set_param('id', $booking_id);
        
        return $this->get_booking_data($request);
    }
    
    /**
     * Handle sending test email with document upload link
     */
    public function handle_test_email() {
        if (isset($_POST['action']) && $_POST['action'] === 'villa_claudia_test_email') {
            // Verify nonce
            if (!isset($_POST['villa_claudia_test_email_nonce']) || !wp_verify_nonce($_POST['villa_claudia_test_email_nonce'], 'villa_claudia_test_email')) {
                wp_die('Security check failed');
            }
            
            // Check if user has permission
            if (!current_user_can('manage_options')) {
                wp_die('You do not have permission to send test emails');
            }
            
            $booking_id = isset($_POST['booking_id']) ? intval($_POST['booking_id']) : 0;
            $recipient_email = isset($_POST['recipient_email']) ? sanitize_email($_POST['recipient_email']) : '';
            
            if (empty($booking_id) || empty($recipient_email)) {
                wp_redirect(admin_url('options-general.php?page=villa-claudia-docs&email_sent=error'));
                exit;
            }
            
            // Get booking info
            $booking_post = get_post($booking_id);
            if (!$booking_post || $booking_post->post_type !== 'mphb_booking') {
                wp_redirect(admin_url('options-general.php?page=villa-claudia-docs&email_sent=error'));
                exit;
            }
            
            // Get guest info
            $guest_info = get_post_meta($booking_id, 'mphb_guest_info', true);
            $first_name = '';
            $last_name = '';
            
            if (is_array($guest_info) && isset($guest_info['first_name'])) {
                $first_name = $guest_info['first_name'];
                $last_name = isset($guest_info['last_name']) ? $guest_info['last_name'] : '';
            } else {
                $first_name = get_post_meta($booking_id, 'mphb_first_name', true);
                $last_name = get_post_meta($booking_id, 'mphb_last_name', true);
            }
            
            $guest_name = trim($first_name . ' ' . $last_name);
            if (empty($guest_name)) {
                $guest_name = 'Guest';
            }
            
            // Get secure booking ID and create link
            $secure_id = $this->get_secure_booking_id($booking_id);
            
            // Use the documents subdomain for the booking URL
            $upload_url = 'https://documents.villa-claudia.eu/' . $secure_id;
            
            // Email content
            $subject = 'Villa Claudia: Your Document Upload Link';
            $message = "Hello $guest_name,\n\n";
            $message .= "Here is your secure link to upload your travel documents for your upcoming stay at Villa Claudia:\n\n";
            $message .= $upload_url . "\n\n";
            $message .= "This link is unique to your booking and ensures your documents are securely attached to your reservation.\n\n";
            $message .= "If you have any questions, please don't hesitate to contact us.\n\n";
            $message .= "Best regards,\nVilla Claudia Team";
            
            $headers = array('Content-Type: text/plain; charset=UTF-8');
            
            // Send email
            $email_sent = wp_mail($recipient_email, $subject, $message, $headers);
            
            if ($email_sent) {
                wp_redirect(admin_url('options-general.php?page=villa-claudia-docs&email_sent=success'));
            } else {
                wp_redirect(admin_url('options-general.php?page=villa-claudia-docs&email_sent=error'));
            }
            exit;
        }
    }
}

// Initialize the plugin
$villa_claudia_docs = new Villa_Claudia_Docs(); 