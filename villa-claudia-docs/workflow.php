<?php
if (!defined('ABSPATH')) { exit; }

trait Villa_Claudia_Workflow {
    private function booking_fingerprint($id) {
        return hash('sha256', implode('|', array(
            get_post_meta($id, 'mphb_check_in_date', true),
            get_post_meta($id, 'mphb_check_out_date', true),
            get_post_meta($id, 'mphb_email', true),
        )));
    }

    private function get_secure_booking_id($id) {
        $token = get_post_meta($id, 'villa_claudia_secure_id', true);
        $fingerprint = $this->booking_fingerprint($id);
        if (!is_string($token) || !preg_match('/\Avc_[a-f0-9]{64}\z/', $token) ||
            get_post_meta($id, 'villa_claudia_token_fingerprint', true) !== $fingerprint) {
            $token = 'vc_' . bin2hex(random_bytes(32));
            update_post_meta($id, 'villa_claudia_secure_id', $token);
            update_post_meta($id, 'villa_claudia_token_fingerprint', $fingerprint);
        }
        return $token;
    }

    private function active_booking($id) {
        $post = get_post($id);
        if (!$post || $post->post_type !== 'mphb_booking' || $post->post_status !== 'confirmed') { return false; }
        $checkout = get_post_meta($id, 'mphb_check_out_date', true);
        return is_string($checkout) && preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $checkout) && $checkout >= current_time('Y-m-d');
    }

    private function resolve_upload_booking($token) {
        if (!is_string($token) || !preg_match('/\Avc_[a-f0-9]{64}\z/', $token)) {
            return new WP_Error('invalid_link', 'Invalid or expired upload link.', array('status' => 404));
        }
        global $wpdb;
        $id = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key='villa_claudia_secure_id' AND meta_value=%s LIMIT 1", $token
        ));
        $stored = get_post_meta($id, 'villa_claudia_secure_id', true);
        if (!$id || !is_string($stored) || !hash_equals($stored, $token) || !$this->active_booking($id) ||
            get_post_meta($id, 'villa_claudia_token_fingerprint', true) !== $this->booking_fingerprint($id)) {
            return new WP_Error('invalid_link', 'Invalid or expired upload link.', array('status' => 404));
        }
        return $id;
    }

    public function get_booking_by_secure_id($request) {
        $id = $this->resolve_upload_booking($request->get_param('secure_id'));
        if (is_wp_error($id)) { return $id; }
        $lookup = new WP_REST_Request('GET');
        $lookup->set_param('id', $id);
        return $this->get_booking_data($lookup);
    }

    public function private_rest_response($response, $server, $request) {
        if (strpos($request->get_route(), '/villa-claudia/v1/') === 0) {
            do_action('litespeed_control_set_nocache', 'Private Villa Claudia API');
            $response = rest_ensure_response($response);
            $response->header('Cache-Control', 'private, no-store, max-age=0');
            $response->header('Vary', 'x-api-key');
        }
        return $response;
    }

    private function document_path($id, $filename) {
        if (!is_string($filename) || $filename !== basename($filename)) { return false; }
        $base = wp_upload_dir()['basedir'] . '/booking-documents/' . absint($id);
        $path = realpath($base . '/' . $filename);
        $directory = realpath($base);
        return $path && $directory && strpos($path, $directory . DIRECTORY_SEPARATOR) === 0 && is_file($path) ? $path : false;
    }

    private function has_stored_documents($id) {
        foreach (get_post_meta($id, 'villa_claudia_document') as $doc) {
            if (is_array($doc) && $this->document_path($id, $doc['filename'] ?? '')) { return true; }
        }
        return false;
    }

    public function handle_document_upload($request) {
        $id = $this->resolve_upload_booking($request->get_param('uploadToken'));
        if (is_wp_error($id)) { return $id; }
        $files = $request->get_file_params();
        if (count($files) < 1 || count($files) > 8) {
            return new WP_Error('invalid_files', 'Upload between one and eight documents.', array('status' => 400));
        }
        $allowed = array('image/jpeg' => 'jpg', 'image/png' => 'png', 'application/pdf' => 'pdf');
        $validated = array(); $total = 0;
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        foreach ($files as $key => $file) {
            if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK ||
                !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) {
                return new WP_Error('invalid_file', 'File upload did not complete.', array('status' => 400));
            }
            $size = filesize($file['tmp_name']); $total += $size;
            $mime = $finfo->file($file['tmp_name']);
            $info = json_decode((string) $request->get_param('file_info_' . $key), true);
            if ($size < 1 || $size > 10 * 1024 * 1024 || $total > 25 * 1024 * 1024 || !isset($allowed[$mime]) ||
                !is_array($info) || !is_string($info['travelerName'] ?? null) || trim($info['travelerName']) === '' ||
                !is_string($info['documentType'] ?? null) || !in_array($info['documentType'], array('passport', 'id_card', 'residence_permit', 'drivers_license'), true) ||
                !is_string($info['documentNumber'] ?? null)) {
                return new WP_Error('invalid_file', 'Invalid document or metadata. Use JPEG, PNG or PDF within the size limits.', array('status' => 400));
            }
            $validated[] = array('tmp' => $file['tmp_name'], 'size' => $size, 'type' => $mime,
                'filename' => bin2hex(random_bytes(24)) . '.' . $allowed[$mime],
                'original_name' => sanitize_file_name($file['name']),
                'traveler_name' => sanitize_text_field($info['travelerName']),
                'document_type' => $info['documentType'], 'document_number' => sanitize_text_field($info['documentNumber']));
        }
        $root = wp_upload_dir()['basedir'] . '/booking-documents';
        $directory = $root . '/' . $id;
        $protection = "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder deny,allow\nDeny from all\n</IfModule>\n";
        if (!wp_mkdir_p($directory) || file_put_contents($root . '/.htaccess', $protection) === false ||
            file_put_contents($directory . '/.htaccess', $protection) === false) {
            return new WP_Error('storage_unavailable', 'Protected storage is unavailable.', array('status' => 500));
        }
        $paths = array(); $meta_ids = array();
        try {
            foreach ($validated as $file) {
                $path = $directory . '/' . $file['filename'];
                if (!move_uploaded_file($file['tmp'], $path)) { throw new RuntimeException('File storage failed.'); }
                $paths[] = $path;
                if (!chmod($path, 0600)) { throw new RuntimeException('File protection failed.'); }
                unset($file['tmp']);
                $file['uploaded_at'] = current_time('mysql'); $file['status'] = 'pending';
                $meta_id = add_post_meta($id, 'villa_claudia_document', $file);
                if (!$meta_id) { throw new RuntimeException('Metadata storage failed.'); }
                $meta_ids[] = $meta_id;
            }
            update_post_meta($id, 'villa_claudia_has_documents', true);
            if (!get_post_meta($id, 'villa_claudia_has_documents', true)) { throw new RuntimeException('Document status storage failed.'); }
        } catch (Throwable $error) {
            foreach ($meta_ids as $meta_id) { delete_metadata_by_mid('post', $meta_id); }
            foreach ($paths as $path) { wp_delete_file($path); }
            update_post_meta($id, 'villa_claudia_has_documents', $this->has_stored_documents($id));
            return new WP_Error('storage_failed', 'Documents were not saved. Please try again.', array('status' => 500));
        }
        return array('success' => true, 'storedCount' => count($paths), 'bookingId' => $id);
    }

    private function reminder_key($id) {
        return 'vc_reminder_' . absint($id) . '_' . substr($this->booking_fingerprint($id), 0, 32);
    }

    public function claim_reminder($request) {
        $id = absint($request->get_param('bookingId'));
        $checkin = get_post_meta($id, 'mphb_check_in_date', true);
        $today = new DateTimeImmutable('today', wp_timezone());
        if (!$this->active_booking($id) || $this->has_stored_documents($id) || !is_email(get_post_meta($id, 'mphb_email', true)) ||
            $checkin < $today->format('Y-m-d') || $checkin > $today->modify('+7 days')->format('Y-m-d') ||
            get_post_meta($id, 'villa_claudia_reminder_sent_for', true) === $this->booking_fingerprint($id)) {
            return array('claimed' => false);
        }
        $claim = bin2hex(random_bytes(24));
        // add_option is atomic through the unique option_name. Uncertain claims require reconciliation.
        if (!add_option($this->reminder_key($id), $claim, '', false)) { return array('claimed' => false, 'pending' => true); }
        $token = $this->get_secure_booking_id($id);
        $lookup = new WP_REST_Request('GET'); $lookup->set_param('id', $id);
        $booking = $this->get_booking_data($lookup);
        $snapshot = is_wp_error($booking) ? '' : hash('sha256', implode('|', array($booking['checkInDate'], $booking['checkOutDate'], $booking['guestEmail'])));
        if ($snapshot !== get_post_meta($id, 'villa_claudia_token_fingerprint', true)) {
            return new WP_Error('booking_changed', 'Booking changed while preparing the reminder.', array('status' => 409));
        }
        return array('claimed' => true, 'claimId' => $claim, 'uploadToken' => $token, 'booking' => $booking);
    }

    public function complete_reminder($request) {
        $id = absint($request->get_param('bookingId')); $claim = $request->get_param('claimId');
        $stored = get_option($this->reminder_key($id));
        $delivered = $request->get_param('delivered');
        if (!is_string($claim) || !is_string($stored) || !hash_equals($stored, $claim) || !is_bool($delivered)) {
            return new WP_Error('invalid_claim', 'Invalid reminder claim.', array('status' => 409));
        }
        if ($delivered) {
            $date = $this->booking_fingerprint($id);
            update_post_meta($id, 'villa_claudia_reminder_sent_for', $date);
            if (get_post_meta($id, 'villa_claudia_reminder_sent_for', true) !== $date) {
                return new WP_Error('reminder_status_failed', 'Could not save reminder state.', array('status' => 500));
            }
        }
        delete_option($this->reminder_key($id));
        return array('success' => true);
    }
}
