/**
 * Lógica de la SPA: catálogo público, inicio de sesión y panel por rol.
 * Rutas en router.js; textos en i18n.js; búsqueda en catalogWorker.js.
 */
const { t, formatCurrency, formatDate, translateError, setLocale, getLocale } = window.I18n;
const { isValidEmail, isValidPassword, isValidName, isNonNegativeInteger } = window.Validators;

/** Valida `value` con `check` (una de las funciones de validators.js); si falla, muestra el error en `resultEl` y corta el flujo. */
function validateField(value, check, messageKey, resultEl) {
  if (check(value)) return true;
  showResult(resultEl, false, t(messageKey));
  return false;
}

// ---------- Países (llamadas asíncronas a apicountries.com) ----------
const regionSel = document.getElementById('countryRegion');
const countrySel = document.getElementById('countrySelect');
const countryResult = document.getElementById('countryResult');
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
let countryRequest = 0; // descarta respuestas viejas si el usuario cambia rápido de selección

function renderRegionOptions() {
  const current = regionSel.value;
  regionSel.innerHTML = `<option value="">${t('countries.choose')}</option>`
    + Countries.REGIONS.map((r) => `<option value="${r}">${r}</option>`).join('');
  regionSel.value = current;
}

regionSel.addEventListener('change', async () => {
  const req = ++countryRequest;
  document.getElementById('countryTableWrap').style.display = 'none';
  countryResult.style.display = 'none';
  countrySel.disabled = true;
  if (!regionSel.value) { countrySel.innerHTML = ''; return; }
  countrySel.innerHTML = `<option>${t('countries.loading')}</option>`;
  try {
    const list = await Countries.fetchCountriesByRegion(regionSel.value);
    if (req !== countryRequest) return;
    countrySel.innerHTML = `<option value="">${t('countries.choose')}</option>`
      + list.map((c) => `<option value="${c.code}">${escapeHtml(c.name)}</option>`).join('');
    countrySel.disabled = false;
  } catch {
    if (req !== countryRequest) return;
    countrySel.innerHTML = '';
    showResult(countryResult, false, t('countries.error'));
  }
});

countrySel.addEventListener('change', async () => {
  const req = ++countryRequest;
  const wrap = document.getElementById('countryTableWrap');
  wrap.style.display = 'none';
  countryResult.style.display = 'none';
  if (!countrySel.value) return;
  try {
    const { name, nativeName, rows } = await Countries.fetchCountryDetail(countrySel.value);
    if (req !== countryRequest) return;
    document.getElementById('countryCaption').textContent = name;
    document.getElementById('countryTableBody').innerHTML = rows.map((r) =>
      `<tr><td>${escapeHtml(r.language)}</td><td>${escapeHtml(r.languageNative)}</td><td>${escapeHtml(nativeName)}</td></tr>`).join('');
    wrap.style.display = '';
  } catch {
    if (req !== countryRequest) return;
    showResult(countryResult, false, t('countries.error'));
  }
});

function showResult(el, ok, message) {
  el.style.display = 'block';
  el.className = 'result ' + (ok ? 'ok' : 'error');
  el.textContent = message;
}

function loanBadge(l) {
  if (l.status === 'RETURNED') return `<span class="badge badge-returned">${t('loans.badgeReturned')}</span>`;
  const isOverdue = new Date(l.dueDate).getTime() < Date.now();
  return isOverdue
    ? `<span class="badge badge-overdue">${t('loans.badgeOverdue')}</span>`
    : `<span class="badge badge-active">${t('loans.badgeActive')}</span>`;
}

// En local el backend sirve este mismo HTML, así que la API es el mismo origen.
const API_BASE_URL = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? ''
  : 'https://biblioteca-backend-438047115829.us-central1.run.app';

async function fetchJson(path, options = {}) {
  const token = localStorage.getItem('authToken');
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(API_BASE_URL + path + sep + 'lang=' + getLocale(), { ...options, headers });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401) {
    clearSession();
  }
  return { ok: res.ok, data };
}

function errorMessage(data) {
  return translateError(data);
}

let allUsers = [];
let allBooks = [];
let allLoans = [];
let allDebts = [];
let currentSettings = null;

async function loadAll() {
  [allUsers, allBooks, currentSettings] = await Promise.all([
    fetchJson('/api/v1/users').then((r) => r.data),
    fetchJson('/api/v1/books').then((r) => r.data),
    fetchJson('/api/v1/settings').then((r) => r.data),
  ]);
  renderLoanForm();
  renderBooksTable();
  renderUsersTable();
  renderSettingsForm();
  await loadLoans();
  await loadDebts();
  renderStaffSummary();
  await loadCatalog(); // el catálogo lee /books igual que allBooks; se refresca en cada acción de staff para no quedar desactualizado
}

// ---------- Catálogo (público: no requiere sesión) ----------
let allCatalogBooks = [];

function renderCatalogGrid(books) {
  const grid = document.getElementById('catalogGrid');
  const empty = document.getElementById('catalogEmpty');

  document.getElementById('catalogCount').textContent = t('home.resultsCount', { count: books.length });
  if (books.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = books
    .map((b) => {
      const cover = b.coverUrl
        ? `<img class="catalog-cover" loading="lazy" src="${escapeHtml(b.coverUrl)}" alt="${escapeHtml(t('books.coverAlt', { title: b.title }))}">`
        : `<div class="catalog-cover-placeholder" aria-hidden="true">${(b.title || '?').charAt(0).toUpperCase()}</div>`;
      const badgeClass = b.availableCopies > 0 ? 'badge-active' : 'badge-unpaid';
      const badgeText = b.availableCopies > 0
        ? t('loans.availableOf', { available: b.availableCopies, total: b.totalCopies })
        : t('catalog.outOfStock');
      return `<div class="catalog-card">
        ${cover}
        <div class="catalog-card-body">
          <div class="catalog-card-title">${escapeHtml(b.title)}</div>
          <div class="catalog-card-author">${escapeHtml(b.author)}</div>
          ${b.publishYear ? `<div class="catalog-card-year">${b.publishYear}</div>` : ''}
          <div class="catalog-card-badge"><span class="badge ${badgeClass}">${badgeText}</span></div>
        </div>
      </div>`;
    })
    .join('');
}

// La búsqueda corre en un Web Worker (catalogWorker.js) para no bloquear
// la UI con catálogos grandes. Sin soporte de Worker, filtra aquí mismo.
const catalogWorker = window.Worker ? new Worker('catalogWorker.js') : null;
let catalogQueryId = 0;
if (catalogWorker) {
  catalogWorker.onmessage = (e) => {
    if (e.data.id === catalogQueryId) renderCatalogGrid(e.data.books); // descarta respuestas de teclas anteriores
  };
}

function filterCatalog(query) {
  if (!catalogWorker) return renderCatalogGrid(Catalog.filterBooks(allCatalogBooks, query));
  catalogWorker.postMessage({ type: 'filter', id: ++catalogQueryId, query });
}

async function loadCatalog() {
  const { data } = await fetchJson('/api/v1/books');
  allCatalogBooks = data || [];
  renderHomeStats(allCatalogBooks);
  catalogWorker?.postMessage({ type: 'set', books: allCatalogBooks });
  filterCatalog(document.getElementById('catalogSearch').value);
}

document.getElementById('catalogSearch').addEventListener('input', (e) => filterCatalog(e.target.value));

/** Pone `value` en la tarjeta `id`; `alert` la pinta en rojo (solo si hay algo que atender). */
function setStat(id, value, alert = false) {
  const el = document.getElementById(id);
  el.textContent = value;
  el.closest('.stat').classList.toggle('warn', alert);
}

// Portada que no carga (Open Library caído, URL vieja): se reemplaza por la inicial.
document.getElementById('catalogGrid').addEventListener('error', (e) => {
  if (e.target.tagName !== 'IMG') return;
  const ph = document.createElement('div');
  ph.className = 'catalog-cover-placeholder';
  ph.setAttribute('aria-hidden', 'true');
  ph.textContent = (e.target.closest('.catalog-card').querySelector('.catalog-card-title').textContent || '?').charAt(0).toUpperCase();
  e.target.replaceWith(ph);
}, true);

function renderHomeStats(books) {
  const set = (id, v) => setStat(id, v);
  set('statTitles', books.length);
  set('statAvailable', books.reduce((n, b) => n + (b.availableCopies || 0), 0));
  set('statAuthors', new Set(books.map((b) => b.author)).size);
  const out = books.filter((b) => !b.availableCopies).length;
  setStat('statOut', out, out > 0);
}

// ---------- Catálogo en vivo (WebSocket) ----------
// El servidor avisa cuando cambia un libro o un préstamo; el aviso no trae
// datos, solo dispara un loadCatalog() (que va por la API con el token).
let liveSocket = null;

function connectLive() {
  if (liveSocket) return; // el aviso no lleva datos: no necesita sesión
  const badge = document.getElementById('catalogLive');
  liveSocket = new WebSocket((API_BASE_URL || location.origin).replace(/^http/, 'ws') + '/ws');
  liveSocket.onopen = () => {
    badge.hidden = false;
    loadCatalog(); // por si cambió algo mientras estaba desconectado
  };
  liveSocket.onmessage = () => loadCatalog();
  // Cloud Run corta las conexiones largas cada cierto tiempo: se reconecta solo.
  liveSocket.onclose = () => {
    badge.hidden = true;
    liveSocket = null;
    setTimeout(connectLive, 3000);
  };
}

// ---------- Préstamos ----------
function renderLoanForm() {
  document.getElementById('loanUserId').innerHTML = allUsers
    .filter((u) => u.status === 'ACTIVE')
    .map((u) => `<option value="${u.id}">${u.name}</option>`)
    .join('');
  document.getElementById('loanBookId').innerHTML = allBooks
    .map((b) => `<option value="${b.id}">${b.title} (${t('loans.availableOf', { available: b.availableCopies, total: b.totalCopies })})</option>`)
    .join('');
  document.getElementById('loanSubmit').textContent = t('loans.submit', { days: currentSettings?.loanPeriodDays ?? '' });
}

async function loadLoans() {
  const overdue = document.getElementById('onlyOverdue').checked;
  const { data: loans } = await fetchJson('/api/v1/loans' + (overdue ? '?overdue=true' : ''));
  allLoans = loans;
  const userName = (id) => allUsers.find((u) => u.id === id)?.name ?? id;

  document.getElementById('loansTableBody').innerHTML = loans
    .slice()
    .reverse()
    .map((l) => {
      const badge = loanBadge(l);
      const provisional = l.provisionalFine != null
        ? `<div class="provisional-fine">${t('loans.provisionalFine', { amount: formatCurrency(l.provisionalFine) })}</div>`
        : '';
      const action = l.status === 'ACTIVE'
        ? `<button class="success" data-return-loan="${l.id}">${t('loans.returnAction')}</button>`
        : '';
      return `<tr>
        <td>${userName(l.userId)}</td>
        <td>${l.bookTitle ?? t('loans.unknownBook')}</td>
        <td>${formatDate(l.dueDate)}</td>
        <td>${badge}${provisional}</td>
        <td>${action}</td>
      </tr>`;
    })
    .join('');

  document.querySelectorAll('[data-return-loan]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { ok, data } = await fetchJson(`/api/v1/loans/${btn.dataset.returnLoan}/return`, { method: 'POST' });
      const message = ok
        ? data.fineAmount > 0
          ? t('loans.returnedLate', { amount: formatCurrency(data.fineAmount) })
          : t('loans.returnedOnTime')
        : errorMessage(data);
      showResult(document.getElementById('loanResult'), ok, message);
      if (ok) await loadAll();
    });
  });
}

document.getElementById('onlyOverdue').addEventListener('change', loadLoans);

document.getElementById('loanSubmit').addEventListener('click', async () => {
  const userId = document.getElementById('loanUserId').value;
  const bookId = document.getElementById('loanBookId').value;
  const userName = allUsers.find((u) => u.id === userId)?.name ?? '';
  const bookTitle = allBooks.find((b) => b.id === bookId)?.title ?? '';
  const { ok, data } = await fetchJson('/api/v1/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, bookId }),
  });
  const message = ok
    ? t('loans.created', { book: bookTitle, user: userName, date: formatDate(data.dueDate) })
    : errorMessage(data);
  showResult(document.getElementById('loanResult'), ok, message);
  if (ok) await loadAll();
});

// ---------- Libros ----------
let editingBookId = null;
// Portada/año no tienen campo propio en el formulario: se capturan al
// usar la búsqueda de Open Library (o se precargan al editar un libro
// que ya los tenía) y viajan junto con título/autor al guardar.
let pendingCoverUrl = null;
let pendingPublishYear = null;

function renderBooksTable() {
  document.getElementById('booksTableBody').innerHTML = allBooks
    .map(
      (b) => `<tr>
        <td>${b.title}</td>
        <td>${b.author}</td>
        <td>${b.availableCopies}/${b.totalCopies}</td>
        <td>
          <div class="inline-stock">
            <input type="number" min="1" value="1" id="stock-${b.id}">
            <button class="secondary" data-add-stock="${b.id}">${t('books.addStockAction')}</button>
          </div>
        </td>
        <td><div class="row-actions">
          <button class="secondary" data-edit-book="${b.id}">${t('books.editAction')}</button>
          <button class="danger" data-delete-book="${b.id}">${t('books.deleteAction')}</button>
        </div></td>
      </tr>`
    )
    .join('');

  document.querySelectorAll('[data-delete-book]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const book = allBooks.find((b) => b.id === btn.dataset.deleteBook);
      const { ok, data } = await fetchJson(`/api/v1/books/${btn.dataset.deleteBook}`, { method: 'DELETE' });
      const message = ok ? t('books.deleted', { title: book?.title ?? '' }) : errorMessage(data);
      showResult(document.getElementById('bookResult'), ok, message);
      await loadAll();
    });
  });

  document.querySelectorAll('[data-edit-book]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const book = allBooks.find((b) => b.id === btn.dataset.editBook);
      if (!book) return;
      editingBookId = book.id;
      document.getElementById('bookTitle').value = book.title;
      document.getElementById('bookAuthor').value = book.author;
      pendingCoverUrl = book.coverUrl || null;
      pendingPublishYear = book.publishYear || null;
      const cover = document.getElementById('bookCoverPreview');
      if (book.coverUrl) {
        cover.src = book.coverUrl;
        cover.alt = t('books.coverAlt', { title: book.title });
        cover.style.display = 'block';
      } else {
        cover.style.display = 'none';
      }
      document.getElementById('bookCopiesLabel').style.display = 'none';
      document.getElementById('bookCopies').style.display = 'none';
      document.getElementById('bookFormTitle').textContent = t('books.editTitle');
      document.getElementById('bookSubmit').textContent = t('books.submitSave');
      document.getElementById('bookCancelEdit').style.display = 'block';
    });
  });

  document.querySelectorAll('[data-add-stock]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const bookId = btn.dataset.addStock;
      const book = allBooks.find((b) => b.id === bookId);
      const rawQuantity = document.getElementById(`stock-${bookId}`).value;
      if (!validateField(rawQuantity, isNonNegativeInteger, 'validation.integerInvalid', document.getElementById('bookResult'))) return;
      const quantity = Number(rawQuantity);
      const { ok, data } = await fetchJson(`/api/v1/books/${bookId}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const message = ok
        ? t('books.stockAdded', { qty: quantity, count: quantity, title: book?.title ?? '' })
        : errorMessage(data);
      showResult(document.getElementById('bookResult'), ok, message);
      await loadAll();
    });
  });
}

function resetBookForm() {
  editingBookId = null;
  pendingCoverUrl = null;
  pendingPublishYear = null;
  document.getElementById('bookTitle').value = '';
  document.getElementById('bookAuthor').value = '';
  document.getElementById('bookCopies').value = '1';
  document.getElementById('bookSearchQuery').value = '';
  document.getElementById('bookSearchResult').style.display = 'none';
  document.getElementById('bookSearchList').style.display = 'none';
  document.getElementById('bookSearchList').innerHTML = '';
  document.getElementById('bookSearchPagination').style.display = 'none';
  document.getElementById('bookCoverPreview').style.display = 'none';
  document.getElementById('bookCopiesLabel').style.display = 'block';
  document.getElementById('bookCopies').style.display = 'block';
  document.getElementById('bookFormTitle').textContent = t('books.addTitle');
  document.getElementById('bookSubmit').textContent = t('books.submitAdd');
  document.getElementById('bookCancelEdit').style.display = 'none';
}

// ---------- Búsqueda de libro (Open Library, servicio externo) ----------
// ISBN exacto -> autocompleta directo. Texto libre (título/autor) -> lista
// paginada para elegir. Un solo botón decide según el formato de lo tipeado.
let searchState = { query: '', page: 1 };

function applyBookResult(book) {
  const cover = document.getElementById('bookCoverPreview');
  if (book.title) document.getElementById('bookTitle').value = book.title;
  if (book.author) document.getElementById('bookAuthor').value = book.author;
  pendingCoverUrl = book.coverUrl || null;
  pendingPublishYear = book.year || null;
  if (book.coverUrl) {
    cover.src = book.coverUrl;
    cover.alt = t('books.coverAlt', { title: book.title });
    cover.style.display = 'block';
  } else {
    cover.style.display = 'none';
  }
}

function renderSearchResults(page) {
  const list = document.getElementById('bookSearchList');
  const pagination = document.getElementById('bookSearchPagination');

  if (page.results.length === 0) {
    list.style.display = 'none';
    pagination.style.display = 'none';
    return;
  }

  list.innerHTML = page.results
    .map((book, i) => {
      const meta = book.year ? `${book.author || ''} · ${book.year}` : (book.author || '');
      const cover = book.coverUrl
        ? `<img src="${book.coverUrl}" alt="">`
        : `<img alt="">`;
      return `<li class="search-result">
        ${cover}
        <div class="search-result-info">
          <div class="search-result-title">${book.title}</div>
          <div class="search-result-meta">${meta}</div>
        </div>
        <button type="button" class="secondary" data-use-result="${i}">${t('books.useThis')}</button>
      </li>`;
    })
    .join('');
  list.style.display = 'flex';

  list.querySelectorAll('[data-use-result]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyBookResult(page.results[Number(btn.dataset.useResult)]);
      list.style.display = 'none';
      pagination.style.display = 'none';
      showResult(document.getElementById('bookSearchResult'), true, t('books.isbnFound'));
    });
  });

  document.getElementById('bookSearchPageInfo').textContent = t('books.pageInfo', {
    page: page.page,
    totalPages: page.totalPages,
  });
  document.getElementById('bookSearchPrev').disabled = page.page <= 1;
  document.getElementById('bookSearchNext').disabled = page.page >= page.totalPages;
  pagination.style.display = 'flex';
}

async function runBookSearch(page) {
  const resultEl = document.getElementById('bookSearchResult');
  const btn = document.getElementById('bookSearchSubmit');
  btn.disabled = true;
  showResult(resultEl, true, t('books.searching'));
  try {
    const results = await OpenLibrary.fetchBooksByQuery(searchState.query, page, OpenLibrary.RESULTS_PER_PAGE);
    searchState.page = page;
    if (results.results.length === 0) {
      document.getElementById('bookSearchList').style.display = 'none';
      document.getElementById('bookSearchPagination').style.display = 'none';
      showResult(resultEl, false, t('books.searchNoResults'));
      return;
    }
    showResult(resultEl, true, t('books.resultsCount', { count: results.numFound }));
    renderSearchResults(results);
  } catch {
    // Sin red o el servicio externo caído: no bloquea el alta manual del libro.
    showResult(resultEl, false, t('books.searchServiceError'));
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('bookSearchSubmit').addEventListener('click', async () => {
  const query = document.getElementById('bookSearchQuery').value.trim();
  const resultEl = document.getElementById('bookSearchResult');
  const cover = document.getElementById('bookCoverPreview');
  document.getElementById('bookSearchList').style.display = 'none';
  document.getElementById('bookSearchPagination').style.display = 'none';

  if (!query) {
    showResult(resultEl, false, t('books.searchEmpty'));
    return;
  }

  if (OpenLibrary.isValidIsbn(query)) {
    const btn = document.getElementById('bookSearchSubmit');
    btn.disabled = true;
    showResult(resultEl, true, t('books.searching'));
    try {
      const book = await OpenLibrary.fetchBookByIsbn(query);
      if (!book) {
        cover.style.display = 'none';
        showResult(resultEl, false, t('books.searchNoResults'));
        return;
      }
      applyBookResult(book);
      showResult(resultEl, true, t('books.isbnFound'));
    } catch {
      showResult(resultEl, false, t('books.searchServiceError'));
    } finally {
      btn.disabled = false;
    }
    return;
  }

  searchState = { query, page: 1 };
  await runBookSearch(1);
});

document.getElementById('bookSearchPrev').addEventListener('click', () => {
  if (searchState.page > 1) runBookSearch(searchState.page - 1);
});
document.getElementById('bookSearchNext').addEventListener('click', () => {
  runBookSearch(searchState.page + 1);
});

document.getElementById('bookCancelEdit').addEventListener('click', resetBookForm);

document.getElementById('bookSubmit').addEventListener('click', async () => {
  const title = document.getElementById('bookTitle').value;
  const author = document.getElementById('bookAuthor').value;
  const isEditing = !!editingBookId;
  const rawCopies = document.getElementById('bookCopies').value;
  if (!isEditing && !validateField(rawCopies, isNonNegativeInteger, 'validation.integerInvalid', document.getElementById('bookResult'))) return;
  const url = isEditing ? `/api/v1/books/${editingBookId}` : '/api/v1/books';
  const method = isEditing ? 'PUT' : 'POST';
  const initialCopies = Number(rawCopies);
  const body = isEditing
    ? { title, author, coverUrl: pendingCoverUrl, publishYear: pendingPublishYear }
    : { title, author, initialCopies, coverUrl: pendingCoverUrl, publishYear: pendingPublishYear };
  const { ok, data } = await fetchJson(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const message = ok
    ? isEditing
      ? t('books.updated', { title: data.title })
      : t('books.created', { title: data.title, qty: initialCopies, count: initialCopies })
    : errorMessage(data);
  showResult(document.getElementById('bookResult'), ok, message);
  if (ok) {
    resetBookForm();
    await loadAll();
  }
});

// ---------- Usuarios ----------
let editingUserId = null;

function renderUsersTable() {
  document.getElementById('usersTableBody').innerHTML = allUsers
    .map((u) => {
      const badge = u.status === 'ACTIVE'
        ? `<span class="badge badge-active">${t('users.statusActive')}</span>`
        : `<span class="badge badge-inactive">${t('users.statusInactive')}</span>`;
      const statusBtn = u.status === 'ACTIVE'
        ? `<button class="secondary" data-toggle-status="${u.id}" data-next-status="INACTIVE">${t('users.deactivate')}</button>`
        : `<button class="secondary" data-toggle-status="${u.id}" data-next-status="ACTIVE">${t('users.activate')}</button>`;
      return `<tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${badge}</td>
        <td><div class="row-actions">
          <button class="ghost" data-view-user="${u.id}">${t('users.viewDetail')}</button>
          <button class="secondary" data-edit-user="${u.id}">${t('users.editAction')}</button>
          ${statusBtn}
          <button class="danger" data-delete-user="${u.id}">${t('users.deleteAction')}</button>
        </div></td>
      </tr>`;
    })
    .join('');

  document.querySelectorAll('[data-delete-user]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const user = allUsers.find((u) => u.id === btn.dataset.deleteUser);
      const { ok, data } = await fetchJson(`/api/v1/users/${btn.dataset.deleteUser}`, { method: 'DELETE' });
      const message = ok ? t('users.deleted', { name: user?.name ?? '' }) : errorMessage(data);
      showResult(document.getElementById('userResult'), ok, message);
      await loadAll();
    });
  });

  document.querySelectorAll('[data-toggle-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const user = allUsers.find((u) => u.id === btn.dataset.toggleStatus);
      const nextStatus = btn.dataset.nextStatus;
      const { ok, data } = await fetchJson(`/api/v1/users/${btn.dataset.toggleStatus}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const name = user?.name ?? t('users.defaultName');
      const message = ok
        ? nextStatus === 'ACTIVE'
          ? t('users.statusChangedActive', { name })
          : t('users.statusChangedInactive', { name })
        : errorMessage(data);
      showResult(document.getElementById('userResult'), ok, message);
      await loadAll();
    });
  });

  document.querySelectorAll('[data-edit-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const user = allUsers.find((u) => u.id === btn.dataset.editUser);
      if (!user) return;
      editingUserId = user.id;
      document.getElementById('userName').value = user.name;
      document.getElementById('userEmail').value = user.email;
      document.getElementById('userFormTitle').textContent = t('users.editTitle');
      document.getElementById('userSubmit').textContent = t('users.submitSave');
      document.getElementById('userCancelEdit').style.display = 'block';
    });
  });

  document.querySelectorAll('[data-view-user]').forEach((btn) => {
    btn.addEventListener('click', () => openUserDetail(btn.dataset.viewUser));
  });
}

function resetUserForm() {
  editingUserId = null;
  document.getElementById('userName').value = '';
  document.getElementById('userEmail').value = '';
  document.getElementById('userFormTitle').textContent = t('users.addTitle');
  document.getElementById('userSubmit').textContent = t('users.submitAdd');
  document.getElementById('userCancelEdit').style.display = 'none';
}

document.getElementById('userCancelEdit').addEventListener('click', resetUserForm);

document.getElementById('userSubmit').addEventListener('click', async () => {
  const name = document.getElementById('userName').value;
  const email = document.getElementById('userEmail').value;
  const userResultEl = document.getElementById('userResult');
  if (!validateField(name, isValidName, 'validation.nameInvalid', userResultEl)) return;
  if (!validateField(email, isValidEmail, 'validation.emailInvalid', userResultEl)) return;
  const isEditing = !!editingUserId;
  const url = isEditing ? `/api/v1/users/${editingUserId}` : '/api/v1/users';
  const method = isEditing ? 'PUT' : 'POST';
  const { ok, data } = await fetchJson(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email }),
  });
  const message = ok
    ? isEditing
      ? t('users.updated', { name: data.name })
      : t('users.created', { name: data.name })
    : errorMessage(data);
  showResult(document.getElementById('userResult'), ok, message);
  if (ok) {
    resetUserForm();
    await loadAll();
  }
});

// ---------- Detalle de usuario (modal) ----------
async function openUserDetail(userId) {
  const user = allUsers.find((u) => u.id === userId);
  const [loansRes, debtsRes] = await Promise.all([
    fetchJson(`/api/v1/users/${userId}/loans`),
    fetchJson(`/api/v1/users/${userId}/debts`),
  ]);

  document.getElementById('userDetailName').textContent = user ? user.name : userId;

  document.getElementById('userDetailLoans').innerHTML = loansRes.data
    .map((l) => `<tr><td>${l.bookTitle ?? t('loans.unknownBook')}</td><td>${formatDate(l.dueDate)}</td><td>${loanBadge(l)}</td></tr>`)
    .join('') || `<tr><td colspan="3" class="empty-note">${t('users.noLoans')}</td></tr>`;

  document.getElementById('userDetailDebts').innerHTML = debtsRes.data
    .map((d) => `<tr>
      <td>${formatCurrency(d.amount)}</td>
      <td>${formatDate(d.createdAt)}</td>
      <td>${d.paid ? `<span class="badge badge-paid">${t('debts.paid')}</span>` : `<span class="badge badge-unpaid">${t('debts.unpaid')}</span>`}</td>
      <td>${d.paid ? '' : `<button class="success" data-pay-debt="${d.id}">${t('debts.markPaid')}</button>`}</td>
    </tr>`)
    .join('') || `<tr><td colspan="4" class="empty-note">${t('users.noDebts')}</td></tr>`;

  document.querySelectorAll('[data-pay-debt]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { ok, data } = await fetchJson(`/api/v1/debts/${btn.dataset.payDebt}/pay`, { method: 'POST' });
      const message = ok ? t('debts.paidMessage', { amount: formatCurrency(data.amount) }) : errorMessage(data);
      await openUserDetail(userId);
      showResult(document.getElementById('modalResult'), ok, message);
      await loadDebts();
    });
  });

  document.getElementById('userDetailOverlay').classList.add('open');
}

document.getElementById('userDetailClose').addEventListener('click', () => {
  document.getElementById('userDetailOverlay').classList.remove('open');
});

// ---------- Deudas ----------
async function loadDebts() {
  const { data: debts } = await fetchJson('/api/v1/debts');
  allDebts = debts || [];
  const userName = (id) => allUsers.find((u) => u.id === id)?.name ?? id;

  document.getElementById('debtsTableBody').innerHTML = debts
    .slice()
    .reverse()
    .map((d) => `<tr>
      <td>${userName(d.userId)}</td>
      <td>${formatCurrency(d.amount)}</td>
      <td>${formatDate(d.createdAt)}</td>
      <td>${d.paid ? `<span class="badge badge-paid">${t('debts.paid')}</span>` : `<span class="badge badge-unpaid">${t('debts.unpaid')}</span>`}</td>
      <td>${d.paid ? '' : `<button class="success" data-pay-debt-global="${d.id}">${t('debts.markPaid')}</button>`}</td>
    </tr>`)
    .join('');

  document.querySelectorAll('[data-pay-debt-global]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { ok, data } = await fetchJson(`/api/v1/debts/${btn.dataset.payDebtGlobal}/pay`, { method: 'POST' });
      const message = ok
        ? t('debts.paidMessageFor', { amount: formatCurrency(data.amount), user: userName(data.userId) })
        : errorMessage(data);
      await loadDebts();
      showResult(document.getElementById('debtResult'), ok, message);
    });
  });
}

// ---------- Configuración (solo administrador) ----------
function renderSettingsForm() {
  if (!currentSettings) return;
  document.getElementById('settingsHourlyRate').value = currentSettings.hourlyLateFeeRate;
  document.getElementById('settingsMultiplier').value = currentSettings.debtMultiplier;
  document.getElementById('settingsMaxLoans').value = currentSettings.maxActiveLoans;
  document.getElementById('settingsLoanPeriod').value = currentSettings.loanPeriodDays;
}

document.getElementById('settingsSubmit').addEventListener('click', async () => {
  const body = {
    hourlyLateFeeRate: Number(document.getElementById('settingsHourlyRate').value),
    debtMultiplier: Number(document.getElementById('settingsMultiplier').value),
    maxActiveLoans: Number(document.getElementById('settingsMaxLoans').value),
    loanPeriodDays: Number(document.getElementById('settingsLoanPeriod').value),
  };
  const { ok, data } = await fetchJson('/api/v1/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (ok) currentSettings = data;
  showResult(document.getElementById('settingsResult'), ok, ok ? t('settings.saved') : errorMessage(data));
});

// ---------- Resúmenes del panel ----------
const isOverdue = (l) => l.status === 'ACTIVE' && new Date(l.dueDate).getTime() < Date.now();

function renderStaffSummary() {
  const set = (id, v) => setStat(id, v);
  const loans = allLoans || [];
  set('kpiBooks', allBooks.length);
  set('kpiActive', loans.filter((l) => l.status === 'ACTIVE').length);
  const overdueCount = loans.filter(isOverdue).length;
  setStat('kpiOverdue', overdueCount, overdueCount > 0);
  set('kpiMembers', allUsers.filter((u) => u.status === 'ACTIVE').length);
  const unpaid = allDebts.filter((d) => !d.paid).reduce((n, d) => n + d.amount, 0);
  setStat('kpiDebt', formatCurrency(unpaid), unpaid > 0);
  const userName = (id) => allUsers.find((u) => u.id === id)?.name ?? id;
  const overdue = loans.filter(isOverdue);
  document.getElementById('overdueTableBody').innerHTML = overdue
    .map((l) => `<tr><td>${escapeHtml(userName(l.userId))}</td><td>${escapeHtml(l.bookTitle ?? t('loans.unknownBook'))}</td><td>${formatDate(l.dueDate)}</td><td>${loanBadge(l)}</td></tr>`)
    .join('') || `<tr><td colspan="4" class="empty-note">${t('panel.noOverdue')}</td></tr>`;
}

async function loadMemberSummary() {
  const { ok, data } = await fetchJson('/api/v1/me');
  if (!ok || !data) return;
  const { user, loans, debts } = data;
  document.getElementById('memberGreeting').textContent = t('me.greeting', { name: user?.name || localStorage.getItem('authEmail') });
  document.getElementById('memberNoRecord').hidden = !!user;
  document.getElementById('meActive').textContent = loans.filter((l) => l.status === 'ACTIVE').length;
  const overdueCount = loans.filter(isOverdue).length;
  const unpaid = debts.filter((d) => !d.paid).reduce((n, d) => n + d.amount, 0);
  setStat('meOverdue', overdueCount, overdueCount > 0);
  setStat('meDebt', formatCurrency(unpaid), unpaid > 0);
  document.getElementById('meLoans').innerHTML = loans.slice().reverse()
    .map((l) => `<tr><td>${escapeHtml(l.bookTitle ?? t('loans.unknownBook'))}</td><td>${formatDate(l.dueDate)}</td><td>${loanBadge(l)}</td></tr>`)
    .join('') || `<tr><td colspan="3" class="empty-note">${t('users.noLoans')}</td></tr>`;
  document.getElementById('meDebts').innerHTML = debts.slice().reverse()
    .map((d) => `<tr><td>${formatCurrency(d.amount)}</td><td>${formatDate(d.createdAt)}</td><td>${d.paid ? `<span class="badge badge-paid">${t('debts.paid')}</span>` : `<span class="badge badge-unpaid">${t('debts.unpaid')}</span>`}</td></tr>`)
    .join('') || `<tr><td colspan="3" class="empty-note">${t('users.noDebts')}</td></tr>`;
}

// ---------- Sesión (JWT en localStorage) ----------
const ROLE_LABEL_KEY = { USUARIO: 'auth.roleUser', BIBLIOTECARIO: 'auth.roleLibrarian', ADMINISTRADOR: 'auth.roleAdmin' };
const currentRole = () => (localStorage.getItem('authToken') ? localStorage.getItem('authRole') : null);

/** Pinta la barra superior y el menú lateral según la sesión; carga los datos del rol. */
function renderSession() {
  const role = currentRole();
  const email = localStorage.getItem('authEmail') || '';
  const roleLabel = t(ROLE_LABEL_KEY[role] || 'auth.roleUser');
  document.getElementById('signInLink').hidden = !!role;
  document.getElementById('ctaBand').hidden = !!role;
  document.getElementById('accountChip').hidden = !role;
  document.getElementById('topnavPanel').hidden = !role;
  if (role) {
    document.getElementById('accountAvatar').textContent = email.charAt(0);
    document.getElementById('accountEmail').textContent = email;
    document.getElementById('accountRole').textContent = roleLabel;
    document.getElementById('sidebarRole').textContent = t('panel.roleArea', { role: roleLabel });
    document.getElementById('staffEyebrow').textContent = roleLabel;
  }
  document.querySelectorAll('[data-section-link]').forEach((a) => {
    a.hidden = !Router.canSee(a.dataset.roles, role);
  });
  const isStaff = Router.STAFF.includes(role);
  document.getElementById('staffSummary').hidden = !isStaff;
  document.getElementById('memberSummary').hidden = !role || isStaff;
  if (isStaff) loadAll();
  else if (role) loadMemberSummary();
  route();
}

function clearSession() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authEmail');
  localStorage.removeItem('authRole');
  location.hash = '#/';
  renderSession();
}

/** `method`: 'password' | 'google' — se recuerda para sugerirlo la próxima vez. */
function saveSession(data, method = 'password') {
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('authEmail', data.account.email);
  localStorage.setItem('authRole', data.account.role);
  window.GoogleSignIn?.saveLastLogin?.(localStorage, method, data.account.email);
  location.hash = '#/panel/resumen';
  renderSession();
}

// ---------- Router (vistas por hash, ver router.js) ----------
function route() {
  const { view, section } = Router.resolve(location.hash, currentRole());
  document.querySelectorAll('[data-view]').forEach((el) => { el.hidden = el.dataset.view !== view; });
  document.querySelectorAll('[data-route-link]').forEach((a) => a.classList.toggle('active', a.dataset.routeLink === view));
  document.querySelectorAll('.panel-section').forEach((el) => el.classList.toggle('active', el.id === 'section-' + section));
  document.querySelectorAll('[data-section-link]').forEach((a) => {
    const active = a.dataset.sectionLink === section;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (view === 'login') renderLoginView();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ---------- Inicio de sesión / registro ----------
function setAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('authTabLogin').setAttribute('aria-selected', String(isLogin));
  document.getElementById('authTabRegister').setAttribute('aria-selected', String(!isLogin));
  document.getElementById('loginForm').hidden = !isLogin;
  document.getElementById('registerForm').hidden = isLogin;
  document.getElementById('authResult').style.display = 'none';
}
document.getElementById('authTabLogin').addEventListener('click', () => setAuthTab('login'));
document.getElementById('authTabRegister').addEventListener('click', () => setAuthTab('register'));

// Proveedores extra (Google + "último usado"): googleSignIn.js, opcional.
let providersMounted = false;
function renderLoginView() {
  const gsi = window.GoogleSignIn;
  if (!gsi) return;
  const last = gsi.getLastLogin?.(localStorage);
  const submit = document.getElementById('loginSubmit');
  submit.querySelector('.last-used-badge')?.remove();
  if (last?.method === 'password') {
    submit.append(gsi.lastUsedBadge(t('auth.lastUsed')));
    if (last.email && !document.getElementById('loginEmail').value) document.getElementById('loginEmail').value = last.email;
  }
  if (providersMounted) return;
  providersMounted = true;
  gsi.mount(document.getElementById('authProviders'), async (credential) => {
    const { ok, data } = await fetchJson('/api/v1/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (ok) saveSession(data, 'google');
    else showResult(document.getElementById('authResult'), false, errorMessage(data));
  }, { apiBase: API_BASE_URL, locale: getLocale(), lastUsedLabel: t('auth.lastUsed') });
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  // Solo se valida el formato del email: la contraseña no se valida por
  // patrón aquí para no bloquear el login de cuentas ya existentes.
  if (!validateField(email, isValidEmail, 'validation.emailInvalid', document.getElementById('authResult'))) return;
  const { ok, data } = await fetchJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (ok) saveSession(data, 'password');
  else showResult(document.getElementById('authResult'), false, errorMessage(data));
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;
  const authResultEl = document.getElementById('authResult');
  if (!validateField(email, isValidEmail, 'validation.emailInvalid', authResultEl)) return;
  if (!validateField(password, isValidPassword, 'validation.passwordWeak', authResultEl)) return;
  const { ok, data } = await fetchJson('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  if (ok) saveSession(data, 'password');
  else showResult(authResultEl, false, errorMessage(data));
});

document.getElementById('logoutBtn').addEventListener('click', clearSession);

// ---------- Selector de idioma ----------
const langSelect = document.getElementById('langSelect');
langSelect.addEventListener('change', async () => {
  await setLocale(langSelect.value);
  renderSession(); // vuelve a traducir textos generados dinámicamente (sesión, gate, tablas ya cargadas se refrescan con loadAll)
});

document.addEventListener('i18n:changed', () => {
  document.title = t('meta.title');
  langSelect.value = getLocale();
  filterCatalog(document.getElementById('catalogSearch').value); // re-traduce insignias y contador
  renderRegionOptions();
});

(async () => {
  await window.I18n.initI18n();
  renderSession();
  loadCatalog(); // público: se carga con o sin sesión
  connectLive();
})();
