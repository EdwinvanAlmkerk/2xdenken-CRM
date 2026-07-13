// ════════════════════════════════════════════════════════════════
// BANKIMPORT — ING CSV-export inlezen en facturen markeren als betaald
// ════════════════════════════════════════════════════════════════
// De ING-CSV (Mijn ING → Downloaden → CSV) bevat per regel o.a.:
//   Datum;Naam / Omschrijving;Rekening;Tegenrekening;Code;Af Bij;
//   Bedrag (EUR);Mutatiesoort;Mededelingen
// We kijken alleen naar inkomende bedragen ("Bij"), zoeken per betaling
// een openstaande factuur (status verzonden/vervallen) op factuurnummer
// en/of bedrag, en laten de gebruiker de voorstellen bevestigen vóór er
// iets wordt opgeslagen. Niets gaat automatisch — de gebruiker houdt de
// controle.

let _bankimportProposals = [];   // [{ factuurId, nummer, klant, factuurTotaal, betaling:{datum,bedrag,naam,mededeling}, reden, sterk }]
let _bankimportOnmatched = 0;    // aantal inkomende betalingen zonder match

// ── CSV-parser (respecteert quotes en dubbele quotes) ────────────
function _bankCsvParse(text, delim) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQ = true; continue; }
    if (c === delim) { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

// Bepaal het scheidingsteken aan de hand van de kopregel (ING = ';').
function _bankDetectDelim(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semis >= commas ? ';' : ',';
}

// "1.234,56" of "850,00" → 1234.56 / 850.00
function _bankParseBedrag(val) {
  return parseFloat(String(val || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
}

// "20260712" → "12-07-2026" (voor weergave)
function _bankFmtDatum(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

// Alle cijferreeksen van 4+ tekens uit een tekst (voor factuurnummer-match).
function _bankNumberTokens(text) {
  return String(text || '').match(/\d{4,}/g) || [];
}

// Komt het factuurnummer voor in de betaaltekst? Numerieke nummers moeten
// exact als losse cijferreeks voorkomen (voorkomt deelmatches zoals 2026
// binnen 202661); niet-numerieke nummers matchen als substring.
function _bankNummerMatcht(nummer, tekst) {
  const nr = String(nummer || '').trim();
  if (!nr) return false;
  if (/^\d+$/.test(nr)) return _bankNumberTokens(tekst).includes(nr);
  return String(tekst || '').toLowerCase().includes(nr.toLowerCase());
}

function _bankBedragGelijk(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;
}

// ── Modal openen ─────────────────────────────────────────────────
function openBankimportModal() {
  _bankimportProposals = [];
  _bankimportOnmatched = 0;
  showModal('Bankimport — ING CSV',
    `<p style="font-size:13.5px;color:var(--navy3);line-height:1.6;margin-bottom:14px">
       Maak in Mijn ING een export met bestandstype <strong>CSV</strong> en kies dit bestand hieronder.
       Het CRM zoekt per bijgeschreven bedrag een openstaande factuur (op factuurnummer en/of bedrag)
       en toont een voorstel. Staan er meerdere factuurnummers in één omschrijving, dan worden die
       facturen samen herkend. Pas na jouw bevestiging worden facturen op <strong>Betaald</strong> gezet.
     </p>
     <div class="form-group">
       <label>ING CSV-bestand</label>
       <input type="file" id="f-bankcsv" accept=".csv,text/csv" onchange="handleBankimportFile(this)"/>
     </div>
     <div id="bankimport-result"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     <button class="btn btn-primary" id="bankimport-confirm" onclick="confirmBankimport()" style="display:none">Markeer geselecteerde als betaald</button>`,
    true);
}

// ── Bestand inlezen en matchen ───────────────────────────────────
function handleBankimportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      buildBankimportProposals(String(reader.result || ''));
      renderBankimportResult();
    } catch (e) {
      console.error(e);
      const wrap = document.getElementById('bankimport-result');
      if (wrap) wrap.innerHTML = `<div style="color:var(--s-rood);font-weight:600;font-size:13px">Kon het bestand niet lezen. Controleer of het een ING CSV-export is.</div>`;
    }
  };
  reader.onerror = () => showToast('Bestand kon niet worden gelezen', 'error');
  reader.readAsText(file);
}

let _bankGroepTeller = 0;

function buildBankimportProposals(text) {
  _bankimportProposals = [];
  _bankimportOnmatched = 0;
  _bankGroepTeller = 0;

  const delim = _bankDetectDelim(text);
  const rows = _bankCsvParse(text, delim);
  if (rows.length < 2) throw new Error('Leeg of onherkenbaar CSV-bestand');

  // Kopregel → kolomindexen (ongevoelig voor hoofdletters/spaties).
  const header = rows[0].map(h => String(h).toLowerCase().replace(/[\s/]+/g, ''));
  const findCol = (...keys) => header.findIndex(h => keys.some(k => h.includes(k)));
  const idxDatum = findCol('datum');
  const idxNaam  = findCol('naam', 'omschrijving');
  const idxAfBij = findCol('afbij', 'bijaf');
  const idxBedr  = findCol('bedrag');
  const idxMede  = findCol('mededeling');

  if (idxBedr === -1) throw new Error('Kolom "Bedrag" niet gevonden');

  // Openstaande facturen (verzonden of vervallen). Concept = nog niet
  // verstuurd, betaald = al klaar; die tellen niet mee.
  const openFacturen = DB.facturen.filter(f => f.status === 'verzonden' || f.status === 'vervallen');
  const gebruikt = new Set();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const afbij = idxAfBij >= 0 ? String(r[idxAfBij] || '').toLowerCase() : '';
    const bedrag = _bankParseBedrag(r[idxBedr]);
    // Alleen inkomende bedragen. Zonder Af/Bij-kolom vallen we terug op
    // een positief bedrag.
    const inkomend = idxAfBij >= 0 ? afbij.includes('bij') : bedrag > 0;
    if (!inkomend || bedrag <= 0) continue;

    const naam = idxNaam >= 0 ? String(r[idxNaam] || '').trim() : '';
    const mededeling = idxMede >= 0 ? String(r[idxMede] || '').trim() : '';
    const datum = idxDatum >= 0 ? String(r[idxDatum] || '').trim() : '';
    const zoektekst = `${mededeling} ${naam}`;

    // 1) Match op factuurnummer(s). Eén betaling kan meerdere facturen
    // afdekken: scholen zetten soms alle factuurnummers in de omschrijving.
    // We zoeken dus ALLE openstaande facturen waarvan het nummer voorkomt.
    let genoemd = openFacturen.filter(f => !gebruikt.has(f.id) && _bankNummerMatcht(f.nummer, zoektekst));
    let matches = [], reden = '', sterk = false;

    if (genoemd.length > 0) {
      const som = Math.round(genoemd.reduce((s, f) => s + (f.totaal || 0), 0) * 100) / 100;
      const totaalKlopt = _bankBedragGelijk(som, bedrag);
      matches = genoemd;
      if (genoemd.length === 1) {
        reden = totaalKlopt ? 'Factuurnummer + bedrag' : `Factuurnummer (bedrag wijkt af: factuur ${fmtEuro(som)})`;
        sterk = totaalKlopt;
      } else {
        reden = totaalKlopt
          ? `${genoemd.length} facturen in 1 betaling — totaal klopt`
          : `${genoemd.length} facturen in 1 betaling — totaal ${fmtEuro(som)} ≠ ontvangen ${fmtEuro(bedrag)}`;
        sterk = totaalKlopt;
      }
    } else {
      // 2) Geen nummer gevonden → match op uniek bedrag (enkelvoudig).
      const kandidaten = openFacturen.filter(f => !gebruikt.has(f.id) && _bankBedragGelijk(f.totaal, bedrag));
      if (kandidaten.length === 1) { matches = kandidaten; reden = 'Bedrag (uniek)'; sterk = true; }
    }

    if (matches.length > 0) {
      const groepId = ++_bankGroepTeller;
      const betaling = { datum, bedrag, naam, mededeling };
      for (const f of matches) {
        gebruikt.add(f.id);
        _bankimportProposals.push({
          factuurId: f.id,
          nummer: f.nummer,
          klant: factuurKlantNaam(f),
          factuurTotaal: f.totaal,
          betaling,
          reden, sterk,
          groepId,
          groepGrootte: matches.length,
        });
      }
    } else {
      _bankimportOnmatched++;
    }
  }

  // Sterke matches bovenaan; regels van dezelfde betaling blijven bij elkaar.
  _bankimportProposals.sort((a, b) => (b.sterk ? 1 : 0) - (a.sterk ? 1 : 0) || (a.groepId - b.groepId));
}

// ── Resultaat tonen ──────────────────────────────────────────────
function renderBankimportResult() {
  const wrap = document.getElementById('bankimport-result');
  const confirmBtn = document.getElementById('bankimport-confirm');
  if (!wrap) return;

  if (_bankimportProposals.length === 0) {
    wrap.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--bg3);border-radius:var(--r);padding:14px 16px;font-size:13px;color:var(--navy3)">
        Geen openstaande facturen gevonden die bij een bijgeschreven bedrag passen.
        ${_bankimportOnmatched ? `<br/>${_bankimportOnmatched} inkomende betaling(en) konden niet gekoppeld worden.` : ''}
      </div>`;
    if (confirmBtn) confirmBtn.style.display = 'none';
    return;
  }

  // Regels opbouwen; bij een betaling met meerdere facturen komt er eerst
  // een groepskop die de bijschrijving samenvat.
  let rijen = '';
  let vorigeGroep = null;
  _bankimportProposals.forEach((p, i) => {
    if (p.groepGrootte > 1 && p.groepId !== vorigeGroep) {
      rijen += `
        <tr style="background:var(--bg2)">
          <td></td>
          <td colspan="5" style="font-size:12px;color:var(--navy3);font-weight:600;padding-top:9px">
            ${svgIcon('euro', 13)} Betaling ${fmtEuro(p.betaling.bedrag)} op ${esc(_bankFmtDatum(p.betaling.datum))}${p.betaling.naam ? ` — ${esc(p.betaling.naam)}` : ''}
            <span style="color:${p.sterk ? 'var(--groen)' : 'var(--s-oranje, #b26a00)'}"> · ${esc(p.reden)}</span>
          </td>
        </tr>`;
    }
    vorigeGroep = p.groepId;
    const enkel = p.groepGrootte === 1;
    rijen += `
      <tr>
        <td style="text-align:center"><input type="checkbox" id="bimp-${i}" ${p.sterk ? 'checked' : ''} style="width:17px;height:17px;cursor:pointer"/></td>
        <td style="font-weight:700;white-space:nowrap${enkel ? '' : ';padding-left:22px'}">${esc(p.nummer || '')}</td>
        <td style="font-size:13px">${esc(p.klant || '—')}</td>
        <td style="font-weight:600;white-space:nowrap">${fmtEuro(p.factuurTotaal)}</td>
        <td style="white-space:nowrap;font-size:12.5px;color:var(--navy3)">${esc(_bankFmtDatum(p.betaling.datum))}</td>
        <td style="font-size:12px;color:${p.sterk ? 'var(--groen)' : 'var(--s-oranje, #b26a00)'};font-weight:600">${enkel ? esc(p.reden) : 'onderdeel van betaling'}</td>
      </tr>`;
  });

  const aantalSterk = _bankimportProposals.filter(p => p.sterk).length;

  wrap.innerHTML = `
    <div style="margin-top:6px;margin-bottom:10px;font-size:13px;color:var(--navy3)">
      <strong>${_bankimportProposals.length}</strong> voorstel(len) gevonden${aantalSterk ? ` — ${aantalSterk} met zekere match (alvast aangevinkt)` : ''}.
      ${_bankimportOnmatched ? `<br/>${_bankimportOnmatched} inkomende betaling(en) zonder match (blijven ongewijzigd).` : ''}
    </div>
    <div class="table-wrap" style="max-height:340px;overflow:auto">
      <table>
        <thead><tr>
          <th style="width:36px;text-align:center">✓</th>
          <th>Factuur</th>
          <th>Klant</th>
          <th>Factuurbedrag</th>
          <th>Datum</th>
          <th>Match</th>
        </tr></thead>
        <tbody>${rijen}</tbody>
      </table>
    </div>
    <div style="margin-top:8px;font-size:12px;color:var(--navy4)">
      Controleer de aangevinkte regels. Regels met een afwijkend bedrag zijn niet automatisch aangevinkt — vink ze zelf aan als de betaling toch klopt.
    </div>`;

  if (confirmBtn) confirmBtn.style.display = '';
}

// ── Bevestigen → facturen op betaald zetten ──────────────────────
async function confirmBankimport() {
  const geselecteerd = _bankimportProposals.filter((p, i) => {
    const cb = document.getElementById(`bimp-${i}`);
    return cb && cb.checked;
  });
  if (geselecteerd.length === 0) return alert('Vink minimaal één factuur aan.');
  if (!confirm(`${geselecteerd.length} factuur${geselecteerd.length === 1 ? '' : 'en'} als betaald markeren?`)) return;

  showLoading();
  let gelukt = 0;
  try {
    for (const p of geselecteerd) {
      try {
        await supa(`/rest/v1/facturen?id=eq.${p.factuurId}`, { method: 'PATCH', body: JSON.stringify({ status: 'betaald' }) });
        DB.facturen = DB.facturen.map(f => f.id === p.factuurId ? { ...f, status: 'betaald' } : f);
        gelukt++;
      } catch (e) {
        console.error('Factuur bijwerken mislukt:', p.nummer, e);
      }
    }
    closeModal();
    renderContent();
    if (gelukt === geselecteerd.length) showToast(`${gelukt} factuur${gelukt === 1 ? '' : 'en'} op betaald gezet`, 'success');
    else showToast(`${gelukt} van ${geselecteerd.length} bijgewerkt — controleer de rest`, 'error');
  } catch (e) {
    toastError(e);
  } finally {
    hideLoading();
  }
}
