<?php
session_name('sid');
session_start();
if (!empty($_SESSION['authenticated'])) {
    $role = $_SESSION['role'] ?? 'viewer';
    header('Location: ' . ($role === 'viewer' ? '/saved.php' : '/dashboard.php'));
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login — 4hhko Analytics</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: system-ui, sans-serif;
            background: #f0f2f5;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.1);
            padding: 40px;
            width: 100%;
            max-width: 380px;
        }
        h1 { font-size: 22px; margin-bottom: 24px; color: #111; }
        label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #444; }
        input[type=email], input[type=password] {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ccc;
            border-radius: 5px;
            font-size: 14px;
            margin-bottom: 16px;
        }
        input:focus { outline: none; border-color: #4a90e2; }
        button {
            width: 100%;
            padding: 11px;
            background: #4a90e2;
            color: #fff;
            border: none;
            border-radius: 5px;
            font-size: 15px;
            cursor: pointer;
        }
        button:hover { background: #357abd; }
        button:disabled { background: #a0b4d0; cursor: not-allowed; }
        .error {
            background: #fdecea;
            color: #c0392b;
            border: 1px solid #e74c3c;
            border-radius: 5px;
            padding: 10px 12px;
            font-size: 13px;
            margin-bottom: 16px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>4hhko Analytics</h1>
        <div class="error" id="errorMsg"></div>
        <form id="loginForm">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" autocomplete="username" required>
            <label for="password">Password</label>
            <input type="password" id="password" name="password" autocomplete="current-password" required>
            <button type="submit" id="submitBtn">Sign In</button>
        </form>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const btn     = document.getElementById('submitBtn');
            const errorEl = document.getElementById('errorMsg');
            errorEl.style.display = 'none';
            btn.disabled  = true;
            btn.textContent = 'Signing in...';

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        email:    document.getElementById('email').value,
                        password: document.getElementById('password').value
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    window.location.href = data.role === 'viewer' ? '/saved.php' : '/dashboard.php';
                } else {
                    const data = await res.json();
                    errorEl.textContent  = data.error || 'Login failed.';
                    errorEl.style.display = 'block';
                    btn.disabled    = false;
                    btn.textContent = 'Sign In';
                }
            } catch (err) {
                errorEl.textContent  = 'Network error. Please try again.';
                errorEl.style.display = 'block';
                btn.disabled    = false;
                btn.textContent = 'Sign In';
            }
        });
    </script>
</body>
</html>
