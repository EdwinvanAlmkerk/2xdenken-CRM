// ════════════════════════════════════════════════════════════════
// FACTUREN
// ════════════════════════════════════════════════════════════════
let _factuurFilter  = 'alle';
let _factuurJaar    = String(new Date().getFullYear());
let _factuurSearch  = '';
let _factuurSortCol = 'datum';
let _factuurSortDir = 'desc';
let _factuurPage    = 1;
let _regels         = [];
let _uitvScore      = 0;

function gotoFacturenPage(p) { _factuurPage = p; smartRender(() => renderFacturenPage(_factuurSearch)); }

function sortFacturen(col) {
  if (_factuurSortCol === col) { _factuurSortDir = _factuurSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _factuurSortCol = col; _factuurSortDir = col === 'bedrag' ? 'desc' : 'asc'; }
  _factuurPage = 1;
  smartRender(() => renderFacturenPage(_factuurSearch));
}

const _renderFacturenDeb = debounce(() => smartRender(() => renderFacturenPage(_factuurSearch)), 140);
function filterFacturen(v)   { _factuurSearch = v; _factuurPage = 1; _renderFacturenDeb(); }
function setFactuurFilter(f) { _factuurFilter = f; _factuurPage = 1; smartRender(() => renderFacturenPage(_factuurSearch)); }
function setFactuurJaar(j)   { _factuurJaar   = j; _factuurPage = 1; smartRender(() => renderFacturenPage(_factuurSearch)); }

function renderFacturenPage(search = '') {
  const jaren = [...new Set(DB.facturen.map(f => getFactuurJaar(f)).filter(Boolean))].sort().reverse();

  const huidigJaar = String(new Date().getFullYear());
  if (!jaren.includes(_factuurJaar) && _factuurJaar !== 'alle') {
    _factuurJaar = jaren.includes(huidigJaar) ? huidigJaar : (jaren[0] || 'alle');
  }

  const q = search.toLowerCase();
  const filtered = DB.facturen.filter(f => {
    const klantNaam = factuurKlantNaam(f);
    const ms = !q
            || (f.nummer || '').toLowerCase().includes(q)
            || klantNaam.toLowerCase().includes(q)
            || (f.betreft || '').toLowerCase().includes(q);
    const mf = _factuurFilter === 'alle' || f.status === _factuurFilter;
    const mj = _factuurJaar === 'alle' || getFactuurJaar(f) === _factuurJaar;
    return ms && mf && mj;
  });

  const dir = _factuurSortDir === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    switch (_factuurSortCol) {
      case 'nummer':  return dir * (a.nummer || '').localeCompare(b.nummer || '', 'nl', { numeric: true });
      case 'school':  return dir * factuurKlantNaam(a).localeCompare(factuurKlantNaam(b), 'nl');
      case 'betreft': return dir * (a.betreft || '').localeCompare(b.betreft || '', 'nl');
      case 'datum':   return dir * ((a.datum || '') < (b.datum || '') ? -1 : (a.datum || '') > (b.datum || '') ? 1 : 0);
      case 'bedrag':  return dir * ((a.totaal || 0) - (b.totaal || 0));
      case 'status':  return dir * (a.status || '').localeCompare(b.status || '', 'nl');
      default: return 0;
    }
  });

  const totaalGefilterd  = filtered.reduce((s, f) => s + (f.totaal || 0), 0);
  const totaalBetaald    = filtered.filter(f => f.status === 'betaald').reduce((s, f) => s + (f.totaal || 0), 0);
  const totaalOpenstaand = filtered.filter(f => f.status === 'verzonden').reduce((s, f) => s + (f.totaal || 0), 0);
  const pageInfo = paginate(filtered, _factuurPage);
  const pageSlice = pageInfo.slice;

  const statusFilters = ['alle', 'concept', 'verzonden', 'betaald', 'vervallen'];
  const flabels = { alle: 'Alle', concept: 'Concept', verzonden: 'Verzonden', betaald: 'Betaald', vervallen: 'Vervallen' };

  const thStyle = `cursor:pointer;user-select:none;white-space:nowrap;`;
  const arrow = col => _factuurSortCol !== col
    ? `<span style="opacity:.25;margin-left:4px;font-size:10px">⇅</span>`
    : _factuurSortDir === 'asc'
      ? `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▲</span>`
      : `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▼</span>`;
  const th = (col, label, extra = '') =>
    `<th style="${thStyle}${extra}" onclick="sortFacturen('${col}')">${label}${arrow(col)}</th>`;

  return `
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <div class="search-wrap" style="flex:1;min-width:200px">
        <span class="search-icon">${svgIcon('search', 15)}</span>
        <input id="search-facturen" type="text" placeholder="Zoek factuurnummer, school of betreft…"
          value="${esc(search)}" oninput="filterFacturen(this.value)" style="padding-left:36px"/>
      </div>
      <select onchange="setFactuurJaar(this.value)"
        style="padding:9px 13px;border:2px solid var(--bg3);border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:13.5px;font-weight:600;color:var(--navy);background:white;cursor:pointer;min-width:100px">
        <option value="alle"${_factuurJaar === 'alle' ? ' selected' : ''}>Alle jaren</option>
        ${jaren.map(j => `<option value="${j}"${_factuurJaar === j ? ' selected' : ''}>${j}</option>`).join('')}
      </select>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${statusFilters.map(f => `<button class="btn btn-sm ${_factuurFilter === f ? 'btn-primary' : 'btn-secondary'}"
          onclick="setFactuurFilter('${f}')">${flabels[f]}</button>`).join('')}
      </div>
      <button class="btn btn-secondary btn-sm" onclick="exportFacturenExcel()"
        style="display:flex;align-items:center;gap:6px;white-space:nowrap;border-color:var(--groen);color:var(--groen);font-weight:700">
        ${svgIcon('invoice', 15)} Excel export
      </button>
      <button class="btn btn-primary btn-sm" onclick="openNieuweFactuurModal()">
        ${svgIcon('add', 14)} Nieuwe factuur
      </button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div style="background:white;border:1px solid var(--bg3);border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.5px">${filtered.length} facturen</span>
        <span style="font-size:17px;font-weight:800;color:var(--navy)">${fmtEuro(totaalGefilterd)}</span>
      </div>
      <div style="background:var(--s-groen-s);border:1px solid #b8ddc8;border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--groen);text-transform:uppercase;letter-spacing:.5px">Betaald</span>
        <span style="font-size:17px;font-weight:800;color:var(--groen)">${fmtEuro(totaalBetaald)}</span>
      </div>
      <div style="background:var(--brand-s);border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--navy3);text-transform:uppercase;letter-spacing:.5px">Openstaand</span>
        <span style="font-size:17px;font-weight:800;color:var(--navy)">${fmtEuro(totaalOpenstaand)}</span>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            ${th('nummer', 'Nummer')}
            ${th('school', 'Klant')}
            ${th('betreft', 'Betreft')}
            ${th('datum', 'Datum')}
            ${th('bedrag', 'Bedrag')}
            ${th('status', 'Status')}
            <th style="width:100px;text-align:center">Acties</th>
          </tr></thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="7"><div class="empty-state"><p>Geen facturen gevonden</p></div></td></tr>`
              : pageSlice.map(f => {
                  const s = getSchool(f.schoolId);
                  const b = f.bestuurId ? getBestuur(f.bestuurId) : null;
                  const klantHtml = s
                    ? `${esc(s.naam)}${b ? `<div style="font-size:11px;color:var(--navy4);margin-top:2px">${esc(b.naam)}</div>` : ''}`
                    : (b ? `${esc(b.naam)}<div style="font-size:11px;color:var(--navy4);margin-top:2px">via bestuur</div>` : '—');
                  return `<tr>
                    <td style="font-weight:700;white-space:nowrap">${esc(f.nummer)}</td>
                    <td style="font-size:13px">${klantHtml}</td>
                    <td style="font-size:12.5px;color:var(--navy3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.betreft || '')}</td>
                    <td style="white-space:nowrap">${fmtDateShort(f.datum)}</td>
                    <td style="font-weight:600;white-space:nowrap">${fmtEuro(f.totaal)}</td>
                    <td>${badge(f.status)}</td>
                    <td>
                      <div style="display:flex;gap:4px;justify-content:center">
                        <button class="btn btn-ghost btn-icon btn-sm" title="Factuur e-mailen" onclick="openEmailModal({factuurId:'${f.id}',schoolId:'${f.schoolId || ''}',contactId:'${f.contactId || ''}'})" style="color:var(--accent)">${svgIcon('mail', 14)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Factuur bekijken" onclick="printFactuur('${f.id}')" style="color:var(--navy);border:1.5px solid var(--bg3)">${svgIcon('eye', 15)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Bewerken" onclick="openFactuurModal('${f.schoolId || ''}','${f.id}')">${svgIcon('edit', 14)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delFactuurOverview('${f.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(pageInfo, 'gotoFacturenPage')}
    </div>`;
}

// ── Facturen tab binnen schooldetail ─────────────────────────────
function renderFacturenTab(schoolId) {
  const facturen = facturenVanSchool(schoolId);
  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button class="btn btn-primary" onclick="openFactuurModal('${schoolId}')">${svgIcon('add')} Nieuwe factuur</button>
    </div>
    ${facturen.length === 0
      ? `<div class="card"><div class="empty-state">${svgIcon('invoice', 36)}<p>Nog geen facturen</p></div></div>`
      : `<div class="card"><div class="table-wrap"><table>
           <thead><tr><th>Nummer</th><th>Betreft</th><th>Datum</th><th>Bedrag</th><th>Status</th><th style="width:130px;text-align:center">Acties</th></tr></thead>
           <tbody>
             ${facturen.map(f => `
               <tr>
                 <td style="font-weight:700">${esc(f.nummer)}</td>
                 <td style="font-size:12.5px;color:var(--navy3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.betreft || '')}</td>
                 <td style="white-space:nowrap">${fmtDateShort(f.datum)}</td>
                 <td style="font-weight:600">${fmtEuro(f.totaal)}</td>
                 <td>${badge(f.status)}</td>
                 <td>
                   <div style="display:flex;gap:4px;justify-content:center">
                     <button class="btn btn-ghost btn-icon btn-sm" title="Factuur bekijken" onclick="printFactuur('${f.id}')" style="color:var(--navy);border:1.5px solid var(--bg3)">${svgIcon('eye', 15)}</button>
                     <button class="btn btn-ghost btn-icon btn-sm" title="Bewerken" onclick="openFactuurModal('${schoolId}','${f.id}')">${svgIcon('edit', 14)}</button>
                     <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delFactuur('${f.id}','${schoolId}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                   </div>
                 </td>
               </tr>`).join('')}
           </tbody>
         </table></div></div>`}`;
}

// ── Factuur modal ─────────────────────────────────────────────────
async function openFactuurModal(schoolId, fid = '', prefillContactId = '', prefillBestuurId = '') {
  const f = getFactuur(fid);

  let initialBestuurId = '';
  let initialSchoolId  = '';
  if (f) {
    initialSchoolId  = f.schoolId || '';
    initialBestuurId = f.bestuurId || (initialSchoolId ? (getSchool(initialSchoolId)?.bestuurId || '') : '');
  } else {
    initialSchoolId = schoolId || '';
    initialBestuurId = initialSchoolId
      ? (getSchool(initialSchoolId)?.bestuurId || '')
      : (prefillBestuurId || '');
  }

  const school = initialSchoolId ? getSchool(initialSchoolId) : null;
  const bestuur = initialBestuurId ? getBestuur(initialBestuurId) : null;
  const activeContactId = f?.contactId || prefillContactId || '';
  const prefillContact = getContact(activeContactId);

  const nextNr = (() => {
    const yr = new Date().getFullYear();
    const allNrs = DB.facturen.map(x => { const m = String(x.nummer || '').match(/(\d+)$/); return m ? parseInt(m[1]) : 0; });
    return String(yr) + String(Math.max(0, ...allNrs) + 1).padStart(2, '0');
  })();

  const prefillDebnr = f?.debiteurnr || school?.debiteurnr || bestuur?.debiteurnr || '';
  const prefillTav = f?.tav || (prefillContact && !f ? prefillContact.naam : '');
  const regels = f?.regels?.length ? f.regels : [{ id: uid(), omschrijving: '', toelichting: '', datum: '', uren: '', bedrag: 0 }];

  const bestuurOpts = [...DB.besturen]
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
    .map(b => `<option value="${b.id}"${initialBestuurId === b.id ? ' selected' : ''}>${esc(b.naam)}</option>`).join('');

  showModal(f ? 'Factuur bewerken' : 'Nieuwe factuur',
    `<div class="form-row">
       <div class="form-group"><label>Bestuur *</label>
         <select id="f-bestuur" onchange="onFactuurBestuurChange()">
           <option value="">— Kies bestuur —</option>${bestuurOpts}
         </select>
       </div>
       <div class="form-group"><label>School (optioneel)</label>
         <select id="f-school" onchange="onFactuurSchoolChange()">
           <option value="">— Geen school (factuur op bestuurniveau) —</option>
         </select>
       </div>
     </div>
     <div id="factuur-klant-info"></div>
     <div class="form-row">
       <div class="form-group"><label>Factuurnummer *</label><input type="text" id="f-nr" value="${esc(f?.nummer || nextNr)}"/></div>
       <div class="form-group"><label>Debiteurnummer</label><input type="text" id="f-debnr" value="${esc(prefillDebnr)}" placeholder="DB15"/></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label>Factuurdatum</label><input type="date" id="f-datum" value="${esc(f?.datum?.slice(0, 10) || new Date().toISOString().slice(0, 10))}"/></div>
       <div class="form-group"><label>Vervaldatum</label><input type="date" id="f-verval" value="${esc(f?.vervaldatum?.slice(0, 10) || '')}"/></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label>Status</label>
         <select id="f-status">
           ${['concept', 'verzonden', 'betaald', 'vervallen'].map(s => `<option value="${s}"${(f?.status || 'concept') === s ? ' selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
         </select>
       </div>
     </div>
     <div class="form-group"><label>Betreft (onderwerpregel op factuur)</label><input type="text" id="f-betreft" value="${esc(f?.betreft || '')}" placeholder="Het Anker, 3e factuur coachtraject K.S."/></div>
     <div class="form-row">
       <div class="form-group"><label>T.a.v. — kies contactpersoon</label>
         <select id="f-contact"><option value="">— Geen t.a.v. —</option></select>
       </div>
       <div class="form-group"><label>Of vrij t.a.v.-veld (overschrijft dropdown)</label>
         <input type="text" id="f-tav" value="${esc(prefillTav)}" placeholder="M. Breuningen"/>
       </div>
     </div>
     <div class="divider"></div>
     <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
       <label style="margin:0">Regelitems</label>
       <button class="btn btn-secondary btn-sm" onclick="addRegel()">+ Regel toevoegen</button>
     </div>
     <div id="regels-wrap"></div>
     <div id="totaal-wrap" class="invoice-total" style="margin-top:10px"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="saveFactuur('${fid || ''}')">Opslaan</button>`, true);

  refreshFactuurSchoolDropdown(initialBestuurId, initialSchoolId);
  refreshFactuurContactDropdown(initialSchoolId, activeContactId);
  refreshFactuurKlantInfo();
  renderRegels(regels);
}

function onFactuurBestuurChange() {
  const bestuurId = document.getElementById('f-bestuur')?.value || '';
  refreshFactuurSchoolDropdown(bestuurId, '');
  refreshFactuurContactDropdown('', '');
  refreshFactuurKlantInfo();
  const debEl = document.getElementById('f-debnr');
  const bestuur = getBestuur(bestuurId);
  if (debEl && !debEl.value && bestuur?.debiteurnr) debEl.value = bestuur.debiteurnr;
}

function onFactuurSchoolChange() {
  const schoolId = document.getElementById('f-school')?.value || '';
  refreshFactuurContactDropdown(schoolId, '');
  refreshFactuurKlantInfo();
  const school = getSchool(schoolId);
  const debEl = document.getElementById('f-debnr');
  if (debEl && school?.debiteurnr) debEl.value = school.debiteurnr;
}

function refreshFactuurSchoolDropdown(bestuurId, selectedSchoolId) {
  const sel = document.getElementById('f-school');
  if (!sel) return;
  const scholen = bestuurId ? scholenVanBestuur(bestuurId) : [];
  const opts = [...scholen].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
    .map(s => `<option value="${s.id}"${selectedSchoolId === s.id ? ' selected' : ''}>${esc(s.naam)}</option>`).join('');
  sel.innerHTML = `<option value="">— Geen school (factuur op bestuurniveau) —</option>${opts}`;
}

function refreshFactuurContactDropdown(schoolId, selectedContactId) {
  const sel = document.getElementById('f-contact');
  if (!sel) return;
  const contacten = schoolId ? contactenVanSchool(schoolId) : [];
  const opts = contacten.map(c => `<option value="${c.id}"${selectedContactId === c.id ? ' selected' : ''}>${esc(c.naam)}${c.functie ? ` — ${esc(c.functie)}` : ''}</option>`).join('');
  sel.innerHTML = `<option value="">— Geen t.a.v. —</option>${opts}`;
}

function refreshFactuurKlantInfo() {
  const wrap = document.getElementById('factuur-klant-info');
  if (!wrap) return;
  const bestuur = getBestuur(document.getElementById('f-bestuur')?.value || '');
  const school  = getSchool(document.getElementById('f-school')?.value || '');
  if (school) {
    wrap.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--bg3);border-radius:var(--r);padding:12px 16px;margin-bottom:18px;font-size:13px;color:var(--navy3)">
        <div style="font-weight:800;color:var(--navy);margin-bottom:4px">${svgIcon('school', 15)} ${esc(school.naam)}</div>
        ${bestuur ? `<div>Bestuur: ${esc(bestuur.naam)}</div>` : ''}
        ${school.adres ? `<div>${esc(school.adres)}</div>` : ''}
        ${(school.postcode || school.plaats) ? `<div>${[school.postcode, school.plaats].filter(Boolean).map(esc).join(' ')}</div>` : ''}
        ${school.debiteurnr ? `<div style="margin-top:4px">Debiteur: <strong>${esc(school.debiteurnr)}</strong></div>` : ''}
      </div>`;
  } else if (bestuur) {
    wrap.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--bg3);border-radius:var(--r);padding:12px 16px;margin-bottom:18px;font-size:13px;color:var(--navy3)">
        <div style="font-weight:800;color:var(--navy);margin-bottom:4px">${svgIcon('board', 15)} ${esc(bestuur.naam)} <span style="font-weight:400;color:var(--navy4);font-size:12px">— factuur op bestuurniveau</span></div>
        ${bestuur.adres ? `<div>${esc(bestuur.adres)}</div>` : ''}
        ${bestuur.debiteurnr ? `<div style="margin-top:4px">Debiteur: <strong>${esc(bestuur.debiteurnr)}</strong></div>` : ''}
      </div>`;
  } else {
    wrap.innerHTML = '';
  }
}

function parseFactuurBedrag(val) {
  return parseFloat(String(val || '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
}

function updateFactuurTotaal() {
  const tot = Math.round((_regels || []).reduce((s, r) => s + (Math.round(parseFactuurBedrag(r.bedrag) * 100) / 100), 0) * 100) / 100;
  const tw = document.getElementById('totaal-wrap');
  if (tw) tw.innerHTML = `Totaal: ${fmtEuro(tot)}`;
}

function renderRegels(regels) {
  _regels = regels;
  const wrap = document.getElementById('regels-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;min-width:580px">
    <thead><tr>
      <th style="min-width:130px">Omschrijving</th>
      <th>Toelichting</th>
      <th style="width:110px">Datum</th>
      <th style="width:80px">Uren</th>
      <th style="width:105px">Bedrag (€)</th>
      <th style="width:34px"></th>
    </tr></thead>
    <tbody>${regels.map((r, i) => `
      <tr>
        <td><input type="text" value="${esc(r.omschrijving || '')}" oninput="updateRegel(${i},'omschrijving',this.value)" placeholder="Coachessie 3"/></td>
        <td><input type="text" value="${esc(r.toelichting || '')}" oninput="updateRegel(${i},'toelichting',this.value)" placeholder="Nader te bepalen…"/></td>
        <td><input type="date" value="${esc(r.datum || '')}" oninput="updateRegel(${i},'datum',this.value)"/></td>
        <td><input type="text" value="${esc(r.uren || '')}" oninput="updateRegel(${i},'uren',this.value)" placeholder="2,5 uur"/></td>
        <td><input type="text" inputmode="decimal" value="${esc(r.bedrag || '')}" oninput="updateRegel(${i},'bedrag',this.value)" placeholder="0,00"/></td>
        <td><button class="btn btn-ghost btn-icon btn-sm" onclick="delRegel(${i})">${svgIcon('trash', 13)}</button></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  updateFactuurTotaal();
}

function updateRegel(i, key, val) {
  if (!_regels[i]) return;
  _regels[i][key] = val;
  updateFactuurTotaal();
}
function addRegel() { _regels.push({ id: uid(), omschrijving: '', toelichting: '', datum: '', uren: '', bedrag: '' }); renderRegels(_regels); }
function delRegel(i) { _regels.splice(i, 1); renderRegels(_regels); }

// ── Nieuwe factuur (vanuit facturenoverzicht) ────────────────────
function openNieuweFactuurModal() {
  const bestuurOpts = [...DB.besturen]
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
    .map(b => `<option value="${b.id}">${esc(b.naam)}</option>`).join('');

  showModal('Nieuwe factuur — kies bestuur en (optioneel) school',
    `<div class="form-group">
       <label>Bestuur *</label>
       <select id="f-nf-bestuur" onchange="onNieuweFactuurBestuurChange()">
         <option value="">— Selecteer een bestuur —</option>${bestuurOpts}
       </select>
     </div>
     <div class="form-group">
       <label>School (optioneel)</label>
       <select id="f-nf-school" onchange="onNieuweFactuurSchoolChange()">
         <option value="">— Geen school (factuur op bestuurniveau) —</option>
       </select>
     </div>
     <div id="nf-klant-info"></div>
     <div class="form-group">
       <label>Contactpersoon (t.a.v.)</label>
       <select id="f-nf-contact"><option value="">— Geen —</option></select>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="startNieuweFactuur()">Doorgaan</button>`);
}

function onNieuweFactuurBestuurChange() {
  const bestuurId = document.getElementById('f-nf-bestuur').value;
  const sel = document.getElementById('f-nf-school');
  const scholen = bestuurId ? scholenVanBestuur(bestuurId) : [];
  sel.innerHTML = '<option value="">— Geen school (factuur op bestuurniveau) —</option>' +
    [...scholen].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
      .map(s => `<option value="${s.id}">${esc(s.naam)}</option>`).join('');
  document.getElementById('f-nf-contact').innerHTML = '<option value="">— Geen —</option>';
  updateNieuweFactuurInfo();
}

function onNieuweFactuurSchoolChange() {
  const schoolId = document.getElementById('f-nf-school').value;
  const contactSel = document.getElementById('f-nf-contact');
  const contacten = schoolId ? contactenVanSchool(schoolId) : [];
  contactSel.innerHTML = '<option value="">— Geen —</option>' +
    contacten.map(c => `<option value="${c.id}">${esc(c.naam)}${c.functie ? ` — ${esc(c.functie)}` : ''}</option>`).join('');
  updateNieuweFactuurInfo();
}

function updateNieuweFactuurInfo() {
  const el = document.getElementById('nf-klant-info');
  if (!el) return;
  const bestuur = getBestuur(document.getElementById('f-nf-bestuur').value);
  const school  = getSchool(document.getElementById('f-nf-school').value);
  if (school) {
    el.innerHTML = `
      <div style="background:var(--glass);border:1px solid var(--bg3);border-radius:var(--r);padding:12px 16px;margin-bottom:18px;font-size:13px;color:var(--navy3)">
        <div style="font-weight:700;color:var(--navy);margin-bottom:4px">${svgIcon('school', 15)} ${esc(school.naam)}</div>
        ${bestuur ? `<div>Bestuur: ${esc(bestuur.naam)}</div>` : ''}
        ${school.adres ? `<div>${esc(school.adres)}</div>` : ''}
        ${(school.postcode || school.plaats) ? `<div>${[school.postcode, school.plaats].filter(Boolean).map(esc).join(' ')}</div>` : ''}
        ${school.debiteurnr ? `<div style="margin-top:4px">Debiteurnummer: <strong>${esc(school.debiteurnr)}</strong></div>` : ''}
      </div>`;
  } else if (bestuur) {
    el.innerHTML = `
      <div style="background:var(--glass);border:1px solid var(--bg3);border-radius:var(--r);padding:12px 16px;margin-bottom:18px;font-size:13px;color:var(--navy3)">
        <div style="font-weight:700;color:var(--navy);margin-bottom:4px">${svgIcon('board', 15)} ${esc(bestuur.naam)} <span style="font-weight:400;color:var(--navy4);font-size:12px">— factuur op bestuurniveau</span></div>
        ${bestuur.adres ? `<div>${esc(bestuur.adres)}</div>` : ''}
        ${bestuur.debiteurnr ? `<div style="margin-top:4px">Debiteurnummer: <strong>${esc(bestuur.debiteurnr)}</strong></div>` : ''}
      </div>`;
  } else {
    el.innerHTML = '';
  }
}

function startNieuweFactuur() {
  const bestuurId = document.getElementById('f-nf-bestuur').value;
  if (!bestuurId) return alert('Selecteer eerst een bestuur');
  const schoolId = document.getElementById('f-nf-school').value || '';
  const contactId = document.getElementById('f-nf-contact').value || '';
  closeModal();
  openFactuurModal(schoolId, '', contactId, bestuurId);
}

// ── Factuur HTML genereren (herbruikbaar voor print + e-mail) ─────
// Gebruik het echte 2xDenken-logo dat al in de app aanwezig is.
const FACTUUR_LOGO =
  document.querySelector('.login-logo img')?.getAttribute('src') ||
  document.querySelector('img[alt="2xDenken"]')?.getAttribute('src') ||
  '';

function getFactuurHtml(fid) {
  const f = getFactuur(fid);
  if (!f) return;
  const school  = f.schoolId ? getSchool(f.schoolId) : null;
  const bestuur = school
    ? getBestuur(school.bestuurId)
    : (f.bestuurId ? getBestuur(f.bestuurId) : null);

  const fmtDutch = value => {
    if (!value) return '';
    const str = String(value).trim();
    const simple = str.match(/^(\d{1,2})-(\d{1,2})-'?(\d{2}|\d{4})$/);
    if (simple) {
      const year = simple[3].length === 2 ? `20${simple[3]}` : simple[3];
      return `${String(simple[1]).padStart(2, '0')}-${String(simple[2]).padStart(2, '0')}-${year}`;
    }
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear())}`;
    }
    return str.replace(/'/g, '');
  };

  const klantNaam = bestuur ? bestuur.naam : (school ? school.naam : '');
  const adresLines = [];
  if (f.tav) adresLines.push('t.a.v. ' + esc(f.tav));
  else {
    const contact = getContact(f.contactId);
    if (contact) adresLines.push('t.a.v. ' + esc(contact.naam));
  }
  const adresBron = school || bestuur;
  if (adresBron?.adres) adresLines.push(esc(adresBron.adres));
  if (school && (school.postcode || school.plaats))
    adresLines.push([school.postcode, school.plaats].filter(Boolean).map(esc).join(' '));

  const totaal = Number.isFinite(Number(f.totaal))
    ? Math.round(Number(f.totaal) * 100) / 100
    : Math.round((f.regels || []).reduce((s, r) => s + (Math.round((parseFloat(r.bedrag) || 0) * 100) / 100), 0) * 100) / 100;

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8"/>
<title>Factuur ${esc(f.nummer)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --teal:#2C8C8A;--teal-d:#1F6867;--teal-l:#E8F3F2;
    --peach:#F4A896;
    --ink:#2A2F3A;--ink-l:#5A6270;--ink-xl:#8B92A0;
    --bg:#FAF7F2;--line:#E8E4DC;
  }
  body{font-family:'Nunito',Arial,sans-serif;font-size:10.5pt;color:var(--ink);background:#fff;line-height:1.5}
  @page{size:A4;margin:15mm 18mm 18mm 18mm}
  @media print{.no-print{display:none!important}}
  .page{max-width:800px;margin:0 auto;padding:28px 30px 30px;position:relative}
  .page::before{content:'';position:absolute;top:0;left:30px;right:30px;height:4px;background:linear-gradient(90deg,var(--teal) 0%,var(--teal) 60%,var(--peach) 100%);border-radius:2px}

  .header{display:flex;justify-content:space-between;align-items:center;margin-top:22px;margin-bottom:32px;padding-bottom:22px;border-bottom:1px solid var(--line);gap:30px}
  .brand-logo img{width:210px;max-width:100%;height:auto;max-height:60px;object-fit:contain;display:block;background:#fff}
  .sender-info{text-align:right;font-size:9pt;color:var(--ink-l);line-height:1.7}
  .sender-info strong{color:var(--ink);font-weight:700;display:block;margin-bottom:3px;font-size:10pt}

  .meta-row{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:28px}
  .meta-block-label{font-size:8.5pt;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .meta-block-content{font-size:10pt;line-height:1.7;color:var(--ink)}
  .meta-block-content .klant-naam{font-weight:700;font-size:11pt;color:var(--ink);margin-bottom:2px}
  .meta-details{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:10pt}
  .meta-details .label{color:var(--ink-l);font-weight:600}
  .meta-details .value{color:var(--ink);font-weight:700;text-align:right}

  .betreft{background:var(--teal-l);border-left:3px solid var(--teal);padding:11px 15px;border-radius:0 6px 6px 0;margin-bottom:20px;font-size:10pt}
  .betreft-label{font-size:8.5pt;font-weight:700;color:var(--teal-d);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
  .betreft-text{color:var(--ink);font-weight:600}

  .rt{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:10pt}
  .rt thead th{font-size:8.5pt;font-weight:700;color:var(--ink-l);text-transform:uppercase;letter-spacing:0.8px;text-align:left;padding:10px 12px 10px 0;border-bottom:2px solid var(--line)}
  .rt thead th.r{text-align:right;padding-right:0}
  .rt tbody td{padding:13px 12px 13px 0;vertical-align:top;border-bottom:1px solid var(--line);line-height:1.55}
  .rt tbody td.r{text-align:right;padding-right:0;white-space:nowrap;font-weight:700}
  .rt tbody td.omschrijving{font-weight:700;color:var(--ink)}
  .rt tbody td.toelichting{color:var(--ink-l);font-size:9.5pt}
  .rt tbody td.datum,.rt tbody td.uren{color:var(--ink-l);white-space:nowrap;font-size:9.5pt}
  .rt tbody tr:last-child td{border-bottom:none}

  .totaal-row{display:flex;justify-content:flex-end;margin-top:14px;margin-bottom:28px}
  .totaal-box{display:flex;align-items:center;gap:24px;background:var(--teal);color:white;padding:13px 22px;border-radius:8px;font-weight:800}
  .totaal-label{font-size:9pt;text-transform:uppercase;letter-spacing:1px;opacity:0.9}
  .totaal-bedrag{font-size:15pt;letter-spacing:-0.3px}

  .payment-section{background:var(--bg);border-radius:8px;padding:16px 20px;margin-bottom:18px}
  .payment-title{font-size:9pt;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .payment-text{font-size:9.5pt;color:var(--ink-l);line-height:1.65}
  .payment-text strong{color:var(--ink);font-weight:700}

  .btw-notice{font-size:8.5pt;color:var(--ink-xl);font-style:italic;text-align:center;padding:8px 0;margin-bottom:14px}
  .footer{display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid var(--line);font-size:8.5pt;color:var(--ink-xl)}

  .print-bar{margin-bottom:18px;display:flex;gap:10px}
  .pbtn{padding:10px 22px;border:none;border-radius:6px;font-family:'Nunito',sans-serif;font-size:13px;cursor:pointer;font-weight:700}
  .pb-p{background:var(--teal);color:white}.pb-p:hover{background:var(--teal-d)}
  .pb-s{background:#f0f0f0;color:#333;border:1px solid #ccc}
</style>
</head>
<body>
<div class="page">
  <div class="no-print print-bar">
    <button class="pbtn pb-p" onclick="window.print()">🖨&nbsp; Afdrukken / Opslaan als PDF</button>
    <button class="pbtn pb-s" onclick="window.close()">Sluiten</button>
  </div>

  <div class="header">
    <div class="brand-logo">
      <img src="${FACTUUR_LOGO}" alt="2xdenken logo"/>
    </div>
    <div class="sender-info">
      <strong>2xdenken</strong>
      Zoete Campagnergaarde 5<br/>
      3824 AK Amersfoort<br/>
      06-41548188<br/>
      jorieke@2xdenken.nl
    </div>
  </div>

  <div class="meta-row">
    <div>
      <div class="meta-block-label">Factuur voor</div>
      <div class="meta-block-content">
        ${klantNaam ? `<div class="klant-naam">${esc(klantNaam)}</div>` : ''}
        ${adresLines.join('<br/>')}
      </div>
    </div>
    <div>
      <div class="meta-block-label">Factuurgegevens</div>
      <div class="meta-details">
        <div class="label">Factuurnummer</div><div class="value">${esc(f.nummer)}</div>
        <div class="label">Factuurdatum</div><div class="value">${fmtDutch(f.datum)}</div>
        ${f.vervaldatum ? `<div class="label">Vervaldatum</div><div class="value">${fmtDutch(f.vervaldatum)}</div>` : ''}
        ${f.debiteurnr ? `<div class="label">Debiteurnr</div><div class="value">${esc(f.debiteurnr)}</div>` : ''}
      </div>
    </div>
  </div>

  ${f.betreft ? `
  <div class="betreft">
    <div class="betreft-label">Betreft</div>
    <div class="betreft-text">${esc(f.betreft)}</div>
  </div>` : ''}

  <table class="rt">
    <thead>
      <tr>
        <th style="width:24%">Omschrijving</th>
        <th>Toelichting</th>
        <th style="width:12%">Datum</th>
        <th style="width:10%">Uren</th>
        <th class="r" style="width:13%">Bedrag</th>
      </tr>
    </thead>
    <tbody>
      ${(f.regels || []).map(r => `
        <tr>
          <td class="omschrijving">${esc(r.omschrijving || '')}</td>
          <td class="toelichting">${esc(r.toelichting || '')}</td>
          <td class="datum">${r.datum ? fmtDutch(r.datum) : ''}</td>
          <td class="uren">${esc(r.uren || '')}</td>
          <td class="r">${(parseFloat(r.bedrag) || 0) ? fmtEuro(parseFloat(r.bedrag)) : ''}</td>
        </tr>`).join('')}
    </tbody>
  </table>

  <div class="totaal-row">
    <div class="totaal-box">
      <span class="totaal-label">Totaal</span>
      <span class="totaal-bedrag">${fmtEuro(totaal)}</span>
    </div>
  </div>

  <div class="payment-section">
    <div class="payment-title">Betaalinformatie</div>
    <div class="payment-text">
      U wordt verzocht het vermelde bedrag binnen <strong>14 dagen</strong> over te maken naar
      <strong>NL33INGB0007495489</strong> t.n.v. 2xdenken. Graag het factuurnummer <strong>${esc(f.nummer)}</strong> vermelden bij uw betaling.
    </div>
  </div>

  <div class="btw-notice">
    Vrijgesteld van btw op grond van artikel 11 lid 1 letter o Wet OB 1968 (CRKBO-geregistreerd).
  </div>

  <div class="footer">
    <span>KvK 62379879</span>
    <span>BTW NL 172148169B01</span>
  </div>
</div>
</body>
</html>`;

  return html;
}

function printFactuur(fid) {
  const html = getFactuurHtml(fid);
  if (!html) return;
  const win = window.open('', '_blank', 'width=900,height=1150');
  win.document.write(html);
  win.document.close();
}

// ── Excel export ──────────────────────────────────────────────────
function exportFacturenExcel() {
  const q = (_factuurSearch || '').toLowerCase();
  const filtered = DB.facturen.filter(f => {
    const klant = factuurKlantNaam(f);
    const ms = !q
      || (f.nummer || '').toLowerCase().includes(q)
      || klant.toLowerCase().includes(q)
      || (f.betreft || '').toLowerCase().includes(q);
    const mf = _factuurFilter === 'alle' || f.status === _factuurFilter;
    const fnrYear = ((f.nummer || '').match(/^(20\d{2})/) || [])[1] || '';
    const mj = _factuurJaar === 'alle' || fnrYear === _factuurJaar || (!fnrYear && (f.datum || '').startsWith(_factuurJaar));
    return ms && mf && mj;
  }).sort((a, b) => new Date(a.datum) - new Date(b.datum));

  const jaarLabel = _factuurJaar === 'alle' ? 'alle jaren' : _factuurJaar;
  const titel = `Factuuroverzicht 2xDenken — ${jaarLabel}`;
  const totaal  = filtered.reduce((s, f) => s + (f.totaal || 0), 0);
  const betaald = filtered.filter(f => f.status === 'betaald').reduce((s, f) => s + (f.totaal || 0), 0);
  const open    = filtered.filter(f => f.status === 'verzonden').reduce((s, f) => s + (f.totaal || 0), 0);

  const EUR = n => Number(n || 0).toFixed(2).replace('.', ',');
  const Q   = s => '"' + String(s || '').replace(/"/g, '""') + '"';

  const rows = [
    [Q(titel), '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    [Q('Factuurnummer'), Q('School'), Q('Bestuur'), Q('Betreft'), Q('Factuurdatum'), Q('Vervaldatum'), Q('Bedrag (€)'), Q('Status')],
    ...filtered.map(f => {
      const s = f.schoolId ? getSchool(f.schoolId) : null;
      const b = f.bestuurId ? getBestuur(f.bestuurId) : (s ? getBestuur(s.bestuurId) : null);
      const statusNL = { betaald: 'Betaald', verzonden: 'Verzonden', concept: 'Concept', vervallen: 'Vervallen' };
      return [Q(f.nummer || ''), Q(s?.naam || ''), Q(b?.naam || ''), Q(f.betreft || ''), Q(fmtDateShort(f.datum)), Q(fmtDateShort(f.vervaldatum)), EUR(f.totaal), Q(statusNL[f.status] || f.status || '')];
    }),
    ['', '', '', '', '', '', '', ''],
    [Q('TOTAAL OMZET'), '', '', '', '', '', EUR(totaal), ''],
    [Q('Waarvan betaald'), '', '', '', '', '', EUR(betaald), ''],
    [Q('Waarvan openstaand'), '', '', '', '', '', EUR(open), ''],
    ['', '', '', '', '', '', '', ''],
    [Q(`Geëxporteerd op: ${new Date().toLocaleDateString('nl-NL')} | Aantal facturen: ${filtered.length}`), '', '', '', '', '', '', ''],
  ];

  const csv = '\uFEFF' + rows.map(r => r.join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `2xDenken_facturen_${_factuurJaar === 'alle' ? 'allejaren' : _factuurJaar}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
