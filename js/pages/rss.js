// ════════════════════════════════════════════════════════════════
// RSS-FEEDREADER — Twee-pane lijst + artikelweergave
// ════════════════════════════════════════════════════════════════
//
// Architectuur:
//   - rss_feeds (Supabase)         : configureerbare feeds (naam, url)
//   - rss_items_read (Supabase)    : gelezen-status per item, cross-device
//   - Edge Function /fetch-rss     : proxy die CORS-probleem oplost
//   - In-memory _rssItemsByFeed[]  : geparseerde feed-items per feedId
//
// Items worden niet in de database opgeslagen — ze worden bij elk laden
// opnieuw uit de feed gehaald. Alleen de lees-status persisteert.

let _rssActiveFeed = prefGet('rss.activeFeed', 'alle');     // 'alle' | feedId
let _rssActiveFilter = prefGet('rss.activeFilter', 'alle'); // 'alle' | 'ongelezen'
let _rssSelectedItemId = null;          // "feedId::itemGuid"
let _rssItemsByFeed = {};               // { feedId: [items] }
let _rssLoadingFeeds = new Set();
let _rssLastLoadedAt = 0;
let _rssReadIndex = null;               // Set van "feedId::itemGuid" voor O(1) lookup
let _rssVisibleItemsCache = [];         // bewaard tussen render en click — onclick werkt op index om guid-quote-issues te vermijden

const RSS_FETCH_PATH = '/functions/v1/fetch-rss';
const RSS_RELOAD_INTERVAL_MS = 5 * 60 * 1000;
const RSS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagen

// Items zonder geldige pubDate (pubDateMs === 0) worden getoond — die filter-uit
// zou complete feeds onzichtbaar maken als parsen mislukt.
function _rssItemRecent(item) {
  if (!item.pubDateMs) return true;
  return Date.now() - item.pubDateMs <= RSS_MAX_AGE_MS;
}

// ── Lees-status index ──────────────────────────────────────────
function _rssBuildReadIndex() {
  _rssReadIndex = new Set();
  for (const r of DB.rssItemsRead || []) {
    _rssReadIndex.add(`${r.feedId}::${r.itemGuid}`);
  }
}

function rssIsRead(feedId, itemGuid) {
  if (!_rssReadIndex) _rssBuildReadIndex();
  return _rssReadIndex.has(`${feedId}::${itemGuid}`);
}

// ── Feed ophalen via Edge Function ─────────────────────────────
async function _rssFetchFeed(url) {
  const proxied = `${SUPA_URL}${RSS_FETCH_PATH}?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxied, {
    headers: {
      'Authorization': `Bearer ${currentSession?.access_token || SUPA_KEY}`,
      'apikey': SUPA_KEY,
    },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }
  return await res.text();
}

// ── XML-parser voor RSS 2.0 + Atom 1.0 ─────────────────────────
function _rssParseXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Kan feed niet lezen (XML-fout)');

  // RSS 2.0
  const items = [...doc.querySelectorAll('rss > channel > item, channel > item')];
  if (items.length) {
    return items.map(it => _rssItemFromRss(it));
  }
  // Atom 1.0
  const entries = [...doc.querySelectorAll('feed > entry, entry')];
  if (entries.length) {
    return entries.map(it => _rssItemFromAtom(it));
  }
  throw new Error('Onbekend feed-formaat');
}

function _rssItemFromRss(node) {
  const get = sel => node.querySelector(sel)?.textContent?.trim() || '';
  const link = get('link') || node.querySelector('link')?.getAttribute('href') || '';
  const guid = get('guid') || link || get('title');
  const pubDate = get('pubDate') || get('dc\\:date') || '';
  // Voorkeur voor content:encoded boven description (vaak rijker)
  const contentEncoded = node.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')[0]?.textContent?.trim() || '';
  const description = get('description');
  const html = contentEncoded || description || '';
  return {
    guid,
    title: get('title') || '(zonder titel)',
    link,
    pubDate,
    pubDateMs: _rssParseDate(pubDate),
    summary: _rssTextSnippet(description || contentEncoded, 240),
    contentHtml: html,
    author: get('author') || get('dc\\:creator') || '',
  };
}

function _rssItemFromAtom(node) {
  const get = sel => node.querySelector(sel)?.textContent?.trim() || '';
  const linkEl = [...node.querySelectorAll('link')].find(l => !l.getAttribute('rel') || l.getAttribute('rel') === 'alternate') || node.querySelector('link');
  const link = linkEl?.getAttribute('href') || '';
  const guid = get('id') || link || get('title');
  const updated = get('updated') || get('published') || '';
  const summary = get('summary');
  const content = node.querySelector('content')?.innerHTML?.trim() || '';
  return {
    guid,
    title: get('title') || '(zonder titel)',
    link,
    pubDate: updated,
    pubDateMs: _rssParseDate(updated),
    summary: _rssTextSnippet(summary || content, 240),
    contentHtml: content || summary || '',
    author: node.querySelector('author > name')?.textContent?.trim() || '',
  };
}

function _rssParseDate(s) {
  if (!s) return 0;
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

function _rssTextSnippet(html, max = 240) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1).trim() + '…' : text;
}

// ── HTML-content schoonmaken (basis-sanitatie) ─────────────────
function _rssSanitizeHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  // Verwijder gevaarlijke elementen
  tmp.querySelectorAll('script, style, iframe, object, embed, form, input, button').forEach(el => el.remove());

  // Strip on*-handlers en javascript: links
  const walk = node => {
    if (node.nodeType !== 1) return;
    [...node.attributes].forEach(attr => {
      const n = attr.name.toLowerCase();
      const v = attr.value.toLowerCase();
      if (n.startsWith('on')) node.removeAttribute(attr.name);
      else if ((n === 'href' || n === 'src') && v.startsWith('javascript:')) node.removeAttribute(attr.name);
    });
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      node.style.maxWidth = '100%';
      node.style.height = 'auto';
    }
    [...node.children].forEach(walk);
  };
  [...tmp.children].forEach(walk);

  return tmp.innerHTML;
}

// ── Feeds laden ────────────────────────────────────────────────
async function _rssLoadFeed(feed, force = false) {
  if (!feed?.url) return;
  if (_rssLoadingFeeds.has(feed.id)) return;
  if (!force && _rssItemsByFeed[feed.id]) return;

  _rssLoadingFeeds.add(feed.id);
  try {
    const xml = await _rssFetchFeed(feed.url);
    const items = _rssParseXml(xml).sort((a, b) => b.pubDateMs - a.pubDateMs);
    _rssItemsByFeed[feed.id] = items;
  } catch (e) {
    console.error('RSS feed mislukt:', feed.naam, e);
    _rssItemsByFeed[feed.id] = { error: e.message || 'Ophalen mislukt' };
  } finally {
    _rssLoadingFeeds.delete(feed.id);
  }
}

async function loadAllRssFeeds(force = false) {
  const feeds = DB.rssFeeds || [];
  if (!feeds.length) return;
  if (!force && Date.now() - _rssLastLoadedAt < RSS_RELOAD_INTERVAL_MS) return;
  _rssLastLoadedAt = Date.now();
  await Promise.all(feeds.map(f => _rssLoadFeed(f, force)));
}

async function refreshRssFeeds() {
  if (!DB.rssFeeds?.length) {
    showToast('Voeg eerst een feed toe', 'error');
    return;
  }
  showLoading();
  try {
    await loadAllRssFeeds(true);
    if (page === 'rss') renderContent();
    showToast('Feeds vernieuwd');
  } catch (e) {
    toastError(e);
  } finally {
    hideLoading();
  }
}

// ── Items aggregeren met filters ───────────────────────────────
function _rssGetVisibleItems() {
  const feeds = DB.rssFeeds || [];
  const acc = [];
  const sourceFeeds = _rssActiveFeed === 'alle'
    ? feeds
    : feeds.filter(f => f.id === _rssActiveFeed);

  for (const f of sourceFeeds) {
    const data = _rssItemsByFeed[f.id];
    if (!data || data.error) continue;
    for (const it of data) {
      if (!_rssItemRecent(it)) continue;
      const read = rssIsRead(f.id, it.guid);
      if (_rssActiveFilter === 'ongelezen' && read) continue;
      acc.push({ ...it, feedId: f.id, feedNaam: f.naam, isRead: read });
    }
  }
  acc.sort((a, b) => b.pubDateMs - a.pubDateMs);
  return acc;
}

function _rssCountUnread(feedId) {
  const data = _rssItemsByFeed[feedId];
  if (!data || data.error) return 0;
  let n = 0;
  for (const it of data) {
    if (!_rssItemRecent(it)) continue;
    if (!rssIsRead(feedId, it.guid)) n++;
  }
  return n;
}

function _rssTotalUnread() {
  let n = 0;
  for (const f of DB.rssFeeds || []) n += _rssCountUnread(f.id);
  return n;
}

// ── Markeer als gelezen ────────────────────────────────────────
async function _rssMarkRead(feedId, itemGuid) {
  if (rssIsRead(feedId, itemGuid)) return;
  const id = uid();
  const record = { id, feedId, itemGuid, readAt: new Date().toISOString() };
  // Optimistische update
  DB.rssItemsRead.push(record);
  if (_rssReadIndex) _rssReadIndex.add(`${feedId}::${itemGuid}`);
  try {
    await supa('/rest/v1/rss_items_read', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify({ id, feed_id: feedId, item_guid: itemGuid }),
    });
  } catch (e) {
    // Stilletjes negeren — item kan al gemarkeerd zijn elders.
    console.warn('Mark read mislukt', e);
  }
}

async function rssMarkAllRead() {
  const items = _rssGetVisibleItems().filter(i => !i.isRead);
  if (!items.length) {
    showToast('Geen ongelezen items zichtbaar');
    return;
  }
  if (!confirm(`${items.length} items markeren als gelezen?`)) return;
  showLoading();
  try {
    const records = items.map(it => ({
      id: uid(),
      feed_id: it.feedId,
      item_guid: it.guid,
    }));
    await supa('/rest/v1/rss_items_read', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(records),
    });
    for (const r of records) {
      DB.rssItemsRead.push({ id: r.id, feedId: r.feed_id, itemGuid: r.item_guid, readAt: new Date().toISOString() });
      if (_rssReadIndex) _rssReadIndex.add(`${r.feed_id}::${r.item_guid}`);
    }
    renderContent();
    showToast(`${items.length} items gemarkeerd als gelezen`);
  } catch (e) {
    toastError(e);
  } finally {
    hideLoading();
  }
}

// ── Selectie & filters ─────────────────────────────────────────
function rssSelectFeed(feedId) {
  _rssActiveFeed = feedId;
  prefSet('rss.activeFeed', feedId);
  _rssSelectedItemId = null;
  renderContent();
}

function rssSetFilter(filter) {
  _rssActiveFilter = filter;
  prefSet('rss.activeFilter', filter);
  _rssSelectedItemId = null;
  renderContent();
}

function rssSelectItem(idx) {
  const item = _rssVisibleItemsCache[idx];
  if (!item) return;
  _rssSelectedItemId = `${item.feedId}::${item.guid}`;
  // Auto markeren als gelezen
  _rssMarkRead(item.feedId, item.guid).then(() => {
    // Lichte rerender — selectie en lijst aanpassen
    if (page === 'rss') renderContent();
  });
  renderContent();
}

// ── CRUD: Feeds ────────────────────────────────────────────────
function openRssFeedModal(id = '') {
  const feed = id ? (DB.rssFeeds || []).find(f => f.id === id) : null;
  showModal(feed ? 'Feed bewerken' : 'Nieuwe feed',
    `<div class="form-group"><label>Naam *</label>
       <input type="text" id="f-rss-naam" value="${esc(feed?.naam || '')}" placeholder="bijv. NU.nl Algemeen"/></div>
     <div class="form-group"><label>Feed-URL *</label>
       <input type="url" id="f-rss-url" value="${esc(feed?.url || '')}" placeholder="https://www.nu.nl/rss/Algemeen"/>
       <div style="font-size:11px;color:var(--navy4);margin-top:4px">Plak de RSS- of Atom-feed URL. Veel sites hebben een /rss of /feed pad.</div>
     </div>
     <div class="form-group"><label>Categorie (optioneel)</label>
       <input type="text" id="f-rss-cat" value="${esc(feed?.categorie || '')}" placeholder="bijv. Onderwijs"/></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
     ${feed ? `<button class="btn" style="background:var(--s-rood-s);color:var(--s-rood);font-weight:700" onclick="delRssFeed('${id}')">Verwijderen</button>` : ''}
     <button class="btn btn-primary" onclick="saveRssFeed('${id}')">Opslaan</button>`);
}

async function saveRssFeed(id) {
  const naam = document.getElementById('f-rss-naam').value.trim();
  const url = document.getElementById('f-rss-url').value.trim();
  const categorie = document.getElementById('f-rss-cat').value.trim();
  if (!naam) return alert('Naam is verplicht');
  if (!url) return alert('URL is verplicht');
  try { new URL(url); } catch (e) { return alert('Ongeldige URL'); }

  const data = { naam, url, categorie, sortering: 0 };
  showLoading();
  try {
    if (id) {
      await supa(`/rest/v1/rss_feeds?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(toDB_rssFeed(data)) });
      DB.rssFeeds = DB.rssFeeds.map(f => f.id === id ? { ...f, ...data } : f);
      // Bij URL-wijziging items leeghalen zodat ze opnieuw geladen worden
      delete _rssItemsByFeed[id];
      await _rssLoadFeed(DB.rssFeeds.find(f => f.id === id), true);
    } else {
      const newId = uid();
      await supa('/rest/v1/rss_feeds', { method: 'POST', body: JSON.stringify({ id: newId, ...toDB_rssFeed(data) }) });
      const newFeed = { id: newId, ...data, createdAt: new Date().toISOString() };
      DB.rssFeeds.push(newFeed);
      await _rssLoadFeed(newFeed, true);
    }
    closeModal();
    renderContent();
    showToast(id ? 'Feed bijgewerkt' : 'Feed toegevoegd');
  } catch (e) {
    toastError(e);
  } finally {
    hideLoading();
  }
}

async function delRssFeed(id) {
  if (!confirm('Deze feed verwijderen? De gelezen-status van items uit deze feed wordt ook gewist.')) return;
  showLoading();
  try {
    await supa(`/rest/v1/rss_feeds?id=eq.${id}`, { method: 'DELETE' });
    DB.rssFeeds = DB.rssFeeds.filter(f => f.id !== id);
    DB.rssItemsRead = DB.rssItemsRead.filter(r => r.feedId !== id);
    delete _rssItemsByFeed[id];
    if (_rssActiveFeed === id) { _rssActiveFeed = 'alle'; prefSet('rss.activeFeed', 'alle'); }
    _rssReadIndex = null;
    closeModal();
    renderContent();
    showToast('Feed verwijderd');
  } catch (e) {
    toastError(e);
  } finally {
    hideLoading();
  }
}

// ── Render ─────────────────────────────────────────────────────
function renderRssPage() {
  // Trigger eerste laad als nog niet gedaan
  const feeds = DB.rssFeeds || [];
  // Defensief: als de bewaarde feed-ID niet meer bestaat (verwijderd in andere sessie), val terug op 'alle'
  if (_rssActiveFeed !== 'alle' && !feeds.some(f => f.id === _rssActiveFeed)) {
    _rssActiveFeed = 'alle';
    prefSet('rss.activeFeed', 'alle');
  }
  if (feeds.length && !Object.keys(_rssItemsByFeed).length) {
    loadAllRssFeeds(false).then(() => { if (page === 'rss') renderContent(); });
  }

  if (!feeds.length) {
    return `
      <div class="card">
        <div class="empty-state">
          ${svgIcon('mail', 40)}
          <p style="margin-top:12px;font-size:15px;font-weight:600;color:var(--navy3)">Nog geen RSS-feeds toegevoegd</p>
          <p style="margin-top:6px">Voeg je eerste nieuwsfeed toe om te beginnen met lezen.</p>
          <button class="btn btn-primary" onclick="openRssFeedModal()" style="margin-top:16px">${svgIcon('add')} Feed toevoegen</button>
        </div>
      </div>`;
  }

  const items = _rssGetVisibleItems();
  _rssVisibleItemsCache = items;
  const totalUnread = _rssTotalUnread();
  const selected = items.find(i => `${i.feedId}::${i.guid}` === _rssSelectedItemId) || null;

  return `
    <div class="rss-toolbar">
      <div class="rss-toolbar-left">
        <button class="btn btn-secondary btn-sm" onclick="refreshRssFeeds()" title="Feeds vernieuwen">
          ${svgIcon('clock', 14)} Vernieuwen
        </button>
        <div class="rss-filter-group" role="group" aria-label="Filter">
          <button onclick="rssSetFilter('alle')" class="${_rssActiveFilter === 'alle' ? 'active' : ''}">Alle</button>
          <button onclick="rssSetFilter('ongelezen')" class="${_rssActiveFilter === 'ongelezen' ? 'active' : ''}">Ongelezen${totalUnread ? ` <span class="rss-badge">${totalUnread}</span>` : ''}</button>
        </div>
      </div>
      <div class="rss-toolbar-right">
        <button class="btn btn-secondary btn-sm" onclick="rssMarkAllRead()">${svgIcon('eye', 14)} Alles gelezen</button>
        <button class="btn btn-primary btn-sm" onclick="openRssFeedModal()">${svgIcon('add', 14)} Feed</button>
      </div>
    </div>

    <div class="rss-layout">
      <aside class="rss-sidebar card">
        <div class="rss-feed-list">
          ${_rssFeedSidebarItem({ id: 'alle', naam: 'Alle feeds', count: totalUnread, isAll: true })}
          ${feeds.map(f => _rssFeedSidebarItem({
            id: f.id,
            naam: f.naam,
            categorie: f.categorie,
            count: _rssCountUnread(f.id),
            error: _rssItemsByFeed[f.id]?.error,
            loading: _rssLoadingFeeds.has(f.id),
          })).join('')}
        </div>
      </aside>

      <section class="rss-list card">
        ${(() => {
          // Speciaal bericht als geselecteerde feed een fout heeft
          if (_rssActiveFeed !== 'alle') {
            const data = _rssItemsByFeed[_rssActiveFeed];
            if (data && data.error) {
              return `
                <div class="empty-state" style="padding:40px 20px">
                  <p style="font-size:14px;font-weight:700;color:var(--s-rood);margin-bottom:6px">⚠ Deze feed kon niet geladen worden</p>
                  <p style="font-size:12.5px;color:var(--navy3);margin-bottom:14px">${esc(data.error)}</p>
                  <p style="font-size:12px;color:var(--navy4);max-width:340px;margin:0 auto">Controleer de feed-URL — de bronserver gaf bovenstaande fout terug. Veel sites publiceren hun RSS op een ander pad dan je verwacht.</p>
                </div>`;
            }
          }
          if (items.length === 0) {
            return `
              <div class="empty-state" style="padding:40px 20px">
                <p style="font-size:14px;color:var(--navy4)">${
                  _rssActiveFilter === 'ongelezen'
                    ? 'Geen ongelezen artikelen.'
                    : 'Geen artikelen gevonden voor deze selectie.'
                }</p>
              </div>`;
          }
          return items.map((it, idx) => _rssListItemHtml(it, idx)).join('');
        })()}
      </section>

      <article class="rss-article card">
        ${selected ? _rssArticleHtml(selected) : `
          <div class="empty-state" style="padding:60px 30px">
            ${svgIcon('mail', 36)}
            <p style="margin-top:14px;color:var(--navy4)">Selecteer een artikel om te lezen</p>
          </div>`}
      </article>
    </div>`;
}

function _rssFeedSidebarItem({ id, naam, categorie, count, isAll, error, loading }) {
  const active = _rssActiveFeed === id;
  const shortErr = error ? (error.length > 40 ? error.slice(0, 39) + '…' : error) : '';
  return `
    <div class="rss-feed-item${active ? ' active' : ''}" onclick="rssSelectFeed('${id}')">
      <div class="rss-feed-item-main">
        <div class="rss-feed-name">${esc(naam)}${loading ? ' <span style="font-size:10px;color:var(--navy4);font-weight:500">⟳</span>' : ''}</div>
        ${categorie ? `<div class="rss-feed-cat">${esc(categorie)}</div>` : ''}
        ${error ? `<div class="rss-feed-error" title="${esc(error)}">⚠ ${esc(shortErr)}</div>` : ''}
      </div>
      <div class="rss-feed-item-side">
        ${count > 0 ? `<span class="rss-badge">${count}</span>` : ''}
        ${!isAll ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();openRssFeedModal('${id}')" title="Bewerken">${svgIcon('edit', 12)}</button>` : ''}
      </div>
    </div>`;
}

function _rssListItemHtml(item, idx) {
  const feed = (DB.rssFeeds || []).find(f => f.id === item.feedId);
  const isSelected = `${item.feedId}::${item.guid}` === _rssSelectedItemId;
  return `
    <div class="rss-list-item${item.isRead ? ' read' : ''}${isSelected ? ' selected' : ''}"
         onclick="rssSelectItem(${idx})">
      <div class="rss-list-item-meta">
        <span class="rss-list-item-feed">${esc(feed?.naam || item.feedNaam || '')}</span>
        <span class="rss-list-item-date">${_rssRelativeTime(item.pubDateMs)}</span>
      </div>
      <div class="rss-list-item-title">${esc(item.title)}</div>
      ${item.summary ? `<div class="rss-list-item-summary">${esc(item.summary)}</div>` : ''}
    </div>`;
}

function _rssArticleHtml(item) {
  const feed = (DB.rssFeeds || []).find(f => f.id === item.feedId);
  return `
    <div class="rss-article-header">
      <div class="rss-article-meta">
        <span style="font-weight:700;color:var(--navy)">${esc(feed?.naam || '')}</span>
        ${item.author ? ` <span style="color:var(--navy4)">·</span> <span>${esc(item.author)}</span>` : ''}
        <span style="color:var(--navy4)">·</span>
        <span>${item.pubDate ? esc(new Date(item.pubDateMs).toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' })) : ''}</span>
      </div>
      <h2 class="rss-article-title">${esc(item.title)}</h2>
      ${item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer" class="rss-article-link">Open op website ↗</a>` : ''}
    </div>
    <div class="rss-article-body">
      ${_rssSanitizeHtml(item.contentHtml)}
    </div>`;
}

// ── Publieke helpers voor het dashboard ───────────────────────
let _rssDashboardCache = [];

function rssLatestItems(limit = 6) {
  // Trigger laden als nog niet gebeurd; resultaat komt via renderContent.
  if ((DB.rssFeeds || []).length && !Object.keys(_rssItemsByFeed).length) {
    loadAllRssFeeds(false).then(() => {
      if (page === 'dashboard' || page === 'rss') renderContent();
    });
  }
  const items = [];
  for (const f of DB.rssFeeds || []) {
    const data = _rssItemsByFeed[f.id];
    if (!data || data.error) continue;
    for (const it of data) {
      if (!_rssItemRecent(it)) continue;
      items.push({ ...it, feedId: f.id, feedNaam: f.naam });
    }
  }
  items.sort((a, b) => b.pubDateMs - a.pubDateMs);
  _rssDashboardCache = items.slice(0, limit);
  return _rssDashboardCache;
}

function openDashboardNewsItem(idx) {
  const it = _rssDashboardCache[idx];
  if (!it) return;
  _rssActiveFeed = 'alle';
  _rssActiveFilter = 'alle';
  prefSet('rss.activeFeed', 'alle');
  prefSet('rss.activeFilter', 'alle');
  _rssSelectedItemId = `${it.feedId}::${it.guid}`;
  _rssMarkRead(it.feedId, it.guid);
  navigate('rss');
}

function _rssRelativeTime(ms) {
  if (!ms) return '–';
  const diff = Date.now() - ms;
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;
  if (diff < hr) return `${Math.max(1, Math.round(diff / min))} min`;
  if (diff < day) return `${Math.round(diff / hr)} u`;
  if (diff < 7 * day) return `${Math.round(diff / day)} d`;
  return new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}
