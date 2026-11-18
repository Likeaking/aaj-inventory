// =====================================================================
// app.js  -  the browser side of the Inventory System.
//
// What this file does:
//   1. shows the tables (Inventory, History, Archived, Reports)
//   2. handles the buttons and forms
//   3. talks to api.php using fetch()  (api.php does the real work)
//
// Flow of every button:  click -> api() -> server answers -> update the screen
// =====================================================================


// =====================================================================
// 1. SMALL HELPERS
// =====================================================================

// Is the logged-in user the Admin?  (dashboard.php puts the role in <body data-role="...">)
const ADMIN = document.body.dataset.role === 'admin';

// Shortcuts so we type less
function $(selector)  { return document.querySelector(selector); }      // get ONE element
function $$(selector) { return document.querySelectorAll(selector); }   // get MANY elements

// Make text safe before putting it inside HTML (stops <script> tricks)
function safe(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 1234.5 -> ₱1,234.50
function peso(number) {
  return '₱' + Number(number).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

// Today's date as YYYY-MM-DD, using the computer's LOCAL time.
// (We do NOT use toISOString() because it uses UTC. In the Philippines
//  that would show yesterday's date before 8:00 AM.)
function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day   = String(now.getDate()).padStart(2, '0');
  return now.getFullYear() + '-' + month + '-' + day;
}

// Turn a form's fields into an object, e.g. { code: 'DF-01', qty: '5' }
function getFormData(form) {
  return Object.fromEntries(new FormData(form));
}

// Call api.php.  If "data" is given, it is sent as JSON (POST).
// This function ALWAYS gives back an object with "ok" and "msg",
// so the code that uses it never crashes, even if the server is off.
async function api(action, data = null, extra = '') {
  const options = data ? { method: 'POST', body: JSON.stringify(data) } : {};
  try {
    const response = await fetch('api.php?a=' + action + extra, options);
    if (response.status === 401) {          // not logged in anymore
      location = 'index.php';
      return { ok: false, msg: 'Please log in again.' };
    }
    return await response.json();
  } catch (error) {
    return { ok: false, msg: 'Cannot reach the server. Is XAMPP (Apache + MySQL) running?' };
  }
}

// Small message at the bottom-right
let toastTimer;
function showToast(message, ok = true) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = 'show ' + (ok ? 'ok' : 'bad');

  clearTimeout(toastTimer);                 // cancel the old timer so a new message is not hidden too early
  toastTimer = setTimeout(() => { toast.className = ''; }, 3200);
}

// Animated counting number (used in the Reports tab)
function countUp(element, target, isMoney) {
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / 900, 1);   // goes from 0 to 1 in 0.9 seconds
    const value = target * progress;
    element.textContent = isMoney ? peso(value) : Math.round(value);
    if (progress < 1) { requestAnimationFrame(step); }
  }
  requestAnimationFrame(step);
}


// =====================================================================
// 2. TABS  (left menu)
// =====================================================================
$$('nav a').forEach(link => {
  link.onclick = () => {
    // highlight the clicked menu item
    $$('nav a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');

    // show only the tab that was clicked
    $$('.tab').forEach(tab => tab.classList.remove('show'));
    $('#' + link.dataset.tab).classList.add('show');

    // these tabs need fresh data from the server every time they open
    if (link.dataset.tab === 'hist') { loadHistory(); }
    if (link.dataset.tab === 'arch') { loadArchived(); }
    if (link.dataset.tab === 'rep')  { loadReport(); }
  };
});


// =====================================================================
// 3. INVENTORY TABLE
// =====================================================================
let products = [];          // latest product list from the server
let latestRequest = 0;      // used to ignore old answers (see loadInventory)

// Build the HTML of ONE table row
function productRow(p, index) {
  const isLow = p.quantity <= p.reorder_level;
  const statusClass = isLow ? 'low' : 'okk';
  const statusText  = isLow ? 'Low stock' : 'In stock';

  // The column you are sorting by gets class="hl" (its letters become bold)
  const sortBy = $('#sf').value;
  function hl(field) { return field === sortBy ? ' class="hl"' : ''; }

  // Edit / Archive / Delete buttons are for the Admin only
  let buttons = '';
  if (ADMIN) {
    buttons = `<td class="act">
      <button class="btn small ghost" data-edit="${safe(p.code)}">Edit</button>
      <button class="btn small warn" data-archive="${safe(p.code)}">Archive</button>
      <button class="btn small danger" data-delete="${safe(p.code)}">Delete</button></td>`;
  }

  // animation-delay makes the rows appear one after another
  return `<tr style="animation-delay:${index * 40}ms">
    <td data-label="Code"${hl('code')}>${safe(p.code)}</td>
    <td data-label="Name"${hl('name')}>${safe(p.name)}</td>
    <td data-label="Category">${safe(p.category)}</td>
    <td data-label="Price"${hl('price')}>${peso(p.price)}</td>
    <td data-label="Qty"${hl('quantity')}>${p.quantity}</td>
    <td data-label="Reorder">${p.reorder_level}</td>
    <td data-label="Status"><span class="tag ${statusClass}">${statusText}</span></td>${buttons}</tr>`;
}

async function loadInventory() {
  // Remember which request this is. If the user types again before the
  // server answers, an OLD answer must not replace the NEWER one.
  latestRequest = latestRequest + 1;
  const thisRequest = latestRequest;

  const searchText = $('#q').value.trim();
  const sortField  = $('#sf').value;
  const sortDir    = $('#sd').value;

  // Step 1: get the whole list, sorted by the server (merge sort)
  const listResult = await api('list', null, '&f=' + sortField + '&d=' + sortDir);
  if (thisRequest !== latestRequest) { return; }        // old answer -> ignore
  if (!listResult.ok) { showToast(listResult.msg, false); return; }

  products = listResult.rows;
  let rowsToShow = products;

  // Step 2: if something is typed, show only the results of the binary search
  if (searchText !== '') {
    const searchResult = await api('search', null, '&q=' + encodeURIComponent(searchText));
    if (thisRequest !== latestRequest) { return; }      // old answer -> ignore
    if (!searchResult.ok) { showToast(searchResult.msg, false); return; }
    rowsToShow = searchResult.rows;
  }

  // Step 3: draw the table
  if (rowsToShow.length === 0) {
    const message = searchText ? 'Product not found.' : 'No products yet.';
    $('#rows').innerHTML = `<tr><td colspan="8" class="empty">${message}</td></tr>`;
  } else {
    $('#rows').innerHTML = rowsToShow.map(productRow).join('');
  }
  showLowStockAlert();
}

// Yellow bar listing the products that reached the reorder level (Admin only)
function showLowStockAlert() {
  if (!ADMIN) { return; }

  const lowItems = products.filter(p => p.quantity <= p.reorder_level);
  if (lowItems.length === 0) {
    $('#alerts').innerHTML = '';
    return;
  }
  const names = lowItems.map(p => safe(p.name) + ' (' + p.quantity + ')').join(', ');
  $('#alerts').innerHTML = `<div class="alert pulse">⚠ Low stock: ${names}</div>`;
}

// Search box: wait 0.2 seconds after the last key, so we don't spam the server
let typingTimer;
$('#q').oninput = () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(loadInventory, 200);
};
$('#sf').onchange = loadInventory;   // changed the sort column
$('#sd').onchange = loadInventory;   // changed ascending / descending

// "Undo last" button (uses the stack in the server)
$('#undo').onclick = async () => {
  const result = await api('undo', {});
  showToast(result.msg, result.ok);
  loadInventory();
};

// Edit / Archive / Delete buttons inside the table.
// (One listener on the whole table; we check which button was clicked.)
$('#rows').onclick = async (event) => {
  const editCode    = event.target.dataset.edit;
  const archiveCode = event.target.dataset.archive;
  const deleteCode  = event.target.dataset.delete;

  if (editCode) {
    const product = products.find(p => p.code === editCode);
    openProductForm(product);
  }
  if (archiveCode && confirm('Archive this product?')) {
    const result = await api('archive', { code: archiveCode });
    showToast(result.msg, result.ok);
    loadInventory();
  }
  if (deleteCode) {
    askAndDelete(deleteCode);
  }
};

// Ask first, then delete the product permanently
async function askAndDelete(code) {
  const warning = 'Delete ' + code + ' permanently?\n\n' +
                  'Its stock-in and sale history will also be deleted. This cannot be undone.\n' +
                  '(Use Archive instead if you may need it again.)';
  if (!confirm(warning)) { return; }

  const result = await api('delete', { code: code });
  showToast(result.msg, result.ok);
  loadInventory();
  if ($('#arch').classList.contains('show')) { loadArchived(); }   // refresh Archived tab if it is open
}


// =====================================================================
// 4. ARCHIVED TAB  (Admin only)
// =====================================================================
async function loadArchived() {
  if (!ADMIN) { return; }

  const result = await api('archived');
  if (!result.ok) { showToast(result.msg, false); return; }

  if (result.rows.length === 0) {
    $('#arows').innerHTML = '<tr><td colspan="6" class="empty">No archived products.</td></tr>';
    return;
  }

  $('#arows').innerHTML = result.rows.map((p, index) => `<tr style="animation-delay:${index * 40}ms">
    <td data-label="Code">${safe(p.code)}</td>
    <td data-label="Name">${safe(p.name)}</td>
    <td data-label="Category">${safe(p.category)}</td>
    <td data-label="Price">${peso(p.price)}</td>
    <td data-label="Qty">${p.quantity}</td>
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


// =====================================================================
// 5. ADD / EDIT PRODUCT FORM  (pop-up, Admin only)
// =====================================================================

// product = null  -> "Add" mode (empty form)
// product = {...} -> "Edit" mode (form is filled with the product)
function openProductForm(product = null) {
  const form = $('#fprod');
  form.reset();

  $('#mt').textContent = product ? 'Edit product' : 'Add product';
  form.elements.edit.value = product ? 1 : '';          // hidden field: tells api.php "this is an edit"
  form.elements.code.readOnly = (product !== null);     // the code cannot be changed when editing

  if (product) {
    const fields = ['code', 'name', 'category', 'price', 'reorder_level', 'quantity'];
    fields.forEach(field => { form.elements[field].value = product[field]; });
  }
  $('#modal').classList.add('open');
}

if (ADMIN) {
  $('#add').onclick    = () => openProductForm();
  $('#cancel').onclick = () => $('#modal').classList.remove('open');

  $('#fprod').onsubmit = async (event) => {
    event.preventDefault();                              // stop the page from reloading
    const result = await api('save', getFormData(event.target));
    showToast(result.msg, result.ok);

    if (result.ok) {
      $('#modal').classList.remove('open');
      loadInventory();
    }
  };
}


// =====================================================================
// 6. STOCK-IN AND SALE FORMS
// =====================================================================

// While typing a product code, show the product name and stock (hash table lookup in the server)
$$('.code').forEach(input => {
  input.oninput = async () => {
    const infoBox = input.closest('form').querySelector('.found');
    const code = input.value.trim();

    if (code === '') { infoBox.innerHTML = ''; return; }

    const result = await api('lookup', null, '&code=' + encodeURIComponent(code));

    // If the user kept typing while we waited, this answer is old -> ignore it
    if (input.value.trim() !== code) { return; }

    if (result.ok) {
      infoBox.innerHTML = `<span class="tag okk">${safe(result.p.name)} — stock ${result.p.quantity}, ${peso(result.p.price)}</span>`;
    } else {
      infoBox.innerHTML = `<span class="tag low">${safe(result.msg)}</span>`;
    }
  };
});

// Connect a form to an api action ('stockin' or 'sale')
function setupTransactionForm(formSelector, action) {
  const form   = $(formSelector);
  const button = form.querySelector('button');
  form.querySelector('[name=date]').value = today();     // default date = today

  form.onsubmit = async (event) => {
    event.preventDefault();

    button.disabled = true;                              // stops double-clicking (would record it twice)
    const result = await api(action, getFormData(form));
    button.disabled = false;
    showToast(result.msg, result.ok);

    if (result.ok) {                                     // clear the form after success
      form.reset();
      form.querySelector('[name=date]').value = today();
      form.querySelector('.found').innerHTML = '';
      loadInventory();
    }
  };
}
setupTransactionForm('#fin', 'stockin');
setupTransactionForm('#fsale', 'sale');


// =====================================================================
// 7. HISTORY TAB
// =====================================================================
async function loadHistory() {
  const result = await api('history');
  if (!result.ok) { showToast(result.msg, false); return; }

  if (result.rows.length === 0) {
    $('#hrows').innerHTML = '<tr><td colspan="9" class="empty">No transactions yet.</td></tr>';
    return;
  }

  $('#hrows').innerHTML = result.rows.map((t, index) => {
    const typeText   = t.type === 'sale' ? 'Sale' : 'Stock-in';
    const amountText = t.type === 'sale' ? peso(t.amount) : '-';
    const undone     = (t.undone == 1);

    return `<tr style="animation-delay:${index * 30}ms">
      <td data-label="#">${t.id}</td>
      <td data-label="Date">${t.tdate}</td>
      <td data-label="Type">${typeText}</td>
      <td data-label="Product">${safe(t.name)}</td>
      <td data-label="Qty">${t.qty}</td>
      <td data-label="Amount">${amountText}</td>
      <td data-label="Supplier">${safe(t.supplier || '-')}</td>
      <td data-label="By">${safe(t.created_by)}</td>
      <td data-label="Status"><span class="tag ${undone ? 'low' : 'okk'}">${undone ? 'Undone' : 'Done'}</span></td></tr>`;
  }).join('');
}


// =====================================================================
// 8. REPORTS DASHBOARD  (Admin only)
// =====================================================================
async function loadReport() {
  if (!ADMIN) { return; }

  const r = await api('report');
  if (!r.ok) { showToast(r.msg, false); return; }

  // The six number cards at the top
  const cards = [
    { label: 'Inventory value',   value: r.value,    isMoney: true  },
    { label: 'Products',          value: r.products, isMoney: false },
    { label: 'Archived products', value: r.archived, isMoney: false },
    { label: 'Low-stock items',   value: r.low,      isMoney: false },
    { label: 'Total sales',       value: r.sales,    isMoney: true  },
    { label: 'Units sold',        value: r.sold,     isMoney: false },
  ];
  $('#stats').innerHTML = cards.map(card =>
    `<div class="stat"><span>${card.label}</span><b>0</b></div>`).join('');

  const numberBoxes = $$('.stat b');
  cards.forEach((card, i) => countUp(numberBoxes[i], Number(card.value), card.isMoney));

  // Top-selling bars (the longest bar = the best seller)
  if (r.top.length === 0) {
    $('#top').innerHTML = '<p class="empty">No sales yet.</p>';
    return;
  }
  const biggest = Math.max(1, ...r.top.map(t => Number(t.qty)));
  $('#top').innerHTML = r.top.map(t =>
    `<div class="bar2"><span>${safe(t.name)}</span><i style="--w:${t.qty / biggest * 100}%"></i><em>${t.qty}</em></div>`).join('');
}


// =====================================================================
// START  -  load the inventory when the page opens
// =====================================================================
loadInventory();
