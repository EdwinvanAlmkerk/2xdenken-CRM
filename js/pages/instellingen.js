// ════════════════════════════════════════════════════════════════
// INSTELLINGEN — Tab-gebaseerde compacte layout
// ════════════════════════════════════════════════════════════════

let _instellingenTab = prefGet('instellingen.tab', 'categorieen'); // 'categorieen' | 'email' | 'agenda' | 'backup'

function setInstellingenTab(t) {
  _instellingenTab = t;
  prefSet('instellingen.tab', t);
  renderContent();
}

function renderInstellingen() {
  ensureTrainingTypes();
  ensureTrainingCategories();
  if (typeof ensureKostenTypes === 'function') ensureKostenTypes();

  const tabs = [
    ['categorieen', `${svgIcon('list', 14)} Categorieën`],
    ['email',       `${svgIcon('mail', 14)} E-mail`],
    ['agenda',      `${svgIcon('calendar', 14)} Agenda`],
    ['backup',      `${svgIcon('download', 14)} Backup`],
  ];

  let body = '';
  if (_instellingenTab === 'categorieen')   body = renderInstellingenCategorieen();
  else if (_instellingenTab === 'email')    body = renderInstellingenEmail();
  else if (_instellingenTab === 'agenda')   body = renderInstellingenAgenda();
  else if (_instellingenTab === 'backup')   body = renderInstellingenBackup();
  else { _instellingenTab = 'categorieen'; body = renderInstellingenCategorieen(); }

  return `
    <div style="max-width:1180px">
      <div class="tabs" style="margin-bottom:16px">
        ${tabs.map(([k, l]) => `<div class="tab${_instellingenTab === k ? ' active' : ''}" onclick="setInstellingenTab('${k}')">${l}</div>`).join('')}
      </div>
      ${body}
    </div>`;
}

// ── Tab: Categorieën (3 type-tabellen naast elkaar) ─────────────
function renderInstellingenCategorieen() {
  const typeCard = (title, icon, addLabel, addFn, list, gebruikCount, openFn, delFn) => `
    <div class="card">
      <div class="card-header">
        <h3>${svgIcon(icon, 16)} ${esc(title)}</h3>
        <button class="btn btn-primary btn-sm" onclick="${addFn}()" title="${esc(addLabel)}">${svgIcon('add', 14)}</button>
      </div>
      <div class="card-body" style="padding:0">
        <table>
          <thead><tr><th>Naam</th><th style="width:90px">Kleur</th><th style="width:50px;text-align:center">#</th><th style="width:70px"></th></tr></thead>
          <tbody>
            ${list.length === 0
              ? `<tr><td colspan="4"><div class="empty-state" style="padding:18px;font-size:12.5px"><p>Nog geen items</p></div></td></tr>`
              : list.map(t => {
                  const k = AGENDA_KLEUREN[t.kleur] || AGENDA_KLEUREN.navy;
                  const aantal = gebruikCount(t);
                  return `<tr>
                    <td style="font-weight:600">${esc(t.naam)}</td>
                    <td><span class="badge ${k.badge}">${esc(AGENDA_KLEUR_LABELS[t.kleur] || t.kleur)}</span></td>
                    <td style="text-align:center;color:var(--navy3)">${aantal}</td>
                    <td>
                      <div class="row-actions">
                        <button class="btn btn-ghost btn-icon btn-sm" title="Bewerken" onclick="${openFn}('${t.id}')">${svgIcon('edit', 14)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="${delFn}('${t.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const kostenTypesList = typeof getKostenTypeList === 'function' ? getKostenTypeList() : (DB.kostenTypes || []);
  return `
    <div class="grid-2" style="margin-bottom:14px">
      ${typeCard(
        'Trainingtypes', 'training', 'Type toevoegen',
        'openTrainingTypeModal', getTrainingTypeList(),
        t => DB.trainingen.filter(tr => (tr.type || 'training') === t.id).length,
        'openTrainingTypeModal', 'delTrainingType'
      )}
      ${typeCard(
        'Trainingscategorieën', 'training', 'Categorie toevoegen',
        'openTrainingCategoryModal', getTrainingCategoryList(),
        t => DB.trainingen.filter(tr => (tr.categorie || 'algemeen') === t.id).length,
        'openTrainingCategoryModal', 'delTrainingCategory'
      )}
    </div>
    <div class="grid-2">
      ${typeCard(
        'Agendatypes', 'calendar', 'Type toevoegen',
        'openAgendaTypeModal', DB.agendaTypes,
        t => DB.agenda.filter(a => a.type === t.id).length,
        'openAgendaTypeModal', 'delAgendaType'
      )}
      ${typeCard(
        'Kostentypes', 'invoice', 'Kostentype toevoegen',
        'openKostenTypeModal', kostenTypesList,
        t => (DB.inkoopfacturen || []).filter(f => f.kostenTypeId === t.id).length,
        'openKostenTypeModal', 'delKostenType'
      )}
    </div>
    <div class="grid-2" style="margin-top:14px">
      ${typeCard(
        'Taaktypes', 'board', 'Taaktype toevoegen',
        'openTaakTypeModal', (typeof getTaakTypeList === 'function' ? getTaakTypeList() : (DB.taakTypes || [])),
        t => (DB.taken || []).filter(tk => tk.taakTypeId === t.id).length,
        'openTaakTypeModal', 'delTaakType'
      )}
    </div>`;
}

// ── Kostentype-modal (identiek patroon aan training-type modal) ───
function openKostenTypeModal(id = '') {
  if (typeof ensureKostenTypes === 'function') ensureKostenTypes();
  const list = typeof getKostenTypeList === 'function' ? getKostenTypeList() : (DB.kostenTypes || []);
  const t = id ? list.find(x => x.id === id) : null;
  const kleurOpties = Object.entries(AGENDA_KLEUR_LABELS).map(([val, label]) => {
    const k = AGENDA_KLEUREN[val];
    return `<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;border:2px solid ${(t?.kleur || 'navy') === val ? 'var(--navy)' : 'var(--bg3)'};background:${(t?.kleur || 'navy') === val ? 'var(--bg)' : 'white'}">
      <input type="radio" name="kostentypekleur" value="${val}" ${(t?.kleur || 'navy') === val ? 'checked' : ''} style="display:none" onclick="document.querySelectorAll('#kostentype-kleur-grid label').forEach(l=>{l.style.borderColor='var(--bg3)';l.style.background='white'});this.closest('label').style.borderColor='var(--navy)';this.closest('label').style.background='var(--bg)'">
      <span class="badge ${k.badge}">${esc(label)}</span>
    </label>`;
  }).join('');

  showModal(t ? 'Kostentype bewerken' : 'Nieuw kostentype',
    `<div class="form-group"><label>Naam *</label><input type="text" id="f-kostentypename" value="${esc(t?.naam || '')}" placeholder="Bijv. Reiskosten, Materiaal, Hosting…"/></div>
     <div class="form-group">
       <label>Kleur</label>
       <div id="kostentype-kleur-grid" style="display:flex;gap:8px;flex-wrap:wrap">${kleurOpties}</div>
       <select id="f-kostentypekleur" style="display:none"><option value="${esc(t?.kleur || 'navy')}">${esc(t?.kleur || 'navy')}</option></select>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${t ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delKostenType('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="document.getElementById('f-kostentypekleur').value=document.querySelector('input[name=kostentypekleur]:checked')?.value||'navy';saveKostenType('${id}')">${t ? 'Opslaan' : 'Toevoegen'}</button>`);
}

// ── Tab: E-mail (templates + server) ────────────────────────────
function renderInstellingenEmail() {
  return `
    <div style="max-width:780px;display:flex;flex-direction:column;gap:16px">
      <div class="card">
        <div class="card-header">
          <h3>${svgIcon('mail', 16)} E-mailtemplates</h3>
          <button class="btn btn-primary btn-sm" onclick="openEmailTemplateModal()">${svgIcon('add', 14)} Template toevoegen</button>
        </div>
        <div class="card-body" style="padding:0">
          <table>
            <thead><tr><th>Naam</th><th>Categorie</th><th>Onderwerp</th><th style="width:80px"></th></tr></thead>
            <tbody>
              ${DB.emailTemplates.length === 0
                ? `<tr><td colspan="4"><div class="empty-state" style="padding:20px"><p>Geen e-mailtemplates</p></div></td></tr>`
                : DB.emailTemplates.map(t => `<tr>
                    <td style="font-weight:600">${esc(t.naam)}</td>
                    <td><span class="badge badge-verzonden">${esc(t.categorie)}</span></td>
                    <td style="font-size:13px;color:var(--navy3);max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.onderwerp)}</td>
                    <td>
                      <div class="row-actions">
                        <button class="btn btn-ghost btn-icon btn-sm" title="Bewerken" onclick="openEmailTemplateModal('${t.id}')">${svgIcon('edit', 14)}</button>
                        <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delEmailTemplate('${t.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                      </div>
                    </td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>${svgIcon('settings', 16)} E-mailserver (IMAP/SMTP)</h3></div>
        <div class="card-body">
          ${DB.emailSettings?.imapHost ? `<div style="margin-bottom:16px;padding:10px 14px;background:var(--s-groen-s);border:1px solid rgba(22,163,74,0.2);border-radius:var(--r);font-size:13px;color:var(--groen);display:flex;align-items:center;gap:8px">
            ${svgIcon('lightning', 14)} Verbonden met <strong>${esc(DB.emailSettings.emailUser)}</strong> via ${esc(DB.emailSettings.imapHost)}
          </div>` : `<div style="margin-bottom:16px;padding:10px 14px;background:var(--s-goud-s);border:1px solid rgba(217,119,6,0.2);border-radius:var(--r);font-size:13px;color:var(--geel);display:flex;align-items:center;gap:8px">
            ${svgIcon('lightning', 14)} Nog niet geconfigureerd — vul de gegevens hieronder in
          </div>`}
          <div class="form-row">
            <div class="form-group"><label>IMAP Server *</label><input type="text" id="f-imap-host" value="${esc(DB.emailSettings?.imapHost || '')}" placeholder="imap.gmail.com"/></div>
            <div class="form-group"><label>IMAP Poort</label><input type="text" inputmode="numeric" id="f-imap-port" value="${DB.emailSettings?.imapPort || 993}" placeholder="993"/></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>SMTP Server *</label><input type="text" id="f-smtp-host" value="${esc(DB.emailSettings?.smtpHost || '')}" placeholder="smtp.gmail.com"/></div>
            <div class="form-group"><label>SMTP Poort</label><input type="text" inputmode="numeric" id="f-smtp-port" value="${DB.emailSettings?.smtpPort || 587}" placeholder="587"/></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>E-mailadres (login) *</label><input type="email" id="f-email-user" value="${esc(DB.emailSettings?.emailUser || '')}" placeholder="jorieke@2xdenken.nl"/></div>
            <div class="form-group"><label>Wachtwoord / App-wachtwoord</label><input type="password" id="f-email-pass" value="${esc(DB.emailSettings?.emailPass || '')}" placeholder="••••••••"/></div>
          </div>
          <div class="form-group"><label>Afzendernaam (optioneel)</label><input type="text" id="f-email-from" value="${esc(DB.emailSettings?.emailFrom || '')}" placeholder="Jorieke — 2xDenken"/></div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary" onclick="saveEmailSettings()">${svgIcon('settings', 14)} Opslaan</button>
          </div>
          <div style="margin-top:14px;font-size:11.5px;color:var(--navy4);line-height:1.6">
            <strong>Tip:</strong> Bij Gmail of Microsoft 365 met tweestapsverificatie heb je een <em>app-wachtwoord</em> nodig, niet je gewone wachtwoord.
            Ga naar je Google/Microsoft accountinstellingen om er een aan te maken.
          </div>
        </div>
      </div>
    </div>`;
}

// ── Tab: Agenda (ICS-feed) ──────────────────────────────────────
function renderInstellingenAgenda() {
  const feedUrl = `${SUPA_URL}/functions/v1/agenda-feed?token=${DB.feedToken || ''}`;
  const webcalUrl = feedUrl.replace(/^https?:\/\//, 'webcal://');
  return `
    <div style="max-width:780px">
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><h3>${svgIcon('calendar', 16)} Agenda op je telefoon (abonnement)</h3></div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--navy3);line-height:1.55;margin-bottom:14px">Abonneer je iPhone (of andere agenda-app zoals Easy Calendar) op deze feed om je CRM-<strong>afspraken</strong> en <strong>ingeplande taken</strong> automatisch op je telefoon te zien. Alleen-lezen en ververst periodiek. <strong>Houd deze link privé</strong> — iedereen met de link kan de agenda inzien.</p>
          ${DB.feedToken ? `
            <div class="form-group">
              <label>Jouw persoonlijke feed-URL</label>
              <div style="display:flex;gap:8px">
                <input type="text" readonly value="${esc(webcalUrl)}" onclick="this.select()" style="flex:1;font-size:12px;color:var(--navy3)"/>
                <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${webcalUrl}').then(()=>showToast('Feed-URL gekopieerd','success')).catch(()=>showToast('Kopiëren mislukt — selecteer en kopieer handmatig','error'))">${svgIcon('add', 14)} Kopieer</button>
              </div>
            </div>
            <div style="margin-top:8px;font-size:11.5px;color:var(--navy4);line-height:1.7">
              <strong>Op je iPhone toevoegen (eenmalig):</strong>
              <ol style="margin:6px 0 0 18px;padding:0">
                <li>Kopieer de URL hierboven</li>
                <li>iPhone: <strong>Instellingen → Agenda → Accounts → Nieuw account → Andere</strong></li>
                <li>Tik op <strong>Abonnementsagenda</strong>, plak de URL, tik <strong>Volgende</strong> → <strong>Bewaar</strong></li>
              </ol>
              Daarna verschijnt de agenda in <strong>Easy Calendar</strong> en elke andere agenda-app op je telefoon.
            </div>
          ` : `<div style="padding:10px 14px;background:var(--s-goud-s);border:1px solid rgba(217,119,6,0.2);border-radius:var(--r);font-size:13px;color:var(--geel)">Feed nog niet geladen — ververs de pagina (Ctrl+F5) en probeer opnieuw.</div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>${svgIcon('calendar', 16)} Externe agenda tonen in CRM (inkomend)</h3></div>
        <div class="card-body">
          ${DB.outlookSettings?.icsUrl ? `<div style="margin-bottom:16px;padding:10px 14px;background:var(--s-groen-s);border:1px solid rgba(22,163,74,0.2);border-radius:var(--r);font-size:13px;color:var(--groen);display:flex;align-items:center;gap:8px">
            ${svgIcon('lightning', 14)} Gekoppeld${DB.outlookSettings.calendarName ? ` — kalender: <strong>${esc(DB.outlookSettings.calendarName)}</strong>` : ''}
          </div>` : `<div style="margin-bottom:16px;padding:10px 14px;background:var(--s-goud-s);border:1px solid rgba(217,119,6,0.2);border-radius:var(--r);font-size:13px;color:var(--geel);display:flex;align-items:center;gap:8px">
            ${svgIcon('lightning', 14)} Nog niet geconfigureerd — plak de gepubliceerde ICS-URL hieronder
          </div>`}
          <div class="form-group">
            <label>ICS URL *</label>
            <input type="url" id="f-outlook-url" value="${esc(DB.outlookSettings?.icsUrl || '')}" placeholder="webcal://p##-caldav.icloud.com/published/..."/>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Dagen terug tonen</label><input type="number" inputmode="numeric" id="f-outlook-past" value="${DB.outlookSettings?.daysPast ?? 30}" min="0" max="3650"/></div>
            <div class="form-group"><label>Dagen vooruit tonen</label><input type="number" inputmode="numeric" id="f-outlook-future" value="${DB.outlookSettings?.daysFuture ?? 180}" min="0" max="3650"/></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary" onclick="saveOutlookSettings()">${svgIcon('settings', 14)} Opslaan</button>
            ${DB.outlookSettings?.icsUrl ? `<button class="btn btn-secondary" onclick="testOutlookConnection()">${svgIcon('lightning', 14)} Test verbinding</button>` : ''}
          </div>
          <div style="margin-top:14px;font-size:11.5px;color:var(--navy4);line-height:1.6">
            <strong>ICS-URL ophalen uit iCloud:</strong>
            <ol style="margin:6px 0 0 18px;padding:0">
              <li>Ga naar <a href="https://www.icloud.com/calendar" target="_blank" style="color:var(--accent)">icloud.com/calendar</a> en log in</li>
              <li>Klik op het <em>Share</em>-icoon (📡) naast de agenda die je wilt koppelen</li>
              <li>Vink <strong>"Public Calendar"</strong> aan</li>
              <li>Kopieer de <code>webcal://...</code> URL en plak hier</li>
            </ol>
            <br>
            <strong>Ook ondersteund:</strong> iedere openbare iCalendar-feed (Outlook, Google Agenda, etc.) die eindigt op <code>.ics</code> of begint met <code>webcal://</code>.
            <br><br>
            <strong>Beperkingen:</strong> de feed ververst afhankelijk van de bron elke ~1 uur, dus nieuwe afspraken kunnen een tijdje duren voor ze in de CRM verschijnen. Herhalende afspraken worden alleen op de originele datum getoond (geen RRULE expansion). De koppeling is <strong>alleen-lezen</strong> — wijzigingen in de CRM worden niet teruggeschreven.
          </div>
        </div>
      </div>
    </div>`;
}

// ── Tab: Backup ─────────────────────────────────────────────────
// Periode-state. Niet persistent — gebruiker kiest steeds opnieuw.
let _backupPreset    = '12months';   // '12months' | 'thisyear' | 'lastyear' | '3years' | 'all' | 'custom'
let _backupFromDate  = '';
let _backupToDate    = '';
let _backupExportXlsx = true;
let _backupExportJson = true;

function setBackupPreset(p) {
  _backupPreset = p;
  // Bij 'custom' tonen we velden; anders berekenen we direct.
  if (p === 'custom') {
    if (!_backupFromDate || !_backupToDate) {
      const { from, to } = _backupComputePeriod('12months');
      _backupFromDate = from;
      _backupToDate = to;
    }
  }
  renderContent();
}
function setBackupFromDate(v) { _backupFromDate = v; }
function setBackupToDate(v)   { _backupToDate = v; }
function setBackupFormat(fmt, on) {
  if (fmt === 'xlsx') _backupExportXlsx = !!on;
  if (fmt === 'json') _backupExportJson = !!on;
}

function _backupComputePeriod(preset = _backupPreset) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  switch (preset) {
    case 'thisyear': return { from: `${now.getFullYear()}-01-01`, to: today };
    case 'lastyear': {
      const y = now.getFullYear() - 1;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    case '3years': {
      const d = new Date(now); d.setFullYear(d.getFullYear() - 3);
      return { from: d.toISOString().slice(0, 10), to: today };
    }
    case '12months': {
      const d = new Date(now); d.setMonth(d.getMonth() - 12);
      return { from: d.toISOString().slice(0, 10), to: today };
    }
    case 'all':    return { from: '', to: '' };
    case 'custom': return { from: _backupFromDate, to: _backupToDate };
    default:       return { from: '', to: '' };
  }
}

function renderInstellingenBackup() {
  const { from, to } = _backupComputePeriod();
  const presetLabel = (k, l) => `<label class="qa-preset" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:6px;cursor:pointer;border:1px solid ${_backupPreset === k ? 'var(--accent)' : 'rgba(30,45,74,0.12)'};background:${_backupPreset === k ? 'rgba(26,184,184,0.10)' : 'white'};font-size:12.5px;font-weight:${_backupPreset === k ? '600' : '500'};color:${_backupPreset === k ? 'var(--accent)' : 'var(--navy3)'}">
    <input type="radio" name="bkp-preset" value="${k}" ${_backupPreset === k ? 'checked' : ''} onchange="setBackupPreset('${k}')" style="display:none"/>
    ${esc(l)}
  </label>`;

  // Aantallen die in deze periode mee zouden gaan (live preview)
  const counts = _backupCounts(from, to);

  return `
    <div style="max-width:780px">
      <div class="card">
        <div class="card-header">
          <h3>${svgIcon('download', 16)} Systeembackup</h3>
        </div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--navy3);margin-bottom:14px;line-height:1.5">
            Exporteer al je CRM-data voor archivering of inzage. <strong>Excel</strong> is leesbaar buiten het systeem (één tabblad per soort), <strong>JSON</strong> bevat de complete ruwe data en is geschikt voor een eventuele restore.
          </p>

          <div class="form-group">
            <label>Periode</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${presetLabel('12months', 'Laatste 12 maanden')}
              ${presetLabel('thisyear', 'Dit jaar')}
              ${presetLabel('lastyear', 'Vorig jaar')}
              ${presetLabel('3years', 'Laatste 3 jaar')}
              ${presetLabel('all', 'Alles')}
              ${presetLabel('custom', 'Eigen periode…')}
            </div>
          </div>

          ${_backupPreset === 'custom' ? `
            <div class="form-row">
              <div class="form-group"><label>Van</label><input type="date" id="f-bkp-from" value="${esc(_backupFromDate)}" onchange="setBackupFromDate(this.value)"/></div>
              <div class="form-group"><label>Tot en met</label><input type="date" id="f-bkp-to" value="${esc(_backupToDate)}" onchange="setBackupToDate(this.value)"/></div>
            </div>` : ''}

          <div class="form-group">
            <label>Formaat</label>
            <div style="display:flex;gap:14px;flex-wrap:wrap">
              <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
                <input type="checkbox" id="f-bkp-xlsx" ${_backupExportXlsx ? 'checked' : ''} onchange="setBackupFormat('xlsx', this.checked)"/>
                Excel (.xlsx) — leesbaar in Excel/Numbers/Sheets
              </label>
              <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
                <input type="checkbox" id="f-bkp-json" ${_backupExportJson ? 'checked' : ''} onchange="setBackupFormat('json', this.checked)"/>
                JSON (.json) — complete restore-vorm
              </label>
            </div>
          </div>

          <div style="margin-top:14px;padding:12px 14px;background:var(--mint1);border-radius:var(--r);font-size:12.5px;color:var(--navy)">
            <strong>Wat wordt geëxporteerd:</strong>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px 18px;margin-top:8px;color:var(--navy3)">
              <div>Besturen: <strong>${counts.besturen}</strong></div>
              <div>Scholen: <strong>${counts.scholen}</strong></div>
              <div>Contacten: <strong>${counts.contacten}</strong></div>
              <div>Trainingen: <strong>${counts.trainingen}</strong></div>
              <div>Facturen: <strong>${counts.facturen}</strong></div>
              <div>Inkoopfacturen: <strong>${counts.inkoopfacturen}</strong></div>
              <div>Dossiers: <strong>${counts.dossiers}</strong></div>
              <div>Uitvoeringen: <strong>${counts.uitvoeringen}</strong></div>
              <div>Agenda: <strong>${counts.agenda}</strong></div>
              <div>E-mailtemplates: <strong>${counts.emailTemplates}</strong></div>
              <div>E-maillog: <strong>${counts.emailLog}</strong></div>
            </div>
            ${(from || to) ? `<div style="margin-top:8px;font-size:11.5px;color:var(--navy4)">Periode-filter actief op datumgevoelige tabellen: <strong>${from || 'begin'}</strong> t/m <strong>${to || 'nu'}</strong>. Masterdata (besturen, scholen, contacten, trainingen, templates) wordt altijd compleet meegenomen.</div>` : `<div style="margin-top:8px;font-size:11.5px;color:var(--navy4)">Geen periode-filter — alle data wordt meegenomen.</div>`}
          </div>

          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="runSysteemBackup()">${svgIcon('download', 14)} Backup downloaden</button>
          </div>
        </div>
      </div>
    </div>`;
}

function _backupCounts(from, to) {
  const filt = items => _filterByDateRange(items, from, to, 'datum');
  return {
    besturen:        (DB.besturen || []).length,
    scholen:         (DB.scholen || []).length,
    contacten:       (DB.contacten || []).length,
    trainingen:      (DB.trainingen || []).length,
    emailTemplates:  (DB.emailTemplates || []).length,
    facturen:        filt(DB.facturen || []).length,
    dossiers:        filt(DB.dossiers || []).length,
    uitvoeringen:    filt(DB.uitvoeringen || []).length,
    agenda:          filt(DB.agenda || []).length,
    emailLog:        filt(DB.emailLog || []).length,
    inkoopfacturen:  _filterByDateRange(DB.inkoopfacturen || [], from, to, 'factuurdatum').length,
  };
}

function _filterByDateRange(items, from, to, key = 'datum') {
  if (!from && !to) return items;
  return items.filter(i => {
    const d = i[key];
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

// ── Backup uitvoeren ────────────────────────────────────────────
function runSysteemBackup() {
  if (!_backupExportXlsx && !_backupExportJson) {
    showToast('Kies minstens één formaat (Excel of JSON)', 'error');
    return;
  }
  const { from, to } = _backupComputePeriod();
  if (_backupPreset === 'custom') {
    if (!from || !to) { showToast('Vul beide datums in', 'error'); return; }
    if (from > to)    { showToast('Van-datum moet voor tot-datum liggen', 'error'); return; }
  }

  const data = _backupBuildDataset(from, to);
  const stamp = new Date().toISOString().slice(0, 10);
  const filenameBase = `2xdenken-backup-${stamp}`;

  if (_backupExportXlsx) _backupDownloadXlsx(data, `${filenameBase}.xlsx`);
  if (_backupExportJson) _backupDownloadJson(data, from, to, `${filenameBase}.json`);

  const formats = [_backupExportXlsx && 'Excel', _backupExportJson && 'JSON'].filter(Boolean).join(' + ');
  showToast(`Backup ${formats} gedownload`, 'success');
}

// Bouwt het volledige dataset op — in-memory, gefilterd op datum waar relevant.
function _backupBuildDataset(from, to) {
  const filt = (items, key = 'datum') => _filterByDateRange(items, from, to, key);
  const bestuurMap = Object.fromEntries((DB.besturen || []).map(b => [b.id, b]));
  const schoolMap  = Object.fromEntries((DB.scholen || []).map(s => [s.id, s]));
  const contactMap = Object.fromEntries((DB.contacten || []).map(c => [c.id, c]));
  const trainMap   = Object.fromEntries((DB.trainingen || []).map(t => [t.id, t]));
  const factuurMap = Object.fromEntries((DB.facturen || []).map(f => [f.id, f]));

  return {
    besturen:           (DB.besturen || []).slice(),
    scholen:            (DB.scholen || []).slice(),
    contacten:          (DB.contacten || []).slice(),
    trainingen:         (DB.trainingen || []).slice(),
    trainingTypes:      (DB.trainingTypes || []).slice(),
    trainingCategories: (DB.trainingCategories || []).slice(),
    agendaTypes:        (DB.agendaTypes || []).slice(),
    emailTemplates:     (DB.emailTemplates || []).slice(),
    facturen:           filt(DB.facturen || []),
    dossiers:           filt(DB.dossiers || []),
    uitvoeringen:       filt(DB.uitvoeringen || []),
    agenda:             filt(DB.agenda || []),
    emailLog:           filt(DB.emailLog || []),
    inkoopfacturen:     _filterByDateRange(DB.inkoopfacturen || [], from, to, 'factuurdatum'),
    kostenTypes:        (DB.kostenTypes || []).slice(),
    _maps: { bestuurMap, schoolMap, contactMap, trainMap, factuurMap },
  };
}

// XLSX-export: één tabblad per entiteit met menselijk-leesbare kolomnamen.
function _backupDownloadXlsx(data, filename) {
  const wb = XLSX.utils.book_new();
  const { bestuurMap, schoolMap, contactMap, trainMap } = data._maps;

  const addSheet = (name, rows) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '(geen rijen)': '' }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // sheet name max 31 chars
  };

  addSheet('Besturen', data.besturen.map(b => ({
    'ID': b.id, 'Naam': b.naam, 'Debiteurnummer': b.debiteurnr || '',
    'Website': b.website || '', 'Adres': b.adres || '',
  })));

  addSheet('Scholen', data.scholen.map(s => ({
    'ID': s.id, 'Bestuur': bestuurMap[s.bestuurId]?.naam || '', 'Naam': s.naam,
    'Debiteurnummer': s.debiteurnr || '', 'Adres': s.adres || '',
    'Postcode': s.postcode || '', 'Plaats': s.plaats || '', 'Website': s.website || '',
  })));

  addSheet('Contacten', data.contacten.map(c => ({
    'ID': c.id, 'School': schoolMap[c.schoolId]?.naam || '', 'Naam': c.naam,
    'Functie': c.functie || '', 'Type': c.type || '', 'E-mail': c.email || '',
    'Telefoon mobiel': c.telefoonMobiel || '', 'Telefoon werk': c.telefoonWerk || '',
  })));

  addSheet('Trainingen', data.trainingen.map(t => ({
    'ID': t.id, 'Naam': t.naam, 'Type': t.type || '', 'Categorie': t.categorie || '',
    'Omschrijving': t.omschrijving || '',
    'Aantal links': (t.links || []).length,
    'Aantal bestanden': (t.bestanden || []).length,
  })));

  addSheet('Facturen', data.facturen.map(f => ({
    'ID': f.id, 'Nummer': f.nummer || '', 'Datum': f.datum || '',
    'Vervaldatum': f.vervaldatum || '', 'Status': f.status || '',
    'School': schoolMap[f.schoolId]?.naam || '',
    'Bestuur': bestuurMap[f.bestuurId]?.naam || (f.schoolId ? bestuurMap[schoolMap[f.schoolId]?.bestuurId]?.naam || '' : ''),
    'T.a.v.': f.tav || '', 'Contact': contactMap[f.contactId]?.naam || '',
    'Debiteurnummer': f.debiteurnr || '', 'Betreft': f.betreft || '',
    'Totaal (EUR)': Number(f.totaal) || 0,
    'Aantal regels': (f.regels || []).length,
  })));

  // Factuurregels — apart tabblad zodat het leesbaar blijft
  const regelRows = [];
  for (const f of data.facturen) {
    for (const r of (f.regels || [])) {
      regelRows.push({
        'Factuurnummer': f.nummer || '', 'Factuurdatum': f.datum || '',
        'School': schoolMap[f.schoolId]?.naam || '',
        'Omschrijving': r.omschrijving || '', 'Toelichting': r.toelichting || '',
        'Datum': r.datum || '', 'Uren': Number(r.uren) || 0,
        'Bedrag (EUR)': Number(r.bedrag) || 0,
      });
    }
  }
  addSheet('Factuurregels', regelRows);

  addSheet('Dossiers', data.dossiers.map(d => ({
    'Datum': d.datum || '', 'School': schoolMap[d.schoolId]?.naam || '',
    'Contact': contactMap[d.contactId]?.naam || '', 'Type': d.type || '',
    'Onderwerp': d.onderwerp || '',
    'Tekst': (d.tekst || '').replace(/\s+/g, ' ').trim(),
    'Bron': d.bronNaam || '',
    'Aantal bestanden': (d.bestanden || []).length,
  })));

  addSheet('Uitvoeringen', data.uitvoeringen.map(u => ({
    'Datum': u.datum || '', 'Training': trainMap[u.trainingId]?.naam || '',
    'School': schoolMap[u.schoolId]?.naam || '',
    'Contact': contactMap[u.contactId]?.naam || '',
    'Deelnemers': u.deelnemers || '', 'Score': u.score || '',
    'Wat ging goed': (u.watGingGoed || '').replace(/\s+/g, ' ').trim(),
    'Wat kon beter': (u.watKonBeter || '').replace(/\s+/g, ' ').trim(),
    'Evaluatie': (u.evaluatie || '').replace(/\s+/g, ' ').trim(),
  })));

  addSheet('Agenda', data.agenda.map(a => ({
    'Datum': a.datum || '', 'Begin': a.beginTijd || '', 'Eind': a.eindTijd || '',
    'Titel': a.titel || '', 'Type': a.type || '',
    'School': schoolMap[a.schoolId]?.naam || '',
    'Bestuur': bestuurMap[a.bestuurId]?.naam || '',
    'Contact': contactMap[a.contactId]?.naam || '',
    'Locatie': a.locatie || '',
    'Notitie': (a.notitie || '').replace(/\s+/g, ' ').trim(),
  })));

  addSheet('E-mailtemplates', data.emailTemplates.map(t => ({
    'Naam': t.naam, 'Categorie': t.categorie || '', 'Onderwerp': t.onderwerp || '',
    'Body': (t.body || '').replace(/\s+/g, ' ').trim(),
  })));

  addSheet('E-maillog', data.emailLog.map(e => ({
    'Datum': e.datum || '', 'Aan': e.aanEmail || '', 'Aan-naam': e.aanNaam || '',
    'Onderwerp': e.onderwerp || '', 'Status': e.status || '',
    'School': schoolMap[e.schoolId]?.naam || '',
    'Contact': contactMap[e.contactId]?.naam || '',
    'Factuur': e.factuurId || '',
  })));

  // Categorie-tabbladen (klein, voor referentie)
  addSheet('Trainingtypes', data.trainingTypes.map(t => ({ 'ID': t.id, 'Naam': t.naam, 'Kleur': t.kleur || '' })));
  addSheet('Trainingscategorieën', data.trainingCategories.map(t => ({ 'ID': t.id, 'Naam': t.naam, 'Kleur': t.kleur || '' })));
  addSheet('Agendatypes', data.agendaTypes.map(t => ({ 'ID': t.id, 'Naam': t.naam, 'Kleur': t.kleur || '' })));
  addSheet('Kostentypes', (data.kostenTypes || []).map(t => ({ 'ID': t.id, 'Naam': t.naam, 'Kleur': t.kleur || '' })));

  // Inkoopfacturen — kostenmodule
  const kostenTypeMap = Object.fromEntries((data.kostenTypes || []).map(t => [t.id, t]));
  addSheet('Inkoopfacturen', (data.inkoopfacturen || []).map(f => ({
    'ID': f.id,
    'Datum': f.factuurdatum || '',
    'Leverancier': f.leverancier || '',
    'Factuurnummer': f.factuurnummer || '',
    'Type': kostenTypeMap[f.kostenTypeId]?.naam || '',
    'Omschrijving': f.omschrijving || '',
    'Bedrag (EUR)': Number(f.bedrag) || 0,
    'Terugkerend': f.isRecurring ? `Ja (${f.recurringInterval || 'maand'})` : (f.parentId ? 'Auto-gegenereerd' : 'Nee'),
    'Notitie': (f.notitie || '').replace(/\s+/g, ' ').trim(),
    'Aantal bestanden': (f.bestanden || []).length,
  })));

  XLSX.writeFile(wb, filename);
}

// JSON-export: ruwe data (camelCase) plus metadata. Restore-baar.
function _backupDownloadJson(data, from, to, filename) {
  const payload = {
    meta: {
      generated_at: new Date().toISOString(),
      app: '2xDenken CRM',
      version: 1,
      period_from: from || null,
      period_to: to || null,
    },
    besturen:           data.besturen,
    scholen:            data.scholen,
    contacten:          data.contacten,
    trainingen:         data.trainingen,
    trainingTypes:      data.trainingTypes,
    trainingCategories: data.trainingCategories,
    agendaTypes:        data.agendaTypes,
    emailTemplates:     data.emailTemplates,
    facturen:           data.facturen,
    dossiers:           data.dossiers,
    uitvoeringen:       data.uitvoeringen,
    agenda:             data.agenda,
    emailLog:           data.emailLog,
    inkoopfacturen:     data.inkoopfacturen || [],
    kostenTypes:        data.kostenTypes || [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openTrainingTypeModal(id = '') {
  ensureTrainingTypes();
  const t = id ? getTrainingTypeList().find(x => x.id === id) : null;
  const kleurOpties = Object.entries(AGENDA_KLEUR_LABELS).map(([val, label]) => {
    const k = AGENDA_KLEUREN[val];
    return `<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;border:2px solid ${(t?.kleur || 'navy') === val ? 'var(--navy)' : 'var(--bg3)'};background:${(t?.kleur || 'navy') === val ? 'var(--bg)' : 'white'}">
      <input type="radio" name="trainingtypekleur" value="${val}" ${(t?.kleur || 'navy') === val ? 'checked' : ''} style="display:none" onclick="document.querySelectorAll('#trainingtype-kleur-grid label').forEach(l=>{l.style.borderColor='var(--bg3)';l.style.background='white'});this.closest('label').style.borderColor='var(--navy)';this.closest('label').style.background='var(--bg)'">
      <span class="badge ${k.badge}">${esc(label)}</span>
    </label>`;
  }).join('');

  showModal(t ? 'Trainingtype bewerken' : 'Nieuw trainingtype',
    `<div class="form-group"><label>Naam *</label><input type="text" id="f-trainingtypename" value="${esc(t?.naam || '')}" placeholder="Bijv. Teamtraining, Webinar, Ouderavond…"/></div>
     <div class="form-group">
       <label>Kleur</label>
       <div id="trainingtype-kleur-grid" style="display:flex;gap:8px;flex-wrap:wrap">${kleurOpties}</div>
       <select id="f-trainingtypekleur" style="display:none"><option value="${esc(t?.kleur || 'navy')}">${esc(t?.kleur || 'navy')}</option></select>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${t ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delTrainingType('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="document.getElementById('f-trainingtypekleur').value=document.querySelector('input[name=trainingtypekleur]:checked')?.value||'navy';saveTrainingType('${id}')">${t ? 'Opslaan' : 'Toevoegen'}</button>`);
}

function openTrainingCategoryModal(id = '') {
  ensureTrainingCategories();
  const t = id ? getTrainingCategoryList().find(x => x.id === id) : null;
  const kleurOpties = Object.entries(AGENDA_KLEUR_LABELS).map(([val, label]) => {
    const k = AGENDA_KLEUREN[val];
    return `<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;border:2px solid ${(t?.kleur || 'navy') === val ? 'var(--navy)' : 'var(--bg3)'};background:${(t?.kleur || 'navy') === val ? 'var(--bg)' : 'white'}">
      <input type="radio" name="trainingcategorykleur" value="${val}" ${(t?.kleur || 'navy') === val ? 'checked' : ''} style="display:none" onclick="document.querySelectorAll('#trainingcategory-kleur-grid label').forEach(l=>{l.style.borderColor='var(--bg3)';l.style.background='white'});this.closest('label').style.borderColor='var(--navy)';this.closest('label').style.background='var(--bg)'">
      <span class="badge ${k.badge}">${esc(label)}</span>
    </label>`;
  }).join('');

  showModal(t ? 'Trainingscategorie bewerken' : 'Nieuwe trainingscategorie',
    `<div class="form-group"><label>Naam *</label><input type="text" id="f-trainingcategoryname" value="${esc(t?.naam || '')}" placeholder="Bijv. Gedrag, Rekenen, Teamontwikkeling…"/></div>
     <div class="form-group">
       <label>Kleur</label>
       <div id="trainingcategory-kleur-grid" style="display:flex;gap:8px;flex-wrap:wrap">${kleurOpties}</div>
       <select id="f-trainingcategorykleur" style="display:none"><option value="${esc(t?.kleur || 'navy')}">${esc(t?.kleur || 'navy')}</option></select>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${t ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delTrainingCategory('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="document.getElementById('f-trainingcategorykleur').value=document.querySelector('input[name=trainingcategorykleur]:checked')?.value||'navy';saveTrainingCategory('${id}')">${t ? 'Opslaan' : 'Toevoegen'}</button>`);
}

function openAgendaTypeModal(id = '') {
  const t = id ? DB.agendaTypes.find(x => x.id === id) : null;
  const kleurOpties = Object.entries(AGENDA_KLEUR_LABELS).map(([val, label]) => {
    const k = AGENDA_KLEUREN[val];
    return `<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;border:2px solid ${(t?.kleur || 'navy') === val ? 'var(--navy)' : 'var(--bg3)'};background:${(t?.kleur || 'navy') === val ? 'var(--bg)' : 'white'}">
      <input type="radio" name="typekleur" value="${val}" ${(t?.kleur || 'navy') === val ? 'checked' : ''} style="display:none" onclick="document.querySelectorAll('#kleur-grid label').forEach(l=>{l.style.borderColor='var(--bg3)';l.style.background='white'});this.closest('label').style.borderColor='var(--navy)';this.closest('label').style.background='var(--bg)'">
      <span class="badge ${k.badge}">${esc(label)}</span>
    </label>`;
  }).join('');

  showModal(t ? 'Agendatype bewerken' : 'Nieuw agendatype',
    `<div class="form-group"><label>Naam *</label><input type="text" id="f-typename" value="${esc(t?.naam || '')}" placeholder="Bijv. Intake, Workshop, Overleg…"/></div>
     <div class="form-group">
       <label>Kleur</label>
       <div id="kleur-grid" style="display:flex;gap:8px;flex-wrap:wrap">${kleurOpties}</div>
       <select id="f-typekleur" style="display:none"><option value="${esc(t?.kleur || 'navy')}">${esc(t?.kleur || 'navy')}</option></select>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${t ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delAgendaType('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="document.getElementById('f-typekleur').value=document.querySelector('input[name=typekleur]:checked')?.value||'navy';saveAgendaType('${id}')">${t ? 'Opslaan' : 'Toevoegen'}</button>`);
}

function openEmailTemplateModal(id = '') {
  const t = id ? DB.emailTemplates.find(x => x.id === id) : null;
  const cats = ['algemeen', 'factuur', 'herinnering', 'intake', 'opvolging'];
  const catOpts = cats.map(c => `<option value="${c}"${(t?.categorie || 'algemeen') === c ? ' selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('');

  const varsRef = `<div style="margin-top:12px;padding:10px 14px;background:var(--glass);border:1px solid var(--bg3);border-radius:var(--r);font-size:11.5px;color:var(--navy3)">
    <strong style="color:var(--navy)">Beschikbare variabelen:</strong><br>
    <code>{{contactnaam}}</code> <code>{{contactemail}}</code> <code>{{schoolnaam}}</code> <code>{{schooladres}}</code> <code>{{schoolplaats}}</code> <code>{{bestuursnaam}}</code> <code>{{debiteurnummer}}</code><br>
    <code>{{factuurnummer}}</code> <code>{{factuurbedrag}}</code> <code>{{factuurdatum}}</code> <code>{{vervaldatum}}</code> <code>{{factuurbetreft}}</code> <code>{{vandaag}}</code> <code>{{gebruikersnaam}}</code>
  </div>`;

  showModal(t ? 'Template bewerken' : 'Nieuwe e-mailtemplate',
    `<div class="form-row">
       <div class="form-group"><label>Naam *</label><input type="text" id="f-tpl-naam" value="${esc(t?.naam || '')}" placeholder="Bijv. Factuurherinnering"/></div>
       <div class="form-group"><label>Categorie</label><select id="f-tpl-categorie">${catOpts}</select></div>
     </div>
     <div class="form-group"><label>Onderwerp *</label><input type="text" id="f-tpl-onderwerp" value="${esc(t?.onderwerp || '')}" placeholder="Herinnering factuur {{factuurnummer}} — 2xDenken"/></div>
     <div class="form-group"><label>Berichttekst</label><textarea id="f-tpl-body" rows="8" placeholder="Beste {{contactnaam}},&#10;&#10;Hierbij herinner ik u aan...">${esc(t?.body || '')}</textarea></div>
     ${varsRef}`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${t ? `<button class="btn" style="background:#FDE8E8;color:#C0392B;font-weight:700" onclick="delEmailTemplate('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveEmailTemplate('${id}')">${t ? 'Opslaan' : 'Toevoegen'}</button>`);
}
