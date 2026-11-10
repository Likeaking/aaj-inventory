<?php
// =====================================================================
// api.php  -  the backend. JavaScript sends a request like api.php?a=sale
// and this file does the work and answers in JSON.
// =====================================================================
require 'config.php';
require 'classes.php';
header('Content-Type: application/json');

// ---------- Small helper functions ----------

// Send the answer to the browser and stop
function respond($ok, $message = '', $extra = []) {
    echo json_encode(array_merge(['ok' => $ok, 'msg' => $message], $extra));
    exit;
}

// Only the Admin may continue (product management and the Reports Dashboard)
function requireAdmin() {
    if ($_SESSION['role'] !== 'admin') {
        respond(false, 'Only the Admin can do this.');
    }
}


// True if value is a whole number greater than 0 (like 1, 5, 20)
function isWholePositive($value) {
    return is_numeric($value) && $value == (int)$value && $value > 0;
}

// True if text is a real date written as YYYY-MM-DD
function isValidDate($text) {
    $date = DateTime::createFromFormat('Y-m-d', (string)$text);
    return $date && $date->format('Y-m-d') === $text;
}

// ---------- Step 1: must be logged in ----------
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    respond(false, 'Not logged in.');
}

// ---------- Step 2: load products and build the hash table ----------
$allProducts = $pdo->query('SELECT * FROM products')->fetchAll();
$hash = new HashTable();
$activeProducts = [];                       // products that are not archived
$archivedProducts = [];                     // products that were archived

foreach ($allProducts as $product) {
    $product['price']         = (float)$product['price'];
    $product['quantity']      = (int)$product['quantity'];
    $product['reorder_level'] = (int)$product['reorder_level'];
    $hash->put($product['code'], $product);             // code -> product
    if ($product['archived'] == 0) {
        $activeProducts[] = $product;
    } else {
        $archivedProducts[] = $product;
    }
}

// ---------- Step 3: read the request ----------
$input  = json_decode(file_get_contents('php://input'), true) ?? [];   // data sent by JavaScript
$action = $_GET['a'] ?? '';


// =====================================================================
// ACTIONS  (one function per action)
// =====================================================================

// Show products, sorted with MERGE SORT
function actionList($activeProducts) {
    $allowed = ['name', 'code', 'quantity', 'price'];
    $field = $_GET['f'] ?? 'name';
    if (!in_array($field, $allowed)) { $field = 'name'; }
    $ascending = (($_GET['d'] ?? 'asc') !== 'desc');

    $sorted = mergeSort($activeProducts, $field, $ascending);
    respond(true, '', ['rows' => $sorted, 'undo' => UndoStack::size()]);
}

// Search by name: MERGE SORT by name first, then BINARY SEARCH
function actionSearch($activeProducts) {
    $text = trim($_GET['q'] ?? '');
    if ($text == '') {
        respond(true, '', ['rows' => []]);
    }
    $sortedByName = mergeSort($activeProducts, 'name', true);
    $found = binarySearchName($sortedByName, $text);
    respond(true, '', ['rows' => $found]);
}

// Find one product by code using the HASH TABLE
function actionLookup($hash) {
    $code = strtoupper(trim($_GET['code'] ?? ''));
    $product = $hash->get($code);
    if ($product == null || $product['archived'] == 1) {
        respond(false, 'Product code not found.');
    }
    respond(true, '', ['p' => $product]);
}

// Add a new product or edit an existing one
function actionSave($pdo, $hash, $allProducts, $input) {
    requireAdmin();

    $code     = strtoupper(trim($input['code'] ?? ''));
    $name     = trim($input['name'] ?? '');
    $category = trim($input['category'] ?? '');
    $price    = $input['price'] ?? '';
    $reorder  = $input['reorder_level'] ?? '';
    $quantity = $input['quantity'] ?? 0;
    $isEdit   = !empty($input['edit']);

    // Validation
    if ($code == '' || $name == '' || $category == '') {
        respond(false, 'Code, name and category are required.');
    }
    if (!preg_match('/^[A-Z0-9\-]{2,20}$/', $code)) {
        respond(false, 'Code must be letters/numbers only (2-20 characters).');
    }
    if (!is_numeric($price) || !is_numeric($reorder) || !is_numeric($quantity)) {
        respond(false, 'Price, reorder level and quantity must be numbers.');
    }
    if ($price < 0 || $reorder < 0 || $quantity < 0) {
        respond(false, 'Values cannot be negative.');
    }
    if (!$isEdit && $hash->has($code)) {                  // HASH TABLE: duplicate code check
        respond(false, 'Duplicate product code.');
    }

    // BINARY SEARCH: duplicate name check
    $sortedByName = mergeSort($allProducts, 'name', true);
    foreach (binarySearchName($sortedByName, $name) as $match) {
        if (strcasecmp($match['name'], $name) == 0 && $match['code'] != $code) {
            respond(false, 'Product name already exists.');
        }
    }

    if ($isEdit) {
        $sql = 'UPDATE products SET name=?, category=?, price=?, reorder_level=?, quantity=? WHERE code=?';
        $pdo->prepare($sql)->execute([$name, $category, $price, (int)$reorder, (int)$quantity, $code]);
        respond(true, 'Product updated.');
    }
    $sql = 'INSERT INTO products (code, name, category, price, reorder_level, quantity) VALUES (?, ?, ?, ?, ?, ?)';
    $pdo->prepare($sql)->execute([$code, $name, $category, $price, (int)$reorder, (int)$quantity]);
    respond(true, 'Product added.');
}

// "Delete" a product by hiding it. History stays safe.
function actionArchive($pdo, $hash, $input) {
    requireAdmin();
    $code = strtoupper($input['code'] ?? '');
    if (!$hash->has($code)) {
        respond(false, 'Product not found.');
    }
    $pdo->prepare('UPDATE products SET archived = 1 WHERE code = ?')->execute([$code]);
    respond(true, 'Product archived. You can restore it in the Archived tab.');
}

// Show archived (hidden) products, sorted by name
function actionArchivedList($archivedProducts) {
    requireAdmin();
    respond(true, '', ['rows' => mergeSort($archivedProducts, 'name', true)]);
}

// Bring an archived product back
function actionRestore($pdo, $hash, $input) {
    requireAdmin();
    $code = strtoupper($input['code'] ?? '');
    if (!$hash->has($code)) {
        respond(false, 'Product not found.');
    }
    $pdo->prepare('UPDATE products SET archived = 0 WHERE code = ?')->execute([$code]);
    respond(true, 'Product restored.');
}

// Permanently delete a product AND its transaction history
function actionDelete($pdo, $hash, $input) {
    requireAdmin();
    $code = strtoupper($input['code'] ?? '');
    if (!$hash->has($code)) {
        respond(false, 'Product not found.');
    }

    // Do both deletes together: either both succeed or none
    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM transactions WHERE code = ?')->execute([$code]);   // history first (foreign key)
    $pdo->prepare('DELETE FROM products WHERE code = ?')->execute([$code]);
    $pdo->commit();

    UndoStack::removeCode($code);       // the stack must not point to a deleted product
    respond(true, 'Product deleted permanently.');
}

// Checks the code, quantity and date used by both stock-in and sale.
// Returns [product, quantity, date] or stops with an error message.
function checkTransactionInput($hash, $input) {
    $code     = strtoupper(trim($input['code'] ?? ''));
    $quantity = $input['qty'] ?? null;
    $date     = $input['date'] ?? date('Y-m-d');

    $product = $hash->get($code);                         // HASH TABLE lookup
    if ($product == null || $product['archived'] == 1) {
        respond(false, 'Product code not found.');
    }
    if (!isWholePositive($quantity)) {
        respond(false, 'Quantity must be a whole number greater than 0.');
    }
    if (!isValidDate($date)) {
        respond(false, 'Invalid date.');
    }
    return [$product, (int)$quantity, $date];
}

// Save a transaction in the database and push it on the UNDO STACK
function saveTransaction($pdo, $type, $code, $quantity, $amount, $supplier, $date) {
    $sql = 'INSERT INTO transactions (type, code, qty, amount, supplier, tdate, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)';
    $pdo->prepare($sql)->execute([$type, $code, $quantity, $amount, $supplier, $date, $_SESSION['user']]);

    UndoStack::push([
        'id'   => (int)$pdo->lastInsertId(),
        'type' => $type,
        'code' => $code,
        'qty'  => $quantity,
    ]);
}

// Stock-in: quantity goes UP
function actionStockIn($pdo, $hash, $input) {
    [$product, $quantity, $date] = checkTransactionInput($hash, $input);

    $supplier = trim($input['supplier'] ?? '');
    if ($supplier == '') {
        respond(false, 'Supplier name is required.');
    }

    $pdo->prepare('UPDATE products SET quantity = quantity + ? WHERE code = ?')->execute([$quantity, $product['code']]);
    saveTransaction($pdo, 'stock_in', $product['code'], $quantity, 0, $supplier, $date);
    respond(true, 'Stock-in recorded.');
}

// Sale (stock-out): quantity goes DOWN
function actionSale($pdo, $hash, $input) {
    [$product, $quantity, $date] = checkTransactionInput($hash, $input);

    if ($quantity > $product['quantity']) {
        respond(false, 'Not enough stock. Available: ' . $product['quantity'] . '.');
    }

    $total = $quantity * $product['price'];
    $pdo->prepare('UPDATE products SET quantity = quantity - ? WHERE code = ?')->execute([$quantity, $product['code']]);
    saveTransaction($pdo, 'sale', $product['code'], $quantity, $total, null, $date);
    respond(true, 'Sale recorded. Total: ₱' . number_format($total, 2));
}

// Undo the most recent transaction using the STACK
function actionUndo($pdo, $hash) {
    $last = UndoStack::pop();                             // take the top of the stack
    if ($last == null) {
        respond(false, 'Nothing to undo (undo stack is empty).');
    }

    $product = $hash->get($last['code']);

    if ($last['type'] == 'sale') {
        $sql = 'UPDATE products SET quantity = quantity + ? WHERE code = ?';     // give stock back
    } else {
        if ($product['quantity'] < $last['qty']) {        // stock already sold, cannot remove it
            UndoStack::push($last);
            respond(false, 'Cannot undo: that stock was already sold.');
        }
        $sql = 'UPDATE products SET quantity = quantity - ? WHERE code = ?';     // remove the stock-in
    }
    $pdo->prepare($sql)->execute([$last['qty'], $last['code']]);
    $pdo->prepare('UPDATE transactions SET undone = 1 WHERE id = ?')->execute([$last['id']]);
    respond(true, 'Last transaction was undone.');
}

// Latest 100 transactions
function actionHistory($pdo) {
    $sql = 'SELECT t.*, p.name FROM transactions t JOIN products p ON p.code = t.code ORDER BY t.id DESC LIMIT 100';
    respond(true, '', ['rows' => $pdo->query($sql)->fetchAll()]);
}

// Summary numbers for the Reports tab
function actionReport($pdo, $activeProducts, $archivedProducts) {
    requireAdmin();

    $inventoryValue = 0;
    $lowStockCount = 0;
    foreach ($activeProducts as $p) {
        $inventoryValue = $inventoryValue + $p['price'] * $p['quantity'];
        if ($p['quantity'] <= $p['reorder_level']) {
            $lowStockCount++;
        }
    }

    $sales = $pdo->query("SELECT COALESCE(SUM(amount),0) AS money, COALESCE(SUM(qty),0) AS units
                          FROM transactions WHERE type = 'sale' AND undone = 0")->fetch();
    $top = $pdo->query("SELECT p.name, SUM(t.qty) AS qty FROM transactions t JOIN products p ON p.code = t.code
                        WHERE t.type = 'sale' AND t.undone = 0 GROUP BY p.code ORDER BY qty DESC LIMIT 5")->fetchAll();

    respond(true, '', [
        'value'    => $inventoryValue,
        'products' => count($activeProducts),
        'archived' => count($archivedProducts),
        'low'      => $lowStockCount,
        'sales'    => (float)$sales['money'],
        'sold'     => (int)$sales['units'],
        'top'      => $top,
    ]);
}


// =====================================================================
// Choose which function to run
// =====================================================================
if     ($action == 'list')    { actionList($activeProducts); }
elseif ($action == 'search')  { actionSearch($activeProducts); }
elseif ($action == 'lookup')  { actionLookup($hash); }
elseif ($action == 'save')    { actionSave($pdo, $hash, $allProducts, $input); }
elseif ($action == 'archive') { actionArchive($pdo, $hash, $input); }
elseif ($action == 'archived') { actionArchivedList($archivedProducts); }
elseif ($action == 'restore') { actionRestore($pdo, $hash, $input); }
elseif ($action == 'delete')  { actionDelete($pdo, $hash, $input); }
elseif ($action == 'stockin') { actionStockIn($pdo, $hash, $input); }
elseif ($action == 'sale')    { actionSale($pdo, $hash, $input); }
elseif ($action == 'undo')    { actionUndo($pdo, $hash); }
elseif ($action == 'history') { actionHistory($pdo); }
elseif ($action == 'report')  { actionReport($pdo, $activeProducts, $archivedProducts); }
else                          { respond(false, 'Unknown action.'); }
