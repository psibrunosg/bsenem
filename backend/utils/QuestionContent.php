<?php

declare(strict_types=1);

final class QuestionContent {
    public static function statement(mixed $value): string {
        $text = trim((string) $value);
        if ($text === '') return '';

        // Some official ENEM PDFs repeat a watermark dozens of times in the
        // extracted text layer. Keep the canonical source untouched and clean
        // only the student-facing representation.
        $text = self::removeRepeatedWatermark($text);

        // On a few first questions of a section, the extractor captured the
        // page/section heading before the actual stem.
        $text = preg_replace(
            '/^(?:LINGUAGENS,?\s*C[ÓO]DIGOS E SUAS TECNOLOGIAS|CI[ÊE]NCIAS HUMANAS E SUAS TECNOLOGIAS|CI[ÊE]NCIAS DA NATUREZA E SUAS TECNOLOGIAS|MATEM[ÁA]TICA E SUAS TECNOLOGIAS).*?QUEST(?:ÃO|AO)\s*\d{1,3}\s*/isu',
            '',
            $text
        ) ?? $text;

        return trim(self::tidy($text));
    }

    public static function option(mixed $value, string $key): string {
        $text = trim((string) $value);
        $key = strtoupper($key);
        if ($text === '' || !preg_match('/^[A-E]$/', $key)) return $text;

        // Newer official PDFs sometimes include the option letter in the text.
        // The player already renders its own accessible A-E marker.
        $text = self::removeRepeatedWatermark($text);
        $text = preg_replace('/^' . preg_quote($key, '/') . '(?:\s|\t|[.):-])+\s*/u', '', $text) ?? $text;
        return trim(self::tidy($text));
    }

    public static function hasRepeatedWatermark(mixed $value): bool {
        return preg_match('/(?:(?:ENEM\s*20\d{2})[\s\r\n]*){3,}/iu', (string) $value) === 1;
    }

    public static function hasEmbeddedOptionLabel(mixed $value, string $key): bool {
        $key = strtoupper($key);
        if (!preg_match('/^[A-E]$/', $key)) return false;
        return preg_match('/^\s*' . preg_quote($key, '/') . '(?:\s|\t|[.):-])+/u', (string) $value) === 1;
    }

    private static function removeRepeatedWatermark(string $text): string {
        return preg_replace(
            '/(?:(?:ENEM\s*20\d{2})[\s\r\n]*){3,}/iu',
            '',
            $text
        ) ?? $text;
    }

    private static function tidy(string $text): string {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[ \t]+\n/u', "\n", $text) ?? $text;
        $text = preg_replace('/\n{4,}/u', "\n\n\n", $text) ?? $text;
        return $text;
    }
}
