// FIREBASE CONFIG (A REMPLIR)
const firebaseConfig = {
    apiKey: "API_KEY",
    authDomain: "PROJECT_ID.firebaseapp.com",
    projectId: "PROJECT_ID",
    storageBucket: "PROJECT_ID.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DATA AVEC IDS UNIQUES
const DEMO_DATA = {
    chickens: [
        { id: 'c1', name: 'Huguette', breed: 'Rousse', date: '2023-05-10', price: 15, status: 'active', photo: 'https://cdn-icons-png.flaticon.com/512/1826/1826224.png' },
        { id: 'c2', name: 'Gertrude', breed: 'Sussex', date: '2022-08-15', price: 18, status: 'active', photo: 'https://cdn-icons-png.flaticon.com/512/2829/2829821.png' }
    ],
    eggs: [
        { chickenId: 'c1', chickenName: 'Huguette', date: new Date().toISOString() },
        { chickenId: 'c2', chickenName: 'Gertrude', date: new Date().toISOString() }
    ],
    expenses: [
        { id: 'e1', type: 'graines', amount: 25.50, date: new Date().toISOString() },
        { id: 'e2', type: 'paille', amount: 12.00, date: new Date().toISOString() },
        { id: 'e3', type: 'soins', amount: 8.50, date: new Date().toISOString() }
    ]
};

// STATE
let currentUser = null;
let isDemoMode = true;
let localChickens = [...DEMO_DATA.chickens];
let localEggs = [...DEMO_DATA.eggs];
let localExpenses = [...DEMO_DATA.expenses];
let currentChickenId = null;
let currentFilter = 'active'; 
let currentStatsPeriod = 'month';
let eggsChartInstance = null;

// INIT
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

// NAVIGATION
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

// RENDER
function renderAll() {
    renderChickensList();
    renderDashboard();
    renderFinance();
}

// ... (renderChickensList, filterChickens, switchStatsPeriod, renderDashboard, updateEggsChart restent identiques à V8) ...
function renderChickensList() {
    const grid = document.getElementById('chickens-grid');
    grid.innerHTML = '';
    const list = localChickens.filter(c => (c.status || 'active') === currentFilter);
    if (list.length === 0) { grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#999; margin-top:30px;">Vide 🐣</p>'; return; }
    list.forEach(chk => {
        const img = chk.photo || 'https://cdn-icons-png.flaticon.com/512/1826/1826224.png';
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
    document.getElementById('total-eggs-display').innerText = filteredEggs.length;
    const totalSpent = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    document.getElementById('total-spent-display').innerText = totalSpent.toFixed(2) + ' €';
    updateEggsChart(filteredEggs);
    const list = document.getElementById('recent-activity-list'); list.innerHTML = '';
    localEggs.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5).forEach(egg => {
        const li = document.createElement('li'); const d = new Date(egg.date);
        li.innerHTML = `<span>🥚 ${egg.chickenName}</span><span>${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${d.getMinutes()<10?'0':''}${d.getMinutes()}</span>`;
        list.appendChild(li);
    });
}
function updateEggsChart(eggsData) {
    let labels = [], data = [];
    if (currentStatsPeriod === 'month') { labels = Array.from({length: 31}, (_, i) => i + 1); data = new Array(31).fill(0); eggsData.forEach(e => { data[new Date(e.date).getDate() - 1]++; }); } 
    else { labels = ['J','F','M','A','M','J','J','A','S','O','N','D']; data = new Array(12).fill(0); eggsData.forEach(e => { data[new Date(e.date).getMonth()]++; }); }
    eggsChartInstance.data.labels = labels; eggsChartInstance.data.datasets[0].data = data; eggsChartInstance.update();
}

// --- LOGIQUE FINANCE MISE A JOUR ---
function renderFinance() {
    const list = document.getElementById('expenses-list');
    list.innerHTML = '';
    localExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    localExpenses.forEach(exp => {
        const li = document.createElement('li');
        li.className = 'expenses-list-item'; // Ajout de la classe pour le curseur
        // Ajout du OnClick pour modifier
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

    // Bar Chart Logic (idem V8)
    let map = { graines: 0, paille: 0, soins: 0, materiel: 0, autre: 0 }; let total = 0;
    localExpenses.forEach(e => { const t = map[e.type] !== undefined ? e.type : 'autre'; map[t] += e.amount; total += e.amount; });
    const progressBar = document.getElementById('finance-progress-bar'); progressBar.innerHTML = '';
    if (total === 0) { progressBar.innerHTML = '<div class="progress-segment" style="width:100%; background-color:#e5e5e5;"></div>'; } 
    else { for (const [type, amount] of Object.entries(map)) { if (amount > 0) { const percentage = (amount / total) * 100; progressBar.innerHTML += `<div class="progress-segment bg-${type}" style="width:${percentage}%"></div>`; } } }
    const legend = document.getElementById('finance-legend'); legend.innerHTML = ''; const labels = { graines: 'Graines', paille: 'Paille', soins: 'Soins', materiel: 'Matériel', autre: 'Autre' };
    for (const [type, amount] of Object.entries(map)) { if (amount > 0 || total === 0) { legend.innerHTML += `<div class="legend-item"><div class="legend-color bg-${type}"></div><span>${labels[type]} (${total > 0 ? Math.round((amount/total)*100) : 0}%)</span></div>`; } }
}

// --- ACTIONS MODALS MISE A JOUR (ADD / EDIT / DELETE) ---
window.openExpenseModal = (expenseId = null) => {
    const modal = document.getElementById('modal-expense');
    const deleteBtn = document.getElementById('btn-delete-expense');
    
    if (expenseId) {
        // Mode Modification
        const exp = localExpenses.find(e => e.id === expenseId);
        if (!exp) return;
        document.getElementById('modal-expense-title').innerText = "Modifier Dépense";
        document.getElementById('exp-id').value = exp.id;
        document.getElementById('exp-date').value = exp.date.split('T')[0];
        document.getElementById('exp-type').value = exp.type;
        document.getElementById('exp-amount').value = exp.amount;
        deleteBtn.style.display = 'flex'; // Afficher bouton supprimer
    } else {
        // Mode Ajout
        document.getElementById('form-expense').reset();
        document.getElementById('modal-expense-title').innerText = "Nouvelle Dépense";
        document.getElementById('exp-id').value = '';
        document.getElementById('exp-date').valueAsDate = new Date();
        deleteBtn.style.display = 'none'; // Cacher bouton supprimer
    }
    modal.style.display = 'flex';
};

window.showAddExpenseModal = () => openExpenseModal(null);

// SAVE EXPENSE
document.getElementById('form-expense').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('exp-id').value;
    const data = {
        type: document.getElementById('exp-type').value,
        amount: parseFloat(document.getElementById('exp-amount').value),
        date: new Date(document.getElementById('exp-date').value).toISOString()
    };
    
    if (isDemoMode) {
        if (id) {
            // Update
            const idx = localExpenses.findIndex(e => e.id === id);
            if (idx !== -1) localExpenses[idx] = { id, ...data };
        } else {
            // Create
            localExpenses.push({ id: 'e' + Date.now(), ...data });
        }
        renderAll();
    } else {
        if (id) {
            db.collection('users').doc(currentUser.uid).collection('expenses').doc(id).update(data);
        } else {
            db.collection('users').doc(currentUser.uid).collection('expenses').add(data);
        }
    }
    document.getElementById('modal-expense').style.display = 'none';
});

// DELETE EXPENSE
window.deleteCurrentExpense = () => {
    const id = document.getElementById('exp-id').value;
    if (!id) return;
    
    if (confirm("Supprimer cette dépense ?")) {
        if (isDemoMode) {
            localExpenses = localExpenses.filter(e => e.id !== id);
            renderAll();
        } else {
            db.collection('users').doc(currentUser.uid).collection('expenses').doc(id).delete();
        }
        document.getElementById('modal-expense').style.display = 'none';
    }
};

// ... (Autres fonctions: handleAddEgg, openChickenModal, editCurrentChicken, etc. restent identiques à V8) ...
window.handleAddEgg = (id, name) => {
    const newEgg = { chickenId: id, chickenName: name, date: new Date().toISOString() };
    if (isDemoMode) { localEggs.push(newEgg); renderDashboard(); alert(`Top ${name} !`); }
    else { db.collection('users').doc(currentUser.uid).collection('eggs').add(newEgg); }
};
window.openChickenModal = (isEdit = false) => {
    const modal = document.getElementById('modal-chicken');
    if (isEdit && currentChickenId) {
        const chk = localChickens.find(c => c.id === currentChickenId);
        document.getElementById('modal-chicken-title').innerText = "Modifier";
        document.getElementById('chk-id').value = chk.id; document.getElementById('chk-name').value = chk.name; document.getElementById('chk-breed').value = chk.breed;
        document.getElementById('chk-date').value = chk.date || ''; document.getElementById('chk-price').value = chk.price || '';
        document.getElementById('preview-photo').src = chk.photo || '';
    } else {
        document.getElementById('form-chicken').reset(); document.getElementById('modal-chicken-title').innerText = "Nouvelle";
        document.getElementById('chk-id').value = ''; document.getElementById('preview-photo').src = 'https://cdn-icons-png.flaticon.com/512/1826/1826224.png';
    }
    modal.style.display = 'flex';
};
window.editCurrentChicken = () => openChickenModal(true);
document.getElementById('chk-photo-file').addEventListener('change', (e) => {
    if (e.target.files[0]) { const reader = new FileReader(); reader.onload = (e) => document.getElementById('preview-photo').src = e.target.result; reader.readAsDataURL(e.target.files[0]); }
});
document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('chk-id').value;
    const data = { name: document.getElementById('chk-name').value, breed: document.getElementById('chk-breed').value, date: document.getElementById('chk-date').value, price: parseFloat(document.getElementById('chk-price').value), photo: document.getElementById('preview-photo').src, status: 'active' };
    if (isDemoMode) {
        if(id) { const idx = localChickens.findIndex(c => c.id === id); localChickens[idx] = { ...localChickens[idx], ...data }; if(currentChickenId === id) openChickenDetails(id); }
        else { localChickens.push({ id: 'demo'+Date.now(), ...data }); }
        renderChickensList();
    } else {
        if(id) { db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).update(data); if(currentChickenId === id) openChickenDetails(id); }
        else { db.collection('users').doc(currentUser.uid).collection('chickens').add(data); }
    }
    document.getElementById('modal-chicken').style.display = 'none';
});
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
function updateAuthUI(isLoggedIn) { document.getElementById('auth-logged-out').style.display = isLoggedIn ? 'none' : 'block'; document.getElementById('auth-logged-in').style.display = isLoggedIn ? 'flex' : 'none'; if(isLoggedIn) { document.getElementById('user-name').innerText = currentUser.displayName; document.getElementById('user-email').innerText = currentUser.email; document.getElementById('user-photo').src = currentUser.photoURL; } }
document.getElementById('google-login-btn').addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
function loadFirebaseData() { const r = db.collection('users').doc(currentUser.uid); r.collection('chickens').onSnapshot(s => { localChickens = s.docs.map(d=>({id:d.id, ...d.data()})); renderAll(); }); r.collection('eggs').orderBy('date').onSnapshot(s => { localEggs = s.docs.map(d=>d.data()); renderAll(); }); r.collection('expenses').orderBy('date').onSnapshot(s => { localExpenses = s.docs.map(d=>({id:d.id, ...d.data()})); renderAll(); }); }
function initEggsChart() {
    eggsChartInstance = new Chart(document.getElementById('eggsChart').getContext('2d'), { type: 'bar', data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#0071e3', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: {legend:{display:false}}, scales:{y:{beginAtZero:true, display:false}, x:{grid:{display:false}}} } });
}
