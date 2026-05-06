// ════════════════════════════════════════════════════════════════
// DASHBOARD — Configureerbare widgets met drag-and-drop
// ════════════════════════════════════════════════════════════════
//
// Architectuur:
//   - DASHBOARD_WIDGETS    : registry met alle beschikbare widgets
//   - _dashboardConfig     : huidige zichtbare/verborgen volgorde [{id,visible}]
//   - _dashboardEditMode   : true = edit-modus actief (sleep-handles + checkboxes)
//   - _dashboardDragId     : id van de widget die op dit moment versleept wordt
//
// Configuratie wordt persistent opgeslagen in Supabase tabel
// `dashboard_settings` (single-row id='main') en als fallback in
// localStorage onder key `crm_pref_dashboard.widgets`. Als de tabel
// ontbreekt werkt alles via localStorage (gracefull degrade).

// ── Widget registry ─────────────────────────────────────────────
// Elke widget is een object met een unieke id, een label voor het
// edit-paneel, een full-width vlag (true = volledige breedte i.p.v.
// halve in grid-2) en een render()-functie die de inner HTML van
// de widget retourneert (zonder drag-handle wrapper).
const DASHBOARD_WIDGETS = [
  { id: 'kpis',            label: 'KPI-tegels',           fullWidth: true,  defaultVisible: true,  render: renderKpisWidget },
  { id: 'afspraken',       label: 'Afspraken vandaag',    fullWidth: false, defaultVisible: true,  render: renderAfsprakenWidget },
  { id: 'nieuws',          label: 'Laatste nieuws',       fullWidth: false, defaultVisible: true,  render: renderNieuwsWidget },
  { id: 'topopenstaand',   label: 'Top 10 openstaand',    fullWidth: false, defaultVisible: false, render: renderTopOpenstaandWidget },
  { id: 'trainingenmaand', label: 'Trainingen deze maand',fullWidth: false, defaultVisible: false, render: renderTrainingenMaandWidget },
  { id: 'vervallen',       label: 'Vervallen facturen',   fullWidth: false, defaultVisible: false, render: renderVervallenWidget },
];

let _dashboardConfig = null;        // [{id, visible}] — wordt lazy-init in _dashboardActiveConfig()
let _dashboardEditMode = false;
let _dashboardDragId = null;

// ── Config laden, mergen en opslaan ────────────────────────────
function _dashboardDefaultConfig() {
  return DASHBOARD_WIDGETS.map(w => ({ id: w.id, visible: w.defaultVisible }));
}

function _dashboardMergeConfig(loaded) {
  if (!Array.isArray(loaded) || !loaded.length) return _dashboardDefaultConfig();
  const known = new Set(DASHBOARD_WIDGETS.map(w => w.id));
  const seen = new Set();
  const merged = [];
  for (const entry of loaded) {
    if (!entry || !known.has(entry.id) || seen.has(entry.id)) continue;
    merged.push({ id: entry.id, visible: entry.visible !== false });
    seen.add(entry.id);
  }
  // Voeg nieuwe widgets toe die nog niet in de bewaarde config zaten.
  for (const w of DASHBOARD_WIDGETS) {
    if (!seen.has(w.id)) merged.push({ id: w.id, visible: w.defaultVisible });
  }
  return merged;
}

function _dashboardActiveConfig() {
  if (_dashboardConfig) return _dashboardConfig;
  // Eerst uit DB-state (van loadAllData), anders localStorage, anders default.
  let loaded = null;
  if (DB.dashboardSettings && Array.isArray(DB.dashboardSettings.widgets) && DB.dashboardSettings.widgets.length) {
    loaded = DB.dashboardSettings.widgets;
  } else {
    try {
      const raw = localStorage.getItem('crm_pref_dashboard.widgets');
      if (raw) loaded = JSON.parse(raw);
    } catch {}
  }
  _dashboardConfig = _dashboardMergeConfig(loaded);
  return _dashboardConfig;
}

function _persistDashboardConfig() {
  if (typeof saveDashboardConfig === 'function') saveDashboardConfig(_dashboardConfig);
}

// ── Edit-modus, drag-and-drop, toggles ─────────────────────────
function toggleDashboardEditMode() {
  _dashboardEditMode = !_dashboardEditMode;
  if (!_dashboardEditMode) _persistDashboardConfig();
  renderContent();
}

function toggleDashboardWidget(id) {
  const cfg = _dashboardActiveConfig();
  const entry = cfg.find(e => e.id === id);
  if (!entry) return;
  entry.visible = !entry.visible;
  renderContent();
}

function moveDashboardWidget(id, delta) {
  const cfg = _dashboardActiveConfig();
  const idx = cfg.findIndex(e => e.id === id);
  if (idx === -1) return;
  const target = idx + delta;
  if (target < 0 || target >= cfg.length) return;
  const [item] = cfg.splice(idx, 1);
  cfg.splice(target, 0, item);
  renderContent();
}

function dashboardDragStart(e, id) {
  _dashboardDragId = id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch {}
  }
}

function dashboardDragOver(e) {
  if (!_dashboardDragId) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
}

function dashboardDrop(e, targetId) {
  e.preventDefault();
  const sourceId = _dashboardDragId;
  _dashboardDragId = null;
  if (!sourceId || sourceId === targetId) return;
  const cfg = _dashboardActiveConfig();
  const sIdx = cfg.findIndex(x => x.id === sourceId);
  const tIdx = cfg.findIndex(x => x.id === targetId);
  if (sIdx === -1 || tIdx === -1) return;
  const [item] = cfg.splice(sIdx, 1);
  const newTarget = cfg.findIndex(x => x.id === targetId);
  cfg.splice(newTarget, 0, item);
  renderContent();
}

function dashboardDragEnd() { _dashboardDragId = null; }

// ── Hoofdrender ────────────────────────────────────────────────
function renderDashboard() {
  // Defensief — voorkomt undefined .length op cold start
  if (!DB.trainingen)   DB.trainingen   = [];
  if (!DB.uitvoeringen) DB.uitvoeringen = [];
  if (!DB.besturen)     DB.besturen     = [];
  if (!DB.scholen)      DB.scholen      = [];
  if (!DB.contacten)    DB.contacten    = [];
  if (!DB.dossiers)     DB.dossiers     = [];
  if (!DB.facturen)     DB.facturen     = [];
  if (!DB.agenda)       DB.agenda       = [];

  // Trigger lazy outlook-fetch zoals voorheen
  if (DB.outlookSettings?.icsUrl && !_outlookFetchedOnce && !_outlookLoading) {
    if (_outlookEvents.length === 0) {
      const cached = _loadOutlookCache();
      if (cached) _outlookEvents = cached;
    }
    fetchOutlookEvents();
  }

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Goedemorgen' : now.getHours() < 17 ? 'Goedemiddag' : 'Goedenavond';
  const naam = currentUser?.name || 'daar';

  const cfg = _dashboardActiveConfig();
  const registryById = Object.fromEntries(DASHBOARD_WIDGETS.map(w => [w.id, w]));

  const banner = `
    <div class="welcome-banner">
      <div class="welcome-text">
        <h2>${greeting}, ${esc(naam)}! ♥</h2>
        <p>Hier is een overzicht van jouw CRM — coaching, training en advies met ♥ voor onderwijs</p>
      </div>
      ${(naam.toLowerCase().includes('jorieke') || (currentUser?.email || '').toLowerCase().includes('jorieke')) ? `<img src="img/jorieke.jpg" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid rgba(26,184,184,0.3);flex-shrink:0;position:relative;z-index:1"/>` : ''}
      <button class="btn ${_dashboardEditMode ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="toggleDashboardEditMode()" style="position:relative;z-index:1;flex-shrink:0;margin-left:12px">
        ${svgIcon(_dashboardEditMode ? 'close' : 'edit', 14)} ${_dashboardEditMode ? 'Klaar' : 'Aanpassen'}
      </button>
    </div>`;

  // In edit-modus: tonenpaneel met checkboxes voor alle widgets
  const editPanel = _dashboardEditMode ? renderDashboardEditPanel(cfg, registryById) : '';

  // Opbouw widget-rijen: full-width widgets staan op eigen rij,
  // halfwidth widgets worden in paren gekoppeld in een grid-2.
  const visible = cfg.filter(c => _dashboardEditMode ? true : c.visible);
  const rows = [];
  let pair = [];
  for (const c of visible) {
    const w = registryById[c.id];
    if (!w) continue;
    if (w.fullWidth) {
      if (pair.length) { rows.push(pair); pair = []; }
      rows.push([c]);
    } else {
      pair.push(c);
      if (pair.length === 2) { rows.push(pair); pair = []; }
    }
  }
  if (pair.length) rows.push(pair);

  const widgetsHtml = rows.map(row => {
    const inner = row.map(c => {
      const w = registryById[c.id];
      const inner = w.render();
      return wrapWidget(c, w, inner);
    }).join('');
    if (row.length === 1 && row[0] && registryById[row[0].id]?.fullWidth) {
      return `<div style="margin-bottom:14px">${inner}</div>`;
    }
    return `<div class="grid-2" style="margin-bottom:14px">${inner}</div>`;
  }).join('');

  return banner + editPanel + widgetsHtml;
}

// ── Wrapper rond elke widget — voegt drag-handle/checkbox toe in edit-modus ──
function wrapWidget(cfgEntry, widget, innerHtml) {
  if (!_dashboardEditMode) return innerHtml;
  const dimmed = !cfgEntry.visible ? 'opacity:.45' : '';
  return `
    <div class="widget-edit-wrap"
         draggable="true"
         ondragstart="dashboardDragStart(event,'${widget.id}')"
         ondragover="dashboardDragOver(event)"
         ondrop="dashboardDrop(event,'${widget.id}')"
         ondragend="dashboardDragEnd()"
         style="${dimmed}">
      <div class="widget-edit-bar">
        <span class="widget-drag-handle" title="Sleep om te herordenen">⋮⋮</span>
        <span style="font-weight:600;font-size:13px;color:var(--navy)">${esc(widget.label)}</span>
        <span style="flex:1"></span>
        <button class="btn btn-ghost btn-icon btn-sm" title="Omhoog" onclick="moveDashboardWidget('${widget.id}',-1)">▲</button>
        <button class="btn btn-ghost btn-icon btn-sm" title="Omlaag" onclick="moveDashboardWidget('${widget.id}',1)">▼</button>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" ${cfgEntry.visible ? 'checked' : ''} onchange="toggleDashboardWidget('${widget.id}')"/>
          Zichtbaar
        </label>
      </div>
      ${innerHtml}
    </div>`;
}

function renderDashboardEditPanel(cfg, registryById) {
  return `
    <div class="card" style="margin-bottom:14px;background:rgba(26,184,184,0.06);border-color:rgba(26,184,184,0.25)">
      <div class="card-body" style="padding:14px 18px">
        <div style="font-size:13px;color:var(--navy);font-weight:600;margin-bottom:6px">Dashboard aanpassen</div>
        <div style="font-size:12px;color:var(--navy3)">Vink widgets aan/uit en sleep ze om de volgorde te veranderen. Klik op <em>Klaar</em> rechtsboven om de wijzigingen op te slaan.</div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════
// WIDGET RENDER-FUNCTIES
// ════════════════════════════════════════════════════════════════

function renderKpisWidget() {
  const huidigJaar = String(new Date().getFullYear());
  const facturenLopendJaar = DB.facturen.filter(f => getFactuurJaar(f) === huidigJaar);
  const totaalFacturenLopendJaar = facturenLopendJaar.reduce((s, f) => s + (Number(f.totaal) || 0), 0);
  const openFacturen = facturenLopendJaar.filter(f => f.status === 'verzonden').length;

  const stats = [
    ['si-orange', 'board',    DB.besturen.length,   'Besturen'],
    ['si-blue',   'school',   DB.scholen.length,    'Scholen'],
    ['si-green',  'contact',  DB.contacten.length,  'Contactpersonen'],
    ['si-gold',   'training', DB.trainingen.length, 'Trainingen'],
    ['si-green',  'euro',     fmtEuro(totaalFacturenLopendJaar), `Facturen ${huidigJaar}`],
    ['si-orange', 'invoice',  openFacturen,         'Open facturen'],
  ];

  return `
    <div class="dashboard-kpis">
      ${stats.map(([cls, icon, val, lbl]) => `
        <div class="stat-card">
          <div class="stat-icon ${cls}">${svgIcon(icon, 18)}</div>
          <div><div class="stat-value">${esc(String(val))}</div><div class="stat-label">${esc(lbl)}</div></div>
        </div>`).join('')}
    </div>`;
}

function renderAfsprakenWidget() {
  const vandaag = new Date().toISOString().slice(0, 10);
  const afsprakenVandaag = [...DB.agenda, ..._outlookEvents]
    .filter(a => a.datum === vandaag)
    .sort((a, b) => (a.beginTijd || '').localeCompare(b.beginTijd || ''));

  return `
    <div class="card">
      <div class="card-header">
        <h3>${svgIcon('calendar', 16)} Afspraken vandaag</h3>
        <button class="btn btn-secondary btn-sm" onclick="navigate('agenda')">Alle afspraken</button>
      </div>
      <div class="card-body">
        ${afsprakenVandaag.length === 0
          ? `<div class="empty-state-compact">Geen afspraken vandaag</div>`
          : `<div style="display:flex;flex-direction:column;gap:10px">${afsprakenVandaag.map(a => {
              const school = getSchool(a.schoolId);
              const tijdStr = a.beginTijd ? fmtTijd(a.beginTijd) : 'Hele dag';
              const eindStr = a.eindTijd ? fmtTijd(a.eindTijd) : '';
              return `<div style="display:flex;gap:12px;align-items:flex-start;padding:8px 12px;border-radius:8px;background:var(--mint1); cursor:pointer" onclick="openAgendaItem('${a.id}')">
                <div style="min-width:70px;text-align:center">
                  <div style="font-size:13px;font-weight:700;color:var(--navy)">${tijdStr}</div>
                  ${eindStr ? `<div style="font-size:11px;color:var(--ink3)">tot ${eindStr}</div>` : ''}
                </div>
                <div style="flex:1">
                  <div style="font-weight:600;font-size:14px">${esc(a.titel)}</div>
                  <div style="font-size:12px;color:var(--ink3)">
                    ${a.type === '__outlook__' ? '<span class="badge" style="background:#E6EAF2;color:var(--navy)">Extern</span>' : agendaBadge(a.type)}
                    ${school ? `<span style="margin-left:6px">${svgIcon('school', 12)} ${esc(school.naam)}</span>` : ''}
                    ${a.locatie ? `<span style="margin-left:6px">${svgIcon('location', 12)} ${esc(a.locatie)}</span>` : ''}
                  </div>
                </div>
              </div>`;
            }).join('')}</div>`}
      </div>
    </div>`;
}

function renderNieuwsWidget() {
  const latestNews = typeof rssLatestItems === 'function' ? rssLatestItems(5) : [];
  const heeftFeeds = (DB.rssFeeds || []).length > 0;

  return `
    <div class="card">
      <div class="card-header">
        <h3>${svgIcon('note', 16)} Laatste nieuws</h3>
        <button class="btn btn-secondary btn-sm" onclick="navigate('rss')">Alle nieuws</button>
      </div>
      <div class="card-body">
        ${!heeftFeeds
          ? `<div class="empty-state">${svgIcon('note', 36)}<p>Nog geen feeds toegevoegd</p>
               <button class="btn btn-primary btn-sm" onclick="navigate('rss')" style="margin-top:10px">${svgIcon('add', 14)} Feeds beheren</button>
             </div>`
          : latestNews.length === 0
            ? `<div class="empty-state">${svgIcon('note', 36)}<p>Nieuws wordt geladen…</p></div>`
            : `<div style="display:flex;flex-direction:column;gap:8px">${latestNews.map((it, idx) => `
                <div onclick="openDashboardNewsItem(${idx})"
                     style="cursor:pointer;padding:10px 12px;border-radius:8px;background:var(--mint1);transition:background .15s"
                     onmouseover="this.style.background='var(--mint2)'"
                     onmouseout="this.style.background='var(--mint1)'">
                  <div style="font-size:10.5px;color:var(--navy4);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">${esc(it.feedNaam)} · ${_rssRelativeTime(it.pubDateMs)}</div>
                  <div style="font-size:13.5px;font-weight:600;color:var(--navy);line-height:1.3">${esc(it.title)}</div>
                  ${it.summary ? `<div style="font-size:12px;color:var(--navy3);line-height:1.45;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(it.summary)}</div>` : ''}
                </div>`).join('')}</div>`}
      </div>
    </div>`;
}

function renderTopOpenstaandWidget() {
  const open = (DB.facturen || [])
    .filter(f => f.status === 'verzonden')
    .sort((a, b) => (Number(b.totaal) || 0) - (Number(a.totaal) || 0))
    .slice(0, 10);
  const totaalOpen = open.reduce((s, f) => s + (Number(f.totaal) || 0), 0);

  return `
    <div class="card">
      <div class="card-header">
        <h3>${svgIcon('euro', 16)} Top 10 openstaand</h3>
        <button class="btn btn-secondary btn-sm" onclick="navigate('facturen')">Alle facturen</button>
      </div>
      <div class="card-body">
        ${open.length === 0
          ? `<div class="empty-state-compact">Geen openstaande facturen</div>`
          : `<div style="display:flex;flex-direction:column;gap:6px">${open.map(f => {
              const klant = factuurKlantNaam(f) || 'Onbekend';
              return `<div class="topopen-row" onclick="openFactuurModal('${f.schoolId || ''}','${f.id}')" style="display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:6px;background:var(--mint1);cursor:pointer">
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:13.5px;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(klant)}</div>
                  <div style="font-size:11.5px;color:var(--navy3)">${esc(f.nummer || '')}${f.datum ? ' · ' + fmtDateShort(f.datum) : ''}</div>
                </div>
                <div style="font-weight:700;font-size:13.5px;color:var(--navy);white-space:nowrap">${fmtEuro(f.totaal)}</div>
              </div>`;
            }).join('')}
            <div style="margin-top:8px;padding-top:8px;border-top:1px dashed rgba(30,45,74,0.10);display:flex;justify-content:space-between;font-size:12px;color:var(--navy3)">
              <span>Totaal openstaand</span><strong style="color:var(--navy)">${fmtEuro(totaalOpen)}</strong>
            </div>
          </div>`}
      </div>
    </div>`;
}

function renderTrainingenMaandWidget() {
  const now = new Date();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const items = (DB.uitvoeringen || [])
    .filter(u => u.datum && u.datum >= mStart && u.datum <= mEnd)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const monthLabel = now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });

  return `
    <div class="card">
      <div class="card-header">
        <h3>${svgIcon('training', 16)} Trainingen ${esc(monthLabel)}</h3>
        <button class="btn btn-secondary btn-sm" onclick="navigate('trainingen')">Alle trainingen</button>
      </div>
      <div class="card-body">
        ${items.length === 0
          ? `<div class="empty-state-compact">Geen uitvoeringen deze maand</div>`
          : `<div style="display:flex;flex-direction:column;gap:6px">${items.map(u => {
              const t = (DB.trainingen || []).find(x => x.id === u.trainingId);
              const s = getSchool(u.schoolId);
              return `<div onclick="navigate('training-detail','${u.trainingId}')" style="display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:6px;background:var(--mint1);cursor:pointer">
                <div style="min-width:54px;text-align:center">
                  <div style="font-size:11px;color:var(--navy4);text-transform:uppercase;font-weight:700;letter-spacing:.4px">${new Date(u.datum).toLocaleDateString('nl-NL', { month: 'short' })}</div>
                  <div style="font-size:16px;font-weight:700;color:var(--navy);line-height:1">${new Date(u.datum).getDate()}</div>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:13.5px;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t?.naam || 'Onbekende training')}</div>
                  <div style="font-size:11.5px;color:var(--navy3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s ? esc(s.naam) : '—'}${u.deelnemers ? ' · ' + u.deelnemers + ' deelnemers' : ''}</div>
                </div>
                ${u.score ? `<div style="font-size:13px;font-weight:700;color:var(--accent)">${u.score.toFixed ? u.score.toFixed(1) : u.score}</div>` : ''}
              </div>`;
            }).join('')}</div>`}
      </div>
    </div>`;
}

function renderVervallenWidget() {
  const vandaag = new Date().toISOString().slice(0, 10);
  const vervallen = (DB.facturen || [])
    .filter(f => f.status === 'verzonden' && f.vervaldatum && f.vervaldatum < vandaag)
    .sort((a, b) => (a.vervaldatum || '').localeCompare(b.vervaldatum || ''));
  const totaal = vervallen.reduce((s, f) => s + (Number(f.totaal) || 0), 0);

  return `
    <div class="card">
      <div class="card-header">
        <h3>${svgIcon('clock', 16)} Vervallen facturen ${vervallen.length ? `<span class="badge" style="background:rgba(244,63,94,0.10);color:var(--rood);margin-left:8px">${vervallen.length}</span>` : ''}</h3>
        <button class="btn btn-secondary btn-sm" onclick="navigate('facturen')">Alle facturen</button>
      </div>
      <div class="card-body">
        ${vervallen.length === 0
          ? `<div class="empty-state-compact">Geen vervallen facturen — top!</div>`
          : `<div style="display:flex;flex-direction:column;gap:6px">${vervallen.slice(0, 10).map(f => {
              const klant = factuurKlantNaam(f) || 'Onbekend';
              const dagenOver = Math.floor((Date.parse(vandaag) - Date.parse(f.vervaldatum)) / 86400000);
              return `<div onclick="openFactuurModal('${f.schoolId || ''}','${f.id}')" style="display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:6px;background:rgba(244,63,94,0.06);cursor:pointer">
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:13.5px;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(klant)}</div>
                  <div style="font-size:11.5px;color:var(--rood);font-weight:600">${esc(f.nummer || '')} · ${dagenOver} ${dagenOver === 1 ? 'dag' : 'dagen'} over</div>
                </div>
                <div style="font-weight:700;font-size:13.5px;color:var(--navy);white-space:nowrap">${fmtEuro(f.totaal)}</div>
              </div>`;
            }).join('')}
            ${vervallen.length > 10 ? `<div style="font-size:11.5px;color:var(--navy3);text-align:center;margin-top:4px">en ${vervallen.length - 10} meer…</div>` : ''}
            <div style="margin-top:8px;padding-top:8px;border-top:1px dashed rgba(244,63,94,0.20);display:flex;justify-content:space-between;font-size:12px;color:var(--navy3)">
              <span>Totaal vervallen</span><strong style="color:var(--rood)">${fmtEuro(totaal)}</strong>
            </div>
          </div>`}
      </div>
    </div>`;
}

