<?php
// public/api/index.php

// 1. Allow React to talk to this script
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Handle "Pre-flight" request (browser security check)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Read the JSON data sent by your React Form
$json_input = file_get_contents('php://input');
$data = json_decode($json_input, true);

// 3. Check if we received data
if (empty($data)) {
    echo json_encode(["status" => "failed", "message" => "No data received"]);
    exit();
}

// 4. Extract variables from the React data
$to = $data['to'] ?? '';
$subject = $data['subject'] ?? 'Upsun Email Test';
$body = $data['body'] ?? 'No content provided';
$fromName = $data['fromName'] ?? 'Upsun User';

// 5. Detect Upsun Domain for the "From" address (Crucial for delivery)
$current_domain = $_SERVER['HTTP_HOST'] ?? 'localhost';
$current_domain = preg_replace('/^www\./', '', $current_domain);
$fromEmail = "no-reply@" . $current_domain;

// 6. Build Headers
$headers = "From: " . $fromName . " <" . $fromEmail . ">\r\n";
$headers .= "Reply-To: " . $fromEmail . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";

// 7. Send the Email
if (mail($to, $subject, $body, $headers)) {
    echo json_encode(["status" => "success", "message" => "Email sent to $to"]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "failed", "message" => "PHP mail() failed"]);
}
?>