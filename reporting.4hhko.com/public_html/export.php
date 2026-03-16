<?php
// Export a report category as PDF (mPDF) or HTML fallback.
// Returns JSON { url: '/exports/filename.pdf' }
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

$category = $_GET['category'] ?? '';
if (!in_array($category, ['traffic', 'errors', 'engagement'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid category']);
    exit;
}

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

$userId = (int)($_SESSION['user_id'] ?? 0);

// Fetch analyst comment for this category
$stmt = $db->prepare("SELECT comment FROM report_comments WHERE user_id = ? AND category = ?");
$stmt->execute([$userId, $category]);
$commentRow = $stmt->fetch();
$comment    = $commentRow ? $commentRow['comment'] : '';

// ── Fetch data ────────────────────────────────────────────────────────────
$tables = [];
switch ($category) {
    case 'traffic':
        $tables['Pageviews']  = $db->query("SELECT * FROM pageviews ORDER BY id DESC LIMIT 200")->fetchAll();
        $tables['Page Exits'] = $db->query("SELECT * FROM page_exits ORDER BY id DESC LIMIT 200")->fetchAll();
        break;
    case 'errors':
        $tables['Errors'] = $db->query("SELECT * FROM errors ORDER BY id DESC LIMIT 200")->fetchAll();
        break;
    case 'engagement':
        $tables['Activity Events'] = $db->query("SELECT * FROM activity_events ORDER BY id DESC LIMIT 200")->fetchAll();
        $tables['Events']          = $db->query("SELECT * FROM events ORDER BY id DESC LIMIT 200")->fetchAll();
        break;
}

// ── Build HTML ────────────────────────────────────────────────────────────
function buildTableHtml(array $rows): string {
    if (empty($rows)) return '<p><em>No data.</em></p>';
    $cols = array_keys($rows[0]);
    $html = '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px;">';
    $html .= '<thead><tr>';
    foreach ($cols as $c) {
        $html .= '<th style="background:#f0f0f0;padding:4px 6px;">' . htmlspecialchars($c) . '</th>';
    }
    $html .= '</tr></thead><tbody>';
    foreach ($rows as $row) {
        $html .= '<tr>';
        foreach ($cols as $c) {
            $v = $row[$c];
            $display = (is_array($v) || is_object($v)) ? json_encode($v) : (string)($v ?? '');
            if (strlen($display) > 60) $display = substr($display, 0, 60) . '…';
            $html .= '<td style="padding:3px 6px;">' . htmlspecialchars($display) . '</td>';
        }
        $html .= '</tr>';
    }
    $html .= '</tbody></table>';
    return $html;
}

$title     = ucfirst($category) . ' Report';
$generated = date('Y-m-d H:i:s T');

$html  = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
$html .= '<title>' . htmlspecialchars($title) . '</title>';
$html .= '<style>body{font-family:Arial,sans-serif;color:#222;margin:20px;}
h1{color:#1a1a2e;border-bottom:2px solid #4a90e2;padding-bottom:8px;}
h2{color:#333;margin-top:24px;}
.meta{color:#666;font-size:12px;margin-bottom:20px;}
.comment{background:#f9f9f9;border-left:3px solid #4a90e2;padding:10px;margin:16px 0;font-style:italic;}
</style></head><body>';
$html .= '<h1>4hhko Analytics — ' . htmlspecialchars($title) . '</h1>';
$html .= '<p class="meta">Generated: ' . htmlspecialchars($generated) . '</p>';

if ($comment !== '') {
    $html .= '<div class="comment"><strong>Analyst Comment:</strong><br>' . nl2br(htmlspecialchars($comment)) . '</div>';
}

foreach ($tables as $tname => $rows) {
    $html .= '<h2>' . htmlspecialchars($tname) . ' (' . count($rows) . ' rows)</h2>';
    $html .= buildTableHtml($rows);
}

$html .= '</body></html>';

// ── Write file ────────────────────────────────────────────────────────────
$exportsDir = __DIR__ . '/exports/';
if (!is_dir($exportsDir)) {
    mkdir($exportsDir, 0755, true);
}

$basename = $category . '-' . date('Ymd-His') . '-u' . $userId;

$vendorAutoload = __DIR__ . '/vendor/autoload.php';
if (file_exists($vendorAutoload)) {
    require_once $vendorAutoload;
    try {
        $mpdf = new \Mpdf\Mpdf([
            'mode'   => 'utf-8',
            'format' => 'A4',
            'margin_left'  => 10,
            'margin_right' => 10,
            'margin_top'   => 15,
            'margin_bottom'=> 15,
        ]);
        $mpdf->WriteHTML($html);
        $filename   = $basename . '.pdf';
        $mpdf->Output($exportsDir . $filename, 'F');
        $exportUrl  = '/exports/' . $filename;
    } catch (\Exception $e) {
        // Fall through to HTML fallback
        $filename  = $basename . '.html';
        file_put_contents($exportsDir . $filename, $html);
        $exportUrl = '/exports/' . $filename;
    }
} else {
    // HTML fallback when mPDF not available
    $filename  = $basename . '.html';
    file_put_contents($exportsDir . $filename, $html);
    $exportUrl = '/exports/' . $filename;
}

// Persist the export URL so viewers can access it via /api/saved
$stmt = $db->prepare(
    "INSERT INTO report_comments (user_id, category, comment, export_url, updated_at)
     VALUES (?, ?, '', ?, NOW())
     ON CONFLICT (user_id, category) DO UPDATE
     SET export_url = EXCLUDED.export_url, updated_at = NOW()"
);
$stmt->execute([$userId, $category, $exportUrl]);

echo json_encode(['url' => $exportUrl]);
