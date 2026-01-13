// CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDpVKRam-7sldEss93zRTh8At3pEtJ0SqA",
    authDomain: "poulettes-75fb5.firebaseapp.com",
    projectId: "poulettes-75fb5",
    storageBucket: "poulettes-75fb5.firebasestorage.app",
    messagingSenderId: "479553710488",
    appId: "1:479553710488:web:8cb5ec0285f330c51e23ed"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// STATE
let localChickens = [], localEggs = [], localTransactions = [], localTasks = [];
let currentUser = null, isDemoMode = true;
let currentViewId = 'view-dashboard';
let tempPhotoBase64 = null;
let eggsChartInstance = null;

// INIT
document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }
    initEggsChart();
    updateFabVisibility('view-dashboard');

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            isDemoMode = false;
            loadFirebaseData();
            document.getElementById('header-status').classList.remove('demo');
            document.getElementById('auth-container').innerHTML = `
                <img src="${user.photoURL || 'icon.png'}" style="width:80px; height:80px; border-radius:50%; margin-bottom:10px;">
                <h3>${user.displayName || 'Utilisateur'}</h3>
                <p style="color:gray; margin-bottom:15px;">${user.email}</p>
                <button class="btn-text-danger" onclick="auth.signOut()">Se déconnecter</button>`;
        } else {
            currentUser = null;
            isDemoMode = true;
            loadLocalData();
            document.getElementById('header-status').classList.add('demo');
            document.getElementById('auth-container').innerHTML = `
                <div style="width:80px; height:80px; background:#ddd; border-radius:50%; margin:0 auto 10px auto; display:flex; align-items:center; justify-content:center; font-size:30px; color:white;"><i class="fas fa-user"></i></div>
                <h3>Mode Invité</h3>
                <p style="color:gray; margin-bottom:15px;">Sauvegarde locale uniquement</p>
                <button class="btn-primary" onclick="login()">Connexion Google</button>`;
        }
    });

    document.querySelectorAll('.close-modal').forEach(b => {
        b.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none');
    });

    document.getElementById('form-add-egg').addEventListener('submit', (e) => {
        e.preventDefault();
        const count = parseInt(document.getElementById('egg-count-input').value);
        const date = document.getElementById('egg-date-input').value;
        if (count > 0 && date) {
            localEggs.push({ id: 'e' + Date.now(), count: count, date: new Date(date).toISOString() });
            saveData();
            if(window.updateFridge) window.updateFridge(count);
            renderDashboard();
            document.getElementById('modal-add-egg').style.display = 'none';
        }
    });
});

window.adjustEggCount = (val) => {
    const input = document.getElementById('egg-count-input');
    let v = parseInt(input.value) + val;
    if(v < 1) v = 1;
    input.value = v;
};

// NAVIGATION
window.toggleMenu = () => document.getElementById('menu-overlay').classList.toggle('open');
window.navigate = (targetId) => {
    document.getElementById('menu-overlay').classList.remove('open');
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    document.getElementById(targetId).classList.add('active-view');
    currentViewId = targetId;
    updateFabVisibility(targetId);
    
    // --- AJOUT : Trigger pour l'onglet stats ---
    if(targetId === 'view-stats' && window.renderStatsView) window.renderStatsView();
    // -------------------------------------------
    
    window.scrollTo(0,0);
};

function updateFabVisibility(viewId) {
    const fab = document.getElementById('main-fab');
    if(viewId === 'view-dashboard') fab.classList.add('hidden');
    else if(['view-chickens','view-finance','view-maintenance'].includes(viewId)) fab.classList.remove('hidden');
    else fab.classList.add('hidden');
}
window.handleFabClick = () => {
    if(currentViewId === 'view-chickens') openChickenModal();
    if(currentViewId === 'view-finance') openTransactionModal();
    if(currentViewId === 'view-maintenance') openEditTaskModal();
};

// POULES
function renderChickensList() {
    const grid = document.getElementById('chickens-grid');
    grid.innerHTML = '';
    const filter = document.querySelector('#btn-filter-active').classList.contains('active') ? 'active' : 'archived';
    
    const list = localChickens
        .filter(c => (c.status || 'active') === filter)
        .sort((a,b) => (b.isFavorite === true) - (a.isFavorite === true));
    
    const title = document.querySelector('#view-chickens .big-title');
    if(title) title.innerText = `Mon Cheptel (${list.length})`;

    if(list.length === 0) { grid.innerHTML = '<p style="text-align:center; width:100%; color:grey;">Aucune poule.</p>'; return; }

    list.forEach(c => {
        const div = document.createElement('div');
        div.className = 'chicken-card';
        div.innerHTML = `
            <button class="fav-btn ${c.isFavorite ? 'active' : ''}" onclick="toggleFavorite('${c.id}')"><i class="${c.isFavorite ? 'fas fa-heart active' : 'far fa-heart'}"></i></button>
            <button class="edit-btn" onclick="openChickenModal('${c.id}')"><i class="fas fa-pen"></i></button>
            <img class="chicken-photo" src="${c.photo || 'icon.png'}">
            <div class="chicken-name">${c.name}</div>
            <div class="chicken-breed">${c.breed || ''}</div>
            <div class="chicken-age">${getAge(c.date)}</div>
        `;
        grid.appendChild(div);
    });
}
window.toggleFavorite = (id) => { const idx = localChickens.findIndex(c => c.id === id); if (idx > -1) { localChickens[idx].isFavorite = !localChickens[idx].isFavorite; saveData(); renderChickensList(); }};
window.archiveChicken = () => {
    const id = document.getElementById('chicken-id').value;
    const idx = localChickens.findIndex(c => c.id === id);
    if (idx > -1) {
        if(localChickens[idx].status === 'archived') { if(confirm("Supprimer ?")) localChickens.splice(idx, 1); } 
        else { if(confirm("Archiver ?")) localChickens[idx].status = 'archived'; }
        saveData(); document.getElementById('modal-chicken').style.display = 'none'; renderChickensList();
    }
};
window.filterChickens = (type, btn) => { document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderChickensList(); document.getElementById('btn-archive-chicken').innerText = type === 'archived' ? 'Supprimer' : 'Archiver'; };
window.openChickenModal = (id = null) => {
    const modal = document.getElementById('modal-chicken'); document.getElementById('form-chicken').reset(); document.getElementById('preview-photo').src = 'icon.png'; tempPhotoBase64 = null;
    if(id) {
        const c = localChickens.find(x => x.id === id); document.getElementById('modal-chicken-title').innerText = "Modifier";
        document.getElementById('chicken-id').value = c.id; document.getElementById('chicken-name').value = c.name; document.getElementById('chicken-breed').value = c.breed; document.getElementById('chicken-date').value = c.date; document.getElementById('chicken-health').value = c.health; if(c.photo) document.getElementById('preview-photo').src = c.photo; document.getElementById('btn-archive-chicken').style.display = 'block';
    } else { document.getElementById('modal-chicken-title').innerText = "Nouvelle Poule"; document.getElementById('chicken-id').value = ""; document.getElementById('chicken-date').valueAsDate = new Date(); document.getElementById('btn-archive-chicken').style.display = 'none'; }
    modal.style.display = 'flex';
};
document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault(); const id = document.getElementById('chicken-id').value;
    const data = { name: document.getElementById('chicken-name').value, breed: document.getElementById('chicken-breed').value, date: document.getElementById('chicken-date').value, health: document.getElementById('chicken-health').value, photo: tempPhotoBase64 || document.getElementById('preview-photo').src };
    if(id) { const idx = localChickens.findIndex(c => c.id === id); if(idx>-1) localChickens[idx] = { ...localChickens[idx], ...data }; }
    else { localChickens.push({ id: 'c' + Date.now(), ...data, status: 'active', isFavorite: false }); }
    saveData(); document.getElementById('modal-chicken').style.display = 'none'; renderChickensList();
});

// DASHBOARD
function renderDashboard() {
    const now = new Date();
    let monthCount = 0;
    let totalCount = 0;

    localEggs.forEach(e => {
        const qty = e.count || 1;
        totalCount += qty;
        const d = new Date(e.date);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            monthCount += qty;
        }
    });

    document.getElementById('total-eggs-display').innerText = totalCount;
    document.getElementById('eggs-month-count').innerText = monthCount;
    
    updateChart(localEggs);
    
    const list = document.getElementById('recent-activity-list');
    list.innerHTML = '';
    localEggs.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5).forEach(e => {
        const qty = e.count || 1;
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="background:#ff9500; width:10px; height:10px; border-radius:50%;"></div>
                <strong>Ramassage</strong>
            </div>
            <div style="text-align:right;">
                <span style="display:block; font-weight:bold;">${qty} œuf${qty>1?'s':''}</span>
                <span style="font-size:11px; color:gray;">${new Date(e.date).toLocaleDateString()}</span>
            </div>
            <button class="btn-text-danger" style="margin-top:0; width:auto; margin-left:10px;" onclick="deleteEgg('${e.id}')"><i class="fas fa-trash"></i></button>
        `;
        list.appendChild(li);
    });

    if(window.injectExtensionContainers) injectExtensionContainers();
}

window.deleteEgg = (id) => {
    if(confirm('Supprimer ce ramassage ?')) {
        const idx = localEggs.findIndex(e => e.id === id);
        if(idx > -1) {
            localEggs.splice(idx, 1);
            saveData();
            if(window.updateFridge) window.updateFridge(-1); // Simplifié
            renderDashboard();
        }
    }
};

function initEggsChart() {
    // Sera appelé au premier render
}
function updateChart(eggs) {
    const ctx = document.getElementById('eggsChart');
    if(!ctx) return;
    const now = new Date();
    const data = Array(12).fill(0);
    eggs.forEach(e => {
        const d = new Date(e.date);
        if(d.getFullYear() === now.getFullYear()) data[d.getMonth()] += (e.count || 1);
    });

    if(eggsChartInstance) eggsChartInstance.destroy();
    eggsChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: ['J','F','M','A','M','J','J','A','S','O','N','D'],
            datasets: [{
                label: 'Œufs',
                data: data,
                borderColor: '#007aff',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
        }
    });
}

// FINANCE
function renderFinance() {
    const list = document.getElementById('finance-list');
    list.innerHTML = '';
    let total = 0;
    
    localTransactions.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
        const val = parseFloat(t.amount);
        const isExpense = t.type !== 'vente_oeufs' && t.type !== 'income'; 
        if(isExpense) total -= val; else total += val;

        const li = document.createElement('li');
        li.onclick = () => openTransactionModal(t.id); // EDIT
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="width:40px; height:40px; border-radius:12px; background:${isExpense ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)'}; display:flex; align-items:center; justify-content:center; color:${isExpense ? 'var(--danger)' : 'var(--success)'}; font-size:18px;">
                    <i class="fas ${isExpense ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                </div>
                <div>
                    <div style="font-weight:600;">${formatTransType(t.type)}</div>
                    <div style="font-size:11px; color:gray;">${new Date(t.date).toLocaleDateString()}</div>
                </div>
            </div>
            <div style="font-weight:bold; color:${isExpense ? 'var(--text-dark)' : 'var(--success)'};">${isExpense ? '-' : '+'}${val.toFixed(2)} €</div>
        `;
        list.appendChild(li);
    });
    
    const bal = document.getElementById('balance-total');
    bal.innerText = total.toFixed(2) + " €";
    bal.style.color = total >= 0 ? 'var(--success)' : 'var(--danger)';

    if(window.renderSalesRegister) window.renderSalesRegister();
}

window.openTransactionModal = (id=null) => {
    document.getElementById('trans-id').value = id || '';
    if(id) {
        const t = localTransactions.find(x => x.id === id);
        document.getElementById('trans-amount').value = t.amount;
        document.getElementById('trans-date').value = t.date;
        document.getElementById('trans-type').value = t.type;
        document.getElementById('btn-delete-trans').style.display = 'block';
    } else {
        document.getElementById('trans-amount').value = '';
        document.getElementById('trans-date').valueAsDate = new Date();
        document.getElementById('btn-delete-trans').style.display = 'none';
    }
    document.getElementById('modal-transaction').style.display = 'flex';
};
window.selectTransType = (type, el) => {
    document.querySelectorAll('.selection-card').forEach(c => c.style.border = '1px solid transparent');
    el.style.border = '1px solid var(--primary)';
    document.getElementById('trans-type').value = type;
};
window.saveTransaction = () => {
    const id = document.getElementById('trans-id').value;
    const type = document.getElementById('trans-type').value || 'autre';
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const date = document.getElementById('trans-date').value;
    
    if(!amount || !date) return alert('Montant et date requis');

    if(id) {
        const idx = localTransactions.findIndex(t => t.id === id);
        if(idx > -1) localTransactions[idx] = { ...localTransactions[idx], type, amount, date };
    } else {
        localTransactions.push({ id: 't'+Date.now(), type, amount, date });
    }
    saveData();
    document.getElementById('modal-transaction').style.display = 'none';
    renderFinance();
};
window.deleteTransaction = () => {
    if(confirm('Supprimer ?')) {
        localTransactions = localTransactions.filter(t => t.id !== document.getElementById('trans-id').value);
        saveData();
        document.getElementById('modal-transaction').style.display = 'none';
        renderFinance();
    }
};

function formatTransType(t) {
    const map = { 'graines': 'Alimentation', 'vente_oeufs': 'Vente Œufs', 'soins': 'Véto', 'achat_poule': 'Achat Poule' };
    return map[t] || t;
}

// ENTRETIEN (TASKS)
function renderTasks() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    
    const defaults = [
        { name: "Changer l'eau", freq: 2 },
        { name: "Nettoyer le pondoir", freq: 7 },
        { name: "Grand nettoyage", freq: 30 }
    ];

    // Merge logic simplified for this view
    if(localTasks.length === 0) {
        localTasks = defaults.map(d => ({ id: 'def'+Date.now()+Math.random(), ...d, lastDone: new Date(new Date().setDate(new Date().getDate() - d.freq - 1)).toISOString() }));
    }

    localTasks.forEach(t => {
        const daysSince = Math.floor((new Date() - new Date(t.lastDone)) / (1000*60*60*24));
        const urgency = daysSince / t.freq;
        let color = 'var(--success)';
        if(urgency > 0.8) color = 'var(--warning)';
        if(urgency >= 1) color = 'var(--danger)';

        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; flex:1;" onclick="openEditTaskModal('${t.id}')">
                <div style="width:40px; height:40px; border-radius:50%; background:${color}; opacity:0.2; display:flex; align-items:center; justify-content:center;"></div>
                <i class="fas fa-check" style="position:absolute; left:27px; color:${color};"></i>
                <div>
                    <div style="font-weight:600;">${t.name}</div>
                    <div style="font-size:11px; color:gray;">Fait il y a ${daysSince}j (tous les ${t.freq}j)</div>
                </div>
            </div>
            <button class="btn-primary" style="width:auto; margin:0; padding:8px 15px;" onclick="completeTask('${t.id}')">Fait</button>
        `;
        list.appendChild(li);
    });

    if(window.renderHealthWidget) window.renderHealthWidget();
    if(window.renderVetWidget) window.renderVetWidget();
}
window.completeTask = (id) => {
    const idx = localTasks.findIndex(t => t.id === id);
    if(idx > -1) { localTasks[idx].lastDone = new Date().toISOString(); saveData(); renderTasks(); }
};
window.openEditTaskModal = (id) => {
    const t = localTasks.find(x => x.id === id);
    document.getElementById('task-id').value = t.id;
    document.getElementById('task-name').value = t.name;
    document.getElementById('task-freq').value = t.freq;
    document.getElementById('modal-task').style.display = 'flex';
};
window.saveTask = () => {
    const id = document.getElementById('task-id').value;
    const idx = localTasks.findIndex(t => t.id === id);
    if(idx > -1) {
        localTasks[idx].name = document.getElementById('task-name').value;
        localTasks[idx].freq = parseInt(document.getElementById('task-freq').value);
        saveData();
        document.getElementById('modal-task').style.display = 'none';
        renderTasks();
    }
};
window.deleteTask = () => {
    if(confirm('Supprimer cette tâche ?')) {
        localTasks = localTasks.filter(t => t.id !== document.getElementById('task-id').value);
        saveData();
        document.getElementById('modal-task').style.display = 'none';
        renderTasks();
    }
};


// UTILS & DATA
function getAge(d) {
    if(!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
    if(months < 1) return 'Poussin';
    if(months < 12) return months + ' mois';
    return Math.floor(months/12) + ' ans';
}

function handlePhotoUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('preview-photo').src = e.target.result;
            tempPhotoBase64 = e.target.result; // Stockage temporaire simple
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveData() {
    const d = { chickens: localChickens, eggs: localEggs, transactions: localTransactions, tasks: localTasks };
    if(currentUser) {
        db.collection('users').doc(currentUser.uid).set(d, { merge: true });
    } else {
        localStorage.setItem('poupoules_data', JSON.stringify(d));
    }
}

function loadLocalData() {
    const d = JSON.parse(localStorage.getItem('poupoules_data') || '{"chickens":[],"eggs":[],"transactions":[],"tasks":[]}');
    localChickens = d.chickens || [];
    localEggs = d.eggs || [];
    localTransactions = d.transactions || [];
    localTasks = d.tasks || [];
    renderChickensList();
    renderDashboard();
    renderFinance();
    renderTasks();
}

function loadFirebaseData() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            localChickens = d.chickens || [];
            localEggs = d.eggs || [];
            localTransactions = d.transactions || [];
            localTasks = d.tasks || [];
            renderChickensList();
            renderDashboard();
            renderFinance();
            renderTasks();
        } else {
            loadLocalData(); // Fallback si pas de données distantes
        }
    });
}

window.login = () => { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); };
window.exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ chickens: localChickens, eggs: localEggs, transactions: localTransactions, tasks: localTasks }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "sauvegarde_poulettes.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};
