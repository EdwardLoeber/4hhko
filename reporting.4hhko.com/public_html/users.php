<?php
// Controller: user management — super_admin only.
define('IN_APP', true);
require_once 'auth.php';
if (CURRENT_USER_ROLE !== 'super_admin') {
    header('Location: ' . (CURRENT_USER_ROLE === 'viewer' ? '/saved.php' : '/dashboard.php'));
    exit;
}
require_once 'views/users-view.php';
