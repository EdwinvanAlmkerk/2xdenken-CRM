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
