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
        main { padding: 0.75rem 1rem; max-width: 960px; }
        h2 { font-size: 1rem; margin-bottom: 0.5rem; }
        h3 { font-size: 0.875rem; margin: 0.75rem 0 0.4rem; }

        /* Users table */
        .user-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .user-table th { padding: 4px 8px; border-bottom: 1px solid var(--pico-muted-border-color); text-align: left; white-space: nowrap; font-size: 0.75rem; background: var(--pico-card-background-color); }
        .user-table td { padding: 4px 8px; border-bottom: 1px solid var(--pico-muted-border-color); vertical-align: middle; }
        .user-table select { margin: 0; padding: 2px 4px; font-size: 0.75rem; height: auto; }
        .user-table button { margin: 0; padding: 2px 8px; font-size: 0.75rem; }
        .section-checks { display: flex; flex-wrap: wrap; gap: 0.3rem; }
        .section-checks label { display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.75rem; margin: 0; }
        .section-checks input[type=checkbox] { margin: 0; width: 12px; height: 12px; }

        /* Add user form */
        .add-form { margin-top: 1rem; padding: 0.75rem; background: var(--pico-card-background-color); border-radius: var(--pico-border-radius); box-shadow: var(--pico-card-box-shadow); }
        .add-form fieldset { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.5rem; padding: 0; border: none; margin: 0 0 0.5rem; }
        @media (max-width: 700px) { .add-form fieldset { grid-template-columns: 1fr 1fr; } }
        .add-form label { font-size: 0.75rem; font-weight: 600; display: block; }
        .add-form input, .add-form select { font-size: 0.78rem; padding: 0.25rem 0.4rem; margin-top: 0.15rem; width: 100%; height: auto; }
        .add-form button[type=submit] { font-size: 0.78rem; padding: 0.3rem 0.9rem; }
        #status-msg { font-size: 0.75rem; color: var(--pico-muted-color); margin: 0.3rem 0 0; }
    </style>
</head>
<body>

<?php $__navActive = 'users.php'; require __DIR__ . '/_nav.php'; ?>

<main>
    <h2>User Management</h2>

    <p id="table-status-msg" style="font-size:0.75rem;margin:0 0 0.4rem;min-height:1em"></p>
    <div style="overflow-x:auto">
        <div id="users-table-wrap"><p>Loading users...</p></div>
    </div>

    <div class="add-form">
        <h3>Add New User</h3>
        <form id="addUserForm">
            <fieldset>
                <label>Email<input type="email" id="new-email" required placeholder="user@example.com"></label>
                <label>Password<input type="password" id="new-password" required placeholder="password"></label>
                <label>Role
                    <select id="new-role">
                        <option value="viewer">viewer</option>
                        <option value="analyst">analyst</option>
                        <option value="super_admin">super_admin</option>
                    </select>
                </label>
                <label>Sections
                    <div class="section-checks" id="new-sections" style="margin-top:0.25rem">
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
