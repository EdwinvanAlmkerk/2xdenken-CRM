// ════════════════════════════════════════════════════════════════
// E-MAIL PAGINA — Mappen, verzonden items, concepten
// ════════════════════════════════════════════════════════════════
let _emailFolder = 'verzonden';
let _emailSearch = '';
let _emailSelected = null;

function setEmailFolder(f) { _emailFolder = f; _emailSelected = null; renderContent(); }
function searchEmail(v) { _emailSearch = v; smartRender(() => renderEmailPage()); }

function renderEmailPage() {
  const folders = [
    { id: 'verzonden', label: 'Verzonden', icon: 'chevron', count: DB.emailLog.filter(e => e.status === 'verzonden').length },
    { id: 'concepten', label: 'Concepten', icon: 'edit', count: DB.emailLog.filter(e => e.status === 'concept').length },
  ];

  // Items voor huidige map
  let items = DB.emailLog.filter(e => {
    if (_emailFolder === 'verzonden') return e.status === 'verzonden';
    if (_emailFolder === 'concepten') return e.status === 'concept';
    return true;
  });

  // Zoekfilter
  if (_emailSearch) {
    const q = _emailSearch.toLowerCase();
    items = items.filter(e =>
      (e.onderwerp || '').toLowerCase().includes(q) ||
      (e.aanNaam || '').toLowerCase().includes(q) ||
      (e.aanEmail || '').toLowerCase().includes(q) ||
      (e.body || '').toLowerCase().includes(q)
    );
  }

  // Sorteren op datum (nieuwste eerst)
  items.sort((a, b) => new Date(b.datum) - new Date(a.datum));

  // Geselecteerd item
  const selected = _emailSelected ? DB.emailLog.find(e => e.id === _emailSelected) : items[0] || null;

  return `
    <div style="display:flex;gap:0;height:calc(100vh - 150px);border-radius:var(--r2);overflow:hidden;border:1px solid var(--glass-border)">

      <!-- Linker paneel: mappen + lijst -->
      <div style="width:340px;min-width:340px;display:flex;flex-direction:column;background:var(--card-bg);border-right:1px solid var(--glass-border)">

        <!-- Mappen -->
        <div style="padding:16px;border-bottom:1px solid var(--glass-border)">
          <button class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:12px" onclick="openEmailModal({})">
            ${svgIcon('mail', 15)} Nieuw bericht
          </button>
          <div style="display:flex;flex-direction:column;gap:2px">
            ${folders.map(f => `
              <div onclick="setEmailFolder('${f.id}')" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13.5px;font-weight:${_emailFolder === f.id ? '600' : '400'};color:${_emailFolder === f.id ? 'var(--accent)' : 'var(--navy3)'};background:${_emailFolder === f.id ? 'var(--mint)' : 'transparent'};transition:all .15s">
                ${svgIcon(f.icon, 15)}
                <span style="flex:1">${f.label}</span>
                ${f.count > 0 ? `<span style="font-size:11px;font-weight:700;background:${_emailFolder === f.id ? 'rgba(26,184,184,0.15)' : 'var(--glass)'};color:${_emailFolder === f.id ? 'var(--accent)' : 'var(--navy4)'};padding:2px 8px;border-radius:10px">${f.count}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Zoek -->
        <div style="padding:10px 16px;border-bottom:1px solid var(--glass-border)">
          <div class="search-wrap">
            <span class="search-icon">${svgIcon('search', 14)}</span>
            <input type="text" placeholder="Zoeken..." value="${esc(_emailSearch)}" oninput="searchEmail(this.value)" style="padding-left:34px;font-size:13px;padding-top:8px;padding-bottom:8px"/>
          </div>
        </div>

        <!-- E-mail lijst -->
        <div style="flex:1;overflow-y:auto">
          ${items.length === 0
            ? `<div style="text-align:center;padding:40px 20px;color:var(--navy4)">
                ${svgIcon('mail', 32)}
                <p style="font-size:13px;margin-top:8px">Geen berichten</p>
              </div>`
            : items.map(e => {
                const isActive = selected && e.id === selected.id;
                const school = e.schoolId ? DB.scholen.find(s => s.id === e.schoolId) : null;
                return `
                  <div onclick="_emailSelected='${e.id}';renderContent()" style="padding:12px 16px;border-bottom:1px solid ${isActive ? 'transparent' : 'rgba(0,0,0,0.04)'};cursor:pointer;background:${isActive ? 'var(--mint)' : 'transparent'};transition:background .12s;border-left:3px solid ${isActive ? 'var(--accent)' : 'transparent'}">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                      <span style="font-size:13px;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${esc(e.aanNaam || e.aanEmail)}</span>
                      <span style="font-size:11px;color:var(--navy4);white-space:nowrap;margin-left:8px">${fmtDateShort(e.datum)}</span>
                    </div>
                    <div style="font-size:12.5px;font-weight:500;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.onderwerp || '(geen onderwerp)')}</div>
                    <div style="font-size:11.5px;color:var(--navy4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${esc((e.body || '').slice(0, 80))}</div>
                    ${school ? `<div style="font-size:10.5px;color:var(--navy4);margin-top:3px">${svgIcon('school', 11)} ${esc(school.naam)}</div>` : ''}
                  </div>`;
              }).join('')}
        </div>
      </div>

      <!-- Rechter paneel: e-mail detail -->
      <div style="flex:1;display:flex;flex-direction:column;background:var(--glass);overflow:hidden">
        ${selected ? renderEmailDetail(selected) : `
          <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--navy4);flex-direction:column;gap:10px">
            ${svgIcon('mail', 48)}
            <p style="font-size:14px">Selecteer een bericht</p>
          </div>`}
      </div>

    </div>`;
}

function renderEmailDetail(e) {
  const contact = e.contactId ? DB.contacten.find(c => c.id === e.contactId) : null;
  const school = e.schoolId ? DB.scholen.find(s => s.id === e.schoolId) : null;
  const factuur = e.factuurId ? DB.facturen.find(f => f.id === e.factuurId) : null;

  return `
    <!-- Header -->
    <div style="padding:20px 24px;border-bottom:1px solid var(--glass-border);background:rgba(255,255,255,0.3)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <h3 style="font-size:18px;font-weight:700;color:var(--navy);flex:1;margin-right:16px">${esc(e.onderwerp || '(geen onderwerp)')}</h3>
        <div style="display:flex;gap:6px;flex-shrink:0">
          ${e.status === 'concept'
            ? `<button class="btn btn-primary btn-sm" onclick="openEmailFromDraft('${e.id}')">${svgIcon('edit', 13)} Bewerken</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="forwardEmail('${e.id}')">${svgIcon('chevron', 13)} Doorsturen</button>`}
          <button class="btn btn-ghost btn-icon btn-sm" title="Verwijderen" onclick="delEmailLog('${e.id}')" style="color:var(--s-rood)">${svgIcon('trash', 14)}</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;font-size:13px">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;flex-shrink:0">
          ${esc((e.aanNaam || e.aanEmail || '?')[0].toUpperCase())}
        </div>
        <div style="flex:1">
          <div style="font-weight:600;color:var(--navy)">${esc(e.aanNaam || '')} <span style="color:var(--navy4);font-weight:400">&lt;${esc(e.aanEmail)}&gt;</span></div>
          <div style="font-size:12px;color:var(--navy4)">${fmtDate(e.datum)}${e.status === 'concept' ? ' · <span style="color:var(--geel);font-weight:600">Concept</span>' : ''}</div>
        </div>
      </div>
      ${(school || factuur) ? `<div style="display:flex;gap:12px;margin-top:10px;font-size:12px;color:var(--navy4)">
        ${school ? `<span>${svgIcon('school', 12)} ${esc(school.naam)}</span>` : ''}
        ${factuur ? `<span>${svgIcon('invoice', 12)} Factuur ${esc(factuur.nummer)}</span>` : ''}
      </div>` : ''}
    </div>

    <!-- Body -->
    <div style="flex:1;overflow-y:auto;padding:24px;font-size:14px;color:var(--navy3);line-height:1.7;white-space:pre-wrap">${esc(e.body)}</div>`;
}
