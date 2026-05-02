// ════════════════════════════════════════════════════════════════
// OMZET — Per school per periode, met grafiek
// ════════════════════════════════════════════════════════════════

let _omzetJaar     = String(new Date().getFullYear());
let _omzetStatus   = 'gefactureerd'; // 'gefactureerd' = verzonden+betaald, 'betaald', 'alle'
let _omzetSortCol  = 'bedrag';
let _omzetSortDir  = 'desc';
let _omzetTopOnly  = true;

const OMZET_TOP_N = 15;

function setOmzetJaar(v)   { _omzetJaar = v; smartRender(renderOmzetPage); }
function setOmzetStatus(v) { _omzetStatus = v; smartRender(renderOmzetPage); }
function toggleOmzetAlle() { _omzetTopOnly = !_omzetTopOnly; smartRender(renderOmzetPage); }
function sortOmzet(col) {
  if (_omzetSortCol === col) { _omzetSortDir = _omzetSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _omzetSortCol = col; _omzetSortDir = col === 'school' ? 'asc' : 'desc'; }
  smartRender(renderOmzetPage);
}

function _omzetMatchesStatus(f) {
  if (_omzetStatus === 'alle') return f.status !== 'concept';
  if (_omzetStatus === 'betaald') return f.status === 'betaald';
  return f.status === 'betaald' || f.status === 'verzonden';
}

function _omzetGetFacturen() {
  return (DB.facturen || []).filter(f => {
    if (!_omzetMatchesStatus(f)) return false;
    if (_omzetJaar === 'alle') return true;
    return getFactuurJaar(f) === _omzetJaar;
  });
}

function _omzetAggregeer(facturen) {
  const map = new Map();
  for (const f of facturen) {
    let key, kind;
    if (f.schoolId) { key = 'school:' + f.schoolId; kind = 'school'; }
    else if (f.bestuurId) { key = 'bestuur:' + f.bestuurId; kind = 'bestuur'; }
    else { key = 'geen'; kind = 'geen'; }
    if (!map.has(key)) map.set(key, {
      key, kind,
      schoolId: f.schoolId || null,
      bestuurId: !f.schoolId && f.bestuurId ? f.bestuurId : null,
      aantal: 0, totaal: 0, betaald: 0, openstaand: 0,
    });
    const r = map.get(key);
    r.aantal++;
    r.totaal += Number(f.totaal) || 0;
    if (f.status === 'betaald') r.betaald += Number(f.totaal) || 0;
    if (f.status === 'verzonden') r.openstaand += Number(f.totaal) || 0;
  }
  return [...map.values()].map(r => {
    if (r.kind === 'school') {
      const school = getSchool(r.schoolId);
      return {
        ...r,
        schoolNaam: school?.naam || '(Verwijderde school)',
        bestuurNaam: school ? (getBestuur(school.bestuurId)?.naam || '') : '',
        plaats: school?.plaats || '',
      };
    }
    if (r.kind === 'bestuur') {
      const best = getBestuur(r.bestuurId);
      return {
        ...r,
        schoolNaam: best ? `${best.naam} (bestuur)` : '(Verwijderd bestuur)',
        bestuurNaam: '',
        plaats: best?.plaats || '',
      };
    }
    return {
      ...r,
      schoolNaam: '(Geen school of bestuur gekoppeld)',
      bestuurNaam: '',
      plaats: '',
    };
  });
}

function _omzetSorteer(rows) {
  const dir = _omzetSortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (_omzetSortCol) {
      case 'school':  return dir * a.schoolNaam.localeCompare(b.schoolNaam, 'nl');
      case 'aantal':  return dir * (a.aantal - b.aantal);
      case 'bedrag':  return dir * (a.totaal - b.totaal);
      case 'betaald': return dir * (a.betaald - b.betaald);
      case 'open':    return dir * (a.openstaand - b.openstaand);
      default: return 0;
    }
  });
}

function _omzetBarChart(rows) {
  if (!rows.length) return '';
  const sorted = [...rows].sort((a, b) => b.totaal - a.totaal);
  const display = _omzetTopOnly ? sorted.slice(0, OMZET_TOP_N) : sorted;
  const max = display[0]?.totaal || 1;
  const totaalGetoond = display.reduce((s, r) => s + r.totaal, 0);

  return `
    <div class="card" style="margin-bottom:18px">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h3>Omzet per school${_omzetTopOnly && sorted.length > OMZET_TOP_N ? ` <span style="font-weight:500;color:var(--navy4);font-size:13px">— Top ${OMZET_TOP_N} van ${sorted.length}</span>` : ''}</h3>
        ${sorted.length > OMZET_TOP_N ? `<button class="btn btn-secondary btn-sm" onclick="toggleOmzetAlle()">${_omzetTopOnly ? 'Toon alle' : 'Toon top ' + OMZET_TOP_N}</button>` : ''}
      </div>
      <div class="card-body" style="padding:18px 24px">
        <div style="display:flex;flex-direction:column;gap:8px">
          ${display.map((r, i) => {
            const pct = max > 0 ? (r.totaal / max) * 100 : 0;
            const aandeel = totaalGetoond > 0 ? (r.totaal / totaalGetoond * 100) : 0;
            const betPct = r.totaal > 0 ? (r.betaald / r.totaal) * 100 : 0;
            const linkable = r.kind === 'school' && r.schoolId && getSchool(r.schoolId);
            return `
            <div style="display:grid;grid-template-columns:24px minmax(140px,180px) 1fr 110px;gap:10px;align-items:center;font-size:13px${linkable ? ';cursor:pointer' : ''}"
                 ${linkable ? `onclick="navigate('school-detail','${r.schoolId}')" title="Klik voor details"` : ''}>
              <span style="color:var(--navy4);font-weight:700;text-align:right">${i + 1}</span>
              <span style="font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.schoolNaam)}">${esc(r.schoolNaam)}</span>
              <div style="position:relative;height:22px;background:var(--bg);border-radius:6px;overflow:hidden">
                <div style="position:absolute;top:0;left:0;height:100%;width:${pct.toFixed(2)}%;background:linear-gradient(90deg,#2C8C8A 0%,#1ab8b8 100%);border-radius:6px;transition:width .3s"></div>
                ${betPct > 0 && betPct < 100 ? `<div style="position:absolute;top:0;left:0;height:100%;width:${(pct * betPct / 100).toFixed(2)}%;background:#2E7D52;border-radius:6px"></div>` : ''}
                <span style="position:relative;display:block;line-height:22px;padding-left:8px;font-size:11px;color:${pct > 30 ? 'white' : 'var(--navy3)'};font-weight:600;text-shadow:${pct > 30 ? '0 0 2px rgba(0,0,0,0.3)' : 'none'}">${aandeel.toFixed(1)}%</span>
              </div>
              <span style="text-align:right;font-weight:700;color:var(--navy);white-space:nowrap">${fmtEuro(r.totaal)}</span>
            </div>`;
          }).join('')}
        </div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--bg3);display:flex;gap:18px;flex-wrap:wrap;font-size:11.5px;color:var(--navy4)">
          <span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#2E7D52"></span>Betaald</span>
          <span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#1ab8b8"></span>Verzonden / openstaand</span>
        </div>
      </div>
    </div>`;
}

function renderOmzetPage() {
  if (!DB.facturen) DB.facturen = [];
  const jaren = [...new Set(DB.facturen.map(f => getFactuurJaar(f)).filter(Boolean))].sort().reverse();
  const huidigJaar = String(new Date().getFullYear());
  if (!jaren.includes(_omzetJaar) && _omzetJaar !== 'alle') {
    _omzetJaar = jaren.includes(huidigJaar) ? huidigJaar : (jaren[0] || 'alle');
  }

  const facturen = _omzetGetFacturen();
  const rows = _omzetAggregeer(facturen);
  const sorted = _omzetSorteer(rows);

  const totaal = rows.reduce((s, r) => s + r.totaal, 0);
  const totaalBetaald = rows.reduce((s, r) => s + r.betaald, 0);
  const totaalOpen = rows.reduce((s, r) => s + r.openstaand, 0);
  const aantalScholen = rows.length;
  const gemiddelde = aantalScholen ? totaal / aantalScholen : 0;
  const aantalFacturen = facturen.length;

  const arrow = col => _omzetSortCol !== col
    ? `<span style="opacity:.25;margin-left:4px;font-size:10px">⇅</span>`
    : _omzetSortDir === 'asc'
      ? `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▲</span>`
      : `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▼</span>`;
  const th = (col, label, align = 'left') =>
    `<th style="cursor:pointer;user-select:none;white-space:nowrap;text-align:${align}" onclick="sortOmzet('${col}')">${label}${arrow(col)}</th>`;

  const statusOpts = [
    ['gefactureerd', 'Verzonden + betaald'],
    ['betaald', 'Alleen betaald'],
    ['alle', 'Alles behalve concept'],
  ];

  const periodeLabel = _omzetJaar === 'alle' ? 'alle jaren' : _omzetJaar;
  const statusLabel = (statusOpts.find(([k]) => k === _omzetStatus) || statusOpts[0])[1].toLowerCase();

  return `
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:11px;color:var(--navy4);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Periode</span>
        <select onchange="setOmzetJaar(this.value)" style="padding:9px 13px;border:2px solid var(--bg3);border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:13.5px;font-weight:600;color:var(--navy);background:white;cursor:pointer;min-width:120px">
          <option value="alle"${_omzetJaar === 'alle' ? ' selected' : ''}>Alle jaren</option>
          ${jaren.map(j => `<option value="${j}"${_omzetJaar === j ? ' selected' : ''}>${j}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:11px;color:var(--navy4);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Status</span>
        <select onchange="setOmzetStatus(this.value)" style="padding:9px 13px;border:2px solid var(--bg3);border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:13.5px;font-weight:600;color:var(--navy);background:white;cursor:pointer;min-width:200px">
          ${statusOpts.map(([k, l]) => `<option value="${k}"${_omzetStatus === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1"></div>
      <button class="btn btn-secondary" onclick="exportOmzetExcel()" style="border-color:var(--groen);color:var(--groen);font-weight:700">${svgIcon('download', 15)} Excel export</button>
      <button class="btn btn-secondary" onclick="exportOmzetPDF()" style="border-color:#9B6B00;color:#9B6B00;font-weight:700">${svgIcon('print', 15)} PDF / Afdrukken</button>
    </div>

    <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:18px">
      ${[
        ['Totale omzet', fmtEuro(totaal), '#1ab8b8', 'Periode ' + periodeLabel],
        ['Waarvan betaald', fmtEuro(totaalBetaald), '#2E7D52', `${totaal > 0 ? Math.round(totaalBetaald / totaal * 100) : 0}% van totaal`],
        ['Openstaand', fmtEuro(totaalOpen), '#D1662E', `${totaal > 0 ? Math.round(totaalOpen / totaal * 100) : 0}% van totaal`],
        ['Scholen met omzet', String(aantalScholen), '#2D3054', `${aantalFacturen} factu${aantalFacturen === 1 ? 'ur' : 'ren'} totaal`],
        ['Gemiddeld per school', fmtEuro(gemiddelde), '#6D4AA2', ''],
      ].map(([label, value, color, sub]) => `
        <div class="card" style="padding:14px 18px">
          <div style="font-size:11px;color:var(--navy4);font-weight:700;text-transform:uppercase;letter-spacing:.6px">${esc(label)}</div>
          <div style="font-size:22px;font-weight:800;color:${color};margin-top:4px;line-height:1.2">${value}</div>
          ${sub ? `<div style="font-size:11.5px;color:var(--navy4);margin-top:2px">${esc(sub)}</div>` : ''}
        </div>`).join('')}
    </div>

    ${rows.length === 0 ? `
      <div class="card"><div class="empty-state">
        ${svgIcon('euro', 36)}
        <p style="margin-top:8px">Geen omzet gevonden voor ${esc(periodeLabel)} (${esc(statusLabel)}).</p>
      </div></div>` : `
      ${_omzetBarChart(rows)}

      <div class="card">
        <div class="card-header"><h3>Detail per school</h3></div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              ${th('school', 'School')}
              ${th('aantal', 'Facturen', 'right')}
              ${th('bedrag', 'Totaal', 'right')}
              ${th('betaald', 'Betaald', 'right')}
              ${th('open', 'Openstaand', 'right')}
              <th style="text-align:right">Aandeel</th>
            </tr></thead>
            <tbody>
              ${sorted.map(r => {
                const aandeel = totaal > 0 ? (r.totaal / totaal * 100) : 0;
                const linkable = r.kind === 'school' && r.schoolId && getSchool(r.schoolId);
                return `<tr ${linkable ? `class="clickable-row" onclick="navigate('school-detail','${r.schoolId}')"` : ''}>
                  <td style="font-weight:600;color:var(--navy)">
                    ${esc(r.schoolNaam)}
                    ${r.bestuurNaam ? `<div style="font-size:11.5px;color:var(--navy4);font-weight:400;margin-top:2px">${esc(r.bestuurNaam)}${r.plaats ? ' · ' + esc(r.plaats) : ''}</div>` : (r.plaats ? `<div style="font-size:11.5px;color:var(--navy4);font-weight:400;margin-top:2px">${esc(r.plaats)}</div>` : '')}
                  </td>
                  <td style="text-align:right;color:var(--navy3)">${r.aantal}</td>
                  <td style="text-align:right;font-weight:700;color:var(--navy)">${fmtEuro(r.totaal)}</td>
                  <td style="text-align:right;color:#2E7D52;font-weight:600">${fmtEuro(r.betaald)}</td>
                  <td style="text-align:right;color:#D1662E;font-weight:600">${fmtEuro(r.openstaand)}</td>
                  <td style="text-align:right;color:var(--navy3);font-size:13px">${aandeel.toFixed(1)}%</td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--bg);font-weight:800">
                <td style="padding:10px 14px">Totaal (${rows.length} scholen)</td>
                <td style="text-align:right;padding:10px 14px">${aantalFacturen}</td>
                <td style="text-align:right;padding:10px 14px">${fmtEuro(totaal)}</td>
                <td style="text-align:right;padding:10px 14px;color:#2E7D52">${fmtEuro(totaalBetaald)}</td>
                <td style="text-align:right;padding:10px 14px;color:#D1662E">${fmtEuro(totaalOpen)}</td>
                <td style="text-align:right;padding:10px 14px">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`}`;
}

function _omzetExportFilterBeschrijving() {
  const periode = _omzetJaar === 'alle' ? 'Alle jaren' : `Jaar ${_omzetJaar}`;
  const statusOpts = {
    gefactureerd: 'Verzonden + betaald',
    betaald: 'Alleen betaald',
    alle: 'Alles behalve concept',
  };
  return `${periode} · ${statusOpts[_omzetStatus] || _omzetStatus}`;
}

function exportOmzetExcel() {
  const facturen = _omzetGetFacturen();
  const rows = _omzetSorteer(_omzetAggregeer(facturen));
  if (!rows.length) { showToast('Geen omzetgegevens om te exporteren', 'error'); return; }

  const Q = s => '"' + String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
  const EUR = n => '"' + (Number(n) || 0).toFixed(2).replace('.', ',') + '"';

  const totaal = rows.reduce((s, r) => s + r.totaal, 0);
  const totaalBetaald = rows.reduce((s, r) => s + r.betaald, 0);
  const totaalOpen = rows.reduce((s, r) => s + r.openstaand, 0);
  const cols = 7;
  const empty = Array(cols).fill('');

  const data = [
    [Q('Omzetoverzicht 2xDenken'), ...Array(cols - 1).fill('')],
    [Q(_omzetExportFilterBeschrijving()), ...Array(cols - 1).fill('')],
    empty,
    [Q('School'), Q('Bestuur'), Q('Plaats'), Q('Aantal facturen'), Q('Totaal (€)'), Q('Betaald (€)'), Q('Openstaand (€)')],
    ...rows.map(r => [
      Q(r.schoolNaam),
      Q(r.bestuurNaam),
      Q(r.plaats),
      r.aantal,
      EUR(r.totaal),
      EUR(r.betaald),
      EUR(r.openstaand),
    ]),
    empty,
    [Q('Totaal'), '', '', facturen.length, EUR(totaal), EUR(totaalBetaald), EUR(totaalOpen)],
    empty,
    [Q(`Geëxporteerd op: ${new Date().toLocaleDateString('nl-NL')}`), ...Array(cols - 1).fill('')],
  ];

  const csv  = '﻿' + data.map(r => r.join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ds = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `2xDenken_omzet_${_omzetJaar === 'alle' ? 'alle-jaren' : _omzetJaar}_${ds}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Omzetoverzicht geëxporteerd (${rows.length} scholen)`);
}

function exportOmzetPDF() {
  const facturen = _omzetGetFacturen();
  const rows = _omzetSorteer(_omzetAggregeer(facturen));
  if (!rows.length) { showToast('Geen omzetgegevens om te exporteren', 'error'); return; }

  const totaal = rows.reduce((s, r) => s + r.totaal, 0);
  const totaalBetaald = rows.reduce((s, r) => s + r.betaald, 0);
  const totaalOpen = rows.reduce((s, r) => s + r.openstaand, 0);
  const exportDate = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  const sortedDesc = [...rows].sort((a, b) => b.totaal - a.totaal);
  const max = sortedDesc[0]?.totaal || 1;

  const barRows = sortedDesc.map((r, i) => {
    const pct = (r.totaal / max) * 100;
    const aandeel = totaal > 0 ? (r.totaal / totaal * 100) : 0;
    return `<tr>
      <td class="rank">${i + 1}</td>
      <td><strong>${esc(r.schoolNaam)}</strong>${r.plaats ? `<div class="sub">${esc(r.plaats)}</div>` : ''}</td>
      <td class="right nowrap">${r.aantal}</td>
      <td class="bar-cell"><div class="bar-bg"><div class="bar-fill" style="width:${pct.toFixed(2)}%"></div></div></td>
      <td class="right nowrap"><strong>${fmtEuro(r.totaal)}</strong></td>
      <td class="right nowrap">${aandeel.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8"/>
<title>Omzetoverzicht — 2xDenken</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--teal:#2C8C8A;--teal-l:#E8F3F2;--ink:#2A2F3A;--ink-l:#5A6270;--ink-xl:#8B92A0;--line:#E8E4DC;--bg:#FAF7F2}
  body{font-family:'Nunito',Arial,sans-serif;font-size:9.5pt;color:var(--ink);background:#fff;line-height:1.45}
  @page{size:A4;margin:14mm}
  @media print{.no-print{display:none!important}}
  .page{padding:18px 22px}
  .header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--teal)}
  h1{font-size:18pt;font-weight:800;color:var(--teal);letter-spacing:-0.3px}
  .subtitle{font-size:10pt;color:var(--ink-l);margin-top:2px}
  .meta{font-size:9pt;color:var(--ink-l);text-align:right;line-height:1.6}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  .stat{background:var(--teal-l);border-radius:6px;padding:10px 13px}
  .stat-label{font-size:8pt;color:var(--ink-l);text-transform:uppercase;letter-spacing:0.6px;font-weight:700}
  .stat-value{font-size:14pt;font-weight:800;color:var(--teal);margin-top:1px}
  table{width:100%;border-collapse:collapse;font-size:9pt}
  thead th{background:var(--bg);font-size:8.5pt;font-weight:700;color:var(--ink-l);text-transform:uppercase;letter-spacing:0.5px;text-align:left;padding:8px 10px;border-bottom:2px solid var(--line)}
  thead th.right{text-align:right}
  tbody td{padding:7px 10px;vertical-align:middle;border-bottom:1px solid var(--line)}
  tbody tr:nth-child(even){background:#FAFAF7}
  td.right{text-align:right}
  td.nowrap{white-space:nowrap}
  td.rank{text-align:right;color:var(--ink-xl);font-weight:700;width:30px}
  td.bar-cell{padding:7px 10px;width:30%}
  .bar-bg{position:relative;height:14px;background:var(--bg);border-radius:3px;overflow:hidden}
  .bar-fill{position:absolute;top:0;left:0;height:100%;background:linear-gradient(90deg,#2C8C8A 0%,#1ab8b8 100%);border-radius:3px}
  .sub{font-size:8pt;color:var(--ink-xl);margin-top:1px;font-weight:400}
  tfoot td{padding:10px;font-weight:800;background:var(--teal);color:white;border-top:2px solid var(--teal)}
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
      <h1>Omzetoverzicht</h1>
      <div class="subtitle">${esc(_omzetExportFilterBeschrijving())}</div>
    </div>
    <div class="meta">
      <strong style="color:var(--ink)">2xDenken</strong><br/>
      Geëxporteerd op ${esc(exportDate)}
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-label">Totale omzet</div><div class="stat-value">${fmtEuro(totaal)}</div></div>
    <div class="stat"><div class="stat-label">Betaald</div><div class="stat-value">${fmtEuro(totaalBetaald)}</div></div>
    <div class="stat"><div class="stat-label">Openstaand</div><div class="stat-value">${fmtEuro(totaalOpen)}</div></div>
    <div class="stat"><div class="stat-label">Scholen</div><div class="stat-value">${rows.length}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th></th>
        <th>School</th>
        <th class="right">Facturen</th>
        <th>Verdeling</th>
        <th class="right">Totaal</th>
        <th class="right">Aandeel</th>
      </tr>
    </thead>
    <tbody>${barRows}</tbody>
    <tfoot>
      <tr>
        <td></td>
        <td>Totaal (${rows.length} scholen)</td>
        <td class="right">${facturen.length}</td>
        <td></td>
        <td class="right">${fmtEuro(totaal)}</td>
        <td class="right">100%</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">2xDenken — Omzetoverzicht</div>
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
