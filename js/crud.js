// ════════════════════════════════════════════════════════════════
// CRUD — Alle save/delete functies naar Supabase
// ════════════════════════════════════════════════════════════════

// ── BESTUREN ─────────────────────────────────────────────────────
async function saveBestuur(id) {
  const naam = document.getElementById('f-naam').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const data = { naam, website: document.getElementById('f-web').value.trim(), adres: document.getElementById('f-adres').value.trim() };
  showLoading();
  try {
    if (id) {
      await supa(`/rest/v1/besturen?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(toDB_bestuur(data)) });
      DB.besturen = DB.besturen.map(b => b.id === id ? { ...b, ...data } : b);
    } else {
      const newId = uid();
      await supa('/rest/v1/besturen', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_bestuur(data) }) });
      DB.besturen.push({ id: newId, ...data });
    }
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delBestuur(id) {
  if (!confirm('Bestuur verwijderen? Scholen worden losgekoppeld.')) return;
  showLoading();
  try {
    await supa(`/rest/v1/besturen?id=eq.${id}`, { method: 'DELETE' });
    DB.besturen = DB.besturen.filter(b => b.id !== id);
    DB.scholen  = DB.scholen.map(s => s.bestuurId === id ? { ...s, bestuurId: null } : s);
    await supa(`/rest/v1/scholen?bestuur_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ bestuur_id: null }) });
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── SCHOLEN ───────────────────────────────────────────────────────
async function saveSchool(id) {
  const naam = document.getElementById('f-naam').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const data = {
    naam,
    bestuurId:  document.getElementById('f-best').value || null,
    debiteurnr: document.getElementById('f-debnr-school').value.trim(),
    adres:      document.getElementById('f-adres').value.trim(),
    postcode:   document.getElementById('f-pc').value.trim(),
    plaats:     document.getElementById('f-plaats').value.trim(),
    website:    document.getElementById('f-web').value.trim(),
  };
  showLoading();
  try {
    if (id) {
      await supa(`/rest/v1/scholen?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(toDB_school(data)) });
      DB.scholen = DB.scholen.map(s => s.id === id ? { ...s, ...data } : s);
    } else {
      const newId = uid();
      await supa('/rest/v1/scholen', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_school(data) }) });
      DB.scholen.push({ id: newId, ...data });
    }
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delSchool(id) {
  if (!confirm('School verwijderen? Contactpersonen en dossieritems worden ook verwijderd.')) return;
  showLoading();
  try {
    await supa(`/rest/v1/scholen?id=eq.${id}`, { method: 'DELETE' });
    DB.scholen   = DB.scholen.filter(s => s.id !== id);
    DB.contacten = DB.contacten.filter(c => c.schoolId !== id);
    DB.dossiers  = DB.dossiers.filter(d => d.schoolId !== id);
    DB.facturen  = DB.facturen.filter(f => f.schoolId !== id);
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── CONTACTEN ─────────────────────────────────────────────────────
async function saveContact(schoolId, cid) {
  const naam = document.getElementById('f-naam').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const data = { naam, functie: document.getElementById('f-func').value.trim(), type: document.getElementById('f-type').value, email: document.getElementById('f-email').value.trim(), telefoon: document.getElementById('f-tel').value.trim(), schoolId };
  showLoading();
  try {
    if (cid) {
      await supa(`/rest/v1/contacten?id=eq.${cid}`, { method: 'PATCH', body: JSON.stringify(toDB_contact(data)) });
      DB.contacten = DB.contacten.map(c => c.id === cid ? { ...c, ...data } : c);
    } else {
      const newId = uid();
      await supa('/rest/v1/contacten', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_contact(data) }) });
      DB.contacten.push({ id: newId, ...data });
    }
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delContact(cid, schoolId) {
  if (!confirm('Contactpersoon verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/contacten?id=eq.${cid}`, { method: 'DELETE' });
    DB.contacten = DB.contacten.filter(c => c.id !== cid);
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── DOSSIERS: NOTITIES ────────────────────────────────────────────
async function saveDossier(schoolId) {
  const onderwerp = document.getElementById('f-onderwerp').value.trim();
  if (!onderwerp) return alert('Onderwerp mag niet leeg zijn');
  const tekst = document.getElementById('f-tekst').value.trim();
  if (!tekst) return alert('Notitie mag niet leeg zijn');
  const cid = document.getElementById('f-cid')?.value || '';
  const s = DB.scholen.find(x => x.id === schoolId);
  const contact = cid ? DB.contacten.find(c => c.id === cid) : null;
  const bronNaam = contact ? `${contact.naam} — ${s?.naam || ''}` : (s?.naam || '');

  const newId = uid();
  const item = { id: newId, schoolId, contactId: cid || null, datum: new Date().toISOString(), type: 'notitie', onderwerp, tekst, bronNaam, bestanden: [], bijlagen: [] };
  showLoading();
  try {
    const payload = { id: newId, school_id: schoolId, datum: item.datum, type: 'notitie', onderwerp, tekst, bron_naam: bronNaam, bestanden: [] };
    await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify(payload) });
    DB.dossiers.unshift(item);
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function saveDossierBestuur(bestuurId) {
  const schoolId = document.getElementById('f-school-dos').value;
  if (!schoolId) return alert('Kies een school');
  const onderwerp = document.getElementById('f-onderwerp').value.trim();
  if (!onderwerp) return alert('Onderwerp mag niet leeg zijn');
  const tekst = document.getElementById('f-tekst').value.trim();
  if (!tekst) return alert('Notitie mag niet leeg zijn');
  const b = DB.besturen.find(x => x.id === bestuurId);
  const s = DB.scholen.find(x => x.id === schoolId);
  const bronNaam = `${b?.naam || ''} — ${s?.naam || ''}`;
  const newId = uid();
  const item = { id: newId, schoolId, contactId: null, datum: new Date().toISOString(), type: 'notitie', onderwerp, tekst, bronNaam, bestanden: [], bijlagen: [] };
  showLoading();
  try {
    const payload = { id: newId, school_id: schoolId, datum: item.datum, type: 'notitie', onderwerp, tekst, bron_naam: bronNaam, bestanden: [] };
    await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify(payload) });
    DB.dossiers.unshift(item);
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── DOSSIERS: BESTANDEN ───────────────────────────────────────────
async function saveBestand(schoolId) {
  const onderwerp = document.getElementById('f-onderwerp').value.trim();
  if (!onderwerp) return alert('Onderwerp mag niet leeg zijn');
  const cid = document.getElementById('f-cid')?.value || '';
  const fileInput = document.getElementById('f-bestand');
  const files = fileInput ? [...fileInput.files] : [];
  if (files.length === 0) return alert('Kies minimaal één bestand');

  const s = DB.scholen.find(x => x.id === schoolId);
  const contact = cid ? DB.contacten.find(c => c.id === cid) : null;
  const bronNaam = contact ? `${contact.naam} — ${s?.naam || ''}` : (s?.naam || '');

  const newId = uid();
  showLoading();
  try {
    const bestanden = [];
    for (const f of files) bestanden.push(await uploadBestandToStorage(newId, f));
    const item = { id: newId, schoolId, contactId: cid || null, datum: new Date().toISOString(), type: 'bestand', onderwerp, tekst: '', bronNaam, bestanden, bijlagen: [] };
    const payload = { id: newId, school_id: schoolId, datum: item.datum, type: 'bestand', onderwerp, tekst: null, bron_naam: bronNaam, bestanden };
    await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify(payload) });
    DB.dossiers.unshift(item);
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function saveBestandBestuur(bestuurId) {
  const schoolId = document.getElementById('f-school-dos').value;
  if (!schoolId) return alert('Kies een school');
  const onderwerp = document.getElementById('f-onderwerp').value.trim();
  if (!onderwerp) return alert('Onderwerp mag niet leeg zijn');
  const fileInput = document.getElementById('f-bestand');
  const files = fileInput ? [...fileInput.files] : [];
  if (files.length === 0) return alert('Kies minimaal één bestand');

  const b = DB.besturen.find(x => x.id === bestuurId);
  const s = DB.scholen.find(x => x.id === schoolId);
  const bronNaam = `${b?.naam || ''} — ${s?.naam || ''}`;

  const newId = uid();
  showLoading();
  try {
    const bestanden = [];
    for (const f of files) bestanden.push(await uploadBestandToStorage(newId, f));
    const item = { id: newId, schoolId, contactId: null, datum: new Date().toISOString(), type: 'bestand', onderwerp, tekst: '', bronNaam, bestanden, bijlagen: [] };
    const payload = { id: newId, school_id: schoolId, datum: item.datum, type: 'bestand', onderwerp, tekst: null, bron_naam: bronNaam, bestanden };
    await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify(payload) });
    DB.dossiers.unshift(item);
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delDossier(did, schoolId) {
  const d = DB.dossiers.find(x => x.id === did);
  const label = d?.type === 'bestand' ? 'Bestand-item verwijderen?' : 'Notitie verwijderen?';
  if (!confirm(label)) return;
  showLoading();
  try {
    if (d?.bestanden?.length) {
      for (const b of d.bestanden) { try { await deleteBestandFromStorage(b.pad); } catch (e) {} }
    }
    await supa(`/rest/v1/dossiers?id=eq.${did}`, { method: 'DELETE' });
    DB.dossiers = DB.dossiers.filter(x => x.id !== did);
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delDossierBestuur(did, bestuurId) {
  await delDossier(did, null);
}

// ── FACTUREN ──────────────────────────────────────────────────────
async function saveFactuur(schoolId, fid) {
  const nummer = document.getElementById('f-nr').value.trim();
  if (!nummer) return alert('Factuurnummer is verplicht');
  const regels = _regels.map(r => ({
    id: r.id || uid(),
    omschrijving: r.omschrijving || '',
    toelichting:  r.toelichting || '',
    datum:        r.datum || '',
    uren:         r.uren || '',
    bedrag:       parseFloat(r.bedrag) || 0,
  }));
  const totaal = Math.round(regels.reduce((s, r) => s + (Math.round((r.bedrag || 0) * 100) / 100), 0) * 100) / 100;
  const tavVrij = document.getElementById('f-tav')?.value.trim() || '';
  const data = {
    schoolId, nummer,
    contactId:   document.getElementById('f-contact')?.value || null,
    tav:         tavVrij || null,
    debiteurnr:  document.getElementById('f-debnr').value.trim(),
    datum:       document.getElementById('f-datum').value,
    vervaldatum: document.getElementById('f-verval')?.value || null,
    status:      document.getElementById('f-status').value,
    betreft:     document.getElementById('f-betreft').value.trim(),
    regels, totaal
  };
  showLoading();
  try {
    if (fid) {
      await supa(`/rest/v1/facturen?id=eq.${fid}`, { method: 'PATCH', body: JSON.stringify(toDB_factuur(data)) });
      DB.facturen = DB.facturen.map(f => f.id === fid ? { ...f, ...data } : f);
    } else {
      const newId = uid();
      await supa('/rest/v1/facturen', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_factuur(data) }) });
      DB.facturen.push({ id: newId, ...data });
    }
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delFactuur(fid, schoolId) {
  if (!confirm('Factuur verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/facturen?id=eq.${fid}`, { method: 'DELETE' });
    DB.facturen = DB.facturen.filter(f => f.id !== fid);
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delFactuurOverview(fid) { await delFactuur(fid, null); }

// ── TRAININGEN ────────────────────────────────────────────────────
async function saveTraining(id) {
  const naam = document.getElementById('f-naam').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const data = {
    naam,
    categorie:     document.getElementById('f-cat').value,
    duur:          document.getElementById('f-duur').value.trim(),
    doelgroep:     document.getElementById('f-doel').value.trim(),
    maxDeelnemers: document.getElementById('f-max').value.trim(),
    omschrijving:  document.getElementById('f-omschr').value.trim(),
  };
  showLoading();
  try {
    if (id) {
      await supa(`/rest/v1/trainingen?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(toDB_training(data)) });
      DB.trainingen = DB.trainingen.map(t => t.id === id ? { ...t, ...data } : t);
    } else {
      const newId = uid();
      await supa('/rest/v1/trainingen', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_training(data), tips: [] }) });
      DB.trainingen.push({ id: newId, tips: [], ...data });
    }
    closeModal();
    if (id) renderContent(); else navigate('trainingen');
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delTraining(id) {
  if (!confirm('Training verwijderen? Alle uitvoeringen worden ook verwijderd.')) return;
  showLoading();
  try {
    await supa(`/rest/v1/trainingen?id=eq.${id}`, { method: 'DELETE' });
    DB.trainingen   = DB.trainingen.filter(t => t.id !== id);
    DB.uitvoeringen = DB.uitvoeringen.filter(u => u.trainingId !== id);
    closeModal(); navigate('trainingen');
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── UITVOERINGEN ──────────────────────────────────────────────────
async function saveUitvoering(trainingId, uitvId) {
  const schoolId = document.getElementById('f-school').value;
  if (!schoolId) return alert('Kies een school');
  const data = {
    trainingId, schoolId,
    datum:       document.getElementById('f-datum').value,
    deelnemers:  document.getElementById('f-deel').value || null,
    score:       _uitvScore || null,
    evaluatie:   document.getElementById('f-eval').value.trim(),
    watGingGoed: document.getElementById('f-goed').value.trim(),
    watKonBeter: document.getElementById('f-beter').value.trim(),
  };
  showLoading();
  try {
    if (uitvId) {
      await supa(`/rest/v1/uitvoeringen?id=eq.${uitvId}`, { method: 'PATCH', body: JSON.stringify(toDB_uitv(data)) });
      DB.uitvoeringen = DB.uitvoeringen.map(u => u.id === uitvId ? { ...u, ...data } : u);
    } else {
      const newId = uid();
      await supa('/rest/v1/uitvoeringen', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_uitv(data) }) });
      DB.uitvoeringen.push({ id: newId, ...data });
      const t = DB.trainingen.find(x => x.id === trainingId);
      const school = DB.scholen.find(x => x.id === schoolId);
      if (t && school) {
        const scoreStr = data.score ? ` | Score: ${data.score}/5 ★` : '';
        const tekst = `Training uitgevoerd: "${t.naam}"${scoreStr}\n${data.evaluatie || ''}`.trim();
        const dosId = uid();
        const dosItem = { id: dosId, schoolId, contactId: null, datum: new Date().toISOString(), type: 'notitie', onderwerp: `Training — ${t.naam}`, tekst, bronNaam: `Training — ${school.naam}`, bestanden: [], bijlagen: [] };
        await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify({ id: dosId, ...toDB_dossier(dosItem) }) });
        DB.dossiers.unshift(dosItem);
      }
    }
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delUitvoering(uitvId, trainingId) {
  if (!confirm('Uitvoering verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/uitvoeringen?id=eq.${uitvId}`, { method: 'DELETE' });
    DB.uitvoeringen = DB.uitvoeringen.filter(u => u.id !== uitvId);
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function saveUitvoeringVanSchool(schoolId) {
  const trainingId = document.getElementById('f-training').value;
  if (!trainingId) return alert('Kies een training');
  const data = {
    trainingId, schoolId,
    datum:       document.getElementById('f-datum').value,
    deelnemers:  document.getElementById('f-deel').value || null,
    score:       _uitvScore || null,
    evaluatie:   document.getElementById('f-eval').value.trim(),
    watGingGoed: document.getElementById('f-goed').value.trim(),
    watKonBeter: document.getElementById('f-beter').value.trim(),
  };
  showLoading();
  try {
    const newId = uid();
    await supa('/rest/v1/uitvoeringen', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_uitv(data) }) });
    DB.uitvoeringen.push({ id: newId, ...data });
    const t = DB.trainingen.find(x => x.id === trainingId);
    const school = DB.scholen.find(x => x.id === schoolId);
    if (t && school) {
      const scoreStr = data.score ? ` | Score: ${data.score}/5 ★` : '';
      const tekst = `Training uitgevoerd: "${t.naam}"${scoreStr}\n${data.evaluatie || ''}`.trim();
      const dosId = uid();
      const dosItem = { id: dosId, schoolId, contactId: null, datum: new Date().toISOString(), type: 'notitie', onderwerp: `Training — ${t.naam}`, tekst, bronNaam: `Training — ${school.naam}`, bestanden: [], bijlagen: [] };
      await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify({ id: dosId, ...toDB_dossier(dosItem) }) });
      DB.dossiers.unshift(dosItem);
    }
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── TIPS ──────────────────────────────────────────────────────────
async function saveTip(trainingId) {
  const tekst = document.getElementById('f-tiptekst').value.trim();
  if (!tekst) return alert('Tip mag niet leeg zijn');
  const tip = { titel: document.getElementById('f-tiptitel').value.trim(), tekst, datum: new Date().toISOString() };
  const t = DB.trainingen.find(x => x.id === trainingId);
  if (!t) return;
  const newTips = [...(t.tips || []), tip];
  showLoading();
  try {
    await supa(`/rest/v1/trainingen?id=eq.${trainingId}`, { method: 'PATCH', body: JSON.stringify({ tips: newTips }) });
    DB.trainingen = DB.trainingen.map(x => x.id === trainingId ? { ...x, tips: newTips } : x);
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delTip(trainingId, index) {
  if (!confirm('Tip verwijderen?')) return;
  const t = DB.trainingen.find(x => x.id === trainingId);
  if (!t) return;
  const newTips = (t.tips || []).filter((_, i) => i !== index);
  showLoading();
  try {
    await supa(`/rest/v1/trainingen?id=eq.${trainingId}`, { method: 'PATCH', body: JSON.stringify({ tips: newTips }) });
    DB.trainingen = DB.trainingen.map(x => x.id === trainingId ? { ...x, tips: newTips } : x);
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── AGENDA ───────────────────────────────────────────────────────
async function saveAgenda(id) {
  const titel = document.getElementById('f-titel').value.trim();
  if (!titel) return alert('Titel is verplicht');
  const datum = document.getElementById('f-datum').value;
  if (!datum) return alert('Datum is verplicht');
  const data = {
    titel,
    datum,
    beginTijd: document.getElementById('f-begintijd').value || '',
    eindTijd:  document.getElementById('f-eindtijd').value || '',
    type:      document.getElementById('f-type').value || 'afspraak',
    schoolId:  document.getElementById('f-school-hidden')?.value || document.getElementById('f-school').value || '',
    contactId: document.getElementById('f-contact').value || '',
    bestuurId: document.getElementById('f-bestuur-hidden')?.value || document.getElementById('f-bestuur').value || '',
    locatie:   document.getElementById('f-locatie').value.trim(),
    notitie:   document.getElementById('f-notitie').value.trim(),
  };
  showLoading();
  try {
    if (id) {
      await supa(`/rest/v1/agenda?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(toDB_agenda(data)) });
      DB.agenda = DB.agenda.map(a => a.id === id ? { ...a, ...data } : a);
    } else {
      const newId = uid();
      await supa('/rest/v1/agenda', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_agenda(data) }) });
      DB.agenda.push({ id: newId, ...data, createdAt: new Date().toISOString() });
    }
    DB.agenda.sort((a, b) => a.datum.localeCompare(b.datum) || (a.beginTijd || '').localeCompare(b.beginTijd || ''));
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delAgenda(id) {
  if (!confirm('Afspraak verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/agenda?id=eq.${id}`, { method: 'DELETE' });
    DB.agenda = DB.agenda.filter(a => a.id !== id);
    closeModal();
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── AGENDA TYPES ─────────────────────────────────────────────────
async function saveAgendaType(id) {
  const naam = document.getElementById('f-typename').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const kleur = document.getElementById('f-typekleur').value;
  showLoading();
  try {
    if (id) {
      await supa(`/rest/v1/agenda_types?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ naam, kleur }) });
      DB.agendaTypes = DB.agendaTypes.map(t => t.id === id ? { ...t, naam, kleur } : t);
    } else {
      const newId = naam.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || uid();
      if (DB.agendaTypes.find(t => t.id === newId)) return alert('Er bestaat al een type met deze naam');
      await supa('/rest/v1/agenda_types', { method: 'POST', body: JSON.stringify({ id: newId, naam, kleur }) });
      DB.agendaTypes.push({ id: newId, naam, kleur });
    }
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delAgendaType(id) {
  const inGebruik = DB.agenda.filter(a => a.type === id).length;
  const msg = inGebruik > 0
    ? `Dit type wordt gebruikt door ${inGebruik} afspra${inGebruik === 1 ? 'ak' : 'ken'}. Verwijderen? De afspraken behouden hun type-waarde maar tonen dan als standaard.`
    : 'Agendatype verwijderen?';
  if (!confirm(msg)) return;
  showLoading();
  try {
    await supa(`/rest/v1/agenda_types?id=eq.${id}`, { method: 'DELETE' });
    DB.agendaTypes = DB.agendaTypes.filter(t => t.id !== id);
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── EMAIL SETTINGS ──────────────────────────────────────────────
async function saveEmailSettings() {
  const data = {
    imap_host:  document.getElementById('f-imap-host').value.trim(),
    imap_port:  parseInt(document.getElementById('f-imap-port').value) || 993,
    smtp_host:  document.getElementById('f-smtp-host').value.trim(),
    smtp_port:  parseInt(document.getElementById('f-smtp-port').value) || 587,
    email_user: document.getElementById('f-email-user').value.trim(),
    email_pass: document.getElementById('f-email-pass').value.trim(),
    email_from: document.getElementById('f-email-from').value.trim(),
    updated_at: new Date().toISOString(),
  };
  if (!data.imap_host || !data.smtp_host || !data.email_user) return alert('Vul minimaal IMAP-server, SMTP-server en e-mailadres in');
  showLoading();
  try {
    await supa('/rest/v1/email_settings?id=eq.main', { method: 'PATCH', body: JSON.stringify(data) });
    DB.emailSettings = fromDB_emailSettings({ id: 'main', ...data });
    showToast('E-mailinstellingen opgeslagen', 'success');
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── Outlook (.ics feed) instellingen ─────────────────────────────
async function saveOutlookSettings() {
  const data = {
    ics_url: document.getElementById('f-outlook-url').value.trim(),
    days_past: parseInt(document.getElementById('f-outlook-past').value) || 30,
    days_future: parseInt(document.getElementById('f-outlook-future').value) || 180,
    updated_at: new Date().toISOString(),
  };
  if (!data.ics_url) return alert('Vul de Outlook ICS URL in');
  if (!/^https?:\/\/|^webcal:\/\//i.test(data.ics_url)) return alert('URL moet beginnen met https:// of webcal://');
  showLoading();
  try {
    await supa('/rest/v1/outlook_settings?id=eq.main', { method: 'PATCH', body: JSON.stringify(data) });
    DB.outlookSettings = fromDB_outlookSettings({ id: 'main', ...data });
    try { localStorage.removeItem('_crm_outlook_cache_v1'); } catch {}
    if (typeof _outlookFetchedOnce !== 'undefined') _outlookFetchedOnce = false;
    showToast('Outlook-instellingen opgeslagen', 'success');
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function testOutlookConnection() {
  showLoading();
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/fetch-outlook-ics?test=true`, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`,
      },
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    showToast(`Verbonden! ${data.totalEvents} events in feed (${data.calendarName})`, 'success');
    const fresh = await supa('/rest/v1/outlook_settings?select=*&id=eq.main');
    DB.outlookSettings = (fresh || []).map(fromDB_outlookSettings)[0] || null;
    renderContent();
  } catch (e) {
    showToast('Verbinding mislukt: ' + e.message, 'error');
  } finally { hideLoading(); }
}

// ── EMAIL TEMPLATES ──────────────────────────────────────────────
async function saveEmailTemplate(id) {
  const naam = document.getElementById('f-tpl-naam').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const onderwerp = document.getElementById('f-tpl-onderwerp').value.trim();
  if (!onderwerp) return alert('Onderwerp is verplicht');
  const data = {
    naam,
    onderwerp,
    body: document.getElementById('f-tpl-body').value.trim(),
    categorie: document.getElementById('f-tpl-categorie').value || 'algemeen',
  };
  showLoading();
  try {
    if (id) {
      await supa(`/rest/v1/email_templates?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      DB.emailTemplates = DB.emailTemplates.map(t => t.id === id ? { ...t, ...data } : t);
    } else {
      const newId = uid();
      await supa('/rest/v1/email_templates', { method: 'POST', body: JSON.stringify({ id: newId, ...data }) });
      DB.emailTemplates.push({ id: newId, ...data, createdAt: new Date().toISOString() });
    }
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delEmailTemplate(id) {
  if (!confirm('E-mailtemplate verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/email_templates?id=eq.${id}`, { method: 'DELETE' });
    DB.emailTemplates = DB.emailTemplates.filter(t => t.id !== id);
    closeModal(); renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ── INSTELLINGEN functies ─────────────────────────────────────────
async function delAlleFacturen() {
  closeModal();
  const aantal = DB.facturen.length;
  if (aantal === 0) return showToast('Er zijn geen facturen om te verwijderen.', 'error');
  if (!confirm(`Weet je zeker dat je ALLE ${aantal} facturen wilt verwijderen?\n\nDeze actie kan niet ongedaan worden gemaakt.`)) return;
  if (!confirm(`Laatste bevestiging: ${aantal} facturen permanent verwijderen?`)) return;
  showLoading();
  try {
    await supa('/rest/v1/facturen?id=neq.00000000-0000-0000-0000-000000000000', { method: 'DELETE' });
    DB.facturen = [];
    showToast(`Alle ${aantal} facturen zijn verwijderd.`, 'success');
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function delAlleInhoud() {
  const totaal = DB.besturen.length + DB.scholen.length + DB.contacten.length + DB.dossiers.length + DB.facturen.length + DB.trainingen.length + DB.uitvoeringen.length + DB.agenda.length;
  if (totaal === 0) return showToast('De database is al leeg.', 'error');
  if (!confirm(`Weet je zeker dat je ALLE inhoud wilt verwijderen?\n\n• ${DB.besturen.length} besturen\n• ${DB.scholen.length} scholen\n• ${DB.contacten.length} contacten\n• ${DB.dossiers.length} dossiers\n• ${DB.facturen.length} facturen\n• ${DB.trainingen.length} trainingen\n• ${DB.uitvoeringen.length} uitvoeringen\n• ${DB.agenda.length} agenda-items\n\nDit kan NIET ongedaan worden gemaakt.`)) return;
  if (!confirm('LAATSTE WAARSCHUWING: Alle data wordt permanent verwijderd. Doorgaan?')) return;
  showLoading();
  try {
    const neq = '?id=neq.00000000-0000-0000-0000-000000000000';
    await Promise.all([
      supa('/rest/v1/uitvoeringen' + neq, { method: 'DELETE' }),
      supa('/rest/v1/agenda' + neq, { method: 'DELETE' }),
      supa('/rest/v1/facturen' + neq, { method: 'DELETE' }),
      supa('/rest/v1/dossiers' + neq, { method: 'DELETE' }),
    ]);
    await supa('/rest/v1/contacten' + neq, { method: 'DELETE' });
    await supa('/rest/v1/scholen' + neq, { method: 'DELETE' });
    await Promise.all([
      supa('/rest/v1/besturen' + neq, { method: 'DELETE' }),
      supa('/rest/v1/trainingen' + neq, { method: 'DELETE' }),
    ]);
    DB.besturen = []; DB.scholen = []; DB.contacten = [];
    DB.dossiers = []; DB.facturen = []; DB.trainingen = [];
    DB.uitvoeringen = []; DB.agenda = [];
    showToast(`Alle ${totaal} items zijn verwijderd. Schone lei!`, 'success');
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function herberekeningTotalen() {
  if (!confirm('Alle factuurtotalen herberekenen vanuit de regelitems?\nDit corrigeert afrondingsfouten in de database.')) return;
  showLoading();
  let bijgewerkt = 0;
  try {
    for (const f of DB.facturen) {
      const nieuwTotaal = Math.round((f.regels || []).reduce((s, r) => s + (Math.round((parseFloat(r.bedrag) || 0) * 100) / 100), 0) * 100) / 100;
      if (Math.abs(nieuwTotaal - (f.totaal || 0)) > 0.001) {
        await supa(`/rest/v1/facturen?id=eq.${f.id}`, { method: 'PATCH', body: JSON.stringify({ totaal: nieuwTotaal }) });
        f.totaal = nieuwTotaal;
        bijgewerkt++;
      }
    }
    showToast(`${bijgewerkt} factu${bijgewerkt === 1 ? 'ur' : 'ren'} gecorrigeerd.`, 'success');
    renderContent();
  } catch (e) { showToast('Fout: ' + e.message, 'error'); } finally { hideLoading(); }
}
