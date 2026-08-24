// ════════════════════════════════════════════════════════════════
// E-INK / BOOX MODUS
// ════════════════════════════════════════════════════════════════
// Zet `class="eink"` op <html> en activeert daarmee css/eink.css:
// een zwart-wit, animatieloze, contrastrijke variant van de CRM die
// leesbaar en snel is op e-paper (Onyx Boox e.d.).
//
// Dit bestand wordt bewust in de <head> geladen, vóór de rest van de
// app, zodat de klasse al staat voordat er iets getekend wordt. Het
// heeft daarom géén afhankelijkheden op utils.js/ui.js en gebruikt
// eigen mini-helpers voor localStorage (wel met dezelfde
// `crm_pref_`-prefix als prefGet/prefSet).
//
// Voorkeuren:
//   crm_pref_eink.mode  → 'auto' (standaard) | 'aan' | 'uit'
//   crm_pref_eink.size  → 'normaal' (standaard) | 'groot' | 'xl'
//
// In 'auto' bepaalt de apparaatdetectie het resultaat; zodra de
// gebruiker zelf schakelt wordt de keuze hard vastgelegd.
// Met ?eink=1 / ?eink=0 in de URL is de modus af te dwingen — handig
// als bladwijzer op de Boox zelf.

const EINK_MODE_KEY = 'crm_pref_eink.mode';
const EINK_SIZE_KEY = 'crm_pref_eink.size';

function _einkGet(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v;
  } catch (e) { return def; }
}
function _einkSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) {}
}

// ── Apparaatdetectie ─────────────────────────────────────────────
// 1. Onyx Boox zet 'onyx' of 'boox' in de user-agent.
// 2. `update: slow` is de mediafeature die juist voor e-paper bedoeld
//    is: het scherm kan niet vloeiend animeren.
// 3. `monochrome` is > 0 op grijswaarde-panelen.
function einkDetectDevice() {
  try {
    const ua = String(navigator.userAgent || '').toLowerCase();
    if (/onyx|boox|kobo|remarkable|e-?ink|eink/.test(ua)) return true;
    if (window.matchMedia && window.matchMedia('(update: slow)').matches) return true;
    if (window.matchMedia && window.matchMedia('(monochrome: 1)').matches) return true;
  } catch (e) {}
  return false;
}

function einkModePref() { return _einkGet(EINK_MODE_KEY, 'auto'); }
function einkSizePref() { return _einkGet(EINK_SIZE_KEY, 'normaal'); }

function einkIsActive() {
  return document.documentElement.classList.contains('eink');
}

// ── Toepassen ────────────────────────────────────────────────────
function applyEinkMode() {
  const mode = einkModePref();
  const on = mode === 'aan' || (mode === 'auto' && einkDetectDevice());
  const root = document.documentElement;
  root.classList.toggle('eink', on);
  if (on) root.setAttribute('data-eink-size', einkSizePref());
  else    root.removeAttribute('data-eink-size');
  // De themakleur van de browser-UI meeschakelen scheelt op de Boox
  // een donkere balk boven een verder wit scherm.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', on ? '#ffffff' : '#121D5B');
  _einkSyncButton();
  return on;
}

function _einkSyncButton() {
  const btn = document.getElementById('eink-toggle');
  if (!btn) return;
  const on = einkIsActive();
  btn.classList.toggle('is-on', on);
  btn.title = on ? 'E-inkmodus uitzetten' : 'E-inkmodus aanzetten (Boox)';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

// ── Schakelen ────────────────────────────────────────────────────
// mode: 'auto' | 'aan' | 'uit'
function setEinkMode(mode) {
  if (!['auto', 'aan', 'uit'].includes(mode)) mode = 'auto';
  _einkSet(EINK_MODE_KEY, mode);
  const on = applyEinkMode();
  // Bij inschakelen meteen één volledige refresh: het scherm staat op
  // dat moment nog vol met resten van het kleurenthema.
  if (on) einkRefresh();
  if (typeof renderContent === 'function' && document.getElementById('content')) {
    try { renderContent(); } catch (e) {}
  }
  return on;
}

function toggleEinkMode() {
  const on = setEinkMode(einkIsActive() ? 'uit' : 'aan');
  if (typeof showToast === 'function') {
    showToast(on ? 'E-inkmodus aan — optimaal voor de Boox' : 'E-inkmodus uit');
  }
  return on;
}

function setEinkTextSize(size) {
  if (!['normaal', 'groot', 'xl'].includes(size)) size = 'normaal';
  _einkSet(EINK_SIZE_KEY, size);
  applyEinkMode();
  if (einkIsActive()) einkRefresh();
  if (typeof renderContent === 'function' && document.getElementById('content')) {
    try { renderContent(); } catch (e) {}
  }
}

// ── Scherm verversen ─────────────────────────────────────────────
// E-ink werkt met partiële updates; na veel scrollen en openen van
// vensters blijft er een grijze waas van vorige beelden staan. Eén
// keer volledig zwart en dan volledig wit dwingt de controller tot
// een complete refresh, waarmee die waas verdwijnt.
function einkRefresh() {
  if (document.querySelector('.eink-flash')) return;
  const el = document.createElement('div');
  el.className = 'eink-flash';
  document.body.appendChild(el);
  setTimeout(() => { el.style.background = '#ffffff'; }, 200);
  setTimeout(() => { el.remove(); }, 450);
}

// ── Tijdelijk uitschakelen tijdens renderen naar PDF ─────────────
// De factuur-PDF wordt met html2canvas gerasterd vanuit een verborgen
// div IN de levende pagina (zie js/email.js). Zou het e-inkthema dan
// aanstaan, dan zou de verzonden factuur zwart-wit en zonder opmaak
// naar de klant gaan. Daarom de klasse even weghalen en daarna
// herstellen; het resultaat is identiek met en zonder e-inkmodus.
async function einkWithoutMode(fn) {
  const root = document.documentElement;
  const was = root.classList.contains('eink');
  if (was) root.classList.remove('eink');
  try {
    return await fn();
  } finally {
    if (was) root.classList.add('eink');
  }
}

// ── URL-parameter (?eink=1 / ?eink=0) ────────────────────────────
(function einkInitFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search).get('eink');
    if (p === '1' || p === 'aan' || p === 'true')  _einkSet(EINK_MODE_KEY, 'aan');
    if (p === '0' || p === 'uit' || p === 'false') _einkSet(EINK_MODE_KEY, 'uit');
  } catch (e) {}
})();

// Direct toepassen (script staat in de <head>, dus vóór de eerste paint).
applyEinkMode();

// De knop in de topbalk bestaat pas na het parsen van de body.
document.addEventListener('DOMContentLoaded', _einkSyncButton);

// Ctrl+Shift+E — snel schakelen met een aangekoppeld toetsenbord.
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
    e.preventDefault();
    toggleEinkMode();
  }
});
