// ════════════════════════════════════════════════════════════════
// CRUD — Alle save/delete functies naar Supabase
// ════════════════════════════════════════════════════════════════

// ── BESTUREN ─────────────────────────────────────────────────────
async function saveBestuur(id) {
  const naam = document.getElementById('f-naam').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const debiteurnr = document.getElementById('f-debnr-bestuur').value.trim();
  if (debiteurnr && isDebiteurnrInUse(debiteurnr, 'bestuur', id || null)) {
    return alert(`Debiteurnummer ${debiteurnr} is al in gebruik door een andere klant.`);
  }
  const data = { naam, website: document.getElementById('f-web').value.trim(), adres: document.getElementById('f-adres').value.trim(), debiteurnr };
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delBestuur(id) {
  if (!confirm('Bestuur verwijderen? Scholen worden losgekoppeld.')) return;
  showLoading();
  try {
    // Eerst scholen loskoppelen (FK-veilig), dan bestuur verwijderen.
    // Beide Supabase-calls afronden vóór de lokale DB muteert, zodat
    // een fout halverwege geen inconsistente UI-state achterlaat.
    await supa(`/rest/v1/scholen?bestuur_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ bestuur_id: null }) });
    await supa(`/rest/v1/besturen?id=eq.${id}`, { method: 'DELETE' });
    DB.besturen = DB.besturen.filter(b => b.id !== id);
    DB.scholen  = DB.scholen.map(s => s.bestuurId === id ? { ...s, bestuurId: null } : s);
    renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

// ── SCHOLEN ───────────────────────────────────────────────────────
async function saveSchool(id) {
  const naam = document.getElementById('f-naam').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const debiteurnr = document.getElementById('f-debnr-school').value.trim();
  if (debiteurnr && isDebiteurnrInUse(debiteurnr, 'school', id || null)) {
    return alert(`Debiteurnummer ${debiteurnr} is al in gebruik door een andere klant.`);
  }
  const data = {
    naam,
    bestuurId:  document.getElementById('f-best').value || null,
    debiteurnr,
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

// ── CONTACTEN ─────────────────────────────────────────────────────
async function saveContact(schoolId, cid) {
  const naam = document.getElementById('f-naam').value.trim();
  if (!naam) return alert('Naam is verplicht');
  // Gekozen school uit de dropdown (maakt verplaatsen naar een andere school mogelijk).
  const gekozenSchoolId = document.getElementById('f-contact-school')?.value || schoolId;
  const data = { naam, functie: document.getElementById('f-func').value.trim(), type: document.getElementById('f-type').value, email: document.getElementById('f-email').value.trim(), telefoonMobiel: document.getElementById('f-tel-mobiel').value.trim(), telefoonWerk: document.getElementById('f-tel-werk').value.trim(), schoolId: gekozenSchoolId };
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delContact(cid, schoolId) {
  if (!confirm('Contactpersoon verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/contacten?id=eq.${cid}`, { method: 'DELETE' });
    DB.contacten = DB.contacten.filter(c => c.id !== cid);
    renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
    await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_dossier(item) }) });
    DB.dossiers.unshift(item);
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
    await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_dossier(item) }) });
    DB.dossiers.unshift(item);
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
    await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_dossier(item) }) });
    DB.dossiers.unshift(item);
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
    await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_dossier(item) }) });
    DB.dossiers.unshift(item);
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delDossierBestuur(did, bestuurId) {
  await delDossier(did, null);
}

// Ontkoppel een auto-gelogde inbox-mail uit het dossier.
// Soft-delete: het record blijft bestaan met type='inbox-archived' zodat
// de auto-log-dedup ervoor zorgt dat de mail niet bij een volgende fetch
// opnieuw aan het dossier wordt toegevoegd.
async function unlinkInboxDossier(did) {
  const d = DB.dossiers.find(x => x.id === did);
  if (!d) return;
  if (!confirm('Deze e-mail uit het dossier ontkoppelen?\n\nHet bericht zelf blijft in Postvak IN; alleen de vermelding bij dit contact wordt verborgen.')) return;
  showLoading();
  try {
    await supa(`/rest/v1/dossiers?id=eq.${did}`, { method: 'PATCH', body: JSON.stringify({ type: 'inbox-archived' }) });
    d.type = 'inbox-archived';
    renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

// ── FACTUREN ──────────────────────────────────────────────────────
async function saveFactuur(fid) {
  const nummer = document.getElementById('f-nr').value.trim();
  if (!nummer) return alert('Factuurnummer is verplicht');
  const bestuurId = document.getElementById('f-bestuur')?.value || '';
  if (!bestuurId) return alert('Kies eerst een bestuur');
  const schoolId = document.getElementById('f-school')?.value || '';
  const regels = _regels.map(r => ({
    id: r.id || uid(),
    omschrijving: r.omschrijving || '',
    toelichting:  r.toelichting || '',
    datum:        r.datum || '',
    uren:         r.uren || '',
    bedrag:       typeof parseFactuurBedrag === 'function' ? parseFactuurBedrag(r.bedrag) : (parseFloat(String(r.bedrag || '').replace(',', '.')) || 0),
  }));
  const totaal = Math.round(regels.reduce((s, r) => s + (Math.round((r.bedrag || 0) * 100) / 100), 0) * 100) / 100;
  const tavVrij = document.getElementById('f-tav')?.value.trim() || '';
  const data = {
    schoolId:    schoolId || '',
    bestuurId,
    nummer,
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delFactuur(fid, schoolId) {
  if (!confirm('Factuur verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/facturen?id=eq.${fid}`, { method: 'DELETE' });
    DB.facturen = DB.facturen.filter(f => f.id !== fid);
    renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delFactuurOverview(fid) { await delFactuur(fid, null); }

// ── TRAININGEN ────────────────────────────────────────────────────
async function saveTraining(id) {
  const naam = document.getElementById('f-naam').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const bestaand = id ? DB.trainingen.find(t => t.id === id) : null;
  const fileInput = document.getElementById('f-train-bestand');
  const files = fileInput ? [...fileInput.files] : [];
  const data = {
    naam,
    type: document.getElementById('f-type')?.value || 'training',
    categorie: document.getElementById('f-cat')?.value || 'algemeen',
    duur: '',
    doelgroep: '',
    maxDeelnemers: '',
    omschrijving: document.getElementById('f-omschr').value.trim(),
    tips: bestaand?.tips || [],
    bestanden: [...(bestaand?.bestanden || [])],
    links: (Array.isArray(_trainingLinksDraft) ? _trainingLinksDraft : [])
      .map(link => ({ label: (link.label || '').trim(), url: (link.url || '').trim() }))
      .filter(link => link.url),
  };
  showLoading();
  try {
    const recordId = id || uid();
    for (const f of files) data.bestanden.push(await uploadBestandToStorage(recordId, f));

    if (id) {
      await supa(`/rest/v1/trainingen?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(toDB_training(data)) });
      DB.trainingen = DB.trainingen.map(t => t.id === id ? { ...t, ...data } : t);
    } else {
      await supa('/rest/v1/trainingen', { method: 'POST', body: JSON.stringify({ id: recordId, ...toDB_training(data) }) });
      DB.trainingen.push({ id: recordId, ...data });
    }
    persistTrainingBestandenLocally();
    persistTrainingLinksLocally();
    closeModal();
    if (id) renderContent(); else navigate('trainingen');
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delTraining(id) {
  if (!confirm('Training verwijderen? Alle uitvoeringen worden ook verwijderd.')) return;
  showLoading();
  try {
    const t = DB.trainingen.find(x => x.id === id);
    if (t?.bestanden?.length) {
      for (const b of t.bestanden) { try { await deleteBestandFromStorage(b.pad); } catch (e) {} }
    }
    await supa(`/rest/v1/trainingen?id=eq.${id}`, { method: 'DELETE' });
    DB.trainingen   = DB.trainingen.filter(t => t.id !== id);
    DB.uitvoeringen = DB.uitvoeringen.filter(u => u.trainingId !== id);
    persistTrainingBestandenLocally();
    persistTrainingLinksLocally();
    closeModal(); navigate('trainingen');
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delTrainingBestand(trainingId, idx) {
  const t = DB.trainingen.find(x => x.id === trainingId);
  if (!t || !t.bestanden || !t.bestanden[idx]) return;
  if (!confirm('Document verwijderen?')) return;
  showLoading();
  try {
    const verwijderd = t.bestanden[idx];
    if (verwijderd?.pad) await deleteBestandFromStorage(verwijderd.pad);
    const next = { ...t, bestanden: t.bestanden.filter((_, i) => i !== idx) };
    await supa(`/rest/v1/trainingen?id=eq.${trainingId}`, { method: 'PATCH', body: JSON.stringify(toDB_training(next)) });
    DB.trainingen = DB.trainingen.map(item => item.id === trainingId ? next : item);
    persistTrainingBestandenLocally();
    persistTrainingLinksLocally();
    closeModal();
    renderContent();
    openTrainingModal(trainingId);
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

// ── UITVOERINGEN ──────────────────────────────────────────────────
async function saveUitvoering(trainingId, uitvId) {
  const schoolId = document.getElementById('f-school').value;
  if (!schoolId) return alert('Kies een school');
  const data = {
    trainingId, schoolId,
    contactId:   document.getElementById('f-contact')?.value || null,
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
        const dosItem = { id: dosId, schoolId, contactId: data.contactId || null, datum: new Date().toISOString(), type: 'notitie', onderwerp: `Training — ${t.naam}`, tekst, bronNaam: `Training — ${school.naam}`, bestanden: [], bijlagen: [] };
        await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify({ id: dosId, ...toDB_dossier(dosItem) }) });
        DB.dossiers.unshift(dosItem);
      }
    }
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delUitvoering(uitvId, trainingId) {
  if (!confirm('Uitvoering verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/uitvoeringen?id=eq.${uitvId}`, { method: 'DELETE' });
    DB.uitvoeringen = DB.uitvoeringen.filter(u => u.id !== uitvId);
    renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function saveUitvoeringVanSchool(schoolId) {
  const trainingId = document.getElementById('f-training').value;
  if (!trainingId) return alert('Kies een training');
  const data = {
    trainingId, schoolId,
    contactId:   document.getElementById('f-contact')?.value || null,
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
      const dosItem = { id: dosId, schoolId, contactId: data.contactId || null, datum: new Date().toISOString(), type: 'notitie', onderwerp: `Training — ${t.naam}`, tekst, bronNaam: `Training — ${school.naam}`, bestanden: [], bijlagen: [] };
      await supa('/rest/v1/dossiers', { method: 'POST', body: JSON.stringify({ id: dosId, ...toDB_dossier(dosItem) }) });
      DB.dossiers.unshift(dosItem);
    }
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delAgenda(id) {
  if (!confirm('Afspraak verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/agenda?id=eq.${id}`, { method: 'DELETE' });
    DB.agenda = DB.agenda.filter(a => a.id !== id);
    closeModal();
    renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

// ── TRAINING TYPES ───────────────────────────────────────────────
async function saveTrainingType(id) {
  ensureTrainingTypes();
  const naam = document.getElementById('f-trainingtypename').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const kleur = document.getElementById('f-trainingtypekleur').value || 'navy';
  showLoading();
  try {
    if (id) {
      if (HAS_TRAINING_TYPES_TABLE) {
        await supa(`/rest/v1/training_types?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ naam, kleur }) });
      }
      DB.trainingTypes = DB.trainingTypes.map(t => t.id === id ? { ...t, naam, kleur } : t);
    } else {
      const newId = normalizeTypeId(naam);
      if (DB.trainingTypes.find(t => t.id === newId)) return alert('Er bestaat al een type met deze naam');
      if (HAS_TRAINING_TYPES_TABLE) {
        await supa('/rest/v1/training_types', { method: 'POST', body: JSON.stringify({ id: newId, naam, kleur }) });
      }
      DB.trainingTypes.push({ id: newId, naam, kleur });
    }
    persistTrainingTypesLocally();
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delTrainingType(id) {
  ensureTrainingTypes();
  if (id === 'training') return alert('Het standaardtype Training kan niet worden verwijderd.');
  if ((DB.trainingTypes || []).length <= 1) return alert('Er moet minimaal één trainingtype overblijven.');

  const inGebruik = DB.trainingen.filter(t => (t.type || 'training') === id).length;
  const msg = inGebruik > 0
    ? `Dit type wordt gebruikt door ${inGebruik} training${inGebruik === 1 ? '' : 'en'}. Verwijderen? Bestaande trainingen vallen dan terug op "Training".`
    : 'Trainingtype verwijderen?';
  if (!confirm(msg)) return;

  showLoading();
  try {
    if (inGebruik > 0) {
      await Promise.all(
        DB.trainingen
          .filter(t => (t.type || 'training') === id)
          .map(t => supa(`/rest/v1/trainingen?id=eq.${t.id}`, { method: 'PATCH', body: JSON.stringify({ categorie: 'training' }) }))
      );
      DB.trainingen = DB.trainingen.map(t => (t.type || 'training') === id ? { ...t, type: 'training' } : t);
    }

    if (HAS_TRAINING_TYPES_TABLE) {
      await supa(`/rest/v1/training_types?id=eq.${id}`, { method: 'DELETE' });
    }

    DB.trainingTypes = DB.trainingTypes.filter(t => t.id !== id);
    persistTrainingTypesLocally();
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

// ── AGENDA TYPES ─────────────────────────────────────────────────
async function saveTrainingCategory(id) {
  ensureTrainingCategories();
  const naam = document.getElementById('f-trainingcategoryname').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const kleur = document.getElementById('f-trainingcategorykleur').value || 'navy';
  showLoading();
  try {
    if (id) {
      if (HAS_TRAINING_CATEGORIES_TABLE) {
        await supa(`/rest/v1/training_categories?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ naam, kleur }) });
      }
      DB.trainingCategories = DB.trainingCategories.map(t => t.id === id ? { ...t, naam, kleur } : t);
    } else {
      const newId = normalizeTypeId(naam);
      if (DB.trainingCategories.find(t => t.id === newId)) return alert('Er bestaat al een categorie met deze naam');
      if (HAS_TRAINING_CATEGORIES_TABLE) {
        await supa('/rest/v1/training_categories', { method: 'POST', body: JSON.stringify({ id: newId, naam, kleur }) });
      }
      DB.trainingCategories.push({ id: newId, naam, kleur });
    }
    persistTrainingCategoriesLocally();
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delTrainingCategory(id) {
  ensureTrainingCategories();
  if (id === 'algemeen') return alert('De standaardcategorie Algemeen kan niet worden verwijderd.');
  if ((DB.trainingCategories || []).length <= 1) return alert('Er moet minimaal één trainingscategorie overblijven.');

  const inGebruik = DB.trainingen.filter(t => (t.categorie || 'algemeen') === id).length;
  const msg = inGebruik > 0
    ? `Deze categorie wordt gebruikt door ${inGebruik} training${inGebruik === 1 ? '' : 'en'}. Verwijderen? Bestaande trainingen vallen dan terug op "Algemeen".`
    : 'Trainingscategorie verwijderen?';
  if (!confirm(msg)) return;

  showLoading();
  try {
    if (inGebruik > 0) {
      await Promise.all(
        DB.trainingen
          .filter(t => (t.categorie || 'algemeen') === id)
          .map(t => supa(`/rest/v1/trainingen?id=eq.${t.id}`, { method: 'PATCH', body: JSON.stringify({ doelgroep: 'cat:algemeen' }) }))
      );
      DB.trainingen = DB.trainingen.map(t => (t.categorie || 'algemeen') === id ? { ...t, categorie: 'algemeen' } : t);
    }

    if (HAS_TRAINING_CATEGORIES_TABLE) {
      await supa(`/rest/v1/training_categories?id=eq.${id}`, { method: 'DELETE' });
    }

    DB.trainingCategories = DB.trainingCategories.filter(t => t.id !== id);
    persistTrainingCategoriesLocally();
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

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
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

// ── Outlook (.ics feed) instellingen ─────────────────────────────
async function saveOutlookSettings() {
  const data = {
    ics_url: document.getElementById('f-outlook-url').value.trim(),
    days_past: parseInt(document.getElementById('f-outlook-past').value) || 30,
    days_future: parseInt(document.getElementById('f-outlook-future').value) || 180,
    updated_at: new Date().toISOString(),
  };
  if (!data.ics_url) return alert('Vul de ICS URL in');
  if (!/^https?:\/\/|^webcal:\/\//i.test(data.ics_url)) return alert('URL moet beginnen met https:// of webcal://');
  showLoading();
  try {
    await supa('/rest/v1/outlook_settings?id=eq.main', { method: 'PATCH', body: JSON.stringify(data) });
    DB.outlookSettings = fromDB_outlookSettings({ id: 'main', ...data });
    try { localStorage.removeItem('_crm_outlook_cache_v1'); } catch {}
    if (typeof _outlookFetchedOnce !== 'undefined') _outlookFetchedOnce = false;
    showToast('Agenda-instellingen opgeslagen', 'success');
    renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
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
    showToast('Verbinding mislukt: ' + mapSupaError(e), 'error'); console.error(e);
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
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delEmailTemplate(id) {
  if (!confirm('E-mailtemplate verwijderen?')) return;
  showLoading();
  try {
    await supa(`/rest/v1/email_templates?id=eq.${id}`, { method: 'DELETE' });
    DB.emailTemplates = DB.emailTemplates.filter(t => t.id !== id);
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

// ── KOSTENTYPES ──────────────────────────────────────────────────
// Beheer van het lijstje kostentypes (Reiskosten, Materiaal, …). Werkt
// hetzelfde als training_types: writes naar Supabase alleen als de tabel
// bestaat, anders alleen in-memory zodat de app niet breekt op een
// systeem zonder migratie.
function ensureKostenTypes() {
  if (!Array.isArray(DB.kostenTypes)) DB.kostenTypes = [];
}

function getKostenTypeList() {
  ensureKostenTypes();
  return DB.kostenTypes;
}

function getKostenTypeInfo(typeId = '') {
  const list = getKostenTypeList();
  const found = list.find(t => t.id === typeId)
    || list[0]
    || { id: typeId || 'overig', naam: typeId || 'Overig', kleur: 'grijs' };
  const style = (typeof TRAINING_TYPE_STYLES === 'object' ? TRAINING_TYPE_STYLES : null)?.[found.kleur]
    || { color: '#6B6B8A', bg: '#F0F0F5' };
  return { ...found, label: found.naam || 'Overig', color: style.color, bg: style.bg };
}

function kostenTypeLabel(typeId = '') {
  return getKostenTypeInfo(typeId).label;
}

function kostenTypeBadge(typeId = '') {
  const info = getKostenTypeInfo(typeId);
  return `<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:11.5px;font-weight:700;background:${info.bg};color:${info.color}">${esc(info.label)}</span>`;
}

async function saveKostenType(id) {
  ensureKostenTypes();
  const naam = document.getElementById('f-kostentypename').value.trim();
  if (!naam) return alert('Naam is verplicht');
  const kleur = document.getElementById('f-kostentypekleur').value || 'navy';
  showLoading();
  try {
    if (id) {
      if (HAS_KOSTEN_TYPES_TABLE) {
        await supa(`/rest/v1/kosten_types?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ naam, kleur }) });
      }
      DB.kostenTypes = DB.kostenTypes.map(t => t.id === id ? { ...t, naam, kleur } : t);
    } else {
      const newId = (typeof normalizeTypeId === 'function' ? normalizeTypeId(naam) : naam.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || uid());
      if (DB.kostenTypes.find(t => t.id === newId)) return alert('Er bestaat al een kostentype met deze naam');
      if (HAS_KOSTEN_TYPES_TABLE) {
        await supa('/rest/v1/kosten_types', { method: 'POST', body: JSON.stringify({ id: newId, naam, kleur }) });
      }
      DB.kostenTypes.push({ id: newId, naam, kleur });
    }
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delKostenType(id) {
  ensureKostenTypes();
  if ((DB.kostenTypes || []).length <= 1) return alert('Er moet minimaal één kostentype overblijven.');
  const inGebruik = (DB.inkoopfacturen || []).filter(f => f.kostenTypeId === id).length;
  const msg = inGebruik > 0
    ? `Dit type wordt gebruikt door ${inGebruik} inkoopfactuur/facturen. Verwijderen? Bestaande inkoopfacturen verliezen hun type (worden zonder type weergegeven).`
    : 'Kostentype verwijderen?';
  if (!confirm(msg)) return;
  showLoading();
  try {
    if (HAS_KOSTEN_TYPES_TABLE) {
      // FK met ON DELETE SET NULL maakt dit veilig — children worden vanzelf NULL.
      await supa(`/rest/v1/kosten_types?id=eq.${id}`, { method: 'DELETE' });
    }
    DB.kostenTypes = DB.kostenTypes.filter(t => t.id !== id);
    DB.inkoopfacturen = (DB.inkoopfacturen || []).map(f => f.kostenTypeId === id ? { ...f, kostenTypeId: '' } : f);
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

// ── INKOOPFACTUREN ───────────────────────────────────────────────
function parseInkoopBedrag(val) {
  return parseFloat(String(val || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
}

async function saveInkoopfactuur(id) {
  const leverancier = document.getElementById('f-ink-leverancier').value.trim();
  if (!leverancier) return alert('Leverancier is verplicht');
  const factuurdatum = document.getElementById('f-ink-datum').value;
  if (!factuurdatum) return alert('Factuurdatum is verplicht');
  const bedrag = parseInkoopBedrag(document.getElementById('f-ink-bedrag').value);
  if (!bedrag || bedrag <= 0) return alert('Vul een geldig bedrag in');

  const bestaand = id ? (DB.inkoopfacturen || []).find(f => f.id === id) : null;
  const fileInput = document.getElementById('f-ink-bestand');
  const files = fileInput ? [...fileInput.files] : [];

  const isRecurring = document.getElementById('f-ink-recurring')?.checked || false;
  const recurringInterval = isRecurring ? (document.getElementById('f-ink-interval')?.value || 'maand') : '';
  const recurringEndDate = isRecurring ? (document.getElementById('f-ink-einddatum')?.value || '') : '';

  const data = {
    factuurnummer: document.getElementById('f-ink-nr').value.trim(),
    leverancier,
    kostenTypeId: document.getElementById('f-ink-type').value || '',
    factuurdatum,
    omschrijving: document.getElementById('f-ink-omschr').value.trim(),
    bedrag,
    isRecurring,
    recurringInterval,
    recurringEndDate,
    parentId: bestaand?.parentId || '',
    bestanden: [...(bestaand?.bestanden || [])],
    notitie: document.getElementById('f-ink-notitie').value.trim(),
  };

  showLoading();
  try {
    const recordId = id || uid();
    for (const f of files) data.bestanden.push(await uploadBestandToStorage(recordId, f));

    if (id) {
      await supa(`/rest/v1/inkoopfacturen?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(toDB_inkoopfactuur(data)) });
      DB.inkoopfacturen = DB.inkoopfacturen.map(f => f.id === id ? { ...f, ...data } : f);
    } else {
      await supa('/rest/v1/inkoopfacturen', { method: 'POST', body: JSON.stringify({ id: recordId, ...toDB_inkoopfactuur(data) }) });
      DB.inkoopfacturen.push({ id: recordId, ...data, createdAt: new Date().toISOString() });
    }

    // Bij nieuwe template direct kinderen genereren tot vandaag.
    if (data.isRecurring) {
      try { await generateRecurringInkoop(); } catch (e) { console.warn('Recurring inkoop generatie mislukt:', e); }
    }

    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delInkoopfactuur(id) {
  const f = (DB.inkoopfacturen || []).find(x => x.id === id);
  if (!f) return;
  const heeftKinderen = f.isRecurring && (DB.inkoopfacturen || []).some(c => c.parentId === id);
  const msg = heeftKinderen
    ? 'Deze inkoopfactuur is een terugkerende serie. Verwijderen stopt de serie; bestaande automatisch gegenereerde facturen blijven bewaard.\n\nDoorgaan?'
    : 'Inkoopfactuur verwijderen?';
  if (!confirm(msg)) return;
  showLoading();
  try {
    if (f.bestanden?.length) {
      for (const b of f.bestanden) { try { await deleteBestandFromStorage(b.pad); } catch (e) {} }
    }
    await supa(`/rest/v1/inkoopfacturen?id=eq.${id}`, { method: 'DELETE' });
    DB.inkoopfacturen = DB.inkoopfacturen.filter(x => x.id !== id);
    // Kinderen behouden, maar hun parentId is via DB ON DELETE SET NULL al genull'd.
    DB.inkoopfacturen = DB.inkoopfacturen.map(x => x.parentId === id ? { ...x, parentId: '' } : x);
    closeModal(); renderContent();
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function delInkoopBestand(inkoopId, idx) {
  const f = (DB.inkoopfacturen || []).find(x => x.id === inkoopId);
  if (!f || !f.bestanden || !f.bestanden[idx]) return;
  if (!confirm('Document verwijderen?')) return;
  showLoading();
  try {
    const verwijderd = f.bestanden[idx];
    if (verwijderd?.pad) try { await deleteBestandFromStorage(verwijderd.pad); } catch (e) {}
    const next = { ...f, bestanden: f.bestanden.filter((_, i) => i !== idx) };
    await supa(`/rest/v1/inkoopfacturen?id=eq.${inkoopId}`, { method: 'PATCH', body: JSON.stringify({ bestanden: next.bestanden }) });
    DB.inkoopfacturen = DB.inkoopfacturen.map(item => item.id === inkoopId ? next : item);
    closeModal(); renderContent();
    if (typeof openInkoopfactuurModal === 'function') openInkoopfactuurModal(inkoopId);
  } catch (e) { toastError(e); } finally { hideLoading(); }
}

async function downloadInkoopBestand(inkoopId, idx) {
  const f = (DB.inkoopfacturen || []).find(x => x.id === inkoopId);
  if (!f || !f.bestanden || !f.bestanden[idx]) return;
  await downloadStorageBestand(f.bestanden[idx]);
}

// ── Recurring generator ──────────────────────────────────────────
// Genereert ontbrekende child-records voor elke recurring "template"-
// inkoopfactuur (is_recurring=true, geen parent). Idempotent: de
// database UNIQUE(parent_id, factuurdatum) vangt eventuele race
// conditions op tussen meerdere tabs.
function _addInterval(isoDate, interval, n = 1) {
  const d = new Date(isoDate);
  if (interval === 'maand')     d.setMonth(d.getMonth() + n);
  else if (interval === 'kwartaal') d.setMonth(d.getMonth() + 3 * n);
  else if (interval === 'jaar') d.setFullYear(d.getFullYear() + n);
  else return null;
  return d.toISOString().slice(0, 10);
}

function _enumerateRecurringDates(template, todayIso) {
  const result = [];
  const interval = template.recurringInterval || 'maand';
  const end = template.recurringEndDate && template.recurringEndDate < todayIso
    ? template.recurringEndDate
    : todayIso;
  let cur = _addInterval(template.factuurdatum, interval, 1);
  let safety = 0;
  while (cur && cur <= end && safety < 600) {
    result.push(cur);
    cur = _addInterval(cur, interval, 1);
    safety++;
  }
  return result;
}

async function generateRecurringInkoop() {
  if (!HAS_INKOOPFACTUREN_TABLE) return;
  if (!Array.isArray(DB.inkoopfacturen)) return;
  const today = new Date().toISOString().slice(0, 10);
  const templates = DB.inkoopfacturen.filter(f => f.isRecurring && !f.parentId);
  if (!templates.length) return;

  let toegevoegd = 0;
  for (const t of templates) {
    const wantDates = _enumerateRecurringDates(t, today);
    if (!wantDates.length) continue;
    const existing = new Set(DB.inkoopfacturen.filter(c => c.parentId === t.id).map(c => c.factuurdatum));
    for (const d of wantDates) {
      if (existing.has(d)) continue;
      const newId = uid();
      const childPayload = {
        factuurnummer: '',
        leverancier: t.leverancier,
        kostenTypeId: t.kostenTypeId,
        factuurdatum: d,
        omschrijving: t.omschrijving,
        bedrag: t.bedrag,
        isRecurring: false,
        recurringInterval: '',
        recurringEndDate: '',
        parentId: t.id,
        bestanden: [],
        notitie: t.notitie,
      };
      try {
        await supa('/rest/v1/inkoopfacturen', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_inkoopfactuur(childPayload) }) });
        DB.inkoopfacturen.push({ id: newId, ...childPayload, createdAt: new Date().toISOString() });
        toegevoegd++;
      } catch (e) {
        // Unique-constraint conflict (parent_id + factuurdatum): andere tab
        // genereerde 'm al — skip stil verder.
        const msg = String(e?.message || e);
        if (!/23505|duplicate|unique/i.test(msg)) {
          console.warn('Recurring inkoop POST failed:', msg);
        }
      }
    }
  }
  if (toegevoegd > 0 && typeof renderContent === 'function' && page === 'inkoopfacturen') {
    try { renderContent(); } catch (e) {}
  }
}

// ── DASHBOARD-INSTELLINGEN ───────────────────────────────────────
// Bewaart de widget-volgorde en zichtbaarheid in Supabase (single-row
// onder id='main'). Valt stilletjes terug op alleen localStorage als
// de tabel ontbreekt — `renderDashboard()` leest sowieso eerst uit
// `DB.dashboardSettings` en daarna uit localStorage.
async function saveDashboardConfig(widgets) {
  const payload = { id: 'main', ...toDB_dashboardSettings({ widgets }) };
  try { localStorage.setItem('crm_pref_dashboard.widgets', JSON.stringify(widgets)); } catch {}
  if (!HAS_DASHBOARD_SETTINGS_TABLE) {
    DB.dashboardSettings = { id: 'main', widgets, updatedAt: payload.updated_at };
    return;
  }
  try {
    await supa('/rest/v1/dashboard_settings?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(payload)
    });
    DB.dashboardSettings = { id: 'main', widgets, updatedAt: payload.updated_at };
  } catch (e) {
    // Stille fallback — localStorage heeft de wijziging al.
    DB.dashboardSettings = { id: 'main', widgets, updatedAt: payload.updated_at };
  }
}

