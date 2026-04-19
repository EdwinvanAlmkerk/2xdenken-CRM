// ════════════════════════════════════════════════════════════════
// TRAININGEN & METHODES
// ════════════════════════════════════════════════════════════════

const TRAINING_TYPE_STYLES = {
  navy:   { color: '#2D3054', bg: '#EEEEF6' },
  oranje: { color: '#D1662E', bg: '#FBF0E8' },
  groen:  { color: '#2E7D52', bg: '#E6F4EE' },
  goud:   { color: '#9B6B00', bg: '#FBF3E0' },
  blauw:  { color: '#2B5CB8', bg: '#E8EEF8' },
  paars:  { color: '#6D4AA2', bg: '#F0EAF8' },
  rood:   { color: '#C0392B', bg: '#FDE8E8' },
  grijs:  { color: '#6B6B8A', bg: '#F0F0F5' },
};

const DEFAULT_TRAINING_TYPES = [
  { id: 'training', naam: 'Training', kleur: 'oranje' },
  { id: 'coaching', naam: 'Coaching', kleur: 'navy' },
  { id: 'methode', naam: 'Methode', kleur: 'groen' },
  { id: 'workshop', naam: 'Workshop', kleur: 'goud' },
  { id: 'advies', naam: 'Advies', kleur: 'blauw' },
  { id: 'anders', naam: 'Anders', kleur: 'paars' },
];

const DEFAULT_TRAINING_CATEGORIES = [
  { id: 'algemeen', naam: 'Algemeen', kleur: 'navy' },
  { id: 'didactiek', naam: 'Didactiek', kleur: 'blauw' },
  { id: 'gedrag', naam: 'Gedrag', kleur: 'oranje' },
  { id: 'team', naam: 'Team', kleur: 'groen' },
  { id: 'ouders', naam: 'Ouders', kleur: 'paars' },
  { id: 'maatwerk', naam: 'Maatwerk', kleur: 'navy' },
];

function normalizeTypeId(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || uid();
}

function ensureTrainingTypes() {
  if (!Array.isArray(DB.trainingTypes)) DB.trainingTypes = [];
  if (DB.trainingTypes.length) return;

  try {
    const stored = JSON.parse(localStorage.getItem('crm_training_types') || '[]');
    if (Array.isArray(stored) && stored.length) {
      DB.trainingTypes = stored;
      return;
    }
  } catch (e) {}

  DB.trainingTypes = DEFAULT_TRAINING_TYPES.map(t => ({ ...t }));
}

function ensureTrainingCategories() {
  if (!Array.isArray(DB.trainingCategories)) DB.trainingCategories = [];
  if (DB.trainingCategories.length) return;

  try {
    const stored = JSON.parse(localStorage.getItem('crm_training_categories') || '[]');
    if (Array.isArray(stored) && stored.length) {
      DB.trainingCategories = stored;
      return;
    }
  } catch (e) {}

  DB.trainingCategories = DEFAULT_TRAINING_CATEGORIES.map(t => ({ ...t }));
}

function persistTrainingTypesLocally() {
  try { localStorage.setItem('crm_training_types', JSON.stringify(DB.trainingTypes || [])); } catch (e) {}
}

function persistTrainingCategoriesLocally() {
  try { localStorage.setItem('crm_training_categories', JSON.stringify(DB.trainingCategories || [])); } catch (e) {}
}

function persistTrainingBestandenLocally() {
  try {
    const map = Object.fromEntries((DB.trainingen || []).filter(t => t?.id).map(t => [t.id, t.bestanden || []]));
    localStorage.setItem('crm_training_bestanden', JSON.stringify(map));
  } catch (e) {}
}

function getTrainingTypeList() {
  ensureTrainingTypes();
  return (DB.trainingTypes && DB.trainingTypes.length) ? DB.trainingTypes : DEFAULT_TRAINING_TYPES;
}

function getTrainingCategoryList() {
  ensureTrainingCategories();
  return (DB.trainingCategories && DB.trainingCategories.length) ? DB.trainingCategories : DEFAULT_TRAINING_CATEGORIES;
}

function getTrainingTypeInfo(typeId = '') {
  const list = getTrainingTypeList();
  const found = list.find(t => t.id === typeId) || list.find(t => t.id === 'training') || { id: typeId || 'anders', naam: typeId || 'Anders', kleur: 'grijs' };
  const style = TRAINING_TYPE_STYLES[found.kleur] || TRAINING_TYPE_STYLES.grijs;
  return { ...found, label: found.naam || 'Anders', color: style.color, bg: style.bg };
}

function getTrainingCategoryInfo(categoryId = '') {
  const list = getTrainingCategoryList();
  const found = list.find(t => t.id === categoryId) || list.find(t => t.id === 'algemeen') || { id: categoryId || 'algemeen', naam: categoryId || 'Algemeen', kleur: 'navy' };
  const style = TRAINING_TYPE_STYLES[found.kleur] || TRAINING_TYPE_STYLES.grijs;
  return { ...found, label: found.naam || 'Algemeen', color: style.color, bg: style.bg };
}

function trainingTypeLabel(typeId = '') {
  return getTrainingTypeInfo(typeId).label;
}

function trainingCategoryLabel(categoryId = '') {
  return getTrainingCategoryInfo(categoryId).label;
}

function badgeFromInfo(info) {
  return `<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:11.5px;font-weight:700;background:${info.bg};color:${info.color}">${info.label}</span>`;
}

function typeBadge(typeId = '') {
  return badgeFromInfo(getTrainingTypeInfo(typeId));
}

function catBadge(categoryId = '') {
  return badgeFromInfo(getTrainingCategoryInfo(categoryId));
}

function renderTrainingBestanden(bestanden = [], trainingId = '', editable = false) {
  if (!bestanden || !bestanden.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${bestanden.map((b, i) => `
    <span onclick="downloadTrainingBestand('${trainingId}',${i})" title="Klik om te downloaden" style="display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--bg3);border-radius:999px;padding:7px 10px;font-size:12px;color:var(--navy2);cursor:pointer;max-width:100%">
      <span>${bijlageIcon(b.mimetype)} ${esc(b.naam)}</span>
      ${b.grootte ? `<span style="color:var(--navy4)">(${fmtBytes(b.grootte)})</span>` : ''}
      ${editable ? `<span onclick="event.stopPropagation();delTrainingBestand('${trainingId}',${i})" title="Verwijderen" style="margin-left:2px;color:var(--s-rood);font-weight:800">×</span>` : ''}
    </span>`).join('')}</div>`;
}

function renderStars(score, interactive = false, fid = '') {
  return [1, 2, 3, 4, 5].map(i => {
    const filled = i <= (score || 0);
    const color = filled ? '#E4A800' : '#C2D8D9';
    if (interactive) return `<span onclick="setUitvoeringStar(${i},'${fid}')" style="cursor:pointer;color:${color};font-size:20px;line-height:1">★</span>`;
    return `<span style="color:${color};font-size:16px;line-height:1">★</span>`;
  }).join('');
}

function searchTrainingen(v) { smartRender(() => renderTrainingenPage(v)); }

function renderTrainingenPage(search = '') {
  if (!DB.trainingen)   DB.trainingen   = [];
  if (!DB.uitvoeringen) DB.uitvoeringen = [];

  ensureTrainingTypes();
  ensureTrainingCategories();

  const filtered = DB.trainingen.filter(t =>
    t.naam.toLowerCase().includes(search.toLowerCase()) ||
    trainingTypeLabel(t.type).toLowerCase().includes(search.toLowerCase()) ||
    trainingCategoryLabel(t.categorie).toLowerCase().includes(search.toLowerCase()) ||
    (t.omschrijving || '').toLowerCase().includes(search.toLowerCase())
  );

  return `
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div class="search-wrap" style="flex:1;min-width:200px">
        <span class="search-icon">${svgIcon('search', 15)}</span>
        <input id="search-trainingen" type="text" placeholder="Zoek training of methode…" value="${esc(search)}"
          oninput="searchTrainingen(this.value)" style="padding-left:36px"/>
      </div>
      <button class="btn btn-primary" onclick="openTrainingModal()">${svgIcon('add')} Nieuwe training</button>
    </div>

    ${DB.trainingen.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          ${svgIcon('training', 40)}
          <p style="margin-top:12px;font-size:15px;font-weight:600;color:var(--navy3)">Nog geen trainingen</p>
          <p style="margin-top:6px">Voeg je eerste training of methode toe</p>
          <button class="btn btn-primary" onclick="openTrainingModal()" style="margin-top:16px">${svgIcon('add')} Nieuwe training</button>
        </div>
      </div>` : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      ${filtered.map(t => {
        const uitv = DB.uitvoeringen.filter(u => u.trainingId === t.id);
        const avgScore = uitv.filter(u => u.score).length
          ? Math.round(uitv.filter(u => u.score).reduce((s, u) => s + u.score, 0) / uitv.filter(u => u.score).length * 10) / 10
          : null;
        return `
        <div class="card" style="cursor:pointer;transition:box-shadow .15s;border-top:4px solid ${getTrainingTypeInfo(t.type).color};position:relative"
             onclick="navigate('training-detail','${t.id}')"
             onmouseover="this.style.boxShadow='var(--shl)'" onmouseout="this.style.boxShadow=''">
          <button class="btn btn-ghost btn-icon btn-sm" title="Training verwijderen"
                  onclick="event.stopPropagation();delTraining('${t.id}')"
                  style="position:absolute;top:8px;right:8px;color:var(--s-rood);opacity:.65">${svgIcon('trash', 14)}</button>
          <div class="card-body" style="padding:18px 20px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;padding-right:28px">
              <div style="font-size:15px;font-weight:800;color:var(--navy);line-height:1.3">${esc(t.naam)}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${typeBadge(t.type)}${catBadge(t.categorie)}</div>
            </div>
            ${t.omschrijving ? `<div style="font-size:13px;color:var(--navy3);line-height:1.55;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(t.omschrijving)}</div>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:10px;border-top:1px solid var(--bg3)">
              <span style="font-size:12px;color:var(--navy4);font-weight:600">${uitv.length} uitvoering${uitv.length === 1 ? '' : 'en'}</span>
              ${avgScore !== null ? `<div style="display:flex;align-items:center;gap:4px">${renderStars(Math.round(avgScore))}<span style="font-size:12px;color:var(--navy3);font-weight:700;margin-left:3px">${avgScore.toFixed(1)}</span></div>` : `<span style="font-size:12px;color:var(--navy4)">Nog niet uitgevoerd</span>`}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`}`;
}

function renderTrainingDetail(id) {
  const t = DB.trainingen.find(x => x.id === id);
  if (!t) return '<p>Niet gevonden</p>';
  const uitv = [...DB.uitvoeringen.filter(u => u.trainingId === id)].sort((a, b) => new Date(b.datum) - new Date(a.datum));
  const avgScore = uitv.filter(u => u.score).length
    ? (uitv.filter(u => u.score).reduce((s, u) => s + u.score, 0) / uitv.filter(u => u.score).length).toFixed(1)
    : null;
  const tips = t.tips || [];
  const tabs = [['info', 'Informatie'], ['uitvoeringen', 'Historie & Uitvoeringen'], ['tips', 'Tips & Verbetering']];
  let tabContent = '';

  if (trainingTab === 'info') {
    tabContent = `
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3>Gegevens</h3>
            <button class="btn btn-secondary btn-sm" onclick="openTrainingModal('${id}')">${svgIcon('edit', 14)} Bewerken</button>
          </div>
          <div class="card-body">
            <table style="width:100%"><tbody>
              ${[['Naam', t.naam], ['Type', typeBadge(t.type)], ['Categorie', catBadge(t.categorie)]].filter(([, v]) => v).map(([k, v]) => `
                <tr><td style="color:var(--navy4);font-size:12px;padding-right:16px;padding-bottom:10px;white-space:nowrap;vertical-align:top">${k}</td>
                    <td style="font-size:14px;padding-bottom:10px;color:var(--navy2)">${v}</td></tr>`).join('')}
            </tbody></table>
            ${t.omschrijving ? `<div style="margin-top:4px"><div style="font-size:11px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Omschrijving</div><div style="font-size:14px;color:var(--navy2);line-height:1.65;white-space:pre-wrap">${esc(t.omschrijving)}</div></div>` : ''}
            ${t.bestanden?.length ? `<div style="margin-top:14px"><div style="font-size:11px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Documenten</div>${renderTrainingBestanden(t.bestanden, id, false)}</div>` : ''}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Statistieken</h3></div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:12px">
              <div style="background:var(--bg);border-radius:10px;padding:16px;text-align:center">
                <div style="font-size:36px;font-weight:800;color:var(--navy)">${uitv.length}</div>
                <div style="font-size:12px;color:var(--navy4);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Uitvoeringen</div>
              </div>
              ${avgScore !== null ? `
              <div style="background:var(--bg);border-radius:10px;padding:16px;text-align:center">
                <div style="font-size:28px;font-weight:800;color:var(--navy);display:flex;align-items:center;justify-content:center;gap:8px">${renderStars(Math.round(parseFloat(avgScore)))}</div>
                <div style="font-size:20px;font-weight:800;color:var(--navy);margin-top:4px">${avgScore} <span style="font-size:13px;color:var(--navy4);font-weight:500">gemiddeld</span></div>
              </div>` : `
              <div style="background:var(--bg);border-radius:10px;padding:16px;text-align:center;color:var(--navy4);font-size:14px">Nog geen beoordeling</div>`}
              <div style="background:var(--bg);border-radius:10px;padding:16px;text-align:center">
                <div style="font-size:24px;font-weight:800;color:var(--navy)">${new Set(uitv.map(u => u.schoolId)).size}</div>
                <div style="font-size:12px;color:var(--navy4);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Scholen bereikt</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

  } else if (trainingTab === 'uitvoeringen') {
    tabContent = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-primary" onclick="openUitvoeringModal('${id}')">${svgIcon('add')} Uitvoering vastleggen</button>
      </div>
      ${uitv.length === 0 ? `
        <div class="card"><div class="empty-state">${svgIcon('school', 36)}<p>Nog geen uitvoeringen geregistreerd</p></div></div>` : `
      <div style="display:flex;flex-direction:column;gap:14px">
        ${uitv.map(u => {
          const school = DB.scholen.find(s => s.id === u.schoolId);
          const best   = school ? DB.besturen.find(b => b.id === school.bestuurId) : null;
          const contact = u.contactId ? DB.contacten.find(c => c.id === u.contactId) : null;
          return `
          <div class="card">
            <div class="card-body" style="padding:18px 22px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
                <div>
                  <div style="font-size:15px;font-weight:800;color:var(--navy);cursor:pointer" onclick="navigate('school-detail','${school?.id}')">${esc(school?.naam || 'Onbekende school')}</div>
                  ${best ? `<div style="font-size:12px;color:var(--navy4);margin-top:2px">${esc(best.naam)}</div>` : ''}
                  ${contact ? `<div style="font-size:12.5px;color:var(--navy3);margin-top:4px;display:inline-flex;align-items:center;gap:4px"><span style="color:var(--navy4)">${svgIcon('contact', 13)}</span><a onclick="event.stopPropagation();navigateToContact('${school?.id || ''}','${contact.id}')" style="color:var(--blue);cursor:pointer;font-weight:600">${esc(contact.naam)}</a>${contact.functie ? ` <span style="color:var(--navy4)">— ${esc(contact.functie)}</span>` : ''}</div>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="text-align:right">
                    <div style="font-size:12px;color:var(--navy4)">${fmtDate(u.datum)}</div>
                    ${u.score ? `<div style="margin-top:4px">${renderStars(u.score)}</div>` : ''}
                  </div>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="openUitvoeringModal('${id}','${u.id}')">${svgIcon('edit', 14)}</button>
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="delUitvoering('${u.id}','${id}')">${svgIcon('trash', 14)}</button>
                  </div>
                </div>
              </div>
              ${u.deelnemers ? `<div style="display:inline-flex;align-items:center;gap:5px;background:var(--bg);border-radius:6px;padding:3px 10px;font-size:12.5px;color:var(--navy3);margin-bottom:10px">${svgIcon('contact', 13)} ${esc(u.deelnemers)} deelnemer${u.deelnemers == 1 ? '' : 's'}</div>` : ''}
              ${u.evaluatie ? `<div style="margin-bottom:8px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--navy4);margin-bottom:5px">Evaluatie</div><div style="font-size:14px;color:var(--navy2);line-height:1.6;white-space:pre-wrap;background:var(--bg);border-radius:8px;padding:10px 14px">${esc(u.evaluatie)}</div></div>` : ''}
              ${u.watGingGoed ? `<div style="margin-bottom:8px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#2E7D52;margin-bottom:5px">✓ Wat ging goed</div><div style="font-size:13.5px;color:var(--navy2);line-height:1.6;white-space:pre-wrap;background:#E6F4EE;border-radius:8px;padding:10px 14px;border-left:3px solid #2E7D52">${esc(u.watGingGoed)}</div></div>` : ''}
              ${u.watKonBeter ? `<div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#C0392B;margin-bottom:5px">↑ Wat kon beter</div><div style="font-size:13.5px;color:var(--navy2);line-height:1.6;white-space:pre-wrap;background:#FDE8E8;border-radius:8px;padding:10px 14px;border-left:3px solid #C0392B">${esc(u.watKonBeter)}</div></div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`}`;

  } else if (trainingTab === 'tips') {
    tabContent = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-primary" onclick="openTipModal('${id}')">${svgIcon('tip')} Tip toevoegen</button>
      </div>
      ${tips.length === 0 ? `
        <div class="card"><div class="empty-state">${svgIcon('tip', 36)}<p>Nog geen tips toegevoegd</p></div></div>` : `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${tips.map((tip, i) => `
          <div style="background:white;border-radius:var(--r2);padding:18px 20px;border:1px solid var(--bg3);border-left:4px solid #E4A800;box-shadow:var(--sh)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
              <div style="flex:1">
                ${tip.titel ? `<div style="font-size:14px;font-weight:800;color:var(--navy);margin-bottom:6px">💡 ${esc(tip.titel)}</div>` : ''}
                <div style="font-size:14px;color:var(--navy2);line-height:1.65;white-space:pre-wrap">${esc(tip.tekst)}</div>
                <div style="font-size:11.5px;color:var(--navy4);margin-top:8px">${fmtDate(tip.datum)}</div>
              </div>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="delTip('${id}',${i})">${svgIcon('trash', 13)}</button>
            </div>
          </div>`).join('')}
      </div>`}`;
  }

  return `
    <div class="breadcrumb">
      <a onclick="navigate('trainingen')">Trainingen & Methodes</a>
      ${svgIcon('chevron', 14)} <span>${esc(t.naam)}</span>
    </div>
    <div class="detail-header">
      <div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div class="detail-title">${esc(t.naam)}</div>
          ${typeBadge(t.type)}
          ${catBadge(t.categorie)}
        </div>
        ${t.omschrijving ? `<div class="detail-subtitle" style="margin-top:6px;max-width:600px">${esc(t.omschrijving.slice(0, 120))}${t.omschrijving.length > 120 ? '…' : ''}</div>` : ''}
      </div>
      <button class="btn btn-secondary" onclick="openTrainingModal('${id}')">${svgIcon('edit', 14)} Bewerken</button>
    </div>
    <div class="tabs">
      ${tabs.map(([k, l]) => `<div class="tab${trainingTab === k ? ' active' : ''}" onclick="setTrainingTab('${id}','${k}')">${l}</div>`).join('')}
    </div>
    ${tabContent}`;
}

function openTrainingModal(id = '') {
  ensureTrainingTypes();
  ensureTrainingCategories();
  const t = id ? DB.trainingen.find(x => x.id === id) : null;
  const typeOpts = getTrainingTypeList().map(tp =>
    `<option value="${tp.id}"${(t?.type || 'training') === tp.id ? ' selected' : ''}>${esc(tp.naam)}</option>`).join('');
  const catOpts = getTrainingCategoryList().map(tp =>
    `<option value="${tp.id}"${(t?.categorie || 'algemeen') === tp.id ? ' selected' : ''}>${esc(tp.naam)}</option>`).join('');

  showModal(t ? 'Training bewerken' : 'Nieuwe training',
    `<div class="form-group"><label>Naam *</label>
       <input type="text" id="f-naam" value="${esc(t?.naam || '')}" placeholder="bijv. Groeimindset workshop"/></div>
     <div class="form-row">
       <div class="form-group"><label>Type</label><select id="f-type">${typeOpts}</select></div>
       <div class="form-group"><label>Categorie</label><select id="f-cat">${catOpts}</select></div>
     </div>
     <div class="form-group"><label>Omschrijving</label>
       <textarea id="f-omschr" rows="4" placeholder="Wat houdt deze training in?">${esc(t?.omschrijving || '')}</textarea></div>
     <div class="form-group"><label>Document toevoegen</label>
       <input type="file" id="f-train-bestand" multiple />
       <div style="font-size:11px;color:var(--navy4);margin-top:4px">Je kunt meerdere documenten tegelijk toevoegen.</div>
       ${t?.bestanden?.length ? `<div style="margin-top:8px;font-size:11px;font-weight:700;color:var(--navy4);text-transform:uppercase;letter-spacing:.6px">Bestaande documenten</div>${renderTrainingBestanden(t.bestanden, id, true)}` : ''}
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${t ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delTraining('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveTraining('${id}')">Opslaan</button>`);
}

function openUitvoeringModal(trainingId, uitvId = '') {
  const u = uitvId ? DB.uitvoeringen.find(x => x.id === uitvId) : null;
  _uitvScore = u?.score || 0;
  const schoolOpts = DB.scholen.map(s => `<option value="${s.id}"${u?.schoolId === s.id ? ' selected' : ''}>${esc(s.naam)}</option>`).join('');
  const contactOpts = renderContactOptionsForSchool(u?.schoolId || '', u?.contactId || '');

  showModal(u ? 'Uitvoering bewerken' : 'Uitvoering vastleggen',
    `<div class="form-row">
       <div class="form-group"><label>School *</label>
         <select id="f-school" onchange="onUitvSchoolChange(this.value)"><option value="">— Kies school —</option>${schoolOpts}</select></div>
       <div class="form-group"><label>Datum</label>
         <input type="date" id="f-datum" value="${esc(u?.datum?.slice(0, 10) || new Date().toISOString().slice(0, 10))}"/></div>
     </div>
     <div class="form-group"><label>Contactpersoon (optioneel)</label>
       <select id="f-contact">${contactOpts}</select>
       <div style="font-size:11px;color:var(--navy4);margin-top:4px">Kies een contactpersoon zodra je een school hebt geselecteerd.</div>
     </div>
     <div class="form-group"><label>Aantal deelnemers</label>
       <input type="number" id="f-deel" value="${esc(u?.deelnemers || '')}" placeholder="bijv. 12" min="1"/></div>
     <div class="form-group">
       <label>Succescore (1–5 sterren)</label>
       <div id="star-picker" style="display:flex;gap:4px;margin-top:4px;align-items:center">
         ${[1, 2, 3, 4, 5].map(i => `<span id="star-${i}" onclick="pickStar(${i})" style="cursor:pointer;font-size:28px;line-height:1;color:${i <= _uitvScore ? '#E4A800' : '#C2D8D9'}">★</span>`).join('')}
         <span id="star-label" style="font-size:13px;color:var(--navy3);margin-left:8px;font-weight:600">${_uitvScore > 0 ? _uitvScore + ' / 5' : ''}</span>
       </div>
     </div>
     <div class="form-group"><label>Evaluatie / samenvatting</label>
       <textarea id="f-eval" rows="3" placeholder="Hoe is de uitvoering verlopen?">${esc(u?.evaluatie || '')}</textarea></div>
     <div class="form-group"><label>✓ Wat ging goed?</label>
       <textarea id="f-goed" rows="2" placeholder="Sterke punten…">${esc(u?.watGingGoed || '')}</textarea></div>
     <div class="form-group"><label>↑ Wat kon beter?</label>
       <textarea id="f-beter" rows="2" placeholder="Verbeterpunten…">${esc(u?.watKonBeter || '')}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="saveUitvoering('${trainingId}','${uitvId || ''}')">Opslaan</button>`, true);
}

function openTipModal(trainingId) {
  showModal('Tip toevoegen',
    `<div class="form-group"><label>Titel (optioneel)</label>
       <input type="text" id="f-tiptitel" placeholder="bijv. Doe dit altijd eerst…"/></div>
     <div class="form-group"><label>Tip *</label>
       <textarea id="f-tiptekst" rows="5" placeholder="Beschrijf de tip zo concreet mogelijk…"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="saveTip('${trainingId}')">Opslaan</button>`);
}

function renderContactOptionsForSchool(schoolId, selectedContactId = '') {
  const empty = `<option value="">— Geen contactpersoon —</option>`;
  if (!schoolId) return empty;
  const contacten = DB.contacten.filter(c => c.schoolId === schoolId);
  if (!contacten.length) return empty;
  return empty + contacten.map(c =>
    `<option value="${c.id}"${selectedContactId === c.id ? ' selected' : ''}>${esc(c.naam)}${c.functie ? ' — ' + esc(c.functie) : ''}</option>`
  ).join('');
}

function onUitvSchoolChange(schoolId) {
  const sel = document.getElementById('f-contact');
  if (sel) sel.innerHTML = renderContactOptionsForSchool(schoolId, '');
}

function pickStar(n) {
  _uitvScore = n;
  [1, 2, 3, 4, 5].forEach(i => {
    const el = document.getElementById('star-' + i);
    if (el) el.style.color = i <= n ? '#E4A800' : '#C2D8D9';
  });
  const lbl = document.getElementById('star-label');
  if (lbl) lbl.textContent = n + ' / 5';
}
