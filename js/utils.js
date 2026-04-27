// ════════════════════════════════════════════════════════════════
// UTILS — SVG Icons, Formatting, Helpers
// ════════════════════════════════════════════════════════════════

const ICONS = {
  board:     `<path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>`,
  school:    `<path d="M12 3L1 9l11 6 9-5V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>`,
  contact:   `<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>`,
  invoice:   `<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 16h8v2H8zm0-4h8v2H8zm0-4h5v2H8z"/>`,
  add:       `<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>`,
  edit:      `<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>`,
  trash:     `<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>`,
  close:     `<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>`,
  chevron:   `<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>`,
  chevronL:  `<path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>`,
  list:      `<path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>`,
  note:      `<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>`,
  mail:      `<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>`,
  phone:     `<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>`,
  web:       `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>`,
  location:  `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>`,
  euro:      `<path d="M15 18.5c-2.51 0-4.68-1.42-5.76-3.5H15v-2H8.58c-.05-.33-.08-.66-.08-1s.03-.67.08-1H15V9H9.24C10.32 6.92 12.5 5.5 15 5.5c1.61 0 3.09.59 4.23 1.57L21 5.3C19.41 3.87 17.3 3 15 3c-3.92 0-7.24 2.51-8.48 6H3v2h3.06c-.04.33-.06.66-.06 1s.02.67.06 1H3v2h3.52c1.24 3.49 4.56 6 8.48 6 2.31 0 4.41-.87 6-2.3l-1.78-1.77c-1.13.98-2.6 1.57-4.22 1.57z"/>`,
  search:    `<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>`,
  print:     `<path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>`,
  eye:       `<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>`,
  training:  `<path d="M12 3L1 9l4 2.18V15h2v-2.82L9 13.36V17c0 1.1 2.69 2 6 2s6-.9 6-2v-3.64l3-1.36L12 3zm5 13.5c0 .17-.43.55-1.5.88C14.5 17.6 13.27 17.8 12 17.8s-2.5-.2-3.5-.42C7.43 17.05 7 16.67 7 16.5V14.7l5 2.27 5-2.27v1.8zM12 15.5L5.59 12.5 12 9.5l6.41 3-6.41 3z"/>`,
  star:      `<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>`,
  star_empty:`<path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/>`,
  lightning: `<path d="M7 2v11h3v9l7-12h-4l4-8z"/>`,
  tip:       `<path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>`,
  logout:    `<path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>`,
  settings:  `<path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>`,
  calendar:  `<path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>`,
  clock:     `<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>`,
  download:  `<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>`,
};

function svgIcon(name, size = 16) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" style="flex-shrink:0">${ICONS[name] || ''}</svg>`;
}

// ── Formatting ────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateShort(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('nl-NL');
}

function fmtEuro(n) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function getFactuurJaar(factuur) {
  if (!factuur) return '';

  const nummer = String(factuur.nummer || '');
  const datum = String(factuur.datum || '').trim();
  const nummerMatch = nummer.match(/(20\d{2})/);
  if (nummerMatch) return nummerMatch[1];

  if (/^\d{4}-\d{2}-\d{2}$/.test(datum)) return datum.slice(0, 4);

  const datumMatch = datum.match(/(?:^|\D)(20\d{2})(?:\D|$)/);
  if (datumMatch) return datumMatch[1];

  const delen = datum.split(/[\-\/\.]/).map(x => x.trim()).filter(Boolean);
  if (delen.length === 3 && /^\d{4}$/.test(delen[2])) return delen[2];

  return '';
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Zet platte tekst om naar veilige HTML, waarbij http(s)://… en www.…
// URL's klikbaar worden. Input wordt eerst ge-escape't, zodat gebruikers
// geen HTML kunnen injecteren.
function linkify(s) {
  if (s == null) return '';
  const escaped = esc(s);
  return escaped.replace(/\b(https?:\/\/|www\.)[^\s<]+/gi, match => {
    const trailMatch = match.match(/[.,;:!?)\]]+$/);
    const trailing = trailMatch ? trailMatch[0] : '';
    const clean = trailing ? match.slice(0, -trailing.length) : match;
    const href = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--blue);text-decoration:underline;word-break:break-all">${clean}</a>${trailing}`;
  });
}

// ── Foutmelding-vertaling ─────────────────────────────────────────
// Zet rauwe Supabase/PostgREST-errors om in begrijpelijke NL-tekst.
function mapSupaError(err) {
  const raw = err?.message || String(err || '');
  let code = '', detail = '', hint = '';
  const m = raw.match(/\{.*\}/s);
  if (m) {
    try { const j = JSON.parse(m[0]); code = j.code || ''; detail = j.details || ''; hint = j.hint || ''; } catch {}
  }

  if (code === '23505' || /duplicate key/i.test(raw))       return 'Dit item bestaat al (dubbele waarde).';
  if (code === '23503' || /foreign key/i.test(raw))         return 'Kan niet opslaan: verwijst naar iets dat (nog) niet bestaat.';
  if (code === '23502' || /null value in column/i.test(raw))return 'Een verplicht veld is niet ingevuld.';
  if (code === '23514' || /check constraint/i.test(raw))    return 'Waarde voldoet niet aan de regels van dit veld.';
  if (code === 'PGRST204' || /schema cache/i.test(raw))     return 'De database mist een kolom die de app gebruikt. Ververs de pagina; neem contact op als dit blijft.';
  if (code === 'PGRST116' || /0 rows/i.test(raw))           return 'Niets gevonden om te bewerken.';
  if (code === '42501' || /permission denied/i.test(raw))   return 'Geen rechten voor deze actie.';
  if (/^Supabase 401/.test(raw) || /JWT|invalid.*token/i.test(raw)) return 'Je sessie is verlopen. Log opnieuw in.';
  if (/^Supabase 403/.test(raw))                             return 'Geen toegang tot deze gegevens.';
  if (/^Supabase 404/.test(raw))                             return 'Niet gevonden.';
  if (/^Supabase 409/.test(raw))                             return 'Conflict: iemand of iets anders wijzigde dit net.';
  if (/^Supabase 5\d\d/.test(raw) || /fetch|NetworkError/i.test(raw)) return 'Server niet bereikbaar. Controleer je verbinding en probeer opnieuw.';

  return detail || hint || 'Er ging iets mis. Probeer het opnieuw.';
}

function toastError(err) { showToast(mapSupaError(err), 'error'); console.error(err); }

function badge(type) {
  const map = { beslisser: 'Beslisser', beinvloeder: 'Beïnvloeder', concept: 'Concept', verzonden: 'Verzonden', betaald: 'Betaald', vervallen: 'Vervallen' };
  return `<span class="badge badge-${esc(type)}">${esc(map[type] || type)}</span>`;
}

// ── Bijlagen helpers (oud, base64 — legacy) ──────────────────────
function downloadBijlage(dossierId, bijlageIdx) {
  const d = DB.dossiers.find(x => x.id === dossierId);
  if (!d || !d.bijlagen || !d.bijlagen[bijlageIdx]) return;
  const b = d.bijlagen[bijlageIdx];
  const a = document.createElement('a');
  a.href = b.data;
  a.download = b.naam;
  a.click();
}

// ── Supabase Storage helpers (nieuw, bucket: dossier-bestanden) ──
const STORAGE_BUCKET = 'dossier-bestanden';

async function uploadBestandToStorage(dossierId, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${dossierId}/${Date.now()}_${safeName}`;
  const res = await fetch(`${SUPA_URL}/storage/v1/object/${STORAGE_BUCKET}/${encodeURI(path)}`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false'
    },
    body: file
  });
  if (!res.ok) throw new Error(`Upload mislukt: ${res.status} ${await res.text()}`);
  return { naam: file.name, pad: path, mimetype: file.type || '', grootte: file.size };
}

async function downloadStorageBestand(b) {
  if (!b?.pad) return;
  try {
    const res = await fetch(`${SUPA_URL}/storage/v1/object/sign/${STORAGE_BUCKET}/${encodeURI(b.pad)}`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: 60 })
    });
    if (!res.ok) throw new Error(await res.text());
    const { signedURL } = await res.json();
    const url = `${SUPA_URL}/storage/v1${signedURL}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = b.naam;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    showToast('Download mislukt: ' + e.message, 'error');
  }
}

async function downloadBestand(dossierId, idx) {
  const d = DB.dossiers.find(x => x.id === dossierId);
  if (!d || !d.bestanden || !d.bestanden[idx]) return;
  await downloadStorageBestand(d.bestanden[idx]);
}

async function downloadTrainingBestand(trainingId, idx) {
  const t = getTraining(trainingId);
  if (!t || !t.bestanden || !t.bestanden[idx]) return;
  await downloadStorageBestand(t.bestanden[idx]);
}

async function deleteBestandFromStorage(path) {
  await fetch(`${SUPA_URL}/storage/v1/object/${STORAGE_BUCKET}/${encodeURI(path)}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`
    }
  });
}

function fmtBytes(n) {
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function bijlageIcon(type) {
  if (!type) return '📎';
  if (type.includes('pdf')) return '📄';
  if (type.includes('image')) return '🖼️';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('excel') || type.includes('sheet')) return '📊';
  if (type.includes('powerpoint') || type.includes('presentation')) return '📑';
  if (type.includes('zip') || type.includes('compressed')) return '🗜️';
  return '📎';
}

function renderBijlagen(d, schoolId) {
  if (!d.bijlagen || d.bijlagen.length === 0) return '';
  return `<div class="dossier-bijlagen">${d.bijlagen.map((b, i) => `
    <span class="bijlage-chip" onclick="downloadBijlage('${d.id}',${i})" title="Klik om te downloaden">
      ${bijlageIcon(b.type)} ${esc(b.naam)}
      <span class="bijlage-del" onclick="event.stopPropagation();delBijlage('${d.id}',${i},'${schoolId}')" title="Verwijder bijlage">×</span>
    </span>`).join('')}
  </div>`;
}

function toggleDossier(el) {
  const item = el.closest('.dossier-item');
  if (item) item.classList.toggle('open');
}

// Render een dossier-item met inklapbare body.
// opts: { delBtn: 'delDossier'|'delDossierBestuur'|null, delArg: string, schoolLabel?: string }
function renderDossierItem(d, opts = {}) {
  const { delBtn, delArg, schoolLabel } = opts;
  const titel = d.onderwerp || '(geen onderwerp)';
  const isBestand = d.type === 'bestand';
  const typeIcon = isBestand ? '📎' : '📝';
  const typeCls  = isBestand ? 'dossier-type-bestand' : 'dossier-type-notitie';

  let bodyInhoud = '';
  if (isBestand && d.bestanden?.length) {
    bodyInhoud = `<div class="dossier-bestanden">${d.bestanden.map((b, i) => `
      <span class="bijlage-chip" onclick="downloadBestand('${d.id}',${i})" title="Klik om te downloaden">
        ${bijlageIcon(b.mimetype)} ${esc(b.naam)} <span style="color:var(--navy4);font-size:11px">(${fmtBytes(b.grootte)})</span>
      </span>`).join('')}
    </div>`;
  } else {
    bodyInhoud = `<div class="dossier-text">${esc(d.tekst || '')}</div>${renderBijlagen(d, d.schoolId)}`;
  }

  const factuurLink = renderFactuurLinkVoorDossier(d);

  return `
    <div class="dossier-item ${typeCls}">
      <div class="dossier-header" onclick="toggleDossier(this)">
        <span class="dossier-type-icon" title="${isBestand ? 'Bestand' : 'Notitie'}">${typeIcon}</span>
        <span class="dossier-toggle">${svgIcon('chevron', 12)}</span>
        <span class="dossier-onderwerp">${esc(titel)}</span>
        <span class="dossier-date">${fmtDate(d.datum)}</span>
        ${delBtn ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();${delBtn}('${d.id}','${delArg}')">${svgIcon('trash', 13)}</button>` : ''}
      </div>
      <div class="dossier-body">
        <div style="font-size:12px;color:var(--navy4);margin-bottom:6px">
          ${esc(d.bronNaam || '')}${schoolLabel ? ` <span style="background:var(--bg3);border-radius:4px;padding:2px 7px;margin-left:4px">${esc(schoolLabel)}</span>` : ''}
        </div>
        ${bodyInhoud}
        ${factuurLink}
      </div>
    </div>`;
}

// Vind de factuur die hoort bij een dossiernotitie (onderwerp "Factuur {nummer}"
// en zelfde school) of null als er geen match is.
function findFactuurVoorDossier(d) {
  if (!d || !d.onderwerp || !d.schoolId) return null;
  const m = String(d.onderwerp).match(/^\s*factuur\s+(\S.*?)\s*$/i);
  if (!m) return null;
  const nummer = m[1].trim();
  if (typeof facturenVanSchool !== 'function') return null;
  return facturenVanSchool(d.schoolId).find(f => String(f.nummer || '').trim() === nummer) || null;
}

// Dossier-items die een factuur weerspiegelen worden niet onder Dossier
// getoond; die zijn al zichtbaar onder de Facturen-tab.
function isFactuurDossier(d) {
  return !!findFactuurVoorDossier(d);
}

function renderFactuurLinkVoorDossier(d) {
  const factuur = findFactuurVoorDossier(d);
  if (!factuur) return '';
  return `
    <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="printFactuur('${factuur.id}')">${svgIcon('eye', 14)} Factuur ${esc(factuur.nummer)} bekijken</button>
      <button class="btn btn-secondary btn-sm" onclick="openFactuurModal('${factuur.schoolId}','${factuur.id}')">${svgIcon('edit', 14)} Factuur bewerken</button>
    </div>`;
}

// ── Globale zoekfunctie ──────────────────────────────────────────
let _globalSearchTimeout = null;
let _globalSearchItems = [];
let _globalSearchIdx = 0;

function globalSearch(q) {
  clearTimeout(_globalSearchTimeout);
  _globalSearchTimeout = setTimeout(() => renderGlobalResults(q), 150);
}

function showGlobalResults() {
  const q = document.getElementById('global-search')?.value || '';
  if (q.length >= 2) renderGlobalResults(q);
}

// Score: 0 = no match, hoger = betere match
function _searchScore(text, lq) {
  if (!text) return 0;
  const lt = String(text).toLowerCase();
  if (lt === lq) return 100;
  if (lt.startsWith(lq)) return 60;
  if (lt.split(/[\s\-_.]/).some(w => w.startsWith(lq))) return 40;
  if (lt.includes(lq)) return 20;
  return 0;
}

// Highlight de eerste match in de tekst
function _highlightMatch(text, lq) {
  if (!text) return '';
  const e = esc(text);
  if (!lq) return e;
  const idx = e.toLowerCase().indexOf(lq);
  if (idx === -1) return e;
  return e.slice(0, idx) + '<mark class="gs-mark">' + e.slice(idx, idx + lq.length) + '</mark>' + e.slice(idx + lq.length);
}

function renderGlobalResults(q) {
  const el = document.getElementById('global-search-results');
  if (!el) return;
  if (!q || q.length < 2) { el.style.display = 'none'; _globalSearchItems = []; return; }

  const lq = q.toLowerCase().trim();
  const groups = {
    scholen:    { label: 'Scholen',    items: [] },
    besturen:   { label: 'Besturen',   items: [] },
    contacten:  { label: 'Contacten',  items: [] },
    facturen:   { label: 'Facturen',   items: [] },
    trainingen: { label: 'Trainingen', items: [] },
    agenda:     { label: 'Agenda',     items: [] },
  };

  DB.scholen.forEach(s => {
    const sc = Math.max(_searchScore(s.naam, lq), _searchScore(s.plaats, lq));
    if (sc > 0) groups.scholen.items.push({ icon: 'school', label: s.naam, sub: s.plaats || '', score: sc, action: () => navigate('school-detail', s.id) });
  });

  DB.besturen.forEach(b => {
    const sc = _searchScore(b.naam, lq);
    if (sc > 0) groups.besturen.items.push({ icon: 'board', label: b.naam, sub: 'Bestuur', score: sc, action: () => navigate('bestuur-detail', b.id) });
  });

  DB.contacten.forEach(c => {
    const sc = Math.max(_searchScore(c.naam, lq), _searchScore(c.email, lq), _searchScore(c.functie, lq));
    if (sc > 0) {
      const s = getSchool(c.schoolId);
      groups.contacten.items.push({ icon: 'contact', label: c.naam, sub: [c.functie, s?.naam].filter(Boolean).join(' — '), score: sc, action: () => navigateToContact(c.schoolId, c.id) });
    }
  });

  DB.facturen.forEach(f => {
    const sc = Math.max(_searchScore(f.nummer, lq), _searchScore(f.betreft, lq));
    if (sc > 0) {
      const s = getSchool(f.schoolId);
      groups.facturen.items.push({ icon: 'invoice', label: `Factuur ${f.nummer || ''}`, sub: [s?.naam, fmtEuro(f.totaal)].filter(Boolean).join(' — '), score: sc, action: () => openFactuurModal(f.schoolId, f.id) });
    }
  });

  DB.trainingen.forEach(t => {
    const typeLabel = typeof trainingTypeLabel === 'function' ? trainingTypeLabel(t.type) : (t.type || '');
    const categoryLabel = typeof trainingCategoryLabel === 'function' ? trainingCategoryLabel(t.categorie) : (t.categorie || '');
    const sub = [typeLabel, categoryLabel].filter(Boolean).join(' — ');
    const sc = Math.max(_searchScore(t.naam, lq), _searchScore(typeLabel, lq), _searchScore(categoryLabel, lq));
    if (sc > 0) groups.trainingen.items.push({ icon: 'training', label: t.naam, sub, score: sc, action: () => navigate('training-detail', t.id) });
  });

  (DB.agenda || []).forEach(a => {
    const sc = Math.max(_searchScore(a.titel, lq), _searchScore(a.locatie, lq));
    if (sc > 0) {
      const tijd = a.beginTijd ? ' ' + fmtTijd(a.beginTijd) : '';
      const sub = `${fmtDateShort(a.datum)}${tijd}${a.locatie ? ' · ' + a.locatie : ''}`;
      groups.agenda.items.push({ icon: 'calendar', label: a.titel, sub, score: sc, action: () => { navigate('agenda'); setTimeout(() => openAgendaModal(a.id), 60); } });
    }
  });

  // Per groep sorteren op score, cappen op 5
  const MAX_PER_GROUP = 5;
  _globalSearchItems = [];
  const sections = [];
  Object.values(groups).forEach(g => {
    if (g.items.length === 0) return;
    g.items.sort((a, b) => b.score - a.score);
    const capped = g.items.slice(0, MAX_PER_GROUP);
    sections.push({ label: g.label, items: capped });
    _globalSearchItems.push(...capped);
  });

  _globalSearchIdx = 0;

  if (_globalSearchItems.length === 0) {
    el.innerHTML = '<div class="gs-empty">Geen resultaten voor "' + esc(q) + '"</div>';
    el.style.display = 'block';
    return;
  }

  let idx = 0;
  const html = sections.map(s => `
    <div class="gs-group-label">${esc(s.label)}</div>
    ${s.items.map(r => {
      const myIdx = idx++;
      return `<div class="gs-row" data-idx="${myIdx}" onclick="_execGlobalResult(${myIdx})">
        <span class="gs-icon">${svgIcon(r.icon, 15)}</span>
        <div class="gs-text">
          <div class="gs-label">${_highlightMatch(r.label, lq)}</div>
          ${r.sub ? `<div class="gs-sub">${_highlightMatch(r.sub, lq)}</div>` : ''}
        </div>
      </div>`;
    }).join('')}
  `).join('');

  const footer = '<div class="gs-footer"><kbd>↑</kbd><kbd>↓</kbd> navigeren &nbsp;·&nbsp; <kbd>Enter</kbd> openen &nbsp;·&nbsp; <kbd>Esc</kbd> sluiten</div>';

  el.innerHTML = html + footer;
  el.style.display = 'block';
  _updateGlobalSearchHighlight();
}

function _updateGlobalSearchHighlight() {
  const el = document.getElementById('global-search-results');
  if (!el) return;
  el.querySelectorAll('.gs-row').forEach((row, i) => {
    row.classList.toggle('is-active', i === _globalSearchIdx);
  });
  const active = el.querySelector('.gs-row.is-active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function _execGlobalResult(idx) {
  const item = _globalSearchItems[idx];
  if (!item) return;
  const input = document.getElementById('global-search');
  const el = document.getElementById('global-search-results');
  if (input) input.value = '';
  if (el) el.style.display = 'none';
  item.action();
}

// Globale toetsen: Ctrl/Cmd+K focust zoek, pijltjes/enter/esc in de resultaten
document.addEventListener('keydown', (e) => {
  const input = document.getElementById('global-search');

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (input) { input.focus(); input.select(); }
    return;
  }

  if (document.activeElement !== input) return;
  const el = document.getElementById('global-search-results');

  if (e.key === 'Escape') {
    if (el) el.style.display = 'none';
    input.blur();
    return;
  }

  if (!el || el.style.display === 'none' || _globalSearchItems.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _globalSearchIdx = (_globalSearchIdx + 1) % _globalSearchItems.length;
    _updateGlobalSearchHighlight();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _globalSearchIdx = (_globalSearchIdx - 1 + _globalSearchItems.length) % _globalSearchItems.length;
    _updateGlobalSearchHighlight();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    _execGlobalResult(_globalSearchIdx);
  }
});

// Sluit zoekresultaten bij klik buiten
document.addEventListener('click', (e) => {
  const el = document.getElementById('global-search-results');
  const input = document.getElementById('global-search');
  if (el && !el.contains(e.target) && e.target !== input) el.style.display = 'none';
});
