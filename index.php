<?php
// index.php - login page
require 'config.php';

// Already logged in? Go straight to the dashboard.
if (isset($_SESSION['user'])) {
    header('Location: dashboard.php');
    exit;
}

$error = '';
$success = isset($_GET['registered']) ? 'Account created! You can log in now.' : '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username === '' || $password === '') {
        $error = 'Please fill in all fields.';
    } else {
        // Compare the hash of the typed password with the saved hash
        $statement = $pdo->prepare('SELECT * FROM users WHERE username = ? AND password = ?');
        $statement->execute([$username, hash('sha256', $password)]);
        $user = $statement->fetch();

        if ($user) {
            $_SESSION['user'] = $user['username'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['undo'] = [];                    // empty undo stack for this login
            header('Location: dashboard.php');
            exit;
        }
        $error = 'Invalid username or password.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AAJ Pet Food Record &amp; Inventory Management</title>
    <link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
</head>
<body class="login-body">

    <!-- Floating background circles (animated in CSS) -->
    <div class="blob b1"></div>
    <div class="blob b2"></div>
    <div class="blob b3"></div>

    <form class="login-card" method="post">
        <div class="paw">🐾</div>
        <h1>AAJ's Pet Food Shop</h1>
        <p class="sub">Inventory Management System</p>

        <?php if ($success): ?>
            <div class="alert success"><?= htmlspecialchars($success) ?></div>
        <?php endif; ?>

        <?php if ($error): ?>
            <div class="alert shake"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <label>Username</label>
        <input name="username" autocomplete="username" required>

        <label>Password</label>
        <input name="password" type="password" autocomplete="current-password" required>

        <button class="btn" type="submit">Log In</button>
        <a class="switch" href="register.php">No account yet? Sign up</a>
        <small class="hint">Demo: admin / admin123 &nbsp;|&nbsp; staff / staff123</small>
    </form>

    <script src="assets/paws.js?v=<?= filemtime(__DIR__ . '/assets/paws.js') ?>"></script>
    <script src="assets/pw.js?v=<?= filemtime(__DIR__ . '/assets/pw.js') ?>"></script>

</body>
</html>
