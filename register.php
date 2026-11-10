<?php
// register.php - sign up page. The person picks Staff or Admin with two buttons.
require 'config.php';

// Already logged in? Go to the dashboard.
if (isset($_SESSION['user'])) {
    header('Location: dashboard.php');
    exit;
}

$error = '';
$username = '';
$role = 'staff';                                   // the button that is selected

// Is there already an Admin? Only ONE Admin account is allowed.
$adminExists = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn() > 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirm  = $_POST['confirm'] ?? '';
    $role     = $_POST['role'] ?? 'staff';
    if (!in_array($role, ['staff', 'admin'], true)) { $role = 'staff'; }

    // Validation
    if ($username === '' || $password === '' || $confirm === '') {
        $error = 'Please fill in all fields.';
    } elseif (!preg_match('/^[A-Za-z0-9_]{3,30}$/', $username)) {
        $error = 'Username must be 3-30 letters, numbers or underscore.';
    } elseif (strlen($password) < 6) {
        $error = 'Password must be at least 6 characters.';
    } elseif ($password !== $confirm) {
        $error = 'Passwords do not match.';
    } elseif ($role === 'admin' && $adminExists) {
        $error = 'An Admin account already exists. Please sign up as Staff.';
        $role  = 'staff';
    } else {
        // Is the username already used?
        $check = $pdo->prepare('SELECT id FROM users WHERE username = ?');
        $check->execute([$username]);

        if ($check->fetch()) {
            $error = 'That username is already taken.';
        } else {
            // Save the new account (password is saved as a hash, never as plain text)
            $insert = $pdo->prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
            $insert->execute([$username, hash('sha256', $password), $role]);
            header('Location: index.php?registered=1');
            exit;
        }
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
        <h1>Create an account</h1>
        <p class="sub">Choose your account type</p>

        <?php if ($error): ?>
            <div class="alert shake"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <!-- Two buttons: Staff or Admin (only one Admin can exist) -->
        <div class="role-pick">
            <input type="hidden" name="role" id="role" value="<?= $adminExists ? 'staff' : htmlspecialchars($role) ?>">

            <button type="button" class="role-btn <?= ($role === 'staff' || $adminExists) ? 'on' : '' ?>" data-role="staff">
                <i class="ico">🧑‍💼</i>
                <b>Staff</b>
                <small>Inventory, sales &amp; history</small>
                <em class="tick">✓</em>
            </button>

            <button type="button"
                    class="role-btn <?= (!$adminExists && $role === 'admin') ? 'on' : '' ?> <?= $adminExists ? 'taken' : '' ?>"
                    data-role="admin" <?= $adminExists ? 'disabled title="An Admin account already exists"' : '' ?>>
                <i class="ico">📊</i>
                <b>Admin</b>
                <small><?= $adminExists ? 'Already taken' : 'Reports dashboard only' ?></small>
                <em class="tick">✓</em>
            </button>
        </div>

        <label>Username</label>
        <input name="username" value="<?= htmlspecialchars($username) ?>" autocomplete="username" required>

        <label>Password (at least 6 characters)</label>
        <input name="password" type="password" autocomplete="new-password" required>

        <label>Confirm password</label>
        <input name="confirm" type="password" autocomplete="new-password" required>

        <button class="btn" type="submit">Sign up</button>
        <a class="switch" href="index.php">Already have an account? Log in</a>
    </form>

    <script>
        // Clicking Staff or Admin highlights it and saves the choice in the hidden field
        document.querySelectorAll('.role-btn').forEach(function (button) {
            button.onclick = function () {
                document.querySelectorAll('.role-btn').forEach(function (b) { b.classList.remove('on'); });
                button.classList.add('on');
                document.getElementById('role').value = button.dataset.role;
            };
        });
    </script>

    <script src="assets/paws.js?v=<?= filemtime(__DIR__ . '/assets/paws.js') ?>"></script>
    <script src="assets/pw.js?v=<?= filemtime(__DIR__ . '/assets/pw.js') ?>"></script>

</body>
</html>
