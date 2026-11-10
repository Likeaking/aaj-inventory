// =====================================================================
// app.js  -  the browser side: buttons, tables, forms and animations.
// It talks to api.php using fetch().
// =====================================================================

// ---------- Small helpers ----------
const ADMIN = document.body.dataset.role === 'admin';   // Admin: manages products + sees Reports. Staff: records and searches.

function $(selector)  { return document.querySelector(selector); }      // get ONE element
function $$(selector) { return document.querySelectorAll(selector); }   // get MANY elements

// Make text safe before putting it inside HTML
function safe(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
function peso(number) {
  return '₱' + Number(number).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
function today() {
  return new Date().toISOString().slice(0, 10);          // YYYY-MM-DD
}

// Call api.php. If "data" is given it is sent as JSON.
async function api(action, data = null, extra = '') {
  const options = data ? { method: 'POST', body: JSON.stringify(data) } : {};
  const response = await fetch('api.php?a=' + action + extra, options);
  if (response.status === 401) { location = 'index.php'; }   // logged out
  return response.json();
}

// Small message at the bottom-right
function showToast(message, ok = true) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = 'show ' + (ok ? 'ok' : 'bad');
  setTimeout(() => { toast.className = ''; }, 3200);
}

// Animated counting number (used in Reports)
function countUp(element, target, isMoney) {
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / 900, 1);   // 0 -> 1 in 0.9 seconds
    const value = target * progress;
    element.textContent = isMoney ? peso(value) : Math.round(value);
    if (progress < 1) { requestAnimationFrame(step); }
  }
  requestAnimationFrame(step);
}


// ---------- Tabs ----------
$$('nav a').forEach(link => {
  link.onclick = () => {
    $$('nav a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    $$('.tab').forEach(tab => tab.classList.remove('show'));
    $('#' + link.dataset.tab).classList.add('show');

    if (link.dataset.tab === 'hist') { loadHistory(); }
    if (link.dataset.tab === 'arch') { loadArchived(); }
    if (link.dataset.tab === 'rep')  { loadReport(); }
  };
});


// ---------- Inventory table ----------
let products = [];   // latest product list from the server

function productRow(p, index) {
  const isLow = p.quantity <= p.reorder_level;
  const statusClass = isLow ? 'low' : 'okk';

  // The column you are sorting by gets the "hl" class (its letters become bold)
  const sortBy = $('#sf').value;
  const hl = field => (field === sortBy ? ' class="hl"' : '');
  const statusText  = isLow ? 'Low stock' : 'In stock';

  let buttons = '';
  if (ADMIN) {
    buttons = `<td class="act">
      <button class="btn small ghost" data-edit="${safe(p.code)}">Edit</button>
      <button class="btn small warn" data-archive="${safe(p.code)}">Archive</button>
      <button class="btn small danger" data-delete="${safe(p.code)}">Delete</button></td>`;
  }
  // animation-delay makes the rows appear one after another
  return `<tr style="animation-delay:${index * 40}ms">
    <td data-label="Code"${hl('code')}>${safe(p.code)}</td><td data-label="Name"${hl('name')}>${safe(p.name)}</td><td data-label="Category">${safe(p.category)}</td>
    <td data-label="Price"${hl('price')}>${peso(p.price)}</td><td data-label="Qty"${hl('quantity')}>${p.quantity}</td><td data-label="Reorder">${p.reorder_level}</td>
    <td data-label="Status"><span class="tag ${statusClass}">${statusText}</span></td>${buttons}</tr>`;
}

async function loadInventory() {
  const searchText = $('#q').value.trim();
  const sortField  = $('#sf').value;
  const sortDir    = $('#sd').value;

  // Always get the sorted list (merge sort on the server)
  const listResult = await api('list', null, `&f=${sortField}&d=${sortDir}`);
  products = listResult.rows;
  let rowsToShow = products;

  // If something is typed, show only the binary search results
  if (searchText !== '') {
    const searchResult = await api('search', null, '&q=' + encodeURIComponent(searchText));
    rowsToShow = searchResult.rows;
  }

  if (rowsToShow.length === 0) {
    const message = searchText ? 'Product not found.' : 'No products yet.';
    $('#rows').innerHTML = `<tr><td colspan="8" class="empty">${message}</td></tr>`;
  } else {
    $('#rows').innerHTML = rowsToShow.map(productRow).join('');
  }
  showLowStockAlert();
}

// Yellow bar listing products that reached the reorder level (Admin only)
function showLowStockAlert() {
  if (!ADMIN) { return; }                       // only the Admin monitors stock alerts
  const lowItems = products.filter(p => p.quantity <= p.reorder_level);
  if (lowItems.length === 0) { $('#alerts').innerHTML = ''; return; }
  const names = lowItems.map(p => safe(p.name) + ' (' + p.quantity + ')').join(', ');
  $('#alerts').innerHTML = `<div class="alert pulse">⚠ Low stock: ${names}</div>`;
}

// Typing in the search box (wait 0.2s after the last key so we don't spam the server)
let typingTimer;
$('#q').oninput = () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(loadInventory, 200);
};
$('#sf').onchange = loadInventory;
$('#sd').onchange = loadInventory;

$('#undo').onclick = async () => {
  const result = await api('undo', {});
  showToast(result.msg, result.ok);
  loadInventory();
};

// Edit / Archive buttons inside the table
$('#rows').onclick = async (event) => {
  const editCode    = event.target.dataset.edit;
  const archiveCode = event.target.dataset.archive;
  const deleteCode  = event.target.dataset.delete;

  if (archiveCode && confirm('Archive this product?')) {
    const result = await api('archive', { code: archiveCode });
    showToast(result.msg, result.ok);
    loadInventory();
  }
  if (deleteCode) {
    askAndDelete(deleteCode);
  }
  if (editCode) {
    openProductForm(products.find(p => p.code === editCode));
  }
};

// Ask first, then delete the product permanently
async function askAndDelete(code) {
  const warning = 'Delete ' + code + ' permanently?\n\nIts stock-in and sale history will also be deleted. This cannot be undone.\n(Use Archive instead if you may need it again.)';
  if (!confirm(warning)) { return; }

  const result = await api('delete', { code: code });
  showToast(result.msg, result.ok);
  loadInventory();
  if ($('#arch').classList.contains('show')) { loadArchived(); }
}


// ---------- Archived tab (Admin only) ----------
async function loadArchived() {
  if (!ADMIN) { return; }
  const result = await api('archived');
  if (!result.ok) { return; }

  if (result.rows.length === 0) {
    $('#arows').innerHTML = '<tr><td colspan="6" class="empty">No archived products.</td></tr>';
    return;
  }
  $('#arows').innerHTML = result.rows.map((p, index) => `<tr style="animation-delay:${index * 40}ms">
    <td data-label="Code">${safe(p.code)}</td><td data-label="Name">${safe(p.name)}</td><td data-label="Category">${safe(p.category)}</td>
    <td data-label="Price">${peso(p.price)}</td><td data-label="Qty">${p.quantity}</td>
    <td class="act">
      <button class="btn small" data-restore="${safe(p.code)}">Restore</button>
      <button class="btn small danger" data-delete="${safe(p.code)}">Delete</button></td></tr>`).join('');
}

// Restore / Delete buttons inside the Archived table
if (ADMIN) {
  $('#arows').onclick = async (event) => {
    const restoreCode = event.target.dataset.restore;
    const deleteCode  = event.target.dataset.delete;

    if (restoreCode) {
      const result = await api('restore', { code: restoreCode });
      showToast(result.msg, result.ok);
      loadArchived();
      loadInventory();
    }
    if (deleteCode) {
      askAndDelete(deleteCode);
    }
  };
}


// ---------- Add / Edit product form (pop-up) ----------
function openProductForm(product = null) {
  const form = $('#fprod');
  form.reset();
  $('#mt').textContent = product ? 'Edit product' : 'Add product';
  form.edit.value = product ? 1 : '';
  form.code.readOnly = product !== null;          // code cannot change when editing

  if (product) {
    ['code', 'name', 'category', 'price', 'reorder_level', 'quantity']
      .forEach(field => { form[field].value = product[field]; });
  }
  $('#modal').classList.add('open');
}

if (ADMIN) { $('#add').onclick = () => openProductForm(); }
if (ADMIN) {
  $('#cancel').onclick = () => $('#modal').classList.remove('open');

  $('#fprod').onsubmit = async (event) => {
    event.preventDefault();                          // don't reload the page
    const data = Object.fromEntries(new FormData(event.target));
    const result = await api('save', data);
    showToast(result.msg, result.ok);
    if (result.ok) {
      $('#modal').classList.remove('open');
      loadInventory();
    }
  };
}


// ---------- Stock-In and Sale forms ----------

// While typing a product code, show the product name and stock (hash table lookup)
$$('.code').forEach(input => {
  input.oninput = async () => {
    const infoBox = input.closest('form').querySelector('.found');
    if (input.value.trim() === '') { infoBox.innerHTML = ''; return; }

    const result = await api('lookup', null, '&code=' + encodeURIComponent(input.value));
    if (result.ok) {
      infoBox.innerHTML = `<span class="tag okk">${safe(result.p.name)} — stock ${result.p.quantity}, ${peso(result.p.price)}</span>`;
    } else {
      infoBox.innerHTML = `<span class="tag low">${result.msg}</span>`;
    }
  };
});

// Connect a form to an api action ('stockin' or 'sale')
function setupTransactionForm(formSelector, action) {
  const form = $(formSelector);
  form.querySelector('[name=date]').value = today();

  form.onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const result = await api(action, data);
    showToast(result.msg, result.ok);

    if (result.ok) {                               // clear the form after success
      form.reset();
      form.querySelector('[name=date]').value = today();
      form.querySelector('.found').innerHTML = '';
      loadInventory();
    }
  };
}
setupTransactionForm('#fin', 'stockin');
setupTransactionForm('#fsale', 'sale');


// ---------- History tab ----------
async function loadHistory() {
  const result = await api('history');
  if (result.rows.length === 0) {
    $('#hrows').innerHTML = '<tr><td colspan="9" class="empty">No transactions yet.</td></tr>';
    return;
  }
  $('#hrows').innerHTML = result.rows.map((t, index) => {
    const typeText   = t.type === 'sale' ? 'Sale' : 'Stock-in';
    const amountText = t.type === 'sale' ? peso(t.amount) : '-';
    const undone     = t.undone == 1;
    return `<tr style="animation-delay:${index * 30}ms">
      <td data-label="#">${t.id}</td><td data-label="Date">${t.tdate}</td><td data-label="Type">${typeText}</td><td data-label="Product">${safe(t.name)}</td>
      <td data-label="Qty">${t.qty}</td><td data-label="Amount">${amountText}</td><td data-label="Supplier">${safe(t.supplier || '-')}</td><td data-label="By">${safe(t.created_by)}</td>
      <td data-label="Status"><span class="tag ${undone ? 'low' : 'okk'}">${undone ? 'Undone' : 'Done'}</span></td></tr>`;
  }).join('');
}


// ---------- Reports Dashboard (Admin only) ----------
async function loadReport() {
  if (!ADMIN) { return; }
  const r = await api('report');
  if (!r.ok) { return; }

  const cards = [
    ['Inventory value', r.value, true],
    ['Products', r.products, false],
    ['Archived products', r.archived, false],
    ['Low-stock items', r.low, false],
    ['Total sales', r.sales, true],
    ['Units sold', r.sold, false],
  ];
  $('#stats').innerHTML = cards.map(c =>
    `<div class="stat"><span>${c[0]}</span><b data-value="${c[1]}" data-money="${c[2]}">0</b></div>`).join('');
  $$('.stat b').forEach(b => countUp(b, Number(b.dataset.value), b.dataset.money === 'true'));

  // Top-selling bars (the longest bar = the best seller)
  const biggest = Math.max(1, ...r.top.map(t => Number(t.qty)));
  if (r.top.length === 0) { $('#top').innerHTML = '<p class="empty">No sales yet.</p>'; return; }
  $('#top').innerHTML = r.top.map(t =>
    `<div class="bar2"><span>${safe(t.name)}</span><i style="--w:${t.qty / biggest * 100}%"></i><em>${t.qty}</em></div>`).join('');
}


// ---------- Start ----------
loadInventory();
