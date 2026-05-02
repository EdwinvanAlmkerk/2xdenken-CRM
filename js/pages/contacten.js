// ════════════════════════════════════════════════════════════════
// CONTACTEN
// ════════════════════════════════════════════════════════════════
let _contactenSearch  = '';
let _contactenSortCol = 'naam';
let _contactenSortDir = 'asc';
let _contactenPage    = 1;

function sortContacten(col) {
  if (_contactenSortCol === col) { _contactenSortDir = _contactenSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _contactenSortCol = col; _contactenSortDir = 'asc'; }
  _contactenPage = 1;
  renderContent();
}

function gotoContactenPage(p) { _contactenPage = p; smartRender(() => renderContacten(_contactenSearch)); }

const _renderContactenDeb = debounce(() => smartRender(() => renderContacten(_contactenSearch)), 140);
function searchContacten(v) { _contactenSearch = v; _contactenPage = 1; _renderContactenDeb(); }

function renderContacten(search = '') {
  const thStyle = `cursor:pointer;user-select:none;white-space:nowrap;`;
  const arrow = col => _contactenSortCol !== col
    ? `<span style="opacity:.25;margin-left:4px;font-size:10px">⇅</span>`
    : _contactenSortDir === 'asc'
      ? `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▲</span>`
      : `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▼</span>`;
  const th = (col, label) => `<th style="${thStyle}" onclick="sortContacten('${col}')">${label}${arrow(col)}</th>`;

  const q = search.toLowerCase();
  let filtered = DB.contacten.filter(c =>
    !q ||
    c.naam.toLowerCase().includes(q) ||
    (c.functie || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q));
  const dir = _contactenSortDir === 'asc' ? 1 : -1;
  filtered = [...filtered].sort((a, b) => {
    const sa = getSchool(a.schoolId);
    const sb = getSchool(b.schoolId);
    if (_contactenSortCol === 'naam')    return dir * a.naam.localeCompare(b.naam, 'nl');
    if (_contactenSortCol === 'functie') return dir * (a.functie || '').localeCompare(b.functie || '', 'nl');
    if (_contactenSortCol === 'type')    return dir * (a.type || '').localeCompare(b.type || '', 'nl');
    if (_contactenSortCol === 'school')  return dir * (sa?.naam || '').localeCompare(sb?.naam || '', 'nl');
    return 0;
  });

  const pageInfo = paginate(filtered, _contactenPage);
  const pageSlice = pageInfo.slice;

  return `
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div class="search-wrap" style="flex:1">
        <span class="search-icon">${svgIcon('search', 15)}</span>
        <input id="search-contacten" type="text" placeholder="Zoek contactpersoon, functie of e-mail…" value="${esc(search)}" oninput="searchContacten(this.value)" style="padding-left:34px"/>
      </div>
      <button class="btn btn-secondary" onclick="exportContactenExcel()" style="border-color:var(--groen);color:var(--groen);font-weight:700">${svgIcon('download', 15)} Excel export</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>${th('naam', 'Naam')}${th('functie', 'Functie')}${th('type', 'Type')}${th('school', 'School')}<th>E-mail</th><th>Telefoon</th><th style="width:80px"></th></tr></thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="7"><div class="empty-state"><p>Geen contacten gevonden</p></div></td></tr>`
              : pageSlice.map(c => {
                  const s = getSchool(c.schoolId);
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
      ${renderPagination(pageInfo, 'gotoContactenPage')}
    </div>`;
}

function exportContactenExcel() {
  const q = (_contactenSearch || '').toLowerCase();
  const filtered = DB.contacten
    .filter(c => !q
      || c.naam.toLowerCase().includes(q)
      || (c.functie || '').toLowerCase().includes(q)
      || (c.email || '').toLowerCase().includes(q))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));

  const Q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const titel = 'Contactenoverzicht 2xDenken';
  const typeNL = { beslisser: 'Beslisser', beinvloeder: 'Beïnvloeder' };

  const rows = [
    [Q(titel), '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    [Q('Naam'), Q('Functie'), Q('Type'), Q('E-mail'), Q('Telefoon'), Q('School'), Q('Plaats'), Q('Bestuur')],
    ...filtered.map(c => {
      const s = getSchool(c.schoolId);
      const b = s ? getBestuur(s.bestuurId) : null;
      return [
        Q(c.naam),
        Q(c.functie),
        Q(typeNL[c.type] || c.type || ''),
        Q(c.email),
        Q(c.telefoon),
        Q(s?.naam || ''),
        Q(s?.plaats || ''),
        Q(b?.naam || ''),
      ];
    }),
    ['', '', '', '', '', '', '', ''],
    [Q(`Geëxporteerd op: ${new Date().toLocaleDateString('nl-NL')} | Aantal contacten: ${filtered.length}`), '', '', '', '', '', '', ''],
  ];

  const csv  = '\uFEFF' + rows.map(r => r.join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `2xDenken_contacten.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Contact detail pagina ──────────────────────────────────────────────
function renderContactDetail(schoolId, contactId) {
  const c = getContact(contactId);
  if (!c) return '<p>Contactpersoon niet gevonden</p>';
  const s = getSchool(c.schoolId);
  const best = s ? getBestuur(s.bestuurId) : null;
  const dossiers = dossiersVanContact(contactId).filter(d => !isFactuurDossier(d)).sort((a, b) => new Date(b.datum) - new Date(a.datum));
  const facturen = facturenVanContact(contactId);
  const agendaItems = [...agendaVanContact(contactId)].sort((a, b) => a.datum.localeCompare(b.datum) || (a.beginTijd || '').localeCompare(b.beginTijd || ''));
  const vandaag = new Date().toISOString().slice(0, 10);
  const komendeAfspraken = agendaItems.filter(a => a.datum >= vandaag);
  const verlopenAfspraken = agendaItems.filter(a => a.datum < vandaag);
  const uitvoeringen = [...uitvoeringenVanContact(contactId)].sort((a, b) => new Date(b.datum) - new Date(a.datum));

  const tabs = [
    ['info', 'Overzicht'],
    ['agenda', 'Agenda'],
    ['trainingen', 'Trainingen'],
    ['dossier', 'Dossier'],
  ];
  let tabContent = '';

  if (contactTab === 'info') {
    tabContent = `
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3>Contactgegevens</h3>
            <button class="btn btn-ghost btn-sm" onclick="openContactModal('${schoolId}','${contactId}')">${svgIcon('edit', 14)} Bewerken</button>
          </div>
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
              ${[['Dossiernotities', dossiers.length, 'dossier'], ['Afspraken', komendeAfspraken.length, 'agenda'], ['Facturen', facturen.length, null], ['Trainingen', uitvoeringen.length, 'trainingen']].map(([l, n, tab]) => `
                <div${tab ? ` onclick="setContactTab('${schoolId}','${contactId}','${tab}')" style="cursor:pointer;background:var(--bg);border-radius:8px;padding:14px 18px;flex:1;min-width:80px;transition:background .12s" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='var(--bg)'"` : ` style="background:var(--bg);border-radius:8px;padding:14px 18px;flex:1;min-width:80px"`}>
                  <div style="font-size:24px;font-weight:800">${n}</div>
                  <div style="font-size:12px;color:var(--navy4);margin-top:2px">${l}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  } else if (contactTab === 'agenda') {
    tabContent = `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="openAgendaModal('','','${schoolId}','${contactId}')">${svgIcon('calendar')} Afspraak plannen</button>
      </div>
      ${agendaItems.length === 0
        ? `<div class="card"><div class="empty-state">${svgIcon('calendar', 36)}<p>Nog geen afspraken voor deze contactpersoon</p></div></div>`
        : `${komendeAfspraken.length > 0 ? `<div class="card" style="margin-bottom:16px">
            <div class="card-header"><h3 style="color:var(--s-blauw)">${svgIcon('calendar', 16)} Komende afspraken</h3></div>
            <div class="card-body" style="padding:0"><table><tbody>
              ${komendeAfspraken.map(a => renderAgendaRow(a)).join('')}
            </tbody></table></div>
          </div>` : ''}
          ${verlopenAfspraken.length > 0 ? `<div class="card">
            <div class="card-header"><h3 style="color:var(--navy4)">${svgIcon('clock', 16)} Verlopen afspraken</h3></div>
            <div class="card-body" style="padding:0"><table><tbody>
              ${verlopenAfspraken.map(a => renderAgendaRow(a)).join('')}
            </tbody></table></div>
          </div>` : ''}`}`;
  } else if (contactTab === 'trainingen') {
    tabContent = `
      ${c.schoolId ? `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="openUitvoeringVanContactModal('${c.schoolId}','${contactId}')">${svgIcon('add', 14)} Uitvoering vastleggen</button>
      </div>` : ''}
      ${uitvoeringen.length === 0
        ? `<div class="card"><div class="empty-state">${svgIcon('training', 36)}<p>Nog geen trainingen uitgevoerd met deze contactpersoon</p></div></div>`
        : `<div class="card"><div class="card-body" style="padding:0"><table>
             <thead><tr><th>Training</th><th>Datum</th><th>Deelnemers</th><th>Score</th></tr></thead>
             <tbody>
               ${uitvoeringen.map(u => {
                 const t = getTraining(u.trainingId);
                 return `<tr class="clickable-row" onclick="navigate('training-detail','${u.trainingId}')">
                   <td style="font-weight:500">${esc(t?.naam || '–')}${t?.type ? ' ' + typeBadge(t.type) : ''}${t?.categorie ? ' ' + catBadge(t.categorie) : ''}</td>
                   <td>${fmtDateShort(u.datum)}</td>
                   <td>${u.deelnemers || '–'}</td>
                   <td>${u.score ? renderStars(u.score) : '–'}</td>
                 </tr>`;
               }).join('')}
             </tbody>
           </table></div></div>`}`;
  } else if (contactTab === 'dossier') {
    tabContent = `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn btn-secondary" onclick="openBestandModalContact('${schoolId}','${contactId}')">${svgIcon('add', 14)} Bestand toevoegen</button>
        <button class="btn btn-primary" onclick="openDossierModalContact('${schoolId}','${contactId}')">${svgIcon('add', 14)} Notitie toevoegen</button>
      </div>
      ${dossiers.length === 0
        ? `<div class="card"><div class="empty-state">${svgIcon('note', 36)}<p>Nog geen dossiernotities</p></div></div>`
        : `<div class="dossier-list">${dossiers.map(d => renderDossierItem(d, { delBtn: 'delDossier', delArg: schoolId })).join('')}</div>`}`;
  }

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
    <div class="tabs">
      ${tabs.map(([k, l]) => `<div class="tab${contactTab === k ? ' active' : ''}" onclick="setContactTab('${schoolId}','${contactId}','${k}')">${l}</div>`).join('')}
    </div>
    ${tabContent}`;
}
