// ════════════════════════════════════════════════════════════════
// EMAIL — Compose modal, template variabelen, auto-log
// ════════════════════════════════════════════════════════════════

// ── Template variabelen invullen ─────────────────────────────────
function resolveTemplateVars(text, opts = {}) {
  const contact = opts.contactId ? DB.contacten.find(c => c.id === opts.contactId) : null;
  const school  = opts.schoolId  ? DB.scholen.find(s => s.id === opts.schoolId) : null;
  const bestuur = school?.bestuurId ? DB.besturen.find(b => b.id === school.bestuurId) : null;
  const factuur = opts.factuurId ? DB.facturen.find(f => f.id === opts.factuurId) : null;

  const vars = {
    contactnaam:    contact?.naam || '',
    contactemail:   contact?.email || '',
    contactfunctie: contact?.functie || '',
    schoolnaam:     school?.naam || '',
    schooladres:    school?.adres || '',
    schoolplaats:   school?.plaats || '',
    bestuursnaam:   bestuur?.naam || '',
    debiteurnummer: school?.debiteurnr || '',
    factuurnummer:  factuur?.nummer || '',
    factuurbedrag:  factuur ? fmtEuro(factuur.totaal) : '',
    factuurdatum:   factuur?.datum ? fmtDate(factuur.datum) : '',
    vervaldatum:    factuur?.vervaldatum ? fmtDate(factuur.vervaldatum) : '',
    factuurbetreft: factuur?.betreft || '',
    vandaag:        fmtDate(new Date().toISOString()),
    gebruikersnaam: currentUser?.name || currentUser?.email || '',
  };

  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] !== undefined && vars[key] !== '' ? vars[key] : match);
}

// ── Compose modal openen ─────────────────────────────────────────
// opts: { contactId, schoolId, factuurId, templateId }
function openEmailModal(opts = {}) {
  const contact = opts.contactId ? DB.contacten.find(c => c.id === opts.contactId) : null;
  const school  = opts.schoolId  ? DB.scholen.find(s => s.id === opts.schoolId) : null;
  const factuur = opts.factuurId ? DB.facturen.find(f => f.id === opts.factuurId) : null;

  // Als geen contact maar wel factuur met contactId, gebruik die
  if (!opts.contactId && factuur?.contactId) {
    opts.contactId = factuur.contactId;
  }
  const resolvedContact = opts.contactId ? DB.contacten.find(c => c.id === opts.contactId) : contact;

  // Contactselectie: als schoolId maar geen contactId, toon dropdown
  const schoolContacten = opts.schoolId ? DB.contacten.filter(c => c.schoolId === opts.schoolId && c.email) : [];
  const needsContactSelect = !opts.contactId && schoolContacten.length > 0;

  // Template opties
  const tplOpts = DB.emailTemplates.map(t =>
    `<option value="${t.id}"${opts.templateId === t.id ? ' selected' : ''}>${esc(t.naam)} (${esc(t.categorie)})</option>`
  ).join('');

  // Ontvanger-info
  let ontvangerHtml = '';
  if (resolvedContact?.email) {
    ontvangerHtml = `<div class="form-group">
      <label>Aan</label>
      <div style="padding:10px 13px;background:var(--glass);border:1px solid var(--bg3);border-radius:var(--r);font-size:14px">
        <strong>${esc(resolvedContact.naam)}</strong> &lt;${esc(resolvedContact.email)}&gt;
      </div>
      <input type="hidden" id="f-email-to" value="${esc(resolvedContact.email)}"/>
      <input type="hidden" id="f-email-contact-id" value="${esc(opts.contactId || '')}"/>
    </div>`;
  } else if (needsContactSelect) {
    ontvangerHtml = `<div class="form-group">
      <label>Aan *</label>
      <select id="f-email-contact-select" onchange="onEmailContactChange()">
        <option value="">— Kies contactpersoon —</option>
        ${schoolContacten.map(c => `<option value="${c.id}">${esc(c.naam)} &lt;${esc(c.email)}&gt;</option>`).join('')}
      </select>
      <input type="hidden" id="f-email-to" value=""/>
      <input type="hidden" id="f-email-contact-id" value=""/>
    </div>`;
  } else {
    ontvangerHtml = `<div class="form-group">
      <label>Aan</label>
      <input type="email" id="f-email-to" value="" placeholder="e-mailadres invullen"/>
      <input type="hidden" id="f-email-contact-id" value=""/>
    </div>`;
  }

  // Pre-fill als template geselecteerd
  let prefillOnderwerp = '';
  let prefillBody = '';
  if (opts.templateId) {
    const tpl = DB.emailTemplates.find(t => t.id === opts.templateId);
    if (tpl) {
      prefillOnderwerp = resolveTemplateVars(tpl.onderwerp, opts);
      prefillBody = resolveTemplateVars(tpl.body, opts);
    }
  }

  // Context-info
  let contextHtml = '';
  if (school) {
    contextHtml += `${svgIcon('school', 13)} ${esc(school.naam)}`;
  }
  if (factuur) {
    contextHtml += `${contextHtml ? ' · ' : ''}${svgIcon('invoice', 13)} Factuur ${esc(factuur.nummer)}`;
  }

  showModal('E-mail opstellen',
    `${contextHtml ? `<div style="margin-bottom:16px;padding:8px 14px;background:var(--glass);border:1px solid var(--bg3);border-radius:var(--r);font-size:12px;color:var(--navy3);display:flex;align-items:center;gap:6px">${contextHtml}</div>` : ''}
     ${ontvangerHtml}
     <div class="form-group">
       <label>Template</label>
       <select id="f-email-template" onchange="selectEmailTemplate('${esc(JSON.stringify(opts).replace(/'/g, "\\'"))}')">
         <option value="">— Zonder template —</option>${tplOpts}
       </select>
     </div>
     <div class="form-group"><label>Onderwerp *</label><input type="text" id="f-email-onderwerp" value="${esc(prefillOnderwerp)}" placeholder="Onderwerp van de e-mail"/></div>
     <div class="form-group"><label>Bericht</label><textarea id="f-email-body" rows="10" placeholder="Typ hier je bericht...">${esc(prefillBody)}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" onclick="sendEmail('${esc(opts.schoolId || '')}','${esc(opts.factuurId || '')}')">${svgIcon('mail', 15)} Open in e-mailprogramma</button>`, true);
}

// ── Contact-selectie change handler ──────────────────────────────
function onEmailContactChange() {
  const sel = document.getElementById('f-email-contact-select');
  const contactId = sel?.value || '';
  const contact = contactId ? DB.contacten.find(c => c.id === contactId) : null;
  const toEl = document.getElementById('f-email-to');
  const cidEl = document.getElementById('f-email-contact-id');
  if (toEl) toEl.value = contact?.email || '';
  if (cidEl) cidEl.value = contactId;
}

// ── Template selectie handler ────────────────────────────────────
function selectEmailTemplate(optsJson) {
  const opts = JSON.parse(optsJson);
  const tplId = document.getElementById('f-email-template').value;
  const tpl = tplId ? DB.emailTemplates.find(t => t.id === tplId) : null;

  // Contact uit de select halen als die er is
  const contactSel = document.getElementById('f-email-contact-select');
  if (contactSel?.value) opts.contactId = contactSel.value;
  const cidEl = document.getElementById('f-email-contact-id');
  if (cidEl?.value) opts.contactId = cidEl.value;

  const onderwerpEl = document.getElementById('f-email-onderwerp');
  const bodyEl = document.getElementById('f-email-body');

  if (tpl) {
    onderwerpEl.value = resolveTemplateVars(tpl.onderwerp, opts);
    bodyEl.value = resolveTemplateVars(tpl.body, opts);
  } else {
    onderwerpEl.value = '';
    bodyEl.value = '';
  }
}

// ── Verzenden (mailto) + auto-log ────────────────────────────────
async function sendEmail(schoolId, factuurId) {
  const email = document.getElementById('f-email-to')?.value?.trim();
  if (!email) return alert('Geen e-mailadres opgegeven');
  const onderwerp = document.getElementById('f-email-onderwerp').value.trim();
  if (!onderwerp) return alert('Onderwerp is verplicht');
  const body = document.getElementById('f-email-body').value.trim();
  const contactId = document.getElementById('f-email-contact-id')?.value || '';

  // mailto openen
  const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(onderwerp)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl, '_blank');

  // Auto-log in dossier
  if (schoolId) {
    showLoading();
    try {
      const school = DB.scholen.find(s => s.id === schoolId);
      const contact = contactId ? DB.contacten.find(c => c.id === contactId) : null;
      const bronNaam = contact ? `${contact.naam} — ${school?.naam || ''}` : (school?.naam || '');
      const tekst = `E-mail verzonden aan: ${email}\nOnderwerp: ${onderwerp}\n\n${body}`;
      const newId = uid();
      const item = { id: newId, schoolId, contactId: contactId || null, datum: new Date().toISOString(), type: 'notitie', onderwerp: `E-mail — ${onderwerp}`, tekst, bronNaam, bestanden: [], bijlagen: [] };
      const payload = { id: newId, school_id: schoolId, datum: item.datum, type: 'notitie', onderwerp: item.onderwerp, tekst, bron_naam: bronNaam, bestanden: [] };
      await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify(payload) });
      DB.dossiers.unshift(item);
      showToast('E-mail geopend en vastgelegd in dossier', 'success');
    } catch (e) {
      showToast('E-mail geopend, maar loggen mislukt: ' + e.message, 'error');
    } finally { hideLoading(); }
  } else {
    showToast('E-mail geopend in e-mailprogramma', 'success');
  }

  closeModal();
  renderContent();
}
