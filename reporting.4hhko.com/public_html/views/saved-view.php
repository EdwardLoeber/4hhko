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
        header { padding: 0.5rem 1rem; border-bottom: 1px solid var(--pico-muted-border-color); }
        header nav { display: flex; justify-content: space-between; align-items: center; }
        header nav ul { margin: 0; padding: 0; list-style: none; display: flex; gap: 0.75rem; align-items: center; }
        header nav ul li a { color: inherit; font-size: 0.85rem; text-decoration: none; }
        header nav ul li a:hover { color: var(--pico-primary); }
        header nav ul li a[aria-current="page"] { font-weight: 700; color: var(--pico-primary); border-bottom: 2px solid var(--pico-primary); }
        header nav strong { font-size: 0.95rem; }
        .nav-user { font-size: 0.78rem; padding: 0.15rem 0.55rem; background: var(--pico-muted-border-color); border-radius: 4px; color: var(--pico-muted-color); }

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
        .badge-insights   { background: #9b59b6; }

        .comment-card { border-left: 4px solid var(--pico-muted-border-color); padding: 0.75rem 1rem; margin-bottom: 1rem; }
        .comment-card.traffic    { border-color: #4a90e2; }
        .comment-card.errors     { border-color: #e74c3c; }
        .comment-card.engagement { border-color: #27ae60; }
        .comment-card.insights   { border-color: #9b59b6; }

        .comment-meta { font-size: 0.78rem; color: var(--pico-muted-color); margin-bottom: 0.25rem; }
        .comment-body { white-space: pre-wrap; font-size: 0.9rem; }
        .empty-msg { color: var(--pico-muted-color); }

    </style>
</head>
<body>

<?php $__navActive = 'saved.php'; require __DIR__ . '/_nav.php'; ?>

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

        const categoryOrder = ['traffic', 'errors', 'engagement', 'insights'];
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
                const exportLink = row.export_url
                    ? ` &nbsp;<a href="${escHtml(row.export_url)}" target="_blank" style="font-size:0.78rem">Download Report</a>`
                    : '';
                html += `
                    <div class="comment-card ${cat}">
                        <div class="comment-meta">${escHtml(row.email)} &mdash; ${escHtml(date)}${exportLink}</div>
                        ${row.comment ? `<div class="comment-body">${escHtml(row.comment)}</div>` : ''}
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
