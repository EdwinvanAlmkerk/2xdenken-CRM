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
  if (!DB.agenda)       DB.agenda       = [];

  const totaalBetaald  = DB.facturen.filter(f => f.status === 'betaald').reduce((s, f) => s + (f.totaal || 0), 0);
  const openFacturen   = DB.facturen.filter(f => f.status === 'verzonden').length;
  const recentDossiers = [...DB.dossiers].sort((a, b) => new Date(b.datum) - new Date(a.datum)).slice(0, 6);
  const vandaag = new Date().toISOString().slice(0, 10);
  const komendeAfspraken = DB.agenda.filter(a => a.datum >= vandaag).sort((a, b) => a.datum.localeCompare(b.datum) || (a.beginTijd || '').localeCompare(b.beginTijd || '')).slice(0, 5);
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
    <div class="grid-2" style="margin-bottom:24px">
      <div class="card">
        <div class="card-header">
          <h3>${svgIcon('calendar', 16)} Komende afspraken</h3>
          <button class="btn btn-secondary btn-sm" onclick="navigate('agenda')">Alle afspraken</button>
        </div>
        <div class="card-body">
          ${komendeAfspraken.length === 0
            ? `<div class="empty-state">${svgIcon('calendar', 36)}<p>Geen komende afspraken</p></div>`
            : `<div style="display:flex;flex-direction:column;gap:10px">${komendeAfspraken.map(a => {
                const school = a.schoolId ? DB.scholen.find(s => s.id === a.schoolId) : null;
                const tijdStr = a.beginTijd ? fmtTijd(a.beginTijd) : 'Hele dag';
                const isVandaag = a.datum === vandaag;
                return `<div style="display:flex;gap:12px;align-items:flex-start;padding:8px 12px;border-radius:8px;background:${isVandaag ? 'var(--mint1)' : 'var(--bg)'}; cursor:pointer" onclick="openAgendaModal('${a.id}')">
                  <div style="min-width:60px;text-align:center">
                    <div style="font-size:11px;color:var(--ink3)">${isVandaag ? 'Vandaag' : fmtDateShort(a.datum)}</div>
                    <div style="font-size:13px;font-weight:700;color:var(--navy)">${tijdStr}</div>
                  </div>
                  <div style="flex:1">
                    <div style="font-weight:600;font-size:14px">${esc(a.titel)}</div>
                    <div style="font-size:12px;color:var(--ink3)">
                      ${agendaBadge(a.type)}
                      ${school ? `<span style="margin-left:6px">${svgIcon('school', 12)} ${esc(school.naam)}</span>` : ''}
                      ${a.locatie ? `<span style="margin-left:6px">${svgIcon('location', 12)} ${esc(a.locatie)}</span>` : ''}
                    </div>
                  </div>
                </div>`;
              }).join('')}</div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Recente dossiernotities</h3></div>
        <div class="card-body">
          ${recentDossiers.length === 0
            ? `<div class="empty-state">${svgIcon('note', 36)}<p>Nog geen notities</p></div>`
            : `<div class="dossier-list">${recentDossiers.map(d => renderDossierItem(d)).join('')}</div>`}
        </div>
      </div>
    </div>`;
}
