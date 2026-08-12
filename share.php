<?php
declare(strict_types=1);

const CELESTE_SHARE_MAX_BYTES = 4 * 1024 * 1024;
const CELESTE_SHARE_HOURLY_LIMIT = 120;
const CELESTE_SHARE_ID_PATTERN = '/^[a-f0-9]{32}$/D';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store, max-age=0');

function json_response(int $status, array $payload)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(int $status, string $message)
{
    json_response($status, ['ok' => false, 'error' => $message]);
}

function storage_root(): string
{
    return __DIR__ . DIRECTORY_SEPARATOR . 'storage';
}

function ensure_directory(string $path): void
{
    if (is_dir($path)) {
        return;
    }
    if (!@mkdir($path, 0755, true) && !is_dir($path)) {
        fail(500, 'Sharing storage is not writable on this server.');
    }
}

function validate_project(array $project): void
{
    if (!isset($project['levels']) || !is_array($project['levels']) || count($project['levels']) < 1) {
        fail(422, 'The uploaded project contains no levels.');
    }
    if (count($project['levels']) > 256) {
        fail(422, 'The uploaded project contains too many levels.');
    }

    $roomCount = 0;
    foreach ($project['levels'] as $level) {
        if (!is_array($level) || !isset($level['rooms']) || !is_array($level['rooms']) || count($level['rooms']) < 1) {
            fail(422, 'Every level must contain at least one room.');
        }
        $roomCount += count($level['rooms']);
        if ($roomCount > 4096) {
            fail(422, 'The uploaded project contains too many rooms.');
        }
    }

    if (isset($project['title']) && !is_string($project['title'])) {
        fail(422, 'The project title is invalid.');
    }
}

function rate_limit_uploads(): void
{
    $rateDir = storage_root() . DIRECTORY_SEPARATOR . 'rate';
    ensure_directory($rateDir);

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = hash('sha256', $ip);
    $path = $rateDir . DIRECTORY_SEPARATOR . $key . '.json';
    $now = time();
    $window = intdiv($now, 3600);

    $handle = @fopen($path, 'c+');
    if ($handle === false) {
        fail(500, 'Sharing rate-limit storage is unavailable.');
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            fail(500, 'Sharing rate-limit storage is busy.');
        }
        $raw = stream_get_contents($handle);
        $state = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
        $count = (is_array($state) && ($state['window'] ?? null) === $window) ? (int)($state['count'] ?? 0) : 0;

        if ($count >= CELESTE_SHARE_HOURLY_LIMIT) {
            flock($handle, LOCK_UN);
            fclose($handle);
            fail(429, 'Too many projects have been shared from this connection. Try again later.');
        }

        $count++;
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode(['window' => $window, 'count' => $count]));
        fflush($handle);
        flock($handle, LOCK_UN);
    } finally {
        if (is_resource($handle)) {
            fclose($handle);
        }
    }
}

function project_filename(array $project): string
{
    $title = isset($project['title']) && is_string($project['title']) ? $project['title'] : 'celeste-project';
    $title = preg_replace('/[^A-Za-z0-9_-]+/', '-', $title) ?? 'celeste-project';
    $title = trim($title, '-_');
    if ($title === '') {
        $title = 'celeste-project';
    }
    return substr($title, 0, 60) . '.celproj';
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$sharesDir = storage_root() . DIRECTORY_SEPARATOR . 'shares';
ensure_directory($sharesDir);

if ($method === 'GET' && isset($_GET['health'])) {
    if (!is_writable($sharesDir)) {
        fail(500, 'Sharing storage is not writable on this server.');
    }
    json_response(200, [
        'ok' => true,
        'service' => 'celeste-studio-sharing',
        'maxBytes' => CELESTE_SHARE_MAX_BYTES,
    ]);
}

if ($method === 'POST') {
    $declaredLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
    if ($declaredLength > CELESTE_SHARE_MAX_BYTES) {
        fail(413, 'That project is too large to share.');
    }

    $raw = file_get_contents('php://input');
    if (!is_string($raw) || $raw === '') {
        fail(400, 'No project data was received.');
    }
    if (strlen($raw) > CELESTE_SHARE_MAX_BYTES) {
        fail(413, 'That project is too large to share.');
    }

    try {
        $project = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        fail(400, 'The uploaded project is not valid JSON.');
    }
    if (!is_array($project)) {
        fail(422, 'The uploaded project is invalid.');
    }

    validate_project($project);
    rate_limit_uploads();

    $record = [
        'createdAt' => gmdate('c'),
        'project' => $project,
    ];
    $encoded = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($encoded)) {
        fail(500, 'Could not encode the shared project.');
    }

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $id = bin2hex(random_bytes(16));
        $path = $sharesDir . DIRECTORY_SEPARATOR . $id . '.json';
        if (file_exists($path)) {
            continue;
        }
        $temp = $path . '.tmp-' . bin2hex(random_bytes(4));
        $written = @file_put_contents($temp, $encoded, LOCK_EX);
        if ($written === false || $written !== strlen($encoded)) {
            @unlink($temp);
            fail(500, 'Could not save the shared project.');
        }
        if (!@rename($temp, $path)) {
            @unlink($temp);
            continue;
        }

        json_response(201, [
            'ok' => true,
            'id' => $id,
            'share' => '?share=' . $id,
            'download' => 'share.php?id=' . $id . '&download=1',
        ]);
    }

    fail(500, 'Could not allocate a share link.');
}

if ($method === 'GET' && isset($_GET['id'])) {
    $id = strtolower((string)$_GET['id']);
    if (!preg_match(CELESTE_SHARE_ID_PATTERN, $id)) {
        fail(400, 'That share ID is invalid.');
    }

    $path = $sharesDir . DIRECTORY_SEPARATOR . $id . '.json';
    if (!is_file($path)) {
        fail(404, 'That shared project does not exist.');
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '') {
        fail(500, 'The shared project could not be read.');
    }

    try {
        $record = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        fail(500, 'The stored project is corrupted.');
    }
    if (!is_array($record) || !isset($record['project']) || !is_array($record['project'])) {
        fail(500, 'The stored project is invalid.');
    }

    $project = $record['project'];
    if (isset($_GET['download'])) {
        header('Content-Type: application/json; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . project_filename($project) . '"');
        echo json_encode($project, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    json_response(200, [
        'ok' => true,
        'id' => $id,
        'createdAt' => $record['createdAt'] ?? null,
        'project' => $project,
        'download' => 'share.php?id=' . $id . '&download=1',
    ]);
}

header('Allow: GET, POST');
fail(405, 'Method not allowed.');
