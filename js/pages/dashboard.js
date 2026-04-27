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

  const huidigJaar = String(new Date().getFullYear());
  const facturenLopendJaar = DB.facturen.filter(f => getFactuurJaar(f) === huidigJaar);
  const totaalFacturenLopendJaar = facturenLopendJaar.reduce((s, f) => s + (Number(f.totaal) || 0), 0);
  const openFacturen   = facturenLopendJaar.filter(f => f.status === 'verzonden').length;
  const recentDossiers = [...DB.dossiers].sort((a, b) => new Date(b.datum) - new Date(a.datum)).slice(0, 6);
  const vandaag = new Date().toISOString().slice(0, 10);
  if (DB.outlookSettings?.icsUrl && !_outlookFetchedOnce && !_outlookLoading) {
    if (_outlookEvents.length === 0) {
      const cached = _loadOutlookCache();
      if (cached) _outlookEvents = cached;
    }
    fetchOutlookEvents();
  }
  const afsprakenVandaag = [...DB.agenda, ..._outlookEvents]
    .filter(a => a.datum === vandaag)
    .sort((a, b) => (a.beginTijd || '').localeCompare(b.beginTijd || ''));
  const now     = new Date();
  const greeting = now.getHours() < 12 ? 'Goedemorgen' : now.getHours() < 17 ? 'Goedemiddag' : 'Goedenavond';
  const naam    = currentUser?.name || 'daar';

  const stats = [
    ['si-orange', 'board',    DB.besturen.length,   'Besturen'],
    ['si-blue',   'school',   DB.scholen.length,    'Scholen'],
    ['si-green',  'contact',  DB.contacten.length,  'Contactpersonen'],
    ['si-gold',   'training', DB.trainingen.length, 'Trainingen'],
    ['si-green',  'euro',     fmtEuro(totaalFacturenLopendJaar), `Facturen ${huidigJaar}`],
    ['si-orange', 'invoice',  openFacturen,         'Open facturen'],
  ];

  return `
    <div class="welcome-banner">
      <div class="welcome-text">
        <h2>${greeting}, ${esc(naam)}! ♥</h2>
        <p>Hier is een overzicht van jouw CRM — coaching, training en advies met ♥ voor onderwijs</p>
      </div>
      ${(naam.toLowerCase().includes('jorieke') || (currentUser?.email || '').toLowerCase().includes('jorieke')) ? `<img src="img/jorieke.jpg" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid rgba(26,184,184,0.3);flex-shrink:0;position:relative;z-index:1"/>` : ''}
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
          <h3>${svgIcon('calendar', 16)} Afspraken vandaag</h3>
          <button class="btn btn-secondary btn-sm" onclick="navigate('agenda')">Alle afspraken</button>
        </div>
        <div class="card-body">
          ${afsprakenVandaag.length === 0
            ? `<div class="empty-state">${svgIcon('calendar', 36)}<p>Geen afspraken vandaag</p></div>`
            : `<div style="display:flex;flex-direction:column;gap:10px">${afsprakenVandaag.map(a => {
                const school = getSchool(a.schoolId);
                const tijdStr = a.beginTijd ? fmtTijd(a.beginTijd) : 'Hele dag';
                const eindStr = a.eindTijd ? fmtTijd(a.eindTijd) : '';
                return `<div style="display:flex;gap:12px;align-items:flex-start;padding:8px 12px;border-radius:8px;background:var(--mint1); cursor:pointer" onclick="openAgendaItem('${a.id}')">
                  <div style="min-width:70px;text-align:center">
                    <div style="font-size:13px;font-weight:700;color:var(--navy)">${tijdStr}</div>
                    ${eindStr ? `<div style="font-size:11px;color:var(--ink3)">tot ${eindStr}</div>` : ''}
                  </div>
                  <div style="flex:1">
                    <div style="font-weight:600;font-size:14px">${esc(a.titel)}</div>
                    <div style="font-size:12px;color:var(--ink3)">
                      ${a.type === '__outlook__' ? '<span class="badge" style="background:#E6EAF2;color:var(--navy)">Extern</span>' : agendaBadge(a.type)}
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
