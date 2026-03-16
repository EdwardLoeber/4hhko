<?php
// Shared nav partial. Requires: IN_APP defined, CURRENT_USER_ROLE, CURRENT_USER_EMAIL.
// $__navActive: string matching the current page's controller filename (e.g. 'dashboard.php').
if (!defined('IN_APP')) { http_response_code(403); exit; }
$__role  = CURRENT_USER_ROLE;
$__email = CURRENT_USER_EMAIL;
function __navLink(string $href, string $label, string $active): string {
    $current = (basename($href) === $active) ? ' aria-current="page"' : '';
    return "<li><a href=\"{$href}\"{$current}>" . htmlspecialchars($label) . "</a></li>";
}
?>
<header>
    <nav>
        <ul>
            <li><strong><a href="<?= $__role === 'viewer' ? '/saved.php' : '/dashboard.php' ?>" style="text-decoration:none;color:inherit">4hhko Analytics</a></strong></li>
            <?= __navLink('/dashboard.php', 'Dashboard',      $__navActive ?? '') ?>
            <?= __navLink('/insights.php',  'Insights',       $__navActive ?? '') ?>
            <?= __navLink('/saved.php',     'Saved Reports',  $__navActive ?? '') ?>
            <?php if ($__role === 'super_admin'): ?>
            <?= __navLink('/users.php',     'Users',          $__navActive ?? '') ?>
            <?php endif; ?>
        </ul>
        <ul>
            <?php if ($__email): ?>
            <li><span class="nav-user"><?= htmlspecialchars($__email) ?></span></li>
            <?php else: ?>
            <li><small class="nav-user"><?= htmlspecialchars($__role) ?></small></li>
            <?php endif; ?>
            <li><a href="/logout.php">Logout</a></li>
        </ul>
    </nav>
</header>
