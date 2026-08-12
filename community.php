<?php
declare(strict_types=1);

const COMMUNITY_MAX_BODY = 2 * 1024 * 1024;
const COMMUNITY_MAX_COMMENT = 1000;
const COMMUNITY_MAX_NAME = 32;
const COMMUNITY_MAX_ITEMS_PER_PAGE = 50;
const COMMUNITY_ID_PATTERN = '/^[a-f0-9]{32}$/D';
const COMMUNITY_CLIENT_PATTERN = '/^[A-Za-z0-9_-]{12,128}$/D';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store, max-age=0');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(int $status, string $message): never
{
    respond($status, ['ok' => false, 'error' => $message]);
}

function root_dir(): string
{
    return __DIR__ . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'community';
}

function ensure_dir(string $path): void
{
    if (is_dir($path)) return;
    if (!@mkdir($path, 0755, true) && !is_dir($path)) {
        fail(500, 'Community storage is not writable on this server.');
    }
}

function item_path(string $id): string
{
    return root_dir() . DIRECTORY_SEPARATOR . 'items' . DIRECTORY_SEPARATOR . $id . '.json';
}

function votes_path(string $id): string
{
    return root_dir() . DIRECTORY_SEPARATOR . 'votes' . DIRECTORY_SEPARATOR . $id . '.json';
}

function comments_path(string $id): string
{
    return root_dir() . DIRECTORY_SEPARATOR . 'comments' . DIRECTORY_SEPARATOR . $id . '.json';
}

function validate_id(string $id): string
{
    $id = strtolower(trim($id));
    if (!preg_match(COMMUNITY_ID_PATTERN, $id)) fail(400, 'Invalid community item ID.');
    return $id;
}

function read_json_file(string $path, $fallback)
{
    if (!is_file($path)) return $fallback;
    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '') return $fallback;
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function write_json_atomic(string $path, array $value): void
{
    $dir = dirname($path);
    ensure_dir($dir);
    $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($encoded)) fail(500, 'Could not encode community data.');
    $tmp = $path . '.tmp-' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $encoded, LOCK_EX) !== strlen($encoded)) {
        @unlink($tmp);
        fail(500, 'Could not save community data.');
    }
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        fail(500, 'Could not finalize community data.');
    }
}

function mutate_json_file(string $path, array $fallback, callable $mutator): array
{
    ensure_dir(dirname($path));
    $handle = @fopen($path, 'c+');
    if ($handle === false) fail(500, 'Community storage is unavailable.');
    try {
        if (!flock($handle, LOCK_EX)) fail(500, 'Community storage is busy.');
        rewind($handle);
        $raw = stream_get_contents($handle);
        $value = is_string($raw) && $raw !== '' ? json_decode($raw, true) : $fallback;
        if (!is_array($value)) $value = $fallback;
        $value = $mutator($value);
        if (!is_array($value)) fail(500, 'Community update failed.');
        $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if (!is_string($encoded)) fail(500, 'Could not encode community data.');
        rewind($handle);
        ftruncate($handle, 0);
        if (fwrite($handle, $encoded) !== strlen($encoded)) fail(500, 'Could not save community data.');
        fflush($handle);
        flock($handle, LOCK_UN);
        return $value;
    } finally {
        if (is_resource($handle)) fclose($handle);
    }
}

function client_id_from(array $body): string
{
    $client = isset($body['clientId']) ? (string)$body['clientId'] : '';
    if (!preg_match(COMMUNITY_CLIENT_PATTERN, $client)) fail(400, 'Invalid browser community ID.');
    return $client;
}

function voter_key(string $clientId): string
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    return hash('sha256', $ip . '|' . $clientId);
}

function rate_limit(string $action, int $limit): void
{
    $dir = root_dir() . DIRECTORY_SEPARATOR . 'rate';
    ensure_dir($dir);
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $key = hash('sha256', $ip);
    $path = $dir . DIRECTORY_SEPARATOR . $key . '.json';
    $window = intdiv(time(), 3600);
    mutate_json_file($path, ['window' => $window, 'actions' => []], function(array $state) use ($window, $action, $limit) {
        if (($state['window'] ?? null) !== $window) $state = ['window' => $window, 'actions' => []];
        $state['actions'] = is_array($state['actions'] ?? null) ? $state['actions'] : [];
        $count = (int)($state['actions'][$action] ?? 0);
        if ($count >= $limit) fail(429, 'Too many community actions from this connection. Try again later.');
        $state['actions'][$action] = $count + 1;
        return $state;
    });
}

function clean_text($value, int $max, string $fallback = ''): string
{
    $text = trim((string)$value);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';
    if ($text === '') return $fallback;
    return mb_substr($text, 0, $max);
}

function validate_level_project(array $project): array
{
    if (!isset($project['levels']) || !is_array($project['levels']) || count($project['levels']) !== 1) {
        fail(422, 'A community upload must contain exactly one level.');
    }
    $level = $project['levels'][0];
    if (!is_array($level) || !isset($level['rooms']) || !is_array($level['rooms']) || count($level['rooms']) < 1 || count($level['rooms']) > 32) {
        fail(422, 'The level must contain between 1 and 32 rooms.');
    }
    foreach ($level['rooms'] as $room) {
        if (!is_array($room)) fail(422, 'The level contains invalid room data.');
    }
    return $level;
}

function vote_summary(string $id): array
{
    $votes = read_json_file(votes_path($id), []);
    $likes = 0;
    $dislikes = 0;
    foreach ($votes as $reaction) {
        if ($reaction === 'like') $likes++;
        elseif ($reaction === 'dislike') $dislikes++;
    }
    return ['likes' => $likes, 'dislikes' => $dislikes];
}

function comments_for(string $id): array
{
    $comments = read_json_file(comments_path($id), []);
    return array_values(array_filter($comments, 'is_array'));
}

function public_item(array $item, bool $withComments = false): array
{
    $id = (string)$item['id'];
    $votes = vote_summary($id);
    $comments = comments_for($id);
    $views = (int)($item['views'] ?? 0);
    $downloads = (int)($item['downloads'] ?? 0);
    $commentCount = count($comments);
    $score = $votes['likes'] * 5 - $votes['dislikes'] * 2 + $downloads * 3 + $commentCount * 2 + $views * 0.25;
    $out = [
        'id' => $id,
        'createdAt' => $item['createdAt'] ?? null,
        'title' => (string)($item['title'] ?? 'Untitled level'),
        'author' => (string)($item['author'] ?? ''),
        'publisher' => (string)($item['publisher'] ?? 'Anonymous'),
        'description' => (string)($item['description'] ?? ''),
        'difficulty' => (int)($item['difficulty'] ?? 0),
        'rooms' => (int)($item['rooms'] ?? 0),
        'views' => $views,
        'downloads' => $downloads,
        'likes' => $votes['likes'],
        'dislikes' => $votes['dislikes'],
        'comments' => $commentCount,
        'score' => $score,
    ];
    if ($withComments) $out['commentList'] = $comments;
    return $out;
}

function load_item(string $id): array
{
    $item = read_json_file(item_path($id), []);
    if (!$item || ($item['id'] ?? null) !== $id) fail(404, 'That community level does not exist.');
    return $item;
}

function project_filename(array $item): string
{
    $title = preg_replace('/[^A-Za-z0-9_-]+/', '-', (string)($item['title'] ?? 'celeste-level')) ?? 'celeste-level';
    $title = trim($title, '-_');
    if ($title === '') $title = 'celeste-level';
    return substr($title, 0, 60) . '.celproj';
}

foreach (['items', 'votes', 'comments', 'rate'] as $dir) ensure_dir(root_dir() . DIRECTORY_SEPARATOR . $dir);

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET' && isset($_GET['health'])) {
    $writable = is_writable(root_dir()) && is_writable(root_dir() . DIRECTORY_SEPARATOR . 'items');
    if (!$writable) fail(500, 'Community storage is not writable on this server.');
    respond(200, ['ok' => true, 'service' => 'celeste-studio-community']);
}

if ($method === 'GET' && isset($_GET['list'])) {
    $sort = strtolower((string)($_GET['sort'] ?? 'popular'));
    $allowed = ['popular', 'newest', 'likes', 'downloads', 'comments'];
    if (!in_array($sort, $allowed, true)) $sort = 'popular';
    $query = mb_strtolower(trim((string)($_GET['q'] ?? '')));
    $limit = max(1, min(COMMUNITY_MAX_ITEMS_PER_PAGE, (int)($_GET['limit'] ?? 24)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));
    $items = [];
    foreach (glob(root_dir() . DIRECTORY_SEPARATOR . 'items' . DIRECTORY_SEPARATOR . '*.json') ?: [] as $path) {
        $item = read_json_file($path, []);
        if (!$item || !isset($item['id'])) continue;
        $public = public_item($item, false);
        if ($query !== '') {
            $haystack = mb_strtolower($public['title'] . ' ' . $public['author'] . ' ' . $public['publisher'] . ' ' . $public['description']);
            if (!str_contains($haystack, $query)) continue;
        }
        $items[] = $public;
    }
    usort($items, function(array $a, array $b) use ($sort) {
        $cmp = 0;
        if ($sort === 'newest') $cmp = strcmp((string)$b['createdAt'], (string)$a['createdAt']);
        elseif ($sort === 'likes') $cmp = $b['likes'] <=> $a['likes'];
        elseif ($sort === 'downloads') $cmp = $b['downloads'] <=> $a['downloads'];
        elseif ($sort === 'comments') $cmp = $b['comments'] <=> $a['comments'];
        else $cmp = $b['score'] <=> $a['score'];
        if ($cmp !== 0) return $cmp;
        return strcmp((string)$b['createdAt'], (string)$a['createdAt']);
    });
    $total = count($items);
    $page = array_slice($items, $offset, $limit);
    respond(200, ['ok' => true, 'items' => $page, 'total' => $total, 'sort' => $sort]);
}

if ($method === 'GET' && isset($_GET['id'])) {
    $id = validate_id((string)$_GET['id']);
    $item = load_item($id);

    if (isset($_GET['download'])) {
        rate_limit('download', 240);
        $item = mutate_json_file(item_path($id), $item, function(array $row) {
            $row['downloads'] = (int)($row['downloads'] ?? 0) + 1;
            return $row;
        });
        header('Content-Type: application/json; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . project_filename($item) . '"');
        echo json_encode($item['project'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    if (isset($_GET['load'])) {
        rate_limit('open', 360);
        $item = mutate_json_file(item_path($id), $item, function(array $row) {
            $row['views'] = (int)($row['views'] ?? 0) + 1;
            return $row;
        });
        respond(200, ['ok' => true, 'item' => public_item($item, true), 'project' => $item['project']]);
    }

    $public = public_item($item, true);
    if (isset($_GET['clientId']) && preg_match(COMMUNITY_CLIENT_PATTERN, (string)$_GET['clientId'])) {
        $votes = read_json_file(votes_path($id), []);
        $public['myReaction'] = $votes[voter_key((string)$_GET['clientId'])] ?? null;
    }
    respond(200, ['ok' => true, 'item' => $public]);
}

if ($method === 'POST') {
    $declared = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($declared > COMMUNITY_MAX_BODY) fail(413, 'That request is too large.');
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || $raw === '') fail(400, 'No community data was received.');
    if (strlen($raw) > COMMUNITY_MAX_BODY) fail(413, 'That request is too large.');
    try {
        $body = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        fail(400, 'The community request is not valid JSON.');
    }
    if (!is_array($body)) fail(400, 'Invalid community request.');
    $action = strtolower((string)($body['action'] ?? ''));

    if ($action === 'publish') {
        rate_limit('publish', 20);
        $project = $body['project'] ?? null;
        if (!is_array($project)) fail(422, 'Missing level project data.');
        $level = validate_level_project($project);
        $id = bin2hex(random_bytes(16));
        $item = [
            'id' => $id,
            'createdAt' => gmdate('c'),
            'title' => clean_text($level['title'] ?? '', 63, 'Untitled level'),
            'author' => clean_text($level['author'] ?? '', 31, 'Unknown'),
            'publisher' => clean_text($body['publisher'] ?? '', COMMUNITY_MAX_NAME, 'Anonymous'),
            'description' => clean_text($level['description'] ?? '', 255, ''),
            'difficulty' => max(0, min(5, (int)($level['difficulty'] ?? 0))),
            'rooms' => count($level['rooms']),
            'views' => 0,
            'downloads' => 0,
            'project' => $project,
        ];
        write_json_atomic(item_path($id), $item);
        write_json_atomic(votes_path($id), []);
        write_json_atomic(comments_path($id), []);
        respond(201, ['ok' => true, 'item' => public_item($item, true)]);
    }

    if ($action === 'vote') {
        rate_limit('vote', 300);
        $id = validate_id((string)($body['id'] ?? ''));
        load_item($id);
        $clientId = client_id_from($body);
        $reaction = (string)($body['reaction'] ?? '');
        if (!in_array($reaction, ['like', 'dislike', 'none'], true)) fail(422, 'Invalid reaction.');
        $key = voter_key($clientId);
        $votes = mutate_json_file(votes_path($id), [], function(array $votes) use ($key, $reaction) {
            if ($reaction === 'none') unset($votes[$key]);
            else $votes[$key] = $reaction;
            return $votes;
        });
        $likes = 0; $dislikes = 0;
        foreach ($votes as $value) {
            if ($value === 'like') $likes++;
            elseif ($value === 'dislike') $dislikes++;
        }
        respond(200, ['ok' => true, 'likes' => $likes, 'dislikes' => $dislikes, 'myReaction' => $reaction === 'none' ? null : $reaction]);
    }

    if ($action === 'comment') {
        rate_limit('comment', 60);
        $id = validate_id((string)($body['id'] ?? ''));
        load_item($id);
        client_id_from($body);
        $name = clean_text($body['name'] ?? '', COMMUNITY_MAX_NAME, 'Anonymous');
        $commentBody = clean_text($body['body'] ?? '', COMMUNITY_MAX_COMMENT, '');
        if ($commentBody === '') fail(422, 'Comment cannot be empty.');
        $comment = [
            'id' => bin2hex(random_bytes(8)),
            'name' => $name,
            'body' => $commentBody,
            'createdAt' => gmdate('c'),
        ];
        $comments = mutate_json_file(comments_path($id), [], function(array $comments) use ($comment) {
            if (count($comments) >= 500) array_shift($comments);
            $comments[] = $comment;
            return $comments;
        });
        respond(201, ['ok' => true, 'comment' => $comment, 'comments' => count($comments)]);
    }

    fail(400, 'Unknown community action.');
}

header('Allow: GET, POST');
fail(405, 'Method not allowed.');
