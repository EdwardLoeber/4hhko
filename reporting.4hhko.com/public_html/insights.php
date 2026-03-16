<?php
define('IN_APP', true);
require_once 'auth.php';
if (!canSeeSection('insights')) {
    header('Location: /dashboard.php');
    exit;
}
require_once 'views/insights-view.php';
