// ════════════════════════════════════════════════════════════════
// TRAINING-ANALYSE — Hoe vaak en waar zijn trainingen/werkvormen ingezet
// ════════════════════════════════════════════════════════════════

let _anaJaar       = prefGet('ana.jaar', 'alle');
let _anaTypeFilter = prefGet('ana.type', 'alle');
let _anaCatFilter  = prefGet('ana.cat', 'alle');
let _anaSortCol    = prefGet('ana.sortCol', 'inzet');
let _anaSortDir    = prefGet('ana.sortDir', 'desc');
let _anaTopOnly    = true;
let _anaExpanded   = new Set();      // trainingIds waarvan de "waar"-detail openstaat

const ANA_TOP_N = 12;

function setAnaJaar(v)  { _anaJaar = v; prefSet('ana.jaar', v); smartRender(renderTrainingAnalysePage); }
function setAnaType(v)  { _anaTypeFilter = v; prefSet('ana.type', v); smartRender(renderTrainingAnalysePage); }
function setAnaCat(v)   { _anaCatFilter = v; prefSet('ana.cat', v); smartRender(renderTrainingAnalysePage); }
function toggleAnaAlle() { _anaTopOnly = !_anaTopOnly; smartRender(renderTrainingAnalysePage); }
function toggleAnaRij(trainingId) {
  if (_anaExpanded.has(trainingId)) _anaExpanded.delete(trainingId);
  else _anaExpanded.add(trainingId);
  smartRender(renderTrainingAnalysePage);
}
function sortAna(col) {
  if (_anaSortCol === col) { _anaSortDir = _anaSortDir === 'asc' ? 'desc' : 'asc'; }
  else { _anaSortCol = col; _anaSortDir = col === 'training' ? 'asc' : 'desc'; }
  prefSet('ana.sortCol', _anaSortCol);
  prefSet('ana.sortDir', _anaSortDir);
  smartRender(renderTrainingAnalysePage);
}

// ── Datum-helpers (uitvoering.datum is meestal 'YYYY-MM-DD', soms 'DD-MM-YYYY') ──
function _anaParseDatum(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parts = s.split(/[\/.\-]/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 3 && /^\d{4}$/.test(parts[2])) {
    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function _anaJaarVan(u) {
  const d = _anaParseDatum(u.datum);
  return d ? String(d.getFullYear()) : '';
}

// ── Selectie van uitvoeringen op basis van de actieve filters ──
function _anaGetUitvoeringen() {
  return (DB.uitvoeringen || []).filter(u => {
    const t = getTraining(u.trainingId);
    if (!t) return false;
    if (_anaTypeFilter !== 'alle' && (t.type || 'training') !== _anaTypeFilter) return false;
    if (_anaCatFilter !== 'alle' && (t.categorie || 'algemeen') !== _anaCatFilter) return false;
    if (_anaJaar !== 'alle' && _anaJaarVan(u) !== _anaJaar) return false;
    return true;
  });
}

// ── Aggregatie per training/werkvorm ──
function _anaAggregeer(uitvoeringen) {
  const map = new Map();
  for (const u of uitvoeringen) {
    const t = getTraining(u.trainingId);
    if (!t) continue;
    let r = map.get(u.trainingId);
    if (!r) {
      r = {
        trainingId: u.trainingId,
        naam: t.naam || '(Naamloos)',
        type: t.type || 'training',
        categorie: t.categorie || 'algemeen',
        inzet: 0,
        deelnemers: 0,
        scores: [],
        scholen: new Map(),     // schoolId → { count, deelnemers, laatste }
        laatste: null,
      };
      map.set(u.trainingId, r);
    }
    r.inzet++;
    r.deelnemers += Number(u.deelnemers) || 0;
    if (u.score) r.scores.push(u.score);
    const d = _anaParseDatum(u.datum);
    if (d && (!r.laatste || d > r.laatste)) r.laatste = d;

    // Per school bijhouden ("waar")
    const sid = u.schoolId || 'geen';
    let sr = r.scholen.get(sid);
    if (!sr) { sr = { schoolId: u.schoolId || null, count: 0, deelnemers: 0, laatste: null }; r.scholen.set(sid, sr); }
    sr.count++;
    sr.deelnemers += Number(u.deelnemers) || 0;
    if (d && (!sr.laatste || d > sr.laatste)) sr.laatste = d;
  }
  return [...map.values()].map(r => ({
    ...r,
    schoolCount: r.scholen.size,
    avgScore: r.scores.length ? (r.scores.reduce((a, b) => a + b, 0) / r.scores.length) : null,
  }));
}

function _anaSorteer(rows) {
  const dir = _anaSortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (_anaSortCol) {
      case 'training':   return dir * a.naam.localeCompare(b.naam, 'nl');
      case 'type':       return dir * trainingTypeLabel(a.type).localeCompare(trainingTypeLabel(b.type), 'nl');
      case 'inzet':      return dir * (a.inzet - b.inzet);
      case 'scholen':    return dir * (a.schoolCount - b.schoolCount);
      case 'deelnemers': return dir * (a.deelnemers - b.deelnemers);
      case 'score':      return dir * ((a.avgScore || 0) - (b.avgScore || 0));
      case 'laatste':    return dir * ((a.laatste ? a.laatste.getTime() : 0) - (b.laatste ? b.laatste.getTime() : 0));
      default: return 0;
    }
  });
}

// ── Scholen waar een training is ingezet, gesorteerd op aantal ──
function _anaScholenVanRij(r) {
  return [...r.scholen.values()].map(sr => {
    const school = sr.schoolId ? getSchool(sr.schoolId) : null;
    const bestuur = school ? getBestuur(school.bestuurId) : null;
    return {
      ...sr,
      naam: school ? school.naam : '(Geen school gekoppeld)',
      plaats: school?.plaats || '',
      bestuurNaam: bestuur?.naam || '',
    };
  }).sort((a, b) => b.count - a.count || a.naam.localeCompare(b.naam, 'nl'));
}

// ── Verdeling per type (kleine staafjes onder de KPI's) ──
function _anaVerdelingPerType(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.type || 'training';
    if (!map.has(key)) map.set(key, { type: key, inzet: 0, trainingen: 0 });
    const m = map.get(key);
    m.inzet += r.inzet;
    m.trainingen++;
  }
  return [...map.values()].sort((a, b) => b.inzet - a.inzet);
}

function _anaBarChart(rows) {
  if (!rows.length) return '';
  const sorted = [...rows].sort((a, b) => b.inzet - a.inzet);
  const display = _anaTopOnly ? sorted.slice(0, ANA_TOP_N) : sorted;
  const max = display[0]?.inzet || 1;

  return `
    <div class="card" style="margin-bottom:18px">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h3>Meest ingezet${_anaTopOnly && sorted.length > ANA_TOP_N ? ` <span style="font-weight:500;color:var(--navy4);font-size:13px">— Top ${ANA_TOP_N} van ${sorted.length}</span>` : ''}</h3>
        ${sorted.length > ANA_TOP_N ? `<button class="btn btn-secondary btn-sm" onclick="toggleAnaAlle()">${_anaTopOnly ? 'Toon alle' : 'Toon top ' + ANA_TOP_N}</button>` : ''}
      </div>
      <div class="card-body" style="padding:18px 24px">
        <div style="display:flex;flex-direction:column;gap:8px">
          ${display.map((r, i) => {
            const pct = max > 0 ? (r.inzet / max) * 100 : 0;
            const info = getTrainingTypeInfo(r.type);
            return `
            <div style="display:grid;grid-template-columns:24px minmax(150px,220px) 1fr 130px;gap:10px;align-items:center;font-size:13px;cursor:pointer"
                 onclick="navigate('training-detail','${r.trainingId}')" title="Klik voor details">
              <span style="color:var(--navy4);font-weight:700;text-align:right">${i + 1}</span>
              <span style="font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.naam)}">${esc(r.naam)}</span>
              <div style="position:relative;height:22px;background:var(--bg);border-radius:6px;overflow:hidden">
                <div style="position:absolute;top:0;left:0;height:100%;width:${pct.toFixed(2)}%;background:${info.color};opacity:.85;border-radius:6px;transition:width .3s"></div>
                <span style="position:relative;display:block;line-height:22px;padding-left:8px;font-size:11px;color:${pct > 30 ? 'white' : 'var(--navy3)'};font-weight:600">${r.inzet}× · ${r.schoolCount} school${r.schoolCount === 1 ? '' : 'en'}</span>
              </div>
              <span style="text-align:right;font-size:11.5px;color:var(--navy4);white-space:nowrap">${esc(trainingTypeLabel(r.type))}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function renderTrainingAnalysePage() {
  ensureTrainingTypes();
  ensureTrainingCategories();

  // Beschikbare jaren afleiden uit de uitvoeringen
  const jaren = [...new Set((DB.uitvoeringen || []).map(_anaJaarVan).filter(Boolean))].sort().reverse();
  if (_anaJaar !== 'alle' && !jaren.includes(_anaJaar)) _anaJaar = 'alle';

  const typeList = getTrainingTypeList();
  const catList = getTrainingCategoryList();

  const uitvoeringen = _anaGetUitvoeringen();
  const rows = _anaAggregeer(uitvoeringen);
  const sorted = _anaSorteer(rows);

  // KPI's
  const totaalInzet = rows.reduce((s, r) => s + r.inzet, 0);
  const totaalDeeln = rows.reduce((s, r) => s + r.deelnemers, 0);
  const uniekeTrainingen = rows.length;
  const uniekeScholen = new Set(uitvoeringen.map(u => u.schoolId).filter(Boolean)).size;
  const alleScores = rows.flatMap(r => r.scores);
  const gemScore = alleScores.length ? (alleScores.reduce((a, b) => a + b, 0) / alleScores.length) : null;

  const periodeLabel = _anaJaar === 'alle' ? 'alle jaren' : _anaJaar;

  const kpis = [
    ['Totaal ingezet', String(totaalInzet), '#1ab8b8', `In ${periodeLabel}`],
    ['Unieke trainingen/werkvormen', String(uniekeTrainingen), '#2D3054', 'Verschillende ingezet'],
    ['Scholen bereikt', String(uniekeScholen), '#6D4AA2', 'Unieke locaties'],
    ['Totaal deelnemers', String(totaalDeeln), '#D1662E', 'Som van alle uitvoeringen'],
    ['Gem. waardering', gemScore != null ? gemScore.toFixed(1) + ' / 5' : '–', '#E4A800', `${alleScores.length} beoordeling${alleScores.length === 1 ? '' : 'en'}`],
  ];

  const verdeling = _anaVerdelingPerType(rows);
  const verdMax = verdeling[0]?.inzet || 1;

  const arrow = col => _anaSortCol !== col
    ? `<span style="opacity:.25;margin-left:4px;font-size:10px">⇅</span>`
    : _anaSortDir === 'asc'
      ? `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▲</span>`
      : `<span style="margin-left:4px;font-size:10px;color:var(--navy)">▼</span>`;
  const th = (col, label, align = 'left') =>
    `<th style="cursor:pointer;user-select:none;white-space:nowrap;text-align:${align}" onclick="sortAna('${col}')">${label}${arrow(col)}</th>`;

  const selStyle = 'padding:9px 13px;border:2px solid var(--bg3);border-radius:var(--r);font-family:\'Nunito\',sans-serif;font-size:13.5px;font-weight:600;color:var(--navy);background:white;cursor:pointer';

  return `
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:11px;color:var(--navy4);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Periode</span>
        <select onchange="setAnaJaar(this.value)" style="${selStyle};min-width:120px">
          <option value="alle"${_anaJaar === 'alle' ? ' selected' : ''}>Alle jaren</option>
          ${jaren.map(j => `<option value="${j}"${_anaJaar === j ? ' selected' : ''}>${j}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:11px;color:var(--navy4);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Type</span>
        <select onchange="setAnaType(this.value)" style="${selStyle};min-width:150px">
          <option value="alle"${_anaTypeFilter === 'alle' ? ' selected' : ''}>Alle types</option>
          ${typeList.map(t => `<option value="${esc(t.id)}"${_anaTypeFilter === t.id ? ' selected' : ''}>${esc(t.naam)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:11px;color:var(--navy4);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Categorie</span>
        <select onchange="setAnaCat(this.value)" style="${selStyle};min-width:150px">
          <option value="alle"${_anaCatFilter === 'alle' ? ' selected' : ''}>Alle categorieën</option>
          ${catList.map(c => `<option value="${esc(c.id)}"${_anaCatFilter === c.id ? ' selected' : ''}>${esc(c.naam)}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1"></div>
      <button class="btn btn-secondary" onclick="exportAnalyseExcel()" style="border-color:var(--groen);color:var(--groen);font-weight:700">${svgIcon('download', 15)} Excel export</button>
    </div>

    <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:18px">
      ${kpis.map(([label, value, color, sub]) => `
        <div class="card" style="padding:14px 18px">
          <div style="font-size:11px;color:var(--navy4);font-weight:700;text-transform:uppercase;letter-spacing:.6px">${esc(label)}</div>
          <div style="font-size:22px;font-weight:800;color:${color};margin-top:4px;line-height:1.2">${esc(value)}</div>
          ${sub ? `<div style="font-size:11.5px;color:var(--navy4);margin-top:2px">${esc(sub)}</div>` : ''}
        </div>`).join('')}
    </div>

    ${rows.length === 0 ? `
      <div class="card"><div class="empty-state">
        ${svgIcon('training', 36)}
        <p style="margin-top:8px">Geen uitvoeringen gevonden voor de gekozen filters.</p>
      </div></div>` : `
      ${verdeling.length > 1 ? `
      <div class="card" style="margin-bottom:18px">
        <div class="card-header"><h3>Verdeling per type</h3></div>
        <div class="card-body" style="padding:16px 24px;display:flex;flex-direction:column;gap:8px">
          ${verdeling.map(v => {
            const info = getTrainingTypeInfo(v.type);
            const pct = (v.inzet / verdMax) * 100;
            const aandeel = totaalInzet > 0 ? (v.inzet / totaalInzet * 100) : 0;
            return `<div style="display:grid;grid-template-columns:minmax(120px,160px) 1fr 90px;gap:10px;align-items:center;font-size:13px">
              <span style="font-weight:600;color:var(--navy)">${esc(trainingTypeLabel(v.type))}</span>
              <div style="position:relative;height:18px;background:var(--bg);border-radius:5px;overflow:hidden">
                <div style="position:absolute;top:0;left:0;height:100%;width:${pct.toFixed(2)}%;background:${info.color};opacity:.85;border-radius:5px"></div>
              </div>
              <span style="text-align:right;color:var(--navy3);white-space:nowrap">${v.inzet}× · ${aandeel.toFixed(0)}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      ${_anaBarChart(rows)}

      <div class="card">
        <div class="card-header"><h3>Detail per training / werkvorm <span style="font-weight:500;color:var(--navy4);font-size:13px">— klik op een rij om te zien wáár</span></h3></div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th style="width:26px"></th>
              ${th('training', 'Training / werkvorm')}
              ${th('type', 'Type')}
              ${th('inzet', 'Ingezet', 'right')}
              ${th('scholen', 'Scholen', 'right')}
              ${th('deelnemers', 'Deelnemers', 'right')}
              ${th('score', 'Gem. score', 'right')}
              ${th('laatste', 'Laatst ingezet', 'right')}
            </tr></thead>
            <tbody>
              ${sorted.map(r => {
                const open = _anaExpanded.has(r.trainingId);
                const scholen = open ? _anaScholenVanRij(r) : [];
                return `
                <tr class="clickable-row" onclick="toggleAnaRij('${r.trainingId}')">
                  <td style="text-align:center;color:var(--navy4)">${open ? '▾' : '▸'}</td>
                  <td style="font-weight:600;color:var(--navy)">${esc(r.naam)}</td>
                  <td>${typeBadge(r.type)}</td>
                  <td style="text-align:right;font-weight:700;color:var(--navy)">${r.inzet}</td>
                  <td style="text-align:right;color:var(--navy3)">${r.schoolCount}</td>
                  <td style="text-align:right;color:var(--navy3)">${r.deelnemers || '–'}</td>
                  <td style="text-align:right;color:var(--navy3)">${r.avgScore != null ? r.avgScore.toFixed(1) + ' ★' : '–'}</td>
                  <td style="text-align:right;color:var(--navy3);font-size:12.5px;white-space:nowrap">${r.laatste ? fmtDateShort(r.laatste.toISOString()) : '–'}</td>
                </tr>
                ${open ? `
                <tr>
                  <td></td>
                  <td colspan="7" style="background:var(--bg);padding:12px 16px">
                    <div style="font-size:11px;color:var(--navy4);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Ingezet bij ${scholen.length} ${scholen.length === 1 ? 'locatie' : 'locaties'}</div>
                    <div style="display:flex;flex-direction:column;gap:4px">
                      ${scholen.map(s => `
                        <div ${s.schoolId ? `onclick="event.stopPropagation();navigate('school-detail','${s.schoolId}')" style="cursor:pointer;` : 'style="'}display:grid;grid-template-columns:1fr 70px 90px 120px;gap:10px;align-items:center;font-size:12.5px;padding:4px 6px;border-radius:6px">
                          <span style="font-weight:600;color:var(--navy)">${esc(s.naam)}${s.plaats ? `<span style="font-weight:400;color:var(--navy4)"> · ${esc(s.plaats)}</span>` : ''}</span>
                          <span style="text-align:right;color:var(--navy2);font-weight:700">${s.count}×</span>
                          <span style="text-align:right;color:var(--navy4)">${s.deelnemers ? s.deelnemers + ' dln.' : '–'}</span>
                          <span style="text-align:right;color:var(--navy4)">${s.laatste ? fmtDateShort(s.laatste.toISOString()) : '–'}</span>
                        </div>`).join('')}
                    </div>
                  </td>
                </tr>` : ''}`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--bg);font-weight:800">
                <td></td>
                <td style="padding:10px 14px">Totaal (${rows.length} trainingen)</td>
                <td></td>
                <td style="text-align:right;padding:10px 14px">${totaalInzet}</td>
                <td style="text-align:right;padding:10px 14px">${uniekeScholen}</td>
                <td style="text-align:right;padding:10px 14px">${totaalDeeln}</td>
                <td style="text-align:right;padding:10px 14px">${gemScore != null ? gemScore.toFixed(1) + ' ★' : '–'}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`}`;
}

function _anaExportFilterBeschrijving() {
  const periode = _anaJaar === 'alle' ? 'Alle jaren' : `Jaar ${_anaJaar}`;
  const type = _anaTypeFilter === 'alle' ? 'Alle types' : trainingTypeLabel(_anaTypeFilter);
  const cat = _anaCatFilter === 'alle' ? 'Alle categorieën' : trainingCategoryLabel(_anaCatFilter);
  return `${periode} · ${type} · ${cat}`;
}

function exportAnalyseExcel() {
  const rows = _anaSorteer(_anaAggregeer(_anaGetUitvoeringen()));
  if (!rows.length) { showToast('Geen gegevens om te exporteren', 'error'); return; }

  const Q = s => '"' + String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
  const cols = 8;
  const empty = Array(cols).fill('');

  const data = [
    [Q('Analyse trainingen & werkvormen — 2xDenken'), ...Array(cols - 1).fill('')],
    [Q(_anaExportFilterBeschrijving()), ...Array(cols - 1).fill('')],
    empty,
    [Q('Training / werkvorm'), Q('Type'), Q('Categorie'), Q('Keer ingezet'), Q('Aantal scholen'), Q('Deelnemers'), Q('Gem. score'), Q('Laatst ingezet')],
  ];

  // Hoofdregels + per-school detailregels ("waar")
  for (const r of rows) {
    data.push([
      Q(r.naam),
      Q(trainingTypeLabel(r.type)),
      Q(trainingCategoryLabel(r.categorie)),
      r.inzet,
      r.schoolCount,
      r.deelnemers,
      r.avgScore != null ? Q(r.avgScore.toFixed(1).replace('.', ',')) : '',
      r.laatste ? Q(r.laatste.toLocaleDateString('nl-NL')) : '',
    ]);
    for (const s of _anaScholenVanRij(r)) {
      data.push([
        Q('   → ' + s.naam),
        Q(s.plaats),
        Q(s.bestuurNaam),
        s.count,
        '',
        s.deelnemers,
        '',
        s.laatste ? Q(s.laatste.toLocaleDateString('nl-NL')) : '',
      ]);
    }
  }

  data.push(empty);
  data.push([Q(`Geëxporteerd op: ${new Date().toLocaleDateString('nl-NL')}`), ...Array(cols - 1).fill('')]);

  const csv  = '﻿' + data.map(r => r.join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ds   = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `2xDenken_training-analyse_${_anaJaar === 'alle' ? 'alle-jaren' : _anaJaar}_${ds}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Analyse geëxporteerd (${rows.length} trainingen)`);
}
