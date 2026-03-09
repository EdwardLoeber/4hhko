<?php
// View: presentation only. Must be included by dashboard.php (the controller).
if (!defined('IN_APP')) { http_response_code(403); exit; }
?>
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

<script src="/js/dashboard.js"></script>
</body>
</html>
