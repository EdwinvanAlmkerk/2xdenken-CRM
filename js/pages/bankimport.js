// ════════════════════════════════════════════════════════════════
// BANKIMPORT — ING CSV-export inlezen en facturen markeren als betaald
// ════════════════════════════════════════════════════════════════
// De ING-CSV (Mijn ING → Downloaden → CSV) bevat per regel o.a.:
//   Datum;Naam / Omschrijving;Rekening;Tegenrekening;Code;Af Bij;
//   Bedrag (EUR);Mutatiesoort;Mededelingen
//
// Per bijgeschreven bedrag zoeken we de bijbehorende openstaande factuur
// op drie signalen, die samen een score vormen:
//   1. factuurnummer in de omschrijving  (sterkste signaal)
//   2. bedrag gelijk aan het factuurtotaal — ook als som van meerdere
//      facturen van dezelfde klant (bundelbetaling)
//   3. afzendernaam die lijkt op de school, het bestuur of het bestuur
//      van de school (of het debiteurnummer in de omschrijving)
// Een bedrag alleen is al genoeg voor een voorstel; bedrag + afzender of
// bedrag + factuurnummer is genoeg om het voorstel alvast aan te vinken.
//
// Elke bijschrijving krijgt een eigen regel met een keuzelijst, zodat je
// een voorstel kunt wijzigen of handmatig een factuur kunt koppelen.
// Niets gaat automatisch — pas na bevestiging wordt er iets opgeslagen.

let _bankimportBetalingen = [];  // alle inkomende bijschrijvingen + kandidaten
let _bankimportOpen = [];        // openstaande facturen op moment van inlezen
let _bankTokenFreq = null;       // hoe vaak een naamwoord bij klanten voorkomt

// Woorden die niets onderscheidends zeggen over wélke klant het is.
const _BANK_STOPWOORDEN = new Set([
  'de', 'het', 'een', 'van', 'der', 'den', 'ter', 'voor', 'aan', 'inzake', 'inz',
  'stichting', 'sticht', 'vereniging', 'scholengroep', 'scholenkring',
  'onderwijsgroep', 'onderwijs', 'scholen', 'school', 'basisschool',
  'kindcentrum', 'locatie', 'intern', 'bestuur', 'beheer', 'holding', 'groep',
  'betaling', 'factuur', 'facturen', 'nota', 'ref', 'referentie',
  'obs', 'cbs', 'pcb', 'pcbo', 'sbo', 'ibs', 'ikc', 'rkb', 'ods', 'gbs',
]);

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

// "20260712", "2026-07-12" of "12-07-2026" → Date (of null)
function _bankParseDatum(raw) {
  const s = String(raw || '').trim();
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

function _bankRond(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function _bankSom(facturen) { return _bankRond(facturen.reduce((s, f) => s + (f.totaal || 0), 0)); }

// Alle cijferreeksen van 4+ tekens uit een tekst (voor factuurnummer-match).
function _bankNumberTokens(text) {
  return String(text || '').match(/\d{4,}/g) || [];
}

// Komt het factuurnummer voor in de betaaltekst? Numerieke nummers moeten
// exact als losse cijferreeks voorkomen (voorkomt deelmatches zoals 2026
// binnen 202661); niet-numerieke nummers matchen als los woord.
function _bankNummerMatcht(nummer, tekst) {
  const nr = String(nummer || '').trim();
  if (!nr) return false;
  if (/^\d+$/.test(nr)) return _bankNumberTokens(tekst).includes(nr);
  const veilig = nr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${veilig}([^a-z0-9]|$)`, 'i').test(String(tekst || ''));
}

function _bankBedragGelijk(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;
}

// ── Naamherkenning (afzender ↔ school / bestuur) ─────────────────
// Alles naar kleine letters zonder accenten en leestekens, zodat
// "P.C.B. De Windroos" en "PCB DE WINDROOS" hetzelfde worden.
function _bankNormNaam(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function _bankNaamTokens(s) {
  return _bankNormNaam(s).split(' ').filter(t => t.length >= 3 && !_BANK_STOPWOORDEN.has(t));
}

// Tel hoe vaak elk woord in klantnamen voorkomt: een woord dat bij veel
// klanten voorkomt (plaatsnaam, "wijzer") zegt weinig over wélke klant.
function _bankBouwTokenFreq() {
  _bankTokenFreq = new Map();
  const namen = [...(DB.scholen || []).map(s => s.naam), ...(DB.besturen || []).map(b => b.naam)];
  for (const n of namen) {
    for (const t of new Set(_bankNaamTokens(n))) _bankTokenFreq.set(t, (_bankTokenFreq.get(t) || 0) + 1);
  }
}

function _bankTokenGewicht(t) {
  const n = (_bankTokenFreq && _bankTokenFreq.get(t)) || 0;
  return n > 3 ? 0.35 : 1;
}

// De namen waaronder een factuur betaald kan worden: de school, het
// bestuur van die school, en het bestuur als de factuur daarop staat.
function _bankKlantNamen(f) {
  const namen = [];
  const s = f.schoolId ? getSchool(f.schoolId) : null;
  if (s) {
    namen.push(s.naam);
    const sb = s.bestuurId ? getBestuur(s.bestuurId) : null;
    if (sb) namen.push(sb.naam);
  }
  const b = f.bestuurId ? getBestuur(f.bestuurId) : null;
  if (b) namen.push(b.naam);
  return namen.filter(Boolean);
}

// 0 = geen gelijkenis, 1 = volledige naam herkend.
function _bankNaamScore(bankNaam, klantNamen) {
  const bankNorm = _bankNormNaam(bankNaam);
  if (!bankNorm) return 0;
  const bankTokens = new Set(_bankNaamTokens(bankNaam));
  let best = 0;
  for (const kn of klantNamen) {
    const norm = _bankNormNaam(kn);
    if (!norm) continue;
    // Hele naam komt terug in de afzender (of andersom) → zeker.
    if (norm.length >= 5 && (bankNorm.includes(norm) || norm.includes(bankNorm))) return 1;
    const toks = _bankNaamTokens(kn);
    if (!toks.length) continue;
    let hit = 0, tot = 0;
    for (const t of toks) {
      const w = _bankTokenGewicht(t);
      tot += w;
      if (bankTokens.has(t) || bankNorm.includes(t)) hit += w;
    }
    if (tot > 0) best = Math.max(best, hit / tot);
  }
  return best;
}

// ── Kandidaten zoeken per bijschrijving ──────────────────────────
// Zoek combinaties van 2-4 facturen die samen precies het ontvangen
// bedrag vormen (bundelbetaling zonder factuurnummers).
function _bankCombinaties(facturen, doel, maxLen) {
  const res = [];
  const lijst = facturen.slice(0, 10);
  const zoek = (start, gekozen, som) => {
    if (res.length >= 3) return;
    if (gekozen.length >= 2 && _bankBedragGelijk(som, doel)) { res.push(gekozen.slice()); return; }
    if (gekozen.length >= maxLen || som > doel + 0.005) return;
    for (let i = start; i < lijst.length; i++) {
      gekozen.push(lijst[i]);
      zoek(i + 1, gekozen, som + (lijst[i].totaal || 0));
      gekozen.pop();
      if (res.length >= 3) return;
    }
  };
  zoek(0, [], 0);
  return res;
}

// Betaling ná de factuurdatum = extra vertrouwen; een betaling vóór de
// factuurdatum kan er vrijwel zeker niet bij horen.
function _bankDatumScore(f, bet) {
  const db = _bankParseDatum(bet.datum);
  const df = _bankParseDatum(f.datum);
  if (!db || !df) return 0;
  const dagen = Math.round((db - df) / 86400000);
  if (dagen < -3) return -25;
  if (dagen <= 60) return 4;
  if (dagen <= 150) return 2;
  return 0;
}

// Kandidaat op factuurnummer(s) in de omschrijving. Eén betaling kan
// meerdere facturen afdekken: scholen zetten soms alle nummers erbij.
function _bankNummerKandidaat(bet, beschikbaar) {
  const genoemd = beschikbaar.filter(f => _bankNummerMatcht(f.nummer, bet.zoektekst));
  if (!genoemd.length) return null;
  const som = _bankSom(genoemd);
  const klopt = _bankBedragGelijk(som, bet.bedrag);
  let reden;
  if (genoemd.length === 1) {
    reden = klopt ? 'Factuurnummer + bedrag' : `Factuurnummer (bedrag wijkt af: factuur ${fmtEuro(som)})`;
  } else {
    reden = klopt
      ? `${genoemd.length} factuurnummers in 1 betaling — totaal klopt`
      : `${genoemd.length} factuurnummers — totaal ${fmtEuro(som)} ≠ ontvangen ${fmtEuro(bet.bedrag)}`;
  }
  return { facturen: genoemd, som, score: 100 + (klopt ? 50 : 0), sterk: klopt, reden };
}

// Kandidaten op bedrag en/of afzender, gesorteerd op score.
function _bankKandidaten(bet, beschikbaar) {
  const ruw = [];
  let aantalBedragMatches = 0;

  for (const f of beschikbaar) {
    const naamScore = _bankNaamScore(bet.naam, _bankKlantNamen(f));
    const debHit = f.debiteurnr ? _bankNummerMatcht(f.debiteurnr, bet.zoektekst) : false;
    const klantScore = debHit ? 1 : naamScore;
    const klantHit = klantScore >= 0.5;
    const bedragGelijk = _bankBedragGelijk(f.totaal, bet.bedrag);
    if (!bedragGelijk && !klantHit) continue;
    if (bedragGelijk) aantalBedragMatches++;
    const datum = _bankDatumScore(f, bet);
    ruw.push({
      facturen: [f], som: _bankRond(f.totaal), bedragGelijk, klantHit, teVroeg: datum < 0,
      bron: debHit ? 'debiteurnummer' : 'afzender',
      score: (bedragGelijk ? 50 : 0) + Math.round(30 * klantScore) + datum,
    });
  }

  // Bundelbetaling: meerdere openstaande facturen van dezelfde klant die
  // samen precies het ontvangen bedrag vormen.
  const perKlant = new Map();
  for (const f of beschikbaar) {
    const key = f.schoolId || f.bestuurId || 'onbekend';
    if (!perKlant.has(key)) perKlant.set(key, []);
    perKlant.get(key).push(f);
  }
  for (const lijst of perKlant.values()) {
    if (lijst.length < 2) continue;
    const klantScore = _bankNaamScore(bet.naam, _bankKlantNamen(lijst[0]));
    for (const combo of _bankCombinaties(lijst, bet.bedrag, 4)) {
      const datum = Math.round(combo.reduce((s, f) => s + _bankDatumScore(f, bet), 0) / combo.length);
      ruw.push({
        facturen: combo, som: _bankSom(combo), bundel: true, bedragGelijk: true,
        klantHit: klantScore >= 0.5, bron: 'afzender', teVroeg: datum < 0,
        score: 45 + Math.round(30 * klantScore) + datum,
      });
    }
  }

  for (const k of ruw) {
    const bronLabel = k.bron[0].toUpperCase() + k.bron.slice(1);
    if (k.bundel) {
      k.reden = `${k.facturen.length} facturen samen = ontvangen bedrag${k.klantHit ? ' + afzender' : ''}`;
      k.sterk = k.klantHit;
    } else if (k.bedragGelijk && k.klantHit) {
      k.reden = `Bedrag + ${k.bron}`;
      k.sterk = true;
    } else if (k.bedragGelijk && aantalBedragMatches === 1) {
      k.reden = 'Bedrag (enige openstaande factuur met dit bedrag)';
      k.sterk = true;
    } else if (k.bedragGelijk) {
      k.reden = 'Bedrag — meerdere facturen met dit bedrag, controleer';
      k.sterk = false;
    } else {
      const verschil = _bankRond(k.som - bet.bedrag);
      k.reden = verschil > 0
        ? `${bronLabel} — ${fmtEuro(verschil)} minder ontvangen dan factuur ${fmtEuro(k.som)}`
        : `${bronLabel} — bedrag wijkt af (factuur ${fmtEuro(k.som)})`;
      k.sterk = false;
    }
    // Een bijschrijving van vóór de factuurdatum kan er bijna nooit bij
    // horen: wel tonen, maar nooit alvast aanvinken.
    if (k.teVroeg) {
      k.reden += ' — let op: betaald vóór de factuurdatum';
      k.sterk = false;
    }
  }

  ruw.sort((a, b) => b.score - a.score);
  return ruw.slice(0, 6);
}

// ── Modal openen ─────────────────────────────────────────────────
function openBankimportModal() {
  _bankimportBetalingen = [];
  _bankimportOpen = [];
  showModal('Bankimport — ING CSV',
    `<p style="font-size:13.5px;color:var(--navy3);line-height:1.6;margin-bottom:14px">
       Maak in Mijn ING een export met bestandstype <strong>CSV</strong> en kies dit bestand hieronder.
       Het CRM koppelt elke bijschrijving aan een openstaande factuur op <strong>factuurnummer</strong>,
       <strong>bedrag</strong> en <strong>afzender</strong> (school of bestuur). Staat er geen factuurnummer
       in de omschrijving, dan volgt er alsnog een voorstel op bedrag en naam. Je kunt elk voorstel
       wijzigen of zelf een factuur kiezen. Pas na jouw bevestiging worden facturen op <strong>Betaald</strong> gezet.
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
      if (wrap) wrap.innerHTML = `<div style="color:var(--s-rood);font-weight:600;font-size:13px">${esc(e.message || 'Kon het bestand niet lezen.')} Controleer of het een ING CSV-export is.</div>`;
    }
  };
  reader.onerror = () => showToast('Bestand kon niet worden gelezen', 'error');
  reader.readAsText(file);
}

function buildBankimportProposals(text) {
  _bankimportBetalingen = [];
  _bankBouwTokenFreq();

  const delim = _bankDetectDelim(text);
  const rows = _bankCsvParse(text, delim);
  if (rows.length < 2) throw new Error('Leeg of onherkenbaar CSV-bestand.');

  // Kopregel → kolomindexen (ongevoelig voor hoofdletters/spaties).
  const header = rows[0].map(h => String(h).toLowerCase().replace(/[\s/]+/g, ''));
  const findCol = (...keys) => header.findIndex(h => keys.some(k => h.includes(k)));
  const idxDatum = findCol('datum');
  const idxNaam  = findCol('naam', 'omschrijving');
  const idxAfBij = findCol('afbij', 'bijaf');
  const idxBedr  = findCol('bedrag');
  const idxMede  = findCol('mededeling', 'notificatie', 'toelichting');

  if (idxBedr === -1) throw new Error('Kolom "Bedrag" niet gevonden.');

  // Openstaande facturen (verzonden of vervallen). Concept = nog niet
  // verstuurd, betaald = al klaar; die tellen niet mee.
  _bankimportOpen = DB.facturen.filter(f => f.status === 'verzonden' || f.status === 'vervallen');

  const betalingen = [];
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
    // Zoek het factuurnummer in álle tekstkolommen: sommige ING-exports
    // zetten de omschrijving in een andere kolom dan "Mededelingen".
    const overig = r.filter((_, ci) => ci !== idxBedr && ci !== idxAfBij).join(' ');
    betalingen.push({
      id: betalingen.length, datum, bedrag, naam, mededeling,
      zoektekst: `${mededeling} ${naam} ${overig}`,
      kandidaten: [], keuze: null, aangevinkt: false, afgehandeld: false,
    });
  }

  const geclaimd = new Set();
  const vrij = () => _bankimportOpen.filter(f => !geclaimd.has(f.id));
  const claim = k => k.facturen.forEach(f => geclaimd.add(f.id));

  // Ronde 1: betalingen waarin een factuurnummer staat. Die claimen hun
  // factuur eerst, zodat een losse bedrag-match hem niet kan wegkapen.
  for (const bet of betalingen) {
    const k = _bankNummerKandidaat(bet, vrij());
    if (k) { bet.kandidaten = [k]; bet.keuze = k; bet.aangevinkt = k.sterk; claim(k); }
  }

  // Ronde 2: de rest op bedrag/afzender. Steeds het sterkste voorstel van
  // alle resterende betalingen toewijzen, zodat een zekere match voorgaat
  // op een zwakke die dezelfde factuur wil.
  const rest = betalingen.filter(b => !b.keuze);
  while (true) {
    let beste = null;
    for (const bet of rest) {
      if (bet.keuze || bet.afgehandeld) continue;
      bet.kandidaten = _bankKandidaten(bet, vrij());
      const top = bet.kandidaten[0];
      if (!top) { bet.afgehandeld = true; continue; }
      if (!beste || top.score > beste.top.score) beste = { bet, top };
    }
    if (!beste) break;
    beste.bet.keuze = beste.top;
    beste.bet.aangevinkt = beste.top.sterk;
    beste.bet.afgehandeld = true;
    claim(beste.top);
  }

  // Zekere voorstellen bovenaan, daarna twijfelgevallen, dan de rest.
  betalingen.sort((a, b) => _bankSorteerRang(a) - _bankSorteerRang(b) || a.id - b.id);
  _bankimportBetalingen = betalingen;
}

function _bankSorteerRang(bet) {
  if (bet.keuze && bet.keuze.sterk) return 0;
  if (bet.keuze) return 1;
  if (bet.kandidaten.length) return 2;
  return 3;
}

// ── Keuze aanpassen ──────────────────────────────────────────────
function setBankimportKeuze(betId, val) {
  const bet = _bankimportBetalingen.find(b => b.id === betId);
  if (!bet) return;
  if (val === 'geen') {
    bet.keuze = null;
    bet.aangevinkt = false;
  } else if (val.startsWith('k:')) {
    bet.keuze = bet.kandidaten[+val.slice(2)] || null;
    bet.aangevinkt = !!bet.keuze;
  } else if (val.startsWith('f:')) {
    const f = _bankimportOpen.find(x => String(x.id) === val.slice(2));
    if (f) {
      bet.keuze = { facturen: [f], som: _bankRond(f.totaal), reden: 'Handmatig gekozen', sterk: false, handmatig: true };
      bet.aangevinkt = true;
    }
  }
  renderBankimportResult();
}

function toggleBankimportBetaling(betId, checked) {
  const bet = _bankimportBetalingen.find(b => b.id === betId);
  if (bet) bet.aangevinkt = !!checked && !!bet.keuze;
  renderBankimportSamenvatting();
}

function setAlleBankimportVinkjes(aan) {
  for (const bet of _bankimportBetalingen) bet.aangevinkt = aan && !!bet.keuze;
  renderBankimportResult();
}

// ── Resultaat tonen ──────────────────────────────────────────────
function _bankKandidaatLabel(k) {
  const nummers = k.facturen.map(f => f.nummer || '?').join(' + ');
  const klant = factuurKlantNaam(k.facturen[0]) || '—';
  return `${nummers} · ${klant} · ${fmtEuro(k.som)} — ${k.reden}`;
}

// Welke factuur is in deze bijschrijving gekozen? (voor de keuzelijst)
function _bankGekozenWaarde(bet) {
  const k = bet.keuze;
  if (!k) return 'geen';
  if (k.handmatig) return `f:${k.facturen[0].id}`;
  const idx = bet.kandidaten.indexOf(k);
  return idx >= 0 ? `k:${idx}` : 'geen';
}

function renderBankimportSamenvatting() {
  const el = document.getElementById('bankimport-samenvatting');
  if (!el) return;
  const metKeuze = _bankimportBetalingen.filter(b => b.keuze).length;
  const aangevinkt = _bankimportBetalingen.filter(b => b.aangevinkt && b.keuze);
  const aantalFacturen = aangevinkt.reduce((s, b) => s + b.keuze.facturen.length, 0);
  const zonder = _bankimportBetalingen.length - metKeuze;
  el.innerHTML = `
    <strong>${_bankimportBetalingen.length}</strong> bijschrijving(en) gelezen — ${metKeuze} met een voorstel${zonder ? `, ${zonder} zonder` : ''}.
    <br/><strong>${aangevinkt.length}</strong> aangevinkt = ${aantalFacturen} ${aantalFacturen === 1 ? 'factuur die' : 'facturen die'} op betaald word${aantalFacturen === 1 ? 't' : 'en'} gezet.
    <button class="btn btn-secondary btn-sm" style="margin-left:6px;padding:2px 8px;font-size:11.5px" onclick="setAlleBankimportVinkjes(true)">Alles aan</button>
    <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11.5px" onclick="setAlleBankimportVinkjes(false)">Alles uit</button>`;
}

function renderBankimportResult() {
  const wrap = document.getElementById('bankimport-result');
  const confirmBtn = document.getElementById('bankimport-confirm');
  if (!wrap) return;

  const oudeScroller = wrap.querySelector('.bankimport-scroll');
  const scrollTop = oudeScroller ? oudeScroller.scrollTop : 0;

  if (_bankimportBetalingen.length === 0) {
    wrap.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--bg3);border-radius:var(--r);padding:14px 16px;font-size:13px;color:var(--navy3)">
        Geen bijgeschreven bedragen in dit bestand gevonden.
      </div>`;
    if (confirmBtn) confirmBtn.style.display = 'none';
    return;
  }

  const groen = 'var(--groen)';
  const oranje = 'var(--s-oranje, #b26a00)';
  const grijs = 'var(--navy4)';

  const rijen = _bankimportBetalingen.map(bet => {
    const k = bet.keuze;
    const kleur = !k ? grijs : (k.sterk ? groen : oranje);
    const gekozen = _bankGekozenWaarde(bet);

    const voorstellen = bet.kandidaten.map((c, ci) =>
      `<option value="k:${ci}"${gekozen === `k:${ci}` ? ' selected' : ''}>${esc(_bankKandidaatLabel(c))}</option>`).join('');

    const alle = _bankimportOpen.map(f =>
      `<option value="f:${esc(f.id)}"${gekozen === `f:${f.id}` ? ' selected' : ''}>${esc(`${f.nummer || '?'} · ${factuurKlantNaam(f) || '—'} · ${fmtEuro(f.totaal)}`)}</option>`).join('');

    const mede = bet.mededeling || '';
    const medeKort = mede.length > 90 ? `${mede.slice(0, 90)}…` : mede;

    return `
      <tr>
        <td style="text-align:center;vertical-align:top;padding-top:12px">
          <input type="checkbox" id="bimp-chk-${bet.id}" ${bet.aangevinkt ? 'checked' : ''} ${k ? '' : 'disabled'}
                 onchange="toggleBankimportBetaling(${bet.id}, this.checked)"
                 style="width:17px;height:17px;cursor:${k ? 'pointer' : 'not-allowed'}"/>
        </td>
        <td style="vertical-align:top;min-width:185px">
          <div style="font-weight:700;white-space:nowrap">${fmtEuro(bet.bedrag)}
            <span style="font-weight:500;color:var(--navy3);font-size:12.5px">· ${esc(_bankFmtDatum(bet.datum))}</span></div>
          <div style="font-size:12.5px;color:var(--navy3)">${esc(bet.naam || '—')}</div>
          ${medeKort ? `<div style="font-size:11.5px;color:${grijs};margin-top:2px" title="${esc(mede)}">${esc(medeKort)}</div>` : ''}
        </td>
        <td style="vertical-align:top;min-width:280px">
          <select onchange="setBankimportKeuze(${bet.id}, this.value)"
                  style="width:100%;max-width:430px;padding:6px 8px;border:2px solid var(--bg3);border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:12.5px;font-weight:600;color:var(--navy);background:white;cursor:pointer">
            <option value="geen"${gekozen === 'geen' ? ' selected' : ''}>— niet koppelen —</option>
            ${voorstellen ? `<optgroup label="Voorstellen">${voorstellen}</optgroup>` : ''}
            <optgroup label="Alle openstaande facturen">${alle}</optgroup>
          </select>
          <div style="font-size:11.5px;color:${kleur};font-weight:600;margin-top:4px">
            ${k ? esc(k.reden) : (bet.kandidaten.length ? 'Voorstel beschikbaar — kies hierboven' : 'Geen passende openstaande factuur gevonden')}
          </div>
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div id="bankimport-samenvatting" style="margin-top:6px;margin-bottom:10px;font-size:13px;color:var(--navy3)"></div>
    <div class="table-wrap bankimport-scroll" style="max-height:380px;overflow:auto">
      <table>
        <thead><tr>
          <th style="width:36px;text-align:center">✓</th>
          <th>Bijschrijving</th>
          <th>Koppelen aan factuur</th>
        </tr></thead>
        <tbody>${rijen}</tbody>
      </table>
    </div>
    <div style="margin-top:8px;font-size:12px;color:var(--navy4)">
      Groen = zekere match (alvast aangevinkt). Oranje = voorstel dat je zelf beoordeelt.
      Via de keuzelijst kun je altijd een andere openstaande factuur kiezen.
    </div>`;

  renderBankimportSamenvatting();
  const nieuweScroller = wrap.querySelector('.bankimport-scroll');
  if (nieuweScroller && scrollTop) nieuweScroller.scrollTop = scrollTop;
  if (confirmBtn) confirmBtn.style.display = '';
}

// ── Bevestigen → facturen op betaald zetten ──────────────────────
async function confirmBankimport() {
  const gekozen = _bankimportBetalingen.filter(b => b.aangevinkt && b.keuze);
  const ids = [...new Set(gekozen.flatMap(b => b.keuze.facturen.map(f => f.id)))];
  if (ids.length === 0) return alert('Vink minimaal één bijschrijving aan.');
  if (!confirm(`${ids.length} ${ids.length === 1 ? 'factuur' : 'facturen'} als betaald markeren?`)) return;

  showLoading();
  let gelukt = 0;
  try {
    for (const id of ids) {
      try {
        await supa(`/rest/v1/facturen?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'betaald' }) });
        DB.facturen = DB.facturen.map(f => f.id === id ? { ...f, status: 'betaald' } : f);
        gelukt++;
      } catch (e) {
        console.error('Factuur bijwerken mislukt:', id, e);
      }
    }
    closeModal();
    renderContent();
    if (gelukt === ids.length) showToast(`${gelukt} ${gelukt === 1 ? 'factuur' : 'facturen'} op betaald gezet`, 'success');
    else showToast(`${gelukt} van ${ids.length} bijgewerkt — controleer de rest`, 'error');
  } catch (e) {
    toastError(e);
  } finally {
    hideLoading();
  }
}
