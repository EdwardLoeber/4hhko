<?php
// View: presentation only. Must be included by dashboard.php (the controller).
if (!defined('IN_APP')) { http_response_code(403); exit; }
$role     = CURRENT_USER_ROLE;
$sections = CURRENT_USER_SECTIONS;

// Determine which report tabs this user can see
$visibleTabs = [];
foreach (['traffic', 'errors', 'engagement'] as $s) {
    if (canSeeSection($s)) $visibleTabs[] = $s;
}
$tabLabels = ['traffic' => 'Traffic', 'errors' => 'Errors', 'engagement' => 'Engagement'];
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard — 4hhko Analytics</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.classless.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root { font-size: 14px; }
        body { padding: 0; }

        header { padding: 0.5rem 1rem; }
        header nav { display: flex; justify-content: space-between; align-items: center; }
        header nav ul { margin: 0; padding: 0; list-style: none; display: flex; gap: 0.75rem; align-items: center; }
        header nav ul li a { color: inherit; font-size: 0.85rem; }
        header nav strong { font-size: 0.95rem; }

        main { padding: 0.75rem 1rem; }

        .tab-bar { display: flex; gap: 0; border-bottom: 2px solid var(--pico-muted-border-color); margin-bottom: 0.75rem; }
        .tab-btn {
            padding: 0.4rem 0.9rem;
            cursor: pointer;
            background: none;
            border: none;
            border-bottom: 2px solid transparent;
            font-size: 0.8rem;
            color: var(--pico-muted-color);
            margin-bottom: -2px;
        }
        .tab-btn:hover { color: var(--pico-primary); }
        .tab-btn.active { color: var(--pico-primary); border-bottom-color: var(--pico-primary); font-weight: 600; }

        .report-section { display: none; }
        .report-section.active { display: block; }

        .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-bottom: 0.75rem; }
        @media (max-width: 700px) { .chart-grid { grid-template-columns: 1fr; } }

        .chart-card { background: var(--pico-card-background-color); border-radius: var(--pico-border-radius); padding: 0.6rem 0.8rem; box-shadow: var(--pico-card-box-shadow); }
        .chart-card h3 { font-size: 0.72rem; color: var(--pico-muted-color); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.04em; }
        .chart-card canvas { max-height: 180px; }

        .data-table-wrap { margin-bottom: 0.75rem; }
        .data-table-wrap table { width: 100%; font-size: 0.75rem; border-collapse: collapse; }
        .data-table-wrap th { position: sticky; top: 0; background: var(--pico-card-background-color); padding: 4px 8px; font-size: 0.72rem; border-bottom: 1px solid var(--pico-muted-border-color); text-align: left; }
        .data-table-wrap td { padding: 3px 8px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-bottom: 1px solid var(--pico-muted-border-color); }

        .status-msg { color: var(--pico-muted-color); font-size: 0.8rem; padding: 0.3rem 0; }

        .comment-section { margin-top: 0.6rem; }
        .comment-section label { font-weight: 600; font-size: 0.8rem; display: block; margin-bottom: 0.2rem; }
        .comment-section textarea { width: 100%; min-height: 70px; font-size: 0.8rem; padding: 0.4rem; }
        .comment-status { font-size: 0.72rem; color: var(--pico-muted-color); }

        .export-row { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.4rem; }
        .export-row button { font-size: 0.78rem; padding: 0.3rem 0.75rem; }
        .export-row a { font-size: 0.78rem; }

        .section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--pico-muted-color); margin: 0.5rem 0 0.3rem; }
    </style>
</head>
<body>

<header>
    <nav>
        <ul><li><strong>4hhko Analytics</strong></li></ul>
        <ul>
            <?php if ($role !== 'viewer'): ?>
            <li><a href="/insights.php">Insights</a></li>
            <?php endif; ?>
            <?php if ($role === 'super_admin'): ?>
            <li><a href="/users.php">Users</a></li>
            <?php endif; ?>
            <li><small><?= htmlspecialchars($role) ?></small></li>
            <li><a href="/logout.php">Logout</a></li>
        </ul>
    </nav>
</header>

<main>
<?php if (empty($visibleTabs)): ?>
    <p>You do not have access to any report sections.</p>
<?php else: ?>

    <div class="tab-bar">
    <?php foreach ($visibleTabs as $i => $tab): ?>
        <button class="tab-btn<?= $i === 0 ? ' active' : '' ?>" data-tab="<?= $tab ?>">
            <?= $tabLabels[$tab] ?>
        </button>
    <?php endforeach; ?>
        <button class="tab-btn" data-tab="saved-reports">Saved Reports</button>
    </div>

    <?php foreach ($visibleTabs as $i => $tab): ?>
    <section id="section-<?= $tab ?>" class="report-section<?= $i === 0 ? ' active' : '' ?>">

        <div class="chart-grid">
            <div class="chart-card">
                <h3 id="chart1-label-<?= $tab ?>">Chart 1</h3>
                <canvas id="chart1-<?= $tab ?>"></canvas>
            </div>
            <div class="chart-card">
                <h3 id="chart2-label-<?= $tab ?>">Chart 2</h3>
                <canvas id="chart2-<?= $tab ?>"></canvas>
            </div>
            <div class="chart-card" id="chart3-card-<?= $tab ?>" style="display:none">
                <h3 id="chart3-label-<?= $tab ?>">Chart 3</h3>
                <canvas id="chart3-<?= $tab ?>"></canvas>
            </div>
            <div class="chart-card" id="chart4-card-<?= $tab ?>" style="display:none">
                <h3 id="chart4-label-<?= $tab ?>">Chart 4</h3>
                <canvas id="chart4-<?= $tab ?>"></canvas>
            </div>
        </div>

        <div id="tables-<?= $tab ?>" class="data-table-wrap">
            <p class="status-msg">Loading data...</p>
        </div>

        <?php if ($role !== 'viewer'): ?>
        <div class="comment-section">
            <label for="comment-<?= $tab ?>">Analyst Comment</label>
            <textarea id="comment-<?= $tab ?>" placeholder="Add your analysis for this report..."></textarea>
            <div class="export-row">
                <span class="comment-status" id="comment-status-<?= $tab ?>"></span>
                <button id="export-btn-<?= $tab ?>" onclick="exportReport('<?= $tab ?>')">Export PDF</button>
                <a id="export-link-<?= $tab ?>" href="#" target="_blank" style="display:none">Open Export</a>
            </div>
        </div>
        <?php endif; ?>

    </section>
    <?php endforeach; ?>

    <section id="section-saved-reports" class="report-section">
        <h3>Saved Reports</h3>
        <p style="color:var(--pico-muted-color);font-size:0.875rem">Analyst comments and exported reports. You can delete entries you own<?= $role === 'super_admin' ? ' (or any entry as super_admin)' : '' ?>.</p>
        <div id="saved-reports-container"><p class="status-msg">Loading...</p></div>
    </section>

<?php endif; ?>
</main>

<script>
const APP = {
    role:     <?= json_encode(CURRENT_USER_ROLE) ?>,
    sections: <?= json_encode(CURRENT_USER_SECTIONS) ?>,
    tabs:     <?= json_encode($visibleTabs) ?>
};
</script>
<script src="/js/dashboard.js"></script>
</body>
</html>
