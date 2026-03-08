<?php require_once 'auth.php'; ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard — 4hhko Analytics</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, sans-serif; background: #f0f2f5; color: #222; }

        header {
            background: #1a1a2e;
            color: #fff;
            padding: 14px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        header h1 { font-size: 18px; }
        header a { color: #aac4ff; font-size: 13px; text-decoration: none; }
        header a:hover { text-decoration: underline; }

        main { max-width: 1200px; margin: 24px auto; padding: 0 20px; }

        .charts {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 28px;
        }
        .chart-card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 1px 6px rgba(0,0,0,0.08);
            padding: 20px;
        }
        .chart-card h2 { font-size: 14px; color: #555; margin-bottom: 14px; }

        .table-section {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 1px 6px rgba(0,0,0,0.08);
            overflow: hidden;
        }

        .tabs {
            display: flex;
            border-bottom: 1px solid #e0e0e0;
            background: #fafafa;
        }
        .tab {
            padding: 12px 20px;
            font-size: 13px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            color: #666;
            user-select: none;
        }
        .tab:hover { color: #4a90e2; }
        .tab.active { color: #4a90e2; border-bottom-color: #4a90e2; font-weight: 600; }

        .tab-content { display: none; padding: 16px; overflow-x: auto; }
        .tab-content.active { display: block; }

        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th {
            background: #f5f5f5;
            text-align: left;
            padding: 9px 12px;
            font-weight: 600;
            color: #444;
            border-bottom: 1px solid #ddd;
            white-space: nowrap;
        }
        td {
            padding: 8px 12px;
            border-bottom: 1px solid #f0f0f0;
            color: #333;
            max-width: 280px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #fafcff; }

        .status { font-size: 12px; color: #999; padding: 12px; }
    </style>
</head>
<body>

<header>
    <h1>4hhko Analytics</h1>
    <a href="/logout.php">Logout</a>
</header>

<main>
    <div class="charts">
        <div class="chart-card">
            <h2>Pageviews Per Day</h2>
            <canvas id="chartByDay"></canvas>
        </div>
        <div class="chart-card">
            <h2>Top 10 URLs</h2>
            <canvas id="chartByUrl"></canvas>
        </div>
    </div>

    <div class="table-section">
        <div class="tabs">
            <div class="tab active" data-resource="pageviews">Pageviews</div>
            <div class="tab" data-resource="activity">Activity</div>
            <div class="tab" data-resource="errors">Errors</div>
            <div class="tab" data-resource="page_exits">Page Exits</div>
            <div class="tab" data-resource="events">Events</div>
        </div>
        <div id="pageviews"  class="tab-content active"><p class="status">Loading...</p></div>
        <div id="activity"   class="tab-content"></div>
        <div id="errors"     class="tab-content"></div>
        <div id="page_exits" class="tab-content"></div>
        <div id="events"     class="tab-content"></div>
    </div>
</main>

<script>
    const loaded = {};

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
                const v = row[c];
                const display = (v !== null && typeof v === 'object') ? JSON.stringify(v) : (v ?? '');
                return `<td title="${String(display).replace(/"/g, '&quot;')}">${String(display).replace(/</g, '&lt;')}</td>`;
            }).join('') + '</tr>';
        }
        html += '</tbody></table>';
        el.innerHTML = html;
    }

    async function loadTab(resource) {
        if (loaded[resource]) return;
        loaded[resource] = true;
        const el = document.getElementById(resource);
        el.innerHTML = '<p class="status">Loading...</p>';
        try {
            const res = await fetch(`/api/${resource}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const rows = await res.json();
            renderTable(resource, rows);
        } catch (e) {
            el.innerHTML = `<p class="status">Error: ${e.message}</p>`;
        }
    }

    // Tab switching
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

    // Load initial tab
    loadTab('pageviews');

    // Charts
    async function buildCharts() {
        let rows = [];
        try {
            const res = await fetch('/api/pageviews');
            if (res.ok) rows = await res.json();
        } catch (e) { return; }

        if (!rows.length) return;

        // Chart 1: pageviews per day
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
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });

        // Chart 2: top 10 URLs
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
                scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }

    buildCharts();
</script>

</body>
</html>
