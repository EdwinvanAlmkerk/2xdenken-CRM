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
  try { return _openEmailModalInner(opts); } catch (e) { console.error('openEmailModal error:', e); alert('Fout bij openen e-mail modal: ' + e.message); }
}
function _openEmailModalInner(opts) {
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
      <input type="email" id="f-email-to" value="${esc(prefillEmail)}" placeholder="e-mailadres invullen"/>
      <input type="hidden" id="f-email-contact-id" value=""/>
    </div>`;
  }

  // Pre-fill: vanuit template, of directe prefill (doorsturen/concept)
  let prefillOnderwerp = opts._prefillOnderwerp || '';
  let prefillBody = opts._prefillBody || '';
  const draftId = opts._draftId || '';
  const prefillEmail = opts._prefillEmail || '';
  if (!prefillOnderwerp && opts.templateId) {
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
       <select id="f-email-template" onchange="selectEmailTemplate()">
         <option value="">— Zonder template —</option>${tplOpts}
       </select>
       <input type="hidden" id="f-email-opts" value="${esc(JSON.stringify(opts))}"/>
     </div>
     <div class="form-group"><label>Onderwerp *</label><input type="text" id="f-email-onderwerp" value="${esc(prefillOnderwerp)}" placeholder="Onderwerp van de e-mail"/></div>
     <div class="form-group"><label>Bericht</label><textarea id="f-email-body" rows="10" placeholder="Typ hier je bericht...">${esc(prefillBody)}</textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-secondary" onclick="saveEmailDraft('${esc(opts.schoolId || '')}','${esc(opts.factuurId || '')}','${esc(draftId)}')">${svgIcon('edit', 14)} Concept opslaan</button>
     <button class="btn btn-primary" onclick="sendEmail('${esc(opts.schoolId || '')}','${esc(opts.factuurId || '')}','${esc(draftId)}')">${svgIcon('mail', 15)} Open in e-mailprogramma</button>`, true);
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
function selectEmailTemplate() {
  const optsEl = document.getElementById('f-email-opts');
  const opts = optsEl ? JSON.parse(optsEl.value) : {};
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

// ── Heeft SMTP-server geconfigureerd? ─────────────────────────────
function hasSmtpConfig() {
  return DB.emailSettings?.smtpHost && DB.emailSettings?.emailUser && DB.emailSettings?.emailPass;
}

// ── Verzenden (SMTP of mailto) + auto-log ────────────────────────
async function sendEmail(schoolId, factuurId, draftId) {
  const email = document.getElementById('f-email-to')?.value?.trim();
  if (!email) return alert('Geen e-mailadres opgegeven');
  const onderwerp = document.getElementById('f-email-onderwerp').value.trim();
  if (!onderwerp) return alert('Onderwerp is verplicht');
  const body = document.getElementById('f-email-body').value.trim();
  const contactId = document.getElementById('f-email-contact-id')?.value || '';
  const contact = contactId ? DB.contacten.find(c => c.id === contactId) : null;

  let sentViaSmtp = false;

  // Probeer SMTP als geconfigureerd
  if (hasSmtpConfig()) {
    showLoading();
    try {
      const res = await supa('/functions/v1/send-email', {
        method: 'POST',
        body: JSON.stringify({ to: email, subject: onderwerp, body }),
      });
      sentViaSmtp = true;
    } catch (e) {
      hideLoading();
      if (!confirm(`SMTP verzending mislukt: ${e.message}\n\nWil je het bericht openen in je e-mailprogramma (mailto)?`)) return;
    }
  }

  // Fallback naar mailto als geen SMTP of SMTP mislukt
  if (!sentViaSmtp) {
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(onderwerp)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  }

  showLoading();
  try {
    const now = new Date().toISOString();

    // Log naar email_log
    if (draftId) {
      await supa(`/rest/v1/email_log?id=eq.${draftId}`, { method: 'PATCH', body: JSON.stringify({ aan_email: email, aan_naam: contact?.naam || '', onderwerp, body, status: 'verzonden', datum: now }) });
      DB.emailLog = DB.emailLog.map(e => e.id === draftId ? { ...e, aanEmail: email, aanNaam: contact?.naam || '', onderwerp, body, status: 'verzonden', datum: now } : e);
    } else {
      const logId = uid();
      const logPayload = { id: logId, template_id: null, school_id: schoolId || null, contact_id: contactId || null, factuur_id: factuurId || null, aan_email: email, aan_naam: contact?.naam || '', onderwerp, body, status: 'verzonden', datum: now };
      await supa('/rest/v1/email_log', { method: 'POST', body: JSON.stringify(logPayload) });
      DB.emailLog.unshift({ id: logId, templateId: '', schoolId: schoolId || '', contactId: contactId || '', factuurId: factuurId || '', aanEmail: email, aanNaam: contact?.naam || '', onderwerp, body, status: 'verzonden', datum: now });
    }

    // Log naar dossier als school gekoppeld
    if (schoolId) {
      const school = DB.scholen.find(s => s.id === schoolId);
      const bronNaam = contact ? `${contact.naam} — ${school?.naam || ''}` : (school?.naam || '');
      const tekst = `E-mail ${sentViaSmtp ? 'verzonden' : 'geopend'} aan: ${email}\nOnderwerp: ${onderwerp}\n\n${body}`;
      const dosId = uid();
      const item = { id: dosId, schoolId, contactId: contactId || null, datum: now, type: 'notitie', onderwerp: `E-mail — ${onderwerp}`, tekst, bronNaam, bestanden: [], bijlagen: [] };
      const payload = { id: dosId, school_id: schoolId, datum: now, type: 'notitie', onderwerp: item.onderwerp, tekst, bron_naam: bronNaam, bestanden: [] };
      await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify(payload) });
      DB.dossiers.unshift(item);
    }

    showToast(sentViaSmtp ? 'E-mail verzonden en vastgelegd' : 'E-mail geopend en vastgelegd', 'success');
  } catch (e) {
    showToast('Loggen mislukt: ' + e.message, 'error');
  } finally { hideLoading(); }

  closeModal();
  renderContent();
}

// ── Concept opslaan ──────────────────────────────────────────────
async function saveEmailDraft(schoolId, factuurId, draftId) {
  const email = document.getElementById('f-email-to')?.value?.trim() || '';
  const onderwerp = document.getElementById('f-email-onderwerp').value.trim();
  const body = document.getElementById('f-email-body').value.trim();
  const contactId = document.getElementById('f-email-contact-id')?.value || '';
  const contact = contactId ? DB.contacten.find(c => c.id === contactId) : null;

  showLoading();
  try {
    const now = new Date().toISOString();
    if (draftId) {
      await supa(`/rest/v1/email_log?id=eq.${draftId}`, { method: 'PATCH', body: JSON.stringify({ aan_email: email, aan_naam: contact?.naam || '', onderwerp, body, status: 'concept', datum: now }) });
      DB.emailLog = DB.emailLog.map(e => e.id === draftId ? { ...e, aanEmail: email, aanNaam: contact?.naam || '', onderwerp, body, status: 'concept', datum: now } : e);
    } else {
      const logId = uid();
      const logPayload = { id: logId, school_id: schoolId || null, contact_id: contactId || null, factuur_id: factuurId || null, aan_email: email, aan_naam: contact?.naam || '', onderwerp, body, status: 'concept', datum: now };
      await supa('/rest/v1/email_log', { method: 'POST', body: JSON.stringify(logPayload) });
      DB.emailLog.unshift({ id: logId, templateId: '', schoolId: schoolId || '', contactId: contactId || '', factuurId: factuurId || '', aanEmail: email, aanNaam: contact?.naam || '', onderwerp, body, status: 'concept', datum: now });
    }
    showToast('Concept opgeslagen', 'success');
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
  closeModal(); renderContent();
}

// ── Doorsturen ───────────────────────────────────────────────────
function forwardEmail(logId) {
  const e = DB.emailLog.find(x => x.id === logId);
  if (!e) return;
  const fwdBody = `\n\n---------- Doorgestuurd bericht ----------\nVan: ${e.aanEmail}\nDatum: ${fmtDate(e.datum)}\nOnderwerp: ${e.onderwerp}\n\n${e.body}`;
  openEmailModal({ schoolId: e.schoolId, _prefillOnderwerp: `Fwd: ${e.onderwerp}`, _prefillBody: fwdBody });
}

// ── Concept openen als bewerken ──────────────────────────────────
function openEmailFromDraft(logId) {
  const e = DB.emailLog.find(x => x.id === logId);
  if (!e) return;
  openEmailModal({ schoolId: e.schoolId, contactId: e.contactId, factuurId: e.factuurId, _draftId: logId, _prefillOnderwerp: e.onderwerp, _prefillBody: e.body, _prefillEmail: e.aanEmail });
}

// ── E-mail log verwijderen ───────────────────────────────────────
async function delEmailLog(id) {
  if (!confirm('Bericht verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/email_log?id=eq.${id}`, { method: 'DELETE' });
    DB.emailLog = DB.emailLog.filter(e => e.id !== id);
    _emailSelected = null;
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}
