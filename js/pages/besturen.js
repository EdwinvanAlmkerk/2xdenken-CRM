// ════════════════════════════════════════════════════════════════
// BESTUREN
// ════════════════════════════════════════════════════════════════
let _bestuurSearch  = '';
let _bestuurSortCol = 'naam';
let _bestuurSortDir = 'asc';

function sortBesturen(col) {
  if (_bestuurSortCol === col) { _bestuurSortDir = _bestuurSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _bestuurSortCol = col; _bestuurSortDir = 'asc'; }
  renderContent();
}

function searchBesturen(v) { _bestuurSearch = v; smartRender(() => renderBesturen(v)); }

function renderBesturen(search = '') {
  const thStyle = `cursor:pointer;user-select:none;white-space:nowrap;`;
  const arrow = col => _bestuurSortCol !== col
    ? `<span style="opacity:.25;margin-left:4px;font-size:10px">⇅</span>`
    : _bestuurSortDir === 'asc'
      ? `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▲</span>`
      : `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▼</span>`;
  const th = (col, label) => `<th style="${thStyle}" onclick="sortBesturen('${col}')">${label}${arrow(col)}</th>`;

  let filtered = DB.besturen.filter(b => b.naam.toLowerCase().includes(search.toLowerCase()));
  const dir = _bestuurSortDir === 'asc' ? 1 : -1;
  filtered = [...filtered].sort((a, b) => {
    if (_bestuurSortCol === 'naam')    return dir * a.naam.localeCompare(b.naam, 'nl');
    if (_bestuurSortCol === 'scholen') return dir * (DB.scholen.filter(s => s.bestuurId === a.id).length - DB.scholen.filter(s => s.bestuurId === b.id).length);
    return 0;
  });

  return `
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div class="search-wrap" style="flex:1">
        <span class="search-icon">${svgIcon('search', 15)}</span>
        <input id="search-besturen" type="text" placeholder="Zoek bestuur…" value="${esc(search)}" oninput="searchBesturen(this.value)" style="padding-left:34px"/>
      </div>
      <button class="btn btn-primary" onclick="openBestuurModal()">${svgIcon('add')} Nieuw bestuur</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>${th('naam', 'Naam bestuur')}${th('scholen', 'Scholen')}<th>Website</th><th></th></tr></thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="4"><div class="empty-state"><p>Geen besturen gevonden</p></div></td></tr>`
              : filtered.map(b => {
                  const cnt = DB.scholen.filter(s => s.bestuurId === b.id).length;
                  return `<tr class="clickable-row" onclick="navigate('bestuur-detail','${b.id}')">
                    <td style="font-weight:500">${esc(b.naam)}</td>
                    <td style="color:var(--ink3);font-size:13px">${cnt} ${cnt === 1 ? 'school' : 'scholen'}</td>
                    <td>${b.website ? `<a href="${esc(b.website)}" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue);font-size:13px">${esc(b.website)}</a>` : '–'}</td>
                    <td onclick="event.stopPropagation()" style="width:80px">
                      <div class="row-actions">
                        <button class="btn btn-ghost btn-icon btn-sm" title="Bewerken" onclick="openBestuurModal('${b.id}')">${svgIcon('edit', 14)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm btn-del" title="Verwijderen" onclick="delBestuur('${b.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function openBestuurModal(id = '') {
  const b = id ? DB.besturen.find(x => x.id === id) : null;
  showModal(b ? 'Bestuur bewerken' : 'Nieuw bestuur',
    `<div class="form-group"><label>Naam bestuur *</label><input type="text" id="f-naam" value="${esc(b?.naam || '')}" placeholder="Stichting Primair Onderwijs…"/></div>
     <div class="form-group"><label>Website</label><input type="url" id="f-web" value="${esc(b?.website || '')}" placeholder="https://…"/></div>
     <div class="form-group"><label>Adres</label><input type="text" id="f-adres" value="${esc(b?.adres || '')}" placeholder="Straat en huisnummer"/></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${b ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delBestuur('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveBestuur('${id}')">Opslaan</button>`);
}

function renderBestuurDetail(id) {
  const b = DB.besturen.find(x => x.id === id);
  if (!b) return '<p>Niet gevonden</p>';
  const scholen  = DB.scholen.filter(s => s.bestuurId === id);
  const schoolIds = scholen.map(s => s.id);
  const dossiers = [...DB.dossiers.filter(d => schoolIds.includes(d.schoolId))].sort((a, b) => new Date(b.datum) - new Date(a.datum));

  const tabs = [['scholen', 'Scholen'], ['dossier', 'Dossier']];
  let tabContent = '';

  if (bestuurTab === 'scholen') {
    tabContent = `
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>School</th><th>Plaats</th><th>Contacten</th><th>Notities</th></tr></thead>
            <tbody>
              ${scholen.length === 0
                ? `<tr><td colspan="4"><div class="empty-state" style="padding:30px"><p>Nog geen scholen gekoppeld</p></div></td></tr>`
                : scholen.map(s => `
                  <tr class="clickable-row" onclick="navigate('school-detail','${s.id}')">
                    <td style="font-weight:500">${esc(s.naam)}</td>
                    <td>${esc(s.plaats || '–')}</td>
                    <td>${DB.contacten.filter(c => c.schoolId === s.id).length}</td>
                    <td>${DB.dossiers.filter(d => d.schoolId === s.id).length}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } else if (bestuurTab === 'dossier') {
    tabContent = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-primary" onclick="openBestuurDossierModal('${id}')">${svgIcon('add')} Notitie toevoegen</button>
      </div>
      ${dossiers.length === 0
        ? `<div class="card"><div class="empty-state">${svgIcon('note', 36)}<p>Nog geen dossiernotities</p></div></div>`
        : `<div class="dossier-list">${dossiers.map(d => {
            const school = DB.scholen.find(s => s.id === d.schoolId);
            return `
              <div class="dossier-item">
                <div class="dossier-top">
                  <div>
                    <span class="dossier-source">${esc(d.bronNaam)}</span>
                    ${school ? `<span style="font-size:11px;color:var(--navy4);margin-left:8px;background:var(--bg3);border-radius:4px;padding:2px 7px">${esc(school.naam)}</span>` : ''}
                  </div>
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="dossier-date">${fmtDate(d.datum)}</span>
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="delDossierBestuur('${d.id}','${id}')">${svgIcon('trash', 13)}</button>
                  </div>
                </div>
                <div class="dossier-text">${esc(d.tekst)}</div>
                ${renderBijlagen(d, d.schoolId)}
              </div>`}).join('')}</div>`}`;
  }

  return `
    <div class="breadcrumb">
      <a onclick="navigate('besturen')">Besturen</a>
      ${svgIcon('chevron', 14)} <span>${esc(b.naam)}</span>
    </div>
    <div class="detail-header">
      <div>
        <div class="detail-title">${esc(b.naam)}</div>
        ${b.website ? `<div class="detail-subtitle"><a href="${esc(b.website)}" target="_blank" style="color:var(--blue)">${esc(b.website)}</a></div>` : ''}
        <div class="detail-meta">
          <span class="meta-item">${svgIcon('school', 15)} ${scholen.length} ${scholen.length === 1 ? 'school' : 'scholen'}</span>
          <span class="meta-item">${svgIcon('note', 15)} ${dossiers.length} notities</span>
        </div>
      </div>
      <button class="btn btn-secondary" onclick="openBestuurModal('${b.id}')">${svgIcon('edit', 15)} Bewerken</button>
    </div>
    <div class="tabs">
      ${tabs.map(([k, l]) => `<div class="tab${bestuurTab === k ? ' active' : ''}" onclick="setBestuurTab('${id}','${k}')">${l}</div>`).join('')}
    </div>
    ${tabContent}`;
}

function openBestuurDossierModal(bestuurId) {
  const b = DB.besturen.find(x => x.id === bestuurId);
  const scholen = DB.scholen.filter(s => s.bestuurId === bestuurId);
  const schoolOpts = scholen.map(s => `<option value="${s.id}">${esc(s.naam)}</option>`).join('');
  showModal('Notitie toevoegen — ' + esc(b?.naam || ''),
    `<div class="form-group"><label>School *</label>
       <select id="f-school-dos"><option value="">— Kies school —</option>${schoolOpts}</select>
     </div>
     <div class="form-group"><label>Notitie *</label>
       <textarea id="f-tekst" rows="5" placeholder="Wat is er besproken, afgesproken of opgemerkt?"></textarea>
     </div>
     <div class="form-group">
       <label>Bijlage toevoegen (optioneel)</label>
       <input type="file" id="f-bijlage" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.csv,.zip" style="font-size:13px"/>
       <div style="font-size:11px;color:var(--navy4);margin-top:4px">PDF, Word, Excel, afbeeldingen, etc.</div>
       <div id="f-bijlage-preview" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="saveDossierBestuur('${bestuurId}')">Opslaan</button>`);
  setTimeout(() => {
    const inp = document.getElementById('f-bijlage');
    if (inp) inp.addEventListener('change', () => {
      const prev = document.getElementById('f-bijlage-preview');
      if (prev) prev.innerHTML = [...inp.files].map(f => `<span style="background:var(--bg2);border:1px solid var(--bg3);border-radius:5px;padding:3px 8px;font-size:12px">📎 ${esc(f.name)}</span>`).join('');
    });
  }, 50);
}
