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
        :root { font-size: 14px; }
        body { padding: 0; }

        header { padding: 0.5rem 1rem; border-bottom: 1px solid var(--pico-muted-border-color); }
        header nav { display: flex; justify-content: space-between; align-items: center; }
        header nav ul { margin: 0; padding: 0; list-style: none; display: flex; gap: 0.75rem; align-items: center; }
        header nav ul li a { color: inherit; font-size: 0.85rem; text-decoration: none; }
        header nav ul li a:hover { color: var(--pico-primary); }
        header nav ul li a[aria-current="page"] { font-weight: 700; color: var(--pico-primary); border-bottom: 2px solid var(--pico-primary); }
        header nav strong { font-size: 0.95rem; }
        .nav-user { font-size: 0.78rem; padding: 0.15rem 0.55rem; background: var(--pico-muted-border-color); border-radius: 4px; color: var(--pico-muted-color); }

        main { padding: 0.75rem 1rem; }

        .badge {
            display: inline-block;
            font-size: 0.7rem;
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

        .report-list { display: flex; flex-direction: column; gap: 0.5rem; }

        .report-entry {
            display: flex;
            align-items: baseline;
            gap: 0.6rem;
            padding: 0.5rem 0.75rem;
            background: var(--pico-card-background-color);
            border-radius: var(--pico-border-radius);
            box-shadow: var(--pico-card-box-shadow);
            font-size: 0.8rem;
        }
        .report-entry .meta { color: var(--pico-muted-color); font-size: 0.72rem; white-space: nowrap; }
        .report-entry .body { flex: 1; color: var(--pico-color); white-space: pre-wrap; word-break: break-word; }
        .report-entry .actions { display: flex; gap: 0.4rem; align-items: center; flex-shrink: 0; }
        .report-entry a { font-size: 0.75rem; }
        .del-saved-btn {
            font-size: 0.72rem; padding: 2px 8px;
            background: #e74c3c; color: #fff;
            border: none; border-radius: 4px; cursor: pointer;
        }
        .status-msg { color: var(--pico-muted-color); font-size: 0.8rem; }
    </style>
</head>
<body>

<?php $__navActive = 'saved.php'; require __DIR__ . '/_nav.php'; ?>

<main>
    <p class="status-msg" style="margin-bottom:0.5rem">Most recent <?= $role === 'super_admin' ? '— you can delete any entry' : '' ?> (up to 10 total)</p>
    <div id="report-list" class="report-list">
        <p class="status-msg">Loading...</p>
    </div>
</main>

<script>
(async function () {
    const list = document.getElementById('report-list');
    try {
        const res  = await fetch('/api/saved', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const rows = await res.json();

        if (!rows.length) {
            list.innerHTML = '<p class="status-msg">No saved reports yet.</p>';
            return;
        }

        list.innerHTML = rows.map(row => {
            const date       = new Date(row.updated_at).toLocaleString();
            const cat        = escHtml(row.category);
            const exportLink = row.export_url
                ? `<a href="${escHtml(row.export_url)}" target="_blank">Download</a>`
                : '';
            const canDelete  = <?= json_encode($role === 'super_admin' || $role === 'analyst') ?>;
            const delBtn     = canDelete
                ? `<button class="del-saved-btn" onclick="deleteSaved(${row.id}, this)">Delete</button>`
                : '';
            return `<div class="report-entry" id="saved-${row.id}">
                <span class="badge badge-${cat}">${cat}</span>
                <span class="meta">${escHtml(row.email)} &mdash; ${escHtml(date)}</span>
                ${row.comment ? `<span class="body">${escHtml(row.comment)}</span>` : ''}
                <span class="actions">${exportLink}${delBtn}</span>
            </div>`;
        }).join('');

    } catch (e) {
        list.innerHTML = '<p style="color:red">Failed to load: ' + escHtml(e.message) + '</p>';
    }

    window.deleteSaved = async function deleteSaved(id, btn) {
        if (!confirm('Delete this entry?')) return;
        btn.disabled = true;
        try {
            const res = await fetch(`/api/saved/${id}`, {
                method: 'POST', credentials: 'same-origin',
                headers: { 'X-HTTP-Method-Override': 'DELETE', 'Content-Type': 'application/json' },
                body: '{}'
            });
            if (res.status === 204 || res.ok) {
                document.getElementById('saved-' + id)?.remove();
            } else {
                const d = await res.json().catch(() => ({}));
                alert('Delete failed: ' + (d.error || res.status));
                btn.disabled = false;
            }
        } catch (e) {
            alert('Delete failed: ' + e.message);
            btn.disabled = false;
        }
    }

    function escHtml(s) {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})();
</script>
</body>
</html>
