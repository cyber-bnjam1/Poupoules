// ==========================================
// CONFIGURATION & INIT
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDpVKRam-7sldEss93zRTh8At3pEtJ0SqA",
    authDomain: "poulettes-75fb5.firebaseapp.com",
    projectId: "poulettes-75fb5",
    storageBucket: "poulettes-75fb5.firebasestorage.app",
    messagingSenderId: "479553710488",
    appId: "1:479553710488:web:8cb5ec0285f330c51e23ed"
};
// Initialisation sécurisée
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Données par défaut (pour ne jamais avoir de page vide au premier lancement)
const DEMO_DATA = {
    chickens: [
        { id: 'c1', name: 'Huguette', breed: 'Rousse', date: '2023-05-10', price: 15, status: 'active', health: 'healthy', photo: 'icon.png' },
        { id: 'c2', name: 'Gertrude', breed: 'Sussex', date: '2022-08-15', price: 18, status: 'active', health: 'healthy', photo: 'icon.png' }
    ],
    eggs: [
        { id: 'e1', chickenId: 'c1', chickenName: 'Huguette', date: new Date().toISOString() }
    ],
    transactions: [
        { id: 't1', category: 'expense', type: 'graines', amount: 25.50, date: new Date().toISOString() }
    ],
    tasks: [
        { id: 'task1', title: "Changer l'eau", frequency: 1, lastDone: new Date().toISOString() }, 
        { id: 'task2', title: 'Nettoyage complet', frequency: 7, lastDone: new Date(Date.now() - 604800000 * 2).toISOString() }
    ]
};

// --- ETAT GLOBAL ---
let currentUser = null;
let isDemoMode = true;
let localChickens = [];
let localEggs = [];
let localTransactions = [];
let localTasks = [];
let currentStatsPeriod = 'month';
let eggsChartInstance = null;
let tempPhotoBase64 = null;
let currentViewId = 'view-dashboard';

// ==========================================
// AU CHARGEMENT DE LA PAGE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Appliquer le thème
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }

    // 2. Initialiser le graphique
    initEggsChart();

    // 3. Récupérer Météo
    fetchWeather();

    // 4. Initialiser le FAB
    updateFabVisibility('view-dashboard');

    // 5. Gérer l'Authentification
    auth.onAuthStateChanged(async user => {
        if (user) {
            // MODE CONNECTÉ
            currentUser = user;
            isDemoMode = false;
            updateAuthUI(true, user);
            await loadFirebaseData();
        } else {
            // MODE DÉMO (LOCAL)
            currentUser = null;
            isDemoMode = true;
            updateAuthUI(false);
            loadLocalData();
        }
    });

    // 6. Gestionnaires Fermeture Modales
    document.querySelectorAll('.close-modal').forEach(x => {
        x.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
});

function updateAuthUI(isLoggedIn, user = null) {
    if(isLoggedIn) {
        document.getElementById('auth-logged-in').style.display = 'block';
        document.getElementById('auth-logged-out').style.display = 'none';
        document.getElementById('user-name').innerText = user.displayName || 'Éleveur';
        document.getElementById('user-email').innerText = user.email;
        if(user.photoURL) document.getElementById('user-photo').src = user.photoURL;
        document.getElementById('header-status').classList.replace('demo', 'connected');
        document.getElementById('header-status').innerHTML = '<i class="fas fa-wifi"></i> <span>En ligne</span>';
    } else {
        document.getElementById('auth-logged-in').style.display = 'none';
        document.getElementById('auth-logged-out').style.display = 'block';
        document.getElementById('header-status').classList.replace('connected', 'demo');
        document.getElementById('header-status').innerHTML = '<i class="fas fa-save"></i> <span>Démo</span>';
    }
}

// ==========================================
// NAVIGATION & FAB
// ==========================================
window.toggleMenu = () => { document.getElementById('menu-overlay').classList.toggle('open'); };

window.navigate = (targetId) => {
    document.getElementById('menu-overlay').classList.remove('open');
    
    // Animation de transition
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    const target = document.getElementById(targetId);
    if(target) target.classList.add('active-view');
    
    // Mise à jour Menu
    document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
    const link = Array.from(document.querySelectorAll('.menu-link')).find(l => l.getAttribute('onclick').includes(targetId));
    if(link) link.classList.add('active');
    
    // Scroll en haut
    document.getElementById('scroll-container').scrollTop = 0;
    
    currentViewId = targetId;
    updateFabVisibility(targetId);
};

// Gestion du Bouton Flottant (Indispensable)
function updateFabVisibility(viewId) {
    const fab = document.getElementById('main-fab');
    fab.className = 'fab-btn'; // Reset
    
    if (viewId === 'view-dashboard') {
        fab.classList.add('hidden'); // On cache sur le dashboard car il y a déjà des boutons rapides
    } else if (viewId === 'view-chickens' || viewId === 'view-finance' || viewId === 'view-maintenance') {
        fab.classList.remove('hidden');
    } else {
        fab.classList.add('hidden');
    }
}

window.handleFabClick = () => {
    if (currentViewId === 'view-chickens') openChickenModal();
    else if (currentViewId === 'view-finance') openTransactionModal();
    else if (currentViewId === 'view-maintenance') openEditTaskModal();
};

// ==========================================
// 1. GESTION DES POULES (AVEC ÂGE & SANTÉ)
// ==========================================
function renderChickensList() {
    const grid = document.getElementById('chickens-grid');
    grid.innerHTML = '';
    const filter = document.querySelector('#btn-filter-active').classList.contains('active') ? 'active' : 'archived';

    const list = localChickens.filter(c => (c.status || 'active') === filter);
    
    if(list.length === 0) {
        grid.innerHTML = `<p style="text-align:center; width:100%; grid-column:1/-1; color:var(--text-grey);">Aucune poule pour le moment.</p>`;
        return;
    }

    list.forEach(c => {
        // CALCUL DE L'ÂGE
        const ageString = getAgeString(c.date);
        
        // ICÔNE SANTÉ
        const healthIcons = {
            'healthy': '<i class="fas fa-heart" style="color:var(--success)"></i>',
            'sick': '<i class="fas fa-first-aid" style="color:var(--danger)"></i>',
            'molting': '<i class="fas fa-feather" style="color:var(--warning)"></i>',
            'broody': '<i class="fas fa-egg" style="color:var(--purple)"></i>'
        };
        const statusIcon = healthIcons[c.health || 'healthy'];

        const div = document.createElement('div');
        div.className = 'chicken-card';
        div.innerHTML = `
            <div class="chicken-badge">${statusIcon}</div>
            <button class="chicken-edit-btn" onclick="openChickenModal('${c.id}')"><i class="fas fa-ellipsis-h"></i></button>
            <img class="chicken-photo" src="${c.photo || 'icon.png'}">
            <div class="chicken-name">${c.name}</div>
            <div class="chicken-breed">${c.breed || 'Poule'}</div>
            <div class="chicken-age">${ageString}</div>
        `;
        grid.appendChild(div);
    });
}

// Fonction de calcul d'âge précise
function getAgeString(dateStr) {
    if(!dateStr) return "Âge inconnu";
    const birth = new Date(dateStr);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    
    if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
        years--;
        months += 12;
    }
    
    if(years > 0) return `${years} an${years>1?'s':''} ${months} mois`;
    if(months > 0) return `${months} mois`;
    return "Poussin";
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
        // EDIT
        const c = localChickens.find(x => x.id === chickenId);
        if (c) {
            document.getElementById('modal-chicken-title').innerText = "Modifier " + c.name;
            document.getElementById('chicken-id').value = c.id;
            document.getElementById('chicken-name').value = c.name;
            document.getElementById('chicken-breed').value = c.breed || '';
            document.getElementById('chicken-date').value = c.date;
            document.getElementById('chicken-health').value = c.health || 'healthy';
            document.getElementById('chicken-price').value = c.price || 0;
            if(c.photo) document.getElementById('preview-photo').src = c.photo;
            deleteBtn.style.display = 'block';
        }
    } else {
        // NEW
        document.getElementById('modal-chicken-title').innerText = "Nouvelle Poule";
        document.getElementById('chicken-id').value = "";
        document.getElementById('chicken-date').valueAsDate = new Date();
        document.getElementById('chicken-health').value = 'healthy';
        deleteBtn.style.display = 'none';
    }
    modal.style.display = 'flex';
};

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
    const health = document.getElementById('chicken-health').value;
    const price = parseFloat(document.getElementById('chicken-price').value) || 0;
    const photo = tempPhotoBase64 || document.getElementById('preview-photo').getAttribute('src');

    if (id) {
        const idx = localChickens.findIndex(c => c.id === id);
        if (idx > -1) { 
            localChickens[idx] = { ...localChickens[idx], name, breed, date, price, health, photo }; 
        }
    } else {
        localChickens.push({ 
            id: 'c' + Date.now(), 
            name, breed, date, price, health, photo, status: 'active' 
        });
    }
    saveData();
    document.getElementById('modal-chicken').style.display = 'none';
    renderChickensList();
});

// ==========================================
// 2. DASHBOARD & OEUFS
// ==========================================
function renderDashboard() {
    const now = new Date();
    
    // Filtres
    let filteredEggs = [];
    if (currentStatsPeriod === 'month') {
        filteredEggs = localEggs.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    } else {
        filteredEggs = localEggs.filter(e => new Date(e.date).getFullYear() === now.getFullYear());
    }

    document.getElementById('total-eggs-display').innerText = filteredEggs.length;

    // Calcul coût
    const yearTransactions = localTransactions.filter(e => new Date(e.date).getFullYear() === now.getFullYear() && e.category === 'expense');
    const totalExpenses = yearTransactions.reduce((acc, curr) => acc + curr.amount, 0);
    const yearEggs = localEggs.filter(e => new Date(e.date).getFullYear() === now.getFullYear()).length;
    const cost = yearEggs > 0 ? (totalExpenses / yearEggs).toFixed(2) : "0.00";
    document.getElementById('cost-per-egg-display').innerText = cost + ' €';

    // Compteur jour
    const todayStr = now.toISOString().split('T')[0];
    const eggsToday = localEggs.filter(e => e.date.startsWith(todayStr)).length;
    document.getElementById('eggs-today-count').innerText = `${eggsToday} œuf${eggsToday>1?'s':''}`;

    updateEggsChart(filteredEggs);

    // Activité
    const list = document.getElementById('recent-activity-list');
    list.innerHTML = '';
    const recentEggs = [...localEggs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    
    recentEggs.forEach(egg => {
        const li = document.createElement('li');
        const d = new Date(egg.date);
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="background:var(--warning); width:10px; height:10px; border-radius:50%;"></div>
                <span style="font-weight:600;">${egg.chickenName}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:13px; color:var(--text-grey);">${d.toLocaleDateString('fr-FR')}</span>
                <button class="btn-text-danger" onclick="deleteEgg('${egg.id}')"><i class="fas fa-trash"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
}

window.openAddEggModal = () => {
    const modal = document.getElementById('modal-add-egg');
    const grid = document.getElementById('egg-chickens-list');
    grid.innerHTML = '';
    
    // Seulement les poules actives
    const actives = localChickens.filter(c => c.status === 'active');
    
    if(actives.length === 0) {
        grid.innerHTML = '<p>Ajoutez d\'abord des poules !</p>';
    }

    actives.forEach(c => {
        const card = document.createElement('div');
        card.className = 'selection-card';
        card.innerHTML = `<img src="${c.photo || 'icon.png'}"><span>${c.name}</span>`;
        card.onclick = () => {
            localEggs.push({ 
                id: 'egg_' + Date.now(), 
                chickenId: c.id, 
                chickenName: c.name, 
                date: new Date().toISOString() 
            });
            saveData();
            renderDashboard();
            modal.style.display = 'none';
        };
        grid.appendChild(card);
    });
    modal.style.display = 'flex';
};

window.deleteEgg = (id) => {
    if(confirm('Supprimer cet œuf ?')) {
        localEggs = localEggs.filter(e => e.id !== id);
        saveData();
        renderDashboard();
    }
};

// ==========================================
// 3. FINANCE & BUDGET
// ==========================================
function renderFinance() {
    const list = document.getElementById('finance-list');
    list.innerHTML = '';
    const sorted = [...localTransactions].sort((a,b) => new Date(b.date) - new Date(a.date));

    // Calcul Bilan
    let income = 0;
    let expense = 0;
    sorted.forEach(t => {
        if(t.category === 'income') income += t.amount;
        else expense += t.amount;
    });
    const total = income - expense;
    const balanceEl = document.getElementById('balance-total');
    balanceEl.innerText = (total >= 0 ? '+' : '') + total.toFixed(2) + ' €';
    balanceEl.style.color = total >= 0 ? 'var(--success)' : 'var(--danger)';

    // Barre proportion
    const totalVol = income + expense;
    const bar = document.getElementById('finance-bar');
    if (totalVol > 0) {
        const pct = (income / totalVol) * 100;
        bar.style.background = `linear-gradient(90deg, var(--success) ${pct}%, var(--danger) ${pct}%)`;
    }

    sorted.forEach(t => {
        const li = document.createElement('li');
        li.onclick = () => openTransactionModal(t.id);
        const isInc = t.category === 'income';
        li.innerHTML = `
            <div>
                <span style="font-weight:700; display:block;">${formatType(t.type)}</span>
                <small style="color:var(--text-grey)">${new Date(t.date).toLocaleDateString()}</small>
            </div>
            <div style="font-weight:bold; color:${isInc ? 'var(--success)' : 'var(--text-dark)'};">
                ${isInc ? '+' : '-'}${t.amount.toFixed(2)}€
            </div>
        `;
        list.appendChild(li);
    });
}

// Fonction utilitaire pour nommage propre
function formatType(t) {
    const map = { 
        'graines': 'Alimentation', 'paille': 'Litière', 'soins': 'Vétérinaire', 
        'materiel': 'Matériel', 'achat_poule': 'Achat Poule', 'vente_oeufs': 'Vente Œufs' 
    };
    return map[t] || 'Autre';
}

window.openTransactionModal = (transId = null) => {
    const modal = document.getElementById('modal-transaction');
    document.getElementById('form-transaction').reset();
    const deleteBtn = document.getElementById('btn-delete-trans');
    
    if (transId) {
        const t = localTransactions.find(x => x.id === transId);
        document.getElementById('modal-transaction-title').innerText = "Modifier";
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

window.setTransactionType = (type) => {
    document.querySelectorAll('#modal-transaction .segment-btn').forEach(b => b.classList.remove('active'));
    if(type === 'expense') {
        document.getElementById('btn-expense').classList.add('active');
        document.getElementById('group-type').style.display = 'block';
    } else {
        document.getElementById('btn-income').classList.add('active');
        // On pourrait cacher le type, mais laissons le pour la catégorie 'Vente oeufs'
    }
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
    if(confirm("Supprimer ?")) {
        const id = document.getElementById('trans-id').value;
        localTransactions = localTransactions.filter(t => t.id !== id);
        saveData();
        document.getElementById('modal-transaction').style.display = 'none';
        renderFinance();
    }
};

// ==========================================
// 4. ENTRETIEN & TÂCHES
// ==========================================
function renderMaintenance() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    
    // Tri par urgence
    const sortedTasks = [...localTasks].sort((a,b) => {
        const ratioA = getDaysDiff(a.lastDone) / a.frequency;
        const ratioB = getDaysDiff(b.lastDone) / b.frequency;
        return ratioB - ratioA;
    });

    let urgentCount = 0;

    sortedTasks.forEach(task => {
        const diff = getDaysDiff(task.lastDone);
        const freq = task.frequency;
        
        let tagClass = 'tag-ok';
        let tagText = 'OK';
        
        if (diff >= freq) {
            tagClass = 'tag-urgent';
            tagText = `Fait il y a ${diff}j`;
            urgentCount++;
        } else if (diff >= freq * 0.8) {
            tagClass = 'tag-soon';
            tagText = 'Bientôt';
        }

        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `
            <div style="display:flex; align-items:center;" onclick="openEditTaskModal('${task.id}')">
                <div class="task-check ${diff < freq ? 'done' : ''}"></div>
                <div class="task-content">
                    <h4>${task.title}</h4>
                    <small style="color:var(--text-grey)">Tous les ${freq} jours</small>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                <span class="task-tag ${tagClass}">${tagText}</span>
                <button class="btn-primary" style="padding:5px 10px; font-size:12px;" onclick="completeTask('${task.id}')">Fait</button>
            </div>
        `;
        list.appendChild(li);
    });

    // Badge Header
    const badge = document.getElementById('maintenance-badge');
    if (urgentCount > 0) {
        badge.innerHTML = `<i class="fas fa-exclamation-circle" style="color:var(--danger)"></i> <span style="color:var(--danger)">${urgentCount} à faire</span>`;
    } else {
        badge.innerHTML = `<i class="fas fa-check-circle" style="color:var(--success)"></i> <span style="color:var(--success)">Tout propre</span>`;
    }
}

window.completeTask = (id) => {
    const task = localTasks.find(t => t.id === id);
    if(task) {
        task.lastDone = new Date().toISOString();
        // Animation confetti simple ? Non, restons pro.
        saveData();
        renderMaintenance();
    }
};

// ... (Modal logic similar to others) ...
window.openEditTaskModal = (taskId = null) => {
    const modal = document.getElementById('modal-edit-task');
    document.getElementById('form-task').reset();
    const deleteBtn = document.getElementById('btn-delete-task');
    
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
        localTasks.push({ id: 'task_'+Date.now(), title, frequency: freq, lastDone: new Date().toISOString() });
    }
    saveData();
    document.getElementById('modal-edit-task').style.display = 'none';
    renderMaintenance();
});

window.deleteCurrentTask = () => {
    if(confirm("Supprimer ?")) {
        const id = document.getElementById('task-id').value;
        localTasks = localTasks.filter(t => t.id !== id);
        saveData();
        document.getElementById('modal-edit-task').style.display = 'none';
        renderMaintenance();
    }
};

// ==========================================
// OUTILS TECHNIQUES
// ==========================================

function getDaysDiff(dateStr) {
    if(!dateStr) return 999;
    const past = new Date(dateStr);
    const now = new Date();
    return Math.floor((now - past) / (1000 * 60 * 60 * 24)); 
}

// Upload Photo
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

// Mode Sombre
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

// Météo
function fetchWeather() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
                .then(r => r.json())
                .then(d => {
                    const temp = Math.round(d.current_weather.temperature);
                    const w = document.getElementById('weather-widget');
                    w.querySelector('span').innerText = `${temp}°C`;
                    w.style.display = 'flex';
                }).catch(console.error);
        }, console.error);
    }
}

// Stats Chart
function initEggsChart() {
    const ctx = document.getElementById('eggsChart').getContext('2d');
    eggsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#ff9500', borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { display:false } }, x: { grid: { display:false } } }
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
        const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
        labels.push(...months);
        const counts = new Array(12).fill(0);
        data.forEach(e => { const m = new Date(e.date).getMonth(); counts[m]++; });
        values.push(...counts);
    }
    eggsChartInstance.data.labels = labels;
    eggsChartInstance.data.datasets[0].data = values;
    eggsChartInstance.update();
}
window.switchStatsPeriod = (p, btn) => {
    currentStatsPeriod = p;
    document.querySelectorAll('.mini-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
};

// ==========================================
// PERSISTANCE DES DONNÉES (CORRIGÉE)
// ==========================================

// Nettoyage des données pour éviter les bugs si ancien format
function sanitizeData(list, type) {
    if(!Array.isArray(list)) return [];
    if(type === 'chickens') {
        return list.map(c => ({
            id: c.id || 'c_'+Math.random(),
            name: c.name || 'Poule',
            breed: c.breed || '',
            date: c.date || new Date().toISOString().split('T')[0],
            health: c.health || 'healthy',
            photo: c.photo || 'icon.png',
            status: c.status || 'active',
            price: c.price || 0
        }));
    }
    return list;
}

// Fonction utilitaire pour merger les données (priorité au plus récent)
function mergeData(localData, firebaseData) {
    if (!firebaseData || Object.keys(firebaseData).length === 0) return localData;
    if (!localData || Object.keys(localData).length === 0) return firebaseData;
    
    // Stratégie : comparer par nombre d'items et dates
    const localCount = (localData.eggs?.length || 0) + (localData.chickens?.length || 0);
    const fbCount = (firebaseData.eggs?.length || 0) + (firebaseData.chickens?.length || 0);
    
    // Si local a plus de données, c'est probablement plus récent
    return localCount >= fbCount ? localData : firebaseData;
}

async function loadFirebaseData() {
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        
        let dataToLoad = null;
        let shouldMigrateLocalData = false;
        
        if(doc.exists) {
            const firebaseData = doc.data();
            
            // Récupérer aussi les données locales (peuvent contenir des données récentes)
            const localRaw = localStorage.getItem('poupoules_data');
            let localData = null;
            
            if(localRaw) {
                try {
                    localData = JSON.parse(localRaw);
                } catch(e) { console.error("Erreur parsing local", e); }
            }
            
            // MERGE intelligent : si local a des données que Firestore n'a pas (migration)
            if(localData && localData.eggs && localData.eggs.length > 0) {
                if(!firebaseData.eggs || firebaseData.eggs.length === 0) {
                    // Migration : local a des données, Firestore est vide
                    console.log("Migration des données locales vers Firebase...");
                    dataToLoad = localData;
                    shouldMigrateLocalData = true;
                } else {
                    // Les deux ont des données, prendre le plus complet
                    dataToLoad = mergeData(localData, firebaseData);
                }
            } else {
                dataToLoad = firebaseData;
            }
            
        } else {
            // Document n'existe pas encore - migration depuis local ou init démo
            console.log("Première connexion Firebase - création du profil...");
            const localRaw = localStorage.getItem('poupoules_data');
            
            if(localRaw) {
                try {
                    const localData = JSON.parse(localRaw);
                    // Vérifier si ce ne sont pas juste les données démo par défaut
                    const isDemoData = localData.chickens?.length === DEMO_DATA.chickens.length &&
                                     localData.chickens[0]?.id === 'c1';
                    
                    if(!isDemoData || localData.eggs?.length > DEMO_DATA.eggs.length) {
                        // Vraies données utilisateur stockées localement
                        dataToLoad = localData;
                        shouldMigrateLocalData = true;
                    } else {
                        // Juste les données démo, on peut partir de zéro
                        dataToLoad = DEMO_DATA;
                    }
                } catch(e) {
                    dataToLoad = DEMO_DATA;
                }
            } else {
                dataToLoad = DEMO_DATA;
            }
        }
        
        // Appliquer les données
        localChickens = sanitizeData(dataToLoad.chickens, 'chickens');
        localEggs = dataToLoad.eggs || [];
        localTransactions = dataToLoad.transactions || [];
        localTasks = dataToLoad.tasks || [];
        
        renderAll();
        
        // Si migration nécessaire, sauvegarder immédiatement dans Firestore
        if(shouldMigrateLocalData) {
            console.log("Sauvegarde des données migrées dans Firestore...");
            await saveData();
        }
        
    } catch(error) {
        console.error("Erreur chargement Firebase:", error);
        // Fallback sur localStorage en cas d'erreur
        loadLocalData();
        alert("Erreur de connexion à Firebase. Mode hors ligne activé temporairement.");
    }
}

function loadLocalData() {
    const raw = localStorage.getItem('poupoules_data');
    if(raw) {
        try {
            const d = JSON.parse(raw);
            localChickens = sanitizeData(d.chickens, 'chickens');
            localEggs = d.eggs || [];
            localTransactions = d.transactions || [];
            localTasks = d.tasks || [];
        } catch(e) { 
            console.error("Erreur lecture data", e);
            loadDemoData();
        }
    } else {
        loadDemoData();
    }
    renderAll();
}

function loadDemoData() {
    localChickens = JSON.parse(JSON.stringify(DEMO_DATA.chickens));
    localEggs = JSON.parse(JSON.stringify(DEMO_DATA.eggs));
    localTransactions = JSON.parse(JSON.stringify(DEMO_DATA.transactions));
    localTasks = JSON.parse(JSON.stringify(DEMO_DATA.tasks));
}

// Sauvegarde ASYNCHRONE pour supporter les appels await
async function saveData() {
    const data = {
        chickens: localChickens,
        eggs: localEggs,
        transactions: localTransactions,
        tasks: localTasks,
        lastUpdated: new Date().toISOString()
    };
    
    if(isDemoMode) {
        localStorage.setItem('poupoules_data', JSON.stringify(data));
    } else if (currentUser) {
        try {
            await db.collection('users').doc(currentUser.uid).set(data);
            console.log("Sauvegardé dans Firebase:", new Date().toLocaleTimeString());
        } catch(error) {
            console.error("Erreur sauvegarde Firebase:", error);
            // Backup en local si Firebase échoue
            localStorage.setItem('poupoules_data_backup', JSON.stringify(data));
            alert("Erreur de sauvegarde cloud. Backup local créé.");
        }
    }
}

function renderAll() {
    renderChickensList();
    renderDashboard();
    renderFinance();
    renderMaintenance();
}

// Auth & Export
window.login = () => {
    const p = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(p).catch(alert);
};
window.logout = () => auth.signOut();

window.exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        chickens: localChickens, eggs: localEggs, transactions: localTransactions, tasks: localTasks
    }));
    const a = document.createElement('a');
    a.href = dataStr; a.download = "sauvegarde_mes_poulettes.json"; a.click();
};

window.handleImport = (input) => {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const d = JSON.parse(e.target.result);
            if(confirm("Attention, cela va écraser les données actuelles. Continuer ?")) {
                localChickens = sanitizeData(d.chickens, 'chickens');
                localEggs = d.eggs || [];
                localTransactions = d.transactions || [];
                localTasks = d.tasks || [];
                saveData();
                renderAll();
                alert("Import réussi !");
            }
        } catch(err) { alert("Fichier invalide"); }
    };
    reader.readAsText(file);
};

// Fonction helper pour l'import (déclenche le file input)
window.importData = () => {
    document.getElementById('import-file').click();
};
