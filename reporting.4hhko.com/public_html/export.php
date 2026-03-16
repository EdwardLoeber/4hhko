<?php
// Export a report category as PDF/HTML.
// Accepts POST JSON: { category, comment, charts: [{label, img}] }
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
$category = $body['category'] ?? '';
$comment  = trim($body['comment'] ?? '');
$charts   = is_array($body['charts']) ? $body['charts'] : [];

if (!in_array($category, ['traffic', 'errors', 'engagement'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid category']);
    exit;
}

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

$userId = (int)($_SESSION['user_id'] ?? 0);

// ── Fetch sample data ─────────────────────────────────────────────────────
$tables = [];
switch ($category) {
    case 'traffic':
        $tables['Pageviews']  = $db->query("SELECT * FROM pageviews  ORDER BY id DESC LIMIT 50")->fetchAll();
        $tables['Page Exits'] = $db->query("SELECT * FROM page_exits ORDER BY id DESC LIMIT 50")->fetchAll();
        break;
    case 'errors':
        $tables['Errors'] = $db->query("SELECT * FROM errors ORDER BY id DESC LIMIT 50")->fetchAll();
        break;
    case 'engagement':
        $tables['Activity Events'] = $db->query("SELECT * FROM activity_events ORDER BY id DESC LIMIT 50")->fetchAll();
        $tables['Events']          = $db->query("SELECT * FROM events          ORDER BY id DESC LIMIT 50")->fetchAll();
        break;
}

// ── Helpers ────────────────────────────────────────────────────────────────
$h = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

function buildTableHtml(array $rows, callable $h): string {
    if (empty($rows)) return '<p><em>No data.</em></p>';
    $cols = array_keys($rows[0]);
    $out  = '<table><thead><tr>';
    foreach ($cols as $c) $out .= '<th>' . $h($c) . '</th>';
    $out .= '</tr></thead><tbody>';
    foreach ($rows as $row) {
        $out .= '<tr>';
        foreach ($cols as $c) {
            $v = $row[$c];
            $s = (is_array($v) || is_object($v)) ? json_encode($v) : (string)($v ?? '');
            if (strlen($s) > 60) $s = substr($s, 0, 60) . '…';
            $out .= '<td>' . $h($s) . '</td>';
        }
        $out .= '</tr>';
    }
    $out .= '</tbody></table>';
    return $out;
}

// ── Build HTML ─────────────────────────────────────────────────────────────
$title     = ucfirst($category) . ' Report';
$generated = date('Y-m-d H:i:s T');

$html  = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
$html .= '<title>' . $h($title) . '</title>';
$html .= '<style>
body  { font-family: Arial, sans-serif; color: #222; margin: 20px; font-size: 12px; }
h1    { color: #1a1a2e; border-bottom: 2px solid #4a90e2; padding-bottom: 8px; font-size: 18px; }
h2    { color: #444; margin: 22px 0 8px; font-size: 12px; text-transform: uppercase;
        letter-spacing: 0.06em; border-bottom: 1px solid #dde; padding-bottom: 4px; }
.meta { color: #888; font-size: 11px; margin-bottom: 16px; }
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
.section { margin-top: 20px; }
</style></head><body>';

$html .= '<h1>4hhko Analytics — ' . $h($title) . '</h1>';
$html .= '<p class="meta">Generated: ' . $h($generated) . '</p>';

if ($comment !== '') {
    $html .= '<div class="comment"><strong>Analyst Comment:</strong><br>' . $h($comment) . '</div>';
}

// Charts section
if (!empty($charts)) {
    $html .= '<h2>Charts</h2><div class="chart-grid">';
    foreach ($charts as $chart) {
        $label = $chart['label'] ?? '';
        $img   = $chart['img']   ?? '';
        if (empty($img)) continue;
        // Client strips the data URI prefix; reconstruct it here
        if (strpos($img, 'data:image/') !== 0) {
            $img = 'data:image/jpeg;base64,' . $img;
        }
        $html .= '<div class="chart-box"><h3>' . $h($label) . '</h3>';
        $html .= '<img src="' . $img . '" alt="' . $h($label) . '"></div>';
    }
    $html .= '</div>';
}

// Data tables section
foreach ($tables as $tname => $rows) {
    $html .= '<div class="section">';
    $html .= '<h2>' . $h($tname) . ' <span style="font-weight:400;color:#999">(' . count($rows) . ' sample rows)</span></h2>';
    $html .= buildTableHtml($rows, $h);
    $html .= '</div>';
}

$html .= '</body></html>';

// ── Write file ─────────────────────────────────────────────────────────────
$exportsDir = __DIR__ . '/exports/';
if (!is_dir($exportsDir)) mkdir($exportsDir, 0755, true);

$basename = $category . '-' . date('Ymd-His') . '-u' . $userId;

$filename  = $basename . '.html';
file_put_contents($exportsDir . $filename, $html);
$exportUrl = '/exports/' . $filename;

// ── Persist comment + export URL ───────────────────────────────────────────
$stmt = $db->prepare(
    "INSERT INTO report_comments (user_id, category, comment, export_url, updated_at)
     VALUES (?, ?, ?, ?, NOW())"
);
$stmt->execute([$userId, $category, $comment, $exportUrl]);

// Enforce global cap of 10 saved reports — delete oldest beyond the limit
$db->exec("DELETE FROM report_comments WHERE id NOT IN (SELECT id FROM report_comments ORDER BY updated_at DESC LIMIT 10)");

echo json_encode(['url' => $exportUrl]);
