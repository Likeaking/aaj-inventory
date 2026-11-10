<?php
// config.php - connects to MySQL and starts the session.
// If your XAMPP MySQL root user has a password, put it in $password.

session_start();

$host     = 'localhost';
$database = 'aaj_inventory';
$username = 'root';
$password = '';

$pdo = new PDO(
    "mysql:host=$host;port=3307;dbname=$database;charset=utf8mb4",
    $username,
    $password,
    [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
);

