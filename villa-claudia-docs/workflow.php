<?php
if (!defined('ABSPATH')) { exit; }
require_once __DIR__ . '/copy-privacy.php';

trait Villa_Claudia_Workflow {
    use Villa_Claudia_Copy_Privacy;
    private function booking_fingerprint($id) {
        return hash('sha256', implode('|', array(
            get_post_meta($id, 'mphb_check_in_date', true),
            get_post_meta($id, 'mphb_check_out_date', true),
            get_post_meta($id, 'mphb_email', true),
        )));
    }

    private function get_secure_booking_id($id) {
        global $wpdb;
        $site = (defined('DB_NAME') ? DB_NAME : '') . '|' . ($wpdb->prefix ?? '');
        $lock = 'vc-token-' . substr(hash('sha256', $site . '|' . absint($id)), 0, 48);
        if ((int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 5)', $lock)) !== 1) {
            return new WP_Error('token_busy', 'The upload link is being updated. Refresh and try again.', array('status' => 503));
        }
        try {
        // Another request may have issued the token while this request waited.
        wp_cache_delete($id, 'post_meta');
        $token = get_post_meta($id, 'villa_claudia_secure_id', true);
        $fingerprint = $this->booking_fingerprint($id);
        if (!is_string($token) || !preg_match('/\Avc_[a-f0-9]{64}\z/', $token) ||
            get_post_meta($id, 'villa_claudia_token_fingerprint', true) !== $fingerprint) {
            $token = 'vc_' . bin2hex(random_bytes(32));
            update_post_meta($id, 'villa_claudia_secure_id', $token);
            update_post_meta($id, 'villa_claudia_token_fingerprint', $fingerprint);
        }
        if (get_post_meta($id, 'villa_claudia_secure_id', true) !== $token ||
            get_post_meta($id, 'villa_claudia_token_fingerprint', true) !== $fingerprint) {
            return new WP_Error('token_failed', 'The upload link could not be saved. Refresh and try again.', array('status' => 503));
        }
        return $token;
        } finally {
            $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
        }
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
        if (!$this->active_copy_case($id)) { return false; }
        $base = $this->copy_storage_root() . '/' . absint($id);
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

    private function send_verified_documents($id, $recipient, $subject, $message) {
        return new WP_Error('copy_forwarding_disabled', 'Identity copies are not sent by email. Complete registration in eVisitor and delete the temporary copy.', array('status' => 403));
    }

    private function remove_stored_document($id, $filename) {
        foreach (get_post_meta($id, 'villa_claudia_document') as $document) {
            if (!is_array($document) || ($document['filename'] ?? '') !== $filename) { continue; }
            $path = $this->document_path($id, $filename);
            if ($path && !unlink($path)) {
                return new WP_Error('delete_failed', 'The document file could not be deleted. Please retry.', array('status' => 500));
            }
            // Delete only this exact record. A concurrent upload must keep its metadata.
            if (!delete_post_meta($id, 'villa_claudia_document', $document)) {
                return new WP_Error('delete_failed', 'The document record changed or could not be deleted. Refresh and retry.', array('status' => 409));
            }
            update_post_meta($id, 'villa_claudia_has_documents', $this->has_stored_documents($id));
            return true;
        }
        return new WP_Error('document_not_found', 'Document not found.', array('status' => 404));
    }

    public function handle_document_upload($request) {
        $id = $this->resolve_upload_booking($request->get_param('uploadToken'));
        if (is_wp_error($id)) { return $id; }
        $lock = $this->copy_lock($id);
        if (!$lock) { return new WP_Error('copy_busy', 'Please retry in a moment.', array('status' => 503)); }
        try {
        $case = $this->active_copy_case($id);
        if (!$case || $request->get_param('copyCaseId') !== $case['case_id']) {
            return new WP_Error('copy_not_authorized', 'Copies are only accepted for an active documented exception. Show your original ID at arrival instead.', array('status' => 403));
        }
        if (!in_array($request->get_param('copyAgreement'), array(true, 'true'), true)) {
            return new WP_Error('copy_agreement_required', 'Specific optional agreement is required. Original-document inspection remains available.', array('status' => 400));
        }
        if ($this->has_stored_documents($id)) {
            return new WP_Error('copy_already_stored', 'Your temporary copy is already saved. Do not upload it again.', array('status' => 409));
        }
        $files = $request->get_file_params();
        if (count($files) !== 1) {
            return new WP_Error('invalid_files', 'Upload one file containing only your own adult identity document.', array('status' => 400));
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
            $traveler_name = is_array($info) && is_string($info['travelerName'] ?? null) ? sanitize_text_field($info['travelerName']) : '';
            if ($size < 1 || $size > 10 * 1024 * 1024 || $total > 25 * 1024 * 1024 || !isset($allowed[$mime]) ||
                !is_array($info) || !is_string($info['travelerName'] ?? null) || trim($info['travelerName']) === '' ||
                trim($traveler_name) === '' || $traveler_name !== $case['traveler_name'] ||
                !preg_match('/\A.{1,200}\z/us', $info['travelerName']) ||
                !is_string($info['documentType'] ?? null) || !in_array($info['documentType'], array('passport', 'id_card'), true)) {
                return new WP_Error('invalid_file', 'Invalid document or metadata. Use JPEG, PNG or PDF within the size limits.', array('status' => 400));
            }
            $validated[] = array('tmp' => $file['tmp_name'], 'size' => $size, 'type' => $mime,
                'filename' => bin2hex(random_bytes(24)) . '.' . $allowed[$mime],
                'original_name' => 'identity-document.' . $allowed[$mime],
                'traveler_name' => $traveler_name,
                'document_type' => $info['documentType'], 'document_number' => '');
        }
        $root = $this->copy_storage_root();
        $directory = $root . '/' . $id;
        if (is_link($root) || is_link($directory) || !wp_mkdir_p($directory) || !chmod($root, 0700) || !chmod($directory, 0700)) {
            return new WP_Error('storage_unavailable', 'Protected storage is unavailable.', array('status' => 500));
        }
        $paths = array(); $meta_ids = array();
        try {
            foreach ($validated as $file) {
                if (!$this->active_copy_case($id)) { throw new RuntimeException('The exception expired.'); }
                $path = $directory . '/' . $file['filename'];
                if (!move_uploaded_file($file['tmp'], $path)) { throw new RuntimeException('File storage failed.'); }
                $paths[] = $path;
                if (!chmod($path, 0600)) { throw new RuntimeException('File protection failed.'); }
                unset($file['tmp']);
                $file['uploaded_at'] = current_time('mysql'); $file['status'] = 'pending';
                $file['copy_expires_at'] = $case['expires_at']; $file['copy_case_id'] = $case['case_id'];
                $meta_id = add_post_meta($id, 'villa_claudia_document', $file);
                if (!$meta_id) { throw new RuntimeException('Metadata storage failed.'); }
                $meta_ids[] = $meta_id;
            }
            update_post_meta($id, 'villa_claudia_has_documents', true);
            if (!get_post_meta($id, 'villa_claudia_has_documents', true)) { throw new RuntimeException('Document status storage failed.'); }
            if (!$this->active_copy_case($id)) { throw new RuntimeException('The exception expired during storage.'); }
            $case['agreed_at'] = time();
            update_post_meta($id, 'villa_claudia_copy_exception', $case);
            if (get_post_meta($id, 'villa_claudia_copy_exception', true) !== $case) { throw new RuntimeException('Agreement audit storage failed.'); }
            if (!$this->active_copy_case($id)) { throw new RuntimeException('The exception expired before storage completed.'); }
        } catch (Throwable $error) {
            foreach ($meta_ids as $meta_id) { delete_metadata_by_mid('post', $meta_id); }
            foreach ($paths as $path) { wp_delete_file($path); }
            update_post_meta($id, 'villa_claudia_has_documents', $this->has_stored_documents($id));
            return new WP_Error('storage_failed', 'Documents were not saved. Please try again.', array('status' => 500));
        }
        return array('success' => true, 'storedCount' => count($paths), 'bookingId' => $id);
        } finally { $this->release_copy_lock($lock); }
    }

    private function reminder_key($id) {
        return 'vc_reminder_' . absint($id) . '_' . substr($this->booking_fingerprint($id), 0, 32);
    }

    public function claim_reminder($request) {
        $id = absint($request->get_param('bookingId'));
        $claimed_fingerprint = $this->booking_fingerprint($id);
        $checkin = get_post_meta($id, 'mphb_check_in_date', true);
        $today = new DateTimeImmutable('today', wp_timezone());
        if (!$this->active_booking($id) || $this->has_stored_documents($id) || !is_email(get_post_meta($id, 'mphb_email', true)) ||
            $checkin < $today->format('Y-m-d') || $checkin > $today->modify('+7 days')->format('Y-m-d') ||
            get_post_meta($id, 'villa_claudia_reminder_sent_for', true) === $this->booking_fingerprint($id)) {
            return array('claimed' => false);
        }
        $claim = bin2hex(random_bytes(24));
        // add_option is atomic through the unique option_name. Uncertain claims require reconciliation.
        $claim_key = 'vc_reminder_' . $id . '_' . substr($claimed_fingerprint, 0, 32);
        if (!add_option($claim_key, $claim, '', false)) { return array('claimed' => false, 'pending' => true); }
        $token = $this->get_secure_booking_id($id);
        if (is_wp_error($token)) {
            if (get_option($claim_key) === $claim) { delete_option($claim_key); }
            return $token;
        }
        $lookup = new WP_REST_Request('GET'); $lookup->set_param('id', $id);
        $booking = $this->get_booking_data($lookup);
        $snapshot = is_wp_error($booking) ? '' : hash('sha256', implode('|', array($booking['checkInDate'], $booking['checkOutDate'], $booking['guestEmail'])));
        if ($snapshot !== $claimed_fingerprint || $snapshot !== get_post_meta($id, 'villa_claudia_token_fingerprint', true)) {
            if (get_option($claim_key) === $claim) { delete_option($claim_key); }
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
