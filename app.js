// Poupoules v3 — le carnet du poulailler.
// Vanilla JS, données locales d’abord, synchronisation Firebase quand on est connecté.

const APP_VERSION = '3.0.0';
const LS_KEY = 'poupoules-v3';
const LEGACY_KEY = 'poupoules-state';
const VDONE_KEY = 'poupoules-vdone';
const WEATHER_KEY = 'poupoules-weather-v3';
const SYNCED_KEY = 'poupoules-synced-';
const FB_URL = 'https://www.gstatic.com/firebasejs/10.14.1/';
const COLS = ['hens', 'days', 'moves', 'tasks', 'care', 'expenses'];

// ---------- Utilitaires ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newId = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const todayKey = () => keyOf(new Date());
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const addMonths = (k, n) => { const d = parseKey(k); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return keyOf(d); };
const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const isKey = k => /^\d{4}-\d{2}-\d{2}$/.test(String(k || ''));
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DOW = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const yearSuffix = d => (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '');
const fmtLong = k => { const d = parseKey(k); return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${yearSuffix(d)}`; };
const fmtShort = k => { const d = parseKey(k); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${yearSuffix(d)}`; };
const relDay = k => { const n = diffDays(k, todayKey()); if (n === 0) return 'Aujourd’hui'; if (n === 1) return 'Hier'; return cap(fmtLong(k)); };
const relShort = k => { const n = diffDays(k, todayKey()); if (n === 0) return 'Aujourd’hui'; if (n === 1) return 'Hier'; if (n > 1 && n < 7) return cap(DOW[parseKey(k).getDay()]); return fmtShort(k); };
const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${cap(MONTHS[m - 1])} ${y}`; };
const addMonthYm = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const euro = v => `${(Number(v) || 0).toFixed(2).replace('.', ',')} €`;
const dec = (v, n = 1) => (Number(v) || 0).toFixed(n).replace('.', ',');
const parseNum = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
const pl = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const clean = o => JSON.parse(JSON.stringify(o));
const boxesTxt = n => (n < 6 ? 'moins d’une boîte' : `${pl(Math.floor(n / 6), 'boîte')} de 6`);
const deOf = m => (/^[aeiouyhâéèêîôû]/i.test(m) ? 'd’' : 'de ');
function ageLabel(from) {
  if (!isKey(from)) return '';
  const a = parseKey(from); const b = new Date();
  let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  if (b.getDate() < a.getDate()) m -= 1;
  if (m < 1) return 'moins d’un mois';
  const y = Math.floor(m / 12); const r = m % 12;
  return [y ? pl(y, 'an') : '', r ? `${r} mois` : ''].filter(Boolean).join(' et ');
}

// ---------- Icônes ----------
const svg = (inner, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const ic = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  left: svg('<path d="M15 6l-6 6 6 6"/>'),
  right: svg('<path d="M9 6l6 6-6 6"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>', 'ic chev'),
  cal: svg('<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>'),
  check: svg('<path d="M5 12l4 4 10-10"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  sliders: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  eat: svg('<path d="M7 3v7M5 3v4a2 2 0 0 0 4 0V3M7 10v11M17 21V3c-2.2 0-3.5 2.5-3.5 6s1.3 4 3.5 4"/>'),
  sale: svg('<circle cx="12" cy="12" r="9"/><path d="M15 9.5a3.5 3.5 0 1 0 0 5M7 11h6M7 13.5h6"/>'),
  gift: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  broken: svg('<path d="M12 3c-3.9 0-7 5.6-7 10a7 7 0 0 0 14 0c0-4.4-3.1-10-7-10zM8 12l2.5 2 2-3 2.5 2.5"/>'),
  back: svg('<path d="M15 6l-6 6 6 6"/>')
};

// ---------- Référentiels ----------
const COLORS = {
  brun: { label: 'Brun', one: 'brun', many: 'bruns' },
  blanc: { label: 'Blanc', one: 'blanc', many: 'blancs' },
  bleu: { label: 'Bleu', one: 'bleu', many: 'bleus' },
  vert: { label: 'Vert', one: 'vert', many: 'verts' },
  chocolat: { label: 'Chocolat', one: 'chocolat', many: 'chocolat' },
  creme: { label: 'Crème', one: 'crème', many: 'crème' },
  x: { label: 'Sans couleur', one: 'sans couleur', many: 'sans couleur' }
};
const COLOR_KEYS = ['brun', 'blanc', 'bleu', 'vert', 'chocolat', 'creme'];
const BREEDS = [
  ['Œufs blancs ou crème', ['Leghorn', 'Sussex', 'Soie', 'Gâtinaise', 'Sabelpoot']],
  ['Œufs bruns', ['Rousse', 'Harco', 'Marans', 'Orpington', 'Brahma', 'Plymouth Rock', 'Wyandotte', 'Australorp', 'Coucou', 'Faverolles']],
  ['Œufs bleus ou verts', ['Araucana', 'Ameraucana', 'Cream Legbar', 'Olive Egger']],
  ['Autres', ['Croisée', 'Autre']]
];
const BREED_COLOR = { Leghorn: 'blanc', Sussex: 'blanc', Soie: 'blanc', 'Gâtinaise': 'blanc', Sabelpoot: 'blanc', Rousse: 'brun', Harco: 'brun', Marans: 'chocolat', Orpington: 'brun', Brahma: 'brun', 'Plymouth Rock': 'brun', Wyandotte: 'brun', Australorp: 'brun', Coucou: 'brun', Faverolles: 'brun', Araucana: 'bleu', Ameraucana: 'bleu', 'Cream Legbar': 'bleu', 'Olive Egger': 'vert' };
const FALLBACK_COLOR = { chocolat: 'brun', creme: 'blanc', vert: 'bleu' };
const OUT_KINDS = { eat: 'Consommés', sale: 'Vendus', gift: 'Donnés', broken: 'Cassés' };
const EXP_CATS = [['aliment', 'Aliment'], ['litiere', 'Paille / litière'], ['soins', 'Soins'], ['materiel', 'Matériel'], ['animaux', 'Achat de poules'], ['autre', 'Autre']];
const CARE_TYPES = [['Traitement anti-poux', 'record'], ['Terre de diatomée', 'record'], ['Cure de vinaigre de cidre', 'record'], ['Vermifuge', 'record'], ['Mue', 'track'], ['Couvaison', 'track'], ['Blessure', 'record'], ['Maladie', 'record'], ['Vétérinaire', 'record'], ['Autre', 'record']];
const TRACK_TAG = { Mue: 'En mue', Couvaison: 'Couveuse' };
const DEFAULT_TASKS = [
  { id: 't-eau', name: 'Eau fraîche', cat: 'routine', every: 1, unit: 'day' },
  { id: 't-aliment', name: 'Aliment et grit', cat: 'routine', every: 1, unit: 'day' },
  { id: 't-pondoirs', name: 'Nettoyer les pondoirs', cat: 'routine', every: 1, unit: 'week' },
  { id: 't-abreuvoir', name: 'Laver abreuvoir et mangeoire', cat: 'routine', every: 1, unit: 'week' },
  { id: 't-litiere', name: 'Changer la litière', cat: 'routine', every: 2, unit: 'week' },
  { id: 't-nettoyage', name: 'Grand nettoyage du poulailler', cat: 'routine', every: 1, unit: 'month' },
  { id: 't-coquilles', name: 'Coquilles d’huîtres', cat: 'routine', every: 1, unit: 'month' },
  { id: 't-vermifuge', name: 'Vermifuge', cat: 'soin', every: 6, unit: 'month' },
  { id: 't-poux', name: 'Contrôle des poux rouges', cat: 'soin', every: 1, unit: 'month', months: [4, 5, 6, 7, 8, 9, 10] }
];
const WX = { 0: 'Ciel dégagé', 1: 'Plutôt dégagé', 2: 'Partiellement nuageux', 3: 'Couvert', 45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine forte', 61: 'Pluie légère', 63: 'Pluie', 65: 'Forte pluie', 71: 'Neige légère', 73: 'Neige', 75: 'Forte neige', 80: 'Averses', 81: 'Averses', 82: 'Fortes averses', 95: 'Orage', 96: 'Orage et grêle', 99: 'Orage et grêle' };

// ---------- État ----------
const defaultSettings = () => ({ name: '', boxPrice: 1.5, colors: ['brun', 'blanc', 'bleu'], stockStart: todayKey(), createdAt: todayKey(), seeded: false, v3: true });
const emptyDb = () => Object.fromEntries(COLS.map(c => [c, {}]));
let settings = defaultSettings();
let db = emptyDb();
let ownerUid = null;
let mode = 'local';
let user = null;
let fb = null;
let unsubs = [];
let weather = null;
let weatherMsg = 'Localisation…';
let sheetState = null;
let sheetHandler = null;
let pendingToast = '';
const ui = { tab: 'home', eggsView: 'stock', date: todayKey(), henId: null, henFilter: 'active', search: '', month: todayKey().slice(0, 7), calMonth: todayKey().slice(0, 7), journalLimit: 40, pop: -1 };
const mq = window.matchMedia('(min-width: 720px)');
const wide = () => mq.matches;

// ---------- Persistance locale ----------
function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!raw) return false;
    settings = { ...defaultSettings(), ...(raw.settings || {}) };
    db = emptyDb();
    for (const c of COLS) db[c] = raw.db?.[c] || {};
    ownerUid = raw.owner || null;
    return true;
  } catch { return false; }
}
let saveTimer = null;
function saveLocal() { clearTimeout(saveTimer); saveTimer = setTimeout(saveLocalNow, 250); }
function saveLocalNow() {
  const payload = { version: APP_VERSION, owner: ownerUid, settings, db };
  try { localStorage.setItem(LS_KEY, JSON.stringify(payload)); }
  catch {
    try {
      const light = clean(payload);
      for (const h of Object.values(light.db.hens)) h.photo = '';
      localStorage.setItem(LS_KEY, JSON.stringify(light));
    } catch (error) { console.warn('Poupoules : stockage local plein', error); }
  }
}

// ---------- Migration depuis la v2.5 ----------
function legacyColor(c) {
  const map = { blanc: 'blanc', 'crème': 'blanc', creme: 'blanc', brun: 'brun', chocolat: 'brun', 'tacheté': 'brun', bleu: 'bleu', vert: 'bleu' };
  return map[String(c || '').toLowerCase()] || 'brun';
}
function legacyEntriesToDays(entries, hens) {
  const out = {};
  for (const e of entries) {
    const date = String(e.date || '').slice(0, 10);
    if (!isKey(date)) continue;
    const lines = e.lines?.length ? e.lines : [{ count: e.count || 0, color: e.color || 'brun', henId: e.henId || '' }];
    const day = out[date] || (out[date] = { id: date, date, cups: [], migrated: true });
    for (const line of lines) {
      const hen = line.henId ? hens[line.henId] : null;
      const color = hen?.color || legacyColor(line.color);
      for (let i = 0; i < (Number(line.count) || 0); i += 1) day.cups.push(color);
    }
  }
  return out;
}
function mergeDays(target, incoming) {
  for (const [k, d] of Object.entries(incoming)) {
    if (!target[k] || dayTotal(target[k]) < dayTotal(d)) target[k] = d;
  }
}
function migrateLegacyLocal() {
  let old;
  try { old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'); } catch { return; }
  if (!old) return;
  const DEMO = ['marguerite', 'caramelle', 'pistache', 'colette', 'suzette', 'praline'];
  for (const h of old.hens || []) {
    if (DEMO.includes(h.id) && !('eggColor' in h)) continue;
    db.hens[h.id] = {
      id: h.id, name: h.name || 'Sans nom', breed: h.breed && h.breed !== 'Race non renseignée' ? h.breed : '',
      color: legacyColor(h.eggColor || ''), arrival: isKey(h.arrivalDate) ? h.arrivalDate : '',
      status: h.status === 'deceased' ? 'dead' : (h.status === 'rest' ? 'rest' : 'active'),
      photo: h.photo || '', deathDate: h.deathDate || '', deathNote: h.deathNote || '', createdAt: Date.now()
    };
  }
  mergeDays(db.days, legacyEntriesToDays(old.eggEntries || [], db.hens));
  const catMap = { feed: 'aliment', bedding: 'litiere', straw: 'litiere', products: 'soins' };
  for (const t of old.transactions || []) {
    const date = isKey(t.date) ? t.date : todayKey();
    if (t.type === 'purchase') db.expenses[t.id] = { id: t.id, date, cat: catMap[t.category] || 'autre', amount: Number(t.amount) || 0, note: t.note || '', createdAt: Date.now() };
    else if (t.type === 'sale') db.moves[t.id] = { id: t.id, kind: 'sale', date, eggs: 0, amount: Number(t.amount) || 0, person: '', note: t.note || '', legacy: true, createdAt: Date.now() };
  }
  if (Number(old.economics?.boxPrice) > 0) settings.boxPrice = Number(old.economics.boxPrice);
  if (old.profileName) settings.name = old.profileName;
  settings.migratedFrom = '2.5';
  pendingToast = 'Tes données de la version précédente ont été reprises';
}
function seedTasks() {
  const t = todayKey();
  for (const d of DEFAULT_TASKS) {
    if (!db.tasks[d.id]) db.tasks[d.id] = { ...d, active: true, lastDone: null, anchor: d.every === 1 && d.unit === 'day' ? null : t, createdAt: Date.now() };
  }
  settings.seeded = true;
}

// ---------- Firebase ----------
async function loadFirebase() {
  try {
    const [appM, fsM, authM, cfg] = await Promise.all([
      import(`${FB_URL}firebase-app.js`), import(`${FB_URL}firebase-firestore.js`), import(`${FB_URL}firebase-auth.js`), import('./firebase-config.js')
    ]);
    const app = appM.initializeApp(cfg.firebaseConfig);
    let fs;
    try { fs = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }) }); }
    catch { fs = fsM.getFirestore(app); }
    const auth = authM.getAuth(app);
    fb = { fs, auth, F: fsM, A: authM };
    authM.getRedirectResult(auth).catch(() => {});
    authM.onAuthStateChanged(auth, onUser);
  } catch (error) { console.info('Poupoules : Firebase indisponible, mode local', error); }
}
const colRef = c => fb.F.collection(fb.fs, 'users', user.uid, c);
const docRef = (c, id) => fb.F.doc(fb.fs, 'users', user.uid, c, id);
const metaRef = () => fb.F.doc(fb.fs, 'users', user.uid, 'meta', 'settings');
function unsubscribeAll() { unsubs.forEach(u => u()); unsubs = []; }
async function onUser(u) {
  unsubscribeAll();
  if (!u) { user = null; mode = 'local'; render(); return; }
  user = u;
  if (ownerUid && ownerUid !== u.uid) { db = emptyDb(); settings = defaultSettings(); seedTasks(); }
  if (!localStorage.getItem(SYNCED_KEY + u.uid)) {
    try { await firstSync(); localStorage.setItem(SYNCED_KEY + u.uid, '1'); }
    catch (error) {
      console.warn(error); mode = 'local';
      toast('Première synchronisation impossible : vérifie ta connexion');
      window.addEventListener('online', () => onUser(fb?.auth.currentUser), { once: true });
      render(); return;
    }
  }
  ownerUid = u.uid; mode = 'cloud';
  subscribe(); saveLocal(); render();
  if (pendingToast) { toast(pendingToast); pendingToast = ''; }
}
async function firstSync() {
  const { F } = fb;
  const metaSnap = await F.getDocFromServer(metaRef());
  const cloud = emptyDb();
  for (const c of COLS) { const snap = await F.getDocsFromServer(colRef(c)); snap.forEach(d => { cloud[c][d.id] = d.data(); }); }
  let cloudSettings = metaSnap.exists() ? metaSnap.data() : null;
  if (!cloudSettings) {
    try {
      const legacy = await F.getDocsFromServer(F.query(F.collection(fb.fs, 'egg_entries'), F.where('userId', '==', user.uid)));
      mergeDays(db.days, legacyEntriesToDays(legacy.docs.map(d => ({ id: d.id, ...d.data() })), { ...db.hens, ...cloud.hens }));
      if (legacy.size) pendingToast = 'Tes récoltes en ligne ont été reprises';
    } catch (error) { console.info('Pas d’anciennes récoltes en ligne', error); }
  }
  const writes = [];
  for (const c of COLS) for (const [id, data] of Object.entries(db[c])) if (!cloud[c][id]) writes.push({ c, id, data });
  const merged = cloudSettings ? { ...defaultSettings(), ...cloudSettings } : { ...settings, v3: true };
  if (!cloudSettings) writes.push({ meta: true, data: merged });
  await commitWrites(writes);
  for (const c of COLS) db[c] = { ...db[c], ...cloud[c] };
  settings = merged;
}
async function commitWrites(writes) {
  const { F, fs } = fb;
  for (let i = 0; i < writes.length; i += 300) {
    const batch = F.writeBatch(fs);
    for (const w of writes.slice(i, i + 300)) {
      const ref = w.meta ? metaRef() : docRef(w.c, w.id);
      if (w.del) batch.delete(ref); else batch.set(ref, clean(w.data));
    }
    await batch.commit();
  }
}
function subscribe() {
  const { F } = fb;
  for (const c of COLS) {
    unsubs.push(F.onSnapshot(colRef(c), snap => {
      const m = {}; snap.forEach(d => { m[d.id] = d.data(); });
      db[c] = m; saveLocal(); scheduleRender();
    }, error => console.warn('Synchro', c, error)));
  }
  unsubs.push(F.onSnapshot(metaRef(), s => { if (s.exists()) { settings = { ...defaultSettings(), ...s.data() }; saveLocal(); scheduleRender(); } }));
}
function cloudWrite(c, id) {
  if (mode !== 'cloud' || !fb || !user) return;
  const o = db[c][id];
  const p = o ? fb.F.setDoc(docRef(c, id), clean(o)) : fb.F.deleteDoc(docRef(c, id));
  p.catch(error => { console.warn(error); toast('Enregistré sur l’appareil, la synchro reprendra plus tard'); });
}
function put(c, obj) { obj.updatedAt = Date.now(); db[c][obj.id] = obj; saveLocal(); cloudWrite(c, obj.id); }
function del(c, id) { delete db[c][id]; saveLocal(); cloudWrite(c, id); }
function saveSettings() {
  saveLocal();
  if (mode === 'cloud' && fb && user) fb.F.setDoc(metaRef(), clean(settings)).catch(() => toast('Réglages enregistrés sur l’appareil'));
}
const dayTimers = {};
function saveDay(day) {
  if (!day.cups.length && !day.zero) delete db.days[day.id];
  else { day.updatedAt = Date.now(); db.days[day.id] = day; }
  saveLocal();
  clearTimeout(dayTimers[day.id]);
  dayTimers[day.id] = setTimeout(() => cloudWrite('days', day.id), 600);
}

// ---------- Calculs ----------
const dayTotal = d => (d ? (d.cups || []).filter(Boolean).length : 0);
const colorCounts = cups => { const out = {}; for (const c of cups || []) if (c) out[c] = (out[c] || 0) + 1; return out; };
const fitColor = c => { if (settings.colors.includes(c)) return c; const f = FALLBACK_COLOR[c]; return f && settings.colors.includes(f) ? f : settings.colors[0]; };
const eggHtml = (c, pop = false) => `<span class="egg e-${COLORS[c] ? c : 'x'}${pop ? ' pop' : ''}"></span>`;
const dot = c => `<span class="dot e-${COLORS[c] ? c : 'x'}"></span>`;
const colorOrder = extra => [...settings.colors, ...extra.filter(c => !settings.colors.includes(c))];
const activeHens = () => Object.values(db.hens).filter(h => h.status !== 'dead');

function stockState() {
  const start = settings.stockStart || '0000-01-01';
  const t = todayKey();
  const events = [];
  for (const d of Object.values(db.days)) if (d.date >= start && d.date <= t) { const n = dayTotal(d); if (n) events.push({ date: d.date, order: 0, add: n }); }
  for (const m of Object.values(db.moves)) if (!m.legacy && m.date >= start && m.date <= t) events.push({ date: m.date, order: m.kind === 'inventory' ? 2 : 1, m });
  events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || (a.m?.createdAt || 0) - (b.m?.createdAt || 0));
  const lots = [];
  const take = n => { while (n > 0 && lots.length) { const l = lots[0]; const k = Math.min(l.n, n); l.n -= k; n -= k; if (!l.n) lots.shift(); } };
  for (const e of events) {
    if (e.add) { lots.push({ date: e.date, n: e.add }); continue; }
    const m = e.m;
    if (m.kind === 'inventory') {
      const cur = lots.reduce((s, l) => s + l.n, 0);
      const target = Math.max(0, Number(m.eggs) || 0);
      if (target > cur) lots.unshift({ date: m.lotDate || m.date, n: target - cur }); else take(cur - target);
    } else take(Number(m.eggs) || 0);
  }
  const b = { week: 0, mid: 0, soon: 0, old: 0 };
  for (const l of lots) { const age = diffDays(l.date, t); if (age <= 6) b.week += l.n; else if (age <= 20) b.mid += l.n; else if (age <= 28) b.soon += l.n; else b.old += l.n; }
  return { total: lots.reduce((s, l) => s + l.n, 0), b };
}
function monthStats(ym) {
  const days = Object.values(db.days).filter(d => d.date.startsWith(ym));
  const counts = {}; let eggs = 0;
  for (const d of days) for (const c of d.cups || []) if (c) { counts[c] = (counts[c] || 0) + 1; eggs += 1; }
  const outs = { eat: 0, sale: 0, gift: 0, broken: 0 }; let income = 0;
  for (const m of Object.values(db.moves)) {
    if (!m.date.startsWith(ym) || m.kind === 'inventory') continue;
    outs[m.kind] = (outs[m.kind] || 0) + (Number(m.eggs) || 0);
    if (m.kind === 'sale') income += Number(m.amount) || 0;
  }
  const expenses = Object.values(db.expenses).filter(x => x.date.startsWith(ym));
  const spent = expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  return { eggs, counts, entered: days.length, perDay: days.length ? eggs / days.length : 0, outs, income, spent, net: income - spent, cost: eggs ? spent / eggs : 0, expenses };
}
function addInterval(k, every, unit) { const n = Math.max(1, Number(every) || 1); if (unit === 'week') return addDays(k, 7 * n); if (unit === 'month') return addMonths(k, n); return addDays(k, n); }
function nextDue(t) {
  const base = t.lastDone || t.anchor;
  let k = base ? addInterval(base, t.every, t.unit) : todayKey();
  if (t.months?.length) {
    let guard = 0;
    while (!t.months.includes(parseKey(k).getMonth() + 1) && guard < 13) { const d = parseKey(k); k = keyOf(new Date(d.getFullYear(), d.getMonth() + 1, 1)); guard += 1; }
  }
  return k;
}
function freqLabel(t) {
  const n = Number(t.every) || 1;
  let s;
  if (t.unit === 'week') s = n === 1 ? 'Chaque semaine' : `Toutes les ${n} semaines`;
  else if (t.unit === 'month') s = n === 1 ? 'Tous les mois' : `Tous les ${n} mois`;
  else s = n === 1 ? 'Tous les jours' : `Tous les ${n} jours`;
  if (t.months?.length) { const a = MONTHS[Math.min(...t.months) - 1]; const b = MONTHS[Math.max(...t.months) - 1]; s += `, ${deOf(a)}${a} à ${b}`; }
  return s;
}
function dueLabel(k) {
  const n = diffDays(todayKey(), k);
  if (n < 0) return { text: `en retard de ${pl(-n, 'jour')}`, cls: 'late' };
  if (n === 0) return { text: 'aujourd’hui', cls: 'soon' };
  if (n === 1) return { text: 'demain', cls: 'soon' };
  if (n < 7) return { text: cap(DOW[parseKey(k).getDay()]), cls: '' };
  if (n < 45) return { text: fmtShort(k), cls: '' };
  return { text: `en ${MONTHS[parseKey(k).getMonth()]}`, cls: '' };
}
function loadVdone() { try { const v = JSON.parse(localStorage.getItem(VDONE_KEY) || 'null'); return v?.date === todayKey() ? v.ids : []; } catch { return []; } }
function weatherTasks() {
  if (!weather) return [];
  const out = [];
  if (weather.min <= 0) out.push({ id: 'w-gel', name: 'Vérifier que l’abreuvoir ne gèle pas', sub: `Ajouté par la météo · ${Math.round(weather.min)}° cette nuit` });
  if (weather.max >= 30) out.push({ id: 'w-chaud', name: 'Ombre et eau fraîche toute la journée', sub: `Ajouté par la météo · ${Math.round(weather.max)}° prévus` });
  return out;
}
function careToday() {
  const t = todayKey(); const vdone = loadVdone();
  const items = [];
  for (const x of Object.values(db.tasks)) {
    if (x.active === false) continue;
    if (x.lastDone === t) items.push({ x, done: true });
    else { const due = nextDue(x); if (due <= t) items.push({ x, done: false, due }); }
  }
  for (const v of weatherTasks()) items.push({ v, done: vdone.includes(v.id) });
  return items.sort((a, b) => Number(a.done) - Number(b.done) || String(a.due || 'z').localeCompare(String(b.due || 'z')));
}
const careTodo = () => careToday().filter(i => !i.done).length;
const openTracks = () => Object.values(db.care).filter(c => c.kind === 'track' && !c.endDate);
const henTracks = h => openTracks().filter(c => c.scope === 'all' || (c.henIds || []).includes(h.id));
function careTarget(c) { if (c.scope === 'all' || !c.henIds?.length) return 'Tout le poulailler'; return c.henIds.map(id => db.hens[id]?.name).filter(Boolean).join(', ') || 'Poule supprimée'; }

// ---------- Rendu ----------
let renderQueued = false;
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
function render() {
  if (document.activeElement?.id === 'hen-search' && ui.tab === 'hens' && $('#hen-list')) { $('#hen-list').innerHTML = henListHtml(); renderTabbar(); return; }
  const views = { home: viewHome, eggs: viewEggs, hens: viewHens, care: viewCare, stats: viewStats };
  $('#view').innerHTML = (views[ui.tab] || viewHome)();
  ui.pop = -1;
  renderTabbar();
}
function renderTabbar() {
  document.querySelectorAll('.tab').forEach(b => { const on = b.dataset.tab === ui.tab; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const n = careTodo(); const badge = $('#care-badge'); badge.textContent = n; badge.hidden = !n;
}
const header = (title, right = '') => `<header class="hdr"><h1>${title}</h1><div class="hdr-r">${right}</div></header>`;
const gearBtn = `<button class="round" data-a="settings" aria-label="Réglages">${ic.sliders}</button>`;
const seg = (items, current, action) => `<div class="seg" role="tablist">${items.map(([v, l]) => `<button role="tab" aria-selected="${v === current}" class="${v === current ? 'on' : ''}" data-a="${action}" data-v="${v}">${l}</button>`).join('')}</div>`;
const avatar = (h, cls = 'av') => `<span class="${cls} t-${COLORS[h.color] ? h.color : 'brun'}">${h.photo ? `<img src="${h.photo}" alt="">` : esc((h.name || '?').charAt(0).toUpperCase())}</span>`;

// Accueil
function viewHome() {
  const t = todayKey(); const k = ui.date; const day = db.days[k]; const cups = day?.cups || [];
  const total = dayTotal(day); const isPast = k !== t;
  let last = -1; cups.forEach((c, i) => { if (c) last = i; });
  const len = Math.max(12, Math.ceil((last + 2) / 12) * 12);
  let cartons = '';
  for (let b = 0; b < len; b += 12) {
    let cells = '';
    for (let i = b; i < b + 12; i += 1) {
      const c = cups[i] || '';
      const label = c ? `Alvéole ${i + 1}, œuf ${COLORS[c]?.one || ''}, toucher pour changer la couleur` : `Alvéole ${i + 1} vide, toucher pour ajouter un œuf`;
      cells += `<button class="cup" data-a="cup" data-i="${i}" aria-label="${label}">${c ? eggHtml(c, i === ui.pop) : ''}</button>`;
    }
    cartons += `<div class="carton">${cells}</div>`;
  }
  const counts = colorCounts(cups);
  const legend = colorOrder(Object.keys(counts)).map(c => `<span class="leg">${dot(c)}${pl(counts[c] || 0, COLORS[c].one, COLORS[c].many)}</span>`).join('');
  let tag = '';
  if (isPast) tag = `<span class="tag">${day ? 'Jour passé' : 'Rien de noté'}</span>`;
  else if (total) tag = '<button class="link small" data-a="clearDay">Vider</button>';
  let foot = '';
  if (!total) {
    foot = day?.zero
      ? `<p class="hint">Aucun œuf noté ${isPast ? 'ce jour-là' : 'aujourd’hui'}.</p>`
      : `<p class="hint">Touche une alvéole pour ajouter un œuf, touche-la encore pour changer sa couleur.</p><button class="ghost-btn" data-a="zeroDay">Aucun œuf ${isPast ? 'ce jour-là' : 'aujourd’hui'}</button>`;
  } else if (isPast) foot = '<button class="link small left" data-a="clearDay">Vider ce jour</button>';

  const start = settings.createdAt || t;
  const keys = [6, 5, 4, 3, 2, 1, 0].map(i => addDays(t, -i));
  const totals = keys.map(key => dayTotal(db.days[key]));
  const max = Math.max(1, ...totals);
  const bars = keys.map((key, i) => {
    const d = db.days[key]; const n = totals[i];
    const miss = !d && key >= start && key < t;
    const h = n ? Math.max(6, Math.round(n / max * 48)) : (miss ? 48 : 6);
    const cls = miss ? 'bar miss' : (!d ? 'bar none' : 'bar');
    const dname = DOW[parseKey(key).getDay()];
    const aria = `${cap(dname)} ${parseKey(key).getDate()}, ${miss ? 'rien de noté' : (d ? pl(n, 'œuf') : 'pas encore noté')}`;
    return `<button class="wk${key === k ? ' on' : ''}" data-a="pickDay" data-d="${key}" aria-label="${aria}"><b>${miss ? '?' : (d ? n : '')}</b><span class="${cls}" style="height:${h}px"></span><i>${dname.charAt(0).toUpperCase()}</i></button>`;
  }).join('');
  const st = stockState();
  const hurry = st.b.soon + st.b.old;

  return `<div class="screen">
    ${header('La récolte', gearBtn)}
    <div class="home-grid">
      <div class="stack">
        <div class="daynav">
          <button class="nav-btn" data-a="dayPrev" aria-label="Jour précédent">${ic.left}</button>
          <button class="date-btn" data-a="calendar" aria-label="Choisir un jour, actuellement ${relDay(k)}">${ic.cal}<span>${relDay(k)}</span></button>
          <button class="nav-btn" data-a="dayNext" aria-label="Jour suivant" ${isPast ? '' : 'disabled'}>${ic.right}</button>
        </div>
        <section class="card hero${isPast ? ' past' : ''}">
          <div class="hero-top"><span class="big-wrap"><span class="big">${total}</span><span class="big-unit">${total > 1 ? 'œufs' : 'œuf'}</span></span>${tag}</div>
          ${cartons}
          <div class="legend">${legend}</div>
          ${foot}
        </section>
      </div>
      <div class="stack">
        <section class="card week">
          <div class="row-between"><strong>7 derniers jours</strong><span class="muted small">${pl(totals.reduce((a, b) => a + b, 0), 'œuf')}</span></div>
          <div class="week-bars">${bars}</div>
        </section>
        <div class="widgets">
          <button class="widget" data-a="tab" data-tab="eggs"><span class="w-lbl">En stock</span><b class="w-big">${st.total}</b><span class="w-sub">${hurry ? `${hurry} à manger vite` : boxesTxt(st.total)}</span></button>
          ${weatherWidget()}
        </div>
      </div>
    </div>
  </div>`;
}
function weatherWidget() {
  if (!weather) return `<section class="widget wx"><span class="w-lbl">Météo</span><b class="w-big">—</b><span class="w-sub">${esc(weatherMsg)}</span></section>`;
  let alert = `Min ${Math.round(weather.min)}° · Max ${Math.round(weather.max)}°`;
  if (weather.min <= 0) alert = `Gel cette nuit (${Math.round(weather.min)}°)`;
  else if (weather.max >= 30) alert = `Forte chaleur (${Math.round(weather.max)}°)`;
  return `<section class="widget wx"><span class="w-lbl">${esc(WX[weather.code] || 'Météo')}</span><b class="w-big">${Math.round(weather.temp)}°</b><span class="w-sub">${alert}</span></section>`;
}
function calendarHtml() {
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const offset = (first.getDay() + 6) % 7; const nDays = new Date(y, m, 0).getDate();
  const t = todayKey(); const start = settings.createdAt || t;
  let cells = '<span></span>'.repeat(offset);
  for (let d = 1; d <= nDays; d += 1) {
    const key = `${y}-${pad(m)}-${pad(d)}`; const future = key > t; const dd = db.days[key]; const n = dayTotal(dd);
    const miss = !dd && key >= start && key < t;
    const cls = ['cal-d', key === ui.date ? 'sel' : '', miss ? 'miss' : '', key === t ? 'today' : ''].filter(Boolean).join(' ');
    const sub = future ? '' : (miss ? '?' : (dd ? n : ''));
    const aria = `${cap(fmtLong(key))}${future ? ', à venir' : (miss ? ', rien de noté' : (dd ? `, ${pl(n, 'œuf')}` : ''))}`;
    cells += `<button class="${cls}" data-a="pickDay" data-d="${key}" ${future ? 'disabled' : ''} aria-label="${aria}"><b>${d}</b><small>${sub}</small></button>`;
  }
  const nextOff = ui.calMonth >= t.slice(0, 7);
  return `<div id="cal" class="stack">
    <div class="cal-nav"><button class="nav-btn" data-a="calPrev" aria-label="Mois précédent">${ic.left}</button><strong>${monthLabel(ui.calMonth)}</strong><button class="nav-btn" data-a="calNext" aria-label="Mois suivant" ${nextOff ? 'disabled' : ''}>${ic.right}</button></div>
    <div class="cal-card"><div class="cal-dow"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="cal-grid">${cells}</div></div>
    <div class="legend"><span class="leg"><span class="sq miss"></span>Jour sans saisie</span><span class="leg"><span class="sq sel"></span>Jour affiché</span></div>
    <button class="primary" data-a="pickDay" data-d="${t}">Revenir à aujourd’hui</button>
  </div>`;
}

// Œufs
function viewEggs() {
  const st = stockState();
  const body = ui.eggsView === 'journal' ? journalHtml() : stockHtml(st);
  return `<div class="screen">${header('Œufs', gearBtn)}${seg([['stock', 'Stock'], ['journal', 'Journal']], ui.eggsView, 'eggsView')}${body}</div>`;
}
function stockHtml(st) {
  const rows = [['f-ok', 'Pondus cette semaine', st.b.week], ['f-ok', 'De 1 à 3 semaines', st.b.mid], ['f-soon', 'De 3 à 4 semaines · à consommer vite', st.b.soon], ['f-old', 'Plus de 28 jours', st.b.old]];
  return `<div class="cols">
    <div>
      ${settings.migratedFrom && !Object.values(db.moves).some(m => m.kind === 'inventory') ? '<p class="warn mb">Le stock démarre avec la nouvelle version. Compte tes œufs et fais un inventaire pour partir du bon chiffre.</p>' : ''}
      <section class="card stock-card">
        <div class="big-row"><span class="big">${st.total}</span><span class="muted">${st.total > 1 ? 'œufs' : 'œuf'} en stock · ${boxesTxt(st.total)}</span></div>
        ${rows.map(([c, l, n]) => `<div class="fresh"><span class="fd ${c}"></span><span>${l}</span><b>${n}</b></div>`).join('')}
        <button class="row-link" data-a="inventory">Corriger le stock (inventaire)</button>
      </section>
      <h3 class="sec">Sortir des œufs</h3>
      <div class="out-grid">${Object.entries(OUT_KINDS).map(([k, l]) => `<button class="out-btn" data-a="out" data-k="${k}">${ic[k]}${l}</button>`).join('')}</div>
    </div>
    <div>
      <h3 class="sec">Mouvements récents</h3>
      <section class="card list">${movesList(8)}</section>
    </div>
  </div>`;
}
function allMovements() {
  const items = [];
  for (const d of Object.values(db.days)) { const n = dayTotal(d); if (n) items.push({ kind: 'harvest', date: d.date, n, d, ts: d.updatedAt || 0 }); }
  for (const m of Object.values(db.moves)) items.push({ kind: m.kind, date: m.date, m, ts: m.createdAt || 0 });
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
}
function moveRow(it) {
  if (it.kind === 'harvest') {
    const counts = colorCounts(it.d.cups);
    const detail = colorOrder(Object.keys(counts)).filter(c => counts[c]).map(c => pl(counts[c], COLORS[c].one, COLORS[c].many)).join(', ');
    return `<button class="row" data-a="pickDay" data-d="${it.date}"><span class="tx"><b>Récolte</b><small>${relShort(it.date)} · ${detail}</small></span><span class="val plus">+${it.n}</span></button>`;
  }
  const m = it.m; const eggs = Number(m.eggs) || 0;
  const qty = eggs % 6 === 0 && eggs ? pl(eggs / 6, 'boîte') : pl(eggs, 'œuf');
  let title = OUT_KINDS[m.kind] || 'Mouvement'; let val = `−${eggs}`;
  if (m.kind === 'sale') title = m.legacy ? 'Vente (ancienne version)' : `Vendus · ${qty}`;
  if (m.kind === 'gift') title = `Donnés · ${qty}`;
  if (m.kind === 'inventory') { title = 'Inventaire'; val = `= ${eggs}`; }
  if (m.legacy) val = '';
  const sub = [relShort(m.date), m.person, m.kind === 'sale' ? euro(m.amount) : '', m.note].filter(Boolean).map(esc).join(' · ');
  return `<button class="row" data-a="moveMenu" data-id="${esc(m.id)}"><span class="tx"><b>${esc(title)}</b><small>${sub}</small></span><span class="val">${val}</span></button>`;
}
function movesList(limit) {
  const items = allMovements();
  if (!items.length) return '<p class="empty">Aucun mouvement pour l’instant.</p>';
  return items.slice(0, limit).map(moveRow).join('');
}
function journalHtml() {
  const items = allMovements();
  if (!items.length) return '<section class="card list"><p class="empty">Le journal est vide. Note ta première récolte depuis l’accueil.</p></section>';
  let html = ''; let current = '';
  for (const it of items.slice(0, ui.journalLimit)) {
    const ym = it.date.slice(0, 7);
    if (ym !== current) { if (current) html += '</section>'; html += `<h3 class="sec">${monthLabel(ym)}</h3><section class="card list">`; current = ym; }
    html += moveRow(it);
  }
  html += '</section>';
  if (items.length > ui.journalLimit) html += '<button class="secondary mt" data-a="journalMore">Afficher plus</button>';
  return html;
}

// Poules
function viewHens() {
  const hen = ui.henId ? db.hens[ui.henId] : null;
  if (hen && !wide()) return `<div class="screen">${henDetail(hen, true)}</div>`;
  const act = Object.values(db.hens).filter(h => h.status === 'active').length;
  const rest = Object.values(db.hens).filter(h => h.status === 'rest').length;
  const list = `${header('Poules', `<button class="round accent" data-a="henNew" aria-label="Ajouter une poule">${ic.plus}</button>`)}
    <p class="sub">${pl(act, 'active')}${rest ? ` · ${rest} au repos` : ''}</p>
    <label class="search">${ic.search}<input id="hen-search" type="search" placeholder="Rechercher" value="${esc(ui.search)}" aria-label="Rechercher une poule" autocomplete="off"></label>
    ${seg([['active', 'Actives'], ['rest', 'Au repos'], ['dead', 'Cimetière']], ui.henFilter, 'henFilter')}
    <div id="hen-list">${henListHtml()}</div>`;
  if (!wide()) return `<div class="screen">${list}</div>`;
  const sel = hen || visibleHens()[0];
  return `<div class="screen split"><div class="pane-l">${list}</div><div class="pane-r">${sel ? henDetail(sel, false) : '<section class="card"><p class="empty">Ajoute ta première poule avec le bouton +.</p></section>'}</div></div>`;
}
function visibleHens() {
  const q = ui.search.trim().toLowerCase();
  return Object.values(db.hens)
    .filter(h => h.status === ui.henFilter)
    .filter(h => !q || `${h.name} ${h.breed}`.toLowerCase().includes(q))
    .sort((a, b) => ui.henFilter === 'dead' ? String(b.deathDate).localeCompare(String(a.deathDate)) : a.name.localeCompare(b.name, 'fr'));
}
function henRow(h) {
  const sel = wide() && (ui.henId ? ui.henId === h.id : false);
  const tracks = henTracks(h).filter(c => c.scope !== 'all');
  const tag = tracks.length ? `<span class="tag">${esc(TRACK_TAG[tracks[0].type] || tracks[0].type)}</span>` : '';
  const sub = h.status === 'dead' ? `${esc(h.breed || 'Race non renseignée')}${h.deathDate ? ` · ${fmtShort(h.deathDate)}` : ''}` : esc(h.breed || 'Race non renseignée');
  return `<button class="row hen-row${sel ? ' sel' : ''}" data-a="hen" data-id="${esc(h.id)}">${avatar(h)}<span class="tx"><b>${esc(h.name)}</b><small>${sub}</small></span>${tag}${ic.chev}</button>`;
}
function henListHtml() {
  const hens = visibleHens();
  if (!hens.length) {
    const msg = ui.search ? 'Aucune poule ne correspond.' : ({ active: 'Aucune poule active. Ajoute ta première poule avec le bouton +.', rest: 'Aucune poule au repos.', dead: 'Le cimetière est vide.' }[ui.henFilter]);
    return `<section class="card"><p class="empty">${msg}</p></section>`;
  }
  if (ui.henFilter === 'dead') return `<section class="card list">${hens.map(henRow).join('')}</section>`;
  const groups = {};
  for (const h of hens) (groups[h.color || 'brun'] = groups[h.color || 'brun'] || []).push(h);
  return colorOrder(Object.keys(groups)).filter(c => groups[c]).map(c => `<h3 class="sec with-dot">${dot(c)}Œufs ${COLORS[c].many} · ${groups[c].length}</h3><section class="card list">${groups[c].map(henRow).join('')}</section>`).join('');
}
function henDetail(h, withBack) {
  const color = h.color || 'brun'; const ym = todayKey().slice(0, 7);
  const monthEggs = Object.values(db.days).filter(d => d.date.startsWith(ym)).reduce((s, d) => s + (d.cups || []).filter(c => c === color).length, 0);
  const mates = Object.values(db.hens).filter(x => x.status === 'active' && (x.color || 'brun') === color).length;
  const statusLabel = { active: 'Active', rest: 'Au repos', dead: 'Décédée' }[h.status] || 'Active';
  const info = [
    h.arrival ? ['Arrivée', `${fmtShort(h.arrival)} · ${ageLabel(h.arrival)}`] : null,
    ['Race', esc(h.breed || 'Non renseignée')],
    ['Couleur des œufs', `${dot(color)} ${COLORS[color].label}`],
    h.status === 'dead' ? ['Décès', h.deathDate ? fmtShort(h.deathDate) : 'Date inconnue'] : null,
    h.status === 'active' ? [`Œufs ${COLORS[color].many} ce mois`, `${monthEggs} pour ${pl(mates || 1, 'poule')}`] : null,
    h.status === 'active' && mates ? ['Part estimée', `≈ ${Math.round(monthEggs / mates)} œufs ce mois`] : null
  ].filter(Boolean).map(([a, b]) => `<div class="row static"><span class="muted grow">${a}</span><span class="r">${b}</span></div>`).join('');
  const upcoming = h.status === 'dead' ? '' : Object.values(db.tasks).filter(t => t.cat === 'soin' && t.active !== false).map(t => {
    const due = dueLabel(nextDue(t));
    return `<button class="row" data-a="taskEdit" data-id="${t.id}"><span class="tx"><b>${esc(t.name)}</b><small>Tout le poulailler · ${freqLabel(t)}</small></span><span class="due ${due.cls}">${due.text}</span></button>`;
  }).join('');
  const history = Object.values(db.care)
    .filter(c => (c.henIds || []).includes(h.id) || (c.scope === 'all' && (!h.arrival || c.date >= h.arrival) && (h.status !== 'dead' || !h.deathDate || c.date <= h.deathDate)))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
    .map(c => careRow(c, true)).join('');
  const note = h.status === 'dead' && h.deathNote ? `<section class="card quote"><p>« ${esc(h.deathNote)} »</p></section>` : '';
  const actions = h.status === 'dead'
    ? `<button class="row" data-a="henRestore" data-id="${esc(h.id)}"><span class="tx"><b>Remettre au poulailler</b></span></button><button class="row" data-a="henDelete" data-id="${esc(h.id)}"><span class="tx"><b class="danger">Supprimer la fiche</b></span></button>`
    : `<button class="row" data-a="henStatus" data-id="${esc(h.id)}"><span class="tx"><b>${h.status === 'rest' ? 'Remettre en activité' : 'Mettre au repos'}</b></span></button><button class="row" data-a="henDead" data-id="${esc(h.id)}"><span class="tx"><b class="danger">Déclarer décédée</b></span></button>`;
  return `<div class="fiche">
    <div class="fiche-nav">${withBack ? `<button class="link back" data-a="henBack">${ic.back}Poules</button>` : '<span></span>'}<button class="link" data-a="henEdit" data-id="${esc(h.id)}">Modifier</button></div>
    <div class="fiche-top">${avatar(h, 'av xl')}<h2>${esc(h.name)}</h2><span class="muted">${COLORS[color].label} · ${statusLabel}</span></div>
    ${note}
    <section class="card list">${info}</section>
    <h3 class="sec">Soins</h3>
    <section class="card list">${upcoming}${history}<button class="row add" data-a="careNew" data-hen="${esc(h.id)}">${ic.plus}<span>Ajouter un soin ou une note</span></button></section>
    <section class="card list mt">${actions}</section>
  </div>`;
}
function careRow(c, compact = false) {
  let sub = c.kind === 'track' ? (c.endDate ? `Du ${fmtShort(c.date)} au ${fmtShort(c.endDate)}` : `Depuis le ${fmtShort(c.date)} · en cours`) : relShort(c.date);
  if (!compact || c.scope !== 'all') sub = `${sub} · ${esc(careTarget(c))}`;
  else sub = `${sub} · Tout le poulailler`;
  if (c.note) sub += ` · ${esc(c.note)}`;
  return `<button class="row" data-a="careMenu" data-id="${esc(c.id)}"><span class="tx"><b>${esc(c.type)}</b><small>${sub}</small></span></button>`;
}

// Soins
function viewCare() {
  const t = todayKey(); const today = careToday();
  const todo = today.filter(i => !i.done).length;
  const rows = today.map(i => {
    const id = i.x ? i.x.id : i.v.id; const name = i.x ? i.x.name : i.v.name;
    let sub = i.x ? `${i.x.cat === 'soin' ? 'Soin · ' : ''}${freqLabel(i.x)}` : i.v.sub;
    if (i.x && !i.done && i.due < t) sub += ` · en retard de ${pl(diffDays(i.due, t), 'jour')}`;
    const box = `<button class="chk${i.done ? ' on' : ''}" role="checkbox" aria-checked="${i.done}" aria-label="${esc(name)}" data-a="${i.x ? 'task' : 'vtask'}" data-id="${id}"><span class="box">${i.done ? ic.check : ''}</span></button>`;
    const text = `<b class="${i.done ? 'done' : ''}">${esc(name)}</b><small>${esc(sub)}</small>`;
    return `<div class="chk-row">${box}${i.x ? `<button class="tx" data-a="taskEdit" data-id="${id}">${text}</button>` : `<span class="tx">${text}</span>`}</div>`;
  }).join('');
  const upcoming = Object.values(db.tasks).filter(x => x.active !== false && x.lastDone !== t).map(x => ({ x, due: nextDue(x) })).filter(i => i.due > t).sort((a, b) => a.due.localeCompare(b.due));
  const upRows = upcoming.map(({ x, due }) => { const d = dueLabel(due); return `<button class="row" data-a="taskEdit" data-id="${x.id}"><span class="tx"><b>${esc(x.name)}</b><small>${x.cat === 'soin' ? 'Soin · ' : ''}${freqLabel(x)}</small></span><span class="due ${d.cls}">${d.text}</span></button>`; }).join('');
  const tracks = openTracks().sort((a, b) => a.date.localeCompare(b.date)).map(c => `<div class="row static"><span class="tx"><b>${esc(careTarget(c))} · ${esc(c.type.toLowerCase())}</b><small>Depuis ${pl(diffDays(c.date, t), 'jour')} (${fmtShort(c.date)})</small></span><button class="pill-btn" data-a="trackEnd" data-id="${esc(c.id)}">Terminer</button></div>`).join('');
  const history = Object.values(db.care).filter(c => !(c.kind === 'track' && !c.endDate)).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10).map(c => careRow(c)).join('');
  return `<div class="screen">
    ${header('Soins', `<button class="round accent" data-a="careNew" aria-label="Noter un soin ou créer une routine">${ic.plus}</button>`)}
    <p class="sub">${todo ? `${todo} à faire aujourd’hui` : 'Tout est fait pour aujourd’hui'}</p>
    <div class="cols">
      <div>
        <h3 class="sec">Aujourd’hui</h3>
        <section class="card list">${rows || '<p class="empty">Rien de prévu aujourd’hui.</p>'}</section>
        ${tracks ? `<h3 class="sec">Suivis en cours</h3><section class="card list">${tracks}</section>` : ''}
      </div>
      <div>
        <h3 class="sec">À venir</h3>
        <section class="card list">${upRows || '<p class="empty">Aucune routine à venir.</p>'}<button class="row add" data-a="taskNew">${ic.plus}<span>Nouvelle routine</span></button></section>
        <h3 class="sec">Historique des soins</h3>
        <section class="card list">${history || '<p class="empty">Aucun soin noté pour l’instant.</p>'}</section>
      </div>
    </div>
  </div>`;
}

// Bilan
function viewStats() {
  const ym = ui.month; const s = monthStats(ym); const cur = todayKey().slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => addMonthYm(cur, i - 11));
  const vals = months.map(m => monthStats(m).eggs); const max = Math.max(1, ...vals);
  const bars = months.map((m, i) => `<button class="wk${m === ym ? ' on' : ''}" data-a="mPick" data-m="${m}" aria-label="${monthLabel(m)}, ${pl(vals[i], 'œuf')}"><b>${vals[i] || ''}</b><span class="bar${vals[i] ? '' : ' none'}" style="height:${vals[i] ? Math.max(6, Math.round(vals[i] / max * 80)) : 4}px"></span><i>${MONTHS_SHORT[Number(m.slice(5)) - 1].replace('.', '')}</i></button>`).join('');
  const colorKeys = colorOrder(Object.keys(s.counts)).filter(c => s.counts[c]);
  const stackbar = s.eggs ? `<div class="stackbar">${colorKeys.map(c => `<span class="e-${c} flat" style="flex:${s.counts[c]} 1 0"></span>`).join('')}</div><div class="legend">${colorKeys.map(c => `<span class="leg">${dot(c)}${cap(COLORS[c].many)} ${s.counts[c]}</span>`).join('')}</div>` : '<p class="hint">Aucun œuf noté ce mois-ci.</p>';
  const exp = s.expenses.sort((a, b) => b.date.localeCompare(a.date)).map(x => `<button class="row" data-a="expMenu" data-id="${esc(x.id)}"><span class="tx"><b>${esc((EXP_CATS.find(c => c[0] === x.cat) || EXP_CATS[5])[1])}</b><small>${[fmtShort(x.date), x.note].filter(Boolean).map(esc).join(' · ')}</small></span><span class="val">${euro(x.amount)}</span></button>`).join('');
  return `<div class="screen">
    ${header('Bilan', gearBtn)}
    <div class="daynav">
      <button class="nav-btn" data-a="mPrev" aria-label="Mois précédent">${ic.left}</button>
      <span class="date-btn static">${monthLabel(ym)}</span>
      <button class="nav-btn" data-a="mNext" aria-label="Mois suivant" ${ym >= cur ? 'disabled' : ''}>${ic.right}</button>
    </div>
    <div class="kpis">
      <div class="kpi"><span>Œufs</span><b>${s.eggs}</b></div>
      <div class="kpi"><span>Par jour</span><b>${dec(s.perDay)}</b></div>
      <div class="kpi"><span>Coût / œuf</span><b>${s.eggs ? euro(s.cost) : '—'}</b></div>
      <div class="kpi"><span>Recettes</span><b class="pos">${euro(s.income)}</b></div>
      <div class="kpi"><span>Dépenses</span><b>${euro(s.spent)}</b></div>
      <div class="kpi"><span>Solde</span><b class="${s.net >= 0 ? 'pos' : 'neg'}">${s.net >= 0 ? '+' : '−'}${euro(Math.abs(s.net))}</b></div>
    </div>
    <div class="cols mt">
      <div class="stack">
        <section class="card pad"><strong>Œufs par mois</strong><div class="month-bars">${bars}</div></section>
        <section class="card pad"><strong>Par couleur</strong>${stackbar}
          <div class="divider"></div><strong>Où sont partis les œufs</strong>
          <div class="outs">${Object.entries(OUT_KINDS).map(([k, l]) => `<div><b>${s.outs[k] || 0}</b><span>${l.toLowerCase()}</span></div>`).join('')}</div>
        </section>
      </div>
      <div>
        <h3 class="sec">Dépenses du mois</h3>
        <section class="card list">${exp || '<p class="empty">Aucune dépense ce mois-ci.</p>'}<button class="row add" data-a="expNew">${ic.plus}<span>Ajouter une dépense</span></button></section>
      </div>
    </div>
  </div>`;
}

// ---------- Feuilles (bottom sheets) ----------
function openSheet({ title, body, action = '', onAction = null, cancel = 'Annuler' }) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop" data-a="closeSheet"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grab"></div><div class="sheet-hd"><button class="link" data-a="closeSheet">${cancel}</button><h2>${esc(title)}</h2>${action ? `<button class="link strong" data-a="sheetAction">${esc(action)}</button>` : '<span></span>'}</div><div class="sheet-bd">${body}</div></section>`;
  sheetHandler = onAction;
  requestAnimationFrame(() => root.classList.add('open'));
}
function closeSheet() {
  const root = $('#sheet-root'); root.classList.remove('open');
  sheetHandler = null; sheetState = null;
  setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 260);
}
function refreshSheet() { const bd = $('#sheet-root .sheet-bd'); if (bd && sheetState?.render) { const top = bd.scrollTop; bd.innerHTML = sheetState.render(); bd.scrollTop = top; } }
function confirmSheet(title, text, label, fn, danger = true) {
  sheetState = null;
  openSheet({ title, body: `<p class="lead">${text}</p><button class="${danger ? 'danger-btn' : 'primary'}" data-a="sheetAction">${esc(label)}</button>`, onAction: fn });
}
const field = (label, input) => `<label class="field"><span>${label}</span>${input}</label>`;
const chips = (items, current, action, multi = false) => `<div class="chips">${items.map(([v, l]) => { const on = multi ? current.includes(v) : v === current; return `<button class="chip${on ? ' on' : ''}" data-a="${action}" data-v="${esc(v)}" aria-pressed="${on}">${l}</button>`; }).join('')}</div>`;
const stepper = (val, unit, action) => `<div class="stepper"><button class="step" data-a="${action}" data-d="-1" aria-label="Moins">${ic.minus}</button><div class="step-val"><b>${val}</b><span>${unit}</span></div><button class="step" data-a="${action}" data-d="1" aria-label="Plus">${ic.plus}</button></div>`;

// Sortie d’œufs
function openOut(kind = 'sale') {
  sheetState = { kind, qty: 1, box: kind === 'sale' || kind === 'gift', date: todayKey(), person: '', amount: '', note: '', render: outBody };
  openSheet({ title: 'Sortir des œufs', body: outBody(), action: 'Enregistrer', onAction: saveOut });
}
function outBody() {
  const s = sheetState; const eggs = s.box ? s.qty * 6 : s.qty; const stock = stockState().total; const auto = eggs / 6 * settings.boxPrice;
  const people = [...new Set(Object.values(db.moves).filter(m => m.kind === s.kind && m.person).sort((a, b) => b.date.localeCompare(a.date)).map(m => m.person))].slice(0, 5);
  const unit = s.box ? (s.qty > 1 ? 'boîtes' : 'boîte') : (s.qty > 1 ? 'œufs' : 'œuf');
  return `${seg(Object.entries(OUT_KINDS), s.kind, 'sk')}
    ${stepper(s.qty, unit, 'sq')}
    <div class="center">${seg([['box', 'Boîtes de 6'], ['unit', 'À l’unité']], s.box ? 'box' : 'unit', 'su')}</div>
    <p class="hint center">${pl(eggs, 'œuf')} sur ${stock} en stock · les plus anciens partent en premier</p>
    ${eggs > stock ? '<p class="warn">C’est plus que le stock enregistré. Tu peux corriger le stock depuis l’onglet Œufs.</p>' : ''}
    ${s.kind === 'sale' ? `${field('Montant', `<input data-f="amount" inputmode="decimal" placeholder="${dec(auto, 2)} €" value="${esc(s.amount)}">`)}<p class="hint">${euro(settings.boxPrice)} la boîte de 6 · modifiable dans les réglages</p>` : ''}
    ${s.kind === 'sale' || s.kind === 'gift' ? `${field(s.kind === 'sale' ? 'Client (facultatif)' : 'Donnés à (facultatif)', `<input data-f="person" value="${esc(s.person)}" placeholder="Nom" autocomplete="off">`)}${people.length ? chips(people.map(p => [p, esc(p)]), s.person, 'sp') : ''}` : ''}
    ${field('Date', `<input type="date" data-f="date" value="${esc(s.date)}" max="${todayKey()}">`)}
    ${field('Note (facultative)', `<input data-f="note" value="${esc(s.note)}" maxlength="80">`)}`;
}
function saveOut() {
  const s = sheetState; const eggs = s.box ? s.qty * 6 : s.qty;
  if (!isKey(s.date)) return toast('Choisis une date');
  const amount = s.kind === 'sale' ? (String(s.amount).trim() ? parseNum(s.amount) : eggs / 6 * settings.boxPrice) : 0;
  put('moves', { id: newId('move'), kind: s.kind, eggs, date: s.date, amount, person: s.person.trim(), note: s.note.trim(), createdAt: Date.now() });
  closeSheet(); render();
  toast(`${pl(eggs, 'œuf')} ${OUT_KINDS[s.kind].toLowerCase()}`);
}
function openInventory() {
  const cur = stockState().total;
  sheetState = { n: cur, age: 'mid', render: invBody };
  openSheet({ title: 'Inventaire', body: invBody(), action: 'Enregistrer', onAction: saveInventory });
}
function invBody() {
  const s = sheetState; const cur = stockState().total;
  return `<p class="lead">Compte les œufs que tu as vraiment, l’app ajuste le stock.</p>
    <div class="stepper"><button class="step" data-a="invq" data-d="-6" aria-label="Moins 6">−6</button><button class="step" data-a="invq" data-d="-1" aria-label="Moins 1">${ic.minus}</button><div class="step-val"><b>${s.n}</b><span>${s.n > 1 ? 'œufs' : 'œuf'}</span></div><button class="step" data-a="invq" data-d="1" aria-label="Plus 1">${ic.plus}</button><button class="step" data-a="invq" data-d="6" aria-label="Plus 6">+6</button></div>
    <p class="hint center">Stock enregistré : ${cur}</p>
    ${s.n > cur ? `<span class="field-lbl">Âge des œufs en plus</span>${chips([['fresh', 'Moins d’une semaine'], ['mid', '1 à 3 semaines'], ['old', 'Plus de 3 semaines']], s.age, 'inva')}` : ''}`;
}
function saveInventory() {
  const s = sheetState; const t = todayKey();
  put('moves', { id: newId('move'), kind: 'inventory', eggs: s.n, date: t, lotDate: addDays(t, -({ fresh: 3, mid: 14, old: 24 }[s.age] || 14)), createdAt: Date.now() });
  closeSheet(); render(); toast(`Stock corrigé : ${pl(s.n, 'œuf')}`);
}

// Poules : formulaires
function openHenForm(id = null) {
  const h = id ? db.hens[id] : null;
  sheetState = { id, name: h?.name || '', breed: h?.breed || '', color: h?.color || settings.colors[0], arrival: h?.arrival || '', status: h?.status === 'rest' ? 'rest' : 'active', photo: h?.photo || '', render: henFormBody };
  openSheet({ title: h ? 'Modifier la fiche' : 'Nouvelle poule', body: henFormBody(), action: 'Enregistrer', onAction: saveHen });
}
function henFormBody() {
  const s = sheetState;
  const known = BREEDS.flatMap(g => g[1]);
  const extra = s.breed && !known.includes(s.breed) ? `<option value="${esc(s.breed)}" selected>${esc(s.breed)}</option>` : '';
  const options = `<option value="">Choisir une race</option>${extra}${BREEDS.map(([g, list]) => `<optgroup label="${g}">${list.map(b => `<option value="${esc(b)}" ${b === s.breed ? 'selected' : ''}>${esc(b)}</option>`).join('')}</optgroup>`).join('')}`;
  const colorChoices = colorOrder(s.color ? [s.color] : []).map(c => [c, `${dot(c)}${COLORS[c].label}`]);
  return `<div class="photo-pick"><label class="photo-big" for="hen-photo">${s.photo ? `<img src="${s.photo}" alt="Photo de la poule">` : `${ic.camera}<span>Photo</span>`}</label><input id="hen-photo" type="file" accept="image/*" hidden>${s.photo ? '<button class="link small danger" data-a="henPhotoDel">Retirer la photo</button>' : ''}</div>
    ${field('Nom', `<input data-f="name" value="${esc(s.name)}" maxlength="30" placeholder="Ex. Marguerite" autocomplete="off">`)}
    ${field('Race', `<select data-f="breed">${options}</select>`)}
    <span class="field-lbl">Couleur des œufs</span>${chips(colorChoices, s.color, 'hc')}
    ${field('Date d’arrivée (facultative)', `<input type="date" data-f="arrival" value="${esc(s.arrival)}" max="${todayKey()}">`)}
    ${db.hens[s.id]?.status === 'dead' ? '' : `<span class="field-lbl">Statut</span>${seg([['active', 'Active'], ['rest', 'Au repos']], s.status, 'hs')}`}`;
}
function saveHen() {
  const s = sheetState; const name = s.name.trim();
  if (!name) return toast('Donne un nom à cette poule');
  const existing = s.id ? db.hens[s.id] : null;
  const h = existing ? { ...existing } : { id: newId('hen'), createdAt: Date.now() };
  Object.assign(h, { name, breed: s.breed, color: s.color, arrival: s.arrival, photo: s.photo, status: existing?.status === 'dead' ? 'dead' : s.status });
  put('hens', h); ui.henId = h.id; closeSheet(); render();
  toast(existing ? `${name} a été modifiée` : `${name} a rejoint le poulailler`);
}
function readPhoto(file) {
  if (!file || !sheetState) return;
  const url = URL.createObjectURL(file); const img = new Image();
  img.onload = () => {
    const max = 420; const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * r)); canvas.height = Math.max(1, Math.round(img.naturalHeight * r));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#F4EEE4'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (sheetState) { sheetState.photo = canvas.toDataURL('image/jpeg', 0.74); refreshSheet(); }
    URL.revokeObjectURL(url);
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Cette photo ne peut pas être utilisée'); };
  img.src = url;
}
function openDeath(id) {
  const h = db.hens[id]; if (!h) return;
  sheetState = { id, date: todayKey(), note: '', render: () => `<p class="lead">${esc(h.name)} rejoindra le cimetière. Tu pourras toujours la remettre au poulailler.</p>${field('Date du décès', `<input type="date" data-f="date" value="${esc(sheetState.date)}" max="${todayKey()}">`)}${field('Un mot pour elle (facultatif)', `<textarea data-f="note" rows="3" maxlength="200">${esc(sheetState.note)}</textarea>`)}` };
  openSheet({ title: 'Déclarer le décès', body: sheetState.render(), action: 'Confirmer', onAction: () => {
    const s = sheetState; put('hens', { ...h, status: 'dead', deathDate: isKey(s.date) ? s.date : todayKey(), deathNote: s.note.trim() });
    closeSheet(); render(); toast(`${h.name} a rejoint le cimetière`);
  } });
}

// Soins : formulaires
function openCareForm(henId = '') {
  sheetState = { type: CARE_TYPES[0][0], scope: henId ? 'hens' : 'all', henIds: henId ? [henId] : [], date: todayKey(), note: '', render: careFormBody };
  openSheet({ title: 'Noter un soin', body: careFormBody(), action: 'Enregistrer', onAction: saveCare });
}
function careFormBody() {
  const s = sheetState; const kind = (CARE_TYPES.find(c => c[0] === s.type) || CARE_TYPES[0])[1];
  const hens = activeHens().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return `<span class="field-lbl">Type</span>${chips(CARE_TYPES.map(([v]) => [v, esc(v)]), s.type, 'ct')}
    ${kind === 'track' ? '<p class="hint">Suivi : il restera « en cours » dans l’onglet Soins jusqu’à ce que tu le termines.</p>' : ''}
    <span class="field-lbl">Pour</span>${seg([['all', 'Tout le poulailler'], ['hens', 'Certaines poules']], s.scope, 'cs')}
    ${s.scope === 'hens' ? (hens.length ? chips(hens.map(h => [h.id, esc(h.name)]), s.henIds, 'ch', true) : '<p class="hint">Aucune poule active.</p>') : ''}
    ${field(kind === 'track' ? 'Début' : 'Date', `<input type="date" data-f="date" value="${esc(s.date)}" max="${todayKey()}">`)}
    ${field('Note (facultative)', `<textarea data-f="note" rows="2" maxlength="200" placeholder="Produit, dose, observation…">${esc(s.note)}</textarea>`)}
    <button class="link small left" data-a="taskNew">Plutôt créer une routine répétée</button>`;
}
function saveCare() {
  const s = sheetState; const kind = (CARE_TYPES.find(c => c[0] === s.type) || CARE_TYPES[0])[1];
  if (s.scope === 'hens' && !s.henIds.length) return toast('Choisis au moins une poule');
  put('care', { id: newId('care'), type: s.type, kind, scope: s.scope, henIds: s.scope === 'hens' ? s.henIds : [], date: isKey(s.date) ? s.date : todayKey(), endDate: '', note: s.note.trim(), createdAt: Date.now() });
  closeSheet(); render(); toast(kind === 'track' ? 'Suivi commencé' : 'Soin noté');
}
function openTaskForm(id = null) {
  const t = id ? db.tasks[id] : null;
  sheetState = { id, name: t?.name || '', every: t?.every || 1, unit: t?.unit || 'week', cat: t?.cat || 'routine', lastDone: t?.lastDone || '', season: t?.months?.length ? 'season' : 'all', months: t?.months || [4, 5, 6, 7, 8, 9, 10], render: taskFormBody };
  openSheet({ title: t ? 'Routine' : 'Nouvelle routine', body: taskFormBody(), action: 'Enregistrer', onAction: saveTask });
}
function taskFormBody() {
  const s = sheetState; const units = { day: s.every > 1 ? 'jours' : 'jour', week: s.every > 1 ? 'semaines' : 'semaine', month: 'mois' };
  return `${field('Nom', `<input data-f="name" value="${esc(s.name)}" maxlength="50" placeholder="Ex. Nettoyer les pondoirs" autocomplete="off">`)}
    <span class="field-lbl">Tous les</span>${stepper(s.every, units[s.unit], 'te')}
    ${seg([['day', 'Jours'], ['week', 'Semaines'], ['month', 'Mois']], s.unit, 'tu')}
    <span class="field-lbl">Type</span>${seg([['routine', 'Routine'], ['soin', 'Soin (dans les fiches)']], s.cat, 'tc')}
    <span class="field-lbl">Période</span>${seg([['all', 'Toute l’année'], ['season', 'D’avril à octobre']], s.season, 'tm')}
    ${field('Fait pour la dernière fois (facultatif)', `<input type="date" data-f="lastDone" value="${esc(s.lastDone)}" max="${todayKey()}">`)}
    ${s.id ? '<button class="danger-btn" data-a="taskDelete">Supprimer cette routine</button>' : ''}`;
}
function saveTask() {
  const s = sheetState; const name = s.name.trim();
  if (!name) return toast('Donne un nom à cette routine');
  const t = s.id ? { ...db.tasks[s.id] } : { id: newId('task'), active: true, createdAt: Date.now() };
  Object.assign(t, { name, every: Math.max(1, Number(s.every) || 1), unit: s.unit, cat: s.cat, lastDone: isKey(s.lastDone) ? s.lastDone : null, months: s.season === 'season' ? s.months : [] });
  put('tasks', t); closeSheet(); render(); toast('Routine enregistrée');
}
function toggleTask(id) {
  const t = { ...db.tasks[id] }; const k = todayKey();
  if (!t.id) return;
  if (t.lastDone === k) {
    t.lastDone = t.prevDone || null; t.prevDone = null;
    if (t.careId && db.care[t.careId]) del('care', t.careId);
    t.careId = null;
  } else {
    t.prevDone = t.lastDone || null; t.lastDone = k;
    if (t.cat === 'soin') { const c = { id: newId('care'), type: t.name, kind: 'record', scope: 'all', henIds: [], date: k, endDate: '', note: '', taskId: t.id, createdAt: Date.now() }; put('care', c); t.careId = c.id; }
  }
  put('tasks', t); render();
}

// Dépenses
function openExpense() {
  sheetState = { date: todayKey(), cat: 'aliment', amount: '', note: '', render: () => `${field('Montant', `<input data-f="amount" inputmode="decimal" placeholder="Ex. 18,50" value="${esc(sheetState.amount)}">`)}<span class="field-lbl">Catégorie</span>${chips(EXP_CATS, sheetState.cat, 'ec')}${field('Date', `<input type="date" data-f="date" value="${esc(sheetState.date)}" max="${todayKey()}">`)}${field('Note (facultative)', `<input data-f="note" value="${esc(sheetState.note)}" maxlength="80" placeholder="Ex. sac de 25 kg">`)}` };
  openSheet({ title: 'Nouvelle dépense', body: sheetState.render(), action: 'Ajouter', onAction: () => {
    const s = sheetState; const amount = parseNum(s.amount);
    if (amount <= 0) return toast('Indique un montant');
    const date = isKey(s.date) ? s.date : todayKey();
    put('expenses', { id: newId('exp'), date, cat: s.cat, amount, note: s.note.trim(), createdAt: Date.now() });
    ui.month = date.slice(0, 7); closeSheet(); render(); toast('Dépense ajoutée');
  } });
}

// Réglages et compte
function openSettings() {
  sheetState = { name: settings.name || '', boxPrice: dec(settings.boxPrice, 2), render: settingsBody };
  openSheet({ title: 'Réglages', body: settingsBody(), action: 'OK', onAction: saveSettingsSheet, cancel: 'Fermer' });
}
function settingsBody() {
  const s = sheetState;
  const account = user
    ? `<div class="card list"><div class="row static"><span class="tx"><b>${esc(user.displayName || user.email || 'Compte connecté')}</b><small>${mode === 'cloud' ? 'Synchronisé sur tous tes appareils' : 'Connexion en attente de réseau'}</small></span></div><button class="row" data-a="signOut"><span class="tx"><b class="danger">Se déconnecter</b></span></button></div>`
    : `<div class="card list"><div class="row static"><span class="tx"><b>Données sur cet appareil</b><small>Connecte-toi pour sauvegarder et synchroniser</small></span></div><button class="row" data-a="google"><span class="tx"><b>Continuer avec Google</b></span></button><button class="row" data-a="emailAuth"><span class="tx"><b>Avec une adresse e-mail</b></span></button></div>`;
  return `<span class="field-lbl">Compte</span>${account}
    ${field('Prénom', `<input data-f="name" value="${esc(s.name)}" maxlength="30" autocomplete="given-name">`)}
    ${field('Prix de la boîte de 6', `<input data-f="boxPrice" inputmode="decimal" value="${esc(s.boxPrice)}">`)}
    <span class="field-lbl">Couleurs d’œufs au poulailler</span>${chips(COLOR_KEYS.map(c => [c, `${dot(c)}${COLORS[c].label}`]), settings.colors, 'colorToggle', true)}
    <p class="hint">L’ordre des couleurs suit les touches sur la boîte : premier tap = première couleur.</p>
    <span class="field-lbl">Données</span>
    <div class="card list">
      <button class="row" data-a="export"><span class="tx"><b>Exporter mes données</b></span></button>
      <label class="row" for="import-file"><span class="tx"><b>Importer une sauvegarde</b></span></label><input id="import-file" type="file" accept="application/json,.json" hidden>
      <button class="row" data-a="forceUpdate"><span class="tx"><b>Forcer la mise à jour</b></span></button>
      <button class="row" data-a="wipe"><span class="tx"><b class="danger">Supprimer toutes mes données</b></span></button>
    </div>
    <p class="hint center">Poupoules v${APP_VERSION}</p>`;
}
function saveSettingsSheet() {
  const s = sheetState; settings.name = s.name.trim();
  const price = parseNum(s.boxPrice); if (price >= 0) settings.boxPrice = price;
  saveSettings(); closeSheet(); render(); toast('Réglages enregistrés');
}
async function googleAuth() {
  if (!fb) return toast('Connexion indisponible hors ligne');
  const provider = new fb.A.GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  try { await fb.A.signInWithPopup(fb.auth, provider); closeSheet(); toast('Connexion réussie'); }
  catch (error) {
    if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/operation-not-supported-in-this-environment'].includes(error.code)) return fb.A.signInWithRedirect(fb.auth, provider);
    toast(error.code === 'auth/network-request-failed' ? 'Connexion réseau impossible' : `Connexion impossible (${error.code || 'erreur'})`);
  }
}
function openEmailAuth() {
  sheetState = { email: '', password: '', signup: false, error: '', render: () => { const s = sheetState; return `${field('Adresse e-mail', `<input type="email" data-f="email" value="${esc(s.email)}" autocomplete="email" placeholder="toi@exemple.fr">`)}${field('Mot de passe', `<input type="password" data-f="password" value="${esc(s.password)}" autocomplete="${s.signup ? 'new-password' : 'current-password'}" placeholder="6 caractères minimum">`)}${s.error ? `<p class="warn">${esc(s.error)}</p>` : ''}<button class="primary" data-a="sheetAction">${s.signup ? 'Créer mon compte' : 'Se connecter'}</button><button class="link small" data-a="authToggle">${s.signup ? 'J’ai déjà un compte' : 'Créer un compte'}</button>`; } };
  openSheet({ title: 'Connexion', body: sheetState.render(), onAction: emailAuth });
}
async function emailAuth() {
  const s = sheetState; if (!fb) { s.error = 'Connexion indisponible hors ligne.'; return refreshSheet(); }
  if (!s.email.trim() || s.password.length < 6) { s.error = 'Adresse e-mail valide et mot de passe de 6 caractères minimum.'; return refreshSheet(); }
  try {
    if (s.signup) await fb.A.createUserWithEmailAndPassword(fb.auth, s.email.trim(), s.password);
    else await fb.A.signInWithEmailAndPassword(fb.auth, s.email.trim(), s.password);
    closeSheet(); toast('Connexion réussie');
  } catch (error) {
    const map = { 'auth/invalid-credential': 'E-mail ou mot de passe incorrect.', 'auth/email-already-in-use': 'Cet e-mail a déjà un compte.', 'auth/weak-password': 'Mot de passe trop court.', 'auth/invalid-email': 'Cet e-mail n’est pas valide.', 'auth/operation-not-allowed': 'Active E-mail/Mot de passe dans la console Firebase.' };
    s.error = map[error.code] || `Erreur : ${error.code || 'inconnue'}`; refreshSheet();
  }
}
function resetLocal() {
  db = emptyDb(); settings = defaultSettings(); seedTasks(); ownerUid = null;
  ui.date = todayKey(); ui.henId = null; saveLocalNow();
}
async function wipeAll() {
  try {
    if (mode === 'cloud' && fb && user) {
      const { F } = fb; const writes = [];
      for (const c of COLS) { const snap = await F.getDocs(colRef(c)); snap.forEach(d => writes.push({ c, id: d.id, del: true })); }
      writes.push({ meta: true, del: true });
      try { const legacy = await F.getDocs(F.query(F.collection(fb.fs, 'egg_entries'), F.where('userId', '==', user.uid))); await Promise.all(legacy.docs.map(d => F.deleteDoc(d.ref))); } catch { /* rien à supprimer */ }
      await commitWrites(writes);
      resetLocal(); ownerUid = user.uid;
      const seeds = Object.values(db.tasks).map(t => ({ c: 'tasks', id: t.id, data: t }));
      seeds.push({ meta: true, data: settings });
      await commitWrites(seeds);
    } else resetLocal();
    localStorage.removeItem(LEGACY_KEY); localStorage.removeItem(VDONE_KEY);
    closeSheet(); render(); toast('Toutes tes données ont été supprimées');
  } catch (error) { console.warn(error); toast('Suppression incomplète : réessaie avec du réseau'); }
}
function exportData() {
  const blob = new Blob([JSON.stringify({ app: 'Poupoules', version: APP_VERSION, exportedAt: new Date().toISOString(), settings, db }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `poupoules-${todayKey()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Export téléchargé');
}
function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data; try { data = JSON.parse(reader.result); } catch { return toast('Fichier illisible'); }
    if (!data?.db) return toast('Ce fichier n’est pas une sauvegarde Poupoules v3');
    const n = COLS.reduce((s, c) => s + Object.keys(data.db[c] || {}).length, 0);
    confirmSheet('Importer la sauvegarde ?', `${pl(n, 'élément')} seront ajoutés ou remplacés.`, 'Importer', async () => {
      const writes = [];
      for (const c of COLS) for (const [id, o] of Object.entries(data.db[c] || {})) { db[c][id] = o; writes.push({ c, id, data: o }); }
      if (data.settings) { settings = { ...settings, ...data.settings }; writes.push({ meta: true, data: settings }); }
      saveLocalNow();
      if (mode === 'cloud' && fb && user) { try { await commitWrites(writes); } catch { toast('Import enregistré sur l’appareil, synchro à reprendre'); } }
      closeSheet(); render(); toast('Sauvegarde importée');
    }, false);
  };
  reader.readAsText(file);
}
async function forceUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) { await reg.update().catch(() => {}); reg.waiting?.postMessage({ type: 'SKIP_WAITING' }); }
  toast('Mise à jour en cours…');
  setTimeout(() => location.reload(), 900);
}

// ---------- Actions ----------
const A = {
  tab: el => { const tab = el.dataset.tab; if (tab === ui.tab && tab === 'hens') ui.henId = null; if (tab === 'home' && ui.tab === 'home') ui.date = todayKey(); ui.tab = tab; render(); window.scrollTo({ top: 0 }); },
  settings: openSettings,
  closeSheet,
  sheetAction: () => { const fn = sheetHandler; if (fn) fn(); },
  cup: el => {
    const i = Number(el.dataset.i); const k = ui.date; const old = db.days[k];
    const day = old ? { ...old, cups: [...(old.cups || [])] } : { id: k, date: k, cups: [] };
    while (day.cups.length <= i) day.cups.push('');
    const cur = day.cups[i]; const cycle = settings.colors;
    let next;
    if (!cur) next = cycle[0];
    else { const idx = cycle.indexOf(cur); next = idx === -1 ? cycle[0] : (cycle[idx + 1] || ''); }
    day.cups[i] = next;
    while (day.cups.length && !day.cups[day.cups.length - 1]) day.cups.pop();
    day.zero = false; ui.pop = next ? i : -1;
    saveDay(day); render();
  },
  zeroDay: () => { const k = ui.date; saveDay({ id: k, date: k, cups: [], zero: true }); render(); },
  clearDay: () => { const k = ui.date; const n = dayTotal(db.days[k]); confirmSheet('Vider la journée ?', `Les ${pl(n, 'œuf')} du ${fmtLong(k)} seront retirés.`, 'Vider', () => { saveDay({ id: k, date: k, cups: [], zero: false }); closeSheet(); render(); }); },
  dayPrev: () => { ui.date = addDays(ui.date, -1); render(); },
  dayNext: () => { const n = addDays(ui.date, 1); if (n <= todayKey()) { ui.date = n; render(); } },
  pickDay: el => { ui.date = el.dataset.d; ui.tab = 'home'; if ($('#sheet-root').innerHTML) closeSheet(); render(); window.scrollTo({ top: 0 }); },
  calendar: () => { ui.calMonth = ui.date.slice(0, 7); sheetState = null; openSheet({ title: 'Choisir un jour', body: calendarHtml(), cancel: 'Fermer' }); },
  calPrev: () => { ui.calMonth = addMonthYm(ui.calMonth, -1); $('#cal').outerHTML = calendarHtml(); },
  calNext: () => { const n = addMonthYm(ui.calMonth, 1); if (n <= todayKey().slice(0, 7)) { ui.calMonth = n; $('#cal').outerHTML = calendarHtml(); } },
  eggsView: el => { ui.eggsView = el.dataset.v; render(); },
  journalMore: () => { ui.journalLimit += 40; render(); },
  out: el => openOut(el.dataset.k),
  sk: el => { sheetState.kind = el.dataset.v; sheetState.box = el.dataset.v === 'sale' || el.dataset.v === 'gift'; sheetState.person = ''; refreshSheet(); },
  sq: el => { sheetState.qty = Math.max(1, sheetState.qty + Number(el.dataset.d)); refreshSheet(); },
  su: el => { sheetState.box = el.dataset.v === 'box'; refreshSheet(); },
  sp: el => { sheetState.person = el.dataset.v; refreshSheet(); },
  inventory: openInventory,
  invq: el => { sheetState.n = Math.max(0, sheetState.n + Number(el.dataset.d)); refreshSheet(); },
  inva: el => { sheetState.age = el.dataset.v; refreshSheet(); },
  moveMenu: el => {
    const m = db.moves[el.dataset.id]; if (!m) return;
    confirmSheet(m.kind === 'inventory' ? 'Inventaire' : (OUT_KINDS[m.kind] || 'Mouvement'), `${cap(fmtLong(m.date))}${m.kind === 'inventory' ? ` · stock fixé à ${m.eggs}` : (m.eggs ? ` · ${pl(m.eggs, 'œuf')}` : '')}${m.amount ? ` · ${euro(m.amount)}` : ''}${m.person ? ` · ${esc(m.person)}` : ''}`, 'Supprimer ce mouvement', () => { del('moves', m.id); closeSheet(); render(); toast('Mouvement supprimé'); });
  },
  henFilter: el => { ui.henFilter = el.dataset.v; ui.henId = null; render(); },
  hen: el => { ui.henId = el.dataset.id; render(); if (!wide()) window.scrollTo({ top: 0 }); },
  henBack: () => { ui.henId = null; render(); },
  henNew: () => openHenForm(),
  henEdit: el => openHenForm(el.dataset.id),
  hc: el => { sheetState.color = el.dataset.v; refreshSheet(); },
  hs: el => { sheetState.status = el.dataset.v; refreshSheet(); },
  henPhotoDel: () => { sheetState.photo = ''; refreshSheet(); },
  henStatus: el => { const h = db.hens[el.dataset.id]; if (!h) return; put('hens', { ...h, status: h.status === 'rest' ? 'active' : 'rest' }); render(); toast(h.status === 'rest' ? `${h.name} est de nouveau active` : `${h.name} est au repos`); },
  henDead: el => openDeath(el.dataset.id),
  henRestore: el => { const h = db.hens[el.dataset.id]; if (!h) return; put('hens', { ...h, status: 'active', deathDate: '', deathNote: '' }); ui.henFilter = 'active'; render(); toast(`${h.name} est de retour au poulailler`); },
  henDelete: el => { const h = db.hens[el.dataset.id]; if (!h) return; confirmSheet(`Supprimer ${h.name} ?`, 'La fiche et sa photo seront supprimées définitivement. Les récoltes restent comptées.', 'Supprimer', () => { del('hens', h.id); ui.henId = null; closeSheet(); render(); toast('Fiche supprimée'); }); },
  careNew: el => openCareForm(el.dataset.hen || ''),
  ct: el => { sheetState.type = el.dataset.v; refreshSheet(); },
  cs: el => { sheetState.scope = el.dataset.v; refreshSheet(); },
  ch: el => { const id = el.dataset.v; const set = sheetState.henIds; sheetState.henIds = set.includes(id) ? set.filter(x => x !== id) : [...set, id]; refreshSheet(); },
  careMenu: el => {
    const c = db.care[el.dataset.id]; if (!c) return;
    const isOpen = c.kind === 'track' && !c.endDate;
    sheetState = null;
    openSheet({ title: c.type, cancel: 'Fermer', body: `<p class="lead">${cap(fmtLong(c.date))}${c.endDate ? ` → ${fmtLong(c.endDate)}` : ''} · ${esc(careTarget(c))}${c.note ? `<br>${esc(c.note)}` : ''}</p>${isOpen ? `<button class="primary" data-a="trackEnd" data-id="${esc(c.id)}">Terminer le suivi</button>` : ''}<button class="danger-btn" data-a="careDelete" data-id="${esc(c.id)}">Supprimer</button>` });
  },
  careDelete: el => { const c = db.care[el.dataset.id]; if (c?.taskId && db.tasks[c.taskId]?.careId === c.id) put('tasks', { ...db.tasks[c.taskId], careId: null }); del('care', el.dataset.id); closeSheet(); render(); toast('Soin supprimé'); },
  trackEnd: el => { const c = db.care[el.dataset.id]; if (!c) return; put('care', { ...c, endDate: todayKey() }); if ($('#sheet-root').innerHTML) closeSheet(); render(); toast('Suivi terminé'); },
  task: el => toggleTask(el.dataset.id),
  vtask: el => { const ids = loadVdone(); const id = el.dataset.id; const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]; localStorage.setItem(VDONE_KEY, JSON.stringify({ date: todayKey(), ids: next })); render(); },
  taskEdit: el => openTaskForm(el.dataset.id),
  taskNew: () => openTaskForm(),
  te: el => { sheetState.every = Math.max(1, Math.min(99, sheetState.every + Number(el.dataset.d))); refreshSheet(); },
  tu: el => { sheetState.unit = el.dataset.v; refreshSheet(); },
  tc: el => { sheetState.cat = el.dataset.v; refreshSheet(); },
  tm: el => { sheetState.season = el.dataset.v; refreshSheet(); },
  taskDelete: () => { const id = sheetState?.id; const t = db.tasks[id]; if (!t) return; confirmSheet(`Supprimer « ${t.name} » ?`, 'La routine disparaîtra de l’onglet Soins. L’historique des soins est conservé.', 'Supprimer', () => { del('tasks', id); closeSheet(); render(); toast('Routine supprimée'); }); },
  mPrev: () => { ui.month = addMonthYm(ui.month, -1); render(); },
  mNext: () => { const n = addMonthYm(ui.month, 1); if (n <= todayKey().slice(0, 7)) { ui.month = n; render(); } },
  mPick: el => { ui.month = el.dataset.m; render(); },
  expNew: openExpense,
  ec: el => { sheetState.cat = el.dataset.v; refreshSheet(); },
  expMenu: el => { const x = db.expenses[el.dataset.id]; if (!x) return; confirmSheet('Dépense', `${cap(fmtLong(x.date))} · ${euro(x.amount)}${x.note ? ` · ${esc(x.note)}` : ''}`, 'Supprimer cette dépense', () => { del('expenses', x.id); closeSheet(); render(); toast('Dépense supprimée'); }); },
  colorToggle: el => {
    const c = el.dataset.v; let list = [...settings.colors];
    if (list.includes(c)) { if (list.length === 1) return toast('Garde au moins une couleur'); list = list.filter(x => x !== c); } else list.push(c);
    settings.colors = list; saveSettings(); refreshSheet();
  },
  google: googleAuth,
  emailAuth: openEmailAuth,
  authToggle: () => { sheetState.signup = !sheetState.signup; sheetState.error = ''; refreshSheet(); },
  signOut: () => confirmSheet('Se déconnecter ?', 'Tes données restent dans ton compte et seront retirées de cet appareil.', 'Se déconnecter', async () => {
    closeSheet(); unsubscribeAll(); const id = user?.uid;
    try { await fb.A.signOut(fb.auth); } catch { /* déjà déconnecté */ }
    if (id) localStorage.removeItem(SYNCED_KEY + id);
    user = null; mode = 'local'; resetLocal(); render(); toast('Tu es déconnecté');
  }),
  export: exportData,
  forceUpdate,
  wipe: () => {
    sheetState = { confirm: '', render: () => `<p class="lead">Poules, photos, récoltes, stock, soins et dépenses seront effacés${user ? ' de cet appareil et de ton compte' : ' de cet appareil'}. Pense à exporter tes données avant.</p>${field('Pour confirmer, tape SUPPRIMER', `<input data-f="confirm" value="${esc(sheetState.confirm)}" autocapitalize="characters" autocomplete="off" spellcheck="false">`)}<button class="danger-btn" data-a="sheetAction">Supprimer définitivement</button>` };
    openSheet({ title: 'Tout supprimer ?', body: sheetState.render(), onAction: () => { if (sheetState.confirm.trim().toUpperCase() !== 'SUPPRIMER') return toast('Tape SUPPRIMER pour confirmer'); wipeAll(); } });
  }
};

// ---------- Événements ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset?.f && sheetState) sheetState[el.dataset.f] = el.value;
  if (el.id === 'hen-search') { ui.search = el.value; const list = $('#hen-list'); if (list) list.innerHTML = henListHtml(); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'hen-photo') { readPhoto(el.files?.[0]); el.value = ''; }
  if (el.id === 'import-file') { importFile(el.files?.[0]); el.value = ''; }
  if (el.dataset?.f === 'breed' && sheetState) { sheetState.breed = el.value; if (BREED_COLOR[el.value]) sheetState.color = fitColor(BREED_COLOR[el.value]); refreshSheet(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#sheet-root').innerHTML) closeSheet(); });
mq.addEventListener?.('change', render);

// ---------- Météo ----------
function loadWeather() {
  try { const c = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null'); if (c && Date.now() - c.at < 6 * 3600000) weather = c; } catch { /* cache vide */ }
  if (!navigator.geolocation) { weatherMsg = 'Localisation indisponible'; return; }
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const { latitude, longitude } = pos.coords;
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}&current=temperature_2m,weather_code&daily=temperature_2m_min,temperature_2m_max&forecast_days=2&timezone=auto`);
      if (!r.ok) throw new Error('météo');
      const d = await r.json(); const hour = new Date().getHours();
      weather = { temp: d.current.temperature_2m, code: d.current.weather_code, min: hour >= 14 ? d.daily.temperature_2m_min[1] : d.daily.temperature_2m_min[0], max: d.daily.temperature_2m_max[0], at: Date.now() };
      localStorage.setItem(WEATHER_KEY, JSON.stringify(weather));
    } catch { if (!weather) weatherMsg = 'Météo indisponible'; }
    scheduleRender();
  }, () => { if (!weather) { weatherMsg = 'Autorise la localisation'; scheduleRender(); } }, { enableHighAccuracy: false, maximumAge: 1800000, timeout: 8000 });
}

// ---------- Divers ----------
let toastTimer = null;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
let lastToday = todayKey();
function checkRollover() {
  const t = todayKey();
  if (t !== lastToday) { if (ui.date === lastToday) ui.date = t; lastToday = t; render(); }
}
setInterval(checkRollover, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkRollover(); if (!weather || Date.now() - weather.at > 1800000) loadWeather(); } });

function init() {
  const had = loadLocal();
  if (!had && localStorage.getItem(LEGACY_KEY)) migrateLegacyLocal();
  if (!settings.seeded) seedTasks();
  saveLocalNow();
  render();
  if (pendingToast) { toast(pendingToast); pendingToast = ''; }
  loadWeather();
  loadFirebase();
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
init();
