<?php
// Export User Insights as PDF/HTML with two clearly divided sections.
// Accepts POST JSON: { comment, charts: [{id, label, img}], stats, sessions }
// Returns JSON: { url: '/exports/filename' }
header('Content-Type: application/json');

session_name('sid');
if (session_status() === PHP_SESSION_NONE) session_start();

if (empty($_SESSION['authenticated'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthenticated']);
    exit;
}

$role = $_SESSION['role'] ?? 'viewer';
if ($role === 'viewer') {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$comment  = trim($body['comment'] ?? '');
$allCharts = is_array($body['charts'])   ? $body['charts']   : [];
$stats    = is_array($body['stats'])    ? $body['stats']    : [];
$sessions = is_array($body['sessions']) ? $body['sessions'] : [];

// Split charts into two sections by ID prefix
$userCharts = array_values(array_filter($allCharts, fn($c) => str_starts_with($c['id'] ?? '', 'u-')));
$techCharts = array_values(array_filter($allCharts, fn($c) => str_starts_with($c['id'] ?? '', 't-')));

// ── DB ────────────────────────────────────────────────────────────────────
require_once __DIR__ . '/db.php';
try {
    $db = new PDO(DB_DSN, DB_USER, DB_PASS);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(['error' => 'Database unavailable']);
    exit;
}

$userId    = (int)($_SESSION['user_id'] ?? 0);
$generated = date('Y-m-d H:i:s T');
$basename  = 'insights-' . date('Ymd-His') . '-u' . $userId;

// ── Helpers ────────────────────────────────────────────────────────────────
$h = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

function chartGrid(array $charts, callable $h): string {
    if (empty($charts)) return '';
    $out = '<div class="chart-grid">';
    foreach ($charts as $chart) {
        $label = $chart['label'] ?? '';
        $img   = $chart['img']   ?? '';
        if (empty($img)) continue;
        // Client strips the data URI prefix; reconstruct it here
        if (strpos($img, 'data:image/') !== 0) {
            $img = 'data:image/jpeg;base64,' . $img;
        }
        $out .= '<div class="chart-box"><h3>' . $h($label) . '</h3>';
        $out .= '<img src="' . $img . '" alt="' . $h($label) . '"></div>';
    }
    return $out . '</div>';
}

function sessionTableHtml(array $sessions, array $cols, callable $h, int $limit = 30): string {
    $rows = array_slice($sessions, 0, $limit);
    if (empty($rows)) return '<p><em>No data.</em></p>';
    $out = '<table><thead><tr>';
    foreach ($cols as [$key, $label]) $out .= '<th>' . $h($label) . '</th>';
    $out .= '</tr></thead><tbody>';
    foreach ($rows as $s) {
        $out .= '<tr>';
        foreach ($cols as [$key, $label]) {
            $v = (string)($s[$key] ?? '');
            if ($key === 'session_id') $v = substr($v, 0, 10) . '…';
            $out .= '<td>' . $h($v) . '</td>';
        }
        $out .= '</tr>';
    }
    $out .= '</tbody></table>';
    return $out;
}

// ── Build HTML ─────────────────────────────────────────────────────────────
$html  = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
$html .= '<title>User Insights Report</title>';
$html .= '<style>
body  { font-family: Arial, sans-serif; color: #222; margin: 20px; font-size: 12px; }
h1    { color: #1a1a2e; border-bottom: 2px solid #4a90e2; padding-bottom: 8px; font-size: 18px; }
h2    { color: #fff; background: #4a90e2; margin: 22px -4px 10px; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.07em; padding: 5px 10px; border-radius: 3px; }
h2.tech { background: #9b59b6; }
.meta { color: #888; font-size: 11px; margin-bottom: 14px; }
.stats-grid { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
.stat-box   { background: #f5f7fa; border-radius: 5px; padding: 8px 14px; flex: 1;
              min-width: 100px; border: 1px solid #e0e4ed; }
.stat-box .val { font-size: 15px; font-weight: 700; color: #1a1a2e; }
.stat-box .lbl { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
.comment { background: #f9fbff; border-left: 3px solid #4a90e2; padding: 10px 14px;
           margin: 14px 0; font-style: italic; white-space: pre-wrap; }
.chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
.chart-box  { background: #fafafa; border: 1px solid #eee; border-radius: 5px; padding: 8px; }
.chart-box h3 { font-size: 9px; color: #999; margin: 0 0 5px; text-transform: uppercase; letter-spacing: 0.05em; }
.chart-box img { width: 100%; height: auto; display: block; }
table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
th    { background: #f0f2f5; padding: 4px 6px; border: 1px solid #ddd; text-align: left; font-size: 9px; }
td    { padding: 3px 6px; border: 1px solid #eee; }
tr:nth-child(even) td { background: #fafafa; }
.section { margin-top: 4px; }
</style></head><body>';

$html .= '<h1>4hhko Analytics — User Insights Report</h1>';
$html .= '<p class="meta">Generated: ' . $h($generated) . '</p>';

// Stats summary
$html .= '<div class="stats-grid">';
foreach ([
    'unique_sessions' => 'Unique Sessions',
    'total_pageviews' => 'Total Pageviews',
    'first_access'    => 'First Access',
    'last_access'     => 'Last Access',
] as $key => $label) {
    $val = (string)($stats[$key] ?? '—');
    $html .= '<div class="stat-box"><div class="val">' . $h($val) . '</div><div class="lbl">' . $h($label) . '</div></div>';
}
$html .= '</div>';

if ($comment !== '') {
    $html .= '<div class="comment"><strong>Analyst Comment:</strong><br>' . $h($comment) . '</div>';
}

// ── Section 1: User Overview ───────────────────────────────────────────────
$html .= '<h2>User Overview</h2>';
$html .= '<div class="section">';
$html .= chartGrid($userCharts, $h);
$html .= sessionTableHtml($sessions, [
    ['session_id',            'Session'],
    ['first_seen',            'First Seen'],
    ['last_seen',             'Last Seen'],
    ['session_duration_secs', 'Duration (s)'],
    ['pageview_count',        'Pages'],
    ['language',              'Language'],
    ['timezone',              'Timezone'],
], $h);
$html .= '</div>';

// ── Section 2: Technical Profile ──────────────────────────────────────────
$html .= '<h2 class="tech">Technical Profile</h2>';
$html .= '<div class="section">';
$html .= chartGrid($techCharts, $h);
$html .= sessionTableHtml($sessions, [
    ['session_id',      'Session'],
    ['screen_width',    'Width'],
    ['screen_height',   'Height'],
    ['device_memory_gb','Memory (GB)'],
    ['network_type',    'Network'],
    ['color_scheme',    'Color Scheme'],
    ['user_agent',      'User Agent'],
], $h, 25);
$html .= '</div>';

$html .= '</body></html>';

// ── Write file ─────────────────────────────────────────────────────────────
$exportsDir = __DIR__ . '/exports/';
if (!is_dir($exportsDir)) mkdir($exportsDir, 0755, true);

$filename  = $basename . '.html';
file_put_contents($exportsDir . $filename, $html);
$exportUrl = '/exports/' . $filename;

// ── Persist comment + export URL ───────────────────────────────────────────
$stmt = $db->prepare(
    "INSERT INTO report_comments (user_id, category, comment, export_url, updated_at)
     VALUES (?, 'insights', ?, ?, NOW())"
);
$stmt->execute([$userId, $comment, $exportUrl]);

// Enforce global cap of 10 saved reports — delete oldest beyond the limit
$db->exec("DELETE FROM report_comments WHERE id NOT IN (SELECT id FROM report_comments ORDER BY updated_at DESC LIMIT 10)");

echo json_encode(['url' => $exportUrl]);
