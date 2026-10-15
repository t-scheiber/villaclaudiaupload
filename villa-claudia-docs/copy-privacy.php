<?php
if (!defined('ABSPATH')) { exit; }

trait Villa_Claudia_Copy_Privacy {
    private function copy_storage_root() {
        global $wpdb;
        return rtrim(sys_get_temp_dir(), '/\\') . '/villa-claudia-copies-' .
            substr(hash('sha256', ABSPATH . '|' . ($wpdb->prefix ?? '')), 0, 24);
    }

    private function copy_lock($id) {
        global $wpdb;
        $name = 'vc-copy-' . substr(hash('sha256', ABSPATH . '|' . ($wpdb->prefix ?? '') . '|' . absint($id)), 0, 48);
        if ((int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 5)', $name)) !== 1) { return false; }
        // Token resolution can cache metadata before a competing request closes this case.
        wp_cache_delete($id, 'post_meta');
        return $name;
    }

    private function release_copy_lock($name) {
        global $wpdb;
        $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $name));
    }

    private function private_copy_case($id) {
        $case = get_post_meta($id, 'villa_claudia_copy_exception', true);
        return is_array($case) ? $case : array();
    }

    private function copy_lead_name($id) {
        $guest = get_post_meta($id, 'mphb_guest_info', true);
        if (is_array($guest) && isset($guest['first_name'])) {
            return trim($guest['first_name'] . ' ' . ($guest['last_name'] ?? ''));
        }
        return trim(get_post_meta($id, 'mphb_first_name', true) . ' ' . get_post_meta($id, 'mphb_last_name', true));
    }

    private function active_copy_case($id) {
        $case = $this->private_copy_case($id);
        $now = time();
        if (!$this->active_booking($id) || ($case['state'] ?? '') !== 'open' ||
            !is_string($case['case_id'] ?? null) || !preg_match('/\A[a-f0-9]{32}\z/', $case['case_id']) ||
            ($case['fingerprint'] ?? '') !== $this->booking_fingerprint($id) ||
            !is_int($case['arrival_at'] ?? null) || !is_int($case['expires_at'] ?? null) ||
            $case['arrival_at'] > $now || $case['expires_at'] <= $now ||
            $case['expires_at'] > $case['arrival_at'] + 85800 ||
            !is_string($case['traveler_name'] ?? null) || trim($case['traveler_name']) === '' ||
            $case['traveler_name'] !== $this->copy_lead_name($id)) { return false; }
        return $case;
    }

    public function public_copy_exception($id) {
        $case = $this->active_copy_case($id);
        if (!$case) {
            $stored = $this->private_copy_case($id);
            if (($stored['state'] ?? '') === 'open') {
                $lock = $this->copy_lock($id);
                if ($lock) {
                    try {
                        if (!$this->active_copy_case($id)) { $this->erase_copy_case($id, 'expired'); }
                    } finally { $this->release_copy_lock($lock); }
                }
            }
            return array('active' => false, 'expiresAt' => null, 'reason' => '', 'travelerName' => '',
                'caseId' => (string) ($stored['case_id'] ?? ''),
                'hasCopies' => (bool) (glob($this->copy_storage_root() . '/' . absint($id) . '/*') ?: array()));
        }
        return array('active' => true, 'expiresAt' => gmdate('c', $case['expires_at']),
            'reason' => 'The operator has recorded an exceptional difficulty completing registration by inspection. You may instead show your original ID at arrival without disadvantage.',
            'travelerName' => $case['traveler_name'], 'caseId' => $case['case_id'],
            'hasCopies' => $this->has_stored_documents($id));
    }

    // Call only while holding the same booking lock used by uploads.
    private function erase_copy_case($id, $state) {
        $root = $this->copy_storage_root();
        $directory = $root . '/' . absint($id);
        if (is_link($root) || is_link($directory)) { return new WP_Error('copy_cleanup_failed', 'Temporary storage needs administrator review.', array('status' => 500)); }
        $removed = 0;
        foreach (get_post_meta($id, 'villa_claudia_document') as $document) {
            if (!is_array($document) || !is_string($document['filename'] ?? null) || $document['filename'] !== basename($document['filename'])) {
                return new WP_Error('copy_cleanup_failed', 'Document metadata needs administrator review.', array('status' => 500));
            }
            $file = $directory . '/' . $document['filename'];
            if (is_link($file) || (is_file($file) && !unlink($file))) {
                return new WP_Error('copy_cleanup_failed', 'A temporary file could not be removed. Contact Villa Claudia.', array('status' => 500));
            }
            if (!delete_post_meta($id, 'villa_claudia_document', $document)) {
                return new WP_Error('copy_cleanup_failed', 'A temporary document record could not be removed.', array('status' => 500));
            }
            $removed++;
        }
        // Also remove uncommitted temporary files left by an interrupted upload.
        if (is_dir($directory)) {
            foreach (glob($directory . '/*') ?: array() as $file) {
                if (is_link($file) || !is_file($file) || !unlink($file)) {
                    return new WP_Error('copy_cleanup_failed', 'Temporary storage cleanup needs administrator review.', array('status' => 500));
                }
            }
            if (!rmdir($directory)) { return new WP_Error('copy_cleanup_failed', 'Temporary storage cleanup did not complete.', array('status' => 500)); }
        }
        update_post_meta($id, 'villa_claudia_has_documents', false);
        $case = $this->private_copy_case($id);
        if ($case) {
            $case['state'] = $state;
            $case['closed_at'] = time();
            // The retained audit record must not duplicate names or document fields.
            unset($case['traveler_name']);
            update_post_meta($id, 'villa_claudia_copy_exception', $case);
            if (get_post_meta($id, 'villa_claudia_copy_exception', true) !== $case) {
                return new WP_Error('copy_cleanup_failed', 'Copy deletion completed but its audit record needs review.', array('status' => 500));
            }
        }
        return array('success' => true, 'withdrawn' => $state === 'withdrawn', 'deletedCount' => $removed);
    }

    public function withdraw_copy_agreement($request) {
        $id = $this->resolve_upload_booking($request->get_param('uploadToken'));
        if (is_wp_error($id)) { return $id; }
        $lock = $this->copy_lock($id);
        if (!$lock) { return new WP_Error('copy_busy', 'Please retry in a moment.', array('status' => 503)); }
        try {
            $case = $this->private_copy_case($id);
            $case_id = $request->get_param('copyCaseId');
            if (!$case || !is_string($case_id) || !hash_equals((string) ($case['case_id'] ?? ''), $case_id)) {
                return new WP_Error('copy_case_changed', 'The temporary-copy arrangement has changed. Refresh the page.', array('status' => 409));
            }
            return $this->erase_copy_case($id, 'withdrawn');
        } finally { $this->release_copy_lock($lock); }
    }

    public function purge_expired_copies() {
        global $wpdb;
        $ids = $wpdb->get_col("SELECT DISTINCT post_id FROM {$wpdb->postmeta} WHERE meta_key IN ('villa_claudia_copy_exception','villa_claudia_document')");
        $root = $this->copy_storage_root();
        foreach (glob($root . '/*', GLOB_ONLYDIR) ?: array() as $directory) {
            if (ctype_digit(basename($directory))) { $ids[] = (int) basename($directory); }
        }
        $processed = 0; $failed = 0;
        foreach (array_unique(array_map('intval', $ids)) as $id) {
            if ($this->active_copy_case($id)) { continue; }
            $case = $this->private_copy_case($id);
            if (($case['state'] ?? '') !== 'open' && !get_post_meta($id, 'villa_claudia_document') && !is_dir($root . '/' . $id)) { continue; }
            $lock = $this->copy_lock($id);
            if (!$lock) { $failed++; continue; }
            try {
                if ($this->active_copy_case($id)) { continue; }
                $result = $this->erase_copy_case($id, 'expired');
                if (is_wp_error($result)) { $failed++; } else { $processed++; }
            } finally { $this->release_copy_lock($lock); }
        }
        $legacy = $this->reapply_legacy_erasure();
        $failed += $legacy['failed'];
        return array('success' => $failed === 0, 'processed' => $processed, 'failed' => $failed, 'restoredFilesErased' => $legacy['deleted']);
    }

    // A website restore must not silently reintroduce the specifically approved old files.
    private function reapply_legacy_erasure() {
        $result = array('deleted' => 0, 'failed' => 0);
        if (!defined('VILLA_CLAUDIA_ERASURE_RECEIPT')) { return $result; }
        $receipt_path = VILLA_CLAUDIA_ERASURE_RECEIPT;
        if (!is_readable($receipt_path)) { $result['failed']++; return $result; }
        $receipt = json_decode(file_get_contents($receipt_path), true);
        $approved = array();
        foreach (($receipt['approved_orphan_files'] ?? array()) as $item) {
            if (is_string($item['path_hash'] ?? null) && preg_match('/\A[a-f0-9]{64}\z/', $item['path_hash']) && is_int($item['size'] ?? null)) {
                $approved[$item['path_hash']] = $item['size'];
            }
        }
        if (!$approved) { $result['failed']++; return $result; }
        $root = wp_upload_dir()['basedir'] . '/booking-documents';
        if (!is_dir($root) || is_link($root)) { return $result; }
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if (!$file->isFile() || $file->isLink()) { continue; }
            $relative = substr($file->getPathname(), strlen($root) + 1);
            $hash = hash('sha256', str_replace('\\', '/', $relative));
            if (!array_key_exists($hash, $approved)) { continue; }
            if ($file->getSize() !== $approved[$hash] || !unlink($file->getPathname())) { $result['failed']++; }
            else { $result['deleted']++; }
        }
        return $result;
    }

    public function copy_privacy_bootstrap() {
        if (!wp_next_scheduled('villa_claudia_copy_cleanup')) {
            wp_schedule_event(time() + 60, 'vc_five_minutes', 'villa_claudia_copy_cleanup');
        }
    }

    public function copy_exception_admin_menu() {
        add_submenu_page(null, 'Temporary ID-copy exception', 'Temporary ID-copy exception', 'manage_options', 'villa-copy-exception', array($this, 'copy_exception_admin_page'));
    }

    public function copy_exception_meta_box() {
        add_meta_box('villa-copy-exception', 'Guest registration privacy', array($this, 'copy_exception_meta_box_content'), 'mphb_booking', 'side');
    }

    public function copy_exception_meta_box_content($post) {
        echo '<p>Normal registration uses inspection of the original ID. Advance copies are not required.</p><p><a href="' . esc_url(admin_url('admin.php?page=villa-copy-exception&booking_id=' . $post->ID)) . '">Manage a documented temporary-copy exception</a></p>';
        $case = $this->private_copy_case($post->ID);
        if ($case) { echo '<p>Case status: ' . esc_html($case['state'] ?? 'unknown') . '. Copies expire: ' . esc_html(wp_date('Y-m-d H:i T', $case['expires_at'] ?? 0)) . '.</p>'; }
    }

    public function copy_exception_admin_page() {
        if (!current_user_can('manage_options')) { wp_die('Not authorized.', '', array('response' => 403)); }
        $id = absint($_GET['booking_id'] ?? 0);
        $post = get_post($id);
        if (!$post || $post->post_type !== 'mphb_booking') { wp_die('Booking not found.'); }
        $case = $this->private_copy_case($id);
        echo '<div class="wrap"><h1>Temporary ID-copy exception</h1><p>Booking ' . esc_html($id) . '. This is not the routine eVisitor process. The original ID must normally be inspected. Do not use this to require advance copies or collect another adult or child\'s document.</p>';
        if ($case) { echo '<p>Current state: <strong>' . esc_html($case['state'] ?? 'unknown') . '</strong>. Expiry: ' . esc_html(wp_date('Y-m-d H:i T', $case['expires_at'] ?? 0)) . '.</p>'; }
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('villa_copy_case_' . $id);
        echo '<input type="hidden" name="action" value="villa_copy_case"><input type="hidden" name="booking_id" value="' . esc_attr($id) . '">';
        if (!$case || ($case['fingerprint'] ?? '') !== $this->booking_fingerprint($id)) {
            echo '<p><label>Actual arrival, Europe/Zagreb<br><input required type="datetime-local" name="actual_arrival"></label></p><p><label>Objective reason registration cannot be completed by inspection<br><textarea required name="objective_reason" minlength="30" maxlength="1000" rows="4" cols="70"></textarea></label></p><p>Record the real technical or objective difficulty. Convenience or routine remote check-in alone is not an exception. Do not include identity numbers in this note.</p><p><label><input required type="checkbox" name="confirmed_exception" value="yes">I confirm this is an exceptional objective difficulty, and inspection without disadvantage remains available.</label></p><button class="button button-primary" name="operation" value="open">Record exception for the lead adult guest</button>';
        }
        echo '<p><button class="button" name="operation" value="registered">Registration completed: delete temporary copies</button> <button class="button" name="operation" value="withdrawn">Close exception and delete copies</button></p></form><p><a href="' . esc_url(get_edit_post_link($id)) . '">Return to booking</a></p></div>';
    }

    public function handle_copy_exception_admin() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !current_user_can('manage_options')) { wp_die('Not authorized.', '', array('response' => 403)); }
        $id = absint($_POST['booking_id'] ?? 0);
        check_admin_referer('villa_copy_case_' . $id);
        $lock = $this->copy_lock($id);
        if (!$lock) { wp_die('The booking is busy. Retry in a moment.', '', array('response' => 503)); }
        $error = '';
        try {
            $operation = $_POST['operation'] ?? '';
            if (in_array($operation, array('registered', 'withdrawn'), true)) {
                $result = $this->erase_copy_case($id, $operation);
                if (is_wp_error($result)) { $error = $result->get_error_message(); }
            } elseif ($operation === 'open') {
                $previous = $this->private_copy_case($id);
                $arrival_text = sanitize_text_field(wp_unslash($_POST['actual_arrival'] ?? ''));
                $arrival = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $arrival_text, wp_timezone());
                $reason = sanitize_textarea_field(wp_unslash($_POST['objective_reason'] ?? ''));
                $lookup = new WP_REST_Request('GET'); $lookup->set_param('id', $id);
                $booking = $this->get_booking_data($lookup);
                $arrival_date = $arrival ? $arrival->format('Y-m-d') : '';
                $now = time();
                if (!$this->active_booking($id) || is_wp_error($booking) || !$arrival || $arrival->format('Y-m-d\TH:i') !== $arrival_text ||
                    $arrival->getTimestamp() > $now || $arrival->getTimestamp() + 85800 <= $now ||
                    $arrival_date < $booking['checkInDate'] || $arrival_date >= $booking['checkOutDate'] ||
                    trim($booking['guestName']) === '' || $booking['guestName'] === 'Guest' ||
                    strlen($reason) < 30 || strlen($reason) > 1000 || ($_POST['confirmed_exception'] ?? '') !== 'yes' ||
                    ($previous && ($previous['fingerprint'] ?? '') === $this->booking_fingerprint($id))) {
                    $error = 'An exception requires a confirmed booking, its lead adult guest, an actual arrival within the stay and the registration window, and a documented objective reason. A closed case cannot be reopened for the same booking identity.';
                } else {
                    $cleaned = $this->erase_copy_case($id, 'superseded');
                    if (is_wp_error($cleaned)) { $error = $cleaned->get_error_message(); }
                    else {
                        $case = array('case_id' => bin2hex(random_bytes(16)), 'state' => 'open', 'fingerprint' => $this->booking_fingerprint($id),
                            'arrival_at' => $arrival->getTimestamp(), 'expires_at' => $arrival->getTimestamp() + 85800,
                            'created_at' => $now, 'operator_id' => get_current_user_id(), 'objective_reason' => $reason, 'traveler_name' => $booking['guestName']);
                        update_post_meta($id, 'villa_claudia_copy_exception', $case);
                        if (get_post_meta($id, 'villa_claudia_copy_exception', true) !== $case) { $error = 'The exception could not be saved.'; }
                    }
                }
            } else { $error = 'Unknown operation.'; }
        } finally { $this->release_copy_lock($lock); }
        if ($error !== '') { wp_die(esc_html($error), '', array('response' => 400)); }
        wp_safe_redirect(admin_url('admin.php?page=villa-copy-exception&booking_id=' . $id)); exit;
    }
}
