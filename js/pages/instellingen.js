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
