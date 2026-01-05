// --- CONFIGURATION FIREBASE POUPOULES ---
const firebaseConfig = {
    apiKey: "AIzaSyDpVKRam-7sldEss93zRTh8At3pEtJ0SqA",
    authDomain: "poulettes-75fb5.firebaseapp.com",
    projectId: "poulettes-75fb5",
    storageBucket: "poulettes-75fb5.firebasestorage.app",
    messagingSenderId: "479553710488",
    appId: "1:479553710488:web:8cb5ec0285f330c51e23ed"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DATA ---
const DEMO_DATA = {
    chickens: [
        { id: 'c1', name: 'Huguette', breed: 'Rousse', date: '2023-05-10', price: 15, status: 'active', photo: 'icon.png' },
        { id: 'c2', name: 'Gertrude', breed: 'Sussex', date: '2022-08-15', price: 18, status: 'active', photo: 'icon.png' }
    ],
    eggs: [
        { id: 'egg1', chickenId: 'c1', chickenName: 'Huguette', date: new Date().toISOString() },
        { id: 'egg2', chickenId: 'c2', chickenName: 'Gertrude', date: new Date().toISOString() }
    ],
    expenses: [
        { id: 'e1', type: 'graines', amount: 25.50, date: new Date().toISOString() }
    ]
};

// --- STATE ---
let currentUser = null;
let isDemoMode = true;
let localChickens = [...DEMO_DATA.chickens];
let localEggs = [...DEMO_DATA.eggs];
let localExpenses = [...DEMO_DATA.expenses];
let currentChickenId = null;
let currentFilter = 'active'; 
let currentStatsPeriod = 'month';
let eggsChartInstance = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initEggsChart();
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            isDemoMode = false;
            updateAuthUI(true);
            loadFirebaseData();
            document.getElementById('header-status').classList.replace('demo', 'connected');
            document.getElementById('header-status').innerText = 'Connecté';
        } else {
            currentUser = null;
            isDemoMode = true;
            updateAuthUI(false);
            renderAll();
        }
    });
    document.querySelectorAll('.close-modal').forEach(x => x.addEventListener('click', () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none')));
});

// --- NAVIGATION ---
window.toggleMenu = () => { document.getElementById('menu-overlay').classList.toggle('open'); };
window.navigate = (targetId) => {
    toggleMenu();
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    document.getElementById(targetId).classList.add('active-view');
    document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
    const clickedLink = Array.from(document.querySelectorAll('.menu-link')).find(l => l.getAttribute('onclick').includes(targetId));
    if(clickedLink) clickedLink.classList.add('active');
    document.getElementById('scroll-container').scrollTop = 0;
};

// --- RENDER ---
function renderAll() {
    renderChickensList();
    renderDashboard();
    renderFinance();
}

function renderChickensList() {
    const grid = document.getElementById('chickens-grid');
    grid.innerHTML = '';
    const list = localChickens.filter(c => (c.status || 'active') === currentFilter);
    if (list.length === 0) { grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#999; margin-top:30px;">Vide 🐣</p>'; return; }
    list.forEach(chk => {
        const img = chk.photo || 'icon.png';
        const card = document.createElement('div');
        card.className = `chicken-card ${chk.status === 'archived' ? 'grayscale-card' : ''}`;
        card.onclick = (e) => { if (!e.target.closest('.egg-btn')) openChickenDetails(chk.id); };
        card.innerHTML = `<img src="${img}" class="chicken-img"><h3 style="margin:5px 0;">${chk.name}</h3><small style="color:#888">${chk.breed}</small>${chk.status === 'active' ? `<button class="egg-btn" onclick="handleAddEgg('${chk.id}', '${chk.name}')">🥚 A pondu !</button>` : `<small style="display:block;margin-top:10px">Archivée</small>`}`;
        grid.appendChild(card);
    });
}
function filterChickens(status, btn) { currentFilter = status; document.querySelectorAll('#view-chickens .segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderChickensList(); }
function switchStatsPeriod(period, btn) { currentStatsPeriod = period; document.querySelectorAll('#view-dashboard .segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderDashboard(); }

function renderDashboard() {
    const now = new Date(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
    let filteredEggs = [], filteredExpenses = [];
    if (currentStatsPeriod === 'month') {
        filteredEggs = localEggs.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
        filteredExpenses = localExpenses.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
        document.getElementById('label-eggs-display').innerText = "Œufs (Mois)"; document.getElementById('chart-title').innerHTML = '<i class="fas fa-chart-bar"></i> Jours du mois';
    } else {
        filteredEggs = localEggs.filter(e => new Date(e.date).getFullYear() === currentYear);
        filteredExpenses = localExpenses.filter(e => new Date(e.date).getFullYear() === currentYear);
        document.getElementById('label-eggs-display').innerText = "Œufs (Année)"; document.getElementById('chart-title').innerHTML = '<i class="fas fa-chart-bar"></i> Mois de l\'année';
    }
    
    // Stats
    document.getElementById('total-eggs-display').innerText = filteredEggs.length;
    const totalSpent = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    document.getElementById('total-spent-display').innerText = totalSpent.toFixed(2) + ' €';
    
    // Chart
    updateEggsChart(filteredEggs);
    
    // Recent Activity (AVEC BOUTON SUPPRIMER)
    const list = document.getElementById('recent-activity-list'); 
    list.innerHTML = '';
    
    // On trie par date décroissante et on prend les 10 derniers
    const recentEggs = [...localEggs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    
    recentEggs.forEach(egg => {
        const li = document.createElement('li'); 
        const d = new Date(egg.date);
        const dateStr = `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${d.getMinutes()<10?'0':''}${d.getMinutes()}`;
        
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span>🥚</span>
                <span style="font-weight:500;">${egg.chickenName}</span>
            </div>
            <div style="display:flex; align-items:center;">
                <span style="font-size:12px; color:#999; margin-right:5px;">${dateStr}</span>
                <button class="delete-icon-btn" onclick="deleteEgg('${egg.id}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        list.appendChild(li);
    });
}

function updateEggsChart(eggsData) {
    let labels = [], data = [];
    if (currentStatsPeriod === 'month') { labels = Array.from({length: 31}, (_, i) => i + 1); data = new Array(31).fill(0); eggsData.forEach(e => { data[new Date(e.date).getDate() - 1]++; }); } 
    else { labels = ['J','F','M','A','M','J','J','A','S','O','N','D']; data = new Array(12).fill(0); eggsData.forEach(e => { data[new Date(e.date).getMonth()]++; }); }
    eggsChartInstance.data.labels = labels; eggsChartInstance.data.datasets[0].data = data; eggsChartInstance.update();
}

function renderFinance() {
    const list = document.getElementById('expenses-list');
    list.innerHTML = '';
    localExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    localExpenses.forEach(exp => {
        const li = document.createElement('li');
        li.className = 'expenses-list-item';
        li.onclick = () => openExpenseModal(exp.id);
        const icon = exp.type === 'graines' ? '🌾' : (exp.type === 'paille' ? '🛏️' : '💊');
        li.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; gap:8px"><span style="font-size:18px">${icon}</span><span style="text-transform:capitalize; font-weight:500;">${exp.type}</span></div>
                <small style="color:#999; margin-left:26px;">${new Date(exp.date).toLocaleDateString()}</small>
            </div>
            <span style="font-weight:600; color:#ff3b30">-${exp.amount}€</span>
        `;
        list.appendChild(li);
    });

    let map = { graines: 0, paille: 0, soins: 0, materiel: 0, autre: 0 }; let total = 0;
    localExpenses.forEach(e => { const t = map[e.type] !== undefined ? e.type : 'autre'; map[t] += e.amount; total += e.amount; });
    const progressBar = document.getElementById('finance-progress-bar'); progressBar.innerHTML = '';
    if (total === 0) { progressBar.innerHTML = '<div class="progress-segment" style="width:100%; background-color:#e5e5e5;"></div>'; } 
    else { for (const [type, amount] of Object.entries(map)) { if (amount > 0) { const percentage = (amount / total) * 100; progressBar.innerHTML += `<div class="progress-segment bg-${type}" style="width:${percentage}%"></div>`; } } }
    const legend = document.getElementById('finance-legend'); legend.innerHTML = ''; const labels = { graines: 'Graines', paille: 'Paille', soins: 'Soins', materiel: 'Matériel', autre: 'Autre' };
    for (const [type, amount] of Object.entries(map)) { if (amount > 0 || total === 0) { legend.innerHTML += `<div class="legend-item"><div class="legend-color bg-${type}"></div><span>${labels[type]} (${total > 0 ? Math.round((amount/total)*100) : 0}%)</span></div>`; } }
}

// --- AJOUT OEUF ET SUPPRESSION (UPDATED v13) ---
window.handleAddEgg = (id, name) => {
    // Génération d'un ID unique obligatoire pour pouvoir le supprimer ensuite
    const newEgg = { 
        id: 'egg_' + Date.now() + Math.random().toString(36).substr(2, 9),
        chickenId: id, 
        chickenName: name, 
        date: new Date().toISOString() 
    };
    
    if (isDemoMode) { 
        localEggs.push(newEgg); 
        renderDashboard(); 
        alert(`Top ${name} ! (Ajouté en mode démo)`); 
    } else { 
        db.collection('users').doc(currentUser.uid).collection('eggs').add(newEgg)
        .then(() => alert(`Top ${name} !`));
    }
};

// NOUVELLE FONCTION DE SUPPRESSION
window.deleteEgg = (eggId) => {
    if(!eggId) return; // Sécurité pour les vieux œufs sans ID
    
    if(confirm("Oups ? Supprimer cet œuf de l'historique ?")) {
        if(isDemoMode) {
            localEggs = localEggs.filter(e => e.id !== eggId);
            renderDashboard();
        } else {
            // Recherche de l'œuf dans la base pour le supprimer (si on a l'ID du doc)
            // Note: Dans loadFirebaseData, on mappe l'id du doc Firestore sur .id
            db.collection('users').doc(currentUser.uid).collection('eggs').doc(eggId).delete();
        }
    }
};

// --- MODALS EXPENSE ---
window.openExpenseModal = (expenseId = null) => {
    const modal = document.getElementById('modal-expense');
    const deleteBtn = document.getElementById('btn-delete-expense');
    if (expenseId) {
        const exp = localExpenses.find(e => e.id === expenseId); if (!exp) return;
        document.getElementById('modal-expense-title').innerText = "Modifier Dépense";
        document.getElementById('exp-id').value = exp.id; document.getElementById('exp-date').value = exp.date.split('T')[0];
        document.getElementById('exp-type').value = exp.type; document.getElementById('exp-amount').value = exp.amount;
        deleteBtn.style.display = 'flex';
    } else {
        document.getElementById('form-expense').reset(); document.getElementById('modal-expense-title').innerText = "Nouvelle Dépense";
        document.getElementById('exp-id').value = ''; document.getElementById('exp-date').valueAsDate = new Date();
        deleteBtn.style.display = 'none';
    }
    modal.style.display = 'flex';
};
window.showAddExpenseModal = () => openExpenseModal(null);

document.getElementById('form-expense').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('exp-id').value;
    const data = { type: document.getElementById('exp-type').value, amount: parseFloat(document.getElementById('exp-amount').value), date: new Date(document.getElementById('exp-date').value).toISOString() };
    if (isDemoMode) {
        if (id) { const idx = localExpenses.findIndex(e => e.id === id); if (idx !== -1) localExpenses[idx] = { id, ...data }; }
        else { localExpenses.push({ id: 'e' + Date.now(), ...data }); }
        renderAll();
    } else {
        if (id) { db.collection('users').doc(currentUser.uid).collection('expenses').doc(id).update(data); }
        else { db.collection('users').doc(currentUser.uid).collection('expenses').add(data); }
    }
    document.getElementById('modal-expense').style.display = 'none';
});

window.deleteCurrentExpense = () => {
    const id = document.getElementById('exp-id').value; if (!id) return;
    if (confirm("Supprimer cette dépense ?")) {
        if (isDemoMode) { localExpenses = localExpenses.filter(e => e.id !== id); renderAll(); }
        else { db.collection('users').doc(currentUser.uid).collection('expenses').doc(id).delete(); }
        document.getElementById('modal-expense').style.display = 'none';
    }
};

// --- GESTION POULES AVEC COMPRESSION IMAGE ---
function compressImage(file, callback) {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image(); img.src = event.target.result;
        img.onload = () => {
            const canvas = document.getElementById('compression-canvas'); const ctx = canvas.getContext('2d');
            const maxWidth = 800; const scaleSize = maxWidth / img.width;
            canvas.width = maxWidth; canvas.height = img.height * scaleSize;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    };
}
document.getElementById('chk-photo-file').addEventListener('change', (e) => {
    if (e.target.files[0]) { compressImage(e.target.files[0], (compressedSrc) => { document.getElementById('preview-photo').src = compressedSrc; }); }
});

window.openChickenModal = (isEdit = false) => {
    const modal = document.getElementById('modal-chicken');
    const deleteBtn = document.getElementById('btn-delete-chicken');
    document.getElementById('form-chicken').reset();
    if (!isEdit) {
        document.getElementById('modal-chicken-title').innerText = "Nouvelle Poule";
        document.getElementById('chk-id').value = ''; document.getElementById('preview-photo').src = 'icon.png';
        deleteBtn.style.display = 'none';
    } else if (isEdit && currentChickenId) {
        const chk = localChickens.find(c => c.id === currentChickenId);
        document.getElementById('modal-chicken-title').innerText = "Modifier";
        document.getElementById('chk-id').value = chk.id; document.getElementById('chk-name').value = chk.name; 
        document.getElementById('chk-breed').value = chk.breed; document.getElementById('chk-date').value = chk.date || ''; 
        document.getElementById('chk-price').value = chk.price || ''; document.getElementById('preview-photo').src = chk.photo || 'icon.png';
        deleteBtn.style.display = 'flex';
    }
    modal.style.display = 'flex';
};
window.editCurrentChicken = () => openChickenModal(true);

document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('chk-id').value;
    const data = { name: document.getElementById('chk-name').value, breed: document.getElementById('chk-breed').value, date: document.getElementById('chk-date').value, price: parseFloat(document.getElementById('chk-price').value), photo: document.getElementById('preview-photo').src, status: 'active' };
    if (isDemoMode) {
        if(id) { const idx = localChickens.findIndex(c => c.id === id); localChickens[idx] = { ...localChickens[idx], ...data }; if(currentChickenId === id) openChickenDetails(id); }
        else { localChickens.push({ id: 'demo'+Date.now(), ...data }); filterChickens('active', document.getElementById('btn-filter-active')); }
        renderChickensList();
    } else {
        if(id) { db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).update(data); if(currentChickenId === id) openChickenDetails(id); }
        else { db.collection('users').doc(currentUser.uid).collection('chickens').add(data); filterChickens('active', document.getElementById('btn-filter-active')); }
    }
    document.getElementById('modal-chicken').style.display = 'none';
});

window.deleteCurrentChicken = () => {
    const id = document.getElementById('chk-id').value; if (!id) return;
    if (confirm("Voulez-vous vraiment supprimer cette poule ?")) {
        if (isDemoMode) { localChickens = localChickens.filter(c => c.id !== id); closeChickenDetails(); renderChickensList(); }
        else { db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).delete().then(() => closeChickenDetails()); }
        document.getElementById('modal-chicken').style.display = 'none';
    }
};

window.openChickenDetails = (id) => {
    currentChickenId = id; const chk = localChickens.find(c => c.id === id); if(!chk) return;
    document.getElementById('detail-name').innerText = chk.name; document.getElementById('detail-breed').innerText = chk.breed;
    document.getElementById('detail-price').innerText = (chk.price || 0) + ' €'; document.getElementById('detail-date').innerText = new Date(chk.date).toLocaleDateString();
    document.getElementById('detail-age').innerText = calculateAge(chk.date); document.getElementById('detail-photo').src = chk.photo;
    document.getElementById('detail-total-eggs').innerText = localEggs.filter(e => e.chickenId === id).length;
    const archiveBtn = document.getElementById('btn-archive');
    if(chk.status === 'archived') { archiveBtn.innerText = 'Désarchiver'; archiveBtn.className = 'glass-btn primary-btn'; archiveBtn.onclick = () => toggleArchiveStatus(id, 'active'); document.getElementById('detail-status').innerText='Archivée';}
    else { archiveBtn.innerText = 'Archiver'; archiveBtn.className = 'glass-btn danger-btn'; archiveBtn.onclick = () => toggleArchiveStatus(id, 'archived'); document.getElementById('detail-status').innerText='Active';}
    document.getElementById('view-chickens').classList.remove('active-view'); document.getElementById('view-chicken-detail').classList.add('active-view'); 
};
window.closeChickenDetails = () => { document.getElementById('view-chicken-detail').classList.remove('active-view'); document.getElementById('view-chickens').classList.add('active-view'); };
window.archiveCurrentChicken = () => toggleArchiveStatus(currentChickenId, 'archived');
function toggleArchiveStatus(id, status) {
    if(isDemoMode) { const chk = localChickens.find(c => c.id === id); if(chk) chk.status = status; closeChickenDetails(); renderChickensList(); }
    else { db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).update({status}); closeChickenDetails(); }
}
function calculateAge(d) { if(!d) return '?'; const m = (new Date().getFullYear()-new Date(d).getFullYear())*12 - new Date(d).getMonth() + new Date().getMonth(); return m<12 ? m+" mois" : Math.floor(m/12)+" ans"; }
function updateAuthUI(isLoggedIn) {
    document.getElementById('auth-logged-out').style.display = isLoggedIn ? 'none' : 'block';
    document.getElementById('auth-logged-in').style.display = isLoggedIn ? 'flex' : 'none';
    if(isLoggedIn) {
        document.getElementById('user-name').innerText = currentUser.displayName;
        document.getElementById('user-email').innerText = currentUser.email;
        document.getElementById('user-photo').src = currentUser.photoURL;
    }
}
document.getElementById('google-login-btn').addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

// DATA LOAD (CORRIGÉ POUR INCLURE LES IDs)
function loadFirebaseData() { 
    const r = db.collection('users').doc(currentUser.uid); 
    r.collection('chickens').onSnapshot(s => { localChickens = s.docs.map(d=>({id:d.id, ...d.data()})); renderAll(); }); 
    r.collection('eggs').orderBy('date').onSnapshot(s => { 
        // IMPORTANT: On inclut l'ID du doc (d.id) pour pouvoir le supprimer
        localEggs = s.docs.map(d => ({ id: d.id, ...d.data() })); 
        renderAll(); 
    }); 
    r.collection('expenses').orderBy('date').onSnapshot(s => { localExpenses = s.docs.map(d=>({id:d.id, ...d.data()})); renderAll(); }); 
}
function initEggsChart() {
    eggsChartInstance = new Chart(document.getElementById('eggsChart').getContext('2d'), { type: 'bar', data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#0071e3', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: {legend:{display:false}}, scales:{y:{beginAtZero:true, display:false}, x:{grid:{display:false}}} } });
}
