/**
 * Client layer for the analytics dashboard (report-centric).
 *
 * Model   — fetchReport(), fetchComments(), saveComment(), exportReport()
 * View    — renderTables(), renderCharts(), renderCommentBox()
 * Control — loadReport(), initTabs(), initCommentBox(), initExportBtn(), init()
 */

'use strict';

// ── Model ─────────────────────────────────────────────────────────────────

async function fetchReport(category) {
    const res = await fetch(`/api/reports/${category}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function fetchComments() {
    const res = await fetch('/api/comments', { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function saveComment(category, text) {
    const res = await fetch('/api/comments', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ category, comment: text })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function exportReport(category) {
    const btn  = document.getElementById(`export-btn-${category}`);
    const link = document.getElementById(`export-link-${category}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Exporting...'; }
    try {
        const res = await fetch(`/export.php?category=${encodeURIComponent(category)}`, {
            credentials: 'same-origin'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (link) {
            link.href          = data.url;
            link.textContent   = 'Open Export';
            link.style.display = 'inline';
        }
    } catch (e) {
        alert('Export failed: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Export PDF'; }
    }
}

// ── View: Tables ──────────────────────────────────────────────────────────

function buildTable(rows) {
    if (!rows || !rows.length) return '<p class="status-msg">No data.</p>';
    const cols = Object.keys(rows[0]);
    let html = '<table><thead><tr>' +
        cols.map(c => `<th>${escHtml(c)}</th>`).join('') +
        '</tr></thead><tbody>';
    for (const row of rows) {
        html += '<tr>' + cols.map(c => {
            const v       = row[c];
            const display = (v !== null && typeof v === 'object') ? JSON.stringify(v) : (v ?? '');
            const esc     = escHtml(String(display));
            const title   = String(display).replace(/"/g, '&quot;');
            return `<td title="${title}">${esc}</td>`;
        }).join('') + '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

// Special table for activity_events: each row's `events` JSON array is
// summarised as counts per type rather than shown as a raw blob.
function buildActivityTable(rows) {
    if (!rows.length) return '<p class="status-msg">No data.</p>';
    let html = '<table><thead><tr>' +
        '<th>ID</th><th>Session</th><th>URL</th><th>Timestamp</th>' +
        '<th>Batched</th><th>click</th><th>scroll</th><th>mousemove</th>' +
        '<th>keydown</th><th>keyup</th><th>idle</th>' +
        '</tr></thead><tbody>';
    for (const row of rows) {
        let evts = row.events;
        if (typeof evts === 'string') { try { evts = JSON.parse(evts); } catch (_) { evts = []; } }
        if (!Array.isArray(evts)) evts = [];
        const counts = {};
        for (const ev of evts) { counts[ev.type] = (counts[ev.type] || 0) + 1; }
        const idleCount = (counts['idle_start'] || 0) + (counts['idle_end'] || 0);
        html += `<tr>
            <td>${row.id ?? ''}</td>
            <td title="${escHtml(row.session_id ?? '')}">${escHtml((row.session_id ?? '').substring(0, 8))}…</td>
            <td title="${escHtml(row.url ?? '')}">${escHtml((row.url ?? '').replace(/^https?:\/\/[^/]+/, '') || '/')}</td>
            <td>${escHtml(row.timestamp ?? '')}</td>
            <td>${evts.length}</td>
            <td>${counts['click'] || 0}</td>
            <td>${counts['scroll'] || 0}</td>
            <td>${counts['mousemove'] || 0}</td>
            <td>${counts['keydown'] || 0}</td>
            <td>${counts['keyup'] || 0}</td>
            <td>${idleCount}</td>
        </tr>`;
    }
    html += '</tbody></table>';
    return html;
}

function renderTables(category, data) {
    const wrap = document.getElementById(`tables-${category}`);
    if (!wrap) return;
    let html = '';
    for (const [name, rows] of Object.entries(data)) {
        html += `<p class="section-label">${escHtml(name)} (${rows.length})</p>`;
        if (name === 'activity_events') {
            html += buildActivityTable(rows);
        } else {
            html += buildTable(rows);
        }
    }
    wrap.innerHTML = html || '<p class="status-msg">No data.</p>';
}

// ── View: Charts ──────────────────────────────────────────────────────────

const chartInstances = {};

function makeChart(canvasId, config) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    chartInstances[canvasId] = new Chart(canvas, config);
}

function countByDate(rows, tsField) {
    const byDay = {};
    for (const r of rows) {
        const day = r[tsField] ? String(r[tsField]).substring(0, 10) : 'unknown';
        byDay[day] = (byDay[day] || 0) + 1;
    }
    return byDay;
}

function countByField(rows, field) {
    const counts = {};
    for (const r of rows) {
        const key = String(r[field] ?? 'unknown');
        counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
}

function renderTrafficCharts(data) {
    const pvRows = data.pageviews   || [];
    const peRows = data.page_exits  || [];

    // Chart 1: pageviews per day
    const byDay = countByDate(pvRows, 'timestamp');
    const days  = Object.keys(byDay).sort();
    document.getElementById('chart1-label-traffic').textContent = 'Pageviews Per Day';
    makeChart('chart1-traffic', {
        type: 'line',
        data: {
            labels: days,
            datasets: [{ label: 'Pageviews', data: days.map(d => byDay[d]),
                borderColor: '#4a90e2', backgroundColor: 'rgba(74,144,226,0.1)',
                tension: 0.3, fill: true, pointRadius: 3 }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });

    // Chart 2: top 10 URLs
    const byUrl  = countByField(pvRows, 'url');
    const sorted = Object.entries(byUrl).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(([url]) => url.replace(/^https?:\/\/[^/]+/, '') || '/');
    document.getElementById('chart2-label-traffic').textContent = 'Top 10 URLs';
    makeChart('chart2-traffic', {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'Pageviews', data: sorted.map(([, n]) => n), backgroundColor: '#4a90e2' }]
        },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

function renderErrorCharts(data) {
    const rows = data.errors || [];

    // Chart 1: errors per day
    const byDay = countByDate(rows, 'timestamp');
    const days  = Object.keys(byDay).sort();
    document.getElementById('chart1-label-errors').textContent = 'Errors Per Day';
    makeChart('chart1-errors', {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{ label: 'Errors', data: days.map(d => byDay[d]), backgroundColor: '#e74c3c' }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });

    // Chart 2: top error messages (truncated)
    const byMsg  = countByField(rows, 'message');
    const sorted = Object.entries(byMsg).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(([msg]) => msg.length > 40 ? msg.substring(0, 40) + '…' : msg);
    document.getElementById('chart2-label-errors').textContent = 'Top Error Messages';
    makeChart('chart2-errors', {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'Count', data: sorted.map(([, n]) => n), backgroundColor: '#c0392b' }]
        },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

// Unpack all individual sub-events from activity_events rows.
// Each row has an `events` field that is either a JSON string or already
// a parsed array (PostgreSQL JSONB comes through as an object via PDO).
// Sub-events: { type, t (ms epoch), x?, y?, button?, code?, start?, end?, duration? }
function unpackActivityEvents(aeRows) {
    const all = [];
    for (const row of aeRows) {
        let evts = row.events;
        if (typeof evts === 'string') {
            try { evts = JSON.parse(evts); } catch (_) { continue; }
        }
        if (!Array.isArray(evts)) continue;
        for (const ev of evts) {
            // Attach the batch's session/url for context; keep the sub-event's own `t`
            all.push({ ...ev, _session: row.session_id, _url: row.url });
        }
    }
    return all;
}

function renderEngagementCharts(data) {
    const aeRows = data.activity_events || [];

    // Unpack individual sub-events from the events JSONB array
    const allEvents = unpackActivityEvents(aeRows);

    // Chart 1: individual activity events per day
    // Sub-events use `t` (epoch ms); fall back to row timestamp if absent
    const byDay = {};
    for (const ev of allEvents) {
        let day;
        if (ev.t) {
            day = new Date(ev.t).toISOString().substring(0, 10);
        } else if (ev.start) {
            day = new Date(ev.start).toISOString().substring(0, 10);
        } else {
            day = 'unknown';
        }
        byDay[day] = (byDay[day] || 0) + 1;
    }
    const days = Object.keys(byDay).filter(d => d !== 'unknown').sort();
    document.getElementById('chart1-label-engagement').textContent = 'Individual Activity Events Per Day';
    makeChart('chart1-engagement', {
        type: 'line',
        data: {
            labels: days,
            datasets: [{ label: 'Events', data: days.map(d => byDay[d]),
                borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)',
                tension: 0.3, fill: true, pointRadius: 3 }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });

    // Chart 2: breakdown of sub-event types
    // Types from collector: mousemove, click, scroll, keydown, keyup, idle_start, idle_end
    const TYPE_COLORS = {
        click:      '#e74c3c',
        scroll:     '#3498db',
        mousemove:  '#95a5a6',
        keydown:    '#9b59b6',
        keyup:      '#8e44ad',
        idle_start: '#e67e22',
        idle_end:   '#f39c12'
    };
    const byType = {};
    for (const ev of allEvents) {
        const t = ev.type || 'unknown';
        byType[t] = (byType[t] || 0) + 1;
    }
    const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    const typeColors = sorted.map(([t]) => TYPE_COLORS[t] || '#27ae60');
    document.getElementById('chart2-label-engagement').textContent = 'Event Type Breakdown';
    makeChart('chart2-engagement', {
        type: 'bar',
        data: {
            labels: sorted.map(([t]) => t),
            datasets: [{ label: 'Count', data: sorted.map(([, n]) => n), backgroundColor: typeColors }]
        },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

function renderCharts(category, data) {
    if (category === 'traffic')    renderTrafficCharts(data);
    if (category === 'errors')     renderErrorCharts(data);
    if (category === 'engagement') renderEngagementCharts(data);
}

// ── View: Comment ─────────────────────────────────────────────────────────

function renderCommentBox(category, comments) {
    const ta = document.getElementById(`comment-${category}`);
    if (!ta) return;
    const match = comments.find(c => c.category === category);
    if (match) ta.value = match.comment;
}

// ── Control ───────────────────────────────────────────────────────────────

const loadedReports = {};

async function loadReport(category) {
    if (loadedReports[category]) return;
    loadedReports[category] = true;

    const wrap = document.getElementById(`tables-${category}`);
    if (wrap) wrap.innerHTML = '<p class="status-msg">Loading...</p>';

    try {
        const data = await fetchReport(category);
        renderCharts(category, data);
        // Build table-friendly object: strip top-level keys → rows arrays
        renderTables(category, data);
    } catch (e) {
        if (wrap) wrap.innerHTML = `<p style="color:red">Error loading data: ${escHtml(e.message)}</p>`;
    }
}

function initCommentBox(category, comments) {
    const ta     = document.getElementById(`comment-${category}`);
    const status = document.getElementById(`comment-status-${category}`);
    if (!ta || !status) return;

    renderCommentBox(category, comments);

    let timer;
    ta.addEventListener('input', () => {
        clearTimeout(timer);
        status.textContent = 'Saving...';
        timer = setTimeout(async () => {
            try {
                await saveComment(category, ta.value);
                status.textContent = 'Saved ✓';
                setTimeout(() => { status.textContent = ''; }, 2000);
            } catch (e) {
                status.textContent = 'Save failed';
            }
        }, 800);
    });
}

// ── View: Saved Reports tab ───────────────────────────────────────────────

const BADGE_COLORS = { traffic: '#4a90e2', errors: '#e74c3c', engagement: '#27ae60' };

async function loadSavedReports() {
    const container = document.getElementById('saved-reports-container');
    if (!container) return;
    container.innerHTML = '<p class="status-msg">Loading...</p>';
    try {
        const res  = await fetch('/api/saved', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();

        if (!rows.length) {
            container.innerHTML = '<p class="status-msg">No saved reports yet.</p>';
            return;
        }

        const categoryOrder = ['traffic', 'errors', 'engagement'];
        const grouped = {};
        for (const r of rows) {
            if (!grouped[r.category]) grouped[r.category] = [];
            grouped[r.category].push(r);
        }

        let html = '<table style="width:100%;font-size:0.85rem;border-collapse:collapse">' +
            '<thead><tr>' +
            '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd">Category</th>' +
            '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd">Analyst</th>' +
            '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd">Comment</th>' +
            '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd">Export</th>' +
            '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd">Updated</th>' +
            '<th style="padding:6px 8px;border-bottom:1px solid #ddd"></th>' +
            '</tr></thead><tbody>';

        for (const cat of categoryOrder) {
            if (!grouped[cat]) continue;
            for (const row of grouped[cat]) {
                const color   = BADGE_COLORS[cat] || '#888';
                const date    = new Date(row.updated_at).toLocaleString();
                const preview = row.comment ? (row.comment.length > 60 ? row.comment.substring(0, 60) + '…' : row.comment) : '—';
                const exportCell = row.export_url
                    ? `<a href="${escHtml(row.export_url)}" target="_blank">Download</a>`
                    : '—';
                html += `<tr id="saved-row-${row.id}">
                    <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">
                        <span style="background:${color};color:#fff;font-size:0.7rem;padding:2px 7px;border-radius:999px;font-weight:700">${escHtml(cat)}</span>
                    </td>
                    <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${escHtml(row.email)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;color:#555">${escHtml(preview)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${exportCell}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;white-space:nowrap;color:#888">${escHtml(date)}</td>
                    <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">
                        <button style="font-size:0.75rem;padding:2px 8px;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer"
                            onclick="deleteSavedReport(${row.id})">Delete</button>
                    </td>
                </tr>`;
            }
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<p style="color:red">Failed to load: ${escHtml(e.message)}</p>`;
    }
}

async function deleteSavedReport(id) {
    if (!confirm('Delete this saved report entry?')) return;
    try {
        const res = await fetch(`/api/saved/${id}`, {
            method:      'DELETE',
            credentials: 'same-origin'
        });
        if (res.status === 204 || res.ok) {
            const row = document.getElementById(`saved-row-${id}`);
            if (row) row.remove();
        } else {
            const data = await res.json().catch(() => ({}));
            alert('Delete failed: ' + (data.error || res.status));
        }
    } catch (e) {
        alert('Delete failed: ' + e.message);
    }
}

// ── Control: Tabs ─────────────────────────────────────────────────────────

let savedReportsLoaded = false;

function initTabs(comments) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const cat = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.report-section').forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            const section = document.getElementById(`section-${cat}`);
            if (section) section.classList.add('active');
            if (cat === 'saved-reports') {
                if (!savedReportsLoaded) { savedReportsLoaded = true; loadSavedReports(); }
            } else {
                loadReport(cat);
            }
        });
    });
}

async function init() {
    // Load comments for autosave prefill (analysts/admins only)
    let comments = [];
    if (APP.role !== 'viewer') {
        try { comments = await fetchComments(); } catch (_) {}
    }

    // Wire up tabs
    initTabs(comments);

    // Wire up comment boxes for all visible tabs
    if (APP.role !== 'viewer') {
        for (const cat of APP.tabs) {
            initCommentBox(cat, comments);
        }
    }

    // Load the first visible tab automatically
    if (APP.tabs.length > 0) {
        loadReport(APP.tabs[0]);
    }
}

function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
