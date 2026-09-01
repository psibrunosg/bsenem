<?php

declare(strict_types=1);

require_once __DIR__ . '/../database/Migrator.php';

class Database {
    private static $instance = null;
    private $pdo;

    private function __construct() {
        try {
            $path = getenv('APP_DB_PATH') ?: __DIR__ . '/../database/bsenem.db';
            $this->pdo = new PDO(
                "sqlite:" . $path,
                null,
                null,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
            
            $this->pdo->exec('PRAGMA journal_mode=WAL');
            $this->pdo->exec('PRAGMA foreign_keys=ON');
            Migrator::migrate($this->pdo);
        } catch (PDOException $e) {
            throw new RuntimeException('Database connection failed.', 0, $e);
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public static function resetForTests(): void {
        if (getenv('APP_ENV') !== 'test') {
            throw new RuntimeException('Database reset is available only in test mode.');
        }

        if (!getenv('APP_DB_PATH')) {
            throw new RuntimeException('Test database path must be explicit.');
        }

        self::$instance = null;
    }

    public function getConnection() {
        return $this->pdo;
    }

    public function query($sql, $params = []) {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function fetch($sql, $params = []) {
        return $this->query($sql, $params)->fetch();
    }

    public function fetchAll($sql, $params = []) {
        return $this->query($sql, $params)->fetchAll();
    }

    public function insert($table, $data) {
        $columns = implode(', ', array_keys($data));
        $placeholders = implode(', ', array_fill(0, count($data), '?'));
        
        $sql = "INSERT INTO {$table} ({$columns}) VALUES ({$placeholders})";
        $this->query($sql, array_values($data));
        
        return $this->pdo->lastInsertId();
    }

    public function update($table, $data, $where, $whereParams = []) {
        $set = implode(', ', array_map(fn($col) => "{$col} = ?", array_keys($data)));
        
        $sql = "UPDATE {$table} SET {$set} WHERE {$where}";
        $params = array_merge(array_values($data), $whereParams);
        
        return $this->query($sql, $params)->rowCount();
    }

    public function delete($table, $where, $params = []) {
        $sql = "DELETE FROM {$table} WHERE {$where}";
        return $this->query($sql, $params)->rowCount();
    }
}

function initializeDatabase(): void {
    Database::getInstance();
}

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    try {
        initializeDatabase();
        echo json_encode(['message' => 'Database initialized successfully']);
    } catch (Throwable $error) {
        http_response_code(500);
        echo json_encode(['error' => 'Database initialization failed']);
    }
}





