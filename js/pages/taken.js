// ════════════════════════════════════════════════════════════════
// TAKEN — Takenpagina, modal, CRUD + taaktype-beheer
// ════════════════════════════════════════════════════════════════
// Zelfstandige module (patroon gespiegeld op de kostenmodule). Géén
// automatische achtergrondtaken; alles loopt via de UI en async.

let _takenFilter = 'open'; // 'open' | 'afgerond' | 'alle'

// ── Taaktypes: helpers (spiegelt kostenType-helpers) ─────────────
function ensureTaakTypes() {
  if (!Array.isArray(DB.taakTypes)) DB.taakTypes = [];
}
function getTaakTypeList() {
  ensureTaakTypes();
  return DB.taakTypes;
}
function getTaakTypeInfo(typeId = '') {
  const list = getTaakTypeList();
  const found = list.find(t => t.id === typeId)
    || list[0]
    || { id: typeId || 'overig', naam: typeId || 'Overig', kleur: 'grijs' };
  const style = (typeof TRAINING_TYPE_STYLES === 'object' ? TRAINING_TYPE_STYLES : null)?.[found.kleur]
    || { color: '#6B6B8A', bg: '#F0F0F5' };
  return { ...found, label: found.naam || 'Overig', color: style.color, bg: style.bg };
}
function taakTypeLabel(typeId = '') { return getTaakTypeInfo(typeId).label; }
function taakTypeBadge(typeId = '') {
  const info = getTaakTypeInfo(typeId);
  return `<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:11.5px;font-weight:700;background:${info.bg};color:${info.color}">${esc(info.label)}</span>`;
}

// ── Datum-helpers ────────────────────────────────────────────────
function _taakVandaag() { return new Date().toISOString().slice(0, 10); }
function _taakIsOpen(t) { return (t.status || 'open') !== 'afgerond'; }
function _taakIsTeLaat(t) { return _taakIsOpen(t) && t.deadline && t.deadline < _taakVandaag(); }

// ── Takenpagina ──────────────────────────────────────────────────
function setTakenFilter(f) { _takenFilter = f; renderContent(); }

function renderTakenPage() {
  ensureTaakTypes();
  const vandaag = _taakVandaag();
  let taken = [...(DB.taken || [])];
  if (_takenFilter === 'open')     taken = taken.filter(_taakIsOpen);
  if (_takenFilter === 'afgerond') taken = taken.filter(t => !_taakIsOpen(t));

  // Sorteer: open op deadline (leeg achteraan), afgerond op afgerond-datum desc.
  taken.sort((a, b) => {
    const ao = _taakIsOpen(a), bo = _taakIsOpen(b);
    if (ao !== bo) return ao ? -1 : 1;
    if (ao) return (a.deadline || '9999').localeCompare(b.deadline || '9999');
    return (b.afgerondOp || '').localeCompare(a.afgerondOp || '');
  });

  const openCount = (DB.taken || []).filter(_taakIsOpen).length;
  const teLaatCount = (DB.taken || []).filter(_taakIsTeLaat).length;

  const filterBtn = (val, label) =>
    `<button class="btn btn-sm ${_takenFilter === val ? 'btn-primary' : 'btn-secondary'}" onclick="setTakenFilter('${val}')">${label}</button>`;

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <div style="display:flex;gap:8px">
        ${filterBtn('open', `Open${openCount ? ` (${openCount})` : ''}`)}
        ${filterBtn('afgerond', 'Afgerond')}
        ${filterBtn('alle', 'Alle')}
      </div>
      <button class="btn btn-primary" onclick="openTaakModal()">${svgIcon('add', 15)} Nieuwe taak</button>
    </div>
    ${teLaatCount > 0 && _takenFilter !== 'afgerond' ? `<div style="margin-bottom:14px;padding:9px 14px;background:var(--s-rood-s, #FDE8E8);border:1px solid rgba(192,57,43,0.2);border-radius:var(--r);font-size:13px;color:var(--s-rood, #C0392B);display:flex;align-items:center;gap:8px">${svgIcon('clock', 14)} Je hebt <strong>${teLaatCount}</strong> taak/taken waarvan de deadline verstreken is.</div>` : ''}
    ${taken.length === 0
      ? `<div class="card"><div class="empty-state" style="padding:44px">${svgIcon('board', 36)}<p>${_takenFilter === 'afgerond' ? 'Nog geen afgeronde taken' : 'Geen taken'}</p><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="openTaakModal()">${svgIcon('add', 14)} Nieuwe taak</button></div></div>`
      : `<div class="card"><div class="card-body" style="padding:0"><table><tbody>
          ${taken.map(renderTaakRow).join('')}
        </tbody></table></div></div>`}`;
}

// Eén rij in de takenlijst.
function renderTaakRow(t) {
  const open = _taakIsOpen(t);
  const teLaat = _taakIsTeLaat(t);
  const contact = t.contactId ? getContact(t.contactId) : null;
  const school = t.schoolId ? getSchool(t.schoolId) : null;
  const koppeling = contact
    ? `<a onclick="event.stopPropagation();navigateToContact('${contact.schoolId || ''}','${contact.id}')" style="color:var(--blue);cursor:pointer">${esc(contact.naam)}</a>${school ? ` <span style="color:var(--navy4)">· ${esc(school.naam)}</span>` : ''}`
    : (school ? `<a onclick="event.stopPropagation();navigate('school-detail','${school.id}')" style="color:var(--blue);cursor:pointer">${esc(school.naam)}</a>` : '<span style="color:var(--navy4)">Losse taak</span>');

  const deadlineStr = t.deadline
    ? `<span style="color:${teLaat ? 'var(--s-rood, #C0392B)' : 'var(--navy3)'};font-weight:${teLaat ? '700' : '500'}">${svgIcon('clock', 12)} ${fmtDateShort(t.deadline)}</span>`
    : '<span style="color:var(--navy4)">geen deadline</span>';
  const planStr = t.planDatum
    ? `<span style="color:var(--accent);font-size:12px" title="Ingepland in agenda">${svgIcon('calendar', 12)} ${fmtDateShort(t.planDatum)}${t.planBeginTijd ? ' ' + t.planBeginTijd.slice(0, 5) : ''}</span>`
    : '';

  return `
    <tr class="clickable-row" onclick="openTaakModal('${t.id}')" style="${open ? '' : 'opacity:.6'}">
      <td style="width:38px;text-align:center" onclick="event.stopPropagation()">
        <input type="checkbox" ${open ? '' : 'checked'} onclick="toggleTaakStatus('${t.id}')" title="${open ? 'Markeer als afgerond' : 'Heropenen'}" style="width:18px;height:18px;cursor:pointer"/>
      </td>
      <td>
        <div style="font-weight:600;color:var(--navy);${open ? '' : 'text-decoration:line-through'}">${esc(t.onderwerp || '(geen onderwerp)')}</div>
        <div style="font-size:12px;color:var(--navy4);margin-top:2px">${koppeling}</div>
      </td>
      <td style="width:110px">${taakTypeBadge(t.taakTypeId)}</td>
      <td style="width:150px">${deadlineStr}${planStr ? `<div style="margin-top:2px">${planStr}</div>` : ''}</td>
      <td style="width:44px" onclick="event.stopPropagation()">
        <div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delTaak('${t.id}')" style="color:var(--s-rood)">${svgIcon('trash', 13)}</button>
        </div>
      </td>
    </tr>`;
}

// Compacte takensectie voor in het dossier (contact-, school- of bestuur-
// niveau). `taken` = de al-gefilterde lijst; prefill* voor de "Nieuwe taak"-knop.
function renderTakenDossierSectie(taken, prefillContactId = '', prefillSchoolId = '') {
  const open = (taken || []).filter(_taakIsOpen).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  const klaar = (taken || []).filter(t => !_taakIsOpen(t)).sort((a, b) => (b.afgerondOp || '').localeCompare(a.afgerondOp || ''));
  const lijst = [...open, ...klaar];
  return `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <h3>${svgIcon('board', 16)} Taken${open.length ? ` <span style="color:var(--navy4);font-weight:500;font-size:13px">(${open.length} open)</span>` : ''}</h3>
        <button class="btn btn-primary btn-sm" onclick="openTaakModal('','${prefillContactId}','${prefillSchoolId}')">${svgIcon('add', 14)} Nieuwe taak</button>
      </div>
      <div class="card-body" style="padding:0">
        ${lijst.length === 0
          ? `<div class="empty-state" style="padding:20px;font-size:13px"><p>Nog geen taken</p></div>`
          : `<table><tbody>${lijst.map(renderTaakRow).join('')}</tbody></table>`}
      </div>
    </div>`;
}

// ── Taak-modal (nieuw/bewerken) ──────────────────────────────────
// prefillContactId/prefillSchoolId: bij openen vanaf een detailpagina.
function openTaakModal(id = '', prefillContactId = '', prefillSchoolId = '') {
  ensureTaakTypes();
  const t = id ? (DB.taken || []).find(x => x.id === id) : null;
  const types = getTaakTypeList();
  const selType = t?.taakTypeId || types[0]?.id || '';
  const selContact = t?.contactId || prefillContactId || '';

  const typeOpts = types.map(tp => `<option value="${tp.id}"${tp.id === selType ? ' selected' : ''}>${esc(tp.naam)}</option>`).join('');
  const contacten = [...(DB.contacten || [])].sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl'));
  const contactOpts = `<option value="">— Losse taak (geen koppeling) —</option>` + contacten.map(c => {
    const s = c.schoolId ? getSchool(c.schoolId) : null;
    return `<option value="${c.id}"${c.id === selContact ? ' selected' : ''}>${esc(c.naam)}${s ? ' — ' + esc(s.naam) : ''}</option>`;
  }).join('');

  showModal(t ? 'Taak bewerken' : 'Nieuwe taak',
    `<div class="form-group"><label>Onderwerp *</label><input type="text" id="f-taak-onderwerp" value="${esc(t?.onderwerp || '')}" placeholder="Bijv. Terugbellen over offerte"/></div>
     <div class="form-row">
       <div class="form-group"><label>Soort</label><select id="f-taak-type">${typeOpts}</select></div>
       <div class="form-group"><label>Deadline *</label><input type="date" id="f-taak-deadline" value="${esc(t?.deadline || _taakVandaag())}"/></div>
     </div>
     <div class="form-group"><label>Omschrijving</label><textarea id="f-taak-tekst" rows="3" placeholder="Details van de taak…">${esc(t?.tekst || '')}</textarea></div>
     <div class="form-group"><label>Koppelen aan contactpersoon</label><select id="f-taak-contact">${contactOpts}</select></div>
     <div style="border-top:1px solid var(--bg3);margin:6px 0 12px"></div>
     <div class="form-group" style="margin-bottom:6px">
       <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
         <input type="checkbox" id="f-taak-plan" ${t?.planDatum ? 'checked' : ''} onchange="document.getElementById('taak-plan-velden').style.display=this.checked?'':'none'" style="width:auto"/>
         Inplannen in agenda (wanneer voer je het uit?)
       </label>
     </div>
     <div id="taak-plan-velden" style="display:${t?.planDatum ? '' : 'none'}">
       <div class="form-row">
         <div class="form-group"><label>Uitvoerdatum</label><input type="date" id="f-taak-plandatum" value="${esc(t?.planDatum || '')}"/></div>
         <div class="form-group"><label>Van</label><input type="time" id="f-taak-planbegin" value="${esc((t?.planBeginTijd || '').slice(0, 5))}"/></div>
         <div class="form-group"><label>Tot</label><input type="time" id="f-taak-planeind" value="${esc((t?.planEindTijd || '').slice(0, 5))}"/></div>
       </div>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${t ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delTaak('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveTaak('${id}')">${t ? 'Opslaan' : 'Taak aanmaken'}</button>`);
}

async function saveTaak(id) {
  const onderwerp = document.getElementById('f-taak-onderwerp').value.trim();
  if (!onderwerp) return alert('Onderwerp is verplicht');
  const deadline = document.getElementById('f-taak-deadline').value;
  if (!deadline) return alert('Deadline is verplicht');

  const contactId = document.getElementById('f-taak-contact').value || '';
  const contact = contactId ? getContact(contactId) : null;
  const schoolId = contact?.schoolId || '';
  const school = schoolId ? getSchool(schoolId) : null;
  const bestuurId = school?.bestuurId || '';

  const planAan = document.getElementById('f-taak-plan')?.checked;
  const data = {
    onderwerp,
    tekst: document.getElementById('f-taak-tekst').value.trim(),
    taakTypeId: document.getElementById('f-taak-type').value || '',
    deadline,
    planDatum: planAan ? (document.getElementById('f-taak-plandatum').value || '') : '',
    planBeginTijd: planAan ? (document.getElementById('f-taak-planbegin').value || '') : '',
    planEindTijd: planAan ? (document.getElementById('f-taak-planeind').value || '') : '',
    contactId: contactId || '',
    schoolId,
    bestuurId,
  };

  const bestaand = id ? (DB.taken || []).find(x => x.id === id) : null;
  data.status = bestaand?.status || 'open';
  data.afgerondOp = bestaand?.afgerondOp || '';

  showLoading();
  try {
    if (id) {
      await supa(`/rest/v1/taken?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(toDB_taak(data)) });
      DB.taken = DB.taken.map(x => x.id === id ? { ...x, ...data } : x);
    } else {
      const newId = uid();
      await supa('/rest/v1/taken', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_taak(data) }) });
      DB.taken.unshift({ id: newId, ...data, createdAt: new Date().toISOString() });
    }
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function toggleTaakStatus(id) {
  const t = (DB.taken || []).find(x => x.id === id);
  if (!t) return;
  const wordtAfgerond = _taakIsOpen(t);
  const status = wordtAfgerond ? 'afgerond' : 'open';
  const afgerondOp = wordtAfgerond ? new Date().toISOString() : '';
  try {
    await supa(`/rest/v1/taken?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status, afgerond_op: afgerondOp || null }) });
    DB.taken = DB.taken.map(x => x.id === id ? { ...x, status, afgerondOp } : x);
    renderContent();
  } catch (e) { toastError(e); }
}

async function delTaak(id) {
  if (!confirm('Taak verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/taken?id=eq.${id}`, { method: 'DELETE' });
    DB.taken = (DB.taken || []).filter(x => x.id !== id);
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

// ── Taaktype-beheer (Instellingen) — spiegelt kostentype-modal ───
function openTaakTypeModal(id = '') {
  ensureTaakTypes();
  const list = getTaakTypeList();
  const t = id ? list.find(x => x.id === id) : null;
  const kleurOpties = Object.entries(AGENDA_KLEUR_LABELS).map(([val, label]) => {
    const k = AGENDA_KLEUREN[val];
    return `<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;border:2px solid ${(t?.kleur || 'navy') === val ? 'var(--navy)' : 'var(--bg3)'};background:${(t?.kleur || 'navy') === val ? 'var(--bg)' : 'white'}">
      <input type="radio" name="taaktypekleur" value="${val}" ${(t?.kleur || 'navy') === val ? 'checked' : ''} style="display:none" onclick="document.querySelectorAll('#taaktype-kleur-grid label').forEach(l=>{l.style.borderColor='var(--bg3)';l.style.background='white'});this.closest('label').style.borderColor='var(--navy)';this.closest('label').style.background='var(--bg)'">
      <span class="badge ${k.badge}">${esc(label)}</span>
    </label>`;
  }).join('');

  showModal(t ? 'Taaktype bewerken' : 'Nieuw taaktype',
    `<div class="form-group"><label>Naam *</label><input type="text" id="f-taaktypename" value="${esc(t?.naam || '')}" placeholder="Bijv. Bellen, Mailen, To-do…"/></div>
     <div class="form-group">
       <label>Kleur</label>
       <div id="taaktype-kleur-grid" style="display:flex;gap:8px;flex-wrap:wrap">${kleurOpties}</div>
       <select id="f-taaktypekleur" style="display:none"><option value="${esc(t?.kleur || 'navy')}">${esc(t?.kleur || 'navy')}</option></select>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${t ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delTaakType('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="document.getElementById('f-taaktypekleur').value=document.querySelector('input[name=taaktypekleur]:checked')?.value||'navy';saveTaakType('${id}')">${t ? 'Opslaan' : 'Toevoegen'}</button>`);
}

async function saveTaakType(id) {
  ensureTaakTypes();
  const naam = document.getElementById('f-taaktypename').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const kleur = document.getElementById('f-taaktypekleur').value || 'navy';
  showLoading();
  try {
    if (id) {
      if (HAS_TAAK_TYPES_TABLE) await supa(`/rest/v1/taak_types?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ naam, kleur }) });
      DB.taakTypes = DB.taakTypes.map(t => t.id === id ? { ...t, naam, kleur } : t);
    } else {
      const newId = (typeof normalizeTypeId === 'function' ? normalizeTypeId(naam) : naam.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')) || uid();
      if (DB.taakTypes.find(t => t.id === newId)) return alert('Er bestaat al een taaktype met deze naam');
      if (HAS_TAAK_TYPES_TABLE) await supa('/rest/v1/taak_types', { method: 'POST', body: JSON.stringify({ id: newId, naam, kleur }) });
      DB.taakTypes.push({ id: newId, naam, kleur });
    }
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delTaakType(id) {
  ensureTaakTypes();
  if ((DB.taakTypes || []).length <= 1) return alert('Er moet minimaal één taaktype overblijven.');
  const inGebruik = (DB.taken || []).filter(t => t.taakTypeId === id).length;
  const msg = inGebruik > 0
    ? `Dit type wordt gebruikt door ${inGebruik} taak/taken. Verwijderen? Die taken worden zonder type weergegeven.`
    : 'Taaktype verwijderen?';
  if (!confirm(msg)) return;
  showLoading();
  try {
    if (HAS_TAAK_TYPES_TABLE) await supa(`/rest/v1/taak_types?id=eq.${id}`, { method: 'DELETE' });
    DB.taakTypes = DB.taakTypes.filter(t => t.id !== id);
    DB.taken = (DB.taken || []).map(t => t.taakTypeId === id ? { ...t, taakTypeId: '' } : t);
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}
