<?php
if (!defined('IN_APP')) { http_response_code(403); exit; }
$role = CURRENT_USER_ROLE;
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Insights — 4hhko Analytics</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.classless.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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

        main { padding: 0.75rem 1rem; }

        .stats-row { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
        .stat-card { background: var(--pico-card-background-color); border-radius: var(--pico-border-radius);
                     padding: 0.5rem 0.9rem; box-shadow: var(--pico-card-box-shadow); flex: 1; min-width: 130px; }
        .stat-card .val { font-size: 1.4rem; font-weight: 700; line-height: 1.1; }
        .stat-card .lbl { font-size: 0.7rem; color: var(--pico-muted-color); text-transform: uppercase; letter-spacing: 0.04em; }

        .tab-bar { display: flex; gap: 0; border-bottom: 2px solid var(--pico-muted-border-color); margin-bottom: 0.75rem; }
        .tab-btn { padding: 0.4rem 0.9rem; cursor: pointer; background: none; border: none;
                   border-bottom: 2px solid transparent; font-size: 0.8rem; color: var(--pico-muted-color); margin-bottom: -2px; }
        .tab-btn:hover { color: var(--pico-primary); }
        .tab-btn.active { color: var(--pico-primary); border-bottom-color: var(--pico-primary); font-weight: 600; }

        .tab-panel { display: none; }
        .tab-panel.active { display: block; }

        .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-bottom: 0.75rem; }
        @media (max-width: 700px) { .chart-grid { grid-template-columns: 1fr; } }

        .chart-card { background: var(--pico-card-background-color); border-radius: var(--pico-border-radius);
                      padding: 0.6rem 0.8rem; box-shadow: var(--pico-card-box-shadow); }
        .chart-card h3 { font-size: 0.72rem; color: var(--pico-muted-color); margin-bottom: 0.4rem;
                         text-transform: uppercase; letter-spacing: 0.04em; }
        .chart-card canvas { max-height: 180px; }

        .section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
                         letter-spacing: 0.05em; color: var(--pico-muted-color); margin: 0.5rem 0 0.3rem; }
        .data-table-wrap table { width: 100%; font-size: 0.75rem; border-collapse: collapse; }
        .data-table-wrap th { padding: 4px 8px; border-bottom: 1px solid var(--pico-muted-border-color);
                              font-size: 0.72rem; text-align: left; background: var(--pico-card-background-color); }
        .data-table-wrap td { padding: 3px 8px; border-bottom: 1px solid var(--pico-muted-border-color);
                              max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .status-msg { color: var(--pico-muted-color); font-size: 0.8rem; padding: 0.3rem 0; }
    </style>
</head>
<body>

<?php $__navActive = 'insights.php'; require __DIR__ . '/_nav.php'; ?>

<main>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
        <div id="stats-row" class="stats-row" style="margin-bottom:0;flex:1">
            <div class="stat-card"><div class="val" id="stat-sessions">—</div><div class="lbl">Unique Sessions</div></div>
            <div class="stat-card"><div class="val" id="stat-pageviews">—</div><div class="lbl">Total Pageviews</div></div>
            <div class="stat-card"><div class="val" id="stat-first">—</div><div class="lbl">First Access</div></div>
            <div class="stat-card"><div class="val" id="stat-last">—</div><div class="lbl">Last Access</div></div>
        </div>
        <button onclick="exportInsightsCSV()" style="margin-left:0.75rem;padding:0.3rem 0.8rem;font-size:0.75rem;white-space:nowrap;flex-shrink:0">Export CSV</button>
    </div>

    <div class="tab-bar">
        <button class="tab-btn active" data-tab="users">User Overview</button>
        <button class="tab-btn" data-tab="technical">Technical Profile</button>
    </div>

    <!-- User Overview tab -->
    <div id="tab-users" class="tab-panel active">
        <div class="chart-grid">
            <div class="chart-card">
                <h3 id="u-chart1-lbl">Sessions Per Day</h3>
                <canvas id="u-chart1"></canvas>
            </div>
            <div class="chart-card">
                <h3 id="u-chart2-lbl">Language Distribution</h3>
                <canvas id="u-chart2"></canvas>
            </div>
            <div class="chart-card">
                <h3 id="u-chart3-lbl">Timezone Distribution</h3>
                <canvas id="u-chart3"></canvas>
            </div>
        </div>
        <p class="section-label">Sessions (<span id="session-count">0</span>)</p>
        <div style="overflow-x:auto;overflow-y:auto;max-height:260px" class="data-table-wrap">
            <table>
                <thead><tr>
                    <th>Session</th><th>First Seen</th><th>Last Seen</th>
                    <th>Duration</th><th>Pages</th><th>Language</th><th>Timezone</th>
                </tr></thead>
                <tbody id="sessions-tbody"><tr><td colspan="7" class="status-msg">Loading...</td></tr></tbody>
            </table>
        </div>
    </div>

    <!-- Technical Profile tab -->
    <div id="tab-technical" class="tab-panel">
        <div class="chart-grid">
            <div class="chart-card">
                <h3>Mobile vs Desktop</h3>
                <canvas id="t-chart1"></canvas>
            </div>
            <div class="chart-card">
                <h3>Browser Share</h3>
                <canvas id="t-chart2"></canvas>
            </div>
            <div class="chart-card">
                <h3>OS Distribution</h3>
                <canvas id="t-chart3"></canvas>
            </div>
            <div class="chart-card">
                <h3>Screen Resolutions</h3>
                <canvas id="t-chart4"></canvas>
            </div>
            <div class="chart-card">
                <h3>Device Memory (GB)</h3>
                <canvas id="t-chart5"></canvas>
            </div>
            <div class="chart-card">
                <h3>Color Scheme Preference</h3>
                <canvas id="t-chart6"></canvas>
            </div>
        </div>
        <p class="section-label">Technical Details per Session</p>
        <div style="overflow-x:auto;overflow-y:auto;max-height:260px" class="data-table-wrap">
            <table>
                <thead><tr>
                    <th>Session</th><th>Type</th><th>Browser</th><th>OS</th>
                    <th>Screen</th><th>Memory</th><th>Network</th><th>Color Scheme</th><th>User Agent</th>
                </tr></thead>
                <tbody id="tech-tbody"><tr><td colspan="9" class="status-msg">Loading...</td></tr></tbody>
            </table>
        </div>
    </div>
</main>

<script src="/js/insights.js"></script>
</body>
</html>
