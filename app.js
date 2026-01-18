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

    if (targetId === 'view-stats' && window.renderStatsView) {
        window.renderStatsView();
    }

    const target = document.getElementById(targetId);
    if (target) {
        target.classList.add('active-view');
    }

    currentViewId = targetId;
    updateFabVisibility(targetId);
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
        saveData();
        document.getElementById('modal-chicken').style.display = 'none';
        renderChickensList();
    }
};

window.openChickenModal = (id=null) => {
    const modal = document.getElementById('modal-chicken');
    tempPhotoBase64 = null;
    document.getElementById('chicken-photo-preview').src = 'icon.png';
    if(id) {
        const c = localChickens.find(x => x.id === id);
        document.getElementById('chicken-id').value = c.id;
        document.getElementById('chicken-name').value = c.name;
        document.getElementById('chicken-breed').value = c.breed || '';
        document.getElementById('chicken-date').value = c.date ? c.date.split('T')[0] : '';
        if(c.photo) document.getElementById('chicken-photo-preview').src = c.photo;
        document.getElementById('btn-archive-chicken').style.display = 'block';
        document.getElementById('btn-archive-chicken').innerText = (c.status === 'archived') ? "Supprimer définitivement" : "Archiver";
    } else {
        document.getElementById('chicken-id').value = '';
        document.getElementById('chicken-name').value = '';
        document.getElementById('chicken-breed').value = '';
        document.getElementById('chicken-date').value = '';
        document.getElementById('btn-archive-chicken').style.display = 'none';
    }
    modal.style.display = 'flex';
};

document.getElementById('chicken-photo-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onloadend = () => { tempPhotoBase64 = reader.result; document.getElementById('chicken-photo-preview').src = tempPhotoBase64; };
        reader.readAsDataURL(file);
    }
});
document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('chicken-id').value;
    const data = {
        id: id || 'c' + Date.now(),
        name: document.getElementById('chicken-name').value,
        breed: document.getElementById('chicken-breed').value,
        date: new Date(document.getElementById('chicken-date').value).toISOString(),
        photo: tempPhotoBase64,
        status: 'active'
    };
    if(id) {
        const idx = localChickens.findIndex(c => c.id === id);
        if(!tempPhotoBase64) data.photo = localChickens[idx].photo;
        localChickens[idx] = { ...localChickens[idx], ...data };
    } else {
        localChickens.push(data);
    }
    saveData();
    document.getElementById('modal-chicken').style.display = 'none';
    renderChickensList();
});
window.filterChickens = (type, btn) => {
    document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChickensList();
};

// DASHBOARD & OEUFS
function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthEggs = localEggs.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((acc, curr) => acc + (curr.count || 1), 0);
    document.getElementById('eggs-month-count').innerText = monthEggs;
    
    // Recent activity
    const activityList = document.getElementById('recent-activity-list');
    activityList.innerHTML = '';
    const all = [
        ...localEggs.map(e => ({ type: 'egg', date: e.date, count: e.count })),
        ...localTransactions.map(t => ({ type: 'money', date: t.date, amount: t.amount, cat: t.category })),
        ...localTasks.filter(t => t.lastDone).map(t => ({ type: 'task', date: t.lastDone, name: t.name }))
    ].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    all.forEach(item => {
        const li = document.createElement('li');
        const d = new Date(item.date).toLocaleDateString();
        if(item.type === 'egg') li.innerHTML = `<span><i class="fas fa-egg" style="color:orange;"></i> +${item.count} œuf(s)</span><span class="date">${d}</span>`;
        if(item.type === 'money') li.innerHTML = `<span><i class="fas fa-coins" style="color:${item.cat==='income'?'green':'red'};"></i> ${item.amount}€</span><span class="date">${d}</span>`;
        if(item.type === 'task') li.innerHTML = `<span><i class="fas fa-check" style="color:blue;"></i> ${item.name}</span><span class="date">${d}</span>`;
        activityList.appendChild(li);
    });

    updateChart();
    
    // EXTENSIONS REFRESH
    if(window.renderSuppliesWidget) window.renderSuppliesWidget();
    if(window.renderRecyclerWidget) window.renderRecyclerWidget();
    if(window.renderFridgeWidget) window.renderFridgeWidget();
    if(window.renderLayingRate) window.renderLayingRate();
    if(window.renderJournalWidget) window.renderJournalWidget();
}

function initEggsChart() {
    const ctx = document.getElementById('eggsChart').getContext('2d');
    eggsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: 'rgba(255, 165, 0, 0.6)', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}
function updateChart() {
    if(!eggsChartInstance) return;
    const last6Months = [];
    const data = [];
    for(let i=5; i>=0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const k = d.toLocaleString('default', { month: 'short' });
        last6Months.push(k);
        const m = d.getMonth();
        const y = d.getFullYear();
        const total = localEggs.filter(e => { const x = new Date(e.date); return x.getMonth()===m && x.getFullYear()===y; })
            .reduce((a,b) => a+(b.count||1), 0);
        data.push(total);
    }
    eggsChartInstance.data.labels = last6Months;
    eggsChartInstance.data.datasets[0].data = data;
    eggsChartInstance.update();
    
    const grandTotal = localEggs.reduce((a,b) => a+(b.count||1), 0);
    document.getElementById('total-eggs-display').innerText = grandTotal;
}

window.openAddEggModal = () => {
    document.getElementById('egg-count-input').value = 1;
    document.getElementById('egg-date-input').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-add-egg').style.display = 'flex';
};

// FINANCE
window.openTransactionModal = () => {
    document.getElementById('trans-id').value = '';
    document.getElementById('trans-amount').value = '';
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('btn-delete-trans').style.display = 'none';
    document.getElementById('modal-transaction').style.display = 'flex';
};
window.renderFinanceList = () => {
    const list = document.getElementById('finance-list');
    list.innerHTML = '';
    let balance = 0;
    localTransactions.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
        balance += (t.category === 'income' ? t.amount : -t.amount);
        const li = document.createElement('li');
        li.className = 'finance-item';
        li.onclick = () => editTransaction(t.id);
        li.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <span style="font-weight:bold;">${t.type}</span>
                <span style="font-size:12px; color:gray;">${new Date(t.date).toLocaleDateString()}</span>
            </div>
            <div style="font-weight:bold; color:${t.category === 'income' ? 'var(--success)' : 'var(--danger)'};">
                ${t.category === 'income' ? '+' : '-'}${t.amount.toFixed(2)} €
            </div>
        `;
        list.appendChild(li);
    });
    document.getElementById('balance-total').innerText = balance.toFixed(2) + ' €';
    if(window.renderCostPrice) window.renderCostPrice();
    if(window.renderSavingsPiggy) window.renderSavingsPiggy();
    if(window.renderSalesRegister) window.renderSalesRegister();
};
function editTransaction(id) {
    const t = localTransactions.find(x => x.id === id);
    if(t) {
        document.getElementById('trans-id').value = t.id;
        document.getElementById('trans-type').value = t.type;
        document.getElementById('trans-category').value = t.category;
        document.getElementById('trans-amount').value = t.amount;
        document.getElementById('trans-date').value = t.date.split('T')[0];
        document.getElementById('btn-delete-trans').style.display = 'block';
        document.getElementById('modal-transaction').style.display = 'flex';
    }
}
document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('trans-id').value;
    const data = {
        id: id || 't' + Date.now(),
        amount: parseFloat(document.getElementById('trans-amount').value),
        date: document.getElementById('trans-date').value,
        type: document.getElementById('trans-type').value,
        category: document.getElementById('trans-category').value
    };
    if(id) {
        const idx = localTransactions.findIndex(t => t.id === id);
        localTransactions[idx] = { ...localTransactions[idx], ...data };
    } else {
        localTransactions.push(data);
    }
    saveData();
    document.getElementById('modal-transaction').style.display = 'none';
    renderFinanceList();
    renderDashboard();
});
window.deleteTransaction = () => {
    if(confirm("Supprimer ?")) {
        const id = document.getElementById('trans-id').value;
        localTransactions = localTransactions.filter(t => t.id !== id);
        saveData();
        document.getElementById('modal-transaction').style.display = 'none';
        renderFinanceList();
        renderDashboard();
    }
};

// ENTRETIEN
window.renderMaintenanceView = () => {
    const list = document.getElementById('maintenance-list');
    list.innerHTML = '';
    localTasks.forEach(t => {
        let statusColor = 'gray';
        let textNext = 'À faire';
        if(t.lastDone) {
            const next = new Date(t.lastDone);
            next.setDate(next.getDate() + parseInt(t.frequency));
            const diff = Math.ceil((next - new Date()) / (1000 * 60 * 60 * 24));
            if(diff < 0) { statusColor = 'var(--danger)'; textNext = 'En retard'; }
            else if(diff <= 2) { statusColor = 'var(--warning)'; textNext = 'Bientôt'; }
            else { statusColor = 'var(--success)'; textNext = 'OK'; }
        } else {
            statusColor = 'var(--danger)';
        }

        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `
            <div onclick="openEditTaskModal('${t.id}')" style="flex:1;">
                <div style="font-weight:bold;">${t.name}</div>
                <div style="font-size:12px; color:gray;">Tous les ${t.frequency} jours</div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:12px; font-weight:bold; color:${statusColor};">${textNext}</span>
                <button class="btn-check" onclick="toggleTaskDone('${t.id}')"><i class="fas fa-check"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
    
    // EXTENSIONS HEALTH
    if(window.renderHealthWidget) window.renderHealthWidget();
    if(window.renderVetWidget) window.renderVetWidget();
};
window.openEditTaskModal = (id=null) => {
    const modal = document.getElementById('modal-task');
    if(id) {
        const t = localTasks.find(x => x.id === id);
        document.getElementById('task-id').value = t.id;
        document.getElementById('task-name').value = t.name;
        document.getElementById('task-freq').value = t.frequency;
        document.getElementById('btn-delete-task').style.display = 'block';
    } else {
        document.getElementById('task-id').value = '';
        document.getElementById('task-name').value = '';
        document.getElementById('task-freq').value = '7';
        document.getElementById('btn-delete-task').style.display = 'none';
    }
    modal.style.display = 'flex';
};
document.getElementById('form-task').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const data = {
        id: id || 'tk' + Date.now(),
        name: document.getElementById('task-name').value,
        frequency: parseInt(document.getElementById('task-freq').value),
        lastDone: id ? localTasks.find(t=>t.id===id).lastDone : null
    };
    if(id) {
        const idx = localTasks.findIndex(t => t.id === id);
        localTasks[idx] = { ...localTasks[idx], ...data };
    } else {
        localTasks.push(data);
    }
    saveData();
    document.getElementById('modal-task').style.display = 'none';
    renderMaintenanceView();
});
window.toggleTaskDone = (id) => {
    const idx = localTasks.findIndex(t => t.id === id);
    if(idx > -1) {
        localTasks[idx].lastDone = new Date().toISOString();
        saveData();
        renderMaintenanceView();
        renderDashboard();
    }
};
window.deleteTask = () => {
    if(confirm("Supprimer cette tâche ?")) {
        const id = document.getElementById('task-id').value;
        localTasks = localTasks.filter(t => t.id !== id);
        saveData();
        document.getElementById('modal-task').style.display = 'none';
        renderMaintenanceView();
    }
};

// UTILS
function getAge(dateStr) {
    if(!dateStr) return '?';
    const diff = Date.now() - new Date(dateStr).getTime();
    const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
    const years = Math.floor(months / 12);
    if(years > 0) return years + ' ans';
    return months + ' mois';
}

// ============================================
// DATA & SYNC (MODIFIÉ POUR SYNC COMPLÈTE)
// ============================================

window.login = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert(e.message));
};

// Helper pour récupérer toutes les données des extensions
function getAllExtensionsData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // On synchronise tout ce qui commence par 'poupoules_'
        if (key.startsWith('poupoules_')) {
            try {
                data[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
                console.warn("Erreur lecture clé extension: " + key, e);
            }
        }
    }
    return data;
}

function saveData() {
    if (!currentUser || isDemoMode) return;

    db.collection('users').doc(currentUser.uid).set({
        chickens: localChickens,
        eggs: localEggs,
        transactions: localTransactions,
        tasks: localTasks, // Ajout de la synchro des tâches
        extensions: getAllExtensionsData(), // Ajout de la synchro de toutes les extensions
        lastUpdate: new Date().toISOString()
    }).then(() => {
        console.log("Sauvegarde Cloud effectuée");
    }).catch((error) => {
        console.error("Erreur de sauvegarde:", error);
    });
}

function loadFirebaseData() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            localChickens = data.chickens || [];
            localEggs = data.eggs || [];
            localTransactions = data.transactions || [];
            localTasks = data.tasks || []; // Chargement des tâches

            // Synchro des extensions (Sens Cloud -> Local)
            let needReload = false;
            if (data.extensions) {
                Object.keys(data.extensions).forEach(key => {
                    const cloudValue = JSON.stringify(data.extensions[key]);
                    const localValue = localStorage.getItem(key);
                    
                    if (cloudValue !== localValue) {
                        localStorage.setItem(key, cloudValue);
                        needReload = true;
                    }
                });
            }

            renderDashboard();
            renderChickensList();
            renderFinanceList();
            if(window.renderMaintenanceView) window.renderMaintenanceView();

            // Si on a mis à jour des données d'extensions (qui sont chargées au démarrage), on recharge
            if (needReload) {
                console.log("Données extensions mises à jour depuis le cloud, rechargement...");
                window.location.reload();
            }
        }
    }).catch((error) => {
        console.error("Erreur chargement:", error);
    });
}

function loadLocalData() {
    // Mode invité : on ne touche qu'aux variables principales, les extensions se gèrent elles-mêmes via localStorage
    // Pas de chargement depuis Firebase, on utilise ce qui est en mémoire ou initialisé
}
