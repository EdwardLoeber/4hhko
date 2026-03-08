<?php
header('Content-Type: application/json');

// If a valid session cookie already exists, return it as-is
if (!empty($_COOKIE['user_id'])) {
    echo json_encode(['session' => $_COOKIE['user_id']]);
    exit;
}

// Generate a cryptographically secure session ID
$session_id = bin2hex(random_bytes(16));

// Set the cookie:
//   expires  => 0        : session cookie — deleted when browser closes
//   path     => '/'      : available to all pages on this domain
//   secure   => true     : HTTPS only
//   httponly => true     : not readable by JS (protects against XSS theft)
//   samesite => 'Lax'   : sent on same-site requests + top-level navigations
setcookie('user_id', $session_id, [
    'expires'  => 0,
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax'
]);

echo json_encode(['session' => $session_id]);
