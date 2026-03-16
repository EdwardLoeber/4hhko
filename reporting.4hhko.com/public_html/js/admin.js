/**
 * User management client — super_admin only.
 * Loaded by users-view.php.
 */

'use strict';

const SECTIONS = ['traffic', 'errors', 'engagement'];

// ── Model ─────────────────────────────────────────────────────────────────

async function apiUsers(method, id, body) {
    const url = id ? `/api/users/${id}` : '/api/users';
    const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body:    body ? JSON.stringify(body) : undefined
    });
    if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

// ── View: Table ───────────────────────────────────────────────────────────

function renderUsersTable(users) {
    const wrap = document.getElementById('users-table-wrap');
    if (!users.length) {
        wrap.innerHTML = '<p>No users found.</p>';
        return;
    }

    let html = '<table class="user-table"><thead><tr>' +
        '<th>ID</th><th>Email</th><th>Role</th><th>Sections</th><th>Actions</th>' +
        '</tr></thead><tbody>';

    for (const u of users) {
        const secChecks = SECTIONS.map(s =>
            `<label><input type="checkbox" class="sec-chk" data-uid="${u.id}" data-sec="${s}"${u.sections.includes(s) ? ' checked' : ''}> ${s}</label>`
        ).join('');

        html += `<tr id="row-${u.id}">
            <td>${u.id}</td>
            <td>${escHtml(u.email)}</td>
            <td>
                <select class="role-select" data-uid="${u.id}">
                    <option value="viewer"${u.role==='viewer'?' selected':''}>viewer</option>
                    <option value="analyst"${u.role==='analyst'?' selected':''}>analyst</option>
                    <option value="super_admin"${u.role==='super_admin'?' selected':''}>super_admin</option>
                </select>
            </td>
            <td><div class="section-checks">${secChecks}</div></td>
            <td>
                <button type="button" class="save-btn" data-uid="${u.id}" style="font-size:0.75rem;padding:2px 8px">Save</button>
                <button type="button" class="del-btn" data-uid="${u.id}" style="font-size:0.75rem;padding:2px 8px;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;margin-left:4px">Delete</button>
            </td>
        </tr>`;
    }

    html += '</tbody></table>';
    wrap.innerHTML = html;

    // Wire save buttons
    wrap.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', () => saveUser(btn.dataset.uid));
    });

    // Wire delete buttons
    wrap.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteUser(btn.dataset.uid, btn.closest('tr')));
    });
}

// ── Control ───────────────────────────────────────────────────────────────

async function loadUsers() {
    const wrap = document.getElementById('users-table-wrap');
    try {
        const users = await apiUsers('GET');
        renderUsersTable(users);
    } catch (e) {
        wrap.innerHTML = `<p style="color:red">Failed to load users: ${escHtml(e.message)}</p>`;
    }
}

async function saveUser(uid) {
    const row      = document.getElementById(`row-${uid}`);
    const saveBtn  = row.querySelector('.save-btn');
    const role     = row.querySelector('.role-select').value;
    const sections = [...row.querySelectorAll('.sec-chk:checked')].map(c => c.dataset.sec);
    saveBtn.disabled = true;
    try {
        await apiUsers('PUT', uid, { role, sections });
        flash(saveBtn, 'Saved ✓');
        showTableStatus('');
    } catch (e) {
        flash(saveBtn, 'Error');
        showTableStatus('Save failed: ' + e.message, 'red');
    } finally {
        saveBtn.disabled = false;
    }
}

async function deleteUser(uid, row) {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    const delBtn = row.querySelector('.del-btn');
    delBtn.disabled = true;
    try {
        await apiUsers('DELETE', uid);
        row.remove();
        showTableStatus('');
    } catch (e) {
        delBtn.disabled = false;
        showTableStatus('Delete failed: ' + e.message, 'red');
    }
}

function showTableStatus(msg, color) {
    const el = document.getElementById('table-status-msg');
    if (!el) return;
    el.textContent  = msg;
    el.style.color  = color || '';
}

function flash(btn, text) {
    const orig = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = orig; }, 1800);
}

// ── Add User Form ─────────────────────────────────────────────────────────

document.getElementById('addUserForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const statusEl = document.getElementById('status-msg');
    const email    = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    const role     = document.getElementById('new-role').value;
    const sections = [...document.querySelectorAll('#new-sections input:checked')].map(c => c.value);

    statusEl.textContent = 'Adding...';
    try {
        await apiUsers('POST', null, { email, password, role, sections });
        statusEl.textContent = 'User added successfully.';
        this.reset();
        await loadUsers();
    } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
    }
});

// ── Helpers ───────────────────────────────────────────────────────────────

function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────
loadUsers();
