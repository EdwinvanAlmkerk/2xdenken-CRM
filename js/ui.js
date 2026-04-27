// ════════════════════════════════════════════════════════════════
// UI HELPERS — Loading, Toast, Modal, Export
// ════════════════════════════════════════════════════════════════

function showLoading() {
  if (document.getElementById('loading-overlay')) return;
  const el = document.createElement('div');
  el.id = 'loading-overlay';
  el.className = 'loading-overlay';
  el.innerHTML = '<div class="spinner"></div>';
  document.body.appendChild(el);
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.remove();
}

function showToast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showModal(title, bodyHTML, footerHTML, lg = false) {
  closeModal();
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.id = 'modal-overlay';
  el.onclick = e => { if (e.target === el) closeModal(); };
  el.innerHTML = `
    <div class="modal${lg ? ' modal-lg' : ''}">
      <div class="modal-header">
        <h2>${esc(title)}</h2>
        <button class="btn btn-ghost btn-icon" onclick="closeModal()">${svgIcon('close', 18)}</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    </div>`;
  document.body.appendChild(el);
}

function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
}

// ── Debounce helper ─────────────────────────────────────────────
// Vertraagt de uitvoering van fn tot er ms geen nieuwe calls zijn geweest.
// Gebruikt voor search-inputs zodat we niet per toetsaanslag de hele lijst
// hertekenen.
function debounce(fn, ms = 140) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ── Focus-behoudende render helper ──────────────────────────────
function smartRender(renderFn) {
  const active = document.activeElement;
  const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  const selStart = isInput ? active.selectionStart : null;
  const selEnd   = isInput ? active.selectionEnd   : null;
  const inputId  = isInput ? active.id   : null;
  const inputVal = isInput ? active.value : null;

  document.getElementById('content').innerHTML = renderFn();

  if (isInput && inputId) {
    const el = document.getElementById(inputId);
    if (el) {
      el.focus();
      try { el.setSelectionRange(selStart, selEnd); } catch (e) {}
    }
  } else if (isInput) {
    const inputs = document.getElementById('content').querySelectorAll('input[type=text], input[type=search]');
    for (const el of inputs) {
      if (el.value === inputVal) {
        el.focus();
        try { el.setSelectionRange(selStart, selEnd); } catch (e) {}
        break;
      }
    }
  }
}

// ── Paginatie helper ────────────────────────────────────────────
// Geeft een slice + HTML-controls terug voor een grote tabel. De
// page-state wordt door de aanroepende pagina bijgehouden. Bij
// filter/sort-wijziging moet de caller zelf de page terug naar 1
// zetten.
const PAGE_SIZE = 100;

function paginate(items, page, perPage = PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page || 1), totalPages);
  const start = (current - 1) * perPage;
  return {
    slice: items.slice(start, start + perPage),
    total,
    totalPages,
    page: current,
    perPage,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + perPage, total),
  };
}

function renderPagination(info, gotoFnName) {
  if (info.totalPages <= 1) return '';
  const btn = (p, label, disabled = false, isActive = false) =>
    `<button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}" ${disabled ? 'disabled style="opacity:.4;cursor:default"' : `onclick="${gotoFnName}(${p})"`}>${label}</button>`;

  // Compacte paginatie: eerste, huidige ±2, laatste
  const pages = [];
  const p = info.page, tp = info.totalPages;
  const add = n => { if (!pages.includes(n) && n >= 1 && n <= tp) pages.push(n); };
  add(1); add(tp);
  for (let i = p - 2; i <= p + 2; i++) add(i);
  pages.sort((a, b) => a - b);

  const buttons = [];
  let prev = 0;
  for (const n of pages) {
    if (prev && n - prev > 1) buttons.push('<span style="padding:0 4px;color:var(--navy4)">…</span>');
    buttons.push(btn(n, String(n), false, n === p));
    prev = n;
  }

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:10px">
      <span style="font-size:12px;color:var(--navy4)">${info.from}–${info.to} van ${info.total}</span>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
        ${btn(p - 1, '‹', p <= 1)}
        ${buttons.join('')}
        ${btn(p + 1, '›', p >= tp)}
      </div>
    </div>`;
}

// ── Backup export (JSON) ─────────────────────────────────────────
function exportBackup() {
  const data = JSON.stringify(DB, null, 2);
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `2xdenken-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackup() {
  alert('Import is uitgeschakeld in de Supabase versie. Data staat al in de cloud.');
}
