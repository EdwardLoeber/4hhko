<?php
header('Access-Control-Allow-Origin: https://test.4hhko.com');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { http_response_code(405); exit; }

$p = json_decode(file_get_contents('php://input'), true);
if (!$p) { http_response_code(400); exit; }

$dsn = 'pgsql:host=localhost;dbname=analytics';
$db  = new PDO($dsn, 'femmy', '');

if ($p['type'] === 'pageview') {
    $t   = $p['technographics'] ?? [];
    $tim = $p['timing'] ?? [];
    $db->prepare('INSERT INTO pageviews
        (session_id, url, title, referrer, entered_at, timestamp,
         user_agent, language, cookies_enabled, js_enabled,
         images_enabled, css_enabled,
         screen_width, screen_height, viewport_width, viewport_height,
         network_type, page_start_time, page_end_time, total_load_time,
         technographics, timing)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      ->execute([
        $p['session'], $p['url'], $p['title'], $p['referrer'],
        $p['enteredAt'], $p['timestamp'],
        $t['userAgent'], $t['language'],
        $t['cookiesEnabled'] ? 'true' : 'false',
        $t['jsEnabled']      ? 'true' : 'false',
        $t['imagesEnabled']  ? 'true' : 'false',
        $t['cssEnabled']     ? 'true' : 'false',
        $t['screenWidth'], $t['screenHeight'],
        $t['viewportWidth'], $t['viewportHeight'],
        $t['network']['effectiveType'] ?? null,
        $tim['pageStartTime'], $tim['pageEndTime'], $tim['totalLoadTime'],
        json_encode($t), json_encode($tim)
      ]);
} elseif ($p['type'] === 'activity') {
    $db->prepare('INSERT INTO activity_events (session_id, url, timestamp, events)
        VALUES (?,?,?,?)')
      ->execute([
        $p['session'], $p['url'], $p['timestamp'],
        json_encode($p['events'] ?? [])
      ]);

} elseif ($p['type'] === 'error') {
    $e = $p['error'] ?? [];
    $db->prepare('INSERT INTO errors
        (session_id, url, timestamp, type, message, source, line, col, stack, error_data)
        VALUES (?,?,?,?,?,?,?,?,?,?)')
      ->execute([
        $p['session'], $p['url'], $p['timestamp'],
        $e['type']    ?? null, $e['message'] ?? null, $e['source'] ?? null,
        $e['line']    ?? null, $e['column']  ?? null, $e['stack']  ?? null,
        json_encode($e)
      ]);

} elseif ($p['type'] === 'page_exit') {
    $db->prepare('INSERT INTO page_exits (session_id, url, timestamp, time_on_page, vitals)
        VALUES (?,?,?,?,?)')
      ->execute([
        $p['session'], $p['url'], $p['timestamp'],
        $p['timeOnPage'] ?? null,
        json_encode($p['vitals'] ?? [])
      ]);
}

http_response_code(204);
