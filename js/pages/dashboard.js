// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════
function renderDashboard() {
  if (!DB.trainingen)   DB.trainingen   = [];
  if (!DB.uitvoeringen) DB.uitvoeringen = [];
  if (!DB.besturen)     DB.besturen     = [];
  if (!DB.scholen)      DB.scholen      = [];
  if (!DB.contacten)    DB.contacten    = [];
  if (!DB.dossiers)     DB.dossiers     = [];
  if (!DB.facturen)     DB.facturen     = [];

  const totaalBetaald  = DB.facturen.filter(f => f.status === 'betaald').reduce((s, f) => s + (f.totaal || 0), 0);
  const openFacturen   = DB.facturen.filter(f => f.status === 'verzonden').length;
  const recentDossiers = [...DB.dossiers].sort((a, b) => new Date(b.datum) - new Date(a.datum)).slice(0, 6);
  const now     = new Date();
  const greeting = now.getHours() < 12 ? 'Goedemorgen' : now.getHours() < 17 ? 'Goedemiddag' : 'Goedenavond';
  const naam    = currentUser?.name || 'daar';

  const stats = [
    ['si-orange', 'board',    DB.besturen.length,   'Besturen'],
    ['si-blue',   'school',   DB.scholen.length,    'Scholen'],
    ['si-green',  'contact',  DB.contacten.length,  'Contactpersonen'],
    ['si-gold',   'training', DB.trainingen.length, 'Trainingen'],
    ['si-green',  'euro',     fmtEuro(totaalBetaald), 'Ontvangen'],
    ['si-orange', 'invoice',  openFacturen,         'Open facturen'],
  ];

  return `
    <div class="welcome-banner">
      <div class="welcome-text">
        <h2>${greeting}, ${esc(naam)}! ♥</h2>
        <p>Hier is een overzicht van jouw CRM — coaching, training en advies met ♥ voor onderwijs</p>
      </div>
    </div>
    <div class="grid-3" style="margin-bottom:24px">
      ${stats.map(([cls, icon, val, lbl]) => `
        <div class="stat-card">
          <div class="stat-icon ${cls}">${svgIcon(icon, 22)}</div>
          <div><div class="stat-value">${esc(String(val))}</div><div class="stat-label">${esc(lbl)}</div></div>
        </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-header"><h3>Recente dossiernotities</h3></div>
      <div class="card-body">
        ${recentDossiers.length === 0
          ? `<div class="empty-state">${svgIcon('note', 36)}<p>Nog geen notities</p></div>`
          : `<div class="dossier-list">${recentDossiers.map(d => renderDossierItem(d)).join('')}</div>`}
      </div>
    </div>`;
}
