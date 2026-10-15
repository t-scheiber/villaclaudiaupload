<?php
/** Hostinger CLI job, every five minutes. No personal data or secrets are logged. */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require_once __DIR__ . '/wp-load.php';
if (!isset($villa_claudia_docs) || !method_exists($villa_claudia_docs, 'purge_expired_copies')) {
    fwrite(STDERR, "Privacy cleanup is unavailable.\n"); exit(1);
}
$result = $villa_claudia_docs->purge_expired_copies();
echo wp_json_encode(array('time' => gmdate('c')) + $result) . PHP_EOL;
exit($result['success'] ? 0 : 1);
