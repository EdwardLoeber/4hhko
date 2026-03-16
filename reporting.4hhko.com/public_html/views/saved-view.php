<?php
// View: saved analyst comments — read-only, for all authenticated users.
if (!defined('IN_APP')) { http_response_code(403); exit; }
$role = CURRENT_USER_ROLE;
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Saved Reports — 4hhko Analytics</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.classless.min.css">
    <style>
        header nav { display: flex; justify-content: space-between; align-items: center; }
        header nav ul { margin: 0; padding: 0; list-style: none; display: flex; gap: 1rem; align-items: center; }
        header nav ul li a { color: inherit; }

        .badge {
            display: inline-block;
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 2px 8px;
            border-radius: 999px;
            color: #fff;
        }
        .badge-traffic    { background: #4a90e2; }
        .badge-errors     { background: #e74c3c; }
        .badge-engagement { background: #27ae60; }

        .comment-card { border-left: 4px solid var(--pico-muted-border-color); padding: 0.75rem 1rem; margin-bottom: 1rem; }
        .comment-card.traffic    { border-color: #4a90e2; }
        .comment-card.errors     { border-color: #e74c3c; }
        .comment-card.engagement { border-color: #27ae60; }

        .comment-meta { font-size: 0.78rem; color: var(--pico-muted-color); margin-bottom: 0.25rem; }
        .comment-body { white-space: pre-wrap; font-size: 0.9rem; }
        .empty-msg { color: var(--pico-muted-color); }

        <?php if ($role !== 'viewer'): ?>
        .nav-link { font-size: 0.9rem; }
        <?php endif; ?>
    </style>
</head>
<body>

<header>
    <nav>
        <ul><li><strong>4hhko Analytics</strong></li></ul>
        <ul>
            <?php if ($role !== 'viewer'): ?>
            <li><a href="/dashboard.php" class="nav-link">Dashboard</a></li>
            <?php endif; ?>
            <?php if ($role === 'super_admin'): ?>
            <li><a href="/users.php" class="nav-link">Users</a></li>
            <?php endif; ?>
            <li><small><?= htmlspecialchars($role) ?></small></li>
            <li><a href="/logout.php">Logout</a></li>
        </ul>
    </nav>
</header>

<main>
    <h2>Saved Reports</h2>
    <p>Analyst comments published across all report categories.</p>

    <div id="comments-container">
        <p class="empty-msg">Loading...</p>
    </div>
</main>

<script>
(async function () {
    const container = document.getElementById('comments-container');
    try {
        const res  = await fetch('/api/saved', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const rows = await res.json();

        if (!rows.length) {
            container.innerHTML = '<p class="empty-msg">No analyst comments have been saved yet.</p>';
            return;
        }

        const categoryOrder = ['traffic', 'errors', 'engagement'];
        const grouped = {};
        for (const r of rows) {
            if (!grouped[r.category]) grouped[r.category] = [];
            grouped[r.category].push(r);
        }

        let html = '';
        for (const cat of categoryOrder) {
            if (!grouped[cat]) continue;
            html += `<h3><span class="badge badge-${cat}">${cat}</span></h3>`;
            for (const row of grouped[cat]) {
                const date = new Date(row.updated_at).toLocaleString();
                html += `
                    <div class="comment-card ${cat}">
                        <div class="comment-meta">${escHtml(row.email)} &mdash; ${escHtml(date)}</div>
                        <div class="comment-body">${escHtml(row.comment)}</div>
                    </div>`;
            }
        }
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p style="color:red">Failed to load comments: ' + escHtml(e.message) + '</p>';
    }

    function escHtml(s) {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
</script>
</body>
</html>
