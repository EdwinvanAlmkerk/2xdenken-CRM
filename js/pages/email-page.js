// ════════════════════════════════════════════════════════════════
// E-MAIL PAGINA — Outlook-achtige layout
// ════════════════════════════════════════════════════════════════
let _emailFolder = 'inbox';
let _emailSearch = '';
let _emailSelected = null;
let _emailFilter = 'alles'; // 'alles', 'ongelezen'
let _inboxMessages = [];
let _inboxLoading = false;
let _inboxError = '';
let _inboxFetchedOnce = false;
let _trashMessages = [];
let _trashLoading = false;
let _trashError = '';
let _trashFetchedOnce = false;
let _foldersCollapsed = {};

// ── LocalStorage cache helpers (stale-while-revalidate) ──────────
const INBOX_CACHE_KEY = '_crm_inbox_cache_v1';
const TRASH_CACHE_KEY = '_crm_trash_cache_v1';
function _loadMailCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}
function _saveMailCache(key, messages) {
  try { localStorage.setItem(key, JSON.stringify(messages)); } catch { /* quota of privacy mode */ }
}

function setEmailFolder(f) { _emailFolder = f; _emailSelected = null; _emailFilter = 'alles'; renderContent(); }
function setEmailFilter(f) { _emailFilter = f; renderContent(); }
const _renderEmailDeb = debounce(() => smartRender(() => renderEmailPage()), 140);
function searchEmail(v) { _emailSearch = v; _renderEmailDeb(); }
function toggleFolderGroup(g) { _foldersCollapsed[g] = !_foldersCollapsed[g]; renderContent(); }

async function selectInboxEmail(uid) {
  _emailSelected = uid;
  renderContent();

  // Kies juiste array + IMAP-map op basis van huidige folder
  const isTrash = _emailFolder === 'verwijderd';
  const sourceArr = isTrash ? _trashMessages : _inboxMessages;
  const imapFolder = isTrash ? '__trash__' : 'INBOX';

  const msg = sourceArr.find(m => (m.uid || m.seq) == uid);

  // Markeer als gelezen (zonder op response te wachten, optimistic update)
  if (msg && !msg.read) {
    msg.read = true;
    if (imapFolder === 'INBOX') _saveMailCache(INBOX_CACHE_KEY, _inboxMessages);
    else _saveMailCache(TRASH_CACHE_KEY, _trashMessages);
    renderContent();
    // Server-side synchroniseren (fire-and-forget, maar met rollback bij fout)
    markMailSeen(uid, true, imapFolder).catch(() => {
      msg.read = false;
      renderContent();
    });
  }

  // Check of we de body al hebben
  if (msg && msg._bodyLoaded) return;

  // Body ophalen via Edge Function
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/fetch-emails?folder=${encodeURIComponent(imapFolder)}&uid=${uid}`, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`,
      },
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

    // Update het bericht in de array
    if (msg) {
      msg.body = data.body || '';
      msg._bodyLoaded = true;
    }
    renderContent();
  } catch (e) {
    console.error('Body ophalen mislukt:', e);
    if (msg) {
      msg.body = `[Kon berichtinhoud niet laden: ${e.message}]`;
      msg._bodyLoaded = true;
    }
    renderContent();
  }
}

// Markeer bericht als gelezen/ongelezen op de IMAP-server (via edge function)
async function markMailSeen(uid, seen, imapFolder = 'INBOX') {
  const res = await fetch(`${SUPA_URL}/functions/v1/fetch-emails?action=mark&folder=${encodeURIComponent(imapFolder)}&uid=${uid}&seen=${seen ? 'true' : 'false'}`, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
}

// Verwijder een IMAP bericht: vanuit inbox → naar Trash, vanuit Trash → permanent
async function deleteMail(uid) {
  const isTrash = _emailFolder === 'verwijderd';
  const confirmMsg = isTrash
    ? 'Dit bericht wordt permanent verwijderd. Doorgaan?'
    : 'Dit bericht verplaatsen naar Verwijderde items?';
  if (!confirm(confirmMsg)) return;

  const sourceArr = isTrash ? _trashMessages : _inboxMessages;
  const imapFolder = isTrash ? '__trash__' : 'INBOX';
  const idx = sourceArr.findIndex(m => (m.uid || m.seq) == uid);
  if (idx === -1) return;

  // Optimistisch: verwijder lokaal, sluit detailvenster
  const removed = sourceArr.splice(idx, 1)[0];
  _emailSelected = null;
  _saveMailCache(isTrash ? TRASH_CACHE_KEY : INBOX_CACHE_KEY, sourceArr);
  renderContent();

  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/fetch-emails?action=delete&folder=${encodeURIComponent(imapFolder)}&uid=${uid}`, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    // Als we uit de inbox verwijderden, is de trash-cache nu verouderd — forceer refresh bij volgende opening
    if (!isTrash) {
      _trashFetchedOnce = false;
    }
  } catch (e) {
    // Rollback
    sourceArr.splice(idx, 0, removed);
    _saveMailCache(isTrash ? TRASH_CACHE_KEY : INBOX_CACHE_KEY, sourceArr);
    alert('Verwijderen mislukt: ' + e.message);
    renderContent();
  }
}

// Toggle-functie voor de "Markeer als ongelezen/gelezen" knop in de detailweergave
async function toggleMailRead(uid) {
  const isTrash = _emailFolder === 'verwijderd';
  const sourceArr = isTrash ? _trashMessages : _inboxMessages;
  const imapFolder = isTrash ? '__trash__' : 'INBOX';
  const msg = sourceArr.find(m => (m.uid || m.seq) == uid);
  if (!msg) return;
  const newState = !msg.read;
  msg.read = newState;
  _saveMailCache(isTrash ? TRASH_CACHE_KEY : INBOX_CACHE_KEY, sourceArr);
  renderContent();
  try {
    await markMailSeen(uid, newState, imapFolder);
  } catch (e) {
    msg.read = !newState; // rollback
    alert('Kon leesstatus niet wijzigen: ' + e.message);
    renderContent();
  }
}

async function fetchTrash() {
  if (!DB.emailSettings?.imapHost) {
    _trashError = 'Configureer eerst je e-mailserver in Instellingen';
    _trashFetchedOnce = true;
    renderContent();
    return;
  }
  _trashLoading = true; _trashError = '';
  if (_trashMessages.length === 0) renderContent();
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/fetch-emails?folder=__trash__&limit=20`, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`,
      },
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    _trashMessages = data.messages || [];
    _trashError = '';
    _saveMailCache(TRASH_CACHE_KEY, _trashMessages);
  } catch (e) {
    _trashError = e.message;
    if (_trashMessages.length === 0) _trashMessages = [];
  }
  _trashLoading = false;
  _trashFetchedOnce = true;
  renderContent();
}

async function fetchInbox() {
  if (!DB.emailSettings?.imapHost) {
    _inboxError = 'Configureer eerst je e-mailserver in Instellingen';
    _inboxFetchedOnce = true;
    renderContent();
    return;
  }
  _inboxLoading = true; _inboxError = '';
  // Alleen direct re-renderen als we nog niets te tonen hebben — anders laten we de cached content staan
  if (_inboxMessages.length === 0) renderContent();
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/fetch-emails?folder=INBOX&limit=20`, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`,
      },
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    _inboxMessages = data.messages || [];
    _inboxError = '';
    _saveMailCache(INBOX_CACHE_KEY, _inboxMessages);
  } catch (e) {
    _inboxError = e.message;
    // Als we cached content hebben, laten we die staan — alleen leegmaken als er echt niets is
    if (_inboxMessages.length === 0) _inboxMessages = [];
  }
  _inboxLoading = false;
  _inboxFetchedOnce = true;
  renderContent();
}

function renderEmailPage() {
  const hasConfig = DB.emailSettings?.imapHost && DB.emailSettings?.emailUser && DB.emailSettings?.emailPass;

  // Inbox: eerste keer openen in deze sessie — cache laden + achtergrond fetch
  if (hasConfig && _emailFolder === 'inbox' && !_inboxFetchedOnce && !_inboxLoading) {
    if (_inboxMessages.length === 0) {
      const cached = _loadMailCache(INBOX_CACHE_KEY);
      if (cached) _inboxMessages = cached;
    }
    fetchInbox(); // achtergrond — laat cached content zichtbaar
  }
  // Prullenbak: idem
  if (hasConfig && _emailFolder === 'verwijderd' && !_trashFetchedOnce && !_trashLoading) {
    if (_trashMessages.length === 0) {
      const cached = _loadMailCache(TRASH_CACHE_KEY);
      if (cached) _trashMessages = cached;
    }
    fetchTrash();
  }
  const emailAddr = DB.emailSettings?.emailUser || 'E-mail';
  const conceptCount = DB.emailLog.filter(e => e.status === 'concept').length;
  const verzondenCount = DB.emailLog.filter(e => e.status === 'verzonden').length;

  // Items voor huidige map
  let items;
  if (_emailFolder === 'inbox') {
    items = _inboxMessages.map(m => ({
      id: m.uid || m.seq,
      aanEmail: m.from?.email || '',
      aanNaam: m.from?.name || m.from?.email || '',
      onderwerp: m.subject || '(geen onderwerp)',
      body: m.body || '', datum: m.date || '', status: 'inbox', _isInbox: true,
      read: m.read || false, _bodyLoaded: m._bodyLoaded || false,
    }));
    // Filter ongelezen als dat actief is
    if (_emailFilter === 'ongelezen') items = items.filter(e => !e.read);
  } else if (_emailFolder === 'verwijderd') {
    items = _trashMessages.map(m => ({
      id: m.uid || m.seq,
      aanEmail: m.from?.email || '',
      aanNaam: m.from?.name || m.from?.email || '',
      onderwerp: m.subject || '(geen onderwerp)',
      body: m.body || '', datum: m.date || '', status: 'verwijderd', _isInbox: true,
      read: true, _bodyLoaded: m._bodyLoaded || false,
    }));
  } else {
    items = DB.emailLog.filter(e => {
      if (_emailFolder === 'verzonden') return e.status === 'verzonden';
      if (_emailFolder === 'concepten') return e.status === 'concept';
      return true;
    });
  }

  // Zoekfilter
  if (_emailSearch) {
    const q = _emailSearch.toLowerCase();
    items = items.filter(e =>
      (e.onderwerp || '').toLowerCase().includes(q) ||
      (e.aanNaam || '').toLowerCase().includes(q) ||
      (e.aanEmail || '').toLowerCase().includes(q) ||
      (e.body || '').toLowerCase().includes(q)
    );
  }

  items.sort((a, b) => new Date(b.datum) - new Date(a.datum));

  // Geselecteerd item (loose equality omdat IMAP-id's numbers zijn)
  let selected = null;
  if (_emailFolder === 'inbox' || _emailFolder === 'verwijderd') {
    selected = _emailSelected ? items.find(e => String(e.id) === String(_emailSelected)) : null;
  } else {
    selected = _emailSelected ? DB.emailLog.find(e => e.id === _emailSelected) : null;
  }

  return `
    <div style="display:flex;gap:0;height:calc(100vh - 150px);border-radius:var(--r2);overflow:hidden;border:1px solid var(--glass-border)">

      <!-- Linker paneel: mappenstructuur -->
      <div style="width:220px;min-width:220px;display:flex;flex-direction:column;background:rgba(30,45,74,0.035);border-right:1px solid rgba(30,45,74,0.18);overflow-y:auto">
        <div style="padding:12px;display:flex;flex-direction:column;gap:6px">
          <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="openEmailModal({})">
            ${svgIcon('mail', 15)} Nieuwe e-mail
          </button>
          <button class="btn btn-secondary btn-sm" style="width:100%;justify-content:center" onclick="openEmailOptionsModal()">
            ${svgIcon('settings', 13)} Opties
          </button>
        </div>

        <!-- Mappenstructuur -->
        <div style="flex:1;font-size:13px">
          ${hasConfig ? `
          <!-- Account mappen -->
          <div onclick="toggleFolderGroup('account')" style="display:flex;align-items:center;gap:6px;padding:6px 12px;cursor:pointer;font-weight:600;color:var(--navy);font-size:12px">
            <span style="font-size:10px;transition:transform .15s;transform:rotate(${_foldersCollapsed['account'] ? '0' : '90'}deg)">&#9654;</span>
            ${esc(emailAddr)}
          </div>
          ${!_foldersCollapsed['account'] ? `
            ${renderFolder('inbox', 'Postvak IN', 'mail', _inboxMessages.filter(m => !m.read).length)}
            ${renderFolder('verzonden', 'Verzonden items', 'chevron', verzondenCount)}
            ${renderFolder('concepten', 'Concepten', 'edit', conceptCount)}
            ${renderFolder('verwijderd', 'Verwijderde items', 'trash', 0)}
          ` : ''}
          ` : `
          <!-- Zonder IMAP: alleen CRM-mappen -->
          <div style="padding:6px 12px;font-weight:600;color:var(--navy);font-size:12px">CRM E-mail</div>
          ${renderFolder('verzonden', 'Verzonden items', 'chevron', verzondenCount)}
          ${renderFolder('concepten', 'Concepten', 'edit', conceptCount)}
          `}
        </div>

        <!-- Serverinfo onderaan -->
        ${hasConfig ? `
        <div style="padding:10px 12px;border-top:1px solid var(--glass-border);font-size:11px;color:var(--navy4)">
          ${svgIcon('lightning', 11)} ${esc(DB.emailSettings.imapHost)}
        </div>` : `
        <div style="padding:10px 12px;border-top:1px solid var(--glass-border);font-size:11px;color:var(--geel)">
          ${svgIcon('settings', 11)} <a onclick="navigate('instellingen')" style="color:var(--accent);cursor:pointer">Server instellen</a>
        </div>`}
      </div>

      <!-- Midden paneel: berichtenlijst -->
      <div style="flex:1;display:flex;flex-direction:column;background:var(--card-bg);${selected ? 'max-width:50%;' : ''}border-right:${selected ? '1px solid var(--glass-border)' : 'none'}">
        <!-- Toolbar -->
        <div style="padding:10px 16px;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;gap:10px">
          <div style="display:flex;gap:2px">
            <button class="btn btn-sm ${_emailFilter === 'alles' ? 'btn-primary' : 'btn-secondary'}" onclick="setEmailFilter('alles')">Alles</button>
            <button class="btn btn-sm ${_emailFilter === 'ongelezen' ? 'btn-primary' : 'btn-secondary'}" onclick="setEmailFilter('ongelezen')">Ongelezen</button>
          </div>
          <div class="search-wrap" style="flex:1">
            <span class="search-icon">${svgIcon('search', 13)}</span>
            <input type="text" placeholder="Zoeken..." value="${esc(_emailSearch)}" oninput="searchEmail(this.value)" style="padding-left:32px;font-size:12.5px;padding-top:6px;padding-bottom:6px"/>
          </div>
          ${_emailFolder === 'inbox' ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="fetchInbox()" title="Vernieuwen">${_inboxLoading ? '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div>' : svgIcon('settings', 15)}</button>` : ''}
          ${_emailFolder === 'verwijderd' ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="fetchTrash()" title="Vernieuwen">${_trashLoading ? '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div>' : svgIcon('settings', 15)}</button>` : ''}
        </div>

        <!-- Kolom-headers -->
        <div style="display:grid;grid-template-columns:1fr 1.5fr 140px;padding:8px 16px;border-bottom:1px solid rgba(30,45,74,0.14);background:rgba(30,45,74,0.045);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--navy3)">
          <span>${(_emailFolder === 'inbox' || _emailFolder === 'verwijderd') ? 'Van' : 'Aan'}</span>
          <span>Onderwerp</span>
          <span style="text-align:right">Ontvangen</span>
        </div>

        <!-- Berichtenlijst -->
        <div style="flex:1;overflow-y:auto">
          ${_emailFolder === 'inbox' && _inboxLoading && items.length === 0
            ? `<div style="text-align:center;padding:40px 20px;color:var(--navy4)">
                <div class="spinner" style="margin:0 auto 12px;width:28px;height:28px;border-width:2px"></div>
                <p style="font-size:13px">Inbox laden...</p>
              </div>`
            : _emailFolder === 'inbox' && _inboxError && items.length === 0
            ? `<div style="text-align:center;padding:40px 20px;color:var(--s-rood)">
                <p style="font-size:13px">${esc(_inboxError)}</p>
                <button class="btn btn-secondary btn-sm" style="margin-top:12px" onclick="fetchInbox()">Opnieuw</button>
              </div>`
            : _emailFolder === 'verwijderd' && _trashLoading && items.length === 0
            ? `<div style="text-align:center;padding:40px 20px;color:var(--navy4)">
                <div class="spinner" style="margin:0 auto 12px;width:28px;height:28px;border-width:2px"></div>
                <p style="font-size:13px">Prullenbak laden...</p>
              </div>`
            : _emailFolder === 'verwijderd' && _trashError && items.length === 0
            ? `<div style="text-align:center;padding:40px 20px;color:var(--s-rood)">
                <p style="font-size:13px">${esc(_trashError)}</p>
                <button class="btn btn-secondary btn-sm" style="margin-top:12px" onclick="fetchTrash()">Opnieuw</button>
              </div>`
            : items.length === 0
            ? `<div style="text-align:center;padding:40px 20px;color:var(--navy4)">
                ${svgIcon('mail', 28)}
                <p style="font-size:13px;margin-top:8px">Geen berichten</p>
              </div>`
            : items.map(e => {
                const isActive = selected && String(e.id) === String(selected.id);
                const matchedContact = getContactByEmail(e.aanEmail);
                const matchedSchool = getSchool(e.schoolId) || (matchedContact ? getSchool(matchedContact.schoolId) : null);
                const naam = e.aanNaam || e.aanEmail || '—';
                const isUnread = e._isInbox && !e.read;
                return `
                  <div class="email-row${isActive ? ' is-active' : ''}${isUnread ? ' is-unread' : ''}" onclick="${e._isInbox ? `selectInboxEmail('${e.id}')` : `_emailSelected='${e.id}';renderContent()`}" style="display:grid;grid-template-columns:1fr 1.5fr 140px;padding:11px 16px;border-bottom:1px solid rgba(30,45,74,0.1);cursor:pointer;background:${isActive ? 'var(--mint)' : 'transparent'};border-left:3px solid ${isActive ? 'var(--accent)' : isUnread ? 'var(--accent2)' : 'transparent'};transition:background .12s;align-items:center">
                    <div style="overflow:hidden">
                      <div style="font-size:13px;font-weight:${isUnread ? '800' : '600'};color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${isUnread ? '● ' : ''}${esc(naam)}</div>
                      ${matchedSchool ? `<div style="font-size:11px;color:var(--navy4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(matchedSchool.naam)}</div>` : matchedContact ? `<div style="font-size:11px;color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(matchedContact.naam)}</div>` : ''}
                    </div>
                    <div style="overflow:hidden">
                      <div style="font-size:13px;font-weight:${isUnread ? '700' : '400'};color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.onderwerp || '(geen onderwerp)')}</div>
                      <div style="font-size:11.5px;color:var(--navy4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((e.body || '').slice(0, 100))}</div>
                    </div>
                    <div style="text-align:right;font-size:12px;color:var(--navy4);white-space:nowrap">
                      ${fmtDateShort(e.datum)}
                    </div>
                  </div>`;
              }).join('')}
        </div>
      </div>

      <!-- Rechter paneel: leesvenster -->
      ${selected ? `
      <div style="flex:1;display:flex;flex-direction:column;background:var(--glass);overflow:hidden;min-width:300px">
        ${renderEmailDetail(selected)}
      </div>` : ''}

    </div>`;
}

// ── Folder item renderen ─────────────────────────────────────────
function renderFolder(id, label, icon, count) {
  const isActive = _emailFolder === id;
  return `<div onclick="setEmailFolder('${id}')" style="display:flex;align-items:center;gap:8px;padding:7px 12px 7px 24px;cursor:pointer;font-size:13px;font-weight:${isActive ? '700' : '400'};color:${isActive ? 'var(--accent)' : 'var(--navy3)'};background:${isActive ? 'var(--mint)' : 'transparent'};border-left:2px solid ${isActive ? 'var(--accent)' : 'transparent'};transition:all .12s">
    ${svgIcon(icon, 14)}
    <span style="flex:1">${label}</span>
    ${count > 0 ? `<span style="font-size:11px;font-weight:700;color:${isActive ? 'var(--accent)' : 'var(--navy4)'}">${count}</span>` : ''}
  </div>`;
}

// ── E-mail detail ────────────────────────────────────────────────
function renderEmailDetail(e) {
  const isInbox = e._isInbox;
  const contact = getContact(e.contactId);
  const school = getSchool(e.schoolId);
  const factuur = getFactuur(e.factuurId);
  const matchedContact = contact || getContactByEmail(e.aanEmail);
  const matchedSchool = school || (matchedContact ? getSchool(matchedContact.schoolId) : null);
  const displayLabel = isInbox ? 'Van' : 'Aan';

  return `
    <div style="padding:18px 22px;border-bottom:1px solid var(--glass-border);background:rgba(255,255,255,0.3)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <h3 style="font-size:17px;font-weight:700;color:var(--navy);flex:1;margin-right:12px">${esc(e.onderwerp || '(geen onderwerp)')}</h3>
        <div style="display:flex;gap:4px;flex-shrink:0">
          ${isInbox
            ? `<button class="btn btn-primary btn-sm" onclick="openEmailModal({contactId:'${matchedContact?.id || ''}',schoolId:'${matchedSchool?.id || ''}',_prefillOnderwerp:'Re: ${esc(e.onderwerp)}'})">${svgIcon('mail', 12)} Beantwoorden</button>`
            : e.status === 'concept'
              ? `<button class="btn btn-primary btn-sm" onclick="openEmailFromDraft('${e.id}')">${svgIcon('edit', 12)} Bewerken</button>`
              : `<button class="btn btn-secondary btn-sm" onclick="forwardEmail('${e.id}')">${svgIcon('chevron', 12)} Doorsturen</button>`}
          ${isInbox && _emailFolder === 'inbox' ? `<button class="btn btn-secondary btn-sm" onclick="toggleMailRead('${e.id}')" title="${e.read ? 'Markeer als ongelezen' : 'Markeer als gelezen'}">${svgIcon('mail', 12)} ${e.read ? 'Markeer ongelezen' : 'Markeer gelezen'}</button>` : ''}
          ${isInbox ? `<button class="btn btn-ghost btn-icon btn-sm" title="${_emailFolder === 'verwijderd' ? 'Permanent verwijderen' : 'Verwijderen (naar prullenbak)'}" onclick="deleteMail('${e.id}')" style="color:var(--s-rood)">${svgIcon('trash', 13)}</button>` : ''}
          ${!isInbox ? `<button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delEmailLog('${e.id}')" style="color:var(--s-rood)">${svgIcon('trash', 13)}</button>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;font-size:13px">
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;flex-shrink:0">
          ${esc((e.aanNaam || e.aanEmail || '?')[0].toUpperCase())}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--navy)">${esc(displayLabel)}: ${esc(e.aanNaam || '')} <span style="color:var(--navy4);font-weight:400">&lt;${esc(e.aanEmail)}&gt;</span></div>
          <div style="font-size:11.5px;color:var(--navy4)">${fmtDate(e.datum)}${e.status === 'concept' ? ' · <span style="color:var(--geel);font-weight:600">Concept</span>' : ''}</div>
        </div>
      </div>
      ${(matchedSchool || factuur || (matchedContact && !contact)) ? `<div style="display:flex;gap:10px;margin-top:8px;font-size:11.5px;color:var(--navy4)">
        ${matchedContact && !contact ? `<span style="color:var(--accent)">${svgIcon('contact', 11)} ${esc(matchedContact.naam)}</span>` : ''}
        ${matchedSchool ? `<span>${svgIcon('school', 11)} ${esc(matchedSchool.naam)}</span>` : ''}
        ${factuur ? `<span>${svgIcon('invoice', 11)} ${esc(factuur.nummer)}</span>` : ''}
      </div>` : ''}
    </div>
    <div style="flex:1;overflow-y:auto;padding:20px 22px;font-size:14px;color:var(--navy3);line-height:1.7;white-space:pre-wrap">${isInbox && !e.body && !e._bodyLoaded ? `<div style="text-align:center;color:var(--navy4);padding:30px"><div class="spinner" style="margin:0 auto 12px;width:24px;height:24px;border-width:2px"></div><p>Bericht laden...</p></div>` : esc(e.body || '(leeg bericht)')}</div>`;
}
