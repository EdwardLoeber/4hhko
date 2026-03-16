<?php
// Export User Insights as PDF/HTML with embedded chart images.
// Accepts POST JSON: { comment, charts: [{id, label, img}], stats, sessions }
// Returns JSON: { url: '/exports/filename.pdf' }
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
$charts   = is_array($body['charts'])   ? $body['charts']   : [];
$stats    = is_array($body['stats'])    ? $body['stats']    : [];
$sessions = is_array($body['sessions']) ? $body['sessions'] : [];

// ── DB ────────────────────────────────────────────────────────────────────
try {
    $db = new PDO('pgsql:host=localhost;dbname=analytics', 'femmy', 'applejacktwilightsparkle');
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

// ── Build HTML ─────────────────────────────────────────────────────────────
$h = function(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); };

$html  = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
$html .= '<title>User Insights Report</title>';
$html .= '<style>
body { font-family: Arial, sans-serif; color: #222; margin: 20px; font-size: 12px; }
h1 { color: #1a1a2e; border-bottom: 2px solid #4a90e2; padding-bottom: 8px; font-size: 18px; }
h2 { color: #444; margin: 20px 0 8px; font-size: 12px; text-transform: uppercase;
     letter-spacing: 0.06em; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
.meta { color: #888; font-size: 11px; margin-bottom: 16px; }
.stats-grid { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
.stat-box { background: #f5f7fa; border-radius: 5px; padding: 8px 14px; flex: 1; min-width: 100px; border: 1px solid #e8eaf0; }
.stat-box .val { font-size: 16px; font-weight: 700; color: #1a1a2e; }
.stat-box .lbl { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
.comment { background: #f9fbff; border-left: 3px solid #4a90e2; padding: 10px 14px; margin: 14px 0;
           font-style: italic; color: #333; white-space: pre-wrap; }
.chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
.chart-box { background: #fafafa; border: 1px solid #eee; border-radius: 5px; padding: 8px; }
.chart-box h3 { font-size: 9px; color: #999; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em; }
.chart-box img { width: 100%; height: auto; display: block; }
table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
th { background: #f0f2f5; padding: 4px 6px; border: 1px solid #ddd; text-align: left; font-size: 9px; }
td { padding: 3px 6px; border: 1px solid #eee; }
tr:nth-child(even) { background: #fafafa; }
</style></head><body>';

$html .= '<h1>4hhko Analytics — User Insights Report</h1>';
$html .= '<p class="meta">Generated: ' . $h($generated) . ' &nbsp;|&nbsp; Role: ' . $h($role) . '</p>';

// Stats summary
$html .= '<h2>Summary</h2><div class="stats-grid">';
$statDefs = [
    'unique_sessions'  => 'Unique Sessions',
    'total_pageviews'  => 'Total Pageviews',
    'first_access'     => 'First Access',
    'last_access'      => 'Last Access',
];
foreach ($statDefs as $key => $label) {
    $val = $stats[$key] ?? '—';
    $html .= '<div class="stat-box"><div class="val">' . $h((string)$val) . '</div><div class="lbl">' . $h($label) . '</div></div>';
}
$html .= '</div>';

// Analyst comment
if ($comment !== '') {
    $html .= '<h2>Analyst Comment</h2>';
    $html .= '<div class="comment">' . $h($comment) . '</div>';
}

// Charts — all chart images embedded as base64 PNG
if (!empty($charts)) {
    $html .= '<h2>Charts</h2><div class="chart-grid">';
    foreach ($charts as $chart) {
        $label = $chart['label'] ?? '';
        $img   = $chart['img']   ?? '';
        if (empty($img) || strpos($img, 'data:image/') !== 0) continue;
        $html .= '<div class="chart-box"><h3>' . $h($label) . '</h3>';
        $html .= '<img src="' . $h($img) . '" alt="' . $h($label) . '"></div>';
    }
    $html .= '</div>';
}

// Sessions sample table
if (!empty($sessions)) {
    $html .= '<h2>Sessions — sample (' . count($sessions) . ' rows)</h2>';
    $cols = ['session_id','first_seen','last_seen','session_duration_secs','pageview_count',
             'language','timezone','network_type','color_scheme'];
    $html .= '<table><thead><tr>';
    foreach ($cols as $c) $html .= '<th>' . $h($c) . '</th>';
    $html .= '</tr></thead><tbody>';
    foreach ($sessions as $row) {
        $html .= '<tr>';
        foreach ($cols as $c) {
            $v = (string)($row[$c] ?? '');
            if ($c === 'session_id') $v = substr($v, 0, 10) . '…';
            $html .= '<td>' . $h($v) . '</td>';
        }
        $html .= '</tr>';
    }
    $html .= '</tbody></table>';
}

$html .= '</body></html>';

// ── Write file ─────────────────────────────────────────────────────────────
$exportsDir = __DIR__ . '/exports/';
if (!is_dir($exportsDir)) mkdir($exportsDir, 0755, true);

$vendorAutoload = __DIR__ . '/vendor/autoload.php';
if (file_exists($vendorAutoload)) {
    require_once $vendorAutoload;
    try {
        $mpdf = new \Mpdf\Mpdf([
            'mode'          => 'utf-8',
            'format'        => 'A4',
            'margin_left'   => 10,
            'margin_right'  => 10,
            'margin_top'    => 15,
            'margin_bottom' => 15,
        ]);
        $mpdf->WriteHTML($html);
        $filename  = $basename . '.pdf';
        $mpdf->Output($exportsDir . $filename, 'F');
        $exportUrl = '/exports/' . $filename;
    } catch (\Exception $e) {
        $filename  = $basename . '.html';
        file_put_contents($exportsDir . $filename, $html);
        $exportUrl = '/exports/' . $filename;
    }
} else {
    $filename  = $basename . '.html';
    file_put_contents($exportsDir . $filename, $html);
    $exportUrl = '/exports/' . $filename;
}

// ── Persist comment + export URL ───────────────────────────────────────────
$stmt = $db->prepare(
    "INSERT INTO report_comments (user_id, category, comment, export_url, updated_at)
     VALUES (?, 'insights', ?, ?, NOW())
     ON CONFLICT (user_id, category) DO UPDATE
     SET comment = EXCLUDED.comment, export_url = EXCLUDED.export_url, updated_at = NOW()"
);
$stmt->execute([$userId, $comment, $exportUrl]);

echo json_encode(['url' => $exportUrl]);
