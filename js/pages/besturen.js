// ════════════════════════════════════════════════════════════════
// BESTUREN
// ════════════════════════════════════════════════════════════════
let _bestuurSearch  = '';
let _bestuurSortCol = 'naam';
let _bestuurSortDir = 'asc';
let _bestuurPage    = 1;

function sortBesturen(col) {
  if (_bestuurSortCol === col) { _bestuurSortDir = _bestuurSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _bestuurSortCol = col; _bestuurSortDir = 'asc'; }
  _bestuurPage = 1;
  renderContent();
}

const _renderBesturenDeb = debounce(() => smartRender(() => renderBesturen(_bestuurSearch)), 140);
function searchBesturen(v) { _bestuurSearch = v; _bestuurPage = 1; _renderBesturenDeb(); }
function gotoBesturenPage(p) { _bestuurPage = p; smartRender(() => renderBesturen(_bestuurSearch)); }

function renderBesturen(search = '') {
  const thStyle = `cursor:pointer;user-select:none;white-space:nowrap;`;
  const arrow = col => _bestuurSortCol !== col
    ? `<span style="opacity:.25;margin-left:4px;font-size:10px">⇅</span>`
    : _bestuurSortDir === 'asc'
      ? `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▲</span>`
      : `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▼</span>`;
  const th = (col, label) => `<th style="${thStyle}" onclick="sortBesturen('${col}')">${label}${arrow(col)}</th>`;

  const q = search.toLowerCase();
  let filtered = DB.besturen.filter(b => !q || b.naam.toLowerCase().includes(q));
  // Cache scholen-counts: 1× lookup per bestuur ipv 1× per comparator-call
  // (sort gebruikt comparator ~n·log(n) keer; zonder cache is dat een extra
  // Map.get per vergelijking, nu maar 1× per bestuur).
  const countCache = new Map();
  const countFor = id => {
    let n = countCache.get(id);
    if (n === undefined) { n = scholenVanBestuur(id).length; countCache.set(id, n); }
    return n;
  };
  const dir = _bestuurSortDir === 'asc' ? 1 : -1;
  filtered = [...filtered].sort((a, b) => {
    if (_bestuurSortCol === 'naam')    return dir * a.naam.localeCompare(b.naam, 'nl');
    if (_bestuurSortCol === 'scholen') return dir * (countFor(a.id) - countFor(b.id));
    return 0;
  });

  const pageInfo = paginate(filtered, _bestuurPage);
  const pageSlice = pageInfo.slice;

  return `
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div class="search-wrap" style="flex:1">
        <span class="search-icon">${svgIcon('search', 15)}</span>
        <input id="search-besturen" type="text" placeholder="Zoek bestuur…" value="${esc(search)}" oninput="searchBesturen(this.value)" style="padding-left:34px"/>
      </div>
      <button class="btn btn-secondary" onclick="exportBesturenExcel()" style="border-color:var(--groen);color:var(--groen);font-weight:700">${svgIcon('download', 15)} Excel export</button>
      <button class="btn btn-primary" onclick="openBestuurModal()">${svgIcon('add')} Nieuw bestuur</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>${th('naam', 'Naam bestuur')}${th('scholen', 'Scholen')}<th>Website</th><th></th></tr></thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="4"><div class="empty-state"><p>Geen besturen gevonden</p></div></td></tr>`
              : pageSlice.map(b => {
                  const cnt = countFor(b.id);
                  return `<tr class="clickable-row" onclick="navigate('bestuur-detail','${b.id}')">
                    <td style="font-weight:500">${esc(b.naam)}</td>
                    <td style="color:var(--ink3);font-size:13px">${cnt} ${cnt === 1 ? 'school' : 'scholen'}</td>
                    <td>${b.website ? `<a href="${esc(b.website)}" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue);font-size:13px">${esc(b.website)}</a>` : '–'}</td>
                    <td onclick="event.stopPropagation()" style="width:50px">
                      <div class="row-actions">
                        <button class="btn btn-ghost btn-icon btn-sm btn-del" title="Verwijderen" onclick="delBestuur('${b.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(pageInfo, 'gotoBesturenPage')}
    </div>`;
}

function exportBesturenExcel() {
  const q = (_bestuurSearch || '').toLowerCase();
  const filtered = DB.besturen
    .filter(b => !q || b.naam.toLowerCase().includes(q))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));

  const Q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const titel = 'Besturenoverzicht 2xDenken';

  const rows = [
    [Q(titel), '', '', '', '', ''],
    ['', '', '', '', '', ''],
    [Q('Naam bestuur'), Q('Adres'), Q('Website'), Q('Aantal scholen'), Q('Aantal contacten'), Q('Aantal facturen')],
    ...filtered.map(b => {
      const scholen = scholenVanBestuur(b.id);
      const aantContact = scholen.reduce((n, s) => n + contactenVanSchool(s.id).length, 0);
      const aantFact    = scholen.reduce((n, s) => n + facturenVanSchool(s.id).length, 0);
      return [Q(b.naam), Q(b.adres), Q(b.website), scholen.length, aantContact, aantFact];
    }),
    ['', '', '', '', '', ''],
    [Q(`Geëxporteerd op: ${new Date().toLocaleDateString('nl-NL')} | Aantal besturen: ${filtered.length}`), '', '', '', '', ''],
  ];

  const csv  = '\uFEFF' + rows.map(r => r.join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `2xDenken_besturen.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openBestuurModal(id = '') {
  const b = getBestuur(id);
  showModal(b ? 'Bestuur bewerken' : 'Nieuw bestuur',
    `<div class="form-group"><label>Naam bestuur *</label><input type="text" id="f-naam" value="${esc(b?.naam || '')}" placeholder="Stichting Primair Onderwijs…"/></div>
     <div class="form-group"><label>Website</label><input type="url" id="f-web" value="${esc(b?.website || '')}" placeholder="https://…"/></div>
     <div class="form-group"><label>Adres</label><input type="text" id="f-adres" value="${esc(b?.adres || '')}" placeholder="Straat en huisnummer"/></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${b ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delBestuur('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveBestuur('${id}')">Opslaan</button>`);
}

function renderBestuurDetail(id) {
  const b = getBestuur(id);
  if (!b) return '<p>Niet gevonden</p>';
  const scholen  = scholenVanBestuur(id);
  const dossiers = scholen.flatMap(s => dossiersVanSchool(s.id)).filter(d => !isFactuurDossier(d)).sort((a, b) => new Date(b.datum) - new Date(a.datum));

  const tabs = [['scholen', 'Scholen'], ['dossier', 'Dossier'], ['agenda', 'Agenda']];
  let tabContent = '';

  if (bestuurTab === 'scholen') {
    tabContent = `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn btn-secondary" onclick="openLinkSchoolModal('${id}')">${svgIcon('add')} Bestaande school koppelen</button>
        <button class="btn btn-primary" onclick="openSchoolModal('','${id}')">${svgIcon('add')} Nieuwe school</button>
      </div>
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
                    <td>${contactenVanSchool(s.id).length}</td>
                    <td>${dossiersVanSchool(s.id).filter(d => !isFactuurDossier(d)).length}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } else if (bestuurTab === 'dossier') {
    tabContent = `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn btn-secondary" onclick="openBestuurBestandModal('${id}')">${svgIcon('add')} Bestand toevoegen</button>
        <button class="btn btn-primary" onclick="openBestuurDossierModal('${id}')">${svgIcon('add')} Notitie toevoegen</button>
      </div>
      ${dossiers.length === 0
        ? `<div class="card"><div class="empty-state">${svgIcon('note', 36)}<p>Nog geen dossiernotities</p></div></div>`
        : `<div class="dossier-list">${dossiers.map(d => {
            const school = getSchool(d.schoolId);
            return renderDossierItem(d, { delBtn: 'delDossierBestuur', delArg: id, schoolLabel: school?.naam });
          }).join('')}</div>`}`;
  } else if (bestuurTab === 'agenda') {
    const agendaItems = [...agendaVanBestuur(id)].sort((a, b) => a.datum.localeCompare(b.datum) || (a.beginTijd || '').localeCompare(b.beginTijd || ''));
    const vandaag = new Date().toISOString().slice(0, 10);
    const komend = agendaItems.filter(a => a.datum >= vandaag);
    const verlopen = agendaItems.filter(a => a.datum < vandaag);
    tabContent = `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="openAgendaModal('','','','','${id}')">${svgIcon('calendar')} Afspraak plannen</button>
      </div>
      ${agendaItems.length === 0
        ? `<div class="card"><div class="empty-state">${svgIcon('calendar', 36)}<p>Nog geen afspraken voor dit bestuur</p></div></div>`
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

function openLinkSchoolModal(bestuurId) {
  const b = getBestuur(bestuurId);
  if (!b) return;
  const beschikbaar = DB.scholen
    .filter(s => s.bestuurId !== bestuurId)
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));

  if (beschikbaar.length === 0) {
    showToast('Alle scholen zijn al aan dit bestuur gekoppeld.');
    return;
  }

  const opts = beschikbaar.map(s => {
    const huidig = getBestuur(s.bestuurId);
    const suffix = huidig ? ` — nu bij ${huidig.naam}` : ' — nog zonder bestuur';
    return `<option value="${s.id}">${esc(s.naam)}${esc(suffix)}</option>`;
  }).join('');

  showModal('School koppelen aan ' + esc(b.naam),
    `<div class="form-group"><label>School *</label>
       <select id="f-school-link"><option value="">— Kies school —</option>${opts}</select>
     </div>
     <div style="font-size:12px;color:var(--navy4);margin-top:-6px">Een school die al bij een ander bestuur staat, wordt na koppelen daar weggehaald.</div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="linkSchoolAanBestuur('${bestuurId}')">Koppelen</button>`);
}

async function linkSchoolAanBestuur(bestuurId) {
  const schoolId = document.getElementById('f-school-link').value;
  if (!schoolId) return alert('Kies een school');
  showLoading();
  try {
    await supa(`/rest/v1/scholen?id=eq.${schoolId}`, { method: 'PATCH', body: JSON.stringify({ bestuur_id: bestuurId }) });
    DB.scholen = DB.scholen.map(s => s.id === schoolId ? { ...s, bestuurId } : s);
    closeModal();
    renderContent();
    showToast('School gekoppeld');
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

function openBestuurDossierModal(bestuurId) {
  const b = getBestuur(bestuurId);
  const scholen = scholenVanBestuur(bestuurId);
  const schoolOpts = scholen.map(s => `<option value="${s.id}">${esc(s.naam)}</option>`).join('');
  showModal('Notitie toevoegen — ' + esc(b?.naam || ''),
    `<div class="form-group"><label>School *</label>
       <select id="f-school-dos"><option value="">— Kies school —</option>${schoolOpts}</select>
     </div>
     <div class="form-group"><label>Onderwerp *</label>
       <input type="text" id="f-onderwerp" placeholder="Korte titel van deze notitie"/>
     </div>
     <div class="form-group"><label>Notitie *</label>
       <textarea id="f-tekst" rows="5" placeholder="Wat is er besproken, afgesproken of opgemerkt?"></textarea>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="saveDossierBestuur('${bestuurId}')">Opslaan</button>`);
}

function openBestuurBestandModal(bestuurId) {
  const b = getBestuur(bestuurId);
  const scholen = scholenVanBestuur(bestuurId);
  const schoolOpts = scholen.map(s => `<option value="${s.id}">${esc(s.naam)}</option>`).join('');
  showModal('Bestand toevoegen — ' + esc(b?.naam || ''),
    `<div class="form-group"><label>School *</label>
       <select id="f-school-dos"><option value="">— Kies school —</option>${schoolOpts}</select>
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
     <button class="btn btn-primary" onclick="saveBestandBestuur('${bestuurId}')">Opslaan</button>`);
  setTimeout(() => {
    const inp = document.getElementById('f-bestand');
    if (inp) inp.addEventListener('change', () => {
      const prev = document.getElementById('f-bestand-preview');
      if (prev) prev.innerHTML = [...inp.files].map(f => `<span style="background:var(--bg2);border:1px solid var(--bg3);border-radius:5px;padding:3px 8px;font-size:12px">📎 ${esc(f.name)}</span>`).join('');
    });
  }, 50);
}
