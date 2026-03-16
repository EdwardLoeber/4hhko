'use strict';

// ── Date Range Helper ─────────────────────────────────────────────────────

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

// ── UA Parsing ─────────────────────────────────────────────────────────────

function parseUA(ua) {
    if (!ua) return { browser: 'Unknown', os: 'Unknown', mobile: false };
    const mobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(ua);
    let browser = 'Other';
    if      (/Edg\/|Edge\//.test(ua))                         browser = 'Edge';
    else if (/OPR\/|Opera\//.test(ua))                        browser = 'Opera';
    else if (/Firefox\//.test(ua))                            browser = 'Firefox';
    else if (/Chromium\//.test(ua))                           browser = 'Chromium';
    else if (/Chrome\//.test(ua))                             browser = 'Chrome';
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua))       browser = 'Safari';
    let os = 'Other';
    if      (/CrOS/.test(ua))                                 os = 'ChromeOS';
    else if (/Windows NT/.test(ua))                           os = 'Windows';
    else if (/iPhone|iPad|iPod/.test(ua))                     os = 'iOS';
    else if (/Android/.test(ua))                              os = 'Android';
    else if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua))  os = 'macOS';
    else if (/Linux/.test(ua))                                os = 'Linux';
    return { browser, os, mobile };
}

function fmtDuration(secs) {
    if (!secs || secs < 0) return '<1s';
    if (secs < 60)   return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
}

function fmtDateShort(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString();
}

// ── Charts ─────────────────────────────────────────────────────────────────

const ci = {};
function mkChart(id, cfg) {
    if (ci[id]) ci[id].destroy();
    const canvas = document.getElementById(id);
    if (!canvas) return;
    ci[id] = new Chart(canvas, cfg);
}

const DOUGHNUT_OPTS = { plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } };
const BAR_H_OPTS    = { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } };
const BAR_V_OPTS    = { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };

const PALETTE = ['#4a90e2','#e74c3c','#27ae60','#f39c12','#9b59b6',
                 '#1abc9c','#e67e22','#3498db','#c0392b','#2ecc71','#95a5a6'];

function renderUserCharts(data) {
    // Chart 1: Sessions per day (thin bar, first session → today)
    const rawSessByDay = (data.sessions_by_day || []);
    const sesByDayMap  = {};
    for (const r of rawSessByDay) sesByDayMap[r.day] = Number(r.cnt);
    const rawSesDays   = Object.keys(sesByDayMap).sort();
    const sestoday     = new Date().toISOString().substring(0, 10);
    const sesDays      = rawSesDays.length > 0 ? fillDateRange(rawSesDays[0], sestoday) : [];
    mkChart('u-chart1', {
        type: 'bar',
        data: { labels: sesDays, datasets: [{ label: 'Sessions', data: sesDays.map(d => sesByDayMap[d] || 0),
            backgroundColor: '#4a90e2', maxBarThickness: 10 }] },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { maxTicksLimit: 15, maxRotation: 45 } },
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });

    // Chart 2: Language distribution (doughnut)
    const langs  = (data.langs || []).map(r => r.language || 'unknown');
    const lCnts  = (data.langs || []).map(r => Number(r.cnt));
    mkChart('u-chart2', {
        type: 'doughnut',
        data: { labels: langs, datasets: [{ data: lCnts, backgroundColor: langs.map((_, i) => PALETTE[i % PALETTE.length]) }] },
        options: DOUGHNUT_OPTS
    });

    // Chart 3: Timezone distribution (horizontal bar, top 10)
    const tzRows = (data.timezones || []).slice(0, 10);
    mkChart('u-chart3', {
        type: 'bar',
        data: { labels: tzRows.map(r => r.timezone || 'unknown'),
                datasets: [{ label: 'Pageviews', data: tzRows.map(r => Number(r.cnt)), backgroundColor: '#4a90e2' }] },
        options: BAR_H_OPTS
    });
}

function renderTechCharts(data) {
    const sessions = data.sessions || [];

    // Parse UA for each session
    const parsed = sessions.map(s => parseUA(s.user_agent));

    // Chart 1: Mobile vs Desktop
    const mobileCount  = parsed.filter(p => p.mobile).length;
    const desktopCount = parsed.length - mobileCount;
    mkChart('t-chart1', {
        type: 'doughnut',
        data: { labels: ['Desktop', 'Mobile'],
                datasets: [{ data: [desktopCount, mobileCount], backgroundColor: ['#4a90e2', '#e74c3c'] }] },
        options: DOUGHNUT_OPTS
    });

    // Chart 2: Browser share (doughnut)
    const browsers = {};
    for (const p of parsed) browsers[p.browser] = (browsers[p.browser] || 0) + 1;
    const bEntries = Object.entries(browsers).sort((a, b) => b[1] - a[1]);
    mkChart('t-chart2', {
        type: 'doughnut',
        data: { labels: bEntries.map(([k]) => k),
                datasets: [{ data: bEntries.map(([, v]) => v),
                    backgroundColor: bEntries.map((_, i) => PALETTE[i % PALETTE.length]) }] },
        options: DOUGHNUT_OPTS
    });

    // Chart 3: OS distribution (doughnut)
    const oss = {};
    for (const p of parsed) oss[p.os] = (oss[p.os] || 0) + 1;
    const oEntries = Object.entries(oss).sort((a, b) => b[1] - a[1]);
    mkChart('t-chart3', {
        type: 'doughnut',
        data: { labels: oEntries.map(([k]) => k),
                datasets: [{ data: oEntries.map(([, v]) => v),
                    backgroundColor: oEntries.map((_, i) => PALETTE[i % PALETTE.length]) }] },
        options: DOUGHNUT_OPTS
    });

    // Chart 4: Screen resolutions (horizontal bar)
    const screenRows = (data.screens || []).slice(0, 10);
    mkChart('t-chart4', {
        type: 'bar',
        data: { labels: screenRows.map(r => r.resolution),
                datasets: [{ label: 'Sessions', data: screenRows.map(r => Number(r.cnt)), backgroundColor: '#27ae60' }] },
        options: BAR_H_OPTS
    });

    // Chart 5: Device memory distribution (bar)
    const memRows = data.memory || [];
    mkChart('t-chart5', {
        type: 'bar',
        data: { labels: memRows.map(r => (r.memory_gb || '?') + ' GB'),
                datasets: [{ label: 'Pageviews', data: memRows.map(r => Number(r.cnt)), backgroundColor: '#9b59b6' }] },
        options: BAR_V_OPTS
    });

    // Chart 6: Color scheme preference (doughnut)
    const csRows = data.color_scheme || [];
    const CS_COLORS = { dark: '#2c3e50', light: '#f0c040' };
    mkChart('t-chart6', {
        type: 'doughnut',
        data: { labels: csRows.map(r => r.scheme || 'unknown'),
                datasets: [{ data: csRows.map(r => Number(r.cnt)),
                    backgroundColor: csRows.map(r => CS_COLORS[r.scheme] || '#95a5a6') }] },
        options: DOUGHNUT_OPTS
    });
}

// ── Tables ─────────────────────────────────────────────────────────────────

function renderSessionsTable(sessions) {
    const tbody = document.getElementById('sessions-tbody');
    const cnt   = document.getElementById('session-count');
    if (!sessions.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="status-msg">No session data yet.</td></tr>';
        return;
    }
    if (cnt) cnt.textContent = sessions.length;
    tbody.innerHTML = sessions.map(s => `<tr>
        <td title="${escHtml(s.session_id)}">${escHtml(s.session_id.substring(0, 10))}…</td>
        <td>${escHtml(fmtDate(s.first_seen))}</td>
        <td>${escHtml(fmtDate(s.last_seen))}</td>
        <td>${escHtml(fmtDuration(Number(s.session_duration_secs)))}</td>
        <td>${escHtml(String(s.pageview_count))}</td>
        <td>${escHtml(s.language || '—')}</td>
        <td>${escHtml(s.timezone || '—')}</td>
    </tr>`).join('');
}

function renderTechTable(sessions) {
    const tbody = document.getElementById('tech-tbody');
    if (!sessions.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="status-msg">No session data yet.</td></tr>';
        return;
    }
    tbody.innerHTML = sessions.map(s => {
        const p = parseUA(s.user_agent);
        const res = (s.screen_width && s.screen_height) ? `${s.screen_width}×${s.screen_height}` : '—';
        return `<tr>
            <td title="${escHtml(s.session_id)}">${escHtml(s.session_id.substring(0, 10))}…</td>
            <td>${p.mobile ? 'Mobile' : 'Desktop'}</td>
            <td>${escHtml(p.browser)}</td>
            <td>${escHtml(p.os)}</td>
            <td>${escHtml(res)}</td>
            <td>${escHtml(s.device_memory_gb ? s.device_memory_gb + ' GB' : '—')}</td>
            <td>${escHtml(s.network_type || '—')}</td>
            <td>${escHtml(s.color_scheme || '—')}</td>
            <td title="${escHtml(s.user_agent || '')}" style="max-width:220px">${escHtml((s.user_agent || '—').substring(0, 60))}${s.user_agent && s.user_agent.length > 60 ? '…' : ''}</td>
        </tr>`;
    }).join('');
}

// ── Export & Comment ───────────────────────────────────────────────────────

let _insightsData = null;   // cached after first load

// Chart ID → human-readable label for the PDF
const CHART_LABELS = {
    'u-chart1': 'Sessions Per Day',
    'u-chart2': 'Language Distribution',
    'u-chart3': 'Timezone Distribution',
    't-chart1': 'Mobile vs Desktop',
    't-chart2': 'Browser Share',
    't-chart3': 'OS Distribution',
    't-chart4': 'Screen Resolutions',
    't-chart5': 'Device Memory (GB)',
    't-chart6': 'Color Scheme Preference',
};

async function exportInsightsPDF() {
    if (!_insightsData) { alert('Data not loaded yet.'); return; }

    const btn  = document.getElementById('insight-export-btn');
    const link = document.getElementById('insight-export-link');
    if (btn) { btn.disabled = true; btn.textContent = 'Exporting…'; }

    try {
        // Temporarily show all tab panels so hidden canvases get proper dimensions
        const panels      = document.querySelectorAll('.tab-panel');
        const origDisplay = [...panels].map(p => p.style.display);
        panels.forEach(p => { p.style.display = 'block'; });

        // Force Chart.js to recalculate canvas sizes on newly-visible panels
        // Explicitly set dimensions first so hidden canvases aren't 0x0
        Object.values(ci).forEach(c => {
            try {
                const canvas = c.canvas;
                if (canvas.offsetWidth === 0) {
                    canvas.style.width  = '400px';
                    canvas.style.height = '200px';
                }
                c.resize();
            } catch (_) {}
        });
        await new Promise(r => setTimeout(r, 150));

        // Capture every chart canvas as a base64 PNG
        const charts = Object.keys(CHART_LABELS).map(id => {
            const canvas = document.getElementById(id);
            if (!canvas) return null;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            // Strip the data URI prefix so ModSecurity doesn't flag it as XSS
            return { id, label: CHART_LABELS[id], img: dataUrl.replace(/^data:[^,]+,/, '') };
        }).filter(Boolean);

        // Restore tab panel visibility
        panels.forEach((p, i) => { p.style.display = origDisplay[i]; });

        const comment  = document.getElementById('insight-comment')?.value || '';
        const stats    = _insightsData.stats || {};
        const sessions = (_insightsData.sessions || []).slice(0, 25);

        const res = await fetch('/export-insights.php', {
            method:      'POST',
            credentials: 'same-origin',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ comment, charts, stats, sessions }),
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

function initInsightCommentBox() {
    const ta     = document.getElementById('insight-comment');
    const status = document.getElementById('insight-comment-status');
    if (!ta) return;

    let timer;
    ta.addEventListener('input', () => {
        clearTimeout(timer);
        if (status) status.textContent = 'Saving…';
        timer = setTimeout(async () => {
            try {
                const res = await fetch('/api/comments', {
                    method:      'POST',
                    credentials: 'same-origin',
                    headers:     { 'Content-Type': 'application/json' },
                    body:        JSON.stringify({ category: 'insights', comment: ta.value }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                if (status) {
                    status.textContent = 'Saved ✓';
                    setTimeout(() => { status.textContent = ''; }, 2000);
                }
            } catch (e) {
                if (status) status.textContent = 'Save failed';
            }
        }, 800);
    });
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const panel = document.getElementById(`tab-${btn.dataset.tab}`);
            if (panel) panel.classList.add('active');
        });
    });
}

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
    initTabs();

    // Load existing analyst comment (non-blocking)
    fetch('/api/comments', { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : [])
        .then(comments => {
            const match = comments.find(c => c.category === 'insights');
            const ta    = document.getElementById('insight-comment');
            if (ta && match) ta.value = match.comment;
        })
        .catch(() => {});

    initInsightCommentBox();

    try {
        const res  = await fetch('/api/insights', { credentials: 'same-origin' });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        _insightsData = data;

        // Stats row
        const s = data.stats || {};
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('stat-sessions',  Number(s.unique_sessions).toLocaleString());
        set('stat-pageviews', Number(s.total_pageviews).toLocaleString());
        set('stat-first', s.first_access ? fmtDateShort(s.first_access) : '—');
        set('stat-last',  s.last_access  ? fmtDateShort(s.last_access)  : '—');

        renderUserCharts(data);
        renderTechCharts(data);
        renderSessionsTable(data.sessions || []);
        renderTechTable(data.sessions || []);
    } catch (e) {
        document.querySelector('main').insertAdjacentHTML('beforeend',
            `<p style="color:red">Failed to load insights: ${escHtml(e.message)}</p>`);
    }
}

function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
