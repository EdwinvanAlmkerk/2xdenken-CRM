// ════════════════════════════════════════════════════════════════
// INSTELLINGEN
// ════════════════════════════════════════════════════════════════

function renderInstellingen() {
  const aantalFacturen = DB.facturen.length;
  return `
    <div style="max-width:720px;display:flex;flex-direction:column;gap:24px">

      <div class="card">
        <div class="card-header">
          <h3>${svgIcon('calendar', 16)} Agendatypes</h3>
          <button class="btn btn-primary btn-sm" onclick="openAgendaTypeModal()">${svgIcon('add', 14)} Type toevoegen</button>
        </div>
        <div class="card-body" style="padding:0">
          <table>
            <thead><tr><th>Naam</th><th>Kleur</th><th style="width:60px">In gebruik</th><th style="width:80px"></th></tr></thead>
            <tbody>
              ${DB.agendaTypes.length === 0
                ? `<tr><td colspan="4"><div class="empty-state" style="padding:20px"><p>Geen agendatypes</p></div></td></tr>`
                : DB.agendaTypes.map(t => {
                    const k = AGENDA_KLEUREN[t.kleur] || AGENDA_KLEUREN.navy;
                    const aantal = DB.agenda.filter(a => a.type === t.id).length;
                    return `<tr>
                      <td style="font-weight:600">${esc(t.naam)}</td>
                      <td><span class="badge ${k.badge}">${esc(AGENDA_KLEUR_LABELS[t.kleur] || t.kleur)}</span></td>
                      <td style="text-align:center;color:var(--navy3)">${aantal}</td>
                      <td>
                        <div class="row-actions">
                          <button class="btn btn-ghost btn-icon btn-sm" title="Bewerken" onclick="openAgendaTypeModal('${t.id}')">${svgIcon('edit', 14)}</button>
                          <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delAgendaType('${t.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')}
            </tbody>
          </table>
        </div>
      </div>

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

      <div class="card">
        <div class="card-header"><h3>${svgIcon('calendar', 16)} Agenda (gepubliceerde feed)</h3></div>
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

      <div class="card">
        <div class="card-header"><h3>${svgIcon('invoice', 16)} Facturen</h3></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:0">

          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--bg3)">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--navy)">Totalen herberekenen</div>
              <div style="font-size:13px;color:var(--navy3);margin-top:2px">Corrigeert afrondingsfouten in opgeslagen factuurtotalen door ze opnieuw te berekenen vanuit de regelitems.</div>
            </div>
            <button class="btn btn-secondary" onclick="herberekeningTotalen()"
              style="white-space:nowrap;border-color:var(--oranje);color:var(--oranje);font-weight:700;flex-shrink:0">
              ${svgIcon('euro', 15)} Herberekenen
            </button>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0">
            <div>
              <div style="font-size:14px;font-weight:700;color:#C0392B">Alle facturen verwijderen</div>
              <div style="font-size:13px;color:var(--navy3);margin-top:2px">Verwijdert alle <strong>${aantalFacturen}</strong> facturen permanent. Besturen, scholen en contactpersonen blijven bewaard.</div>
            </div>
            <button class="btn" onclick="delAlleFacturen()"
              style="white-space:nowrap;background:#FDE8E8;color:#C0392B;font-weight:700;flex-shrink:0">
              ${svgIcon('trash', 15)} Verwijderen
            </button>
          </div>

        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>${svgIcon('trash', 16)} Alle inhoud verwijderen</h3></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
            <div>
              <div style="font-size:14px;font-weight:700;color:#C0392B">Volledige database legen</div>
              <div style="font-size:13px;color:var(--navy3);margin-top:2px">
                Verwijdert <strong>alle</strong> besturen, scholen, contacten, dossiers, facturen, trainingen, uitvoeringen en agenda-items.
                Agendatypes blijven bewaard. <strong>Dit kan niet ongedaan worden gemaakt.</strong>
              </div>
            </div>
            <button class="btn" onclick="delAlleInhoud()"
              style="white-space:nowrap;background:#FDE8E8;color:#C0392B;font-weight:700;flex-shrink:0">
              ${svgIcon('trash', 15)} Alles verwijderen
            </button>
          </div>
        </div>
      </div>

    </div>`;
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
