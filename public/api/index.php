<?php
// public/api/index.php

// 1. Allow React to talk to this script
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

$json_input = file_get_contents('php://input');
$data = json_decode($json_input, true);

if (empty($data)) {
    echo json_encode(["status" => "failed", "message" => "No data received"]);
    exit();
}

$to = $data['to'] ?? '';
$subject = $data['subject'] ?? 'Upsun Email Test';
$body = $data['body'] ?? 'No content provided';
$fromName = $data['fromName'] ?? 'Upsun User';

// NEW: Check if the user provided a custom email
$userProvidedEmail = $data['fromEmail'] ?? '';

// Detect default domain
$current_domain = $_SERVER['HTTP_HOST'] ?? 'localhost';
$current_domain = preg_replace('/^www\./', '', $current_domain);
$defaultEmail = "no-reply@" . $current_domain;

// Use user email if valid, otherwise use default
if (filter_var($userProvidedEmail, FILTER_VALIDATE_EMAIL)) {
    $fromEmail = $userProvidedEmail;
} else {
    $fromEmail = $defaultEmail;
}

$headers = "From: " . $fromName . " <" . $fromEmail . ">\r\n";
$headers .= "Reply-To: " . $fromEmail . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";

if (mail($to, $subject, $body, $headers)) {
    echo json_encode([
        "status" => "success", 
        "message" => "Email sent to $to",
        "debug_from" => $fromEmail // Useful to see which email was actually used
    ]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "failed", "message" => "PHP mail() failed"]);
}
?>