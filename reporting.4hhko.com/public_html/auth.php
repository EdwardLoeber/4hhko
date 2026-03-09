<?php
session_name('sid');
session_start();
if (empty($_SESSION['authenticated'])) {
    header('Location: /login.php');
    exit;
}
