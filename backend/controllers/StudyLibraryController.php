<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';

final class StudyLibraryController {
    public static function index(): void {
        $userId = Auth::requireAuth();
        $path = trim((string) ($_GET['path'] ?? ''));
        $query = trim((string) ($_GET['q'] ?? ''));
        $type = trim((string) ($_GET['type'] ?? ''));
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = min(100, max(12, (int) ($_GET['per_page'] ?? 48)));

        if (mb_strlen($path) > 500 || mb_strlen($query) > 120) {
            Response::error('Filtro inválido.');
        }
        if ($type !== '' && !in_array($type, ['video', 'pdf', 'audio', 'document', 'other'], true)) {
            Response::error('Tipo de material inválido.');
        }

        $where = ['user_id = ?', 'is_available = 1'];
        $params = [$userId];
        if ($path !== '') {
            $where[] = '(catalog_path = ? OR catalog_path LIKE ?)';
            $params[] = $path;
            $params[] = $path . ' / %';
        }
        if ($query !== '') {
            $where[] = '(name LIKE ? OR catalog_path LIKE ?)';
            $params[] = '%' . $query . '%';
            $params[] = '%' . $query . '%';
        }
        if ($type !== '') {
            $where[] = 'item_type = ?';
            $params[] = $type;
        }

        $whereSql = implode(' AND ', $where);
        $db = Database::getInstance();
        $total = (int) ($db->fetch("SELECT COUNT(*) AS total FROM study_library_items WHERE {$whereSql}", $params)['total'] ?? 0);
        $offset = ($page - 1) * $perPage;
        $items = $db->fetchAll(
            "SELECT id, name, direct_url, catalog_path, item_type, mime_type, modified_at
             FROM study_library_items
             WHERE {$whereSql}
             ORDER BY catalog_path COLLATE NOCASE, name COLLATE NOCASE
             LIMIT ? OFFSET ?",
            [...$params, $perPage, $offset]
        );

        $paths = $db->fetchAll(
            "SELECT catalog_path, COUNT(*) AS total
             FROM study_library_items
             WHERE {$whereSql}
             GROUP BY catalog_path",
            $params
        );
        $types = $db->fetchAll(
            "SELECT item_type, COUNT(*) AS total
             FROM study_library_items
             WHERE {$whereSql}
             GROUP BY item_type",
            $params
        );
        $institutionPaths = [];
        if ($path === '' && $query === '' && $type === '') {
            $institutionPaths = $db->fetchAll(
                "SELECT catalog_path, COUNT(*) AS total
                 FROM study_library_items
                 WHERE user_id = ? AND is_available = 1 AND catalog_path LIKE 'Instituições / %'
                 GROUP BY catalog_path",
                [$userId]
            );
        }

        Response::json([
            'success' => true,
            'data' => [
                'items' => $items,
                'children' => self::children($paths, $path),
                'types' => array_column($types, 'total', 'item_type'),
                'institution_sections' => self::institutionSections($institutionPaths),
            ],
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => max(1, (int) ceil($total / $perPage)),
            ],
        ]);
    }

    /** @param list<array<string, mixed>> $paths */
    private static function children(array $paths, string $selectedPath): array {
        $selected = $selectedPath === '' ? [] : explode(' / ', $selectedPath);
        $children = [];

        foreach ($paths as $row) {
            $segments = array_values(array_filter(explode(' / ', (string) $row['catalog_path']), static fn (string $part): bool => $part !== ''));
            if (count($segments) <= count($selected)) {
                continue;
            }
            $next = $segments[count($selected)] ?? null;
            if ($next === null) {
                continue;
            }
            $childPath = implode(' / ', array_slice($segments, 0, count($selected) + 1));
            if (!isset($children[$childPath])) {
                $children[$childPath] = ['path' => $childPath, 'label' => $next, 'count' => 0];
            }
            $children[$childPath]['count'] += (int) $row['total'];
        }

        $result = array_values($children);
        usort($result, static fn (array $a, array $b): int => strnatcasecmp($a['label'], $b['label']));
        return $result;
    }

    /** @param list<array<string, mixed>> $paths */
    private static function institutionSections(array $paths): array {
        $sections = [];
        foreach ($paths as $row) {
            $segments = array_values(array_filter(explode(' / ', (string) $row['catalog_path']), static fn (string $part): bool => $part !== ''));
            if (count($segments) < 3) {
                continue;
            }
            [, $institution, $program] = $segments;
            $sectionPath = 'Instituições / ' . $institution;
            $programPath = $sectionPath . ' / ' . $program;
            if (!isset($sections[$sectionPath])) {
                $sections[$sectionPath] = ['label' => $institution, 'path' => $sectionPath, 'entries' => []];
            }
            if (!isset($sections[$sectionPath]['entries'][$programPath])) {
                $sections[$sectionPath]['entries'][$programPath] = [
                    'path' => $programPath,
                    'label' => $program,
                    'count' => 0,
                    'kind' => self::programKind($institution, $program),
                ];
            }
            $sections[$sectionPath]['entries'][$programPath]['count'] += (int) $row['total'];
        }

        $result = [];
        foreach ($sections as $section) {
            $section['entries'] = array_values($section['entries']);
            usort($section['entries'], static fn (array $a, array $b): int => strnatcasecmp($a['label'], $b['label']));
            $result[] = $section;
        }
        usort($result, static fn (array $a, array $b): int => strnatcasecmp($a['label'], $b['label']));
        return $result;
    }

    private static function programKind(string $institution, string $program): string {
        return match ($institution) {
            'Descomplica' => 'Matéria',
            'Faculdade Unifatécie' => 'Graduação',
            'Faculdade Metropolitana' => 'Pós-graduação',
            'Cognitivo' => str_starts_with($program, 'Especialização') ? 'Pós-graduação' : 'Material complementar',
            'INPBE' => 'Módulo',
            default => 'Programa',
        };
    }
}
