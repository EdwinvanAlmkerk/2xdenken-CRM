// ════════════════════════════════════════════════════════════════
// SCHOLEN
// ════════════════════════════════════════════════════════════════
let _scholenSearch  = '';
let _scholenSortCol = 'naam';
let _scholenSortDir = 'asc';
let _scholenPage    = 1;

function sortScholen(col) {
  if (_scholenSortCol === col) { _scholenSortDir = _scholenSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _scholenSortCol = col; _scholenSortDir = 'asc'; }
  _scholenPage = 1;
  renderContent();
}

function gotoScholenPage(p) { _scholenPage = p; smartRender(() => renderScholen(_scholenSearch)); }

const _renderScholenDeb = debounce(() => smartRender(() => renderScholen(_scholenSearch)), 140);
function searchScholen(v) { _scholenSearch = v; _scholenPage = 1; _renderScholenDeb(); }

function renderScholen(search = '') {
  const thStyle = `cursor:pointer;user-select:none;white-space:nowrap;`;
  const arrow = col => _scholenSortCol !== col
    ? `<span style="opacity:.25;margin-left:4px;font-size:10px">⇅</span>`
    : _scholenSortDir === 'asc'
      ? `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▲</span>`
      : `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▼</span>`;
  const th = (col, label, extra = '') => `<th style="${thStyle}${extra}" onclick="sortScholen('${col}')">${label}${arrow(col)}</th>`;

  const q = search.toLowerCase();
  let filtered = DB.scholen.filter(s =>
    !q ||
    s.naam.toLowerCase().includes(q) ||
    (s.plaats || '').toLowerCase().includes(q));
  const dir = _scholenSortDir === 'asc' ? 1 : -1;
  filtered = [...filtered].sort((a, b) => {
    const ba = getBestuur(a.bestuurId);
    const bb = getBestuur(b.bestuurId);
    if (_scholenSortCol === 'naam')      return dir * a.naam.localeCompare(b.naam, 'nl');
    if (_scholenSortCol === 'bestuur')   return dir * (ba?.naam || '').localeCompare(bb?.naam || '', 'nl');
    if (_scholenSortCol === 'plaats')    return dir * (a.plaats || '').localeCompare(b.plaats || '', 'nl');
    if (_scholenSortCol === 'contacten') return dir * (contactenVanSchool(a.id).length - contactenVanSchool(b.id).length);
    return 0;
  });

  const pageInfo = paginate(filtered, _scholenPage);
  const pageSlice = pageInfo.slice;

  return `
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div class="search-wrap" style="flex:1">
        <span class="search-icon">${svgIcon('search', 15)}</span>
        <input id="search-scholen" type="text" placeholder="Zoek school of plaats…" value="${esc(search)}" oninput="searchScholen(this.value)" style="padding-left:34px"/>
      </div>
      <button class="btn btn-secondary" onclick="exportScholenExcel()" style="border-color:var(--groen);color:var(--groen);font-weight:700">${svgIcon('download', 15)} Excel export</button>
      <button class="btn btn-primary" onclick="openSchoolModal()">${svgIcon('add')} Nieuwe school</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>${th('naam', 'School')}${th('bestuur', 'Bestuur')}${th('plaats', 'Plaats')}${th('contacten', 'Contacten')}<th></th></tr></thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="5"><div class="empty-state"><p>Geen scholen gevonden</p></div></td></tr>`
              : pageSlice.map(s => {
                  const best = getBestuur(s.bestuurId);
                  const nc = contactenVanSchool(s.id).length;
                  return `<tr class="clickable-row" onclick="navigate('school-detail','${s.id}')">
                    <td style="font-weight:500">${esc(s.naam)}</td>
                    <td style="font-size:13px;color:var(--ink3)">${esc(best?.naam || '–')}</td>
                    <td>${esc(s.plaats || '–')}</td>
                    <td style="color:var(--ink3);font-size:13px">${nc}</td>
                    <td onclick="event.stopPropagation()" style="width:50px">
                      <div class="row-actions">
                        <button class="btn btn-ghost btn-icon btn-sm btn-del" title="Verwijderen" onclick="delSchool('${s.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(pageInfo, 'gotoScholenPage')}
    </div>`;
}

function exportScholenExcel() {
  const q = (_scholenSearch || '').toLowerCase();
  const filtered = DB.scholen
    .filter(s => !q || s.naam.toLowerCase().includes(q) || (s.plaats || '').toLowerCase().includes(q))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));

  const Q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const titel = 'Scholenoverzicht 2xDenken';

  const rows = [
    [Q(titel), '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    [Q('Naam school'), Q('Bestuur'), Q('Debiteurnummer'), Q('Adres'), Q('Postcode'), Q('Plaats'), Q('Website'), Q('Aantal contacten'), Q('Aantal facturen')],
    ...filtered.map(s => {
      const best = getBestuur(s.bestuurId);
      return [
        Q(s.naam),
        Q(best?.naam || ''),
        Q(s.debiteurnr),
        Q(s.adres),
        Q(s.postcode),
        Q(s.plaats),
        Q(s.website),
        contactenVanSchool(s.id).length,
        facturenVanSchool(s.id).length,
      ];
    }),
    ['', '', '', '', '', '', '', '', ''],
    [Q(`Geëxporteerd op: ${new Date().toLocaleDateString('nl-NL')} | Aantal scholen: ${filtered.length}`), '', '', '', '', '', '', '', ''],
  ];

  const csv  = '\uFEFF' + rows.map(r => r.join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `2xDenken_scholen.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openSchoolModal(id = '', defaultBestuurId = '') {
  const s = getSchool(id);
  const huidigBestuurId = s?.bestuurId || defaultBestuurId || '';
  const opts = DB.besturen.map(b => `<option value="${b.id}"${huidigBestuurId === b.id ? ' selected' : ''}>${esc(b.naam)}</option>`).join('');
  const debnrPrefill = s?.debiteurnr || (s ? '' : nextDebiteurnr());
  showModal(s ? 'School bewerken' : 'Nieuwe school',
    `<div class="form-group"><label>Naam school *</label><input type="text" id="f-naam" value="${esc(s?.naam || '')}" placeholder="OBS De Regenboog"/></div>
     <div class="form-row">
       <div class="form-group"><label>Debiteurnummer</label><input type="text" id="f-debnr-school" value="${esc(debnrPrefill)}" placeholder="DB01"/></div>
       <div class="form-group"><label>Bestuur</label><select id="f-best"><option value="">— Geen bestuur —</option>${opts}</select></div>
     </div>
     <div class="form-group"><label>Adres</label><input type="text" id="f-adres" value="${esc(s?.adres || '')}" placeholder="Straatnaam 1"/></div>
     <div class="form-row">
       <div class="form-group"><label>Postcode</label><input type="text" id="f-pc" value="${esc(s?.postcode || '')}" placeholder="1234 AB"/></div>
       <div class="form-group"><label>Plaats</label><input type="text" id="f-plaats" value="${esc(s?.plaats || '')}" placeholder="Amsterdam"/></div>
     </div>
     <div class="form-group"><label>Website</label><input type="url" id="f-web" value="${esc(s?.website || '')}" placeholder="https://…"/></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${s ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delSchool('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveSchool('${id}')">Opslaan</button>`);
}

function renderSchoolDetail(id) {
  const s = getSchool(id);
  if (!s) return '<p>Niet gevonden</p>';
  const best      = getBestuur(s.bestuurId);
  const contacten = contactenVanSchool(id);
  const dossiers  = dossiersVanSchool(id).filter(d => !isFactuurDossier(d)).sort((a, b) => new Date(b.datum) - new Date(a.datum));
  const facturen  = facturenVanSchool(id);
  const adresStr  = [s.adres, s.postcode, s.plaats].filter(Boolean).join(', ');

  const tabs = [['info', 'Overzicht'], ['contacten', 'Contacten'], ['dossier', 'Dossier'], ['agenda', 'Agenda'], ['trainingen', 'Trainingen'], ['facturen', 'Facturen']];
  let tabContent = '';

  if (schoolTab === 'info') {
    tabContent = `
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3>Schoolgegevens</h3><button class="btn btn-ghost btn-sm" onclick="openSchoolModal('${id}')">${svgIcon('edit', 14)} Bewerken</button></div>
          <div class="card-body">
            <table style="width:100%">
              <tbody>
                ${[['Naam', s.naam], ['Debiteurnummer', s.debiteurnr], ['Bestuur', best ? `<a onclick="navigate('bestuur-detail','${best.id}')" style="color:var(--blue);cursor:pointer">${esc(best.naam)}</a>` : `<span style="color:var(--ink4);font-style:italic">Niet ingesteld</span>`], ['Adres', s.adres], ['Postcode', s.postcode], ['Plaats', s.plaats], ['Website', s.website ? `<a href="${esc(s.website)}" target="_blank" style="color:var(--blue)">${esc(s.website)}</a>` : null]].filter(([, v]) => v).map(([k, v]) => `<tr><td style="color:var(--ink3);font-size:12px;padding-right:16px;padding-bottom:8px;vertical-align:top;white-space:nowrap">${k}</td><td style="font-size:14px;padding-bottom:8px">${v}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Snel overzicht</h3></div>
          <div class="card-body">
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              ${[['Contacten', contacten.length], ['Notities', dossiers.length], ['Facturen', facturen.length]].map(([l, n]) => `
                <div style="background:var(--bg);border-radius:8px;padding:14px 18px;flex:1;min-width:80px">
                  <div style="font-size:24px;font-weight:800">${n}</div>
                  <div style="font-size:12px;color:var(--navy4);margin-top:2px">${l}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  } else if (schoolTab === 'contacten') {
    tabContent = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-primary" onclick="openContactModal('${id}')">${svgIcon('add')} Contactpersoon toevoegen</button>
      </div>
      ${contacten.length === 0
        ? `<div class="card"><div class="empty-state">${svgIcon('contact', 36)}<p>Nog geen contactpersonen</p></div></div>`
        : `<div class="grid-2">${contacten.map(c => `
            <div class="contact-card">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <div class="contact-name" onclick="navigateToContact('${id}','${c.id}')" style="cursor:pointer" title="Open contactpersoon">${esc(c.naam)}</div>
                  <div class="contact-role">${esc(c.functie || '')}</div>
                  ${badge(c.type)}
                </div>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-icon btn-sm" onclick="openContactModal('${id}','${c.id}')">${svgIcon('edit', 14)}</button>
                  <button class="btn btn-ghost btn-icon btn-sm" onclick="delContact('${c.id}','${id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                </div>
              </div>
              <div class="divider"></div>
              <div class="c-info">
                ${c.email ? `<div class="c-row">${svgIcon('mail', 13)} <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : ''}
                ${c.telefoon ? `<div class="c-row">${svgIcon('phone', 13)} <a href="tel:${esc(c.telefoon)}">${esc(c.telefoon)}</a></div>` : ''}
              </div>
              ${(() => {
                const cDossiers = dossiersVanContact(c.id).filter(d => !isFactuurDossier(d) && !isInboxLogged(d)).sort((a, b) => new Date(b.datum) - new Date(a.datum));
                return cDossiers.length > 0 ? `
                  <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bg3)">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--navy4);margin-bottom:8px">Dossiernotities</div>
                    <div style="display:flex;flex-direction:column;gap:8px">
                      ${cDossiers.map(d => {
                        const isInbox = typeof d.id === 'string' && d.id.startsWith('inbox-');
                        const delHandler = isInbox
                          ? `unlinkInboxDossier('${d.id}')`
                          : `delDossier('${d.id}','${id}')`;
                        const delTitle = isInbox ? 'Ontkoppel deze e-mail uit het dossier' : 'Notitie verwijderen';
                        return `
                        <div style="background:var(--bg);border-radius:6px;padding:9px 12px;border-left:3px solid ${isInbox ? 'var(--accent2)' : 'var(--navy3)'}">
                          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px">
                            <span style="font-size:11px;color:var(--navy4)">${isInbox ? '📧 ' : ''}${fmtDate(d.datum)}</span>
                            <button class="btn btn-ghost btn-icon btn-sm" title="${delTitle}" onclick="${delHandler}" style="padding:2px">${svgIcon('trash', 12)}</button>
                          </div>
                          <div style="font-size:13px;color:var(--navy2);line-height:1.5;white-space:pre-wrap">${esc(d.tekst)}</div>
                          ${renderBijlagen(d, id)}
                        </div>`;
                      }).join('')}
                    </div>
                  </div>` : '';
              })()}
              <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bg3);display:flex;gap:6px;flex-wrap:wrap">
                <button class="btn btn-secondary btn-sm" style="flex:1;justify-content:center" onclick="openDossierModalContact('${id}','${c.id}')">${svgIcon('note', 14)} Notitie</button>
                <button class="btn btn-secondary btn-sm" style="flex:1;justify-content:center" onclick="openBestandModalContact('${id}','${c.id}')">${svgIcon('add', 14)} Bestand</button>
                <button class="btn btn-secondary btn-sm" style="flex:1;justify-content:center" onclick="openFactuurModal('${id}','','${c.id}')">${svgIcon('invoice', 14)} Factuur</button>
                <button class="btn btn-secondary btn-sm" style="flex:1;justify-content:center" onclick="openAgendaModal('','','${id}','${c.id}')">${svgIcon('calendar', 14)} Afspraak</button>
              </div>
            </div>`).join('')}</div>`}`;
  } else if (schoolTab === 'dossier') {
    tabContent = `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn btn-secondary" onclick="openBestandModal('${id}')">${svgIcon('add')} Bestand toevoegen</button>
        <button class="btn btn-primary" onclick="openDossierModal('${id}')">${svgIcon('add')} Notitie toevoegen</button>
      </div>
      ${dossiers.length === 0
        ? `<div class="card"><div class="empty-state">${svgIcon('note', 36)}<p>Nog geen dossiernotities</p></div></div>`
        : `<div class="dossier-list">${dossiers.map(d => renderDossierItem(d, { delBtn: 'delDossier', delArg: id })).join('')}</div>`}`;
  } else if (schoolTab === 'agenda') {
    const agendaItems = [...agendaVanSchool(id)].sort((a, b) => a.datum.localeCompare(b.datum) || (a.beginTijd || '').localeCompare(b.beginTijd || ''));
    const vandaag = new Date().toISOString().slice(0, 10);
    const komend = agendaItems.filter(a => a.datum >= vandaag);
    const verlopen = agendaItems.filter(a => a.datum < vandaag);
    tabContent = `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="openAgendaModal('','','${id}')">${svgIcon('calendar')} Afspraak plannen</button>
      </div>
      ${agendaItems.length === 0
        ? `<div class="card"><div class="empty-state">${svgIcon('calendar', 36)}<p>Nog geen afspraken voor deze school</p></div></div>`
        : `${komend.length > 0 ? `<div class="card" style="margin-bottom:16px">
            <div class="card-header"><h3 style="color:var(--s-blauw)">${svgIcon('calendar', 16)} Komende afspraken</h3></div>
            <div class="card-body" style="padding:0"><table><tbody>
              ${komend.map(a => renderAgendaRow(a)).join('')}
            </tbody></table></div>
          </div>` : ''}
          ${verlopen.length > 0 ? `<div class="card">
            <div class="card-header"><h3 style="color:var(--navy4)">${svgIcon('clock', 16)} Verlopen afspraken</h3></div>
            <div class="card-body" style="padding:0"><table><tbody>
              ${verlopen.map(a => renderAgendaRow(a)).join('')}
            </tbody></table></div>
          </div>` : ''}`}`;
  } else if (schoolTab === 'trainingen') {
    tabContent = renderSchoolTrainingenTab(id);
  } else if (schoolTab === 'facturen') {
    tabContent = renderFacturenTab(id);
  }

  return `
    <div class="breadcrumb">
      <a onclick="navigate('scholen')">Scholen</a>
      ${svgIcon('chevron', 14)}
      ${best ? `<a onclick="navigate('bestuur-detail','${best.id}')">${esc(best.naam)}</a>${svgIcon('chevron', 14)}` : ''}
      <span>${esc(s.naam)}</span>
    </div>
    <div class="detail-header">
      <div>
        <div class="detail-title">${esc(s.naam)}</div>
        ${best ? `<div class="detail-subtitle">Onderdeel van ${esc(best.naam)}</div>` : ''}
        <div class="detail-meta">
          ${adresStr ? `<span class="meta-item">${svgIcon('location', 15)} ${esc(adresStr)}</span>` : ''}
          ${s.website ? `<span class="meta-item">${svgIcon('web', 15)} <a href="${esc(s.website)}" target="_blank">${esc(s.website)}</a></span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="openEmailModal({schoolId:'${id}'})">${svgIcon('mail', 15)} E-mail sturen</button>
        <button class="btn btn-secondary" onclick="openSchoolModal('${id}')">${svgIcon('edit', 15)} Bewerken</button>
      </div>
    </div>
    <div class="tabs">
      ${tabs.map(([k, l]) => `<div class="tab${schoolTab === k ? ' active' : ''}" onclick="setSchoolTab('${id}','${k}')">${l}</div>`).join('')}
    </div>
    ${tabContent}`;
}

// ── School trainingen tab ─────────────────────────────────────────
function renderSchoolTrainingenTab(schoolId) {
  const uitv = [...uitvoeringenVanSchool(schoolId)].sort((a, b) => new Date(b.datum) - new Date(a.datum));
  const trainingOpts = DB.trainingen.map(t => `<option value="${t.id}">${esc(t.naam)}</option>`).join('');

  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button class="btn btn-primary" onclick="openUitvoeringVanSchoolModal('${schoolId}')">${svgIcon('add')} Uitvoering vastleggen</button>
    </div>
    ${uitv.length === 0
      ? `<div class="card"><div class="empty-state">${svgIcon('training', 36)}<p>Nog geen trainingen uitgevoerd</p></div></div>`
      : `<div class="card"><div class="table-wrap"><table>
           <thead><tr><th>Training</th><th>Contactpersoon</th><th>Datum</th><th>Deelnemers</th><th>Score</th><th></th></tr></thead>
           <tbody>
             ${uitv.map(u => {
               const t = getTraining(u.trainingId);
               const contact = getContact(u.contactId);
               return `<tr>
                 <td style="font-weight:500"><a onclick="navigate('training-detail','${u.trainingId}')" style="cursor:pointer;color:var(--navy)">${esc(t?.naam || '–')}</a></td>
                 <td style="font-size:13px;color:var(--ink3)">${contact ? `<a onclick="navigateToContact('${schoolId}','${contact.id}')" style="cursor:pointer;color:var(--blue)">${esc(contact.naam)}</a>` : '–'}</td>
                 <td>${fmtDateShort(u.datum)}</td>
                 <td>${u.deelnemers || '–'}</td>
                 <td>${u.score ? renderStars(u.score) : '–'}</td>
                 <td>
                   <div style="display:flex;gap:4px">
                     <button class="btn btn-ghost btn-icon btn-sm" onclick="openUitvoeringModal('${u.trainingId}','${u.id}')">${svgIcon('edit', 14)}</button>
                     <button class="btn btn-ghost btn-icon btn-sm" onclick="delUitvoering('${u.id}','${u.trainingId}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                   </div>
                 </td>
               </tr>`;
             }).join('')}
           </tbody>
         </table></div></div>`}`;
}

function openUitvoeringVanContactModal(schoolId, contactId) {
  openUitvoeringVanSchoolModal(schoolId, contactId);
}

function openUitvoeringVanSchoolModal(schoolId, preselectContactId = '') {
  _uitvScore = 0;
  const trainingOpts = DB.trainingen.map(t => `<option value="${t.id}">${esc(t.naam)}</option>`).join('');
  const contactOpts = renderContactOptionsForSchool(schoolId, preselectContactId);
  showModal('Uitvoering vastleggen',
    `<div class="form-group"><label>Training *</label>
       <select id="f-training"><option value="">— Kies training —</option>${trainingOpts}</select>
     </div>
     <div class="form-row">
       <div class="form-group"><label>Datum</label>
         <input type="date" id="f-datum" value="${new Date().toISOString().slice(0, 10)}"/></div>
       <div class="form-group"><label>Aantal deelnemers</label>
         <input type="number" id="f-deel" placeholder="bijv. 12" min="1"/></div>
     </div>
     <div class="form-group"><label>Contactpersoon (optioneel)</label>
       <select id="f-contact">${contactOpts}</select>
     </div>
     <div class="form-group">
       <label>Succescore (1–5 sterren)</label>
       <div id="star-picker" style="display:flex;gap:4px;margin-top:4px;align-items:center">
         ${[1, 2, 3, 4, 5].map(i => `<span id="star-${i}" onclick="pickStar(${i})" style="cursor:pointer;font-size:28px;line-height:1;color:#C2D8D9">★</span>`).join('')}
         <span id="star-label" style="font-size:13px;color:var(--navy3);margin-left:8px;font-weight:600"></span>
       </div>
     </div>
     <div class="form-group"><label>Evaluatie</label>
       <textarea id="f-eval" rows="3" placeholder="Hoe is de uitvoering verlopen?"></textarea></div>
     <div class="form-group"><label>✓ Wat ging goed?</label>
       <textarea id="f-goed" rows="2"></textarea></div>
     <div class="form-group"><label>↑ Wat kon beter?</label>
       <textarea id="f-beter" rows="2"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="saveUitvoeringVanSchool('${schoolId}')">Opslaan</button>`, true);
}

// ── Contact modals ────────────────────────────────────────────────
function openContactModal(schoolId, cid = '') {
  const c = getContact(cid);
  showModal(c ? 'Contactpersoon bewerken' : 'Contactpersoon toevoegen',
    `<div class="form-group"><label>Naam *</label><input type="text" id="f-naam" value="${esc(c?.naam || '')}" placeholder="Jan de Vries"/></div>
     <div class="form-row">
       <div class="form-group"><label>Functie</label><input type="text" id="f-func" value="${esc(c?.functie || '')}" placeholder="Directeur"/></div>
       <div class="form-group"><label>Type</label>
         <select id="f-type">
           <option value="beslisser"${(!c || c.type === 'beslisser') ? ' selected' : ''}>Beslisser</option>
           <option value="beinvloeder"${c?.type === 'beinvloeder' ? ' selected' : ''}>Beïnvloeder</option>
         </select>
       </div>
     </div>
     <div class="form-group"><label>E-mailadres</label><input type="email" id="f-email" value="${esc(c?.email || '')}" placeholder="jan@school.nl"/></div>
     <div class="form-group"><label>Telefoonnummer</label><input type="tel" id="f-tel" value="${esc(c?.telefoon || '')}" placeholder="+31 6 12345678"/></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${c ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delContact('${cid}','${schoolId}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveContact('${schoolId}','${cid}')">Opslaan</button>`);
}

function openDossierModal(schoolId) {
  const s = getSchool(schoolId);
  const contacten = contactenVanSchool(schoolId);
  const opts = contacten.map(c => `<option value="${c.id}">${esc(c.naam)} (${esc(c.functie || '')})</option>`).join('');
  showModal('Notitie toevoegen',
    `<div class="form-group"><label>Contactpersoon (optioneel)</label>
       <select id="f-cid"><option value="">— Algemeen voor ${esc(s?.naam || '')} —</option>${opts}</select>
     </div>
     <div class="form-group"><label>Onderwerp *</label><input type="text" id="f-onderwerp" placeholder="Korte titel van deze notitie"/></div>
     <div class="form-group"><label>Notitie *</label><textarea id="f-tekst" rows="5" placeholder="Wat is er besproken, afgesproken of opgemerkt?"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="saveDossier('${schoolId}')">Opslaan</button>`);
}

function openBestandModal(schoolId) {
  const s = getSchool(schoolId);
  const contacten = contactenVanSchool(schoolId);
  const opts = contacten.map(c => `<option value="${c.id}">${esc(c.naam)} (${esc(c.functie || '')})</option>`).join('');
  showModal('Bestand toevoegen',
    `<div class="form-group"><label>Contactpersoon (optioneel)</label>
       <select id="f-cid"><option value="">— Algemeen voor ${esc(s?.naam || '')} —</option>${opts}</select>
     </div>
     <div class="form-group"><label>Onderwerp *</label>
       <input type="text" id="f-onderwerp" placeholder="Korte titel (bv. 'Offerte 2026')"/>
     </div>
     <div class="form-group"><label>Bestand(en) *</label>
       <input type="file" id="f-bestand" multiple style="font-size:13px"/>
       <div style="font-size:11px;color:var(--navy4);margin-top:4px">Je kunt meerdere bestanden tegelijk kiezen.</div>
       <div id="f-bestand-preview" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="saveBestand('${schoolId}')">Opslaan</button>`);
  setTimeout(() => {
    const inp = document.getElementById('f-bestand');
    if (inp) inp.addEventListener('change', () => {
      const prev = document.getElementById('f-bestand-preview');
      if (prev) prev.innerHTML = [...inp.files].map(f => `<span style="background:var(--bg2);border:1px solid var(--bg3);border-radius:5px;padding:3px 8px;font-size:12px">📎 ${esc(f.name)}</span>`).join('');
    });
  }, 50);
}

function openDossierModalContact(schoolId, contactId) {
  const c = getContact(contactId);
  showModal(`Notitie toevoegen — ${esc(c?.naam || '')}`,
    `<input type="hidden" id="f-cid" value="${esc(contactId)}"/>
     <div class="form-group"><label>Onderwerp *</label>
       <input type="text" id="f-onderwerp" placeholder="Korte titel van deze notitie"/>
     </div>
     <div class="form-group"><label>Notitie *</label>
       <textarea id="f-tekst" rows="5" placeholder="Wat is er besproken, afgesproken of opgemerkt?"></textarea>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="saveDossier('${schoolId}')">Opslaan</button>`);
}

function openBestandModalContact(schoolId, contactId) {
  const c = getContact(contactId);
  showModal(`Bestand toevoegen — ${esc(c?.naam || '')}`,
    `<input type="hidden" id="f-cid" value="${esc(contactId)}"/>
     <div class="form-group"><label>Onderwerp *</label>
       <input type="text" id="f-onderwerp" placeholder="Korte titel (bv. 'Offerte 2026')"/>
     </div>
     <div class="form-group"><label>Bestand(en) *</label>
       <input type="file" id="f-bestand" multiple style="font-size:13px"/>
       <div style="font-size:11px;color:var(--navy4);margin-top:4px">Je kunt meerdere bestanden tegelijk kiezen.</div>
       <div id="f-bestand-preview" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="saveBestand('${schoolId}')">Opslaan</button>`);
  setTimeout(() => {
    const inp = document.getElementById('f-bestand');
    if (inp) inp.addEventListener('change', () => {
      const prev = document.getElementById('f-bestand-preview');
      if (prev) prev.innerHTML = [...inp.files].map(f => `<span style="background:var(--bg2);border:1px solid var(--bg3);border-radius:5px;padding:3px 8px;font-size:12px">📎 ${esc(f.name)}</span>`).join('');
    });
  }, 50);
}
