<?php
define('IN_APP', true);
require_once 'auth.php';
if (CURRENT_USER_ROLE === 'viewer') { header('Location: /saved.php'); exit; }
require_once 'views/insights-view.php';
