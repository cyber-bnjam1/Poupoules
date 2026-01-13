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
    
    // --- MODIFICATION POUR STATS.JS ---
    // Si on navigue vers l'onglet stats, on force le rendu
    if (targetId === 'view-stats' && window.renderStatsView) {
        window.renderStatsView();
    }
    // ----------------------------------

    window.scrollTo(0,0);
};

function updateFabVisibility(viewId) {
    const fab = document.getElementById('main-fab');
    // Le bouton FAB est visible pour : Poules, Finances, Entretien
    // Il est caché pour : Dashboard, Stats, Réglages
    if(['view-chickens','view-finance','view-maintenance'].includes(viewId)) fab.classList.remove('hidden');
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
            <div class="chicken-breed">${c.breed || 'Inconnue'}</div>
            <div class="chicken-age">${getAge(c.dob)}</div>
        `;
        grid.appendChild(div);
    });
}
window.filterChickens = (type, btn) => {
    document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChickensList();
};
window.openChickenModal = (id=null) => {
    document.getElementById('modal-chicken').style.display = 'flex';
    const title = document.getElementById('modal-chicken-title');
    const delBtn = document.getElementById('btn-delete-chicken');
    
    if(id) {
        const c = localChickens.find(x => x.id === id);
        title.innerText = "Modifier Poule";
        document.getElementById('chicken-id').value = c.id;
        document.getElementById('chicken-name').value = c.name;
        document.getElementById('chicken-breed').value = c.breed || '';
        document.getElementById('chicken-dob').value = c.dob || '';
        document.getElementById('chicken-fav').checked = c.isFavorite || false;
        document.getElementById('preview-photo').src = c.photo || 'icon.png';
        tempPhotoBase64 = c.photo;
        delBtn.style.display = 'block';
    } else {
        title.innerText = "Nouvelle Poule";
        document.getElementById('chicken-id').value = '';
        document.getElementById('chicken-name').value = '';
        document.getElementById('chicken-breed').value = '';
        document.getElementById('chicken-dob').value = '';
        document.getElementById('chicken-fav').checked = false;
        document.getElementById('preview-photo').src = 'icon.png';
        tempPhotoBase64 = null;
        delBtn.style.display = 'none';
    }
};
window.saveChicken = () => {
    const id = document.getElementById('chicken-id').value;
    const name = document.getElementById('chicken-name').value;
    if(!name) return alert("Nom obligatoire");
    
    const data = {
        name: name,
        breed: document.getElementById('chicken-breed').value,
        dob: document.getElementById('chicken-dob').value,
        isFavorite: document.getElementById('chicken-fav').checked,
        photo: tempPhotoBase64
    };

    if(id) {
        const idx = localChickens.findIndex(c => c.id === id);
        if(idx >= 0) localChickens[idx] = { ...localChickens[idx], ...data };
    } else {
        localChickens.push({ id: 'c'+Date.now(), status: 'active', ...data });
    }
    saveData();
    renderChickensList();
    document.getElementById('modal-chicken').style.display = 'none';
};
window.toggleFavorite = (id) => {
    const c = localChickens.find(x => x.id === id);
    if(c) { c.isFavorite = !c.isFavorite; saveData(); renderChickensList(); }
};
window.deleteCurrentChicken = () => {
    if(confirm("Archiver cette poule ? (Elle ne sera pas supprimée définitivement)")) {
        const id = document.getElementById('chicken-id').value;
        const c = localChickens.find(x => x.id === id);
        if(c) c.status = 'archived';
        saveData();
        renderChickensList();
        document.getElementById('modal-chicken').style.display = 'none';
    }
};

// DASHBOARD
function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const monthEggs = localEggs.filter(e => new Date(e.date).getMonth() === currentMonth && new Date(e.date).getFullYear() === now.getFullYear());
    const count = monthEggs.reduce((acc, curr) => acc + (curr.count||0), 0);
    document.getElementById('eggs-month-count').innerText = count;

    // Chart
    const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    const data = Array(12).fill(0);
    localEggs.forEach(e => {
        const d = new Date(e.date);
        if(d.getFullYear() === now.getFullYear()) data[d.getMonth()] += (e.count||0);
    });
    
    document.getElementById('total-eggs-display').innerText = data.reduce((a,b)=>a+b, 0);

    if(eggsChartInstance) eggsChartInstance.destroy();
    const ctx = document.getElementById('eggsChart').getContext('2d');
    eggsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
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

    renderActivity();
    if(window.injectExtensionContainers) injectExtensionContainers();
}

function initEggsChart() {
    // Placeholder loaded in renderDashboard
}

function renderActivity() {
    const ul = document.getElementById('recent-activity-list');
    ul.innerHTML = '';
    const all = [
        ...localEggs.map(e => ({ type: 'egg', date: e.date, val: e.count })),
        ...localTransactions.map(t => ({ type: 'money', date: t.date, val: t.amount, desc: t.desc, cat: t.type })),
        ...localTasks.map(t => ({ type: 'task', date: t.lastDone, val: t.name }))
    ].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    all.forEach(item => {
        const li = document.createElement('li');
        const d = new Date(item.date).toLocaleDateString();
        if(item.type === 'egg') li.innerHTML = `<i class="fas fa-egg" style="color:var(--warning)"></i> <span>${item.val} œuf(s) ramassé(s)</span> <small>${d}</small>`;
        if(item.type === 'money') li.innerHTML = `<i class="fas fa-coins" style="color:${item.cat==='income'?'var(--success)':'var(--danger)'}"></i> <span>${item.desc} (${item.val}€)</span> <small>${d}</small>`;
        if(item.type === 'task') li.innerHTML = `<i class="fas fa-check" style="color:var(--primary)"></i> <span>${item.val}</span> <small>${d}</small>`;
        ul.appendChild(li);
    });
}

// FINANCE
function renderFinance() {
    let balance = 0;
    const ul = document.getElementById('transactions-list');
    ul.innerHTML = '';
    
    localTransactions.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
        const val = parseFloat(t.amount);
        if(t.type === 'income') balance += val; else balance -= val;
        
        const li = document.createElement('li');
        li.className = 'transaction-item';
        li.innerHTML = `
            <div class="trans-icon" style="background:${t.type==='income'?'rgba(52, 199, 89, 0.2)':'rgba(255, 59, 48, 0.2)'}; color:${t.type==='income'?'var(--success)':'var(--danger)'}"><i class="fas ${t.type==='income'?'fa-arrow-down':'fa-arrow-up'}"></i></div>
            <div class="trans-info"><div class="trans-desc">${t.desc}</div><div class="trans-date">${new Date(t.date).toLocaleDateString()}</div></div>
            <div class="trans-amount" style="color:${t.type==='income'?'var(--success)':'var(--text-dark)'}">${t.type==='income'?'+':'-'}${val.toFixed(2)} €</div>
        `;
        ul.appendChild(li);
    });
    
    document.getElementById('finance-balance').innerText = balance.toFixed(2) + " €";
    document.getElementById('finance-balance').style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';
}
window.openTransactionModal = (type) => {
    document.getElementById('modal-transaction').style.display = 'flex';
    document.getElementById('modal-transaction-title').innerText = type === 'income' ? 'Nouvelle Vente' : 'Nouvelle Dépense';
    document.getElementById('trans-type').value = type;
    document.getElementById('trans-amount').value = '';
    document.getElementById('trans-desc').value = '';
    document.getElementById('trans-date').valueAsDate = new Date();
};
window.saveTransaction = () => {
    const amt = parseFloat(document.getElementById('trans-amount').value);
    const desc = document.getElementById('trans-desc').value;
    if(!amt || !desc) return;
    
    localTransactions.push({
        id: 't'+Date.now(),
        type: document.getElementById('trans-type').value,
        amount: amt,
        desc: desc,
        date: document.getElementById('trans-date').value
    });
    saveData();
    renderFinance();
    renderDashboard(); // Update activity
    document.getElementById('modal-transaction').style.display = 'none';
};

// MAINTENANCE
const DEFAULT_TASKS = [
    {id: 'def1', name: 'Changer l\'eau', freq: 2, icon: 'fa-tint'},
    {id: 'def2', name: 'Nettoyer le pondoir', freq: 7, icon: 'fa-brush'},
    {id: 'def3', name: 'Grand nettoyage', freq: 30, icon: 'fa-soap'}
];
function renderMaintenance() {
    const grid = document.getElementById('maintenance-grid');
    grid.innerHTML = '';
    
    // Merge defaults with local state or use local if overridden
    let tasksToRender = localTasks.length > 0 ? localTasks : DEFAULT_TASKS.map(t => ({...t, lastDone: new Date(new Date().setDate(new Date().getDate() - t.freq - 1)).toISOString() }));
    // If first load (empty local), init defaults
    if(localTasks.length === 0) localTasks = tasksToRender;

    localTasks.forEach(t => {
        const daysSince = getDaysDiff(t.lastDone);
        const urgency = daysSince / t.freq;
        let statusClass = 'good';
        if(urgency >= 1) statusClass = 'critical';
        else if(urgency > 0.7) statusClass = 'warning';

        const div = document.createElement('div');
        div.className = `task-card ${statusClass}`;
        div.innerHTML = `
            <div class="task-icon"><i class="fas ${t.icon || 'fa-check'}"></i></div>
            <div class="task-info">
                <div class="task-name">${t.name}</div>
                <div class="task-timer">Fait il y a ${daysSince}j (tous les ${t.freq}j)</div>
            </div>
            <button class="task-check-btn" onclick="completeTask('${t.id}')"><i class="fas fa-check"></i></button>
            <div style="position:absolute; top:10px; right:10px; opacity:0.3;" onclick="openEditTaskModal('${t.id}')"><i class="fas fa-ellipsis-v"></i></div>
        `;
        grid.appendChild(div);
    });
}
window.completeTask = (id) => {
    const idx = localTasks.findIndex(t => t.id === id);
    if(idx >= 0) {
        localTasks[idx].lastDone = new Date().toISOString();
        saveData();
        renderMaintenance();
        renderDashboard();
    }
};
window.openEditTaskModal = (id=null) => {
    document.getElementById('modal-edit-task').style.display = 'flex';
    if(id) {
        const t = localTasks.find(x => x.id === id);
        document.getElementById('task-id').value = t.id;
        document.getElementById('task-name').value = t.name;
        document.getElementById('task-freq').value = t.freq;
    } else {
        // New task
        document.getElementById('task-id').value = '';
        document.getElementById('task-name').value = '';
        document.getElementById('task-freq').value = 7;
    }
};
document.getElementById('modal-edit-task').querySelector('.btn-primary').addEventListener('click', () => {
    // This listener might be added multiple times if not careful, better use onclick in HTML or named function
});
window.saveTaskChanges = () => {
    const id = document.getElementById('task-id').value;
    const data = {
        name: document.getElementById('task-name').value,
        freq: parseInt(document.getElementById('task-freq').value),
        icon: 'fa-tools'
    };
    if(id) {
        const idx = localTasks.findIndex(t => t.id === id);
        if(idx >= 0) localTasks[idx] = { ...localTasks[idx], ...data };
    } else {
        localTasks.push({ id: 'task'+Date.now(), ...data, lastDone: new Date().toISOString() });
    }
    saveData();
    document.getElementById('modal-edit-task').style.display = 'none';
    renderMaintenance();
};
window.deleteCurrentTask = () => {
    if(confirm("Supprimer ?")) {
        localTasks = localTasks.filter(t => t.id !== document.getElementById('task-id').value);
        saveData();
        document.getElementById('modal-edit-task').style.display = 'none';
        renderMaintenance();
    }
};

// UTILS
window.handlePhotoUpload = (input) => {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], 150, 0.4).then(b => {
            document.getElementById('preview-photo').src = b;
            tempPhotoBase64 = b;
        });
    }
};

function compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const elem = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                elem.width = width;
                elem.height = height;
                const ctx = elem.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(elem.toDataURL('image/webp', quality));
            };
        };
        reader.onerror = error => reject(error);
    });
}

function getAge(d) {
    if(!d) return '';
    const m = Math.floor((Date.now()-new Date(d).getTime())/(1000*60*60*24*30));
    return m<1?'Poussin':(m<12?m+' mois':Math.floor(m/12)+' ans');
}
function getDaysDiff(d) {
    return Math.floor((new Date()-new Date(d))/(1000*60*60*24));
}

// DATA
function saveData() {
    const d = { chickens: localChickens, eggs: localEggs, transactions: localTransactions, tasks: localTasks };
    try {
        if(isDemoMode) localStorage.setItem('poupoules_data', JSON.stringify(d));
        else if(currentUser) db.collection('users').doc(currentUser.uid).set(d);
    } catch(e) { console.error("Sauvegarde impossible", e); }
}

function loadLocalData() {
    const d = JSON.parse(localStorage.getItem('poupoules_data') || '{"chickens":[]}');
    localChickens = d.chickens||[];
    localEggs = d.eggs||[];
    localTransactions = d.transactions||[];
    localTasks = d.tasks||[];
    renderChickensList();
    renderDashboard();
    renderFinance();
    renderMaintenance();
}

function loadFirebaseData() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            localChickens = d.chickens||[];
            localEggs = d.eggs||[];
            localTransactions = d.transactions||[];
            localTasks = d.tasks||[];
            renderChickensList();
            renderDashboard();
            renderFinance();
            renderMaintenance();
        }
    });
}

window.login = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
window.exportData = () => {
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ chickens: localChickens, eggs: localEggs, transactions: localTransactions, tasks: localTasks }));
    a.download = "sauvegarde.json";
    a.click();
};

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};
