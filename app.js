import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const $ = (selector) => document.querySelector(selector);
const demoEggs = [5, 7, 6, 8, 9, 7, 8];
const hens = [
  { name: 'Marguerite', breed: 'Sussex', emoji: '🐔', color: 'blanc cassé' },
  { name: 'Caramelle', breed: 'Rousse', emoji: '🐓', color: 'roux doré' },
  { name: 'Pistache', breed: 'Araucana', emoji: '🐣', color: 'vert tendre' },
  { name: 'Colette', breed: 'Harco', emoji: '🐔', color: 'noir et cuivre' },
  { name: 'Suzette', breed: 'Marans', emoji: '🐓', color: 'brun chocolat' },
  { name: 'Praline', breed: 'Coucou', emoji: '🐣', color: 'gris perle' }
];
let savedState = {}; try { savedState = JSON.parse(localStorage.getItem('poupoules-state') || '{}'); } catch {}
let eggsByDay = savedState.eggsByDay?.length ? savedState.eggsByDay : [...demoEggs];
let activities = savedState.activities?.length ? savedState.activities : [
  { icon: '🥚', title: 'Récolte enregistrée', text: '8 œufs ajoutés au journal', time: 'Il y a 2 h' },
  { icon: '💧', title: 'Abreuvoir rempli', text: 'Routine du matin terminée', time: 'Aujourd’hui' },
  { icon: '🐔', title: 'Pistache a pondu', text: 'Œuf bleu-vert identifié', time: 'Hier, 18:42' }
];
let firestore = null;

function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }
function persistState() { localStorage.setItem('poupoules-state', JSON.stringify({ eggsByDay, activities })); }
function openEggDialog() { $('#egg-count').value = 1; $('#egg-note').value = ''; $('#egg-dialog').showModal(); }
function renderHens() { $('#hens-grid').innerHTML = hens.slice(0, 6).map(h => `<article class="hen-card"><div class="hen-avatar">${h.emoji}</div><div><strong>${h.name}</strong><span>${h.breed} · active</span></div></article>`).join(''); $('#active-hens').textContent = hens.length; $('#total-hens').textContent = hens.length; }
function renderActivities() { $('#activity-list').innerHTML = activities.map(a => `<div class="activity-item"><div class="activity-icon">${a.icon}</div><div><strong>${a.title}</strong><span>${a.text}</span></div><span class="activity-time">${a.time}</span></div>`).join(''); }
function renderChart() { const values = eggsByDay.slice(-Number($('#period-select').value)); const max = 10; const width = 600; const xStep = width / Math.max(values.length - 1, 1); const points = values.map((value, index) => [index * xStep, 170 - (value / max) * 145]); const line = points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '); $('#chart-line').setAttribute('d', line); $('#chart-area').setAttribute('d', `${line} L${points.at(-1)[0]} 175 L0 175 Z`); $('#chart-dots').innerHTML = points.map(([x,y]) => `<circle class="chart-dot" cx="${x}" cy="${y}" r="5"/>`).join(''); const days = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']; $('#chart-days').innerHTML = values.map((_, i) => `<span>${days[(i + 1) % 7]}</span>`).join(''); $('#avg-eggs').innerHTML = `${(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1).replace('.', ',')} <small>œufs</small>`; $('#today-eggs').textContent = eggsByDay.at(-1); }
async function initFirebase() { try { const app = initializeApp(firebaseConfig); firestore = getFirestore(app); const q = query(collection(firestore, 'egg_entries'), orderBy('createdAt', 'desc'), limit(30)); onSnapshot(q, (snapshot) => { if (!snapshot.empty) { const synced = snapshot.docs.map(d => d.data().count || 0); eggsByDay = [...demoEggs.slice(0, 7 - Math.min(synced.length, 7)), ...synced].slice(-14); renderChart(); } $('#sync-status').innerHTML = '<i></i> Synchronisé'; }, () => { $('#sync-status').innerHTML = '<i></i> Mode démo'; }); } catch (error) { console.info('Firebase non disponible, mode démo activé.', error); } }
async function saveEggs(count, note) { eggsByDay.push(count); eggsByDay = eggsByDay.slice(-14); activities.unshift({ icon: '🥚', title: 'Récolte enregistrée', text: `${count} œuf${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} au journal${note ? ` · ${note}` : ''}`, time: 'À l’instant' }); renderChart(); renderActivities(); persistState(); if (firestore) { try { await addDoc(collection(firestore, 'egg_entries'), { count, note, createdAt: Date.now() }); $('#sync-status').innerHTML = '<i></i> Synchronisé'; } catch { showToast('Récolte sauvegardée en local pour le moment'); } } showToast(`${count} œuf${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} au journal`); }
function exportData() { const blob = new Blob([JSON.stringify({ hens, eggsByDay, activities }, null, 2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'poupoules-export.json'; link.click(); URL.revokeObjectURL(url); showToast('Export téléchargé'); }
$('#period-select').addEventListener('change', renderChart); $('#add-egg').addEventListener('click', openEggDialog); $('#settings-button').addEventListener('click', () => $('#settings-dialog').showModal()); $('#add-hen').addEventListener('click', () => showToast('Bientôt : fiche complète pour votre nouvelle poule')); $('#save-eggs').addEventListener('click', (event) => { event.preventDefault(); const count = Math.max(0, Number($('#egg-count').value) || 0); const note = $('#egg-note').value.trim(); if (!count) return showToast('Indiquez au moins un œuf'); $('#egg-dialog').close(); saveEggs(count, note); }); $('#export-data').addEventListener('click', (event) => { event.preventDefault(); $('#settings-dialog').close(); exportData(); }); $('#see-all').addEventListener('click', () => showToast('Le journal détaillé arrive dans la prochaine version')); document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); if (tab.id === 'stats-tab') showToast('Les statistiques avancées arrivent bientôt'); if (tab.id === 'journal-tab') showToast('Journal complet : bientôt disponible'); if (tab.id === 'flock-tab') $('#flock-tab').scrollIntoView({behavior:'smooth'}); }));

renderHens(); renderActivities(); renderChart(); initFirebase();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
