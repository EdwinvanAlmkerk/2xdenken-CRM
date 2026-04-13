// ════════════════════════════════════════════════════════════════
// AGENDA — Dag / Week / Maand / Lijst weergaven
// ════════════════════════════════════════════════════════════════
let _agendaView   = 'week'; // 'dag', 'week', 'maand', 'lijst'
let _agendaDate   = new Date();
let _agendaFilter = 'komend';
let _agendaSearch = '';

// Kleur-mapping: kleur-id → badge CSS class + event CSS class
const AGENDA_KLEUREN = {
  navy:   { badge: 'badge-beslisser',   event: 'cal-event-afspraak' },
  paars:  { badge: 'badge-beinvloeder', event: 'cal-event-belafspraak' },
  blauw:  { badge: 'badge-verzonden',   event: 'cal-event-opvolging' },
  groen:  { badge: 'badge-betaald',     event: 'cal-event-training' },
  goud:   { badge: 'badge-concept',     event: 'cal-event-overig' },
  rood:   { badge: 'badge-vervallen',   event: 'cal-event-rood' },
  oranje: { badge: 'badge-oranje',      event: 'cal-event-oranje' },
};

const AGENDA_KLEUR_LABELS = {
  navy: 'Navy', paars: 'Paars', blauw: 'Blauw', groen: 'Groen',
  goud: 'Goud', rood: 'Rood', oranje: 'Oranje',
};

function getAgendaType(typeId) {
  return DB.agendaTypes.find(t => t.id === typeId) || { id: typeId, naam: typeId, kleur: 'navy' };
}

function agendaBadge(type) {
  const t = getAgendaType(type);
  const k = AGENDA_KLEUREN[t.kleur] || AGENDA_KLEUREN.navy;
  return `<span class="badge ${k.badge}">${esc(t.naam)}</span>`;
}

function agendaEventClass(type) {
  const t = getAgendaType(type);
  const k = AGENDA_KLEUREN[t.kleur] || AGENDA_KLEUREN.navy;
  return k.event;
}

function fmtTijd(t) {
  if (!t) return '';
  return t.slice(0, 5);
}

// ── Gedeelde agenda-rij voor detailpagina's (school/bestuur/contact) ──
function renderAgendaRow(a) {
  const school  = a.schoolId  ? DB.scholen.find(s => s.id === a.schoolId)   : null;
  const bestuur = a.bestuurId ? DB.besturen.find(b => b.id === a.bestuurId) : null;
  const contact = a.contactId ? DB.contacten.find(c => c.id === a.contactId) : null;
  const tijdStr = a.beginTijd
    ? (a.eindTijd ? `${fmtTijd(a.beginTijd)} – ${fmtTijd(a.eindTijd)}` : fmtTijd(a.beginTijd))
    : 'Hele dag';
  const koppeling = [school?.naam, bestuur?.naam, contact?.naam].filter(Boolean).join(' · ');
  return `<tr>
    <td style="width:110px;white-space:nowrap;color:var(--navy4);font-size:13px;vertical-align:top;padding:12px 16px">${fmtDateShort(a.datum)}</td>
    <td style="width:90px;white-space:nowrap;font-weight:600;color:var(--navy);vertical-align:top;padding:12px 8px">${svgIcon('clock', 13)} ${tijdStr}</td>
    <td style="padding:12px 8px;vertical-align:top">
      <div style="font-weight:600">${esc(a.titel)}</div>
      <div style="font-size:13px;color:var(--ink3);margin-top:2px">
        ${agendaBadge(a.type)}
        ${a.locatie ? `<span style="margin-left:8px">${svgIcon('location', 13)} ${esc(a.locatie)}</span>` : ''}
        ${koppeling ? `<span style="margin-left:8px">${esc(koppeling)}</span>` : ''}
      </div>
    </td>
    <td style="width:80px;vertical-align:top;padding:12px 16px">
      <div class="row-actions">
        <button class="btn btn-ghost btn-icon btn-sm" title="Bewerken" onclick="openAgendaModal('${a.id}')">${svgIcon('edit', 14)}</button>
        <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delAgenda('${a.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
      </div>
    </td>
  </tr>`;
}

// ── Datum helpers ────────────────────────────────────────────────
function dateStr(d) { return d.toISOString().slice(0, 10); }

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d) {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

function sameDay(a, b) { return dateStr(a) === dateStr(b); }

const DAG_NAMEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const DAG_NAMEN_LANG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAAND_NAMEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

const CAL_START_HOUR = 7;
const CAL_END_HOUR = 21;

// ── Navigatie ───────────────────────────────────────────────────
function agendaNav(dir) {
  if (_agendaView === 'dag')   _agendaDate = addDays(_agendaDate, dir);
  if (_agendaView === 'week')  _agendaDate = addDays(_agendaDate, dir * 7);
  if (_agendaView === 'maand') {
    _agendaDate = new Date(_agendaDate.getFullYear(), _agendaDate.getMonth() + dir, 1);
  }
  renderContent();
}

function agendaVandaag() {
  _agendaDate = new Date();
  renderContent();
}

function setAgendaView(v) {
  _agendaView = v;
  renderContent();
}

function searchAgenda(v) { _agendaSearch = v; smartRender(() => renderAgendaPage()); }
function filterAgenda(v) { _agendaFilter = v; renderContent(); }

// ── Items ophalen voor een datumreeks ────────────────────────────
function getItemsForDate(iso) {
  return DB.agenda.filter(a => a.datum === iso)
    .sort((a, b) => (a.beginTijd || '').localeCompare(b.beginTijd || ''));
}

function getItemsForRange(startIso, endIso) {
  return DB.agenda.filter(a => a.datum >= startIso && a.datum <= endIso);
}

// ── Tijd → pixel positie ─────────────────────────────────────────
function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToPx(m) {
  return ((m - CAL_START_HOUR * 60) / 60) * 60; // 60px per uur
}

// ── Hoofd render ─────────────────────────────────────────────────
function renderAgendaPage() {
  if (_agendaView === 'lijst') return renderAgendaList();

  // Toolbar: titel berekenen
  let title = '';
  if (_agendaView === 'dag') {
    title = `${DAG_NAMEN_LANG[_agendaDate.getDay()]} ${_agendaDate.getDate()} ${MAAND_NAMEN[_agendaDate.getMonth()]} ${_agendaDate.getFullYear()}`;
  } else if (_agendaView === 'week') {
    const mon = getMonday(_agendaDate);
    const sun = addDays(mon, 6);
    if (mon.getMonth() === sun.getMonth()) {
      title = `${mon.getDate()} – ${sun.getDate()} ${MAAND_NAMEN[mon.getMonth()]} ${mon.getFullYear()}`;
    } else {
      title = `${mon.getDate()} ${MAAND_NAMEN[mon.getMonth()].slice(0, 3)} – ${sun.getDate()} ${MAAND_NAMEN[sun.getMonth()].slice(0, 3)} ${sun.getFullYear()}`;
    }
  } else if (_agendaView === 'maand') {
    title = `${MAAND_NAMEN[_agendaDate.getMonth()]} ${_agendaDate.getFullYear()}`;
  }

  const viewBtn = (v, label, icon) =>
    `<button class="btn btn-sm ${_agendaView === v ? 'btn-primary' : 'btn-secondary'}" onclick="setAgendaView('${v}')">${svgIcon(icon, 13)} ${label}</button>`;

  let body = '';
  if (_agendaView === 'week') body = renderWeekView();
  else if (_agendaView === 'dag') body = renderDayView();
  else if (_agendaView === 'maand') body = renderMonthView();

  return `
    <div class="cal-toolbar">
      <div class="cal-toolbar-nav">
        <button class="btn btn-secondary btn-sm" onclick="agendaVandaag()">Vandaag</button>
        <button class="btn btn-ghost btn-icon" onclick="agendaNav(-1)">${svgIcon('chevronL', 18)}</button>
        <button class="btn btn-ghost btn-icon" onclick="agendaNav(1)">${svgIcon('chevron', 18)}</button>
      </div>
      <div class="cal-toolbar-title">${esc(title)}</div>
      <div class="cal-toolbar-right">
        <div class="cal-toolbar-views">
          ${viewBtn('dag', 'Dag', 'calendar')}
          ${viewBtn('week', 'Week', 'calendar')}
          ${viewBtn('maand', 'Maand', 'calendar')}
          ${viewBtn('lijst', 'Lijst', 'list')}
        </div>
        <button class="btn btn-primary btn-sm" onclick="openAgendaModal()">
          ${svgIcon('add', 14)} Nieuw
        </button>
      </div>
    </div>
    ${body}`;
}

// ═══════════════════════════════════════════════════════════════
// WEEK VIEW
// ═══════════════════════════════════════════════════════════════
function renderWeekView() {
  const monday = getMonday(_agendaDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const vandaag = dateStr(new Date());
  const hours = Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }, (_, i) => CAL_START_HOUR + i);
  // Header
  const header = `<div class="cal-header" style="grid-template-columns:56px repeat(7, 1fr)">
    <div class="cal-header-cell"></div>
    ${days.map(d => {
      const iso = dateStr(d);
      const isToday = iso === vandaag;
      return `<div class="cal-header-cell${isToday ? ' cal-today' : ''}" onclick="_agendaDate=new Date('${iso}');setAgendaView('dag')">
        <span>${DAG_NAMEN[d.getDay()]}</span>
        <span class="cal-day-num">${d.getDate()}</span>
      </div>`;
    }).join('')}
  </div>`;

  // All-day row
  const allday = `<div class="cal-allday" style="grid-template-columns:56px repeat(7, 1fr)">
    <div class="cal-allday-cell" style="font-size:10px;color:var(--navy4);text-align:right;padding-right:8px;line-height:24px">hele dag</div>
    ${days.map(d => {
      const iso = dateStr(d);
      const items = getItemsForDate(iso).filter(a => !a.beginTijd);
      return `<div class="cal-allday-cell">
        ${items.map(a => `<div class="cal-month-event ${agendaEventClass(a.type)}" onclick="openAgendaModal('${a.id}')" title="${esc(a.titel)}">${esc(a.titel)}</div>`).join('')}
      </div>`;
    }).join('')}
  </div>`;

  // Time grid
  const timeLabels = hours.map(h =>
    `<div class="cal-time-label">${String(h).padStart(2, '0')}:00</div>`
  ).join('');

  const dayColumns = days.map(d => {
    const iso = dateStr(d);
    const isToday = iso === vandaag;
    const items = getItemsForDate(iso).filter(a => a.beginTijd);
    const hourLines = hours.map(() =>
      `<div class="cal-hour-line" style="position:relative"><div class="cal-hour-line-half" style="top:30px"></div></div>`
    ).join('');

    // Events
    const events = items.map(a => {
      const startMin = timeToMinutes(a.beginTijd);
      const endMin = a.eindTijd ? timeToMinutes(a.eindTijd) : startMin + 60;
      const top = minutesToPx(startMin);
      const height = Math.max(((endMin - startMin) / 60) * 60, 20);
      const school = a.schoolId ? DB.scholen.find(s => s.id === a.schoolId) : null;
      const meta = [fmtTijd(a.beginTijd), a.locatie, school?.naam].filter(Boolean).join(' · ');
      return `<div class="cal-event ${agendaEventClass(a.type)}" style="top:${top}px;height:${height}px" onclick="openAgendaModal('${a.id}')" title="${esc(a.titel)}">
        <div class="cal-event-title">${esc(a.titel)}</div>
        ${height > 28 ? `<div class="cal-event-meta">${esc(meta)}</div>` : ''}
      </div>`;
    }).join('');

    // Now line
    let nowLine = '';
    if (isToday) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= CAL_START_HOUR * 60 && nowMin <= CAL_END_HOUR * 60) {
        const top = minutesToPx(nowMin);
        nowLine = `<div class="cal-now-line" style="top:${top}px"><div class="cal-now-dot"></div></div>`;
      }
    }

    return `<div class="cal-day-col">${hourLines}${events}${nowLine}</div>`;
  }).join('');

  const totalHeight = (CAL_END_HOUR - CAL_START_HOUR) * 60;

  return `
    <div class="cal-grid">
      <div class="cal-body-scroll" id="cal-scroll">
        <div class="cal-sticky-top">
          ${header}
          ${allday}
        </div>
        <div class="cal-body" style="grid-template-columns:56px repeat(7, 1fr);height:${totalHeight}px">
          <div class="cal-time-col">${timeLabels}</div>
          ${dayColumns}
        </div>
      </div>
    </div>
    <script>
      (function(){
        var el = document.getElementById('cal-scroll');
        if (el) el.scrollTop = ${(Math.max(8, CAL_START_HOUR) - CAL_START_HOUR) * 60};
      })();
    </script>`;
}

// ═══════════════════════════════════════════════════════════════
// DAG VIEW
// ═══════════════════════════════════════════════════════════════
function renderDayView() {
  const iso = dateStr(_agendaDate);
  const vandaag = dateStr(new Date());
  const isToday = iso === vandaag;
  const hours = Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }, (_, i) => CAL_START_HOUR + i);
  const items = getItemsForDate(iso);
  const alldayItems = items.filter(a => !a.beginTijd);
  const timedItems = items.filter(a => a.beginTijd);

  const timeLabels = hours.map(h =>
    `<div class="cal-time-label">${String(h).padStart(2, '0')}:00</div>`
  ).join('');

  const hourLines = hours.map(() =>
    `<div class="cal-hour-line" style="position:relative"><div class="cal-hour-line-half" style="top:30px"></div></div>`
  ).join('');

  const events = timedItems.map(a => {
    const startMin = timeToMinutes(a.beginTijd);
    const endMin = a.eindTijd ? timeToMinutes(a.eindTijd) : startMin + 60;
    const top = minutesToPx(startMin);
    const height = Math.max(((endMin - startMin) / 60) * 60, 20);
    const school = a.schoolId ? DB.scholen.find(s => s.id === a.schoolId) : null;
    const meta = [fmtTijd(a.beginTijd) + (a.eindTijd ? ` – ${fmtTijd(a.eindTijd)}` : ''), a.locatie, school?.naam].filter(Boolean).join(' · ');
    return `<div class="cal-event ${agendaEventClass(a.type)}" style="top:${top}px;height:${height}px;right:20%" onclick="openAgendaModal('${a.id}')">
      <div class="cal-event-title">${esc(a.titel)}</div>
      ${height > 28 ? `<div class="cal-event-meta">${esc(meta)}</div>` : ''}
    </div>`;
  }).join('');

  let nowLine = '';
  if (isToday) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= CAL_START_HOUR * 60 && nowMin <= CAL_END_HOUR * 60) {
      const top = minutesToPx(nowMin);
      nowLine = `<div class="cal-now-line" style="top:${top}px"><div class="cal-now-dot"></div></div>`;
    }
  }

  const allday = alldayItems.length > 0 ? `
    <div style="padding:8px 16px 8px 72px;background:var(--bg2);border-bottom:1px solid var(--bg3);font-size:12px">
      <span style="color:var(--navy4);font-weight:700;margin-right:8px">Hele dag:</span>
      ${alldayItems.map(a => `<span class="cal-month-event ${agendaEventClass(a.type)}" style="display:inline-block;margin-right:6px" onclick="openAgendaModal('${a.id}')">${esc(a.titel)}</span>`).join('')}
    </div>` : '';

  const totalHeight = (CAL_END_HOUR - CAL_START_HOUR) * 60;

  return `
    <div class="cal-grid">
      <div class="cal-body-scroll" id="cal-scroll">
        ${allday ? `<div class="cal-sticky-top">${allday}</div>` : ''}
        <div class="cal-body" style="grid-template-columns:56px 1fr;height:${totalHeight}px">
          <div class="cal-time-col">${timeLabels}</div>
          <div class="cal-day-col">${hourLines}${events}${nowLine}</div>
        </div>
      </div>
    </div>
    <script>
      (function(){
        var el = document.getElementById('cal-scroll');
        if (el) el.scrollTop = ${(Math.max(8, CAL_START_HOUR) - CAL_START_HOUR) * 60};
      })();
    </script>`;
}

// ═══════════════════════════════════════════════════════════════
// MAAND VIEW
// ═══════════════════════════════════════════════════════════════
function renderMonthView() {
  const year = _agendaDate.getFullYear();
  const month = _agendaDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const vandaag = dateStr(new Date());

  // Start op maandag van de week met dag 1
  let startDate = getMonday(firstDay);
  // Eindig op zondag van de week met de laatste dag
  let endDate = addDays(getMonday(lastDay), 6);

  const allItems = getItemsForRange(dateStr(startDate), dateStr(endDate));

  // Header: dag-namen
  const headerCells = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map(d =>
    `<div class="cal-month-header">${d}</div>`
  ).join('');

  // Dagen
  let dayCells = '';
  let current = new Date(startDate);
  while (current <= endDate) {
    const iso = dateStr(current);
    const isToday = iso === vandaag;
    const isOther = current.getMonth() !== month;
    const dayItems = allItems.filter(a => a.datum === iso).slice(0, 3);
    const totalItems = allItems.filter(a => a.datum === iso).length;

    dayCells += `<div class="cal-month-day${isOther ? ' cal-other' : ''}${isToday ? ' cal-today' : ''}" onclick="_agendaDate=new Date('${iso}');setAgendaView('dag')">
      <div class="cal-month-num">${current.getDate()}</div>
      ${dayItems.map(a => `<div class="cal-month-event ${agendaEventClass(a.type)}" onclick="event.stopPropagation();openAgendaModal('${a.id}')" title="${esc(a.titel)}">
        ${a.beginTijd ? fmtTijd(a.beginTijd) + ' ' : ''}${esc(a.titel)}
      </div>`).join('')}
      ${totalItems > 3 ? `<div class="cal-month-more" onclick="event.stopPropagation();_agendaDate=new Date('${iso}');setAgendaView('dag')">+${totalItems - 3} meer</div>` : ''}
    </div>`;

    current = addDays(current, 1);
  }

  return `<div class="cal-month">${headerCells}${dayCells}</div>`;
}

// ═══════════════════════════════════════════════════════════════
// LIJST VIEW (oorspronkelijke weergave)
// ═══════════════════════════════════════════════════════════════
function renderAgendaList() {
  const vandaag = dateStr(new Date());
  let items = [...DB.agenda];

  if (_agendaFilter === 'komend')   items = items.filter(a => a.datum >= vandaag);
  if (_agendaFilter === 'verlopen') items = items.filter(a => a.datum < vandaag);

  if (_agendaSearch) {
    const q = _agendaSearch.toLowerCase();
    items = items.filter(a =>
      a.titel.toLowerCase().includes(q) ||
      (a.locatie || '').toLowerCase().includes(q) ||
      (a.notitie || '').toLowerCase().includes(q) ||
      (getAgendaType(a.type).naam || '').toLowerCase().includes(q)
    );
  }

  if (_agendaFilter === 'verlopen') {
    items.sort((a, b) => b.datum.localeCompare(a.datum) || (b.beginTijd || '').localeCompare(a.beginTijd || ''));
  } else {
    items.sort((a, b) => a.datum.localeCompare(b.datum) || (a.beginTijd || '').localeCompare(b.beginTijd || ''));
  }

  const grouped = {};
  for (const item of items) {
    if (!grouped[item.datum]) grouped[item.datum] = [];
    grouped[item.datum].push(item);
  }

  const viewBtn = (v, label, icon) =>
    `<button class="btn btn-sm ${_agendaView === v ? 'btn-primary' : 'btn-secondary'}" onclick="setAgendaView('${v}')">${svgIcon(icon, 13)} ${label}</button>`;
  const filterBtn = (val, label) =>
    `<button class="btn btn-sm ${_agendaFilter === val ? 'btn-primary' : 'btn-secondary'}" onclick="filterAgenda('${val}')">${label}</button>`;

  return `
    <div class="cal-toolbar">
      <div class="search-wrap" style="flex:1;min-width:200px;max-width:360px">
        <span class="search-icon">${svgIcon('search', 15)}</span>
        <input id="search-agenda" type="text" placeholder="Zoek in agenda…" value="${esc(_agendaSearch)}" oninput="searchAgenda(this.value)" style="padding-left:34px"/>
      </div>
      <div style="display:flex;gap:6px">
        ${filterBtn('komend', 'Komend')}
        ${filterBtn('alles', 'Alles')}
        ${filterBtn('verlopen', 'Verlopen')}
      </div>
      <div class="cal-toolbar-right">
        <div class="cal-toolbar-views">
          ${viewBtn('dag', 'Dag', 'calendar')}
          ${viewBtn('week', 'Week', 'calendar')}
          ${viewBtn('maand', 'Maand', 'calendar')}
          ${viewBtn('lijst', 'Lijst', 'list')}
        </div>
        <button class="btn btn-primary btn-sm" onclick="openAgendaModal()">
          ${svgIcon('add', 14)} Nieuw
        </button>
      </div>
    </div>

    ${items.length === 0
      ? `<div class="card"><div class="card-body"><div class="empty-state">${svgIcon('calendar', 36)}<p>Geen afspraken gevonden</p></div></div></div>`
      : Object.keys(grouped).map(datum => {
          const dagLabel = datum === vandaag ? 'Vandaag' : fmtDate(datum);
          const isVandaag = datum === vandaag;
          return `
            <div class="card" style="margin-bottom:16px">
              <div class="card-header">
                <h3 style="${isVandaag ? 'color:var(--s-blauw)' : ''}">${svgIcon('calendar', 16)} ${esc(dagLabel)}</h3>
              </div>
              <div class="card-body" style="padding:0">
                <table>
                  <tbody>
                    ${grouped[datum].map(a => {
                      const school  = a.schoolId  ? DB.scholen.find(s => s.id === a.schoolId)   : null;
                      const contact = a.contactId ? DB.contacten.find(c => c.id === a.contactId) : null;
                      const bestuur = a.bestuurId ? DB.besturen.find(b => b.id === a.bestuurId)  : null;
                      const tijdStr = a.beginTijd
                        ? (a.eindTijd ? `${fmtTijd(a.beginTijd)} – ${fmtTijd(a.eindTijd)}` : fmtTijd(a.beginTijd))
                        : 'Hele dag';
                      const koppeling = school ? school.naam : (bestuur ? bestuur.naam : (contact ? contact.naam : ''));
                      return `<tr>
                        <td style="width:100px;white-space:nowrap;font-weight:600;color:var(--navy);vertical-align:top;padding:12px 16px">
                          ${svgIcon('clock', 14)} ${tijdStr}
                        </td>
                        <td style="padding:12px 8px;vertical-align:top">
                          <div style="font-weight:600">${esc(a.titel)}</div>
                          <div style="font-size:13px;color:var(--ink3);margin-top:2px">
                            ${agendaBadge(a.type)}
                            ${a.locatie ? `<span style="margin-left:8px">${svgIcon('location', 13)} ${esc(a.locatie)}</span>` : ''}
                            ${koppeling ? `<span style="margin-left:8px">${svgIcon(school ? 'school' : bestuur ? 'board' : 'contact', 13)} ${esc(koppeling)}</span>` : ''}
                          </div>
                          ${a.notitie ? `<div style="font-size:13px;color:var(--ink3);margin-top:4px">${esc(a.notitie)}</div>` : ''}
                        </td>
                        <td style="width:80px;vertical-align:top;padding:12px 16px">
                          <div class="row-actions">
                            <button class="btn btn-ghost btn-icon btn-sm" title="Bewerken" onclick="openAgendaModal('${a.id}')">${svgIcon('edit', 14)}</button>
                            <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delAgenda('${a.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                          </div>
                        </td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        }).join('')}`;
}

// ── School-change handler in modal ───────────────────────────────
function onAgendaSchoolChange() {
  const schoolId = document.getElementById('f-school').value;
  const school = schoolId ? DB.scholen.find(s => s.id === schoolId) : null;

  // Bestuur automatisch meezetten
  const bestuurSel = document.getElementById('f-bestuur');
  if (school?.bestuurId) {
    bestuurSel.value = school.bestuurId;
    bestuurSel.disabled = true;
  } else {
    bestuurSel.value = '';
    bestuurSel.disabled = false;
  }

  // Contacten filteren op school
  const contactSel = document.getElementById('f-contact');
  const currentContact = contactSel.value;
  const contacten = schoolId
    ? DB.contacten.filter(c => c.schoolId === schoolId)
    : DB.contacten;
  contactSel.innerHTML = '<option value="">— Geen —</option>' +
    contacten.map(c =>
      `<option value="${c.id}"${c.id === currentContact ? ' selected' : ''}>${esc(c.naam)}${c.functie ? ` (${esc(c.functie)})` : ''}</option>`
    ).join('');
}

// ── Agenda modal ─────────────────────────────────────────────────
// Parameters:
//   id          — bestaand agenda-item bewerken (leeg = nieuw)
//   prefillDate — datum vooraf invullen
//   prefillSchoolId   — school vooraf selecteren (vanuit school/contact context)
//   prefillContactId  — contact vooraf selecteren
//   prefillBestuurId  — bestuur vooraf selecteren (vanuit bestuur context)
function openAgendaModal(id = '', prefillDate = '', prefillSchoolId = '', prefillContactId = '', prefillBestuurId = '') {
  const a = id ? DB.agenda.find(x => x.id === id) : null;
  const defaultDatum = a?.datum || prefillDate || dateStr(_agendaDate);

  // Bepaal actieve waarden (bestaand item > prefill > leeg)
  const selSchoolId  = a?.schoolId  || prefillSchoolId  || '';
  const selContactId = a?.contactId || prefillContactId || '';
  // Bestuur: afleiden uit school als die er is, anders prefill
  const schoolForBestuur = DB.scholen.find(x => x.id === selSchoolId);
  const selBestuurId = a?.bestuurId || (schoolForBestuur?.bestuurId || '') || prefillBestuurId || '';

  // School: als prefill, toon locked; anders alle scholen
  const schoolLocked = !a && prefillSchoolId;
  const schoolOpts = schoolLocked
    ? (() => { const s = DB.scholen.find(x => x.id === prefillSchoolId); return s ? `<option value="${s.id}" selected>${esc(s.naam)}</option>` : ''; })()
    : DB.scholen.map(s => `<option value="${s.id}"${selSchoolId === s.id ? ' selected' : ''}>${esc(s.naam)}</option>`).join('');

  // Bestuur: locked als prefill OF afgeleid van school
  const bestuurLocked = !a && (prefillBestuurId || (prefillSchoolId && selBestuurId));
  const bestuurOpts = bestuurLocked
    ? (() => { const b = DB.besturen.find(x => x.id === selBestuurId); return b ? `<option value="${b.id}" selected>${esc(b.naam)}</option>` : ''; })()
    : DB.besturen.map(b => `<option value="${b.id}"${selBestuurId === b.id ? ' selected' : ''}>${esc(b.naam)}</option>`).join('');

  // Contacten: als school prefill, toon alleen contacten van die school
  const contactPool = prefillSchoolId
    ? DB.contacten.filter(c => c.schoolId === prefillSchoolId)
    : DB.contacten;
  const contactOpts = contactPool.map(c =>
    `<option value="${c.id}"${selContactId === c.id ? ' selected' : ''}>${esc(c.naam)}${c.functie ? ` (${esc(c.functie)})` : ''}</option>`
  ).join('');

  const typeSelect = DB.agendaTypes.map(t =>
    `<option value="${t.id}"${(a?.type || (DB.agendaTypes[0]?.id || 'afspraak')) === t.id ? ' selected' : ''}>${esc(t.naam)}</option>`
  ).join('');

  // Context-info voor de modal titel
  let contextLabel = '';
  if (!a && prefillSchoolId)  { const s = DB.scholen.find(x => x.id === prefillSchoolId);  if (s) contextLabel = ` — ${s.naam}`; }
  if (!a && prefillBestuurId) { const b = DB.besturen.find(x => x.id === prefillBestuurId); if (b) contextLabel = ` — ${b.naam}`; }

  showModal(a ? 'Afspraak bewerken' : `Nieuwe afspraak${contextLabel}`,
    `<div class="form-group"><label>Titel *</label><input type="text" id="f-titel" value="${esc(a?.titel || '')}" placeholder="Bijv. Intakegesprek school X"/></div>
     <div class="form-row">
       <div class="form-group"><label>Datum *</label><input type="date" id="f-datum" value="${esc(defaultDatum)}"/></div>
       <div class="form-group"><label>Type</label><select id="f-type">${typeSelect}</select></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label>Begintijd</label><input type="time" id="f-begintijd" value="${esc(a?.beginTijd || '')}"/></div>
       <div class="form-group"><label>Eindtijd</label><input type="time" id="f-eindtijd" value="${esc(a?.eindTijd || '')}"/></div>
     </div>
     <div class="form-group"><label>Locatie</label><input type="text" id="f-locatie" value="${esc(a?.locatie || '')}" placeholder="Adres of online"/></div>
     <div class="form-row">
       <div class="form-group"><label>School</label><select id="f-school"${schoolLocked ? ' disabled' : ''} onchange="onAgendaSchoolChange()">${!schoolLocked ? '<option value="">— Geen —</option>' : ''}${schoolOpts}</select>${schoolLocked ? `<input type="hidden" id="f-school-hidden" value="${esc(prefillSchoolId)}"/>` : ''}</div>
       <div class="form-group"><label>Bestuur</label><select id="f-bestuur"${bestuurLocked ? ' disabled' : ''}><option value="">— Geen —</option>${bestuurOpts}</select>${bestuurLocked ? `<input type="hidden" id="f-bestuur-hidden" value="${esc(selBestuurId)}"/>` : ''}</div>
     </div>
     <div class="form-group"><label>Contactpersoon</label><select id="f-contact"><option value="">— Geen —</option>${contactOpts}</select></div>
     <div class="form-group"><label>Notitie</label><textarea id="f-notitie" rows="3" placeholder="Extra informatie…">${esc(a?.notitie || '')}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${a ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delAgenda('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveAgenda('${id}')">${a ? 'Opslaan' : 'Toevoegen'}</button>`);
}
