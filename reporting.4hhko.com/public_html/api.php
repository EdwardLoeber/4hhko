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
// URLs: /api/{resource}  or  /api/{resource}/{id}
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

if ($id !== null && !ctype_digit($id)) {
    http_response_code(400);
    echo json_encode(['error' => 'ID must be a positive integer']);
    exit;
}

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
    $stmt = $db->prepare('SELECT id, password_hash FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($pass, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        exit;
    }
    session_name('sid');
    session_start();
    session_regenerate_id(true);   // prevent session fixation
    $_SESSION['authenticated'] = true;
    $_SESSION['user_id']       = $user['id'];
    http_response_code(200);
    echo json_encode(['ok' => true]);
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

// ── Route Dispatch ────────────────────────────────────────────────────────
switch ($method) {

    // GET /api/{resource}        → all rows (newest first, max 500)
    // GET /api/{resource}/{id}   → single row by id
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

    // POST /api/{resource}   → insert new row, returns { id }
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
        // Sanitize: only allow word-character column names
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

    // PUT /api/{resource}/{id}   → update row by id
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

    // DELETE /api/{resource}/{id}   → delete row by id
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
