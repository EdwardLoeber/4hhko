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
    const btn     = document.getElementById(`export-btn-${category}`);
    const link    = document.getElementById(`export-link-${category}`);
    const comment = document.getElementById(`comment-${category}`)?.value || '';
    if (btn) { btn.disabled = true; btn.textContent = 'Exporting…'; }
    try {
        // Capture every visible chart canvas in this section as a base64 PNG
        const section = document.getElementById(`section-${category}`);
        const charts  = [];
        if (section) {
            section.querySelectorAll('.chart-card').forEach(card => {
                if (card.style.display === 'none') return;  // skip empty hidden slots
                const canvas = card.querySelector('canvas');
                const label  = card.querySelector('h3')?.textContent?.trim() || '';
                if (canvas) charts.push({ label, img: canvas.toDataURL('image/png') });
            });
        }

        const res = await fetch('/export.php', {
            method:      'POST',
            credentials: 'same-origin',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ category, comment, charts }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
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

    const entries = Object.entries(data);
    if (!entries.length) { wrap.innerHTML = '<p class="status-msg">No data.</p>'; return; }

    // Each table gets its own independently scrollable container
    const multiple = entries.length > 1;
    let html = multiple
        ? `<div style="display:grid;grid-template-columns:repeat(${entries.length},1fr);gap:0.6rem;min-width:0">`
        : '';

    for (const [name, rows] of entries) {
        let tableHtml;
        if (name === 'activity_events') {
            tableHtml = buildActivityTable(rows);
        } else if (name === 'events' && !rows.length) {
            tableHtml = '<p class="status-msg">No custom events recorded yet. Emit them with <code>_cq.push([\'track\', \'name\', data])</code>.</p>';
        } else {
            tableHtml = buildTable(rows);
        }
        if (multiple) {
            html += `<div style="min-width:0">
                <p class="section-label">${escHtml(name)} (${rows.length})</p>
                <div style="overflow-x:auto;overflow-y:auto;max-height:240px">${tableHtml}</div>
            </div>`;
        } else {
            html += `<p class="section-label">${escHtml(name)} (${rows.length})</p>
                <div style="overflow-x:auto;overflow-y:auto;max-height:240px">${tableHtml}</div>`;
        }
    }

    if (multiple) html += '</div>';
    wrap.innerHTML = html;
}

// ── View: Charts ──────────────────────────────────────────────────────────

const chartInstances = {};

function makeChart(canvasId, config) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    // Reveal parent card if it was hidden (chart3/chart4 slots start hidden)
    const card = canvas.closest('.chart-card');
    if (card) card.style.display = '';
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

// Returns an array of YYYY-MM-DD strings covering startDay through endDay (inclusive).
// Uses UTC noon to avoid any DST-boundary off-by-one.
function fillDateRange(startDay, endDay) {
    const result = [];
    const d   = new Date(startDay + 'T12:00:00Z');
    const end = new Date(endDay   + 'T12:00:00Z');
    while (d <= end) {
        result.push(d.toISOString().substring(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return result;
}

// Returns an HSL color along a red→blue gradient based on network speed rank.
// Fastest (5g) = red (hue 0), slowest (slow-2g) = blue (hue 240).
function netTypeColor(type) {
    const ORDER = ['5g', '4g', 'wifi', '3g', '2g', 'slow-2g'];
    const idx   = ORDER.indexOf(type);
    if (idx === -1) return '#95a5a6';
    const hue = Math.round((idx / (ORDER.length - 1)) * 240);
    return `hsl(${hue}, 85%, 50%)`;
}

function renderTrafficCharts(data) {
    const pvRows = data.pageviews || [];

    // Chart 1: Pageviews per day (thin bar, full date range)
    const byDay     = countByDate(pvRows, 'timestamp');
    const rawDays   = Object.keys(byDay).sort();
    const today     = new Date().toISOString().substring(0, 10);
    const days      = rawDays.length > 0 ? fillDateRange(rawDays[0], today) : [];
    document.getElementById('chart1-label-traffic').textContent = 'Pageviews Per Day';
    makeChart('chart1-traffic', {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{ label: 'Pageviews', data: days.map(d => byDay[d] || 0),
                backgroundColor: '#4a90e2', maxBarThickness: 10 }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { maxTicksLimit: 15, maxRotation: 45 } },
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });

    // Chart 2: Top 10 URLs (horizontal bar)
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

    // Chart 3: Page load time histogram
    const BINS = [
        { label: '0–200ms',   min: 0,    max: 200 },
        { label: '200–500ms', min: 200,  max: 500 },
        { label: '500ms–1s',  min: 500,  max: 1000 },
        { label: '1–2s',      min: 1000, max: 2000 },
        { label: '2–5s',      min: 2000, max: 5000 },
        { label: '5s+',       min: 5000, max: Infinity },
    ];
    const binCounts = new Array(BINS.length).fill(0);
    for (const r of pvRows) {
        const t = parseFloat(r.total_load_time);
        if (isNaN(t)) continue;
        const i = BINS.findIndex(b => t >= b.min && t < b.max);
        if (i >= 0) binCounts[i]++;
    }
    document.getElementById('chart3-label-traffic').textContent = 'Page Load Time Distribution';
    makeChart('chart3-traffic', {
        type: 'bar',
        data: {
            labels: BINS.map(b => b.label),
            datasets: [{ label: 'Pages', data: binCounts, backgroundColor: '#4a90e2' }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });

    // Chart 4: Network type distribution — always show all 6 known types (+ unknowns if present)
    const NET_ORDER  = ['5g', '4g', 'wifi', '3g', '2g', 'slow-2g'];
    const netCounts  = countByField(pvRows, 'network_type');
    // Any type in data not in our canonical list (e.g. 'unknown')
    const extraTypes = Object.keys(netCounts).filter(k => !NET_ORDER.includes(k));
    const allTypes   = [...NET_ORDER, ...extraTypes];
    const netEntries = allTypes.map(t => [t, netCounts[t] || 0]);
    document.getElementById('chart4-label-traffic').textContent = 'Network Type Distribution';
    makeChart('chart4-traffic', {
        type: 'doughnut',
        data: {
            labels: netEntries.map(([k]) => k || 'unknown'),
            datasets: [{ data: netEntries.map(([, n]) => n),
                backgroundColor: netEntries.map(([k]) => netTypeColor(k)) }]
        },
        options: { plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } }
    });
}

function renderErrorCharts(data) {
    const rows = data.errors || [];

    // Chart 1: Errors per day (thin bar, first error → today)
    const errByDay  = countByDate(rows, 'timestamp');
    const rawErrDays = Object.keys(errByDay).sort();
    const errToday  = new Date().toISOString().substring(0, 10);
    const errDays   = rawErrDays.length > 0 ? fillDateRange(rawErrDays[0], errToday) : [];
    document.getElementById('chart1-label-errors').textContent = 'Errors Per Day';
    makeChart('chart1-errors', {
        type: 'bar',
        data: {
            labels: errDays,
            datasets: [{ label: 'Errors', data: errDays.map(d => errByDay[d] || 0),
                backgroundColor: '#e74c3c', maxBarThickness: 10 }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { maxTicksLimit: 15, maxRotation: 45 } },
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });

    // Chart 2: Top error messages (horizontal bar)
    const byMsg     = countByField(rows, 'message');
    const msgSorted = Object.entries(byMsg).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const msgLabels = msgSorted.map(([msg]) => msg.length > 40 ? msg.substring(0, 40) + '…' : msg);
    document.getElementById('chart2-label-errors').textContent = 'Top Error Messages';
    makeChart('chart2-errors', {
        type: 'bar',
        data: {
            labels: msgLabels,
            datasets: [{ label: 'Count', data: msgSorted.map(([, n]) => n), backgroundColor: '#c0392b' }]
        },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    });

    // Chart 3: Error type distribution (doughnut) — unhandled-error vs unhandled-rejection etc.
    const byType      = countByField(rows, 'type');
    const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    const ERR_COLORS  = ['#c0392b', '#e74c3c', '#e67e22', '#f39c12', '#95a5a6', '#7f8c8d'];
    document.getElementById('chart3-label-errors').textContent = 'Error Type Distribution';
    makeChart('chart3-errors', {
        type: 'doughnut',
        data: {
            labels: typeEntries.map(([t]) => t || 'unknown'),
            datasets: [{ data: typeEntries.map(([, n]) => n),
                backgroundColor: typeEntries.map((_, i) => ERR_COLORS[i % ERR_COLORS.length]) }]
        },
        options: { plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } }
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
    const aeRows    = data.activity_events || [];
    const allEvents = unpackActivityEvents(aeRows);

    const TYPE_COLORS = {
        click:      '#e74c3c',
        scroll:     '#3498db',
        mousemove:  '#95a5a6',
        keydown:    '#9b59b6',
        keyup:      '#8e44ad',
        idle_start: '#e67e22',
        idle_end:   '#f39c12'
    };

    // Chart 1: Interaction type ratio (doughnut) — click vs scroll vs keyboard vs idle
    const byType = {};
    for (const ev of allEvents) {
        const t = ev.type || 'unknown';
        byType[t] = (byType[t] || 0) + 1;
    }
    const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    document.getElementById('chart1-label-engagement').textContent = 'Interaction Type Ratio';
    makeChart('chart1-engagement', {
        type: 'doughnut',
        data: {
            labels: typeEntries.map(([t]) => t),
            datasets: [{ data: typeEntries.map(([, n]) => n),
                backgroundColor: typeEntries.map(([t]) => TYPE_COLORS[t] || '#27ae60') }]
        },
        options: { plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } }
    });

    // Chart 2: Activity events per day (thin bar, first event → today)
    const aeByDay = {};
    for (const ev of allEvents) {
        let day;
        if (ev.t) {
            day = new Date(ev.t).toISOString().substring(0, 10);
        } else if (ev.start) {
            day = new Date(ev.start).toISOString().substring(0, 10);
        } else {
            day = 'unknown';
        }
        aeByDay[day] = (aeByDay[day] || 0) + 1;
    }
    const rawAeDays = Object.keys(aeByDay).filter(d => d !== 'unknown').sort();
    const aeToday   = new Date().toISOString().substring(0, 10);
    const aeDays    = rawAeDays.length > 0 ? fillDateRange(rawAeDays[0], aeToday) : [];
    document.getElementById('chart2-label-engagement').textContent = 'Activity Events Per Day';
    makeChart('chart2-engagement', {
        type: 'bar',
        data: {
            labels: aeDays,
            datasets: [{ label: 'Events', data: aeDays.map(d => aeByDay[d] || 0),
                backgroundColor: '#27ae60', maxBarThickness: 10 }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { maxTicksLimit: 15, maxRotation: 45 } },
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });

    // Chart 3: Event type breakdown (horizontal bar)
    const sorted     = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    const typeColors = sorted.map(([t]) => TYPE_COLORS[t] || '#27ae60');
    document.getElementById('chart3-label-engagement').textContent = 'Event Type Breakdown';
    makeChart('chart3-engagement', {
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
