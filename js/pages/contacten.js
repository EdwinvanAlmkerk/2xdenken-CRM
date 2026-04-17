// ════════════════════════════════════════════════════════════════
// CONTACTEN
// ════════════════════════════════════════════════════════════════
let _contactenSearch  = '';
let _contactenSortCol = 'naam';
let _contactenSortDir = 'asc';

function sortContacten(col) {
  if (_contactenSortCol === col) { _contactenSortDir = _contactenSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _contactenSortCol = col; _contactenSortDir = 'asc'; }
  renderContent();
}

function searchContacten(v) { _contactenSearch = v; smartRender(() => renderContacten(v)); }

function renderContacten(search = '') {
  const thStyle = `cursor:pointer;user-select:none;white-space:nowrap;`;
  const arrow = col => _contactenSortCol !== col
    ? `<span style="opacity:.25;margin-left:4px;font-size:10px">⇅</span>`
    : _contactenSortDir === 'asc'
      ? `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▲</span>`
      : `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▼</span>`;
  const th = (col, label) => `<th style="${thStyle}" onclick="sortContacten('${col}')">${label}${arrow(col)}</th>`;

  let filtered = DB.contacten.filter(c =>
    c.naam.toLowerCase().includes(search.toLowerCase()) ||
    (c.functie || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()));
  const dir = _contactenSortDir === 'asc' ? 1 : -1;
  filtered = [...filtered].sort((a, b) => {
    const sa = DB.scholen.find(x => x.id === a.schoolId);
    const sb = DB.scholen.find(x => x.id === b.schoolId);
    if (_contactenSortCol === 'naam')    return dir * a.naam.localeCompare(b.naam, 'nl');
    if (_contactenSortCol === 'functie') return dir * (a.functie || '').localeCompare(b.functie || '', 'nl');
    if (_contactenSortCol === 'type')    return dir * (a.type || '').localeCompare(b.type || '', 'nl');
    if (_contactenSortCol === 'school')  return dir * (sa?.naam || '').localeCompare(sb?.naam || '', 'nl');
    return 0;
  });

  return `
    <div style="margin-bottom:20px">
      <div class="search-wrap">
        <span class="search-icon">${svgIcon('search', 15)}</span>
        <input id="search-contacten" type="text" placeholder="Zoek contactpersoon, functie of e-mail…" value="${esc(search)}" oninput="searchContacten(this.value)" style="padding-left:34px"/>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>${th('naam', 'Naam')}${th('functie', 'Functie')}${th('type', 'Type')}${th('school', 'School')}<th>E-mail</th><th>Telefoon</th><th style="width:80px"></th></tr></thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="7"><div class="empty-state"><p>Geen contacten gevonden</p></div></td></tr>`
              : filtered.map(c => {
                  const s = DB.scholen.find(x => x.id === c.schoolId);
                  return `<tr class="clickable-row" onclick="navigateToContact('${s?.id || ''}','${c.id}')">
                    <td style="font-weight:500">${esc(c.naam)}</td>
                    <td>${esc(c.functie || '—')}</td>
                    <td>${badge(c.type)}</td>
                    <td style="font-size:13px;color:var(--ink3)">${esc(s?.naam || '—')}</td>
                    <td>${c.email ? `<a href="mailto:${esc(c.email)}" onclick="event.stopPropagation()" style="color:var(--blue);font-size:13px">${esc(c.email)}</a>` : '—'}</td>
                    <td style="font-size:13px;color:var(--ink3)">${esc(c.telefoon || '—')}</td>
                    <td onclick="event.stopPropagation()" style="width:50px">
                      <div class="row-actions">
                        <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delContact('${c.id}','${s?.id || ''}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Contact detail pagina ──────────────────────────────────────────────
function renderContactDetail(schoolId, contactId) {
  const c = DB.contacten.find(x => x.id === contactId);
  if (!c) return '<p>Contactpersoon niet gevonden</p>';
  const s = DB.scholen.find(x => x.id === c.schoolId);
  const best = s ? DB.besturen.find(b => b.id === s.bestuurId) : null;
  const dossiers = [...DB.dossiers.filter(d => d.contactId === contactId)].sort((a, b) => new Date(b.datum) - new Date(a.datum));
  const facturen = DB.facturen.filter(f => f.contactId === contactId);
  const agendaItems = DB.agenda.filter(a => a.contactId === contactId).sort((a, b) => a.datum.localeCompare(b.datum) || (a.beginTijd || '').localeCompare(b.beginTijd || ''));
  const vandaag = new Date().toISOString().slice(0, 10);
  const komendeAfspraken = agendaItems.filter(a => a.datum >= vandaag);
  const uitvoeringen = [...(DB.uitvoeringen || []).filter(u => u.contactId === contactId)].sort((a, b) => new Date(b.datum) - new Date(a.datum));

  return `
    <div class="breadcrumb">
      <a onclick="navigate('contacten')">Contacten</a>
      ${svgIcon('chevron', 14)}
      <span>${esc(c.naam)}</span>
    </div>
    <div class="detail-header">
      <div>
        <div class="detail-title">${esc(c.naam)}</div>
        <div class="detail-subtitle">${esc(c.functie || 'Geen functie opgegeven')}</div>
        <div class="detail-meta">
          ${s ? `<span class="meta-item">${svgIcon('school', 15)} <a onclick="navigate('school-detail','${s.id}')" style="cursor:pointer;color:var(--blue)">${esc(s.naam)}</a></span>` : ''}
          ${best ? `<span class="meta-item">${svgIcon('board', 15)} <a onclick="navigate('bestuur-detail','${best.id}')" style="cursor:pointer;color:var(--blue)">${esc(best.naam)}</a></span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        ${c.email ? `<button class="btn btn-primary" onclick="openEmailModal({contactId:'${contactId}',schoolId:'${c.schoolId}'})">${svgIcon('mail', 15)} E-mail sturen</button>` : ''}
        <button class="btn btn-secondary" onclick="openContactModal('${schoolId}','${contactId}')">${svgIcon('edit', 15)} Bewerken</button>
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3>Contactgegevens</h3></div>
        <div class="card-body">
          <table style="width:100%">
            <tbody>
              ${[['Naam', c.naam], ['Functie', c.functie], ['Type', badge(c.type)], ['E-mail', c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : null], ['Telefoon', c.telefoon]].filter(([, v]) => v).map(([k, v]) => `<tr><td style="color:var(--ink3);font-size:12px;padding-right:16px;padding-bottom:8px;vertical-align:top;white-space:nowrap">${k}</td><td style="font-size:14px;padding-bottom:8px">${v}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Snel overzicht</h3></div>
        <div class="card-body">
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            ${[['Dossiernotities', dossiers.length], ['Afspraken', komendeAfspraken.length], ['Facturen', facturen.length], ['Trainingen', uitvoeringen.length]].map(([l, n]) => `
              <div style="background:var(--bg);border-radius:8px;padding:14px 18px;flex:1;min-width:80px">
                <div style="font-size:24px;font-weight:800">${n}</div>
                <div style="font-size:12px;color:var(--navy4);margin-top:2px">${l}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <h3>${svgIcon('calendar', 16)} Agenda</h3>
        <button class="btn btn-primary btn-sm" onclick="openAgendaModal('','','${schoolId}','${contactId}')">${svgIcon('add', 14)} Afspraak plannen</button>
      </div>
      <div class="card-body"${agendaItems.length > 0 ? ' style="padding:0"' : ''}>
        ${agendaItems.length === 0
          ? `<div class="empty-state">${svgIcon('calendar', 36)}<p>Nog geen afspraken</p></div>`
          : `<table><tbody>${agendaItems.map(a => renderAgendaRow(a)).join('')}</tbody></table>`}
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <h3>${svgIcon('training', 16)} Trainingen & methodes</h3>
        ${c.schoolId ? `<button class="btn btn-primary btn-sm" onclick="openUitvoeringVanContactModal('${c.schoolId}','${contactId}')">${svgIcon('add', 14)} Uitvoering vastleggen</button>` : ''}
      </div>
      <div class="card-body"${uitvoeringen.length > 0 ? ' style="padding:0"' : ''}>
        ${uitvoeringen.length === 0
          ? `<div class="empty-state">${svgIcon('training', 36)}<p>Nog geen trainingen uitgevoerd met deze contactpersoon</p></div>`
          : `<table>
               <thead><tr><th>Training</th><th>Datum</th><th>Deelnemers</th><th>Score</th></tr></thead>
               <tbody>
                 ${uitvoeringen.map(u => {
                   const t = DB.trainingen.find(x => x.id === u.trainingId);
                   return `<tr class="clickable-row" onclick="navigate('training-detail','${u.trainingId}')">
                     <td style="font-weight:500">${esc(t?.naam || '–')}${t?.categorie ? ' ' + catBadge(t.categorie) : ''}</td>
                     <td>${fmtDateShort(u.datum)}</td>
                     <td>${u.deelnemers || '–'}</td>
                     <td>${u.score ? renderStars(u.score) : '–'}</td>
                   </tr>`;
                 }).join('')}
               </tbody>
             </table>`}
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Dossier</h3>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="openBestandModalContact('${schoolId}','${contactId}')">${svgIcon('add', 14)} Bestand</button>
          <button class="btn btn-primary btn-sm" onclick="openDossierModalContact('${schoolId}','${contactId}')">${svgIcon('add', 14)} Notitie</button>
        </div>
      </div>
      <div class="card-body">
        ${dossiers.length === 0
          ? `<div class="empty-state">${svgIcon('note', 36)}<p>Nog geen dossiernotities</p></div>`
          : `<div class="dossier-list">${dossiers.map(d => renderDossierItem(d, { delBtn: 'delDossier', delArg: schoolId })).join('')}</div>`}
      </div>
    </div>`;
}
