<?php

declare(strict_types=1);

final class ConsoleInput
{
    public static function readLine(string $label, $input = null, $output = null): string
    {
        $input ??= STDIN;
        $output ??= STDOUT;
        fwrite($output, $label);

        $value = fgets($input);
        if ($value === false) {
            throw new RuntimeException('Interactive input is required.');
        }

        return rtrim($value, "\r\n");
    }

    public static function readPassword(
        string $label,
        $input = null,
        $output = null,
        ?bool $interactiveOverride = null
    ): string {
        $input ??= STDIN;
        $output ??= STDOUT;
        $interactive = $interactiveOverride
            ?? ($input === STDIN && function_exists('stream_isatty') && stream_isatty($input));

        if (!$interactive) {
            return self::readLine($label, $input, $output);
        }

        if (PHP_OS_FAMILY === 'Windows') {
            return self::readWindowsPassword($label);
        }

        fwrite($output, $label);
        shell_exec('stty -echo');
        try {
            $value = fgets($input);
        } finally {
            shell_exec('stty echo');
            fwrite($output, PHP_EOL);
        }

        if ($value === false) {
            throw new RuntimeException('Interactive input is required.');
        }

        return rtrim($value, "\r\n");
    }

    private static function readWindowsPassword(string $label): string
    {
        $prompt = rtrim($label, ": \t");
        $escapedPrompt = str_replace("'", "''", $prompt);
        $script = "\$secure = Read-Host -Prompt '{$escapedPrompt}' -AsSecureString; "
            . '$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); '
            . 'try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } '
            . 'finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }';
        $descriptors = [
            0 => ['file', 'php://stdin', 'r'],
            1 => ['pipe', 'w'],
            2 => ['file', 'php://stderr', 'w'],
        ];
        $process = proc_open(['powershell.exe', '-NoProfile', '-Command', $script], $descriptors, $pipes);
        if (!is_resource($process)) {
            throw new RuntimeException('Unable to start the secure password prompt.');
        }

        $value = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        $exitCode = proc_close($process);
        if ($exitCode !== 0 || $value === false) {
            throw new RuntimeException('Unable to read the password securely.');
        }

        return rtrim($value, "\r\n");
    }
}
