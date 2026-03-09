<?php
session_name('sid');
session_start();
session_destroy();
setcookie('sid', '', time() - 3600, '/', '', true, true);
header('Location: /login.php');
exit;
