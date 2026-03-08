<?php
session_start();
if (empty($_SESSION['authenticated'])) {
    header('Location: /login.php');
    exit;
}
