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

function renderTables(category, data) {
    const wrap = document.getElementById(`tables-${category}`);
    if (!wrap) return;
    let html = '';
    for (const [name, rows] of Object.entries(data)) {
        html += `<h4 style="margin:1rem 0 0.5rem">${escHtml(name)} <small style="font-weight:normal;color:var(--pico-muted-color)">(${rows.length} rows)</small></h4>`;
        html += buildTable(rows);
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

function renderEngagementCharts(data) {
    const aeRows = data.activity_events || [];
    const evRows = data.events          || [];

    // Chart 1: activity events per day
    const byDay = countByDate(aeRows, 'timestamp');
    const days  = Object.keys(byDay).sort();
    document.getElementById('chart1-label-engagement').textContent = 'Activity Events Per Day';
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

    // Chart 2: top event types
    const byType = countByField(aeRows, 'event_type');
    const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 10);
    document.getElementById('chart2-label-engagement').textContent = 'Top Activity Event Types';
    makeChart('chart2-engagement', {
        type: 'bar',
        data: {
            labels: sorted.map(([t]) => t),
            datasets: [{ label: 'Count', data: sorted.map(([, n]) => n), backgroundColor: '#27ae60' }]
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
            loadReport(cat);
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
