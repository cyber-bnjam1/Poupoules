// --- CONFIGURATION FIREBASE ---
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
        { id: 'e1', chickenId: 'c1', chickenName: 'Huguette', date: new Date().toISOString() }
    ],
    // Expenses est renommé en "Transactions" pour gérer dépenses ET revenus
    transactions: [
        { id: 't1', category: 'expense', type: 'graines', amount: 25.50, date: new Date().toISOString() }
    ],
    treatments: [],
    tasks: [
        { id: 'task1', title: 'Donner à manger', lastDone: null },
        { id: 'task2', title: 'Changer l\'eau', lastDone: null },
        { id: 'task3', title: 'Nettoyer le poulailler', lastDone: null } // Reset tous les 7 jours par exemple
    ]
};

// --- STATE ---
let currentUser = null;
let isDemoMode = true;
let localChickens = [...DEMO_DATA.chickens];
let localEggs = [...DEMO_DATA.eggs];
let localTransactions = [...DEMO_DATA.transactions];
let localTreatments = [...DEMO_DATA.treatments];
let localTasks = [...DEMO_DATA.tasks];

let currentChickenId = null;
let currentFilter = 'active'; 
let currentStatsPeriod = 'month';
let eggsChartInstance = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initEggsChart();
    
    // Check Dark Mode
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }

    // Weather Init
    fetchWeather();

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
            loadLocalTasks(); // Charger tâches depuis localStorage en mode démo
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

// --- FEATURES UTILS ---
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

function fetchWeather() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            // API Gratuite Open-Meteo
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
                .then(response => response.json())
                .then(data => {
                    const temp = Math.round(data.current_weather.temperature);
                    const widget = document.getElementById('weather-widget');
                    widget.querySelector('span').innerText = `${temp}°C`;
                    widget.style.display = 'flex';
                });
        });
    }
}

// --- RENDER ---
function renderAll() {
    renderChickensList();
    renderDashboard();
    renderFinance();
    renderTasks();
}

// 1. DASHBOARD & TASKS
function renderTasks() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    
    // On reset les taches à minuit (logique simplifiée ici: si date != aujourd'hui)
    const today = new Date().toDateString();

    localTasks.forEach(task => {
        const isDone = task.lastDone === today;
        const li = document.createElement('li');
        li.className = `task-item ${isDone ? 'completed' : ''}`;
        li.onclick = () => toggleTask(task.id);
        li.innerHTML = `
            <div class="task-checkbox"></div>
            <span>${task.title}</span>
        `;
        list.appendChild(li);
    });
}

window.toggleTask = (id) => {
    const today = new Date().toDateString();
    const taskIndex = localTasks.findIndex(t => t.id === id);
    if(taskIndex > -1) {
        // Toggle logic
        if(localTasks[taskIndex].lastDone === today) {
            localTasks[taskIndex].lastDone = null; // Uncheck
        } else {
            localTasks[taskIndex].lastDone = today; // Check
        }
        
        if(isDemoMode) {
            localStorage.setItem('demoTasks', JSON.stringify(localTasks));
            renderTasks();
        } else {
            // Save to Firebase (simplified: overwrite user tasks doc)
            db.collection('users').doc(currentUser.uid).collection('settings').doc('tasks').set({ list: localTasks });
        }
    }
};

window.resetTasks = () => {
    if(confirm("Réinitialiser la liste des tâches ?")) {
        localTasks.forEach(t => t.lastDone = null);
        renderTasks();
    }
};

function loadLocalTasks() {
    const saved = localStorage.getItem('demoTasks');
    if(saved) localTasks = JSON.parse(saved);
}

function renderDashboard() {
    const now = new Date(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
    let filteredEggs = [], filteredTransactions = [];

    if (currentStatsPeriod === 'month') {
        filteredEggs = localEggs.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
        filteredTransactions = localTransactions.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
        document.getElementById('label-eggs-display').innerText = "Œufs (Mois)"; document.getElementById('chart-title').innerHTML = '<i class="fas fa-chart-bar"></i> Jours du mois';
    } else {
        filteredEggs = localEggs.filter(e => new Date(e.date).getFullYear() === currentYear);
        filteredTransactions = localTransactions.filter(e => new Date(e.date).getFullYear() === currentYear);
        document.getElementById('label-eggs-display').innerText = "Œufs (Année)"; document.getElementById('chart-title').innerHTML = '<i class="fas fa-chart-bar"></i> Mois de l\'année';
    }
    
    document.getElementById('total-eggs-display').innerText = filteredEggs.length;
    
    // Calcul Rentabilité
    const totalExpenses = filteredTransactions.filter(t => t.category === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    const costPerEgg = filteredEggs.length > 0 ? (totalExpenses / filteredEggs.length).toFixed(2) : "0.00";
    document.getElementById('cost-per-egg-display').innerText = costPerEgg + ' €';

    updateEggsChart(filteredEggs);
    
    const list = document.getElementById('recent-activity-list'); list.innerHTML = '';
    const recentEggs = [...localEggs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    recentEggs.forEach(egg => {
        const li = document.createElement('li'); const d = new Date(egg.date);
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;"><span>🥚</span><span style="font-weight:500;">${egg.chickenName}</span></div>
            <div style="display:flex; align-items:center;"><span style="font-size:12px; color:#999; margin-right:5px;">${d.getDate()}/${d.getMonth()+1}</span><button class="delete-icon-btn" onclick="deleteEgg('${egg.id}')"><i class="fas fa-trash-alt"></i></button></div>`;
        list.appendChild(li);
    });
}
function updateEggsChart(eggsData) {
    let labels = [], data = [];
    if (currentStatsPeriod === 'month') { labels = Array.from({length: 31}, (_, i) => i + 1); data = new Array(31).fill(0); eggsData.forEach(e => { data[new Date(e.date).getDate() - 1]++; }); } 
    else { labels = ['J','F','M','A','M','J','J','A','S','O','N','D']; data = new Array(12).fill(0); eggsData.forEach(e => { data[new Date(e.date).getMonth()]++; }); }
    eggsChartInstance.data.labels = labels; eggsChartInstance.data.datasets[0].data = data; eggsChartInstance.update();
}

// 2. POULES & SANTE
function renderChickensList() {
    const grid = document.getElementById('chickens-grid'); grid.innerHTML = '';
    const list = localChickens.filter(c => (c.status || 'active') === currentFilter);
    if (list.length === 0) { grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#999; margin-top:30px;">Vide 🐣</p>'; return; }
    list.forEach(chk => {
        const img = chk.photo || 'icon.png';
        const card = document.createElement('div'); card.className = `chicken-card ${chk.status === 'archived' ? 'grayscale-card' : ''}`;
        card.onclick = (e) => { if (!e.target.closest('.egg-btn')) openChickenDetails(chk.id); };
        card.innerHTML = `<img src="${img}" class="chicken-img"><h3 style="margin:5px 0;">${chk.name}</h3><small style="color:#888">${chk.breed}</small>${chk.status === 'active' ? `<button class="egg-btn" onclick="handleAddEgg('${chk.id}', '${chk.name}')">🥚 A pondu !</button>` : `<small style="display:block;margin-top:10px">Archivée</small>`}`;
        grid.appendChild(card);
    });
}
function filterChickens(status, btn) { currentFilter = status; document.querySelectorAll('#view-chickens .segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderChickensList(); }
function switchStatsPeriod(period, btn) { currentStatsPeriod = period; document.querySelectorAll('#view-dashboard .segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderDashboard(); }

// 3. FINANCE (TRANSACTIONS)
function renderFinance() {
    const list = document.getElementById('expenses-list'); list.innerHTML = '';
    localTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let totalIncome = 0; let totalExpense = 0;
    let map = { graines: 0, paille: 0, soins: 0, materiel: 0, autre: 0 }; 

    localTransactions.forEach(trans => {
        if(trans.category === 'income') totalIncome += trans.amount;
        else {
            totalExpense += trans.amount;
            const t = map[trans.type] !== undefined ? trans.type : 'autre'; 
            map[t] += trans.amount;
        }

        const li = document.createElement('li');
        li.className = 'expenses-list-item'; li.onclick = () => openTransactionModal(trans.id);
        const icon = trans.category === 'income' ? '💰' : (trans.type === 'graines' ? '🌾' : (trans.type === 'paille' ? '🛏️' : '💊'));
        const color = trans.category === 'income' ? 'var(--success)' : 'var(--danger)';
        const sign = trans.category === 'income' ? '+' : '-';
        
        li.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; gap:8px"><span style="font-size:18px">${icon}</span><span style="text-transform:capitalize; font-weight:500;">${trans.type || 'Vente'}</span></div>
                <small style="color:#999; margin-left:26px;">${new Date(trans.date).toLocaleDateString()}</small>
            </div>
            <span style="font-weight:600; color:${color}">${sign}${trans.amount}€</span>
        `;
        list.appendChild(li);
    });

    document.getElementById('finance-income').innerText = totalIncome.toFixed(2) + '€';
    document.getElementById('finance-expense').innerText = totalExpense.toFixed(2) + '€';
    document.getElementById('finance-balance').innerText = (totalIncome - totalExpense).toFixed(2) + '€';

    // Graphique Dépenses
    const progressBar = document.getElementById('finance-progress-bar'); progressBar.innerHTML = '';
    if (totalExpense === 0) { progressBar.innerHTML = '<div class="progress-segment" style="width:100%; background-color:#e5e5e5;"></div>'; } 
    else { for (const [type, amount] of Object.entries(map)) { if (amount > 0) { const percentage = (amount / totalExpense) * 100; progressBar.innerHTML += `<div class="progress-segment bg-${type}" style="width:${percentage}%"></div>`; } } }
    const legend = document.getElementById('finance-legend'); legend.innerHTML = ''; const labels = { graines: 'Graines', paille: 'Paille', soins: 'Soins', materiel: 'Matériel', autre: 'Autre' };
    for (const [type, amount] of Object.entries(map)) { if (amount > 0 || totalExpense === 0) { legend.innerHTML += `<div class="legend-item"><div class="legend-color bg-${type}"></div><span>${labels[type]} (${totalExpense > 0 ? Math.round((amount/totalExpense)*100) : 0}%)</span></div>`; } }
}

// --- MODALS ACTIONS ---

// OEUFS
window.handleAddEgg = (id, name) => {
    const newEgg = { id: 'egg_'+Date.now(), chickenId: id, chickenName: name, date: new Date().toISOString() };
    if (isDemoMode) { localEggs.push(newEgg); renderDashboard(); alert(`Top ${name} !`); }
    else { db.collection('users').doc(currentUser.uid).collection('eggs').add(newEgg); }
};
window.deleteEgg = (eggId) => {
    if(confirm("Supprimer cet œuf ?")) {
        if(isDemoMode) { localEggs = localEggs.filter(e => e.id !== eggId); renderDashboard(); }
        else { db.collection('users').doc(currentUser.uid).collection('eggs').doc(eggId).delete(); }
    }
};

// POULES (Details & Santé)
window.openChickenDetails = (id) => {
    currentChickenId = id; const chk = localChickens.find(c => c.id === id); if(!chk) return;
    document.getElementById('detail-name').innerText = chk.name; document.getElementById('detail-breed').innerText = chk.breed;
    document.getElementById('detail-price').innerText = (chk.price || 0) + ' €'; document.getElementById('detail-date').innerText = new Date(chk.date).toLocaleDateString();
    document.getElementById('detail-age').innerText = calculateAge(chk.date); document.getElementById('detail-photo').src = chk.photo;
    document.getElementById('detail-total-eggs').innerText = localEggs.filter(e => e.chickenId === id).length;
    
    // Rendu Carnet de Santé
    const healthList = document.getElementById('health-list'); healthList.innerHTML = '';
    const myTreatments = localTreatments.filter(t => t.chickenId === id).sort((a,b) => new Date(b.date) - new Date(a.date));
    if(myTreatments.length === 0) healthList.innerHTML = '<li><small style="color:#999">Aucun soin enregistré</small></li>';
    myTreatments.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `<div><strong>${t.type}</strong> <span style="font-size:12px;color:#777">(${new Date(t.date).toLocaleDateString()})</span><br><small>${t.note || ''}</small></div>`;
        healthList.appendChild(li);
    });

    const archiveBtn = document.getElementById('btn-archive');
    if(chk.status === 'archived') { archiveBtn.innerText = 'Désarchiver'; archiveBtn.className = 'glass-btn primary-btn'; archiveBtn.onclick = () => toggleArchiveStatus(id, 'active'); document.getElementById('detail-status').innerText='Archivée';}
    else { archiveBtn.innerText = 'Archiver'; archiveBtn.className = 'glass-btn danger-btn'; archiveBtn.onclick = () => toggleArchiveStatus(id, 'archived'); document.getElementById('detail-status').innerText='Active';}
    document.getElementById('view-chickens').classList.remove('active-view'); document.getElementById('view-chicken-detail').classList.add('active-view'); 
};
window.closeChickenDetails = () => { document.getElementById('view-chicken-detail').classList.remove('active-view'); document.getElementById('view-chickens').classList.add('active-view'); };

// MODAL TRAITEMENT
window.openTreatmentModal = () => {
    document.getElementById('form-treatment').reset(); document.getElementById('treat-date').valueAsDate = new Date();
    document.getElementById('modal-treatment').style.display = 'flex';
};
document.getElementById('form-treatment').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        chickenId: currentChickenId,
        date: new Date(document.getElementById('treat-date').value).toISOString(),
        type: document.getElementById('treat-type').value,
        note: document.getElementById('treat-note').value
    };
    if(isDemoMode) { localTreatments.push({ id:'t'+Date.now(), ...data }); openChickenDetails(currentChickenId); }
    else { db.collection('users').doc(currentUser.uid).collection('treatments').add(data); }
    document.getElementById('modal-treatment').style.display = 'none';
});

// MODAL TRANSACTION (Mixte Vente/Dépense)
window.setTransactionType = (type) => {
    document.getElementById('trans-category').value = type;
    document.getElementById('btn-type-expense').className = type === 'expense' ? 'segment-btn active' : 'segment-btn';
    document.getElementById('btn-type-income').className = type === 'income' ? 'segment-btn active' : 'segment-btn';
    document.getElementById('field-expense-type').style.display = type === 'expense' ? 'block' : 'none';
};

window.openTransactionModal = (transId = null) => {
    const modal = document.getElementById('modal-transaction');
    const deleteBtn = document.getElementById('btn-delete-trans');
    document.getElementById('form-transaction').reset();
    
    // Default
    setTransactionType('expense');
    document.getElementById('trans-date').valueAsDate = new Date();

    if (transId) {
        const t = localTransactions.find(e => e.id === transId); if (!t) return;
        document.getElementById('modal-transaction-title').innerText = "Modifier";
        document.getElementById('trans-id').value = t.id; 
        document.getElementById('trans-date').value = t.date.split('T')[0];
        document.getElementById('trans-amount').value = t.amount;
        setTransactionType(t.category || 'expense');
        if(t.category === 'expense') document.getElementById('trans-type').value = t.type;
        deleteBtn.style.display = 'flex';
    } else {
        document.getElementById('modal-transaction-title').innerText = "Nouvelle Transaction";
        document.getElementById('trans-id').value = ''; 
        deleteBtn.style.display = 'none';
    }
    modal.style.display = 'flex';
};

document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('trans-id').value;
    const category = document.getElementById('trans-category').value;
    const data = { 
        category: category,
        type: category === 'expense' ? document.getElementById('trans-type').value : 'vente',
        amount: parseFloat(document.getElementById('trans-amount').value), 
        date: new Date(document.getElementById('trans-date').value).toISOString() 
    };
    
    if (isDemoMode) {
        if (id) { const idx = localTransactions.findIndex(e => e.id === id); if (idx !== -1) localTransactions[idx] = { id, ...data }; }
        else { localTransactions.push({ id: 'tr' + Date.now(), ...data }); }
        renderAll();
    } else {
        if (id) { db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).update(data); }
        else { db.collection('users').doc(currentUser.uid).collection('transactions').add(data); }
    }
    document.getElementById('modal-transaction').style.display = 'none';
});

window.deleteCurrentTransaction = () => {
    const id = document.getElementById('trans-id').value; if (!id) return;
    if (confirm("Supprimer cette transaction ?")) {
        if (isDemoMode) { localTransactions = localTransactions.filter(e => e.id !== id); renderAll(); }
        else { db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).delete(); }
        document.getElementById('modal-transaction').style.display = 'none';
    }
};

// ... GESTION POULES (Reste identique V12 avec compression image, voir ci-dessous pour concision) ...
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
document.getElementById('chk-photo-file').addEventListener('change', (e) => { if (e.target.files[0]) { compressImage(e.target.files[0], (src) => { document.getElementById('preview-photo').src = src; }); } });
window.openChickenModal = (isEdit = false) => {
    const modal = document.getElementById('modal-chicken'); const deleteBtn = document.getElementById('btn-delete-chicken');
    document.getElementById('form-chicken').reset();
    if (!isEdit) { document.getElementById('modal-chicken-title').innerText="Nouvelle Poule"; document.getElementById('chk-id').value=''; document.getElementById('preview-photo').src='icon.png'; deleteBtn.style.display='none'; }
    else if (isEdit && currentChickenId) {
        const chk = localChickens.find(c => c.id === currentChickenId);
        document.getElementById('modal-chicken-title').innerText="Modifier"; document.getElementById('chk-id').value=chk.id; document.getElementById('chk-name').value=chk.name; 
        document.getElementById('chk-breed').value=chk.breed; document.getElementById('chk-date').value=chk.date||''; document.getElementById('chk-price').value=chk.price||''; document.getElementById('preview-photo').src=chk.photo||'icon.png';
        deleteBtn.style.display='flex';
    }
    modal.style.display='flex';
};
window.editCurrentChicken = () => openChickenModal(true);
document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault(); const id = document.getElementById('chk-id').value;
    const data = { name: document.getElementById('chk-name').value, breed: document.getElementById('chk-breed').value, date: document.getElementById('chk-date').value, price: parseFloat(document.getElementById('chk-price').value), photo: document.getElementById('preview-photo').src, status: 'active' };
    if (isDemoMode) {
        if(id) { const idx = localChickens.findIndex(c => c.id === id); localChickens[idx] = { ...localChickens[idx], ...data }; if(currentChickenId === id) openChickenDetails(id); }
        else { localChickens.push({ id: 'demo'+Date.now(), ...data }); filterChickens('active', document.getElementById('btn-filter-active')); }
        renderChickensList();
    } else {
        if(id) { db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).update(data); if(currentChickenId === id) openChickenDetails(id); }
        else { db.collection('users').doc(currentUser.uid).collection('chickens').add(data); filterChickens('active', document.getElementById('btn-filter-active')); }
    }
    document.getElementById('modal-chicken').style.display='none';
});
window.deleteCurrentChicken = () => {
    const id = document.getElementById('chk-id').value; if (!id) return;
    if (confirm("Supprimer cette poule ?")) {
        if(isDemoMode){localChickens=localChickens.filter(c=>c.id!==id);closeChickenDetails();renderChickensList();}
        else{db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).delete().then(()=>closeChickenDetails());}
        document.getElementById('modal-chicken').style.display='none';
    }
};
window.archiveCurrentChicken = () => toggleArchiveStatus(currentChickenId, 'archived');
function toggleArchiveStatus(id, status) {
    if(isDemoMode) { const chk = localChickens.find(c => c.id === id); if(chk) chk.status = status; closeChickenDetails(); renderChickensList(); }
    else { db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).update({status}); closeChickenDetails(); }
}
function calculateAge(d) { if(!d) return '?'; const m = (new Date().getFullYear()-new Date(d).getFullYear())*12 - new Date(d).getMonth() + new Date().getMonth(); return m<12 ? m+" mois" : Math.floor(m/12)+" ans"; }
function updateAuthUI(isLoggedIn) {
    document.getElementById('auth-logged-out').style.display = isLoggedIn ? 'none' : 'block'; document.getElementById('auth-logged-in').style.display = isLoggedIn ? 'flex' : 'none';
    if(isLoggedIn) { document.getElementById('user-name').innerText = currentUser.displayName; document.getElementById('user-email').innerText = currentUser.email; document.getElementById('user-photo').src = currentUser.photoURL; }
}
document.getElementById('google-login-btn').addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

// LOAD DATA
function loadFirebaseData() { 
    const r = db.collection('users').doc(currentUser.uid); 
    r.collection('chickens').onSnapshot(s => { localChickens = s.docs.map(d=>({id:d.id, ...d.data()})); renderAll(); }); 
    r.collection('eggs').orderBy('date').onSnapshot(s => { localEggs = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); }); 
    // Chargement Transactions (Anciennement Expenses)
    r.collection('transactions').orderBy('date').onSnapshot(s => { localTransactions = s.docs.map(d=>({id:d.id, ...d.data()})); renderAll(); }); 
    r.collection('treatments').orderBy('date').onSnapshot(s => { localTreatments = s.docs.map(d=>({id:d.id, ...d.data()})); if(currentChickenId) openChickenDetails(currentChickenId); });
    // Load Tasks from Settings
    r.collection('settings').doc('tasks').onSnapshot(s => { if(s.exists) { localTasks = s.data().list || []; renderTasks(); }});
}
function initEggsChart() { eggsChartInstance = new Chart(document.getElementById('eggsChart').getContext('2d'), { type: 'bar', data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#0071e3', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: {legend:{display:false}}, scales:{y:{beginAtZero:true, display:false}, x:{grid:{display:false}}} } }); }
