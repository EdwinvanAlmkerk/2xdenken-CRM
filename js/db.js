// ════════════════════════════════════════════════════════════════
// DATA LAAG — in-memory DB + Supabase sync
// ════════════════════════════════════════════════════════════════

let currentSession = null;
let currentUser = null;
let HAS_TRAINING_TYPES_TABLE = false;
let HAS_TRAINING_CATEGORIES_TABLE = false;
let HAS_TRAINING_BESTANDEN_COLUMN = false;
let HAS_TRAINING_LINKS_COLUMN = false;

let DB = {
  besturen: [], scholen: [], contacten: [],
  dossiers: [], facturen: [], trainingen: [], uitvoeringen: [],
  agenda: [],
  agendaTypes: [],
  trainingTypes: [],
  trainingCategories: [],
  emailTemplates: [],
  emailLog: [],
  emailSettings: null
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 18);
}

function isJwtExpiredError(status, errText = '') {
  return status === 401 && /JWT expired|PGRST303|invalid jwt|jwt malformed|expired/i.test(errText);
}

async function refreshCurrentSession() {
  if (!currentSession?.refresh_token) return false;

  try {
    const data = await supaAuth('/auth/v1/token?grant_type=refresh_token', {
      refresh_token: currentSession.refresh_token
    });

    currentSession = data;
    currentUser = {
      name: data.user?.email?.split('@')[0] || currentUser?.name || 'Gebruiker',
      email: data.user?.email || currentUser?.email || ''
    };
    localStorage.setItem('crm_session', JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Session refresh failed:', e);
    currentSession = null;
    currentUser = null;
    localStorage.removeItem('crm_session');
    return false;
  }
}

// ── Supabase fetch helper ─────────────────────────────────────────
async function supa(path, options = {}, retryOnAuthFailure = true) {
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

    if (retryOnAuthFailure && isJwtExpiredError(res.status, err) && await refreshCurrentSession()) {
      return supa(path, options, false);
    }

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
function fromDB_bestuur(r)  { return { id: r.id, naam: r.naam, website: r.website || '', adres: r.adres || '', debiteurnr: r.debiteurnr || '' }; }
function fromDB_school(r)   { return { id: r.id, bestuurId: r.bestuur_id, naam: r.naam, debiteurnr: r.debiteurnr || '', adres: r.adres || '', postcode: r.postcode || '', plaats: r.plaats || '', website: r.website || '' }; }
function fromDB_contact(r)  { return { id: r.id, schoolId: r.school_id, naam: r.naam, functie: r.functie || '', type: r.type || 'beslisser', email: r.email || '', telefoon: r.telefoon || '' }; }
function fromDB_dossier(r)  { return { id: r.id, schoolId: r.school_id, contactId: r.contact_id || '', datum: r.datum, type: r.type || 'notitie', onderwerp: r.onderwerp || '', tekst: r.tekst || '', bronNaam: r.bron_naam || '', bestanden: r.bestanden || [], bijlagen: r.bijlagen || [] }; }
function fromDB_factuur(r)  { return { id: r.id, schoolId: r.school_id || '', bestuurId: r.bestuur_id || '', contactId: r.contact_id, tav: r.tav || '', nummer: r.nummer || '', debiteurnr: r.debiteurnr || '', datum: r.datum, vervaldatum: r.vervaldatum, status: r.status || 'concept', betreft: r.betreft || '', regels: r.regels || [], totaal: r.totaal || 0 }; }
function getLocalTrainingDocsMap() {
  try { return JSON.parse(localStorage.getItem('crm_training_bestanden') || '{}'); } catch (e) { return {}; }
}
function getLocalTrainingLinksMap() {
  try { return JSON.parse(localStorage.getItem('crm_training_links') || '{}'); } catch (e) { return {}; }
}
function fromDB_training(r) {
  const storedCategory = typeof r.doelgroep === 'string' && r.doelgroep.startsWith('cat:')
    ? r.doelgroep.slice(4)
    : 'algemeen';
  const localDocs = getLocalTrainingDocsMap()[r.id] || [];
  const localLinks = getLocalTrainingLinksMap()[r.id] || [];
  return {
    id: r.id,
    naam: r.naam,
    type: r.categorie || 'training',
    categorie: storedCategory,
    duur: '',
    doelgroep: '',
    maxDeelnemers: '',
    omschrijving: r.omschrijving || '',
    tips: r.tips || [],
    bestanden: Array.isArray(r.bestanden) ? r.bestanden : localDocs,
    links: Array.isArray(r.tips_links) ? r.tips_links : localLinks
  };
}
function fromDB_uitv(r)     { return { id: r.id, trainingId: r.training_id, schoolId: r.school_id, contactId: r.contact_id || '', datum: r.datum, deelnemers: r.deelnemers, score: r.score, evaluatie: r.evaluatie || '', watGingGoed: r.wat_ging_goed || '', watKonBeter: r.wat_kon_beter || '' }; }
function fromDB_agenda(r)   { return { id: r.id, titel: r.titel, datum: r.datum, beginTijd: r.begin_tijd || '', eindTijd: r.eind_tijd || '', type: r.type || 'afspraak', schoolId: r.school_id || '', contactId: r.contact_id || '', bestuurId: r.bestuur_id || '', locatie: r.locatie || '', notitie: r.notitie || '', createdAt: r.created_at }; }
function fromDB_agendaType(r) { return { id: r.id, naam: r.naam, kleur: r.kleur || 'navy' }; }
function fromDB_trainingType(r) { return { id: r.id, naam: r.naam, kleur: r.kleur || 'navy' }; }
function fromDB_trainingCategory(r) { return { id: r.id, naam: r.naam, kleur: r.kleur || 'navy' }; }
function fromDB_emailTemplate(r) { return { id: r.id, naam: r.naam, onderwerp: r.onderwerp || '', body: r.body || '', categorie: r.categorie || 'algemeen', createdAt: r.created_at }; }
function fromDB_emailLog(r) { return { id: r.id, templateId: r.template_id || '', schoolId: r.school_id || '', contactId: r.contact_id || '', factuurId: r.factuur_id || '', aanEmail: r.aan_email || '', aanNaam: r.aan_naam || '', onderwerp: r.onderwerp || '', body: r.body || '', status: r.status || 'verzonden', datum: r.datum }; }
function fromDB_emailSettings(r) { return { id: r.id, imapHost: r.imap_host || '', imapPort: r.imap_port || 993, smtpHost: r.smtp_host || '', smtpPort: r.smtp_port || 587, emailUser: r.email_user || '', emailPass: r.email_pass || '', emailFrom: r.email_from || '', signature: r.signature || '', updatedAt: r.updated_at }; }
function fromDB_outlookSettings(r) { return { id: r.id, icsUrl: r.ics_url || '', daysPast: r.days_past ?? 30, daysFuture: r.days_future ?? 180, calendarName: r.calendar_name || '', updatedAt: r.updated_at }; }

// ── camelCase → snake_case for writes ────────────────────────────
function toDB_bestuur(d)  { return { naam: d.naam, website: d.website || null, adres: d.adres || null, debiteurnr: d.debiteurnr || null }; }
function toDB_school(d)   { return { bestuur_id: d.bestuurId || null, naam: d.naam, debiteurnr: d.debiteurnr || null, adres: d.adres || null, postcode: d.postcode || null, plaats: d.plaats || null, website: d.website || null }; }
function toDB_contact(d)  { return { school_id: d.schoolId, naam: d.naam, functie: d.functie || null, type: d.type || 'beslisser', email: d.email || null, telefoon: d.telefoon || null }; }
function toDB_dossier(d)  { return { school_id: d.schoolId, contact_id: d.contactId || null, datum: d.datum, type: d.type || 'notitie', onderwerp: d.onderwerp || null, tekst: d.tekst || null, bron_naam: d.bronNaam || null, bestanden: d.bestanden || [] }; }
function toDB_factuur(d)  { return { school_id: d.schoolId || null, bestuur_id: d.bestuurId || null, contact_id: d.contactId || null, tav: d.tav || null, nummer: d.nummer || null, debiteurnr: d.debiteurnr || null, datum: d.datum || null, vervaldatum: d.vervaldatum || null, status: d.status || 'concept', betreft: d.betreft || null, regels: d.regels || [], totaal: d.totaal || 0 }; }
function toDB_training(d) {
  const payload = {
    naam: d.naam,
    categorie: d.type || 'training',
    duur: null,
    doelgroep: d.categorie ? `cat:${d.categorie}` : 'cat:algemeen',
    max_deelnemers: null,
    omschrijving: d.omschrijving || null,
    tips: d.tips || []
  };
  if (HAS_TRAINING_BESTANDEN_COLUMN) payload.bestanden = d.bestanden || [];
  if (HAS_TRAINING_LINKS_COLUMN) payload.tips_links = d.links || [];
  return payload;
}
function toDB_uitv(d)     { return { training_id: d.trainingId, school_id: d.schoolId, contact_id: d.contactId || null, datum: d.datum || null, deelnemers: d.deelnemers ? parseInt(d.deelnemers) : null, score: d.score || null, evaluatie: d.evaluatie || null, wat_ging_goed: d.watGingGoed || null, wat_kon_beter: d.watKonBeter || null }; }
function toDB_agenda(d)   { return { titel: d.titel, datum: d.datum, begin_tijd: d.beginTijd || null, eind_tijd: d.eindTijd || null, type: d.type || 'afspraak', school_id: d.schoolId || null, contact_id: d.contactId || null, bestuur_id: d.bestuurId || null, locatie: d.locatie || null, notitie: d.notitie || null }; }

// ── Load all data from Supabase ───────────────────────────────────
async function loadAllData() {
  showLoading();
  try {
    const [besturen, scholen, contacten, dossiers, facturen, trainingen, uitvoeringen, agenda, agendaTypes, trainingTypes, trainingCategories, _trainingBestandenProbe, _trainingLinksProbe, emailTemplates, emailLog, emailSettingsArr, outlookSettingsArr] = await Promise.all([
      supa('/rest/v1/besturen?select=*&order=naam'),
      supa('/rest/v1/scholen?select=*&order=naam'),
      supa('/rest/v1/contacten?select=*&order=naam'),
      supa('/rest/v1/dossiers?select=*&order=datum.desc'),
      supa('/rest/v1/facturen?select=*&order=datum.desc'),
      supa('/rest/v1/trainingen?select=*&order=naam'),
      supa('/rest/v1/uitvoeringen?select=*&order=datum.desc'),
      supa('/rest/v1/agenda?select=*&order=datum.asc,begin_tijd.asc'),
      supa('/rest/v1/agenda_types?select=*&order=naam'),
      supa('/rest/v1/training_types?select=*&order=naam')
        .then(r => { HAS_TRAINING_TYPES_TABLE = true; return r; })
        .catch(() => { HAS_TRAINING_TYPES_TABLE = false; return []; }),
      supa('/rest/v1/training_categories?select=*&order=naam')
        .then(r => { HAS_TRAINING_CATEGORIES_TABLE = true; return r; })
        .catch(() => { HAS_TRAINING_CATEGORIES_TABLE = false; return []; }),
      supa('/rest/v1/trainingen?select=bestanden&limit=1')
        .then(r => { HAS_TRAINING_BESTANDEN_COLUMN = true; return r; })
        .catch(() => { HAS_TRAINING_BESTANDEN_COLUMN = false; return []; }),
      supa('/rest/v1/trainingen?select=tips_links&limit=1')
        .then(r => { HAS_TRAINING_LINKS_COLUMN = true; return r; })
        .catch(() => { HAS_TRAINING_LINKS_COLUMN = false; return []; }),
      supa('/rest/v1/email_templates?select=*&order=naam'),
      supa('/rest/v1/email_log?select=*&order=datum.desc'),
      supa('/rest/v1/email_settings?select=*&id=eq.main'),
      supa('/rest/v1/outlook_settings?select=*&id=eq.main').catch(() => []),
    ]);
    DB.besturen     = (besturen || []).map(fromDB_bestuur);
    DB.scholen      = (scholen || []).map(fromDB_school);
    DB.contacten    = (contacten || []).map(fromDB_contact);
    DB.dossiers     = (dossiers || []).map(fromDB_dossier);
    DB.facturen     = (facturen || []).map(fromDB_factuur);
    DB.trainingen   = (trainingen || []).map(fromDB_training);
    DB.uitvoeringen = (uitvoeringen || []).map(fromDB_uitv);
    DB.agenda       = (agenda || []).map(fromDB_agenda);
    DB.agendaTypes  = (agendaTypes || []).map(fromDB_agendaType);
    DB.trainingTypes = (trainingTypes || []).map(fromDB_trainingType);
    DB.trainingCategories = (trainingCategories || []).map(fromDB_trainingCategory);
    DB.emailTemplates = (emailTemplates || []).map(fromDB_emailTemplate);
    DB.emailLog       = (emailLog || []).map(fromDB_emailLog);
    DB.emailSettings  = (emailSettingsArr || []).map(fromDB_emailSettings)[0] || null;
    DB.outlookSettings = (outlookSettingsArr || []).map(fromDB_outlookSettings)[0] || null;
    rebuildIndexes();
  } catch (e) {
    showToast('Gegevens laden mislukt: ' + mapSupaError(e), 'error'); console.error(e);
  } finally {
    hideLoading();
  }
}

// ════════════════════════════════════════════════════════════════
// INDEXES — O(1) lookups in plaats van O(n) .find()-loops in render-paths
// ════════════════════════════════════════════════════════════════
// De Maps hieronder vervangen herhaalde .find() aanroepen in render-loops
// (N+1 gedrag). Ze worden opnieuw gebouwd aan het begin van elke render
// (zie router.js renderContent) en na loadAllData(). Dat is O(n) per render
// in plaats van O(n²) door geneste find()-loops.

DB._idx = {
  schoolById:        new Map(),
  bestuurById:       new Map(),
  contactById:       new Map(),
  trainingById:      new Map(),
  factuurById:       new Map(),
  dossierById:       new Map(),
  agendaById:        new Map(),
  uitvById:          new Map(),
  agendaTypeById:    new Map(),
  trainingTypeById:  new Map(),
  trainingCatById:   new Map(),
  contactenBySchool:    new Map(),
  scholenByBestuur:     new Map(),
  dossiersBySchool:     new Map(),
  dossiersByContact:    new Map(),
  facturenBySchool:     new Map(),
  facturenByContact:    new Map(),
  uitvBySchool:         new Map(),
  uitvByContact:        new Map(),
  uitvByTraining:       new Map(),
  agendaBySchool:       new Map(),
  agendaByContact:      new Map(),
  agendaByBestuur:      new Map(),
  agendaByDate:         new Map(),
  contactByEmail:       new Map(),
};

function _groupBy(arr, key) {
  const m = new Map();
  for (const it of arr) {
    const k = it[key];
    if (!k) continue;
    const list = m.get(k);
    if (list) list.push(it); else m.set(k, [it]);
  }
  return m;
}

function _byId(arr) {
  const m = new Map();
  for (const it of arr) if (it?.id) m.set(it.id, it);
  return m;
}

// Snapshot van array-referenties + lengtes waarop de indexes zijn gebouwd.
// Wordt gebruikt door ensureIndexes() om vast te stellen of een rebuild
// nodig is. Dekt: reassignment (map/filter geeft nieuwe ref) én in-place
// push/unshift/splice (zelfde ref, andere length).
DB._idx._builtFrom = null;

function _snapshotDB() {
  return {
    s: DB.scholen,       sL: (DB.scholen || []).length,
    b: DB.besturen,      bL: (DB.besturen || []).length,
    c: DB.contacten,     cL: (DB.contacten || []).length,
    t: DB.trainingen,    tL: (DB.trainingen || []).length,
    f: DB.facturen,      fL: (DB.facturen || []).length,
    d: DB.dossiers,      dL: (DB.dossiers || []).length,
    a: DB.agenda,        aL: (DB.agenda || []).length,
    u: DB.uitvoeringen,  uL: (DB.uitvoeringen || []).length,
    at: DB.agendaTypes,  atL: (DB.agendaTypes || []).length,
    tt: DB.trainingTypes, ttL: (DB.trainingTypes || []).length,
    tc: DB.trainingCategories, tcL: (DB.trainingCategories || []).length,
  };
}

function _snapshotMatches(a, b) {
  if (!a || !b) return false;
  return a.s === b.s && a.sL === b.sL
      && a.b === b.b && a.bL === b.bL
      && a.c === b.c && a.cL === b.cL
      && a.t === b.t && a.tL === b.tL
      && a.f === b.f && a.fL === b.fL
      && a.d === b.d && a.dL === b.dL
      && a.a === b.a && a.aL === b.aL
      && a.u === b.u && a.uL === b.uL
      && a.at === b.at && a.atL === b.atL
      && a.tt === b.tt && a.ttL === b.ttL
      && a.tc === b.tc && a.tcL === b.tcL;
}

// Rebuildt de indexes alleen als de DB-state daadwerkelijk is veranderd
// (andere array-referentie of lengte). Veilig om vaak aan te roepen.
function ensureIndexes() {
  const snap = _snapshotDB();
  if (!_snapshotMatches(DB._idx._builtFrom, snap)) rebuildIndexes();
}

function rebuildIndexes() {
  const i = DB._idx;
  i.schoolById       = _byId(DB.scholen || []);
  i.bestuurById      = _byId(DB.besturen || []);
  i.contactById      = _byId(DB.contacten || []);
  i.trainingById     = _byId(DB.trainingen || []);
  i.factuurById      = _byId(DB.facturen || []);
  i.dossierById      = _byId(DB.dossiers || []);
  i.agendaById       = _byId(DB.agenda || []);
  i.uitvById         = _byId(DB.uitvoeringen || []);
  i.agendaTypeById   = _byId(DB.agendaTypes || []);
  i.trainingTypeById = _byId(DB.trainingTypes || []);
  i.trainingCatById  = _byId(DB.trainingCategories || []);
  i.contactenBySchool = _groupBy(DB.contacten || [], 'schoolId');
  i.scholenByBestuur  = _groupBy(DB.scholen || [],   'bestuurId');
  // Verberg ontkoppelde inbox-mails (soft-delete tombstones) overal
  // behalve in dossierById — die blijft compleet voor dedup-checks.
  // Auto-gelogde inbox-mails komen alleen in dossiersByContact, niet bij
  // de school: ze horen thuis op de contact-detailpagina.
  const visibleDossiers = (DB.dossiers || []).filter(d => d.type !== 'inbox-archived');
  const schoolDossiers = visibleDossiers.filter(d => !(typeof d.id === 'string' && d.id.startsWith('inbox-')));
  i.dossiersBySchool  = _groupBy(schoolDossiers, 'schoolId');
  i.dossiersByContact = _groupBy(visibleDossiers, 'contactId');
  i.facturenBySchool  = _groupBy(DB.facturen || [],  'schoolId');
  i.facturenByBestuur = _groupBy(DB.facturen || [],  'bestuurId');
  i.facturenByContact = _groupBy(DB.facturen || [],  'contactId');
  i.uitvBySchool      = _groupBy(DB.uitvoeringen || [], 'schoolId');
  i.uitvByContact     = _groupBy(DB.uitvoeringen || [], 'contactId');
  i.uitvByTraining    = _groupBy(DB.uitvoeringen || [], 'trainingId');
  i.agendaBySchool    = _groupBy(DB.agenda || [], 'schoolId');
  i.agendaByContact   = _groupBy(DB.agenda || [], 'contactId');
  i.agendaByBestuur   = _groupBy(DB.agenda || [], 'bestuurId');
  i.agendaByDate      = _groupBy(DB.agenda || [], 'datum');
  i.contactByEmail.clear();
  for (const c of DB.contacten || []) {
    if (c.email) i.contactByEmail.set(c.email.toLowerCase(), c);
  }
  i._builtFrom = _snapshotDB();
}

function getContactByEmail(email) {
  if (!email) return null;
  ensureIndexes();
  return DB._idx.contactByEmail.get(String(email).toLowerCase()) || null;
}

// ── By-id getters (O(1)) ─────────────────────────────────────────
// Elke getter roept ensureIndexes() aan zodat we self-healing zijn als
// DB is gemuteerd zonder renderContent() te triggeren. De check is een
// goedkope referentie+length vergelijking (~11 compares).
function getSchool(id)       { ensureIndexes(); return id ? DB._idx.schoolById.get(id)       || null : null; }
function getBestuur(id)      { ensureIndexes(); return id ? DB._idx.bestuurById.get(id)      || null : null; }
function getContact(id)      { ensureIndexes(); return id ? DB._idx.contactById.get(id)      || null : null; }
function getTraining(id)     { ensureIndexes(); return id ? DB._idx.trainingById.get(id)     || null : null; }
function getFactuur(id)      { ensureIndexes(); return id ? DB._idx.factuurById.get(id)      || null : null; }
function getDossier(id)      { ensureIndexes(); return id ? DB._idx.dossierById.get(id)      || null : null; }
function getAgenda(id)       { ensureIndexes(); return id ? DB._idx.agendaById.get(id)       || null : null; }
function getUitvoering(id)   { ensureIndexes(); return id ? DB._idx.uitvById.get(id)         || null : null; }

// ── Relationele getters (O(1) lookup, O(k) resultaatlijst) ──────
function contactenVanSchool(id)   { ensureIndexes(); return DB._idx.contactenBySchool.get(id)  || []; }
function scholenVanBestuur(id)    { ensureIndexes(); return DB._idx.scholenByBestuur.get(id)   || []; }
function dossiersVanSchool(id)    { ensureIndexes(); return DB._idx.dossiersBySchool.get(id)   || []; }
function dossiersVanContact(id)   { ensureIndexes(); return DB._idx.dossiersByContact.get(id)  || []; }
function facturenVanSchool(id)    { ensureIndexes(); return DB._idx.facturenBySchool.get(id)   || []; }
function facturenVanBestuur(id)   { ensureIndexes(); return DB._idx.facturenByBestuur.get(id)  || []; }
function facturenVanContact(id)   { ensureIndexes(); return DB._idx.facturenByContact.get(id)  || []; }

// Geeft de "klantnaam" van een factuur: school als die er is, anders bestuur.
function factuurKlantNaam(f) {
  if (!f) return '';
  const s = f.schoolId ? getSchool(f.schoolId) : null;
  if (s) return s.naam || '';
  const b = f.bestuurId ? getBestuur(f.bestuurId) : null;
  return b?.naam || '';
}

// Genereer het volgende vrije debiteurnummer (DB-prefix + oplopend nummer)
// op basis van bestaande nummers op scholen én besturen — beide gebruiken
// dezelfde namespace zodat elk klant-debiteurnummer uniek is.
function nextDebiteurnr() {
  let max = 0;
  const scan = list => {
    for (const x of list || []) {
      const m = String(x.debiteurnr || '').match(/^DB(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
  };
  scan(DB.scholen);
  scan(DB.besturen);
  return 'DB' + String(max + 1).padStart(2, '0');
}

// Controleer of een debiteurnummer al door een andere klant gebruikt wordt.
// excludeType: 'school' of 'bestuur'; excludeId is de id die we mogen overslaan
// (bij bewerken van een bestaande record).
function isDebiteurnrInUse(debiteurnr, excludeType, excludeId) {
  const norm = String(debiteurnr || '').trim().toLowerCase();
  if (!norm) return false;
  for (const s of DB.scholen || []) {
    if (excludeType === 'school' && s.id === excludeId) continue;
    if (String(s.debiteurnr || '').trim().toLowerCase() === norm) return true;
  }
  for (const b of DB.besturen || []) {
    if (excludeType === 'bestuur' && b.id === excludeId) continue;
    if (String(b.debiteurnr || '').trim().toLowerCase() === norm) return true;
  }
  return false;
}
function uitvoeringenVanSchool(id)   { ensureIndexes(); return DB._idx.uitvBySchool.get(id)    || []; }
function uitvoeringenVanContact(id)  { ensureIndexes(); return DB._idx.uitvByContact.get(id)   || []; }
function uitvoeringenVanTraining(id) { ensureIndexes(); return DB._idx.uitvByTraining.get(id)  || []; }
function agendaVanSchool(id)      { ensureIndexes(); return DB._idx.agendaBySchool.get(id)     || []; }
function agendaVanContact(id)     { ensureIndexes(); return DB._idx.agendaByContact.get(id)    || []; }
function agendaVanBestuur(id)     { ensureIndexes(); return DB._idx.agendaByBestuur.get(id)    || []; }
function agendaOpDatum(iso)       { ensureIndexes(); return DB._idx.agendaByDate.get(iso)      || []; }
