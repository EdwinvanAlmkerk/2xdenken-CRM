// ════════════════════════════════════════════════════════════════
// INSTELLINGEN
// ════════════════════════════════════════════════════════════════

function renderInstellingen() {
  const aantalFacturen = DB.facturen.length;
  return `
    <div style="max-width:720px;display:flex;flex-direction:column;gap:24px">
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
