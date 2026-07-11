// ════════════════════════════════════════════════════════════════
// ROUTER — Navigatie & Render dispatcher
// ════════════════════════════════════════════════════════════════

let page = 'dashboard', pageParam = null, contactParam = null;
let schoolTab = 'info';
let bestuurTab = 'scholen';
let trainingTab = 'info';
let contactTab = 'info';

const PAGE_LABELS = {
  dashboard: 'Dashboard', agenda: 'Agenda', taken: 'Taken', email: 'E-mail', rss: 'Nieuws & RSS',
  besturen: 'Besturen', 'bestuur-detail': 'Bestuur',
  scholen: 'Scholen', 'school-detail': 'School', contacten: 'Alle contacten', 'contact-detail': 'Contactpersoon',
  facturen: 'Facturen', omzet: 'Omzet overzicht',
  inkoopfacturen: 'Inkoopfacturen', 'kosten-overzicht': 'Kosten overzicht',
  trainingen: 'Trainingen & Werkvormen', 'training-detail': 'Training',
  'training-analyse': 'Analyse trainingen & werkvormen',
  instellingen: 'Instellingen'
};

const NAV_ITEMS = [
  { section: 'Overzicht' },
  { id: 'dashboard',    label: 'Dashboard',              icon: 'board' },
  { id: 'agenda',       label: 'Agenda',                 icon: 'calendar' },
  { id: 'taken',        label: 'Taken',                  icon: 'board' },
  { id: 'email',        label: 'E-mail',                 icon: 'mail' },
  { id: 'rss',          label: 'Nieuws',                 icon: 'note' },
  { id: 'besturen',     label: 'Besturen',               icon: 'board',    also: ['bestuur-detail'] },
  { id: 'scholen',      label: 'Scholen',                icon: 'school',   also: ['school-detail'] },
  { id: 'contacten',    label: 'Contacten',              icon: 'contact',  also: ['contact-detail'] },
  { section: 'Programma' },
  { id: 'trainingen',   label: 'Trainingen & Werkvormen',  icon: 'training', also: ['training-detail'] },
  { id: 'training-analyse', label: 'Analyse',              icon: 'board' },
  { section: 'Financieel' },
  { id: 'facturen',         label: 'Facturen',           icon: 'invoice' },
  { id: 'inkoopfacturen',   label: 'Inkoopfacturen',     icon: 'invoice' },
  { id: 'omzet',            label: 'Omzet overzicht',    icon: 'euro' },
  { id: 'kosten-overzicht', label: 'Kosten overzicht',   icon: 'euro' },
  { section: 'Beheer' },
  { id: 'instellingen', label: 'Instellingen',           icon: 'settings' },
];

function navigate(p, param = null) {
  page = p; pageParam = param;
  if (p === 'school-detail')    schoolTab   = 'info';
  if (p === 'bestuur-detail')   bestuurTab  = 'scholen';
  if (p === 'training-detail')  trainingTab = 'info';
  if (p === 'contact-detail')   contactTab  = 'info';
  document.getElementById('topbar-title').textContent = PAGE_LABELS[p] || p;
  const isDetail = p.endsWith('-detail');
  document.getElementById('back-btn').style.display = isDetail ? '' : 'none';
  if (typeof closeSidebar === 'function') closeSidebar();
  renderNav();
  renderContent();
}

function navigateToContact(schoolId, contactId) {
  page = 'contact-detail';
  pageParam = schoolId;
  contactParam = contactId;
  contactTab = 'info';
  document.getElementById('topbar-title').textContent = PAGE_LABELS['contact-detail'];
  document.getElementById('back-btn').style.display = '';
  if (typeof closeSidebar === 'function') closeSidebar();
  renderNav();
  renderContent();
}

function goBack() {
  if (page === 'bestuur-detail')       navigate('besturen');
  else if (page === 'school-detail')   navigate('scholen');
  else if (page === 'contact-detail')  navigate('contacten');
  else if (page === 'training-detail') navigate('trainingen');
  else navigate('dashboard');
}

function renderNav() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = NAV_ITEMS.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    const active = page === item.id || (item.also || []).includes(page);
    return `<div class="nav-item${active ? ' active' : ''}" onclick="navigate('${item.id}')">
      ${svgIcon(item.icon, 18)} <span>${item.label}</span>
    </div>`;
  }).join('');
}

function renderContent() {
  ensureIndexes();
  const c = document.getElementById('content');
  if      (page === 'dashboard')       c.innerHTML = renderDashboard();
  else if (page === 'agenda')          c.innerHTML = renderAgendaPage();
  else if (page === 'taken')           c.innerHTML = renderTakenPage();
  else if (page === 'email')           c.innerHTML = renderEmailPage();
  else if (page === 'rss')             c.innerHTML = renderRssPage();
  else if (page === 'besturen')        c.innerHTML = renderBesturen(_bestuurSearch || '');
  else if (page === 'bestuur-detail')  c.innerHTML = renderBestuurDetail(pageParam);
  else if (page === 'scholen')         c.innerHTML = renderScholen(_scholenSearch || '');
  else if (page === 'school-detail')   c.innerHTML = renderSchoolDetail(pageParam);
  else if (page === 'contacten')       c.innerHTML = renderContacten(_contactenSearch || '');
  else if (page === 'contact-detail')  c.innerHTML = renderContactDetail(pageParam, contactParam);
  else if (page === 'facturen')        c.innerHTML = renderFacturenPage(_factuurSearch || '');
  else if (page === 'omzet')           c.innerHTML = renderOmzetPage();
  else if (page === 'inkoopfacturen')  c.innerHTML = renderInkoopfacturenPage(_inkoopSearch || '');
  else if (page === 'kosten-overzicht') c.innerHTML = renderKostenOverzichtPage();
  else if (page === 'trainingen')      c.innerHTML = renderTrainingenPage();
  else if (page === 'training-detail') c.innerHTML = renderTrainingDetail(pageParam);
  else if (page === 'training-analyse') c.innerHTML = renderTrainingAnalysePage();
  else if (page === 'instellingen')    c.innerHTML = renderInstellingen();
  enhanceResizableTables();
}

function setSchoolTab(id, tab)    { schoolTab   = tab; renderContent(); }
function setBestuurTab(id, tab)   { bestuurTab  = tab; renderContent(); }
function setTrainingTab(id, tab)  { trainingTab = tab; renderContent(); }
function setContactTab(schoolId, contactId, tab) { contactTab = tab; renderContent(); }
