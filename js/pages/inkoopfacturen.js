// ════════════════════════════════════════════════════════════════
// INKOOPFACTUREN — werkpagina (CRUD + filters + KPI + Excel)
// ════════════════════════════════════════════════════════════════

let _inkoopJaar          = prefGet('inkoop.jaar', String(new Date().getFullYear()));
let _inkoopType          = prefGet('inkoop.type', 'alle');
let _inkoopSearch        = '';
let _inkoopAlleenRecur   = prefGet('inkoop.alleenRecur', '0') === '1';
let _inkoopSortCol       = prefGet('inkoop.sortCol', 'factuurdatum');
let _inkoopSortDir       = prefGet('inkoop.sortDir', 'desc');
let _inkoopPage          = 1;

function gotoInkoopPage(p) { _inkoopPage = p; smartRender(() => renderInkoopfacturenPage(_inkoopSearch)); }

function sortInkoop(col) {
  if (_inkoopSortCol === col) { _inkoopSortDir = _inkoopSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _inkoopSortCol = col; _inkoopSortDir = col === 'bedrag' || col === 'factuurdatum' ? 'desc' : 'asc'; }
  prefSet('inkoop.sortCol', _inkoopSortCol);
  prefSet('inkoop.sortDir', _inkoopSortDir);
  _inkoopPage = 1;
  smartRender(() => renderInkoopfacturenPage(_inkoopSearch));
}

const _renderInkoopDeb = debounce(() => smartRender(() => renderInkoopfacturenPage(_inkoopSearch)), 140);
function filterInkoop(v)         { _inkoopSearch = v; _inkoopPage = 1; _renderInkoopDeb(); }
function setInkoopJaar(j)        { _inkoopJaar = j; prefSet('inkoop.jaar', j); _inkoopPage = 1; smartRender(() => renderInkoopfacturenPage(_inkoopSearch)); }
function setInkoopType(t)        { _inkoopType = t || 'alle'; prefSet('inkoop.type', _inkoopType); _inkoopPage = 1; smartRender(() => renderInkoopfacturenPage(_inkoopSearch)); }
function setInkoopAlleenRecur(b) { _inkoopAlleenRecur = !!b; prefSet('inkoop.alleenRecur', b ? '1' : '0'); _inkoopPage = 1; smartRender(() => renderInkoopfacturenPage(_inkoopSearch)); }

function _inkoopJaarVan(f) {
  if (!f?.factuurdatum) return '';
  return String(f.factuurdatum).slice(0, 4);
}

function _filterInkoopList() {
  ensureKostenTypes();
  const q = (_inkoopSearch || '').toLowerCase();
  return (DB.inkoopfacturen || []).filter(f => {
    const matchesSearch = !q
      || (f.leverancier || '').toLowerCase().includes(q)
      || (f.factuurnummer || '').toLowerCase().includes(q)
      || (f.omschrijving || '').toLowerCase().includes(q)
      || (f.notitie || '').toLowerCase().includes(q);
    const matchesJaar = _inkoopJaar === 'alle' || _inkoopJaarVan(f) === _inkoopJaar;
    const matchesType = _inkoopType === 'alle' || (f.kostenTypeId || '') === _inkoopType;
    const matchesRecur = !_inkoopAlleenRecur || f.isRecurring || !!f.parentId;
    return matchesSearch && matchesJaar && matchesType && matchesRecur;
  });
}

function _sortInkoopList(list) {
  const dir = _inkoopSortDir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (_inkoopSortCol) {
      case 'factuurdatum': return dir * ((a.factuurdatum || '') < (b.factuurdatum || '') ? -1 : (a.factuurdatum || '') > (b.factuurdatum || '') ? 1 : 0);
      case 'factuurnummer': return dir * (a.factuurnummer || '').localeCompare(b.factuurnummer || '', 'nl', { numeric: true });
      case 'leverancier':  return dir * (a.leverancier || '').localeCompare(b.leverancier || '', 'nl');
      case 'type':         return dir * kostenTypeLabel(a.kostenTypeId).localeCompare(kostenTypeLabel(b.kostenTypeId), 'nl');
      case 'omschrijving': return dir * (a.omschrijving || '').localeCompare(b.omschrijving || '', 'nl');
      case 'bedrag':       return dir * ((a.bedrag || 0) - (b.bedrag || 0));
      default: return 0;
    }
  });
}

function renderInkoopfacturenPage(search = '') {
  if (!Array.isArray(DB.inkoopfacturen)) DB.inkoopfacturen = [];
  ensureKostenTypes();

  const jaren = [...new Set((DB.inkoopfacturen || []).map(_inkoopJaarVan).filter(Boolean))].sort().reverse();
  const huidigJaar = String(new Date().getFullYear());
  if (!jaren.includes(_inkoopJaar) && _inkoopJaar !== 'alle') {
    _inkoopJaar = jaren.includes(huidigJaar) ? huidigJaar : (jaren[0] || 'alle');
  }

  const filtered = _filterInkoopList();
  const sorted = _sortInkoopList(filtered);

  const totaal = filtered.reduce((s, f) => s + (Number(f.bedrag) || 0), 0);
  const aantal = filtered.length;
  // Gemiddeld per maand: tel maanden waarin er kosten waren (in de selectie).
  const monthSet = new Set(filtered.map(f => (f.factuurdatum || '').slice(0, 7)).filter(Boolean));
  const gemPerMaand = monthSet.size ? totaal / monthSet.size : 0;
  // Totaal terugkerend per jaar (op basis van templates die nog actief zijn).
  const recurringTotaalPerJaar = (DB.inkoopfacturen || [])
    .filter(f => f.isRecurring && !f.parentId)
    .filter(f => !f.recurringEndDate || f.recurringEndDate >= new Date().toISOString().slice(0, 10))
    .reduce((s, f) => {
      const perJaar = f.recurringInterval === 'jaar' ? 1
        : f.recurringInterval === 'kwartaal' ? 4
        : 12; // maand-default
      return s + (Number(f.bedrag) || 0) * perJaar;
    }, 0);

  const pageInfo = paginate(sorted, _inkoopPage);
  const pageSlice = pageInfo.slice;

  const typeOpts = getKostenTypeList()
    .map(t => `<option value="${t.id}"${_inkoopType === t.id ? ' selected' : ''}>${esc(t.naam)}</option>`).join('');

  const thStyle = `cursor:pointer;user-select:none;white-space:nowrap;`;
  const arrow = col => _inkoopSortCol !== col
    ? `<span style="opacity:.25;margin-left:4px;font-size:10px">⇅</span>`
    : _inkoopSortDir === 'asc'
      ? `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▲</span>`
      : `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▼</span>`;
  const th = (col, label, extra = '') =>
    `<th style="${thStyle}${extra}" onclick="sortInkoop('${col}')">${label}${arrow(col)}</th>`;

  return `
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <div class="search-wrap" style="flex:1;min-width:200px">
        <span class="search-icon">${svgIcon('search', 15)}</span>
        <input id="search-inkoop" type="text" placeholder="Zoek leverancier, factuurnr of omschrijving…"
          value="${esc(search)}" oninput="filterInkoop(this.value)" style="padding-left:36px"/>
      </div>
      <select onchange="setInkoopJaar(this.value)"
        style="padding:9px 13px;border:2px solid var(--bg3);border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:13.5px;font-weight:600;color:var(--navy);background:white;cursor:pointer;min-width:100px">
        <option value="alle"${_inkoopJaar === 'alle' ? ' selected' : ''}>Alle jaren</option>
        ${jaren.map(j => `<option value="${j}"${_inkoopJaar === j ? ' selected' : ''}>${j}</option>`).join('')}
      </select>
      <select onchange="setInkoopType(this.value)"
        style="padding:9px 13px;border:2px solid var(--bg3);border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:13.5px;font-weight:600;color:var(--navy);background:white;cursor:pointer;min-width:150px">
        <option value="alle"${_inkoopType === 'alle' ? ' selected' : ''}>Alle types</option>
        ${typeOpts}
      </select>
      <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 11px;border:2px solid var(--bg3);border-radius:var(--r);background:white;font-size:13px;font-weight:600;color:var(--navy3);cursor:pointer">
        <input type="checkbox" ${_inkoopAlleenRecur ? 'checked' : ''} onchange="setInkoopAlleenRecur(this.checked)"/>
        🔁 Alleen terugkerend
      </label>
      <button class="btn btn-secondary btn-sm" onclick="exportInkoopExcel()"
        style="display:flex;align-items:center;gap:6px;white-space:nowrap;border-color:var(--groen);color:var(--groen);font-weight:700">
        ${svgIcon('invoice', 15)} Excel export
      </button>
      <button class="btn btn-primary btn-sm" onclick="openInkoopfactuurModal()">
        ${svgIcon('add', 14)} Nieuwe inkoopfactuur
      </button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:14px">
      <div style="background:white;border:1px solid var(--bg3);border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.5px">Totaal kosten</span>
        <span style="font-size:17px;font-weight:800;color:var(--navy)">${fmtEuro(totaal)}</span>
      </div>
      <div style="background:white;border:1px solid var(--bg3);border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.5px">Aantal facturen</span>
        <span style="font-size:17px;font-weight:800;color:var(--navy)">${aantal}</span>
      </div>
      <div style="background:white;border:1px solid var(--bg3);border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.5px">Gem./maand</span>
        <span style="font-size:17px;font-weight:800;color:var(--navy)">${fmtEuro(gemPerMaand)}</span>
      </div>
      <div style="background:var(--brand-s);border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--navy3);text-transform:uppercase;letter-spacing:.5px">🔁 Recurring/jaar</span>
        <span style="font-size:17px;font-weight:800;color:var(--navy)">${fmtEuro(recurringTotaalPerJaar)}</span>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            ${th('factuurdatum', 'Datum')}
            ${th('factuurnummer', 'Factuurnr')}
            ${th('leverancier', 'Leverancier')}
            ${th('type', 'Type')}
            ${th('omschrijving', 'Omschrijving')}
            ${th('bedrag', 'Bedrag', 'text-align:right')}
            <th style="width:60px;text-align:center">📎</th>
            <th style="width:60px;text-align:center">🔁</th>
            <th style="width:100px;text-align:center">Acties</th>
          </tr></thead>
          <tbody>
            ${aantal === 0
              ? `<tr><td colspan="9"><div class="empty-state">${svgIcon('invoice', 36)}<p style="margin-top:10px">Geen inkoopfacturen gevonden${(DB.inkoopfacturen || []).length === 0 ? '' : ' met deze filters'}.</p>${(DB.inkoopfacturen || []).length === 0 ? `<button class="btn btn-primary" onclick="openInkoopfactuurModal()" style="margin-top:14px">${svgIcon('add')} Eerste inkoopfactuur toevoegen</button>` : ''}</div></td></tr>`
              : pageSlice.map(f => {
                  const isTemplate = f.isRecurring && !f.parentId;
                  const isChild = !!f.parentId;
                  const recIndicator = isTemplate
                    ? `<span title="Terugkerend (template) — ${esc(f.recurringInterval || 'maand')}" style="color:var(--accent);font-weight:700">🔁</span>`
                    : (isChild ? `<span title="Auto-gegenereerd uit een terugkerende reeks" style="color:var(--navy4)">🔁</span>` : '');
                  return `<tr class="clickable-row" onclick="openInkoopfactuurModal('${f.id}')">
                    <td style="white-space:nowrap">${fmtDateShort(f.factuurdatum)}</td>
                    <td style="font-weight:600;white-space:nowrap;color:var(--navy)">${esc(f.factuurnummer || '—')}</td>
                    <td style="font-weight:600">${esc(f.leverancier || '')}</td>
                    <td>${f.kostenTypeId ? kostenTypeBadge(f.kostenTypeId) : `<span style="font-size:11px;color:var(--navy4)">–</span>`}</td>
                    <td style="font-size:12.5px;color:var(--navy3);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.omschrijving || '')}</td>
                    <td style="font-weight:700;white-space:nowrap;text-align:right">${fmtEuro(f.bedrag || 0)}</td>
                    <td style="text-align:center">${f.bestanden?.length ? `<span title="${f.bestanden.length} bestand${f.bestanden.length === 1 ? '' : 'en'}" style="color:var(--navy3)">📎 ${f.bestanden.length}</span>` : ''}</td>
                    <td style="text-align:center">${recIndicator}</td>
                    <td onclick="event.stopPropagation()">
                      <div style="display:flex;gap:4px;justify-content:center">
                        <button class="btn btn-ghost btn-icon btn-sm" title="Bewerken" onclick="openInkoopfactuurModal('${f.id}')">${svgIcon('edit', 14)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delInkoopfactuur('${f.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(pageInfo, 'gotoInkoopPage')}
    </div>`;
}

// ── Bestand-uploader helpers in modal ────────────────────────────
function renderInkoopBestanden(bestanden = [], inkoopId = '', editable = false) {
  if (!bestanden || !bestanden.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${bestanden.map((b, i) => `
    <span onclick="downloadInkoopBestand('${inkoopId}',${i})" title="Klik om te downloaden" style="display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--bg3);border-radius:999px;padding:7px 10px;font-size:12px;color:var(--navy2);cursor:pointer;max-width:100%">
      <span>${bijlageIcon(b.mimetype)} ${esc(b.naam)}</span>
      ${b.grootte ? `<span style="color:var(--navy4)">(${fmtBytes(b.grootte)})</span>` : ''}
      ${editable ? `<span onclick="event.stopPropagation();delInkoopBestand('${inkoopId}',${i})" title="Verwijderen" style="margin-left:2px;color:var(--s-rood);font-weight:800">×</span>` : ''}
    </span>`).join('')}</div>`;
}

function toggleInkoopRecurringFields(checked) {
  const wrap = document.getElementById('ink-recurring-wrap');
  if (wrap) wrap.style.display = checked ? '' : 'none';
}

function openInkoopfactuurModal(id = '') {
  ensureKostenTypes();
  const f = id ? (DB.inkoopfacturen || []).find(x => x.id === id) : null;
  const typeList = getKostenTypeList();
  const typeOpts = `<option value="">— Geen type —</option>` + typeList
    .map(t => `<option value="${t.id}"${f?.kostenTypeId === t.id ? ' selected' : ''}>${esc(t.naam)}</option>`).join('');

  const isChild = !!f?.parentId;
  const today = new Date().toISOString().slice(0, 10);
  const interval = f?.recurringInterval || 'maand';
  const bedragStr = f ? Number(f.bedrag).toFixed(2).replace('.', ',') : '';

  const title = f
    ? (isChild ? 'Inkoopfactuur bewerken (uit terugkerende reeks)' : (f.isRecurring ? 'Inkoopfactuur bewerken (terugkerend)' : 'Inkoopfactuur bewerken'))
    : 'Nieuwe inkoopfactuur';

  const childNotice = isChild
    ? `<div style="background:var(--brand-s);border-radius:var(--r);padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:var(--navy3)">
         🔁 Deze factuur is automatisch gegenereerd vanuit een terugkerende reeks. Wijzigingen hier raken alleen deze ene factuur, niet de hele reeks.
       </div>`
    : '';

  showModal(title,
    `${childNotice}
     <div class="form-row">
       <div class="form-group"><label>Leverancier *</label>
         <input type="text" id="f-ink-leverancier" value="${esc(f?.leverancier || '')}" placeholder="bijv. Microsoft, NS, Albert Heijn…"/></div>
       <div class="form-group"><label>Factuurnummer (van leverancier)</label>
         <input type="text" id="f-ink-nr" value="${esc(f?.factuurnummer || '')}" placeholder="optioneel"/></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label>Factuurdatum *</label>
         <input type="date" id="f-ink-datum" value="${esc(f?.factuurdatum || today)}"/></div>
       <div class="form-group"><label>Bedrag (€) *</label>
         <input type="text" inputmode="decimal" id="f-ink-bedrag" value="${esc(bedragStr)}" placeholder="0,00"/></div>
     </div>
     <div class="form-group"><label>Kostentype</label>
       <select id="f-ink-type">${typeOpts}</select>
       ${typeList.length === 0 ? `<div style="font-size:11px;color:var(--navy4);margin-top:4px">Geen kostentypes geconfigureerd. Voeg er één toe via <a onclick="closeModal();navigate('instellingen')" style="color:var(--blue);cursor:pointer;font-weight:600">Instellingen → Categorieën</a>.</div>` : ''}
     </div>
     <div class="form-group"><label>Omschrijving</label>
       <textarea id="f-ink-omschr" rows="2" placeholder="Wat is er gekocht / waarvoor?">${esc(f?.omschrijving || '')}</textarea></div>
     <div class="form-group" style="${isChild ? 'opacity:.5;pointer-events:none' : ''}">
       <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
         <input type="checkbox" id="f-ink-recurring" ${f?.isRecurring ? 'checked' : ''} onchange="toggleInkoopRecurringFields(this.checked)"/>
         🔁 Terugkerende kosten (worden automatisch gegenereerd)
       </label>
       <div id="ink-recurring-wrap" style="display:${f?.isRecurring ? '' : 'none'};margin-top:10px;background:var(--bg);padding:12px 14px;border-radius:var(--r)">
         <div class="form-row" style="margin-bottom:0">
           <div class="form-group"><label>Interval</label>
             <select id="f-ink-interval">
               <option value="maand"${interval === 'maand' ? ' selected' : ''}>Elke maand</option>
               <option value="kwartaal"${interval === 'kwartaal' ? ' selected' : ''}>Elk kwartaal</option>
               <option value="jaar"${interval === 'jaar' ? ' selected' : ''}>Elk jaar</option>
             </select></div>
           <div class="form-group"><label>Einddatum (optioneel)</label>
             <input type="date" id="f-ink-einddatum" value="${esc(f?.recurringEndDate || '')}"/></div>
         </div>
         <div style="font-size:11.5px;color:var(--navy4);margin-top:8px;line-height:1.5">
           Vanaf <strong>${esc(f?.factuurdatum || today)}</strong> wordt elke ${interval} automatisch een nieuwe inkoopfactuur aangemaakt met dezelfde gegevens, tot vandaag of tot de einddatum. Wijzig je het bedrag later, dan geldt dat alleen voor nieuw aangemaakte facturen.
         </div>
       </div>
     </div>
     <div class="form-group"><label>Notitie (intern)</label>
       <textarea id="f-ink-notitie" rows="2" placeholder="Eventuele aanvullende opmerkingen…">${esc(f?.notitie || '')}</textarea></div>
     <div class="form-group"><label>Document toevoegen</label>
       <input type="file" id="f-ink-bestand" multiple />
       <div style="font-size:11px;color:var(--navy4);margin-top:4px">Sleep meerdere bestanden tegelijk om bv. de PDF-factuur en betaalbewijs op te slaan.</div>
       ${f?.bestanden?.length ? `<div style="margin-top:10px;font-size:11px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.6px">Bestaande documenten</div>${renderInkoopBestanden(f.bestanden, id, true)}` : ''}
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${f ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delInkoopfactuur('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveInkoopfactuur('${id || ''}')">Opslaan</button>`, true);
}

// ── Excel-export ─────────────────────────────────────────────────
function exportInkoopExcel() {
  const sorted = _sortInkoopList(_filterInkoopList());
  if (!sorted.length) { showToast('Geen inkoopfacturen om te exporteren', 'error'); return; }

  const Q = s => '"' + String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ').replace(/\t/g, ' ') + '"';
  const EUR = n => Number(n || 0).toFixed(2).replace('.', ',');

  const jaarLabel = _inkoopJaar === 'alle' ? 'alle jaren' : _inkoopJaar;
  const typeLabel = _inkoopType === 'alle' ? 'alle types' : kostenTypeLabel(_inkoopType);
  const titel = `Inkoopfacturen 2xDenken — ${jaarLabel} · ${typeLabel}${_inkoopAlleenRecur ? ' · alleen terugkerend' : ''}`;
  const totaal = sorted.reduce((s, f) => s + (Number(f.bedrag) || 0), 0);

  const headers = ['Datum', 'Factuurnr', 'Leverancier', 'Type', 'Omschrijving', 'Bedrag (€)', 'Recurring', 'Notitie'];
  const cols = headers.length;
  const empty = Array(cols).fill('');

  const rows = [
    [Q(titel), ...Array(cols - 1).fill('')],
    empty,
    headers.map(Q),
    ...sorted.map(f => {
      const recurringLabel = f.isRecurring && !f.parentId
        ? `Template (${f.recurringInterval || 'maand'})`
        : (f.parentId ? 'Auto-gegenereerd' : '');
      return [
        Q(fmtDateShort(f.factuurdatum)),
        Q(f.factuurnummer || ''),
        Q(f.leverancier || ''),
        Q(kostenTypeLabel(f.kostenTypeId)),
        Q(f.omschrijving || ''),
        EUR(f.bedrag),
        Q(recurringLabel),
        Q(f.notitie || ''),
      ];
    }),
    empty,
    [Q('TOTAAL'), '', '', '', '', EUR(totaal), '', ''],
    empty,
    [Q(`Geëxporteerd op: ${new Date().toLocaleDateString('nl-NL')} | Aantal: ${sorted.length}`), ...Array(cols - 1).fill('')],
  ];

  const csv  = '﻿' + rows.map(r => r.join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `2xDenken_inkoopfacturen_${_inkoopJaar === 'alle' ? 'allejaren' : _inkoopJaar}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`${sorted.length} inkoopfactu${sorted.length === 1 ? 'ur' : 'ren'} geëxporteerd`);
}
