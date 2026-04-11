// ════════════════════════════════════════════════════════════════
// DATA LAAG — in-memory DB + Supabase sync
// ════════════════════════════════════════════════════════════════

let currentSession = null;
let currentUser = null;

let DB = {
  besturen: [], scholen: [], contacten: [],
  dossiers: [], facturen: [], trainingen: [], uitvoeringen: []
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 18);
}

// ── Supabase fetch helper ─────────────────────────────────────────
async function supa(path, options = {}) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers
    },
    ...options
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Supabase error:', res.status, err);
    throw new Error(`Supabase ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Auth helpers ──────────────────────────────────────────────────
async function supaAuth(path, body) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Auth error');
  return data;
}

// ── Supabase → camelCase mapping ──────────────────────────────────
function fromDB_bestuur(r)  { return { id: r.id, naam: r.naam, website: r.website || '', adres: r.adres || '' }; }
function fromDB_school(r)   { return { id: r.id, bestuurId: r.bestuur_id, naam: r.naam, debiteurnr: r.debiteurnr || '', adres: r.adres || '', postcode: r.postcode || '', plaats: r.plaats || '', website: r.website || '' }; }
function fromDB_contact(r)  { return { id: r.id, schoolId: r.school_id, naam: r.naam, functie: r.functie || '', type: r.type || 'beslisser', email: r.email || '', telefoon: r.telefoon || '' }; }
function fromDB_dossier(r)  { return { id: r.id, schoolId: r.school_id, contactId: r.contact_id, datum: r.datum, type: r.type || 'notitie', onderwerp: r.onderwerp || '', tekst: r.tekst || '', bronNaam: r.bron_naam || '', bestanden: r.bestanden || [], bijlagen: r.bijlagen || [] }; }
function fromDB_factuur(r)  { return { id: r.id, schoolId: r.school_id, contactId: r.contact_id, tav: r.tav || '', nummer: r.nummer || '', debiteurnr: r.debiteurnr || '', datum: r.datum, vervaldatum: r.vervaldatum, status: r.status || 'concept', betreft: r.betreft || '', regels: r.regels || [], totaal: r.totaal || 0 }; }
function fromDB_training(r) { return { id: r.id, naam: r.naam, categorie: r.categorie || 'training', duur: r.duur || '', doelgroep: r.doelgroep || '', maxDeelnemers: r.max_deelnemers || '', omschrijving: r.omschrijving || '', tips: r.tips || [] }; }
function fromDB_uitv(r)     { return { id: r.id, trainingId: r.training_id, schoolId: r.school_id, datum: r.datum, deelnemers: r.deelnemers, score: r.score, evaluatie: r.evaluatie || '', watGingGoed: r.wat_ging_goed || '', watKonBeter: r.wat_kon_beter || '' }; }

// ── camelCase → snake_case for writes ────────────────────────────
function toDB_bestuur(d)  { return { naam: d.naam, website: d.website || null, adres: d.adres || null }; }
function toDB_school(d)   { return { bestuur_id: d.bestuurId || null, naam: d.naam, debiteurnr: d.debiteurnr || null, adres: d.adres || null, postcode: d.postcode || null, plaats: d.plaats || null, website: d.website || null }; }
function toDB_contact(d)  { return { school_id: d.schoolId, naam: d.naam, functie: d.functie || null, type: d.type || 'beslisser', email: d.email || null, telefoon: d.telefoon || null }; }
function toDB_dossier(d)  { return { school_id: d.schoolId, contact_id: d.contactId || null, datum: d.datum, type: d.type || 'notitie', onderwerp: d.onderwerp || null, tekst: d.tekst || null, bron_naam: d.bronNaam || null, bestanden: d.bestanden || [] }; }
function toDB_factuur(d)  { return { school_id: d.schoolId, contact_id: d.contactId || null, tav: d.tav || null, nummer: d.nummer || null, debiteurnr: d.debiteurnr || null, datum: d.datum || null, vervaldatum: d.vervaldatum || null, status: d.status || 'concept', betreft: d.betreft || null, regels: d.regels || [], totaal: d.totaal || 0 }; }
function toDB_training(d) { return { naam: d.naam, categorie: d.categorie || 'training', duur: d.duur || null, doelgroep: d.doelgroep || null, max_deelnemers: d.maxDeelnemers || null, omschrijving: d.omschrijving || null, tips: d.tips || [] }; }
function toDB_uitv(d)     { return { training_id: d.trainingId, school_id: d.schoolId, datum: d.datum || null, deelnemers: d.deelnemers ? parseInt(d.deelnemers) : null, score: d.score || null, evaluatie: d.evaluatie || null, wat_ging_goed: d.watGingGoed || null, wat_kon_beter: d.watKonBeter || null }; }

// ── Load all data from Supabase ───────────────────────────────────
async function loadAllData() {
  showLoading();
  try {
    const [besturen, scholen, contacten, dossiers, facturen, trainingen, uitvoeringen] = await Promise.all([
      supa('/rest/v1/besturen?select=*&order=naam'),
      supa('/rest/v1/scholen?select=*&order=naam'),
      supa('/rest/v1/contacten?select=*&order=naam'),
      supa('/rest/v1/dossiers?select=*&order=datum.desc'),
      supa('/rest/v1/facturen?select=*&order=datum.desc'),
      supa('/rest/v1/trainingen?select=*&order=naam'),
      supa('/rest/v1/uitvoeringen?select=*&order=datum.desc'),
    ]);
    DB.besturen     = (besturen || []).map(fromDB_bestuur);
    DB.scholen      = (scholen || []).map(fromDB_school);
    DB.contacten    = (contacten || []).map(fromDB_contact);
    DB.dossiers     = (dossiers || []).map(fromDB_dossier);
    DB.facturen     = (facturen || []).map(fromDB_factuur);
    DB.trainingen   = (trainingen || []).map(fromDB_training);
    DB.uitvoeringen = (uitvoeringen || []).map(fromDB_uitv);
  } catch (e) {
    showToast('Fout bij laden data: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}
