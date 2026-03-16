<?php
session_name('sid');
session_start();
if (empty($_SESSION['authenticated'])) {
    header('Location: /login.php');
    exit;
}
define('CURRENT_USER_ID',       (int)($_SESSION['user_id'] ?? 0));
define('CURRENT_USER_ROLE',     $_SESSION['role'] ?? 'viewer');
define('CURRENT_USER_EMAIL',    $_SESSION['email'] ?? '');
define('CURRENT_USER_SECTIONS', $_SESSION['sections'] ?? []);

function canSeeSection(string $section): bool {
    if (CURRENT_USER_ROLE === 'super_admin') return true;
    $secs = CURRENT_USER_SECTIONS;
    // Analysts with no sections assigned default to seeing all sections.
    // Viewers must have sections explicitly assigned; empty = no access.
    if (empty($secs)) return CURRENT_USER_ROLE !== 'viewer';
    return in_array($section, $secs, true);
}
