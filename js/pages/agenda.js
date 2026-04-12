// ════════════════════════════════════════════════════════════════
// AGENDA
// ════════════════════════════════════════════════════════════════
let _agendaFilter = 'komend'; // 'komend', 'alles', 'verlopen'
let _agendaSearch = '';

const AGENDA_TYPES = {
  afspraak:    { label: 'Afspraak',    cls: 'badge-beslisser' },
  belafspraak: { label: 'Belafspraak', cls: 'badge-beinvloeder' },
  opvolging:   { label: 'Opvolging',   cls: 'badge-verzonden' },
  training:    { label: 'Training',    cls: 'badge-betaald' },
  overig:      { label: 'Overig',      cls: 'badge-concept' },
};

function agendaBadge(type) {
  const t = AGENDA_TYPES[type] || AGENDA_TYPES.overig;
  return `<span class="badge ${t.cls}">${esc(t.label)}</span>`;
}

function fmtTijd(t) {
  if (!t) return '';
  return t.slice(0, 5); // "14:30:00" → "14:30"
}

function searchAgenda(v) { _agendaSearch = v; smartRender(() => renderAgendaPage()); }
function filterAgenda(v) { _agendaFilter = v; renderContent(); }

function renderAgendaPage() {
  const vandaag = new Date().toISOString().slice(0, 10);

  let items = [...DB.agenda];

  // Filter op komend / verlopen / alles
  if (_agendaFilter === 'komend')   items = items.filter(a => a.datum >= vandaag);
  if (_agendaFilter === 'verlopen') items = items.filter(a => a.datum < vandaag);

  // Zoekfilter
  if (_agendaSearch) {
    const q = _agendaSearch.toLowerCase();
    items = items.filter(a =>
      a.titel.toLowerCase().includes(q) ||
      (a.locatie || '').toLowerCase().includes(q) ||
      (a.notitie || '').toLowerCase().includes(q) ||
      (AGENDA_TYPES[a.type]?.label || '').toLowerCase().includes(q)
    );
  }

  // Sorteer: komend = oplopend, verlopen = aflopend
  if (_agendaFilter === 'verlopen') {
    items.sort((a, b) => b.datum.localeCompare(a.datum) || (b.beginTijd || '').localeCompare(a.beginTijd || ''));
  } else {
    items.sort((a, b) => a.datum.localeCompare(b.datum) || (a.beginTijd || '').localeCompare(b.beginTijd || ''));
  }

  // Groepeer op datum
  const grouped = {};
  for (const item of items) {
    if (!grouped[item.datum]) grouped[item.datum] = [];
    grouped[item.datum].push(item);
  }

  const filterBtn = (val, label) => `<button class="btn btn-sm ${_agendaFilter === val ? 'btn-primary' : 'btn-secondary'}" onclick="filterAgenda('${val}')">${label}</button>`;

  return `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap">
      <div class="search-wrap" style="flex:1;min-width:200px">
        <span class="search-icon">${svgIcon('search', 15)}</span>
        <input id="search-agenda" type="text" placeholder="Zoek in agenda…" value="${esc(_agendaSearch)}" oninput="searchAgenda(this.value)" style="padding-left:34px"/>
      </div>
      <div style="display:flex;gap:6px">
        ${filterBtn('komend', 'Komend')}
        ${filterBtn('alles', 'Alles')}
        ${filterBtn('verlopen', 'Verlopen')}
      </div>
      <button class="btn btn-primary" onclick="openAgendaModal()">
        ${svgIcon('add', 15)} Nieuwe afspraak
      </button>
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

// ── Agenda modal ─────────────────────────────────────────────────
function openAgendaModal(id = '') {
  const a = id ? DB.agenda.find(x => x.id === id) : null;

  const schoolOpts  = DB.scholen.map(s  => `<option value="${s.id}"${a?.schoolId === s.id ? ' selected' : ''}>${esc(s.naam)}</option>`).join('');
  const contactOpts = DB.contacten.map(c => `<option value="${c.id}"${a?.contactId === c.id ? ' selected' : ''}>${esc(c.naam)}${c.functie ? ` (${esc(c.functie)})` : ''}</option>`).join('');
  const bestuurOpts = DB.besturen.map(b  => `<option value="${b.id}"${a?.bestuurId === b.id ? ' selected' : ''}>${esc(b.naam)}</option>`).join('');

  const typeSelect = Object.entries(AGENDA_TYPES).map(([val, { label }]) =>
    `<option value="${val}"${(a?.type || 'afspraak') === val ? ' selected' : ''}>${esc(label)}</option>`
  ).join('');

  showModal(a ? 'Afspraak bewerken' : 'Nieuwe afspraak',
    `<div class="form-group"><label>Titel *</label><input type="text" id="f-titel" value="${esc(a?.titel || '')}" placeholder="Bijv. Intakegesprek school X"/></div>
     <div class="form-row">
       <div class="form-group"><label>Datum *</label><input type="date" id="f-datum" value="${esc(a?.datum || new Date().toISOString().slice(0, 10))}"/></div>
       <div class="form-group"><label>Type</label><select id="f-type">${typeSelect}</select></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label>Begintijd</label><input type="time" id="f-begintijd" value="${esc(a?.beginTijd || '')}"/></div>
       <div class="form-group"><label>Eindtijd</label><input type="time" id="f-eindtijd" value="${esc(a?.eindTijd || '')}"/></div>
     </div>
     <div class="form-group"><label>Locatie</label><input type="text" id="f-locatie" value="${esc(a?.locatie || '')}" placeholder="Adres of online"/></div>
     <div class="form-row">
       <div class="form-group"><label>School</label><select id="f-school"><option value="">— Geen —</option>${schoolOpts}</select></div>
       <div class="form-group"><label>Bestuur</label><select id="f-bestuur"><option value="">— Geen —</option>${bestuurOpts}</select></div>
     </div>
     <div class="form-group"><label>Contactpersoon</label><select id="f-contact"><option value="">— Geen —</option>${contactOpts}</select></div>
     <div class="form-group"><label>Notitie</label><textarea id="f-notitie" rows="3" placeholder="Extra informatie…">${esc(a?.notitie || '')}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${a ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delAgenda('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveAgenda('${id}')">${a ? 'Opslaan' : 'Toevoegen'}</button>`);
}
