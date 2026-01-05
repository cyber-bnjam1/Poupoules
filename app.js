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

// --- DONNÉES DE DÉMO ---
const DEMO_DATA = {
    chickens: [
        { id: 'c1', name: 'Huguette', breed: 'Rousse', date: '2023-05-10', price: 15, status: 'active', photo: 'icon.png' },
        { id: 'c2', name: 'Gertrude', breed: 'Sussex', date: '2022-08-15', price: 18, status: 'active', photo: 'icon.png' }
    ],
    eggs: [
        { id: 'e1', chickenId: 'c1', chickenName: 'Huguette', date: new Date().toISOString() }
    ],
    transactions: [
        { id: 't1', category: 'expense', type: 'graines', amount: 25.50, date: new Date().toISOString() }
    ],
    tasks: [
        { id: 'task1', title: "Changer l'eau", frequency: 2, lastDone: new Date(Date.now() - 86400000).toISOString() }, 
        { id: 'task2', title: 'Nettoyer le poulailler', frequency: 7, lastDone: new Date(Date.now() - 604800000 * 2).toISOString() }
    ]
};

// --- ETAT GLOBAL ---
let currentUser = null;
let isDemoMode = true;
let localChickens = [...DEMO_DATA.chickens];
let localEggs = [...DEMO_DATA.eggs];
let localTransactions = [...DEMO_DATA.transactions];
let localTasks = [...DEMO_DATA.tasks];

let currentStatsPeriod = 'month';
let eggsChartInstance = null;
let tempPhotoBase64 = null;

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Mode sombre
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }

    initEggsChart();
    fetchWeather();

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            isDemoMode = false;
            document.getElementById('auth-logged-in').style.display = 'flex';
            document.getElementById('auth-logged-out').style.display = 'none';
            document.getElementById('user-name').innerText = user.displayName || 'Éleveur';
            document.getElementById('user-email').innerText = user.email;
            document.getElementById('user-photo').src = user.photoURL || 'icon.png';
            document.getElementById('header-status').classList.replace('demo', 'connected');
            document.getElementById('header-status').innerHTML = '<i class="fas fa-wifi"></i> <span>Cloud</span>';
            loadFirebaseData();
        } else {
            currentUser = null;
            isDemoMode = true;
            document.getElementById('auth-logged-in').style.display = 'none';
            document.getElementById('auth-logged-out').style.display = 'flex';
            document.getElementById('header-status').classList.replace('connected', 'demo');
            document.getElementById('header-status').innerHTML = '<i class="fas fa-save"></i> <span>Démo</span>';
            loadLocalData();
            renderAll();
        }
    });

    document.querySelectorAll('.close-modal').forEach(x => {
        x.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
});

// --- NAVIGATION ---
window.toggleMenu = () => { document.getElementById('menu-overlay').classList.toggle('open'); };

window.navigate = (targetId) => {
    document.getElementById('menu-overlay').classList.remove('open');
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    const target = document.getElementById(targetId);
    if(target) target.classList.add('active-view');
    document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
    const link = Array.from(document.querySelectorAll('.menu-link')).find(l => l.getAttribute('onclick').includes(targetId));
    if(link) link.classList.add('active');
    document.getElementById('scroll-container').scrollTop = 0;
};

// --- RENDU GLOBAL ---
function renderAll() {
    renderChickensList();
    renderDashboard();
    renderFinance();
    renderMaintenance();
}

// 1. DASHBOARD & WIDGETS
function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let filteredEggs = [];
    if (currentStatsPeriod === 'month') {
        filteredEggs = localEggs.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
        document.getElementById('label-eggs-display').innerText = "Œufs (Mois)";
    } else {
        filteredEggs = localEggs.filter(e => new Date(e.date).getFullYear() === currentYear);
        document.getElementById('label-eggs-display').innerText = "Œufs (Année)";
    }

    document.getElementById('total-eggs-display').innerText = filteredEggs.length;
    
    const yearTransactions = localTransactions.filter(e => new Date(e.date).getFullYear() === currentYear && e.category === 'expense');
    const totalExpenses = yearTransactions.reduce((acc, curr) => acc + curr.amount, 0);
    const yearEggs = localEggs.filter(e => new Date(e.date).getFullYear() === currentYear).length;
    const cost = yearEggs > 0 ? (totalExpenses / yearEggs).toFixed(2) : "0.00";
    document.getElementById('cost-per-egg-display').innerText = cost + ' €';

    const todayStr = now.toISOString().split('T')[0];
    const eggsToday = localEggs.filter(e => e.date.startsWith(todayStr)).length;
    document.getElementById('eggs-today-count').innerText = eggsToday > 0 ? `${eggsToday} œuf(s)` : 'Rien';

    updateEggsChart(filteredEggs);

    const list = document.getElementById('recent-activity-list');
    list.innerHTML = '';
    const recentEggs = [...localEggs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    
    recentEggs.forEach(egg => {
        const li = document.createElement('li');
        const d = new Date(egg.date);
        const dateStr = `${d.getDate()}/${d.getMonth()+1}`;
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="background:var(--color-graines); width:8px; height:8px; border-radius:50%;"></div>
                <span style="font-weight:600;">${egg.chickenName}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:13px; color:var(--text-light);">${dateStr}</span>
                <button class="delete-icon-btn" onclick="deleteEgg('${egg.id}')"><i class="fas fa-times"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
}

window.deleteEgg = (eggId) => {
    if(confirm("Supprimer cet œuf ?")) {
        localEggs = localEggs.filter(e => e.id !== eggId);
        saveData();
        renderDashboard();
    }
};

window.openAddEggModal = () => {
    const modal = document.getElementById('modal-add-egg');
    const grid = document.getElementById('egg-chickens-list');
    grid.innerHTML = '';
    localChickens.filter(c => c.status === 'active').forEach(c => {
        const card = document.createElement('div');
        card.className = 'selection-card';
        card.innerHTML = `<img src="${c.photo || 'icon.png'}"><span>${c.name}</span>`;
        card.onclick = () => { addEgg(c); modal.style.display = 'none'; };
        grid.appendChild(card);
    });
    modal.style.display = 'flex';
};

function addEgg(chicken) {
    localEggs.push({ id: 'egg_' + Date.now(), chickenId: chicken.id, chickenName: chicken.name, date: new Date().toISOString() });
    saveData();
    renderDashboard();
}

// 2. ENTRETIEN
function renderMaintenance() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    const sortedTasks = [...localTasks].sort((a,b) => {
        const ratioA = getDaysDiff(a.lastDone) / a.frequency;
        const ratioB = getDaysDiff(b.lastDone) / b.frequency;
        return ratioB - ratioA;
    });

    let urgentCount = 0;
    sortedTasks.forEach(task => {
        const diff = getDaysDiff(task.lastDone);
        const freq = task.frequency;
        let statusHtml = '';
        let isUrgent = false;

        if (diff >= freq) {
            statusHtml = `<span class="task-badge task-badge-urgent">Fait il y a ${diff}j</span>`;
            isUrgent = true;
            urgentCount++;
        } else if (diff >= freq * 0.8) {
            statusHtml = `<span class="task-badge" style="background:rgba(255,159,10,0.15); color:var(--warning)">Bientôt</span>`;
        } else {
            statusHtml = `<span class="task-badge task-badge-ok">OK (${diff}j)</span>`;
        }

        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `
            <div class="task-left" onclick="openEditTaskModal('${task.id}')">
                <div class="task-checkbox" style="${isUrgent ? '' : 'border-color:var(--success); color:transparent;'}">!</div>
                <div><h4 style="margin:0;">${task.title}</h4><small style="color:var(--text-light)">Tous les ${freq}j</small></div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                ${statusHtml}
                <button class="glass-btn-round" style="width:30px; height:30px; font-size:12px;" onclick="completeTask('${task.id}')"><i class="fas fa-check"></i></button>
            </div>
        `;
        list.appendChild(li);
    });

    const badge = document.getElementById('maintenance-badge');
    if (urgentCount > 0) {
        badge.className = 'header-badge maintenance-badge urgent';
        badge.innerHTML = `<i class="fas fa-broom"></i> <span>${urgentCount} à faire</span>`;
    } else {
        badge.className = 'header-badge maintenance-badge clean';
        badge.innerHTML = `<i class="fas fa-sparkles"></i> <span>Propre</span>`;
    }
}

window.completeTask = (id) => {
    const task = localTasks.find(t => t.id === id);
    if(task) { task.lastDone = new Date().toISOString(); saveData(); renderMaintenance(); }
};

// 3. POULES (Gestion)
function renderChickensList() {
    const grid = document.getElementById('chickens-grid');
    grid.innerHTML = '';
    const filter = document.querySelector('#btn-filter-active').classList.contains('active') ? 'active' : 'archived';

    // Sécurité anti-crash si status est undefined
    localChickens.filter(c => (c.status || 'active') === filter).forEach(c => {
        const div = document.createElement('div');
        div.className = 'chicken-card';
        div.innerHTML = `
            <button class="edit-chicken-btn" onclick="openChickenModal('${c.id}')"><i class="fas fa-pen"></i></button>
            <img class="chicken-photo" src="${c.photo || 'icon.png'}">
            <div class="chicken-name">${c.name}</div>
            <div class="chicken-breed">${c.breed || 'Inconnue'}</div>
        `;
        grid.appendChild(div);
    });
}

window.filterChickens = (status, btn) => {
    document.querySelectorAll('#view-chickens .segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChickensList();
};

window.openChickenModal = (chickenId = null) => {
    const modal = document.getElementById('modal-chicken');
    const form = document.getElementById('form-chicken');
    const deleteBtn = document.getElementById('btn-delete-chicken');
    form.reset();
    document.getElementById('preview-photo').src = 'icon.png';
    tempPhotoBase64 = null;

    if (chickenId) {
        const c = localChickens.find(x => x.id === chickenId);
        if (c) {
            document.getElementById('modal-chicken-title').innerText = "Modifier Poule";
            document.getElementById('chicken-id').value = c.id;
            document.getElementById('chicken-name').value = c.name;
            document.getElementById('chicken-breed').value = c.breed || '';
            document.getElementById('chicken-date').value = c.date;
            document.getElementById('chicken-price').value = c.price || 0;
            if(c.photo) document.getElementById('preview-photo').src = c.photo;
            deleteBtn.style.display = 'block'; // Afficher bouton supprimer
        }
    } else {
        document.getElementById('modal-chicken-title').innerText = "Nouvelle Poule";
        document.getElementById('chicken-id').value = "";
        document.getElementById('chicken-date').valueAsDate = new Date();
        deleteBtn.style.display = 'none'; // Masquer bouton supprimer
    }
    modal.style.display = 'flex';
};

// --- NOUVEAU: Suppression de poule ---
window.deleteChicken = () => {
    const id = document.getElementById('chicken-id').value;
    if(confirm("Êtes-vous sûr de vouloir supprimer cette poule ?")) {
        localChickens = localChickens.filter(c => c.id !== id);
        saveData();
        document.getElementById('modal-chicken').style.display = 'none';
        renderChickensList();
    }
};

document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('chicken-id').value;
    const name = document.getElementById('chicken-name').value;
    const breed = document.getElementById('chicken-breed').value;
    const date = document.getElementById('chicken-date').value;
    const price = parseFloat(document.getElementById('chicken-price').value) || 0;
    const photo = tempPhotoBase64 || document.getElementById('preview-photo').getAttribute('src');

    if (id) {
        const idx = localChickens.findIndex(c => c.id === id);
        if (idx > -1) {
            localChickens[idx] = { ...localChickens[idx], name, breed, date, price, photo };
        }
    } else {
        localChickens.push({ id: 'c' + Date.now(), name, breed, date, price, photo, status: 'active' });
    }
    saveData();
    document.getElementById('modal-chicken').style.display = 'none';
    renderChickensList();
});

// 4. BUDGET
function renderFinance() {
    const list = document.getElementById('finance-list');
    list.innerHTML = '';
    const sorted = [...localTransactions].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(t => {
        const li = document.createElement('li');
        li.onclick = () => openTransactionModal(t.id);
        const color = t.category === 'income' ? 'var(--success)' : 'var(--text-dark)';
        const sign = t.category === 'income' ? '+' : '-';
        li.innerHTML = `
            <div><span style="font-weight:600; display:block;">${formatType(t.type)}</span><small style="color:var(--text-light)">${t.date.split('T')[0]}</small></div>
            <div style="font-weight:bold; color:${color};">${sign}${t.amount.toFixed(2)}€</div>
        `;
        list.appendChild(li);
    });
}

window.openTransactionModal = (transId = null) => {
    const modal = document.getElementById('modal-transaction');
    document.getElementById('form-transaction').reset();
    const deleteBtn = document.getElementById('btn-delete-trans');
    
    if (transId) {
        const t = localTransactions.find(x => x.id === transId);
        document.getElementById('modal-transaction-title').innerText = "Modifier Transaction";
        document.getElementById('trans-id').value = t.id;
        document.getElementById('trans-amount').value = t.amount;
        document.getElementById('trans-date').value = t.date.split('T')[0];
        document.getElementById('trans-type').value = t.type;
        setTransactionType(t.category);
        deleteBtn.style.display = 'block';
    } else {
        document.getElementById('modal-transaction-title').innerText = "Nouvelle Transaction";
        document.getElementById('trans-id').value = "";
        document.getElementById('trans-date').valueAsDate = new Date();
        setTransactionType('expense');
        deleteBtn.style.display = 'none';
    }
    modal.style.display = 'flex';
};

document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('trans-id').value;
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const date = document.getElementById('trans-date').value;
    const type = document.getElementById('trans-type').value;
    const category = document.getElementById('btn-expense').classList.contains('active') ? 'expense' : 'income';

    if(id) {
        const idx = localTransactions.findIndex(t => t.id === id);
        if(idx > -1) localTransactions[idx] = { id, amount, date, type, category };
    } else {
        localTransactions.push({ id: 't'+Date.now(), amount, date, type, category });
    }
    saveData();
    document.getElementById('modal-transaction').style.display = 'none';
    renderFinance();
});

window.deleteTransaction = () => {
    const id = document.getElementById('trans-id').value;
    if(confirm("Supprimer ?")) {
        localTransactions = localTransactions.filter(t => t.id !== id);
        saveData();
        document.getElementById('modal-transaction').style.display = 'none';
        renderFinance();
    }
};

window.setTransactionType = (type) => {
    document.querySelectorAll('#modal-transaction .segment-btn').forEach(b => b.classList.remove('active'));
    if(type === 'expense') {
        document.getElementById('btn-expense').classList.add('active');
        document.getElementById('group-type').style.display = 'block';
    } else {
        document.getElementById('btn-income').classList.add('active');
        document.getElementById('group-type').style.display = 'none';
    }
};

function formatType(t) {
    const map = { 'graines': 'Graines', 'paille': 'Paille', 'soins': 'Vétérinaire', 'materiel': 'Matériel', 'achat_poule': 'Achat Poule' };
    return map[t] || 'Autre';
}

// 5. UTILS & SANITIZATION
// Fonction pour nettoyer les vieilles données et éviter les bugs
function sanitizeChickens(list) {
    if(!Array.isArray(list)) return [];
    return list.map(c => ({
        id: c.id || 'c_' + Math.random().toString(36).substr(2, 9),
        name: c.name || 'Sans nom',
        breed: c.breed || '',
        date: c.date || new Date().toISOString().split('T')[0],
        price: c.price || 0,
        status: c.status || 'active', // Important pour l'affichage
        photo: c.photo || c.photoUrl || 'icon.png' // Rétro-compatibilité
    }));
}

window.openEditTaskModal = (taskId = null) => {
    const modal = document.getElementById('modal-edit-task');
    const deleteBtn = document.getElementById('btn-delete-task');
    document.getElementById('form-task').reset();
    
    if(taskId) {
        const t = localTasks.find(x => x.id === taskId);
        document.getElementById('task-id').value = t.id;
        document.getElementById('task-title').value = t.title;
        document.getElementById('task-freq').value = t.frequency;
        deleteBtn.style.display = 'block';
    } else {
        document.getElementById('task-id').value = "";
        deleteBtn.style.display = 'none';
    }
    modal.style.display = 'flex';
};

document.getElementById('form-task').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value;
    const freq = parseInt(document.getElementById('task-freq').value);

    if(id) {
        const idx = localTasks.findIndex(t => t.id === id);
        if(idx > -1) { localTasks[idx].title = title; localTasks[idx].frequency = freq; }
    } else {
        localTasks.push({ id: 'task_'+Date.now(), title: title, frequency: freq, lastDone: new Date(Date.now() - (freq * 86400000 * 2)).toISOString() });
    }
    saveData();
    document.getElementById('modal-edit-task').style.display = 'none';
    renderMaintenance();
});

window.deleteCurrentTask = () => {
    const id = document.getElementById('task-id').value;
    if(confirm("Supprimer cette tâche ?")) {
        localTasks = localTasks.filter(t => t.id !== id);
        saveData();
        document.getElementById('modal-edit-task').style.display = 'none';
        renderMaintenance();
    }
};

function getDaysDiff(dateStr) {
    if(!dateStr) return 999;
    const past = new Date(dateStr);
    const now = new Date();
    return Math.floor(Math.abs(now - past) / (1000 * 60 * 60 * 24)); 
}

window.handlePhotoUpload = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('preview-photo').src = e.target.result;
            tempPhotoBase64 = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

function fetchWeather() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
                .then(response => response.json())
                .then(data => {
                    const temp = Math.round(data.current_weather.temperature);
                    const w = document.getElementById('weather-widget');
                    w.querySelector('span').innerText = `${temp}°C`;
                    w.style.display = 'flex';
                }).catch(() => {});
        }, () => {});
    }
}

// 6. DATA & CHART
function initEggsChart() {
    const ctx = document.getElementById('eggsChart').getContext('2d');
    eggsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#ffcc00', borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
        }
    });
}

function updateEggsChart(data) {
    const labels = [];
    const values = [];
    if(currentStatsPeriod === 'month') {
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
        for(let i=1; i<=daysInMonth; i++) labels.push(i);
        const counts = new Array(daysInMonth).fill(0);
        data.forEach(e => { const d = new Date(e.date).getDate(); counts[d-1]++; });
        values.push(...counts);
    } else {
        const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
        labels.push(...months);
        const counts = new Array(12).fill(0);
        data.forEach(e => { const m = new Date(e.date).getMonth(); counts[m]++; });
        values.push(...counts);
    }
    eggsChartInstance.data.labels = labels;
    eggsChartInstance.data.datasets[0].data = values;
    eggsChartInstance.update();
}

window.switchStatsPeriod = (period, btn) => {
    currentStatsPeriod = period;
    document.querySelectorAll('#view-dashboard .segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
};

function saveData() {
    if(isDemoMode) {
        localStorage.setItem('poupoules_data', JSON.stringify({
            chickens: localChickens,
            eggs: localEggs,
            transactions: localTransactions,
            tasks: localTasks
        }));
    } else if (currentUser) {
        db.collection('users').doc(currentUser.uid).set({
            chickens: localChickens,
            eggs: localEggs,
            transactions: localTransactions,
            tasks: localTasks
        });
    }
}

function loadLocalData() {
    const data = localStorage.getItem('poupoules_data');
    if(data) {
        const parsed = JSON.parse(data);
        localChickens = sanitizeChickens(parsed.chickens);
        localEggs = parsed.eggs || [];
        localTransactions = parsed.transactions || [];
        localTasks = parsed.tasks || [];
    }
}

function loadFirebaseData() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            localChickens = sanitizeChickens(data.chickens);
            localEggs = data.eggs || [];
            localTransactions = data.transactions || [];
            localTasks = data.tasks || [];
            renderAll();
        }
    });
}

window.login = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert(e.message));
};
window.logout = () => auth.signOut();
window.exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({chickens: localChickens, eggs: localEggs, transactions: localTransactions}, null, 2));
    const a = document.createElement('a');
    a.href = dataStr; a.download = "poupoules_backup.json"; a.click();
};
