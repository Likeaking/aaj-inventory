<?php
// dashboard.php - main page (HTML layout). The work is done by assets/app.js.
require 'config.php';

// Not logged in? Back to the login page.
if (!isset($_SESSION['user'])) {
    header('Location: index.php');
    exit;
}
$isAdmin = ($_SESSION['role'] === 'admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AAJ Pet Food Record &amp; Inventory Management</title>
    <link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
</head>
<body data-role="<?= $_SESSION['role'] ?>">

    <!-- ===== Left menu ===== -->
    <aside class="side">
        <div class="brand">🐾 AAJ's <small>Pet Food Shop</small></div>

        <nav>
            <a data-tab="inv" class="active">📦 Inventory</a>
            <a data-tab="tx">🧾 Stock-In / Sale</a>
            <a data-tab="hist">🕘 History</a>
            <?php if ($isAdmin): ?>
                <!-- Admin only -->
                <a data-tab="arch">🗄 Archived</a>
                <a data-tab="rep">📊 Reports Dashboard</a>
            <?php endif; ?>
        </nav>

        <div class="user">
            <b><?= htmlspecialchars($_SESSION['user']) ?></b>
            <span><?= $isAdmin ? 'Admin' : 'Staff' ?></span>
            <a href="logout.php" class="btn small ghost">Log out</a>
        </div>
    </aside>

    <main>
        <!-- Low-stock alert is placed here by app.js (Admin only) -->
        <div id="alerts"></div>

        <!-- ===== Tab 1: Inventory ===== -->
        <section id="inv" class="tab show">
            <div class="bar">
                <input id="q" placeholder="Search product name (binary search)...">

                <select id="sf">
                    <option value="name">Name</option>
                    <option value="code">Code</option>
                    <option value="quantity">Quantity</option>
                    <option value="price">Price</option>
                </select>

                <select id="sd">
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                </select>

                <button class="btn small" id="undo">↩ Undo last</button>
                <?php if ($isAdmin): ?>
                    <button class="btn small" id="add">+ Add product</button>
                <?php endif; ?>
            </div>

            <div class="card">
                <table>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Qty</th>
                            <th>Reorder</th>
                            <th>Status</th>
                            <?php if ($isAdmin): ?><th></th><?php endif; ?>
                        </tr>
                    </thead>
                    <tbody id="rows"></tbody>
                </table>
            </div>
        </section>

        <!-- ===== Tab 2: Stock-In and Sale ===== -->
        <section id="tx" class="tab">
            <div class="grid2">

                <form class="card" id="fin">
                    <h2>Stock-In</h2>

                    <label>Product code</label>
                    <input name="code" class="code" required>
                    <div class="found"></div>

                    <label>Quantity</label>
                    <input name="qty" type="number" min="1" required>

                    <label>Supplier</label>
                    <input name="supplier" required>

                    <label>Date</label>
                    <input name="date" type="date" required>

                    <button class="btn">Record stock-in</button>
                </form>

                <form class="card" id="fsale">
                    <h2>Sale (Stock-Out)</h2>

                    <label>Product code</label>
                    <input name="code" class="code" required>
                    <div class="found"></div>

                    <label>Quantity</label>
                    <input name="qty" type="number" min="1" required>

                    <label>Date</label>
                    <input name="date" type="date" required>

                    <button class="btn">Record sale</button>
                </form>

            </div>
        </section>

        <!-- ===== Tab 3: History ===== -->
        <section id="hist" class="tab">
            <div class="card">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Product</th>
                            <th>Qty</th>
                            <th>Amount</th>
                            <th>Supplier</th>
                            <th>By</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="hrows"></tbody>
                </table>
            </div>
        </section>

    <?php if ($isAdmin): ?>
        <!-- ===== Tab 4: Archived products (Admin only) ===== -->
        <section id="arch" class="tab">
            <div class="card">
                <h2>Archived products</h2>
                <p class="note">Hidden products. Restore to bring them back, or delete them permanently.</p>
                <table>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Qty</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="arows"></tbody>
                </table>
            </div>
        </section>

        <!-- ===== Tab 5: Reports Dashboard (Admin only) ===== -->
        <section id="rep" class="tab">
            <div class="stats" id="stats"></div>
            <div class="card">
                <h2>Top selling products</h2>
                <div id="top"></div>
            </div>
        </section>
    <?php endif; ?>
    </main>

    <?php if ($isAdmin): ?>
    <!-- ===== Pop-up form: add / edit product (Admin only) ===== -->
    <div class="modal" id="modal">
        <form class="card" id="fprod">
            <h2 id="mt">Add product</h2>
            <input type="hidden" name="edit">

            <label>Code</label>
            <input name="code" required>

            <label>Name</label>
            <input name="name" required>

            <label>Category</label>
            <input name="category" required>

            <div class="grid3">
                <div>
                    <label>Price</label>
                    <input name="price" type="number" step="0.01" min="0" required>
                </div>
                <div>
                    <label>Reorder level</label>
                    <input name="reorder_level" type="number" min="0" required>
                </div>
                <div>
                    <label>Quantity</label>
                    <input name="quantity" type="number" min="0" required>
                </div>
            </div>

            <div class="row">
                <button class="btn">Save</button>
                <button type="button" class="btn ghost" id="cancel">Cancel</button>
            </div>
        </form>
    </div>
    <?php endif; ?>

    <!-- Small message that pops up after actions -->
    <div id="toast"></div>

    <script src="assets/app.js?v=<?= filemtime(__DIR__ . '/assets/app.js') ?>"></script>
</body>
</html>
