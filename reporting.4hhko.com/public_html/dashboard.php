<?php
// Controller: authenticate, then delegate entirely to the view.
define('IN_APP', true);
require_once 'auth.php';
if (CURRENT_USER_ROLE === 'viewer') {
    header('Location: /saved.php');
    exit;
}
require_once 'views/dashboard-view.php';
