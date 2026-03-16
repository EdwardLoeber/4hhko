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
        header nav { display: flex; justify-content: space-between; align-items: center; }
        header nav ul { margin: 0; padding: 0; list-style: none; display: flex; gap: 1rem; align-items: center; }
        header nav ul li a { color: inherit; }

        .tab-bar { display: flex; gap: 0; border-bottom: 2px solid var(--pico-muted-border-color); margin-bottom: 1.5rem; }
        .tab-btn {
            padding: 0.6rem 1.4rem;
            cursor: pointer;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            font-size: 0.95rem;
            color: var(--pico-muted-color);
            margin-bottom: -2px;
        }
        .tab-btn:hover { color: var(--pico-primary); }
        .tab-btn.active { color: var(--pico-primary); border-bottom-color: var(--pico-primary); font-weight: 600; }

        .report-section { display: none; }
        .report-section.active { display: block; }

        .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
        @media (max-width: 700px) { .chart-grid { grid-template-columns: 1fr; } }

        .chart-card { background: var(--pico-card-background-color); border-radius: var(--pico-border-radius); padding: 1rem; box-shadow: var(--pico-card-box-shadow); }
        .chart-card h3 { font-size: 0.875rem; color: var(--pico-muted-color); margin-bottom: 0.75rem; }

        .data-table-wrap { overflow-x: auto; margin-bottom: 1.5rem; }
        .data-table-wrap table { width: 100%; font-size: 0.8rem; }
        .data-table-wrap td { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .status-msg { color: var(--pico-muted-color); font-size: 0.875rem; padding: 0.5rem 0; }

        .comment-section { margin-top: 1rem; }
        .comment-section label { font-weight: 600; font-size: 0.9rem; }
        .comment-section textarea { width: 100%; min-height: 100px; }
        .comment-status { font-size: 0.8rem; color: var(--pico-muted-color); }

        .export-row { display: flex; align-items: center; gap: 1rem; margin-top: 0.75rem; }
        .export-row a { font-size: 0.85rem; }
    </style>
</head>
<body>

<header>
    <nav>
        <ul><li><strong>4hhko Analytics</strong></li></ul>
        <ul>
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
