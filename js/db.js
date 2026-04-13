// ════════════════════════════════════════════════════════════════
// DATA LAAG — in-memory DB + Supabase sync
// ════════════════════════════════════════════════════════════════

let currentSession = null;
let currentUser = null;

let DB = {
  besturen: [], scholen: [], contacten: [],
  dossiers: [], facturen: [], trainingen: [], uitvoeringen: [],
  agenda: [],
  agendaTypes: [],
  emailTemplates: [],
  emailLog: [],
  emailSettings: null
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
function fromDB_dossier(r)  { return { id: r.id, schoolId: r.school_id, datum: r.datum, type: r.type || 'notitie', onderwerp: r.onderwerp || '', tekst: r.tekst || '', bronNaam: r.bron_naam || '', bestanden: r.bestanden || [], bijlagen: r.bijlagen || [] }; }
function fromDB_factuur(r)  { return { id: r.id, schoolId: r.school_id, contactId: r.contact_id, tav: r.tav || '', nummer: r.nummer || '', debiteurnr: r.debiteurnr || '', datum: r.datum, vervaldatum: r.vervaldatum, status: r.status || 'concept', betreft: r.betreft || '', regels: r.regels || [], totaal: r.totaal || 0 }; }
function fromDB_training(r) { return { id: r.id, naam: r.naam, categorie: r.categorie || 'training', duur: r.duur || '', doelgroep: r.doelgroep || '', maxDeelnemers: r.max_deelnemers || '', omschrijving: r.omschrijving || '', tips: r.tips || [] }; }
function fromDB_uitv(r)     { return { id: r.id, trainingId: r.training_id, schoolId: r.school_id, datum: r.datum, deelnemers: r.deelnemers, score: r.score, evaluatie: r.evaluatie || '', watGingGoed: r.wat_ging_goed || '', watKonBeter: r.wat_kon_beter || '' }; }
function fromDB_agenda(r)   { return { id: r.id, titel: r.titel, datum: r.datum, beginTijd: r.begin_tijd || '', eindTijd: r.eind_tijd || '', type: r.type || 'afspraak', schoolId: r.school_id || '', contactId: r.contact_id || '', bestuurId: r.bestuur_id || '', locatie: r.locatie || '', notitie: r.notitie || '', createdAt: r.created_at }; }
function fromDB_agendaType(r) { return { id: r.id, naam: r.naam, kleur: r.kleur || 'navy' }; }
function fromDB_emailTemplate(r) { return { id: r.id, naam: r.naam, onderwerp: r.onderwerp || '', body: r.body || '', categorie: r.categorie || 'algemeen', createdAt: r.created_at }; }
function fromDB_emailLog(r) { return { id: r.id, templateId: r.template_id || '', schoolId: r.school_id || '', contactId: r.contact_id || '', factuurId: r.factuur_id || '', aanEmail: r.aan_email || '', aanNaam: r.aan_naam || '', onderwerp: r.onderwerp || '', body: r.body || '', status: r.status || 'verzonden', datum: r.datum }; }
function fromDB_emailSettings(r) { return { id: r.id, imapHost: r.imap_host || '', imapPort: r.imap_port || 993, smtpHost: r.smtp_host || '', smtpPort: r.smtp_port || 587, emailUser: r.email_user || '', emailPass: r.email_pass || '', emailFrom: r.email_from || '', signature: r.signature || '', updatedAt: r.updated_at }; }
function fromDB_caldavSettings(r) { return { id: r.id, appleId: r.apple_id || '', appPassword: r.app_password || '', serverUrl: r.server_url || 'https://caldav.icloud.com', calendarName: r.calendar_name || '', updatedAt: r.updated_at }; }

// ── camelCase → snake_case for writes ────────────────────────────
function toDB_bestuur(d)  { return { naam: d.naam, website: d.website || null, adres: d.adres || null }; }
function toDB_school(d)   { return { bestuur_id: d.bestuurId || null, naam: d.naam, debiteurnr: d.debiteurnr || null, adres: d.adres || null, postcode: d.postcode || null, plaats: d.plaats || null, website: d.website || null }; }
function toDB_contact(d)  { return { school_id: d.schoolId, naam: d.naam, functie: d.functie || null, type: d.type || 'beslisser', email: d.email || null, telefoon: d.telefoon || null }; }
function toDB_dossier(d)  { return { school_id: d.schoolId, datum: d.datum, type: d.type || 'notitie', onderwerp: d.onderwerp || null, tekst: d.tekst || null, bron_naam: d.bronNaam || null, bestanden: d.bestanden || [] }; }
function toDB_factuur(d)  { return { school_id: d.schoolId, contact_id: d.contactId || null, tav: d.tav || null, nummer: d.nummer || null, debiteurnr: d.debiteurnr || null, datum: d.datum || null, vervaldatum: d.vervaldatum || null, status: d.status || 'concept', betreft: d.betreft || null, regels: d.regels || [], totaal: d.totaal || 0 }; }
function toDB_training(d) { return { naam: d.naam, categorie: d.categorie || 'training', duur: d.duur || null, doelgroep: d.doelgroep || null, max_deelnemers: d.maxDeelnemers || null, omschrijving: d.omschrijving || null, tips: d.tips || [] }; }
function toDB_uitv(d)     { return { training_id: d.trainingId, school_id: d.schoolId, datum: d.datum || null, deelnemers: d.deelnemers ? parseInt(d.deelnemers) : null, score: d.score || null, evaluatie: d.evaluatie || null, wat_ging_goed: d.watGingGoed || null, wat_kon_beter: d.watKonBeter || null }; }
function toDB_agenda(d)   { return { titel: d.titel, datum: d.datum, begin_tijd: d.beginTijd || null, eind_tijd: d.eindTijd || null, type: d.type || 'afspraak', school_id: d.schoolId || null, contact_id: d.contactId || null, bestuur_id: d.bestuurId || null, locatie: d.locatie || null, notitie: d.notitie || null }; }

// ── Load all data from Supabase ───────────────────────────────────
async function loadAllData() {
  showLoading();
  try {
    const [besturen, scholen, contacten, dossiers, facturen, trainingen, uitvoeringen, agenda, agendaTypes, emailTemplates, emailLog, emailSettingsArr, caldavSettingsArr] = await Promise.all([
      supa('/rest/v1/besturen?select=*&order=naam'),
      supa('/rest/v1/scholen?select=*&order=naam'),
      supa('/rest/v1/contacten?select=*&order=naam'),
      supa('/rest/v1/dossiers?select=*&order=datum.desc'),
      supa('/rest/v1/facturen?select=*&order=datum.desc'),
      supa('/rest/v1/trainingen?select=*&order=naam'),
      supa('/rest/v1/uitvoeringen?select=*&order=datum.desc'),
      supa('/rest/v1/agenda?select=*&order=datum.asc,begin_tijd.asc'),
      supa('/rest/v1/agenda_types?select=*&order=naam'),
      supa('/rest/v1/email_templates?select=*&order=naam'),
      supa('/rest/v1/email_log?select=*&order=datum.desc'),
      supa('/rest/v1/email_settings?select=*&id=eq.main'),
      supa('/rest/v1/caldav_settings?select=*&id=eq.main').catch(() => []),
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
    DB.emailTemplates = (emailTemplates || []).map(fromDB_emailTemplate);
    DB.emailLog       = (emailLog || []).map(fromDB_emailLog);
    DB.emailSettings  = (emailSettingsArr || []).map(fromDB_emailSettings)[0] || null;
    DB.caldavSettings = (caldavSettingsArr || []).map(fromDB_caldavSettings)[0] || null;
  } catch (e) {
    showToast('Fout bij laden data: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}
