// ════════════════════════════════════════════════════════════════
// FACTUREN
// ════════════════════════════════════════════════════════════════
let _factuurFilter  = 'alle';
let _factuurJaar    = 'alle';
let _factuurSearch  = '';
let _factuurSortCol = 'datum';
let _factuurSortDir = 'desc';
let _regels         = [];
let _uitvScore      = 0;

function sortFacturen(col) {
  if (_factuurSortCol === col) { _factuurSortDir = _factuurSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _factuurSortCol = col; _factuurSortDir = col === 'bedrag' ? 'desc' : 'asc'; }
  document.getElementById('content').innerHTML = renderFacturenPage(_factuurSearch);
}

function filterFacturen(v)   { _factuurSearch = v; smartRender(() => renderFacturenPage(v)); }
function setFactuurFilter(f) { _factuurFilter = f; smartRender(() => renderFacturenPage(_factuurSearch)); }
function setFactuurJaar(j)   { _factuurJaar   = j; smartRender(() => renderFacturenPage(_factuurSearch)); }

function renderFacturenPage(search = '') {
  const jaren = [...new Set(DB.facturen.map(f => {
    const m = (f.nummer || '').match(/^(20\d{2})/);
    if (m) return m[1];
    return f.datum ? f.datum.slice(0, 4) : null;
  }).filter(Boolean))].sort().reverse();

  const filtered = DB.facturen.filter(f => {
    const s  = DB.scholen.find(x => x.id === f.schoolId);
    const ms = (f.nummer || '').toLowerCase().includes(search.toLowerCase())
            || (s?.naam || '').toLowerCase().includes(search.toLowerCase())
            || (f.betreft || '').toLowerCase().includes(search.toLowerCase());
    const mf = _factuurFilter === 'alle' || f.status === _factuurFilter;
    const fnrYear = ((f.nummer || '').match(/^(20\d{2})/) || [])[1] || '';
    const mj = _factuurJaar === 'alle' || fnrYear === _factuurJaar || (!fnrYear && (f.datum || '').startsWith(_factuurJaar));
    return ms && mf && mj;
  });

  const dir = _factuurSortDir === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    const sa = DB.scholen.find(x => x.id === a.schoolId);
    const sb = DB.scholen.find(x => x.id === b.schoolId);
    switch (_factuurSortCol) {
      case 'nummer':  return dir * (a.nummer || '').localeCompare(b.nummer || '', 'nl', { numeric: true });
      case 'school':  return dir * (sa?.naam || '').localeCompare(sb?.naam || '', 'nl');
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
            ${th('school', 'School')}
            ${th('betreft', 'Betreft')}
            ${th('datum', 'Datum')}
            ${th('bedrag', 'Bedrag')}
            ${th('status', 'Status')}
            <th style="width:100px;text-align:center">Acties</th>
          </tr></thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="7"><div class="empty-state"><p>Geen facturen gevonden</p></div></td></tr>`
              : filtered.map(f => {
                  const s = DB.scholen.find(x => x.id === f.schoolId);
                  return `<tr>
                    <td style="font-weight:700;white-space:nowrap">${esc(f.nummer)}</td>
                    <td style="font-size:13px">${esc(s?.naam || '—')}</td>
                    <td style="font-size:12.5px;color:var(--navy3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.betreft || '')}</td>
                    <td style="white-space:nowrap">${fmtDateShort(f.datum)}</td>
                    <td style="font-weight:600;white-space:nowrap">${fmtEuro(f.totaal)}</td>
                    <td>${badge(f.status)}</td>
                    <td>
                      <div style="display:flex;gap:4px;justify-content:center">
                        <button class="btn btn-ghost btn-icon btn-sm" title="Factuur e-mailen" onclick="openEmailModal({factuurId:'${f.id}',schoolId:'${f.schoolId}',contactId:'${f.contactId || ''}'})" style="color:var(--accent)">${svgIcon('mail', 14)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Factuur bekijken" onclick="printFactuur('${f.id}')" style="color:var(--navy);border:1.5px solid var(--bg3)">${svgIcon('eye', 15)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Bewerken" onclick="openFactuurModal('${f.schoolId}','${f.id}')">${svgIcon('edit', 14)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delFactuurOverview('${f.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Facturen tab binnen schooldetail ─────────────────────────────
function renderFacturenTab(schoolId) {
  const facturen = DB.facturen.filter(f => f.schoolId === schoolId);
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
async function openFactuurModal(schoolId, fid = '', prefillContactId = '') {
  const f = fid ? DB.facturen.find(x => x.id === fid) : null;
  const school = DB.scholen.find(x => x.id === schoolId);
  const contacten = DB.contacten.filter(c => c.schoolId === schoolId);
  const activeContactId = f?.contactId || prefillContactId || '';
  const prefillContact = activeContactId ? DB.contacten.find(x => x.id === activeContactId) : null;

  const nextNr = (() => {
    const yr = new Date().getFullYear();
    const allNrs = DB.facturen.map(x => { const m = String(x.nummer || '').match(/(\d+)$/); return m ? parseInt(m[1]) : 0; });
    return String(yr) + String(Math.max(0, ...allNrs) + 1).padStart(2, '0');
  })();

  const prefillDebnr = f?.debiteurnr || school?.debiteurnr || '';
  const prefillTav = f?.tav || (prefillContact && !f ? prefillContact.naam : '');
  const regels = f?.regels?.length ? f.regels : [{ id: uid(), omschrijving: '', toelichting: '', datum: '', uren: '', bedrag: 0 }];
  const contactOpts = contacten.map(c => `<option value="${c.id}"${activeContactId === c.id ? ' selected' : ''}>${esc(c.naam)}${c.functie ? ` — ${esc(c.functie)}` : ''}</option>`).join('');

  const schoolInfoHtml = (!f && school) ? `
    <div style="background:var(--bg2);border:1px solid var(--bg3);border-radius:var(--r);padding:12px 16px;margin-bottom:18px;font-size:13px;color:var(--navy3)">
      <div style="font-weight:800;color:var(--navy);margin-bottom:4px">${svgIcon('school', 15)} ${esc(school.naam)}</div>
      ${school.adres ? `<div>${esc(school.adres)}</div>` : ''}
      ${(school.postcode || school.plaats) ? `<div>${[school.postcode, school.plaats].filter(Boolean).map(esc).join(' ')}</div>` : ''}
      ${school.debiteurnr ? `<div style="margin-top:4px">Debiteur: <strong>${esc(school.debiteurnr)}</strong></div>` : ''}
    </div>` : '';

  showModal(f ? 'Factuur bewerken' : 'Nieuwe factuur',
    `${schoolInfoHtml}
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
         <select id="f-contact"><option value="">— Geen t.a.v. —</option>${contactOpts}</select>
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
     <button class="btn btn-primary" onclick="saveFactuur('${schoolId}','${fid || ''}')">Opslaan</button>`, true);

  renderRegels(regels);
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
  const schoolOpts = DB.scholen.map(s => {
    const best = DB.besturen.find(b => b.id === s.bestuurId);
    const label = best ? `${s.naam} (${best.naam})` : s.naam;
    return `<option value="${s.id}">${esc(label)}</option>`;
  }).join('');

  showModal('Nieuwe factuur — kies school',
    `<div class="form-group">
       <label>School *</label>
       <select id="f-nf-school" onchange="onNieuweFactuurSchoolChange()">
         <option value="">— Selecteer een school —</option>${schoolOpts}
       </select>
     </div>
     <div id="nf-school-info"></div>
     <div class="form-group">
       <label>Contactpersoon (t.a.v.)</label>
       <select id="f-nf-contact"><option value="">— Geen —</option></select>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="startNieuweFactuur()">Doorgaan</button>`);
}

function onNieuweFactuurSchoolChange() {
  const schoolId = document.getElementById('f-nf-school').value;
  const school = schoolId ? DB.scholen.find(s => s.id === schoolId) : null;
  const best = school ? DB.besturen.find(b => b.id === school.bestuurId) : null;

  // School-info tonen
  const infoEl = document.getElementById('nf-school-info');
  if (infoEl) {
    infoEl.innerHTML = school ? `
      <div style="background:var(--glass);border:1px solid var(--bg3);border-radius:var(--r);padding:12px 16px;margin-bottom:18px;font-size:13px;color:var(--navy3)">
        <div style="font-weight:700;color:var(--navy);margin-bottom:4px">${svgIcon('school', 15)} ${esc(school.naam)}</div>
        ${best ? `<div>Bestuur: ${esc(best.naam)}</div>` : ''}
        ${school.adres ? `<div>${esc(school.adres)}</div>` : ''}
        ${(school.postcode || school.plaats) ? `<div>${[school.postcode, school.plaats].filter(Boolean).map(esc).join(' ')}</div>` : ''}
        ${school.debiteurnr ? `<div style="margin-top:4px">Debiteurnummer: <strong>${esc(school.debiteurnr)}</strong></div>` : ''}
      </div>` : '';
  }

  // Contacten filteren
  const contactSel = document.getElementById('f-nf-contact');
  const contacten = schoolId ? DB.contacten.filter(c => c.schoolId === schoolId) : [];
  contactSel.innerHTML = '<option value="">— Geen —</option>' +
    contacten.map(c => `<option value="${c.id}">${esc(c.naam)}${c.functie ? ` — ${esc(c.functie)}` : ''}</option>`).join('');
}

function startNieuweFactuur() {
  const schoolId = document.getElementById('f-nf-school').value;
  if (!schoolId) return alert('Selecteer eerst een school');
  const contactId = document.getElementById('f-nf-contact').value || '';
  closeModal();
  openFactuurModal(schoolId, '', contactId);
}

// ── Factuur HTML genereren (herbruikbaar voor print + e-mail) ─────
// Oude bitmap behouden, maar voor de factuur gebruiken we een scherpe SVG-variant.
const LOGO_BASE64 = 'data:image/jpeg;base64,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';

const FACTUUR_LOGO = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 120">
  <rect width="420" height="120" fill="white"/>
  <g transform="translate(10,8)">
    <path d="M20 78 A56 56 0 0 1 132 78" fill="none" stroke="#1E2E97" stroke-width="16" stroke-linecap="round"/>
    <path d="M34 78 A42 42 0 0 1 118 78" fill="none" stroke="#E21C63" stroke-width="12" stroke-linecap="round"/>
    <path d="M49 78 A28 28 0 0 1 103 78" fill="none" stroke="#F3E33B" stroke-width="12" stroke-linecap="round"/>
    <path d="M64 78 A14 14 0 0 1 88 78" fill="none" stroke="#2DBE60" stroke-width="12" stroke-linecap="round"/>
    <circle cx="76" cy="78" r="4" fill="#FF7A21"/>
  </g>
  <text x="154" y="52" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#2D3054">2xdenken</text>
  <text x="154" y="81" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#2C8C8A">CRM &amp; Facturatie</text>
</svg>
`)}`;

function getFactuurHtml(fid) {
  const f = DB.facturen.find(x => x.id === fid);
  if (!f) return;
  const school  = DB.scholen.find(x => x.id === f.schoolId);
  const bestuur = school ? DB.besturen.find(b => b.id === school.bestuurId) : null;

  const fmtDutch = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear())}`;
  };

  const klantNaam = bestuur ? bestuur.naam : (school ? school.naam : '');
  const adresLines = [];
  if (f.tav) adresLines.push('t.a.v. ' + esc(f.tav));
  else {
    const contact = f.contactId ? DB.contacten.find(c => c.id === f.contactId) : null;
    if (contact) adresLines.push('t.a.v. ' + esc(contact.naam));
  }
  if (school?.adres) adresLines.push(esc(school.adres));
  if (school?.postcode || school?.plaats)
    adresLines.push([school.postcode, school.plaats].filter(Boolean).map(esc).join(' '));

  const totaal = Math.round((f.regels || []).reduce((s, r) => s + (Math.round((parseFloat(r.bedrag) || 0) * 100) / 100), 0) * 100) / 100;

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
  .brand-logo img{height:58px;width:220px;object-fit:contain;display:block;background:#fff}
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
  const filtered = DB.facturen.filter(f => {
    const s  = DB.scholen.find(x => x.id === f.schoolId);
    const ms = !_factuurSearch
      || (f.nummer || '').toLowerCase().includes(_factuurSearch.toLowerCase())
      || (s?.naam || '').toLowerCase().includes(_factuurSearch.toLowerCase())
      || (f.betreft || '').toLowerCase().includes(_factuurSearch.toLowerCase());
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
    [Q(titel), '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    [Q('Factuurnummer'), Q('School'), Q('Betreft'), Q('Factuurdatum'), Q('Vervaldatum'), Q('Bedrag (€)'), Q('Status')],
    ...filtered.map(f => {
      const s = DB.scholen.find(x => x.id === f.schoolId);
      const statusNL = { betaald: 'Betaald', verzonden: 'Verzonden', concept: 'Concept', vervallen: 'Vervallen' };
      return [Q(f.nummer || ''), Q(s?.naam || '—'), Q(f.betreft || ''), Q(fmtDateShort(f.datum)), Q(fmtDateShort(f.vervaldatum)), EUR(f.totaal), Q(statusNL[f.status] || f.status || '')];
    }),
    ['', '', '', '', '', '', ''],
    [Q('TOTAAL OMZET'), '', '', '', '', EUR(totaal), ''],
    [Q('Waarvan betaald'), '', '', '', '', EUR(betaald), ''],
    [Q('Waarvan openstaand'), '', '', '', '', EUR(open), ''],
    ['', '', '', '', '', '', ''],
    [Q(`Geëxporteerd op: ${new Date().toLocaleDateString('nl-NL')} | Aantal facturen: ${filtered.length}`), '', '', '', '', '', ''],
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
