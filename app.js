// CONFIGURATION
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

// DONNÉES PAR DÉFAUT
const DEMO_DATA = {
    chickens: [{ id: 'c1', name: 'Huguette', breed: 'Rousse', date: '2023-01-01', health: 'healthy', status: 'active', photo: 'icon.png' }],
    eggs: [],
    transactions: [],
    tasks: []
};

let currentUser = null;
let isDemoMode = true;
let data = { chickens: [], eggs: [], transactions: [], tasks: [] };
let currentView = 'view-dashboard';
let tempPhotoBase64 = null;
let currentStatsPeriod = 'month';
let chartInstance = null;

// INIT
document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }
    initChart();
    
    auth.onAuthStateChanged(user => {
        currentUser = user;
        isDemoMode = !user;
        renderSettings();
        if(user) loadFirebase(); else loadLocal();
    });

    document.querySelectorAll('.close-modal').forEach(b => b.onclick = (e) => e.target.closest('.modal').style.display = 'none');
    updateFab('view-dashboard');
});

// NAVIGATION
window.toggleMenu = () => document.getElementById('menu-overlay').classList.toggle('open');
window.navigate = (id) => {
    document.getElementById('menu-overlay').classList.remove('open');
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    document.getElementById(id).classList.add('active-view');
    document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
    // Sélecteur corrigé pour trouver le bon lien
    const link = [...document.querySelectorAll('.menu-link')].find(l => l.getAttribute('onclick').includes(id));
    if(link) link.classList.add('active');
    
    currentView = id;
    updateFab(id);
    document.getElementById('scroll-container').scrollTop = 0;
};

function updateFab(id) {
    const fab = document.getElementById('main-fab');
    if(id === 'view-dashboard') fab.classList.add('hidden');
    else {
        fab.classList.remove('hidden');
        fab.onclick = () => {
            if(id === 'view-chickens') openChickenModal();
            if(id === 'view-finance') openTransactionModal();
            if(id === 'view-maintenance') openEditTaskModal();
        };
    }
}

// RENDU GLOBAL
function renderAll() {
    renderDashboard();
    renderChickens();
    renderFinance();
    renderTasks();
}

// --- POULES ---
function renderChickens() {
    const grid = document.getElementById('chickens-grid');
    grid.innerHTML = '';
    const filter = document.querySelector('#btn-filter-active').classList.contains('active') ? 'active' : 'archived';
    
    const list = data.chickens.filter(c => (c.status || 'active') === filter);
    
    if(list.length === 0) grid.innerHTML = '<p style="opacity:0.5; text-align:center; width:100%;">Aucune poule ici.</p>';

    list.forEach(c => {
        const div = document.createElement('div');
        div.className = 'chicken-card';
        div.innerHTML = `
            <div class="health-badge">${getHealthIcon(c.health)}</div>
            <div class="edit-icon" onclick="openChickenModal('${c.id}')"><i class="fas fa-ellipsis-h"></i></div>
            <img class="chicken-photo" src="${c.photo || 'icon.png'}">
            <div class="chicken-name">${c.name}</div>
            <div class="chicken-breed">${c.breed || 'Poule'}</div>
        `;
        grid.appendChild(div);
    });
}

function getHealthIcon(h) {
    const icons = { healthy: '❤️', sick: '💊', molting: '🪶', broody: '🥚' };
    return icons[h] || '❤️';
}

window.filterChickens = (type, btn) => {
    document.querySelectorAll('#view-chickens .segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChickens();
};

window.openChickenModal = (id = null) => {
    const form = document.getElementById('form-chicken');
    form.reset();
    tempPhotoBase64 = null;
    document.getElementById('preview-photo').src = 'icon.png';
    const delBtn = document.getElementById('btn-delete-chicken');
    const archBtn = document.getElementById('btn-archive-chicken');

    if(id) {
        const c = data.chickens.find(x => x.id === id);
        document.getElementById('chicken-id').value = c.id;
        document.getElementById('chicken-name').value = c.name;
        document.getElementById('chicken-breed').value = c.breed;
        document.getElementById('chicken-date').value = c.date;
        document.getElementById('chicken-health').value = c.health;
        document.getElementById('chicken-status').value = c.status || 'active';
        if(c.photo) document.getElementById('preview-photo').src = c.photo;
        
        document.getElementById('modal-chicken-title').innerText = "Modifier Poule";
        delBtn.style.display = 'block';
        archBtn.style.display = 'block';
        // Texte dynamique pour le bouton Archiver
        archBtn.innerText = c.status === 'archived' ? 'Désarchiver' : 'Archiver';
    } else {
        document.getElementById('chicken-id').value = "";
        document.getElementById('chicken-status').value = "active";
        document.getElementById('chicken-date').valueAsDate = new Date();
        document.getElementById('modal-chicken-title').innerText = "Nouvelle Poule";
        delBtn.style.display = 'none';
        archBtn.style.display = 'none';
    }
    document.getElementById('modal-chicken').style.display = 'flex';
};

// COMPRESSION D'IMAGE (Indispensable pour LocalStorage)
window.handlePhotoUpload = (input) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            // On crée une image pour la redimensionner via Canvas
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                // On limite la taille à 300px pour que ça prenne peu de place
                const scale = 300 / img.width;
                canvas.width = 300;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                // Compression JPEG 0.7
                const compressed = canvas.toDataURL('image/jpeg', 0.7);
                document.getElementById('preview-photo').src = compressed;
                tempPhotoBase64 = compressed;
            };
        };
    }
};

document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('chicken-id').value;
    const vals = {
        name: document.getElementById('chicken-name').value,
        breed: document.getElementById('chicken-breed').value,
        date: document.getElementById('chicken-date').value,
        health: document.getElementById('chicken-health').value,
        status: document.getElementById('chicken-status').value, // Garde le statut actuel
        photo: tempPhotoBase64 || document.getElementById('preview-photo').getAttribute('src')
    };

    if(id) {
        const idx = data.chickens.findIndex(x => x.id === id);
        if(idx > -1) data.chickens[idx] = { ...data.chickens[idx], ...vals };
    } else {
        data.chickens.push({ id: 'c'+Date.now(), ...vals, status: 'active' });
    }
    saveData();
    document.getElementById('modal-chicken').style.display = 'none';
    renderChickens();
    // Rafraîchir dashboard pour les oeufs si nom change
    renderDashboard(); 
});

window.deleteChicken = () => {
    if(confirm("Supprimer définitivement ?")) {
        data.chickens = data.chickens.filter(c => c.id !== document.getElementById('chicken-id').value);
        saveData();
        document.getElementById('modal-chicken').style.display = 'none';
        renderChickens();
    }
};

// NOUVELLE FONCTION ARCHIVER
window.toggleArchiveChicken = () => {
    const id = document.getElementById('chicken-id').value;
    const idx = data.chickens.findIndex(c => c.id === id);
    if(idx > -1) {
        const newStatus = data.chickens[idx].status === 'active' ? 'archived' : 'active';
        data.chickens[idx].status = newStatus;
        saveData();
        document.getElementById('modal-chicken').style.display = 'none';
        renderChickens();
    }
};

// --- OEUFS / DASHBOARD ---
window.openAddEggModal = () => {
    const grid = document.getElementById('egg-chickens-list');
    grid.innerHTML = '';
    const active = data.chickens.filter(c => c.status === 'active');
    
    if(active.length === 0) {
        grid.innerHTML = '<p style="grid-column:span 3; text-align:center;">Aucune poule active.</p>';
    } else {
        active.forEach(c => {
            const div = document.createElement('div');
            div.className = 'selection-card';
            div.innerHTML = `<img src="${c.photo || 'icon.png'}"><span>${c.name}</span>`;
            div.onclick = () => {
                data.eggs.push({ id: 'e'+Date.now(), chickenId: c.id, chickenName: c.name, date: new Date().toISOString() });
                saveData();
                renderDashboard();
                document.getElementById('modal-add-egg').style.display = 'none';
            };
            grid.appendChild(div);
        });
    }
    document.getElementById('modal-add-egg').style.display = 'flex';
};

function renderDashboard() {
    const now = new Date();
    // Filtre période
    const filtered = currentStatsPeriod === 'month' 
        ? data.eggs.filter(e => new Date(e.date).getMonth() === now.getMonth() && new Date(e.date).getFullYear() === now.getFullYear())
        : data.eggs.filter(e => new Date(e.date).getFullYear() === now.getFullYear());

    document.getElementById('total-eggs-display').innerText = filtered.length;
    
    // Aujourd'hui
    const today = now.toISOString().split('T')[0];
    document.getElementById('eggs-today-count').innerText = data.eggs.filter(e => e.date.startsWith(today)).length;

    // Coût
    const expenses = data.transactions.filter(t => t.category === 'expense' && new Date(t.date).getFullYear() === now.getFullYear())
        .reduce((sum, t) => sum + t.amount, 0);
    const yearEggs = data.eggs.filter(e => new Date(e.date).getFullYear() === now.getFullYear()).length;
    document.getElementById('cost-per-egg-display').innerText = yearEggs ? (expenses / yearEggs).toFixed(2) + '€' : '0.00€';

    // Chart
    updateChart(filtered);

    // Activité
    const list = document.getElementById('recent-activity-list');
    list.innerHTML = '';
    [...data.eggs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5).forEach(e => {
        const li = document.createElement('li');
        const d = new Date(e.date);
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:10px; height:10px; background:#ff9500; border-radius:50%"></div>
                <b>${e.chickenName}</b>
            </div>
            <div style="font-size:12px; opacity:0.6;">${d.getDate()}/${d.getMonth()+1}</div>
        `;
        list.appendChild(li);
    });
}

// --- FINANCE ---
function renderFinance() {
    const list = document.getElementById('finance-list');
    list.innerHTML = '';
    const sorted = [...data.transactions].sort((a,b) => new Date(b.date) - new Date(a.date));

    let inc = 0, exp = 0;
    
    sorted.forEach(t => {
        // CORRECTION DU CALCUL: On s'assure que category est bien lue
        if(t.category === 'income') inc += t.amount;
        else exp += t.amount;

        const li = document.createElement('li');
        li.onclick = () => openTransactionModal(t.id);
        const isInc = t.category === 'income';
        li.innerHTML = `
            <div>
                <b>${t.type}</b><br><small style="opacity:0.6">${t.date}</small>
            </div>
            <div style="color:${isInc ? 'var(--success)' : 'var(--text-color)'}">
                ${isInc ? '+' : '-'}${t.amount.toFixed(2)}€
            </div>
        `;
        list.appendChild(li);
    });

    document.getElementById('total-income').innerText = inc.toFixed(2);
    document.getElementById('total-expense').innerText = exp.toFixed(2);
    document.getElementById('balance-total').innerText = (inc - exp).toFixed(2) + ' €';
    
    // Bar
    const total = inc + exp;
    const pct = total ? (inc / total) * 100 : 50;
    document.getElementById('finance-bar').style.width = pct + '%';
}

window.openTransactionModal = (id = null) => {
    document.getElementById('form-transaction').reset();
    if(id) {
        const t = data.transactions.find(x => x.id === id);
        document.getElementById('trans-id').value = t.id;
        document.getElementById('trans-amount').value = t.amount;
        document.getElementById('trans-date').value = t.date;
        document.getElementById('trans-type').value = t.type;
        setTransactionType(t.category);
        document.getElementById('btn-delete-trans').style.display = 'block';
    } else {
        document.getElementById('trans-id').value = "";
        document.getElementById('trans-date').valueAsDate = new Date();
        setTransactionType('expense');
        document.getElementById('btn-delete-trans').style.display = 'none';
    }
    document.getElementById('modal-transaction').style.display = 'flex';
};

window.setTransactionType = (type) => {
    document.querySelectorAll('#modal-transaction .segment-btn').forEach(b => b.classList.remove('active'));
    if(type === 'expense') document.getElementById('btn-expense').classList.add('active');
    else document.getElementById('btn-income').classList.add('active');
};

document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('trans-id').value;
    // Logique corrigée pour récupérer la catégorie active
    const isExpense = document.getElementById('btn-expense').classList.contains('active');
    
    const val = {
        amount: parseFloat(document.getElementById('trans-amount').value),
        date: document.getElementById('trans-date').value,
        type: document.getElementById('trans-type').value,
        category: isExpense ? 'expense' : 'income'
    };

    if(id) {
        const idx = data.transactions.findIndex(x => x.id === id);
        if(idx > -1) data.transactions[idx] = { id, ...val };
    } else {
        data.transactions.push({ id: 't'+Date.now(), ...val });
    }
    saveData();
    document.getElementById('modal-transaction').style.display = 'none';
    renderFinance();
    renderDashboard(); // Update coûts
});

window.deleteTransaction = () => {
    if(confirm("Supprimer ?")) {
        data.transactions = data.transactions.filter(t => t.id !== document.getElementById('trans-id').value);
        saveData();
        document.getElementById('modal-transaction').style.display = 'none';
        renderFinance();
    }
};

// --- TASKS ---
function renderTasks() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    const sorted = [...data.tasks].sort((a,b) => {
        const da = getDays(a.lastDone), db = getDays(b.lastDone);
        return (da/a.freq) > (db/b.freq) ? -1 : 1;
    });

    sorted.forEach(t => {
        const days = getDays(t.lastDone);
        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `
            <div style="display:flex;align-items:center" onclick="openEditTaskModal('${t.id}')">
                <div class="task-check ${days < t.freq ? 'task-done' : ''}"></div>
                <div><b>${t.title}</b><br><small>Tous les ${t.freq}j</small></div>
            </div>
            <div style="text-align:right">
                <span class="task-tag" style="color:${days >= t.freq ? 'var(--danger)' : 'var(--success)'}">
                    ${days >= t.freq ? 'À faire' : 'OK'}
                </span>
                <br><small>${days}j</small>
            </div>
        `;
        // Action sur double tap ou bouton dédié, ici clic simple sur le bouton check invisible
        li.querySelector('.task-check').onclick = (e) => {
            e.stopPropagation();
            t.lastDone = new Date().toISOString();
            saveData();
            renderTasks();
        };
        list.appendChild(li);
    });
}
function getDays(d) { return Math.floor((new Date() - new Date(d))/(1000*60*60*24)); }

window.openEditTaskModal = (id=null) => {
    document.getElementById('form-task').reset();
    if(id) {
        const t = data.tasks.find(x => x.id === id);
        document.getElementById('task-id').value = t.id;
        document.getElementById('task-title').value = t.title;
        document.getElementById('task-freq').value = t.freq;
        document.getElementById('btn-delete-task').style.display = 'block';
    } else {
        document.getElementById('task-id').value = '';
        document.getElementById('btn-delete-task').style.display = 'none';
    }
    document.getElementById('modal-edit-task').style.display = 'flex';
};

document.getElementById('form-task').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const val = {
        title: document.getElementById('task-title').value,
        freq: parseInt(document.getElementById('task-freq').value)
    };
    if(id) {
        const idx = data.tasks.findIndex(t => t.id === id);
        if(idx > -1) { data.tasks[idx].title = val.title; data.tasks[idx].freq = val.freq; }
    } else {
        data.tasks.push({ id: 'tk'+Date.now(), ...val, lastDone: new Date().toISOString() });
    }
    saveData();
    document.getElementById('modal-edit-task').style.display = 'none';
    renderTasks();
};

window.deleteCurrentTask = () => {
    if(confirm("Supprimer ?")) {
        data.tasks = data.tasks.filter(t => t.id !== document.getElementById('task-id').value);
        saveData();
        document.getElementById('modal-edit-task').style.display = 'none';
        renderTasks();
    }
};

// --- DATA & SYNC ---
function saveData() {
    if(isDemoMode) localStorage.setItem('poupoules_v2', JSON.stringify(data));
    else if(currentUser) db.collection('users').doc(currentUser.uid).set(data);
}
function loadLocal() {
    const local = localStorage.getItem('poupoules_v2');
    if(local) data = JSON.parse(local);
    else data = DEMO_DATA;
    renderAll();
}
function loadFirebase() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if(doc.exists) { data = doc.data(); renderAll(); }
    });
}

// --- UTILS ---
function initChart() {
    const ctx = document.getElementById('eggsChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: '#ff9500', borderRadius: 4 }] },
        options: { plugins: { legend: { display:false } }, scales: { x: { grid: { display:false } }, y: { display:false } }, maintainAspectRatio: false }
    });
}
function updateChart(eggs) {
    const labels = currentStatsPeriod === 'month' 
        ? Array.from({length:31}, (_,i) => i+1) 
        : ['J','F','M','A','M','J','J','A','S','O','N','D'];
    
    const counts = new Array(labels.length).fill(0);
    eggs.forEach(e => {
        const d = new Date(e.date);
        const idx = currentStatsPeriod === 'month' ? d.getDate()-1 : d.getMonth();
        counts[idx]++;
    });
    
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = counts;
    chartInstance.update();
}
window.switchStatsPeriod = (p, btn) => {
    currentStatsPeriod = p;
    document.querySelectorAll('.mini-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
};

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

function renderSettings() {
    const div = document.getElementById('auth-section');
    if(currentUser) {
        div.innerHTML = `
            <div style="text-align:center">
                <img src="${currentUser.photoURL || 'icon.png'}" style="width:60px;border-radius:50%">
                <h3>${currentUser.displayName}</h3>
                <button class="btn-text-danger" onclick="auth.signOut()">Déconnexion</button>
            </div>
        `;
    } else {
        div.innerHTML = `
            <div style="text-align:center">
                <p>Mode Hors Ligne</p>
                <button class="btn-primary" onclick="login()">Sync Google</button>
            </div>
        `;
    }
}
window.login = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
window.exportData = () => {
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    a.download = "sauvegarde.json";
    a.click();
};
window.handleImport = (input) => {
    const fr = new FileReader();
    fr.onload = (e) => {
        if(confirm("Remplacer les données ?")) {
            data = JSON.parse(e.target.result);
            saveData();
            renderAll();
        }
    };
    if(input.files[0]) fr.readAsText(input.files[0]);
};
