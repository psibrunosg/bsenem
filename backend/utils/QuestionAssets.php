<?php

declare(strict_types=1);

final class QuestionAssets {
    /** @return list<string> */
    public static function publicUrls(mixed $images): array {
        if (is_string($images)) {
            $decoded = json_decode($images, true);
            $images = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($images)) return [];

        $urls = [];
        foreach ($images as $image) {
            if (!is_string($image)) continue;
            $path = str_replace('\\', '/', trim($image));
            if ($path === '') continue;
            if (preg_match('#^https?://#i', $path) || str_starts_with($path, '/')) {
                $urls[] = $path;
                continue;
            }
            if (!preg_match('#^(?:assets|reference-assets)/[A-Za-z0-9_./-]+$#', $path) || str_contains($path, '..')) {
                continue;
            }
            $urls[] = '/question-assets/enem/' . $path;
        }
        return array_values(array_unique($urls));
    }
}
