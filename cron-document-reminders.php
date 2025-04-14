<?php
/**
 * Villa Claudia Document Reminders Cron Script
 * 
 * This script calls the Next.js API endpoint to process document reminders.
 * Place this file in your Hostinger server and set up a cron job to run it daily.
 */

// Setup logging
$log_dir = __DIR__ . '/logs';
if (!file_exists($log_dir)) {
    mkdir($log_dir, 0755, true);
}
$log_file = $log_dir . '/document-reminders.log';
$timestamp = date('Y-m-d H:i:s');

// Function to log messages
function log_message($message) {
    global $log_file, $timestamp;
    file_put_contents($log_file, "[$timestamp] $message" . PHP_EOL, FILE_APPEND);
    echo $message . PHP_EOL;
}

log_message("====== Document Reminders Cron Started ======");

// Set your environment variables
$api_url = 'https://documents.villa-claudia.eu/api/cron/document-reminders';
$cron_secret = 'n24Wsa9a4Ao8.@gqrJbVT9qs8unKoCrUY7.TWCzA'; // Use the same secret as in your .env.local

log_message("Calling API: $api_url");

// Initialize cURL session
$ch = curl_init($api_url);

// Set cURL options
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $cron_secret,
    'Content-Type: application/json'
]);

// Execute the request
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

// Check for errors
if (curl_errno($ch)) {
    $error = curl_error($ch);
    log_message("cURL error: $error");
    curl_close($ch);
    exit(1);
}

// Close cURL session
curl_close($ch);

// Parse the response
$result = json_decode($response, true);

// Check HTTP status code
if ($http_code != 200) {
    log_message("Error: Received HTTP code $http_code");
    log_message("Response: $response");
    exit(1);
}

// Display results
log_message("Document reminders processed successfully");
log_message("Processed: " . $result['processed'] . " bookings");
log_message("Sent: " . $result['sent'] . " reminders");
log_message("Failed: " . $result['failed'] . " reminders");
log_message("====== Document Reminders Cron Completed ======");

exit(0); 