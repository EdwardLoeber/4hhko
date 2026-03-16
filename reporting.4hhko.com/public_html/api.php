<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── DB Connection ─────────────────────────────────────────────────────────
try {
    $db = new PDO('pgsql:host=localhost;dbname=analytics', 'femmy', 'applejacktwilightsparkle');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(['error' => 'Database unavailable']);
    exit;
}

// ── Route Parsing ─────────────────────────────────────────────────────────
$uri   = strtok($_SERVER['REQUEST_URI'], '?');
$parts = array_values(array_filter(explode('/', trim($uri, '/'))));

if (count($parts) < 2 || $parts[0] !== 'api') {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
    exit;
}

$resource = $parts[1];
$id       = $parts[2] ?? null;
$method   = $_SERVER['REQUEST_METHOD'];

// ── Special: Login ────────────────────────────────────────────────────────
if ($resource === 'login') {
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }
    $body  = json_decode(file_get_contents('php://input'), true);
    $email = trim($body['email'] ?? '');
    $pass  = $body['password'] ?? '';
    if (!$email || !$pass) {
        http_response_code(400);
        echo json_encode(['error' => 'Email and password are required']);
        exit;
    }
    $stmt = $db->prepare('SELECT id, password_hash, role, sections FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($pass, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        exit;
    }
    session_name('sid');
    session_start();
    session_regenerate_id(true);
    $_SESSION['authenticated'] = true;
    $_SESSION['user_id']       = $user['id'];
    $_SESSION['role']          = $user['role'];
    // Parse PostgreSQL TEXT[] e.g. "{traffic,errors}" → ['traffic','errors']
    $secStr = trim($user['sections'] ?? '{}', '{}');
    $_SESSION['sections'] = $secStr === '' ? [] : explode(',', $secStr);
    echo json_encode(['ok' => true, 'role' => $user['role']]);
    exit;
}

// ── Session Auth for all other routes ─────────────────────────────────────
session_name('sid');
if (session_status() === PHP_SESSION_NONE) session_start();
if (empty($_SESSION['authenticated'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthenticated']);
    exit;
}

$currentRole     = $_SESSION['role'] ?? 'viewer';
$currentUserId   = (int)($_SESSION['user_id'] ?? 0);
$currentSections = $_SESSION['sections'] ?? [];

// ── ID validation (skip for category slugs under /api/reports/{category}) ─
if ($id !== null && $resource !== 'reports' && $resource !== 'comments' && !ctype_digit($id)) {
    http_response_code(400);
    echo json_encode(['error' => 'ID must be a positive integer']);
    exit;
}

// ── Special: Reports ──────────────────────────────────────────────────────
if ($resource === 'reports') {
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }
    $category = $id;
    if (!$category) {
        echo json_encode(['categories' => ['traffic', 'errors', 'engagement']]);
        exit;
    }
    switch ($category) {
        case 'traffic':
            $pvRows = $db->query("SELECT * FROM pageviews ORDER BY id DESC LIMIT 500")->fetchAll();
            $peRows = $db->query("SELECT * FROM page_exits ORDER BY id DESC LIMIT 500")->fetchAll();
            echo json_encode(['pageviews' => $pvRows, 'page_exits' => $peRows]);
            break;
        case 'errors':
            $rows = $db->query("SELECT * FROM errors ORDER BY id DESC LIMIT 500")->fetchAll();
            echo json_encode(['errors' => $rows]);
            break;
        case 'engagement':
            $aeRows = $db->query("SELECT * FROM activity_events ORDER BY id DESC LIMIT 500")->fetchAll();
            $evRows = $db->query("SELECT * FROM events ORDER BY id DESC LIMIT 500")->fetchAll();
            echo json_encode(['activity_events' => $aeRows, 'events' => $evRows]);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown category']);
    }
    exit;
}

// ── Special: Comments ─────────────────────────────────────────────────────
if ($resource === 'comments') {
    if ($method === 'GET') {
        $stmt = $db->prepare(
            "SELECT category, comment, updated_at FROM report_comments WHERE user_id = ?"
        );
        $stmt->execute([$currentUserId]);
        echo json_encode($stmt->fetchAll());
    } elseif ($method === 'POST') {
        if ($currentRole === 'viewer') {
            http_response_code(403);
            echo json_encode(['error' => 'Viewers cannot save comments']);
            exit;
        }
        $body     = json_decode(file_get_contents('php://input'), true);
        $category = $body['category'] ?? '';
        $comment  = $body['comment'] ?? '';
        if (!in_array($category, ['traffic', 'errors', 'engagement'], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid category']);
            exit;
        }
        $stmt = $db->prepare(
            "INSERT INTO report_comments (user_id, category, comment, updated_at)
             VALUES (?, ?, ?, NOW())
             ON CONFLICT (user_id, category) DO UPDATE
             SET comment = EXCLUDED.comment, updated_at = NOW()"
        );
        $stmt->execute([$currentUserId, $category, $comment]);
        echo json_encode(['ok' => true]);
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
    exit;
}

// ── Special: Saved (all analyst comments + export links) ─────────────────
if ($resource === 'saved') {
    if ($method === 'GET') {
        $stmt = $db->query(
            "SELECT rc.id, u.email, rc.category, rc.comment, rc.export_url, rc.updated_at
             FROM report_comments rc
             JOIN users u ON u.id = rc.user_id
             WHERE rc.comment <> '' OR rc.export_url IS NOT NULL
             ORDER BY rc.category, rc.updated_at DESC"
        );
        echo json_encode($stmt->fetchAll());
    } elseif ($method === 'DELETE') {
        // Analysts can delete their own; super_admin can delete any
        if (!$id || !ctype_digit((string)$id)) {
            http_response_code(400);
            echo json_encode(['error' => 'DELETE requires a numeric id']);
            exit;
        }
        // Verify the row exists and the caller is allowed to delete it
        if ($currentRole === 'super_admin') {
            $chk = $db->prepare("SELECT id FROM report_comments WHERE id = ?");
            $chk->execute([$id]);
        } elseif ($currentRole === 'analyst') {
            $chk = $db->prepare("SELECT id FROM report_comments WHERE id = ? AND user_id = ?");
            $chk->execute([$id, $currentUserId]);
        } else {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
            exit;
        }
        if (!$chk->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found or not authorized']);
            exit;
        }
        // Row confirmed — delete it
        $del = $db->prepare("DELETE FROM report_comments WHERE id = ?");
        $del->execute([$id]);
        http_response_code(204);
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
    exit;
}

// ── Special: Users (super_admin only) ─────────────────────────────────────
if ($resource === 'users') {
    if ($currentRole !== 'super_admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }

    // Helper to convert pg TEXT[] string to PHP array
    $parseSections = function(string $pgArr): array {
        $s = trim($pgArr, '{}');
        return $s === '' ? [] : explode(',', $s);
    };

    switch ($method) {
        case 'GET':
            $rows = $db->query("SELECT id, email, role, sections FROM users ORDER BY id")->fetchAll();
            foreach ($rows as &$row) {
                $row['sections'] = $parseSections($row['sections'] ?? '{}');
            }
            echo json_encode($rows);
            break;

        case 'POST':
            $body  = json_decode(file_get_contents('php://input'), true);
            $email = trim($body['email'] ?? '');
            $pass  = $body['password'] ?? '';
            $role  = $body['role'] ?? 'viewer';
            $secs  = $body['sections'] ?? [];
            if (!$email || !$pass) {
                http_response_code(400);
                echo json_encode(['error' => 'Email and password required']);
                exit;
            }
            if (!in_array($role, ['super_admin', 'analyst', 'viewer'], true)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid role']);
                exit;
            }
            $hash   = password_hash($pass, PASSWORD_DEFAULT);
            $secsPg = '{' . implode(',', array_map('strval', $secs)) . '}';
            $stmt   = $db->prepare(
                "INSERT INTO users (email, password_hash, role, sections) VALUES (?, ?, ?, ?) RETURNING id"
            );
            $stmt->execute([$email, $hash, $role, $secsPg]);
            $row = $stmt->fetch();
            http_response_code(201);
            echo json_encode(['id' => $row['id']]);
            break;

        case 'PUT':
            if (!$id || !ctype_digit((string)$id)) {
                http_response_code(400);
                echo json_encode(['error' => 'PUT requires a numeric id']);
                exit;
            }
            $body = json_decode(file_get_contents('php://input'), true);
            $role = $body['role'] ?? null;
            $secs = $body['sections'] ?? null;
            if ($role !== null && !in_array($role, ['super_admin', 'analyst', 'viewer'], true)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid role']);
                exit;
            }
            if ($role !== null && $secs !== null) {
                $secsPg = '{' . implode(',', array_map('strval', $secs)) . '}';
                $stmt = $db->prepare("UPDATE users SET role = ?, sections = ? WHERE id = ?");
                $stmt->execute([$role, $secsPg, $id]);
            } elseif ($role !== null) {
                $stmt = $db->prepare("UPDATE users SET role = ? WHERE id = ?");
                $stmt->execute([$role, $id]);
            } elseif ($secs !== null) {
                $secsPg = '{' . implode(',', array_map('strval', $secs)) . '}';
                $stmt = $db->prepare("UPDATE users SET sections = ? WHERE id = ?");
                $stmt->execute([$secsPg, $id]);
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'Nothing to update']);
                exit;
            }
            echo json_encode(['ok' => true]);
            break;

        case 'DELETE':
            if (!$id || !ctype_digit((string)$id)) {
                http_response_code(400);
                echo json_encode(['error' => 'DELETE requires a numeric id']);
                exit;
            }
            $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$id]);
            http_response_code(204);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
    exit;
}

// ── Special: Insights (analyst + super_admin only) ────────────────────────
if ($resource === 'insights') {
    if ($currentRole === 'viewer') {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $stats = $db->query(
        "SELECT COUNT(DISTINCT session_id) AS unique_sessions,
                COUNT(*) AS total_pageviews,
                MIN(timestamp)::text AS first_access,
                MAX(timestamp)::text AS last_access
         FROM pageviews"
    )->fetch();

    $sessions = $db->query(
        "SELECT * FROM user_sessions ORDER BY last_seen DESC LIMIT 300"
    )->fetchAll();

    $sessionsByDay = $db->query(
        "SELECT DATE(first_seen)::text AS day, COUNT(*) AS cnt
         FROM user_sessions GROUP BY day ORDER BY day"
    )->fetchAll();

    $langs = $db->query(
        "SELECT language, COUNT(*) AS cnt FROM pageviews
         WHERE language IS NOT NULL
         GROUP BY language ORDER BY cnt DESC LIMIT 15"
    )->fetchAll();

    $timezones = $db->query(
        "SELECT technographics->>'timezone' AS timezone, COUNT(*) AS cnt
         FROM pageviews WHERE technographics->>'timezone' IS NOT NULL
         GROUP BY timezone ORDER BY cnt DESC LIMIT 15"
    )->fetchAll();

    $screens = $db->query(
        "SELECT screen_width || 'x' || screen_height AS resolution, COUNT(*) AS cnt
         FROM pageviews
         WHERE screen_width IS NOT NULL AND screen_height IS NOT NULL
         GROUP BY screen_width, screen_height ORDER BY cnt DESC LIMIT 10"
    )->fetchAll();

    $memory = $db->query(
        "SELECT technographics->>'memory' AS memory_gb, COUNT(*) AS cnt
         FROM pageviews WHERE technographics->>'memory' IS NOT NULL
         GROUP BY memory_gb ORDER BY memory_gb::numeric"
    )->fetchAll();

    $colorScheme = $db->query(
        "SELECT technographics->>'colorScheme' AS scheme, COUNT(*) AS cnt
         FROM pageviews WHERE technographics->>'colorScheme' IS NOT NULL
         GROUP BY scheme ORDER BY cnt DESC"
    )->fetchAll();

    echo json_encode([
        'stats'          => $stats,
        'sessions'       => $sessions,
        'sessions_by_day'=> $sessionsByDay,
        'langs'          => $langs,
        'timezones'      => $timezones,
        'screens'        => $screens,
        'memory'         => $memory,
        'color_scheme'   => $colorScheme,
    ]);
    exit;
}

// ── Resource Whitelist ────────────────────────────────────────────────────
$tableMap = [
    'pageviews'  => 'pageviews',
    'activity'   => 'activity_events',
    'errors'     => 'errors',
    'page_exits' => 'page_exits',
    'events'     => 'events',
];

if (!array_key_exists($resource, $tableMap)) {
    http_response_code(404);
    echo json_encode(['error' => "Unknown resource '$resource'"]);
    exit;
}

$table = $tableMap[$resource];

// ── Role gate: only super_admin can write ─────────────────────────────────
if ($method !== 'GET' && $currentRole !== 'super_admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden: read-only access']);
    exit;
}

// ── Route Dispatch ────────────────────────────────────────────────────────
switch ($method) {

    case 'GET':
        if ($id === null) {
            $stmt = $db->query("SELECT * FROM $table ORDER BY id DESC LIMIT 500");
            echo json_encode($stmt->fetchAll());
        } else {
            $stmt = $db->prepare("SELECT * FROM $table WHERE id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['error' => 'Not found']);
            } else {
                echo json_encode($row);
            }
        }
        break;

    case 'POST':
        if ($id !== null) {
            http_response_code(400);
            echo json_encode(['error' => 'POST must not include an id in the URL']);
            exit;
        }
        $body = json_decode(file_get_contents('php://input'), true);
        if (!$body || !is_array($body)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON body']);
            exit;
        }
        $cols = array_values(array_filter(array_keys($body), fn($k) => preg_match('/^\w+$/', $k)));
        if (!$cols) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid fields provided']);
            exit;
        }
        $vals    = array_map(fn($k) => is_array($body[$k]) ? json_encode($body[$k]) : $body[$k], $cols);
        $colList = implode(', ', $cols);
        $phList  = implode(', ', array_fill(0, count($cols), '?'));
        $stmt    = $db->prepare("INSERT INTO $table ($colList) VALUES ($phList) RETURNING id");
        $stmt->execute(array_values($vals));
        $row = $stmt->fetch();
        http_response_code(201);
        echo json_encode(['id' => $row['id']]);
        break;

    case 'PUT':
        if ($id === null) {
            http_response_code(400);
            echo json_encode(['error' => 'PUT requires an id in the URL']);
            exit;
        }
        $body = json_decode(file_get_contents('php://input'), true);
        if (!$body || !is_array($body)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON body']);
            exit;
        }
        $cols = array_values(array_filter(array_keys($body), fn($k) => preg_match('/^\w+$/', $k) && $k !== 'id'));
        if (!$cols) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid fields to update']);
            exit;
        }
        $vals    = array_map(fn($k) => is_array($body[$k]) ? json_encode($body[$k]) : $body[$k], $cols);
        $vals[]  = $id;
        $setList = implode(', ', array_map(fn($k) => "$k = ?", $cols));
        $stmt    = $db->prepare("UPDATE $table SET $setList WHERE id = ?");
        $stmt->execute(array_values($vals));
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
        } else {
            echo json_encode(['updated' => true]);
        }
        break;

    case 'DELETE':
        if ($id === null) {
            http_response_code(400);
            echo json_encode(['error' => 'DELETE requires an id in the URL']);
            exit;
        }
        $stmt = $db->prepare("DELETE FROM $table WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
        } else {
            http_response_code(204);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
