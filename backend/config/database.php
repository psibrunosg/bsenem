<?php
// backend/config/database.php

class Database {
    private static $instance = null;
    private $pdo;

    private $host = 'localhost';
    private $db_name = 'bsenem';
    private $username = 'root';
    private $password = '';

    private function __construct() {
        try {
            $this->pdo = new PDO(
                "sqlite:" . __DIR__ . "/../database/bsenem.db",
                null,
                null,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
            
            // Enable WAL mode for better concurrency
            $this->pdo->exec('PRAGMA journal_mode=WAL');
            $this->pdo->exec('PRAGMA foreign_keys=ON');
            
        } catch (PDOException $e) {
            die(json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]));
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
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
        
        $this->query($sql, $params);
        return $this->pdo->rowCount();
    }

    public function delete($table, $where, $params = []) {
        $sql = "DELETE FROM {$table} WHERE {$where}";
        $this->query($sql, $params);
        return $this->pdo->rowCount();
    }
}

// Initialize database schema
function initializeDatabase() {
    try {
        $db = Database::getInstance();
        $db->execute('ALTER TABLE users ADD COLUMN reset_token TEXT;');
        $db->execute('ALTER TABLE users ADD COLUMN reset_token_expires DATETIME;');
    } catch(Exception \) {}
    $db = Database::getInstance()->getConnection();
    $schema = file_get_contents(__DIR__ . '/../database/schema.sql');
    
    // Execute each statement separately
    $statements = array_filter(array_map('trim', explode(';', $schema)));
    
    foreach ($statements as $statement) {
        if (!empty($statement)) {
            $db->exec($statement);
        }
    }
}

// Run initialization if this file is executed directly
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    initializeDatabase();
    echo json_encode(['message' => 'Database initialized successfully']);
}



