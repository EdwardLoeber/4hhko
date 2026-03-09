/**
 * Client layer for the analytics dashboard.
 *
 * Responsibilities:
 *   Model   — fetchResource(): talks to /api/* and returns raw data
 *   View    — renderTable(), renderCharts(): turns data into DOM/canvas
 *   Control — initTabs(), init(): wires events and bootstraps the page
 */

'use strict';

// ── Model: API access ─────────────────────────────────────────────────────

async function fetchResource(resource) {
    const res = await fetch(`/api/${resource}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── View: Table rendering ─────────────────────────────────────────────────

function renderTable(resource, rows) {
    const el = document.getElementById(resource);
    if (!rows.length) {
        el.innerHTML = '<p class="status">No data yet.</p>';
        return;
    }
    const cols = Object.keys(rows[0]);
    let html = '<table><thead><tr>' +
        cols.map(c => `<th>${c}</th>`).join('') +
        '</tr></thead><tbody>';

    for (const row of rows) {
        html += '<tr>' + cols.map(c => {
            const v       = row[c];
            const display = (v !== null && typeof v === 'object') ? JSON.stringify(v) : (v ?? '');
            const escaped = String(display).replace(/</g, '&lt;');
            const title   = String(display).replace(/"/g, '&quot;');
            return `<td title="${title}">${escaped}</td>`;
        }).join('') + '</tr>';
    }
    html += '</tbody></table>';
    el.innerHTML = html;
}

function renderError(resource, message) {
    document.getElementById(resource).innerHTML =
        `<p class="status">Error: ${message}</p>`;
}

// ── View: Chart rendering ─────────────────────────────────────────────────

function renderCharts(rows) {
    if (!rows.length) return;

    // Chart 1 — pageviews per day (line)
    const byDay = {};
    for (const r of rows) {
        const day = r.timestamp ? r.timestamp.substring(0, 10) : 'unknown';
        byDay[day] = (byDay[day] || 0) + 1;
    }
    const days = Object.keys(byDay).sort();
    new Chart(document.getElementById('chartByDay'), {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Pageviews',
                data: days.map(d => byDay[d]),
                borderColor: '#4a90e2',
                backgroundColor: 'rgba(74,144,226,0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 4
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales:  { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });

    // Chart 2 — top 10 URLs by pageview count (horizontal bar)
    const byUrl = {};
    for (const r of rows) {
        const url = r.url || 'unknown';
        byUrl[url] = (byUrl[url] || 0) + 1;
    }
    const sorted = Object.entries(byUrl).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(([url]) => url.replace(/^https?:\/\/[^/]+/, '') || '/');
    new Chart(document.getElementById('chartByUrl'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Pageviews',
                data: sorted.map(([, n]) => n),
                backgroundColor: '#4a90e2'
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales:  { x: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

// ── Control: Tab switching ────────────────────────────────────────────────

const loaded = {};

async function loadTab(resource) {
    if (loaded[resource]) return;
    loaded[resource] = true;

    document.getElementById(resource).innerHTML = '<p class="status">Loading...</p>';
    try {
        const rows = await fetchResource(resource);
        renderTable(resource, rows);
    } catch (e) {
        renderError(resource, e.message);
    }
}

function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const resource = tab.dataset.resource;
            document.getElementById(resource).classList.add('active');
            loadTab(resource);
        });
    });
}

// ── Control: Bootstrap ────────────────────────────────────────────────────

async function init() {
    initTabs();
    loadTab('pageviews');                   // initial tab

    try {
        const rows = await fetchResource('pageviews');
        renderCharts(rows);                 // charts reuse the same fetch
    } catch (e) {
        console.warn('Charts unavailable:', e.message);
    }
}

init();
