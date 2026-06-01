// ════════════════════════════════════════════════════════════════
// KOSTEN OVERZICHT — analyse van inkoopfacturen per periode
// ════════════════════════════════════════════════════════════════

let _kostJaar     = prefGet('kost.jaar', String(new Date().getFullYear()));
let _kostType     = prefGet('kost.type', 'alle');
let _kostVergelijk = prefGet('kost.vergelijk', 'geen'); // 'geen' | 'jaar'
let _kostGrafiek  = prefGet('kost.grafiek', 'maand');   // 'maand' | 'type'
let _kostSortCol  = prefGet('kost.sortCol', 'factuurdatum');
let _kostSortDir  = prefGet('kost.sortDir', 'desc');

function setKostJaar(v)        { _kostJaar = v; prefSet('kost.jaar', v); smartRender(renderKostenOverzichtPage); }
function setKostType(v)        { _kostType = v || 'alle'; prefSet('kost.type', _kostType); smartRender(renderKostenOverzichtPage); }
function setKostVergelijk(v)   { _kostVergelijk = v; prefSet('kost.vergelijk', v); smartRender(renderKostenOverzichtPage); }
function setKostGrafiek(v)     { _kostGrafiek = v === 'type' ? 'type' : 'maand'; prefSet('kost.grafiek', _kostGrafiek); smartRender(renderKostenOverzichtPage); }

function sortKost(col) {
  if (_kostSortCol === col) { _kostSortDir = _kostSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _kostSortCol = col; _kostSortDir = col === 'bedrag' || col === 'factuurdatum' ? 'desc' : 'asc'; }
  prefSet('kost.sortCol', _kostSortCol);
  prefSet('kost.sortDir', _kostSortDir);
  smartRender(renderKostenOverzichtPage);
}

function _kostFilterFacturen(jaar = _kostJaar, type = _kostType) {
  return (DB.inkoopfacturen || []).filter(f => {
    if (jaar !== 'alle' && (f.factuurdatum || '').slice(0, 4) !== jaar) return false;
    if (type !== 'alle' && (f.kostenTypeId || '') !== type) return false;
    return true;
  });
}

function _kostMaandLabel(ym) {
  const [y, m] = ym.split('-');
  const maandNamen = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${maandNamen[Number(m) - 1] || ''} ${y}`;
}

function _kostAggMaand(facturen) {
  const map = new Map();
  for (const f of facturen) {
    const ym = (f.factuurdatum || '').slice(0, 7);
    if (!ym) continue;
    const cur = map.get(ym) || { key: ym, label: _kostMaandLabel(ym), totaal: 0, aantal: 0 };
    cur.totaal += Number(f.bedrag) || 0;
    cur.aantal++;
    map.set(ym, cur);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function _kostAggType(facturen) {
  const map = new Map();
  for (const f of facturen) {
    const key = f.kostenTypeId || '(geen)';
    const cur = map.get(key) || { key, label: f.kostenTypeId ? kostenTypeLabel(f.kostenTypeId) : 'Geen type', totaal: 0, aantal: 0, kleur: f.kostenTypeId ? getKostenTypeInfo(f.kostenTypeId).color : '#6B6B8A' };
    cur.totaal += Number(f.bedrag) || 0;
    cur.aantal++;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.totaal - a.totaal);
}

function _kostStaafgrafiek(rows, opts = {}) {
  if (!rows.length) return `<div class="card"><div class="empty-state">${svgIcon('euro', 36)}<p>Geen kosten in deze periode</p></div></div>`;
  const max = Math.max(1, ...rows.map(r => r.totaal));
  const totaal = rows.reduce((s, r) => s + r.totaal, 0);

  return `
    <div class="card" style="margin-bottom:18px">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h3>${esc(opts.title || 'Verdeling')}</h3>
        <div role="group" style="display:inline-flex;background:white;border:2px solid var(--bg3);border-radius:var(--r);overflow:hidden">
          <button onclick="setKostGrafiek('maand')" style="border:none;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:700;${_kostGrafiek === 'maand' ? 'background:var(--accent);color:white' : 'background:white;color:var(--navy3)'}">Per maand</button>
          <button onclick="setKostGrafiek('type')" style="border:none;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:700;${_kostGrafiek === 'type' ? 'background:var(--accent);color:white' : 'background:white;color:var(--navy3)'}">Per type</button>
        </div>
      </div>
      <div class="card-body" style="padding:16px 22px">
        <div style="display:flex;flex-direction:column;gap:8px">
          ${rows.map((r, i) => {
            const pct = max > 0 ? (r.totaal / max) * 100 : 0;
            const aandeel = totaal > 0 ? (r.totaal / totaal * 100) : 0;
            const barColor = r.kleur || 'var(--accent)';
            return `
            <div style="display:grid;grid-template-columns:minmax(110px,140px) 1fr 110px;gap:10px;align-items:center;font-size:13px">
              <span style="font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.label)}">${esc(r.label)}</span>
              <div style="position:relative;height:22px;background:var(--bg);border-radius:6px;overflow:hidden">
                <div style="position:absolute;left:0;top:0;bottom:0;width:${pct.toFixed(2)}%;background:${barColor};border-radius:6px;transition:width .25s ease"></div>
                <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:var(--navy3)">${aandeel.toFixed(0)}%</span>
              </div>
              <span style="font-weight:700;color:var(--navy);text-align:right;white-space:nowrap">${fmtEuro(r.totaal)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function renderKostenOverzichtPage() {
  if (!Array.isArray(DB.inkoopfacturen)) DB.inkoopfacturen = [];
  ensureKostenTypes();

  const allJaren = [...new Set((DB.inkoopfacturen || []).map(f => (f.factuurdatum || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  const huidigJaar = String(new Date().getFullYear());
  if (!allJaren.includes(_kostJaar) && _kostJaar !== 'alle') {
    _kostJaar = allJaren.includes(huidigJaar) ? huidigJaar : (allJaren[0] || 'alle');
  }

  const facturen = _kostFilterFacturen();
  const totaal = facturen.reduce((s, f) => s + (Number(f.bedrag) || 0), 0);
  const aantal = facturen.length;
  const monthSet = new Set(facturen.map(f => (f.factuurdatum || '').slice(0, 7)).filter(Boolean));
  const gemPerMaand = monthSet.size ? totaal / monthSet.size : 0;

  // Vergelijking met vorig jaar
  let vergelijking = null;
  if (_kostVergelijk === 'jaar' && _kostJaar !== 'alle') {
    const vorigJaar = String(Number(_kostJaar) - 1);
    const vorigFacturen = _kostFilterFacturen(vorigJaar, _kostType);
    const vorigTotaal = vorigFacturen.reduce((s, f) => s + (Number(f.bedrag) || 0), 0);
    const verschil = totaal - vorigTotaal;
    const pct = vorigTotaal > 0 ? (verschil / vorigTotaal) * 100 : null;
    vergelijking = { vorigJaar, vorigTotaal, verschil, pct };
  }

  const rowsMaand = _kostAggMaand(facturen);
  const rowsType = _kostAggType(facturen).map(r => ({ ...r, label: r.label }));
  const grafiekRows = _kostGrafiek === 'type' ? rowsType : rowsMaand;
  const grafiekTitle = _kostGrafiek === 'type' ? 'Kosten per type' : 'Kosten per maand';

  // Tabel
  const dir = _kostSortDir === 'asc' ? 1 : -1;
  const sorted = [...facturen].sort((a, b) => {
    switch (_kostSortCol) {
      case 'factuurdatum': return dir * ((a.factuurdatum || '') < (b.factuurdatum || '') ? -1 : (a.factuurdatum || '') > (b.factuurdatum || '') ? 1 : 0);
      case 'leverancier':  return dir * (a.leverancier || '').localeCompare(b.leverancier || '', 'nl');
      case 'type':         return dir * kostenTypeLabel(a.kostenTypeId).localeCompare(kostenTypeLabel(b.kostenTypeId), 'nl');
      case 'bedrag':       return dir * ((a.bedrag || 0) - (b.bedrag || 0));
      default: return 0;
    }
  });

  const thStyle = `cursor:pointer;user-select:none;white-space:nowrap;`;
  const arrow = col => _kostSortCol !== col
    ? `<span style="opacity:.25;margin-left:4px;font-size:10px">⇅</span>`
    : _kostSortDir === 'asc' ? `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▲</span>` : `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▼</span>`;
  const th = (col, label, extra = '') =>
    `<th style="${thStyle}${extra}" onclick="sortKost('${col}')">${label}${arrow(col)}</th>`;

  const typeOpts = getKostenTypeList()
    .map(t => `<option value="${t.id}"${_kostType === t.id ? ' selected' : ''}>${esc(t.naam)}</option>`).join('');

  const kpiVergelijk = vergelijking ? `
    <div style="background:white;border:1px solid var(--bg3);border-radius:var(--r2);padding:12px 16px;display:flex;flex-direction:column;justify-content:center">
      <span style="font-size:11px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.5px">vs ${vergelijking.vorigJaar}</span>
      <div style="display:flex;align-items:baseline;gap:8px;margin-top:3px">
        <span style="font-size:17px;font-weight:800;color:${vergelijking.verschil >= 0 ? '#C0392B' : '#2E7D52'}">${vergelijking.verschil >= 0 ? '+' : ''}${fmtEuro(vergelijking.verschil)}</span>
        ${vergelijking.pct !== null ? `<span style="font-size:12px;font-weight:700;color:var(--navy4)">${vergelijking.pct >= 0 ? '+' : ''}${vergelijking.pct.toFixed(1)}%</span>` : ''}
      </div>
      <span style="font-size:11px;color:var(--navy4);margin-top:2px">${fmtEuro(vergelijking.vorigTotaal)} vorig jaar</span>
    </div>` : '';

  return `
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <select onchange="setKostJaar(this.value)"
        style="padding:9px 13px;border:2px solid var(--bg3);border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:13.5px;font-weight:600;color:var(--navy);background:white;cursor:pointer;min-width:120px;width:auto;flex:0 0 auto">
        <option value="alle"${_kostJaar === 'alle' ? ' selected' : ''}>Alle jaren</option>
        ${allJaren.map(j => `<option value="${j}"${_kostJaar === j ? ' selected' : ''}>${j}</option>`).join('')}
      </select>
      <select onchange="setKostType(this.value)"
        style="padding:9px 13px;border:2px solid var(--bg3);border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:13.5px;font-weight:600;color:var(--navy);background:white;cursor:pointer;min-width:150px;width:auto;flex:0 0 auto">
        <option value="alle"${_kostType === 'alle' ? ' selected' : ''}>Alle types</option>
        ${typeOpts}
      </select>
      <select onchange="setKostVergelijk(this.value)"
        style="padding:9px 13px;border:2px solid var(--bg3);border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:13.5px;font-weight:600;color:var(--navy);background:white;cursor:pointer;min-width:170px;width:auto;flex:0 0 auto">
        <option value="geen"${_kostVergelijk === 'geen' ? ' selected' : ''}>Geen vergelijking</option>
        <option value="jaar"${_kostVergelijk === 'jaar' ? ' selected' : ''}>vs. vorig jaar</option>
      </select>
      <div style="flex:1"></div>
      <button class="btn btn-secondary btn-sm" onclick="exportKostenExcel()"
        style="display:flex;align-items:center;gap:6px;white-space:nowrap;border-color:var(--groen);color:var(--groen);font-weight:700">
        ${svgIcon('download', 15)} Excel
      </button>
      <button class="btn btn-secondary btn-sm" onclick="exportKostenPDF()"
        style="display:flex;align-items:center;gap:6px;white-space:nowrap">
        ${svgIcon('eye', 15)} PDF
      </button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:14px">
      <div style="background:white;border:1px solid var(--bg3);border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.5px">Totaal</span>
        <span style="font-size:17px;font-weight:800;color:var(--navy)">${fmtEuro(totaal)}</span>
      </div>
      <div style="background:white;border:1px solid var(--bg3);border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.5px">Facturen</span>
        <span style="font-size:17px;font-weight:800;color:var(--navy)">${aantal}</span>
      </div>
      <div style="background:white;border:1px solid var(--bg3);border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.5px">Gem./maand</span>
        <span style="font-size:17px;font-weight:800;color:var(--navy)">${fmtEuro(gemPerMaand)}</span>
      </div>
      ${kpiVergelijk}
    </div>

    ${_kostStaafgrafiek(grafiekRows, { title: grafiekTitle })}

    <div class="card">
      <div class="card-header"><h3>Alle inkoopfacturen ${_kostJaar === 'alle' ? '' : `(${esc(_kostJaar)})`}</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            ${th('factuurdatum', 'Datum')}
            ${th('leverancier', 'Leverancier')}
            ${th('type', 'Type')}
            <th>Omschrijving</th>
            ${th('bedrag', 'Bedrag', 'text-align:right')}
          </tr></thead>
          <tbody>
            ${sorted.length === 0
              ? `<tr><td colspan="5"><div class="empty-state"><p>Geen kosten in deze selectie</p></div></td></tr>`
              : sorted.map(f => `<tr class="clickable-row" onclick="openInkoopfactuurModal('${f.id}')">
                  <td style="white-space:nowrap">${fmtDateShort(f.factuurdatum)}</td>
                  <td style="font-weight:600">${esc(f.leverancier || '')}${f.factuurnummer ? `<div style="font-size:11px;color:var(--navy4);margin-top:2px">${esc(f.factuurnummer)}</div>` : ''}</td>
                  <td>${f.kostenTypeId ? kostenTypeBadge(f.kostenTypeId) : `<span style="font-size:11px;color:var(--navy4)">–</span>`}</td>
                  <td style="font-size:12.5px;color:var(--navy3)">${esc(f.omschrijving || '')}${(f.isRecurring && !f.parentId) ? ` <span title="Terugkerend" style="color:var(--accent);font-weight:700">🔁</span>` : (f.parentId ? ` <span title="Uit terugkerende reeks" style="color:var(--navy4)">🔁</span>` : '')}</td>
                  <td style="font-weight:700;white-space:nowrap;text-align:right">${fmtEuro(f.bedrag || 0)}</td>
                </tr>`).join('')}
          </tbody>
          ${sorted.length > 0 ? `<tfoot><tr style="background:var(--bg)"><td colspan="4" style="font-weight:700;text-align:right">Totaal</td><td style="font-weight:800;text-align:right;font-size:14px;color:var(--navy)">${fmtEuro(totaal)}</td></tr></tfoot>` : ''}
        </table>
      </div>
    </div>`;
}

// ── Excel-export ─────────────────────────────────────────────────
function exportKostenExcel() {
  const facturen = _kostFilterFacturen();
  if (!facturen.length) { showToast('Geen kosten om te exporteren', 'error'); return; }

  const sorted = [...facturen].sort((a, b) => (a.factuurdatum || '') < (b.factuurdatum || '') ? -1 : 1);
  const Q = s => '"' + String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ').replace(/\t/g, ' ') + '"';
  const EUR = n => Number(n || 0).toFixed(2).replace('.', ',');

  const jaarLabel = _kostJaar === 'alle' ? 'alle jaren' : _kostJaar;
  const typeLabel = _kostType === 'alle' ? 'alle types' : kostenTypeLabel(_kostType);
  const titel = `Kostenoverzicht 2xDenken — ${jaarLabel} · ${typeLabel}`;
  const totaal = sorted.reduce((s, f) => s + (Number(f.bedrag) || 0), 0);

  const headers = ['Datum', 'Leverancier', 'Factuurnr', 'Type', 'Omschrijving', 'Bedrag (€)', 'Recurring', 'Notitie'];
  const cols = headers.length;
  const empty = Array(cols).fill('');

  // Per type subtotalen
  const perType = _kostAggType(sorted);

  const rows = [
    [Q(titel), ...Array(cols - 1).fill('')],
    empty,
    headers.map(Q),
    ...sorted.map(f => {
      const rec = f.isRecurring && !f.parentId
        ? `Template (${f.recurringInterval || 'maand'})`
        : (f.parentId ? 'Auto-gegenereerd' : '');
      return [
        Q(fmtDateShort(f.factuurdatum)),
        Q(f.leverancier || ''),
        Q(f.factuurnummer || ''),
        Q(kostenTypeLabel(f.kostenTypeId)),
        Q(f.omschrijving || ''),
        EUR(f.bedrag),
        Q(rec),
        Q(f.notitie || ''),
      ];
    }),
    empty,
    [Q('SUBTOTAAL PER TYPE'), ...Array(cols - 1).fill('')],
    ...perType.map(r => [Q(r.label), '', '', '', `${r.aantal} fact.`, EUR(r.totaal), '', '']),
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
  a.download = `2xDenken_kosten_${_kostJaar === 'alle' ? 'allejaren' : _kostJaar}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`${sorted.length} ko${sorted.length === 1 ? 'st' : 'sten'} geëxporteerd`);
}

// ── PDF-export (A4 landscape print window, zelfde stijl als uitvoeringen) ──
function exportKostenPDF() {
  const facturen = _kostFilterFacturen();
  if (!facturen.length) { showToast('Geen kosten om te exporteren', 'error'); return; }
  const sorted = [...facturen].sort((a, b) => (a.factuurdatum || '') < (b.factuurdatum || '') ? -1 : 1);

  const totaal = sorted.reduce((s, f) => s + (Number(f.bedrag) || 0), 0);
  const perType = _kostAggType(sorted);
  const monthSet = new Set(sorted.map(f => (f.factuurdatum || '').slice(0, 7)).filter(Boolean));
  const gemPerMaand = monthSet.size ? totaal / monthSet.size : 0;

  const jaarLabel = _kostJaar === 'alle' ? 'Alle jaren' : `Jaar ${_kostJaar}`;
  const typeLabel = _kostType === 'alle' ? 'Alle types' : kostenTypeLabel(_kostType);
  const filterDesc = `${jaarLabel} · ${typeLabel}`;
  const exportDate = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  const fmtDutchDate = (iso) => {
    if (!iso) return '–';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('nl-NL');
  };
  const fmtEurStr = (n) => '€ ' + Number(n || 0).toFixed(2).replace('.', ',');

  const rowsHtml = sorted.map(f => {
    const recIcon = f.isRecurring && !f.parentId ? ' 🔁' : (f.parentId ? ' <span style="color:#999">🔁</span>' : '');
    return `<tr>
      <td class="nowrap">${fmtDutchDate(f.factuurdatum)}</td>
      <td><strong>${esc(f.leverancier || '–')}</strong>${f.factuurnummer ? `<div class="sub">${esc(f.factuurnummer)}</div>` : ''}</td>
      <td>${esc(kostenTypeLabel(f.kostenTypeId) || '–')}</td>
      <td>${esc(f.omschrijving || '')}${recIcon}</td>
      <td class="nowrap right">${fmtEurStr(f.bedrag)}</td>
    </tr>`;
  }).join('');

  const perTypeHtml = perType.map(r => `<tr>
    <td>${esc(r.label)}</td>
    <td class="right">${r.aantal}</td>
    <td class="right"><strong>${fmtEurStr(r.totaal)}</strong></td>
  </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8"/>
<title>Kostenoverzicht — 2xDenken</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--teal:#2C8C8A;--teal-l:#E8F3F2;--ink:#2A2F3A;--ink-l:#5A6270;--ink-xl:#8B92A0;--line:#E8E4DC;--bg:#FAF7F2}
  body{font-family:'Nunito',Arial,sans-serif;font-size:9.5pt;color:var(--ink);background:#fff;line-height:1.45}
  @page{size:A4 landscape;margin:12mm}
  @media print{.no-print{display:none!important}}
  .page{padding:18px 22px}
  .header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--teal)}
  h1{font-size:18pt;font-weight:800;color:var(--teal);letter-spacing:-0.3px}
  h2{font-size:11pt;font-weight:700;color:var(--ink-l);text-transform:uppercase;letter-spacing:0.6px;margin:18px 0 8px}
  .subtitle{font-size:10pt;color:var(--ink-l);margin-top:2px}
  .meta{font-size:9pt;color:var(--ink-l);text-align:right;line-height:1.6}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
  .stat{background:var(--teal-l);border-radius:6px;padding:9px 12px}
  .stat-label{font-size:8pt;color:var(--ink-l);text-transform:uppercase;letter-spacing:0.6px;font-weight:700}
  .stat-value{font-size:14pt;font-weight:800;color:var(--teal);margin-top:1px}
  table{width:100%;border-collapse:collapse;font-size:9pt}
  thead th{background:var(--bg);font-size:8.5pt;font-weight:700;color:var(--ink-l);text-transform:uppercase;letter-spacing:0.5px;text-align:left;padding:8px 10px;border-bottom:2px solid var(--line)}
  thead th.right{text-align:right}
  tbody td{padding:7px 10px;vertical-align:top;border-bottom:1px solid var(--line)}
  tbody tr:nth-child(even){background:#FAFAF7}
  td.nowrap{white-space:nowrap}
  td.right{text-align:right}
  .sub{font-size:8pt;color:var(--ink-xl);margin-top:1px}
  .totaal-row td{background:var(--teal-l);font-weight:800;border-top:2px solid var(--teal)}
  .footer{margin-top:14px;padding-top:10px;border-top:1px solid var(--line);font-size:8pt;color:var(--ink-xl);text-align:center}
  .print-bar{margin:10px 22px 0;display:flex;gap:10px}
  .pbtn{padding:9px 18px;border:none;border-radius:6px;font-family:'Nunito',sans-serif;font-size:12px;cursor:pointer;font-weight:700}
  .pb-p{background:var(--teal);color:white}
  .pb-s{background:#f0f0f0;color:#333;border:1px solid #ccc}
</style>
</head>
<body>
<div class="no-print print-bar">
  <button class="pbtn pb-p" onclick="window.print()">🖨 Afdrukken / Opslaan als PDF</button>
  <button class="pbtn pb-s" onclick="window.close()">Sluiten</button>
</div>
<div class="page">
  <div class="header">
    <div>
      <h1>Kostenoverzicht</h1>
      <div class="subtitle">${esc(filterDesc)}</div>
    </div>
    <div class="meta">
      <strong style="color:var(--ink)">2xDenken</strong><br/>
      Geëxporteerd op ${esc(exportDate)}
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-label">Totaal kosten</div><div class="stat-value">${fmtEurStr(totaal)}</div></div>
    <div class="stat"><div class="stat-label">Aantal facturen</div><div class="stat-value">${sorted.length}</div></div>
    <div class="stat"><div class="stat-label">Gemiddeld/maand</div><div class="stat-value">${fmtEurStr(gemPerMaand)}</div></div>
    <div class="stat"><div class="stat-label">Aantal types</div><div class="stat-value">${perType.length}</div></div>
  </div>

  <h2>Subtotalen per type</h2>
  <table>
    <thead><tr><th>Type</th><th class="right">Aantal</th><th class="right">Totaal</th></tr></thead>
    <tbody>${perTypeHtml}</tbody>
  </table>

  <h2>Alle inkoopfacturen</h2>
  <table>
    <thead>
      <tr>
        <th>Datum</th>
        <th>Leverancier</th>
        <th>Type</th>
        <th>Omschrijving</th>
        <th class="right">Bedrag</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="totaal-row"><td colspan="4" class="right">Totaal</td><td class="right">${fmtEurStr(totaal)}</td></tr>
    </tbody>
  </table>

  <div class="footer">2xDenken — Kostenoverzicht — Pagina <span class="pageNum"></span></div>
</div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) {
    showToast('Pop-up geblokkeerd. Sta pop-ups toe voor deze site.', 'error');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
