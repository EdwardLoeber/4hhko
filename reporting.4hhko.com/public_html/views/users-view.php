<?php
// View: user management — super_admin only.
if (!defined('IN_APP')) { http_response_code(403); exit; }
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management — 4hhko Analytics</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.classless.min.css">
    <style>
        header nav { display: flex; justify-content: space-between; align-items: center; }
        header nav ul { margin: 0; padding: 0; list-style: none; display: flex; gap: 1rem; align-items: center; }
        header nav ul li a { color: inherit; }

        .user-table { width: 100%; font-size: 0.875rem; }
        .user-table th { white-space: nowrap; }
        .user-table td { vertical-align: middle; }
        .user-table select { margin: 0; padding: 0.2rem 0.5rem; font-size: 0.8rem; }
        .user-table button { margin: 0; padding: 0.25rem 0.65rem; font-size: 0.8rem; }
        .section-checks label { display: inline-flex; align-items: center; gap: 0.2rem; margin-right: 0.5rem; font-size: 0.8rem; }
        .section-checks input { margin: 0; }

        .add-user-form { margin-top: 2rem; }
        .add-user-form fieldset { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        @media (max-width: 600px) { .add-user-form fieldset { grid-template-columns: 1fr; } }

        #status-msg { font-size: 0.85rem; color: var(--pico-muted-color); margin-top: 0.5rem; }
    </style>
</head>
<body>

<header>
    <nav>
        <ul><li><strong>4hhko Analytics</strong></li></ul>
        <ul>
            <li><a href="/dashboard.php">Dashboard</a></li>
            <li><small>super_admin</small></li>
            <li><a href="/logout.php">Logout</a></li>
        </ul>
    </nav>
</header>

<main>
    <h2>User Management</h2>

    <div id="users-table-wrap">
        <p>Loading users...</p>
    </div>

    <div class="add-user-form">
        <h3>Add New User</h3>
        <form id="addUserForm">
            <fieldset>
                <label>Email<input type="email" id="new-email" required placeholder="user@example.com"></label>
                <label>Password<input type="password" id="new-password" required placeholder="min 8 chars"></label>
                <label>Role
                    <select id="new-role">
                        <option value="viewer">viewer</option>
                        <option value="analyst">analyst</option>
                        <option value="super_admin">super_admin</option>
                    </select>
                </label>
                <label>Sections (analyst only)
                    <div class="section-checks" id="new-sections">
                        <label><input type="checkbox" value="traffic"> traffic</label>
                        <label><input type="checkbox" value="errors"> errors</label>
                        <label><input type="checkbox" value="engagement"> engagement</label>
                    </div>
                </label>
            </fieldset>
            <button type="submit">Add User</button>
        </form>
        <p id="status-msg"></p>
    </div>
</main>

<script src="/js/admin.js"></script>
</body>
</html>
