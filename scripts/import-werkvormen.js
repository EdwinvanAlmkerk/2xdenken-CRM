const SUPA_URL = 'https://ndgdhxznkazdilgioxpv.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kZ2RoeHpua2F6ZGlsZ2lveHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MzY4OTksImV4cCI6MjA5MTIxMjg5OX0.VwTs8MQeQLKK7Kygy7339thL5ghLfZbJxJzqtvKF0Eo';

const items = [
  {
    title: 'Groepspolonaise',
    summary: 'Een luister- en samenwerkingsoefening waarbij de groep een reeks mondelinge bewegingsinstructies één keer hoort en daarna samen uitvoert. De nabespreking gaat over interpretatieverschillen, leiderschap en afstemming.',
    links: []
  },
  {
    title: 'Waar ga jij voor?',
    summary: 'Deelnemers kiezen steeds tussen twee opties zonder context. De oefening laat zien dat keuzes en richting makkelijker worden wanneer het doel duidelijk is.',
    links: []
  },
  {
    title: 'Aandacht en doelen stellen',
    summary: 'Deelnemers kijken eerst zonder specifiek doel rond en beantwoorden daarna vragen over de ruimte. De les is dat gerichte aandacht veel meer oplevert als je vooraf weet waar je op moet letten.',
    links: []
  },
  {
    title: 'Kegelspel',
    summary: 'Vier ploegen krijgen elk een andere, deels botsende opdracht met kegels. De oefening maakt zichtbaar hoe strategie, overleg en gezamenlijk belang samenwerking beïnvloeden.',
    links: []
  },
  {
    title: 'Mijnenveld',
    summary: 'Een geblinddoekte deelnemer moet via aanwijzingen van een coach een veld met mijnen oversteken. De focus ligt op vertrouwen, luisteren, checken en afstemmen.',
    links: []
  },
  {
    title: 'Touwtjes losmaken',
    summary: 'Tweetallen zitten letterlijk aan elkaar vast met touw en moeten zonder losmaken een oplossing vinden. Het maakt gedrag rond frustratie, volhouden, afhaken en samen leren zichtbaar.',
    links: []
  },
  {
    title: 'Kapla',
    summary: 'De ene deelnemer beschrijft een bouwwerk, de andere bouwt het na zonder te kunnen kijken. De werkvorm benadrukt heldere communicatie en het gemis van non-verbale signalen.',
    links: [
      { label: 'YouTube', url: 'https://www.youtube.com/watch?v=16yARJeag4Y' }
    ]
  },
  {
    title: 'Oefenen met feedback',
    summary: 'In een binnen- en buitencirkel oefenen deelnemers met observeren, open vragen stellen, persoonlijke vragen, complimenten en kritische feedback. De opbouw is veilig en leerzaam.',
    links: []
  },
  {
    title: 'Oefening waarneembaar gedrag benoemen',
    summary: 'De groep benoemt zo neutraal mogelijk wat zichtbaar gedrag is bij een acteur. Daarmee wordt het verschil tussen waarneming en interpretatie geoefend.',
    links: []
  },
  {
    title: 'Feedback verkennen',
    summary: 'Via een rollenspel met een beschadigd geleend boek onderzoeken deelnemers hoe subassertief, agressief en assertief reageren eruitziet. De nadruk ligt op bruikbare en constructieve feedback.',
    links: []
  },
  {
    title: 'Feedback geven: hoe doe je dat effectief?',
    summary: 'Met een video en het 4G-model oefenen deelnemers feedback opbouwen rond gedrag, gevoel, gevolg en gewenst gedrag. Het is direct toepasbaar op praktijksituaties.',
    links: [
      { label: 'YouTube', url: 'https://www.youtube.com/watch?v=jVY9hBShtzc' },
      { label: 'Artikel', url: 'https://www.heteffectievewerken.nl/blog/5-teambuildingoefeningen-voor-meer-productiviteit.html' }
    ]
  },
  {
    title: 'Brainkluts',
    summary: 'Eén persoon moet tegelijk spiegelen, persoonlijke vragen beantwoorden en sommen maken. Dit laat ervaren hoe snel stress ontstaat en hoe belangrijk focus is.',
    links: []
  },
  {
    title: 'Traffic jam',
    summary: 'Twee groepen moeten onder strikte regels langs elkaar heen via hoepels. De oefening vraagt flexibiliteit, communicatie en slim samenwerken.',
    links: []
  },
  {
    title: 'Ja-maren',
    summary: 'In tweetallen worden ideeën eerst afgeremd met ja, maar en daarna versterkt met ja, en. Zo wordt het effect van mindset op samenwerking en creativiteit direct voelbaar.',
    links: []
  },
  {
    title: 'Pen-opdracht',
    summary: 'Twee deelnemers houden samen één pen vast en krijgen allebei een ander doel. De kern is dat beide doelen haalbaar worden door overleg en meebewegen.',
    links: []
  },
  {
    title: 'Tangram',
    summary: 'Groepjes maken in stilte van losse stukken vijf gelijke vierkanten. Het draait om afstemming, dienstbaarheid en gedeelde verantwoordelijkheid.',
    links: []
  },
  {
    title: 'White Board Back-to-Back tekening',
    summary: 'Een geblinddoekte deelnemer tekent op aanwijzingen van anderen, zonder dat gezegd mag worden wat het object is. De oefening vraagt precieze instructies en vertrouwen.',
    links: []
  },
  {
    title: 'Menselijke knoop',
    summary: 'De groep vormt met elkaars handen een knoop en moet zichzelf ontwarren zonder los te laten. Dit maakt leiderschap, nabijheid en samenwerking zichtbaar.',
    links: []
  },
  {
    title: 'Perfecte vierkantje',
    summary: 'Geblinddoekte deelnemers moeten met een touw samen een vierkant vormen. De werkvorm leunt op gevoel, coördinatie en soms beperkte verbale communicatie.',
    links: []
  },
  {
    title: 'De flipperkast',
    summary: 'Een geblinddoekte deelnemer staat in een kring en wordt zacht terug de cirkel in begeleid. Dit is vooral een oefening in onderling vertrouwen.',
    links: []
  },
  {
    title: 'Het eiland',
    summary: 'Kleine teams bepalen welke vijf voorwerpen ze meenemen na een schipbreukscenario. De oefening brengt rollen, besluitvorming en luisteren naar elkaar naar voren.',
    links: []
  },
  {
    title: 'Bonusoefening over vertrouwen',
    summary: 'Tweetallen kijken elkaar twee minuten zwijgend aan. Het is een simpele maar krachtige oefening rond spanning, kwetsbaarheid en contact.',
    links: []
  },
  {
    title: 'Maak mij een auto',
    summary: 'Groepen ontwerpen een auto voor een bepaalde communicatiestijl of profiel. Zo groeit inzicht in verschillende behoeften en stijlen.',
    links: []
  },
  {
    title: 'IJsschotsen oefening',
    summary: 'De groep moet zonder de grond te raken via losse ijsschotsen naar het midden komen. Het vraagt planning, leiderschap, luisteren en gezamenlijke uitvoering.',
    links: []
  },
  {
    title: 'De waarderingsmuur',
    summary: 'Teamleden schrijven op post-its welk gedrag zij in elkaar waarderen. De werkvorm stimuleert positieve feedback, verbondenheid en bewustwording van kwaliteiten.',
    links: [
      { label: 'Progressiegericht werken', url: 'https://progressiegerichtwerken.nl/de-liking-gap-waarschijnlijk-vinden-anderen-je-aardiger-dan-je-denkt/' },
      { label: 'Drie basisbehoeften', url: 'https://progressiegerichtwerken.nl/drie-basisbehoeften-overal-en-altijd-van-kracht-ook-als-we-het-zelf-niet-doorhebben/' }
    ]
  },
  {
    title: 'Bol wol',
    summary: 'De tekst noemt dit als web met wensen, wie heb je als eerste nodig, maar geeft verder weinig uitwerking. Het lijkt een verbindings- of reflectieoefening.',
    links: [
      { label: 'YouTube', url: 'https://www.youtube.com/watch?v=gDY115q6QXI' }
    ]
  },
  {
    title: 'GWAVE',
    summary: 'Een werkvorm om als team een plan van aanpak te maken via Goal, Why, Action, Visualisatie en Erbij halen. Gericht op concreet maken van teamdoelen en actie.',
    links: [
      { label: 'BeMotion', url: 'https://www.bemotion.nl/oefening-om-met-je-team-te-doen/' }
    ]
  },
  {
    title: 'Progressiecirkel',
    summary: 'Met binnen- en buitencirkels en post-its wordt al bereikte vooruitgang en de volgende stap zichtbaar gemaakt. Geschikt voor teamreflectie en vervolgactie.',
    links: []
  }
];

const headers = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

async function request(path, options = {}) {
  const res = await fetch(`${SUPA_URL}${path}`, { headers: { ...headers, ...(options.headers || {}) }, ...options });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function hasLinksColumn() {
  const res = await fetch(`${SUPA_URL}/rest/v1/trainingen?select=tips_links&limit=1`, { headers });
  return res.ok;
}

function buildOmschrijving(item, includeLinksInline) {
  if (!includeLinksInline || !item.links.length) return item.summary;
  return `${item.summary}\n\nLinks:\n${item.links.map(link => `- ${link.label}: ${link.url}`).join('\n')}`;
}

async function run() {
  const existing = await request('/rest/v1/trainingen?select=naam');
  const existingNames = new Set((existing || []).map(x => String(x.naam || '').trim().toLowerCase()));
  const supportsTipsLinks = await hasLinksColumn();

  const payload = items
    .filter(item => !existingNames.has(item.title.trim().toLowerCase()))
    .map(item => {
      const row = {
        id: crypto.randomUUID(),
        naam: item.title,
        categorie: 'werkvorm',
        doelgroep: 'cat:team',
        omschrijving: buildOmschrijving(item, !supportsTipsLinks),
        tips: []
      };
      if (supportsTipsLinks) row.tips_links = item.links;
      return row;
    });

  if (!payload.length) {
    console.log('Niets te importeren: alle werkvormen bestaan al.');
    return;
  }

  const inserted = await request('/rest/v1/trainingen', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  console.log(`Geïmporteerd: ${inserted.length}`);
  console.log(`Links opgeslagen via aparte kolom: ${supportsTipsLinks ? 'ja' : 'nee, toegevoegd aan omschrijving'}`);
  console.log(inserted.map(x => x.naam).join('\n'));
}

run().catch(err => {
  console.error('Import mislukt:', err.message || err);
  process.exit(1);
});
