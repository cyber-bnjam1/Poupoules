// CONFIG & INIT
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

// DONNEES INITIALES
const DEMO_DATA = {
    chickens: [
        { id: 'c1', name: 'Huguette', breed: 'Rousse', date: '2023-01-01', health: 'healthy', photo: 'icon.png', isFavorite: true },
        { id: 'c2', name: 'Paulette', breed: 'Sussex', date: '2023-05-15', health: 'healthy', photo: 'icon.png', isFavorite: false }
    ],
    eggs: [], transactions: [], tasks: []
};

// VARIABLES GLOBALES
let localChickens = [], localEggs = [], localTransactions = [], localTasks = [];
let currentUser = null, isDemoMode = true;
let currentViewId = 'view-dashboard';
let tempPhotoBase64 = null;
let eggsChartInstance = null;

// CHARGEMENT
document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }
    
    initEggsChart();
    updateFabVisibility('view-dashboard');

    // AUTH
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            isDemoMode = false;
            loadFirebaseData();
            document.getElementById('header-status').classList.remove('demo');
            document.getElementById('auth-container').innerHTML = `
                <h3>${user.displayName || 'Utilisateur'}</h3>
                <p>${user.email}</p>
                <button class="btn-text-danger" onclick="auth.signOut()">Déconnexion</button>`;
        } else {
            currentUser = null;
            isDemoMode = true;
            loadLocalData();
            document.getElementById('header-status').classList.add('demo');
            document.getElementById('auth-container').innerHTML = `
                <p>Mode hors ligne</p>
                <button class="btn-primary" onclick="login()">Connexion Google</button>`;
        }
    });

    // Close Modals
    document.querySelectorAll('.close-modal').forEach(b => {
        b.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none');
    });
});

// --- NAVIGATION ---
window.toggleMenu = () => document.getElementById('menu-overlay').classList.toggle('open');
window.navigate = (targetId) => {
    document.getElementById('menu-overlay').classList.remove('open');
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    document.getElementById(targetId).classList.add('active-view');
    document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
    const link = Array.from(document.querySelectorAll('.menu-link')).find(l => l.getAttribute('onclick').includes(targetId));
    if(link) link.classList.add('active');
    
    currentViewId = targetId;
    updateFabVisibility(targetId);
    window.scrollTo(0,0);
};

// --- FAB ---
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

// --- POULES ---
function renderChickensList() {
    const grid = document.getElementById('chickens-grid');
    grid.innerHTML = '';
    const filter = document.querySelector('#btn-filter-active').classList.contains('active') ? 'active' : 'archived';
    
    // Trier : Favoris en premier, puis par nom
    const list = localChickens
        .filter(c => (c.status || 'active') === filter)
        .sort((a,b) => (b.isFavorite === true) - (a.isFavorite === true));

    if(list.length === 0) grid.innerHTML = '<p style="text-align:center; width:100%; grid-column:1/-1;">Aucune poule.</p>';

    list.forEach(c => {
        const div = document.createElement('div');
        div.className = 'chicken-card';
        // Coeur : rouge si favori, gris sinon
        const heartClass = c.isFavorite ? 'fas fa-heart active' : 'far fa-heart';
        
        div.innerHTML = `
            <button class="fav-btn ${c.isFavorite ? 'active' : ''}" onclick="toggleFavorite('${c.id}')">
                <i class="${heartClass}"></i>
            </button>
            <button class="edit-btn" onclick="openChickenModal('${c.id}')"><i class="fas fa-pen"></i></button>
            <img class="chicken-photo" src="${c.photo || 'icon.png'}">
            <div class="chicken-name">${c.name}</div>
            <div class="chicken-breed">${c.breed || ''}</div>
            <div class="chicken-age">${getAge(c.date)}</div>
        `;
        grid.appendChild(div);
    });
}

// LOGIQUE FAVORIS
window.toggleFavorite = (id) => {
    const idx = localChickens.findIndex(c => c.id === id);
    if (idx > -1) {
        localChickens[idx].isFavorite = !localChickens[idx].isFavorite;
        saveData();
        renderChickensList();
    }
};

// LOGIQUE ARCHIVER (Au lieu de supprimer)
window.archiveChicken = () => {
    const id = document.getElementById('chicken-id').value;
    if (!id) return;
    
    const idx = localChickens.findIndex(c => c.id === id);
    if (idx > -1) {
        // Si elle est déjà archivée, on propose de supprimer ou désarchiver ?
        // Ici simple : on archive ou on supprime si déjà archivé
        if(localChickens[idx].status === 'archived') {
            if(confirm("Supprimer définitivement cette archive ?")) {
                localChickens.splice(idx, 1);
            }
        } else {
            if(confirm("Archiver cette poule ? Elle ne sera plus visible dans le poulailler actif.")) {
                localChickens[idx].status = 'archived';
            }
        }
        saveData();
        document.getElementById('modal-chicken').style.display = 'none';
        renderChickensList();
    }
};

window.filterChickens = (type, btn) => {
    document.querySelectorAll('#view-chickens .segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChickensList();
    // Changer le texte du bouton d'action selon l'onglet
    const btnArchive = document.getElementById('btn-archive-chicken');
    btnArchive.innerText = type === 'archived' ? 'Supprimer' : 'Archiver';
};

window.openChickenModal = (id = null) => {
    const modal = document.getElementById('modal-chicken');
    document.getElementById('form-chicken').reset();
    document.getElementById('preview-photo').src = 'icon.png';
    tempPhotoBase64 = null;
    
    if(id) {
        const c = localChickens.find(x => x.id === id);
        document.getElementById('modal-chicken-title').innerText = "Modifier";
        document.getElementById('chicken-id').value = c.id;
        document.getElementById('chicken-name').value = c.name;
        document.getElementById('chicken-breed').value = c.breed;
        document.getElementById('chicken-date').value = c.date;
        document.getElementById('chicken-health').value = c.health;
        if(c.photo) document.getElementById('preview-photo').src = c.photo;
        
        // Bouton archiver visible
        document.getElementById('btn-archive-chicken').style.display = 'block';
    } else {
        document.getElementById('modal-chicken-title').innerText = "Nouvelle Poule";
        document.getElementById('chicken-id').value = "";
        document.getElementById('chicken-date').valueAsDate = new Date();
        document.getElementById('btn-archive-chicken').style.display = 'none';
    }
    modal.style.display = 'flex';
};

document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('chicken-id').value;
    const data = {
        name: document.getElementById('chicken-name').value,
        breed: document.getElementById('chicken-breed').value,
        date: document.getElementById('chicken-date').value,
        health: document.getElementById('chicken-health').value,
        photo: tempPhotoBase64 || document.getElementById('preview-photo').src
    };

    if(id) {
        const idx = localChickens.findIndex(c => c.id === id);
        if(idx>-1) localChickens[idx] = { ...localChickens[idx], ...data };
    } else {
        localChickens.push({ id: 'c'+Date.now(), ...data, status: 'active', isFavorite: false });
    }
    saveData();
    document.getElementById('modal-chicken').style.display = 'none';
    renderChickensList();
});

// --- DASHBOARD ---
function renderDashboard() {
    const now = new Date();
    // Stats ce mois
    const thisMonth = localEggs.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    document.getElementById('total-eggs-display').innerText = thisMonth.length;
    
    const today = localEggs.filter(e => e.date.startsWith(now.toISOString().split('T')[0]));
    document.getElementById('eggs-today-count').innerText = today.length;
    
    updateChart(localEggs);
    
    const list = document.getElementById('recent-activity-list');
    list.innerHTML = '';
    localEggs.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5).forEach(e => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="background:#ff9500; width:10px; height:10px; border-radius:50%;"></div>
                <strong>${e.chickenName}</strong>
            </div>
            <span>${new Date(e.date).toLocaleDateString()}</span>
            <button class="btn-text-danger" onclick="deleteEgg('${e.id}')"><i class="fas fa-trash"></i></button>
        `;
        list.appendChild(li);
    });
}

window.openAddEggModal = () => {
    const modal = document.getElementById('modal-add-egg');
    const grid = document.getElementById('egg-chickens-list');
    grid.innerHTML = '';
    
    const actives = localChickens.filter(c => c.status === 'active');
    if(!actives.length) grid.innerHTML = '<p>Ajoutez des poules d\'abord !</p>';
    
    actives.forEach(c => {
        const div = document.createElement('div');
        div.className = 'selection-card';
        div.innerHTML = `<img src="${c.photo || 'icon.png'}"><span>${c.name}</span>`;
        div.onclick = () => {
            localEggs.push({ id: 'e'+Date.now(), chickenId: c.id, chickenName: c.name, date: new Date().toISOString() });
            saveData();
            renderDashboard();
            modal.style.display = 'none';
        };
        grid.appendChild(div);
    });
    modal.style.display = 'flex';
};

window.deleteEgg = (id) => {
    if(confirm("Supprimer ?")) {
        localEggs = localEggs.filter(e => e.id !== id);
        saveData();
        renderDashboard();
    }
};

// --- FINANCE (CORRIGÉ) ---
function renderFinance() {
    const list = document.getElementById('finance-list');
    list.innerHTML = '';
    const sorted = [...localTransactions].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    let total = 0;
    sorted.forEach(t => {
        total += (t.category === 'income' ? t.amount : -t.amount);
        const li = document.createElement('li');
        li.onclick = () => openTransactionModal(t.id);
        const color = t.category === 'income' ? 'var(--success)' : 'var(--text-dark)';
        li.innerHTML = `
            <div><strong>${formatTransType(t.type)}</strong><br><small>${t.date}</small></div>
            <div style="color:${color}; font-weight:bold;">${t.category === 'income' ? '+' : '-'}${t.amount}€</div>
        `;
        list.appendChild(li);
    });
    
    document.getElementById('balance-total').innerText = total.toFixed(2) + ' €';
    document.getElementById('balance-total').style.color = total >= 0 ? 'var(--success)' : 'var(--danger)';
}

// CORRECTION BUG CATEGORIE
window.setTransactionType = (type) => {
    document.getElementById('btn-expense').classList.remove('active');
    document.getElementById('btn-income').classList.remove('active');
    
    if(type === 'expense') document.getElementById('btn-expense').classList.add('active');
    else document.getElementById('btn-income').classList.add('active');
    
    // IMPORTANT : On met à jour l'input caché
    document.getElementById('trans-category').value = type;
};

window.openTransactionModal = (id = null) => {
    const modal = document.getElementById('modal-transaction');
    document.getElementById('form-transaction').reset();
    
    if(id) {
        const t = localTransactions.find(x => x.id === id);
        document.getElementById('trans-id').value = t.id;
        document.getElementById('trans-amount').value = t.amount;
        document.getElementById('trans-date').value = t.date;
        document.getElementById('trans-type').value = t.type;
        setTransactionType(t.category); // Utilise la catégorie sauvegardée
        document.getElementById('btn-delete-trans').style.display = 'block';
    } else {
        document.getElementById('trans-id').value = "";
        document.getElementById('trans-date').valueAsDate = new Date();
        setTransactionType('expense'); // Par défaut
        document.getElementById('btn-delete-trans').style.display = 'none';
    }
    modal.style.display = 'flex';
};

document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('trans-id').value;
    const category = document.getElementById('trans-category').value; // On lit la valeur corrigée
    
    const data = {
        amount: parseFloat(document.getElementById('trans-amount').value),
        date: document.getElementById('trans-date').value,
        type: document.getElementById('trans-type').value,
        category: category
    };

    if(id) {
        const idx = localTransactions.findIndex(t => t.id === id);
        if(idx > -1) localTransactions[idx] = { id, ...data };
    } else {
        localTransactions.push({ id: 't'+Date.now(), ...data });
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

function formatTransType(t) {
    const map = { 'graines': 'Alimentation', 'vente_oeufs': 'Vente Œufs', 'soins': 'Véto', 'achat_poule': 'Achat Poule' };
    return map[t] || t;
}

// --- ENTRETIEN ---
function renderMaintenance() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    
    localTasks.sort((a,b) => getDaysDiff(b.lastDone) - getDaysDiff(a.lastDone)).forEach(t => {
        const diff = getDaysDiff(t.lastDone);
        const urgent = diff >= t.frequency;
        const li = document.createElement('li');
        li.innerHTML = `
            <div onclick="openEditTaskModal('${t.id}')">
                <strong>${t.title}</strong><br>
                <small>Tous les ${t.frequency}j • Fait il y a ${diff}j</small>
            </div>
            <button class="btn-primary" style="padding:5px 10px; background:${urgent?'var(--danger)':'var(--success)'}" onclick="completeTask('${t.id}')">Fait</button>
        `;
        list.appendChild(li);
    });
}
window.completeTask = (id) => {
    const t = localTasks.find(x => x.id === id);
    if(t) { t.lastDone = new Date().toISOString(); saveData(); renderMaintenance(); }
};
window.openEditTaskModal = (id = null) => {
    const modal = document.getElementById('modal-edit-task');
    document.getElementById('form-task').reset();
    if(id) {
        const t = localTasks.find(x => x.id === id);
        document.getElementById('task-id').value = t.id;
        document.getElementById('task-title').value = t.title;
        document.getElementById('task-freq').value = t.frequency;
        document.getElementById('btn-delete-task').style.display = 'block';
    } else {
        document.getElementById('task-id').value = "";
        document.getElementById('btn-delete-task').style.display = 'none';
    }
    modal.style.display = 'flex';
};
document.getElementById('form-task').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const data = {
        title: document.getElementById('task-title').value,
        frequency: parseInt(document.getElementById('task-freq').value)
    };
    if(id) {
        const idx = localTasks.findIndex(t => t.id === id);
        if(idx>-1) localTasks[idx] = { ...localTasks[idx], ...data };
    } else {
        localTasks.push({ id: 'task'+Date.now(), ...data, lastDone: new Date().toISOString() });
    }
    saveData();
    document.getElementById('modal-edit-task').style.display = 'none';
    renderMaintenance();
});
window.deleteCurrentTask = () => {
    const id = document.getElementById('task-id').value;
    localTasks = localTasks.filter(t => t.id !== id);
    saveData();
    document.getElementById('modal-edit-task').style.display = 'none';
    renderMaintenance();
};

// --- UTILS ---
// COMPRESSION IMAGE (LA SOLUTION AUX PHOTOS QUI DISPARAISSENT)
window.handlePhotoUpload = (input) => {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], 600, 0.7).then(base64 => {
            document.getElementById('preview-photo').src = base64;
            tempPhotoBase64 = base64;
        }).catch(err => alert("Erreur photo: " + err));
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
                resolve(elem.toDataURL('image/jpeg', quality));
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

function getAge(dateStr) {
    if(!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
    if(months < 1) return 'Poussin';
    if(months < 12) return months + ' mois';
    return Math.floor(months/12) + ' ans';
}
function getDaysDiff(d) {
    return Math.floor((new Date() - new Date(d)) / (1000*60*60*24));
}
function initEggsChart() {
    const ctx = document.getElementById('eggsChart').getContext('2d');
    eggsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['J','F','M','A','M','J','J','A','S','O','N','D'], datasets: [{ label:'Œufs', data:[], backgroundColor:'#007aff' }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{beginAtZero:true}} }
    });
}
function updateChart(eggs) {
    const counts = new Array(12).fill(0);
    const now = new Date();
    eggs.filter(e => new Date(e.date).getFullYear() === now.getFullYear())
        .forEach(e => counts[new Date(e.date).getMonth()]++);
    eggsChartInstance.data.datasets[0].data = counts;
    eggsChartInstance.update();
}

// DATA
function saveData() {
    const data = { chickens: localChickens, eggs: localEggs, transactions: localTransactions, tasks: localTasks };
    if(isDemoMode) localStorage.setItem('poupoules_data', JSON.stringify(data));
    else if(currentUser) db.collection('users').doc(currentUser.uid).set(data);
}
function loadLocalData() {
    const d = JSON.parse(localStorage.getItem('poupoules_data') || '{}');
    localChickens = d.chickens || DEMO_DATA.chickens;
    localEggs = d.eggs || [];
    localTransactions = d.transactions || [];
    localTasks = d.tasks || [];
    renderChickensList(); renderDashboard(); renderFinance(); renderMaintenance();
}
function loadFirebaseData() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            localChickens = d.chickens || []; localEggs = d.eggs||[]; localTransactions=d.transactions||[]; localTasks=d.tasks||[];
            renderChickensList(); renderDashboard(); renderFinance(); renderMaintenance();
        }
    });
}
window.login = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
window.exportData = () => {
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ chickens: localChickens, eggs: localEggs, transactions: localTransactions, tasks: localTasks }));
    a.download = "sauvegarde.json"; a.click();
};
