// CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDpVKRam-7sldEss93zRTh8At3pEtJ0SqA",
    authDomain: "poulettes-75fb5.firebaseapp.com",
    projectId: "poulettes-75fb5",
    storageBucket: "poulettes-75fb5.firebasestorage.app",
    messagingSenderId: "479553710488",
    appId: "1:479553710488:web:8cb5ec0285f330c51e23ed"
};

// Initialisation Firebase avec persistance offline
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    // Activation de la persistance offline pour Firestore
    firebase.firestore().enablePersistence({ synchronizeTabs: true })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn("Persistance offline impossible : plusieurs onglets ouverts");
            } else if (err.code == 'unimplemented') {
                console.warn("Persistance offline non supportée par ce navigateur");
            }
        });
}

const auth = firebase.auth();
const db = firebase.firestore();

// STATE
let localChickens = [], localEggs = [], localTransactions = [], localTasks = [];
let currentUser = null, isDemoMode = true;
let currentViewId = 'view-dashboard';
let tempPhotoBase64 = null;
let eggsChartInstance = null;
let unsubscribeFirestore = null; // Pour stocker l'écouteur Firestore

// INIT
document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }
    initEggsChart();
    updateFabVisibility('view-dashboard');

    // Chargement initial des données locales (mode invité par défaut)
    loadLocalData();

    // Gestion de l'état d'authentification
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // MODE CONNECTÉ
            currentUser = user;
            isDemoMode = false;
            
            // Vérifier s'il y a des données locales à migrer vers Firebase
            await checkAndMigrateLocalData(user.uid);
            
            // Configurer l'écoute en temps réel des données Firebase
            setupRealtimeSync(user.uid);
            
            updateUIForConnectedUser(user);
        } else {
            // MODE INVITÉ
            currentUser = null;
            isDemoMode = true;
            
            // Arrêter l'écoute Firestore si existante
            if (unsubscribeFirestore) {
                unsubscribeFirestore();
                unsubscribeFirestore = null;
            }
            
            // Recharger depuis le localStorage
            loadLocalData();
            updateUIForGuestUser();
        }
    });

    // Fermeture des modals
    document.querySelectorAll('.close-modal').forEach(b => {
        b.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none');
    });

    // Formulaire ajout d'œufs
    document.getElementById('form-add-egg').addEventListener('submit', (e) => {
        e.preventDefault();
        const count = parseInt(document.getElementById('egg-count-input').value);
        const date = document.getElementById('egg-date-input').value;
        if (count > 0 && date) {
            const newEgg = { 
                id: 'e' + Date.now(), 
                count: count, 
                date: new Date(date).toISOString(),
                createdAt: new Date().toISOString() // Timestamp pour le tri
            };
            localEggs.push(newEgg);
            saveData();
            if(window.updateFridge) window.updateFridge(count);
            renderDashboard();
            document.getElementById('modal-add-egg').style.display = 'none';
        }
    });
});

// MIGRATION : LocalStorage → Firebase à la première connexion
async function checkAndMigrateLocalData(uid) {
    const localData = JSON.parse(localStorage.getItem('poupoules_data') || 'null');
    
    if (localData) {
        try {
            // Vérifier si l'utilisateur a déjà des données sur Firebase
            const doc = await db.collection('users').doc(uid).get();
            
            if (!doc.exists) {
                // Pas de données sur Firebase → migrer les locales
                console.log("Migration des données locales vers Firebase...");
                await db.collection('users').doc(uid).set({
                    chickens: localData.chickens || [],
                    eggs: localData.eggs || [],
                    transactions: localData.transactions || [],
                    tasks: localData.tasks || [],
                    lastSync: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Optionnel : vider le localStorage après migration réussie
                // localStorage.removeItem('poupoules_data');
                console.log("Migration réussie !");
            } else {
                console.log("Données Firebase existantes, pas de migration nécessaire");
            }
        } catch (error) {
            console.error("Erreur lors de la migration:", error);
        }
    }
}

// SYNCHRONISATION TEMPS RÉEL avec Firestore
function setupRealtimeSync(uid) {
    // Arrêter l'ancienne écoute si existante
    if (unsubscribeFirestore) unsubscribeFirestore();
    
    unsubscribeFirestore = db.collection('users').doc(uid)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                localChickens = data.chickens || [];
                localEggs = data.eggs || [];
                localTransactions = data.transactions || [];
                localTasks = data.tasks || [];
                
                // Mettre à jour l'interface
                renderChickensList();
                renderDashboard();
                renderFinance();
                renderMaintenance();
                
                console.log("Données synchronisées depuis Firebase");
            } else {
                // Document inexistant → créer avec données vides ou locales
                const initialData = {
                    chickens: localChickens,
                    eggs: localEggs,
                    transactions: localTransactions,
                    tasks: localTasks,
                    lastSync: firebase.firestore.FieldValue.serverTimestamp()
                };
                db.collection('users').doc(uid).set(initialData);
            }
        }, (error) => {
            console.error("Erreur de synchronisation:", error);
            // Fallback sur les données locales en cas d'erreur
            loadLocalData();
        });
}

// Mise à jour UI pour utilisateur connecté
function updateUIForConnectedUser(user) {
    document.getElementById('header-status').classList.remove('demo');
    document.getElementById('auth-container').innerHTML = `
        <img src="${user.photoURL || 'icon.png'}" style="width:80px; height:80px; border-radius:50%; margin-bottom:10px;">
        <h3>${user.displayName || 'Utilisateur'}</h3>
        <p style="color:gray; margin-bottom:15px;">${user.email}</p>
        <button class="btn-text-danger" onclick="auth.signOut()">Se déconnecter</button>
        <div style="margin-top:10px; font-size:12px; color:var(--success);">
            <i class="fas fa-cloud"></i> Synchronisé
        </div>`;
}

// Mise à jour UI pour invité
function updateUIForGuestUser() {
    document.getElementById('header-status').classList.add('demo');
    document.getElementById('auth-container').innerHTML = `
        <div style="width:80px; height:80px; background:#ddd; border-radius:50%; margin:0 auto 10px auto; display:flex; align-items:center; justify-content:center; font-size:30px; color:white;"><i class="fas fa-user"></i></div>
        <h3>Mode Invité</h3>
        <p style="color:gray; margin-bottom:15px;">Sauvegarde locale uniquement</p>
        <button class="btn-primary" onclick="login()">Connexion Google</button>
        <div style="margin-top:10px; font-size:12px; color:var(--warning);">
            <i class="fas fa-exclamation-triangle"></i> Risque de perte de données
        </div>`;
}

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

// POULES (inchangé functionnellement, juste optimisé)
function renderChickensList() {
    const grid = document.getElementById('chickens-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const filter = document.querySelector('#btn-filter-active').classList.contains('active') ? 'active' : 'archived';
    
    const list = localChickens
        .filter(c => (c.status || 'active') === filter)
        .sort((a,b) => (b.isFavorite === true) - (a.isFavorite === true));
    
    const title = document.querySelector('#view-chickens .big-title');
    if(title) title.innerText = `Mon Cheptel (${list.length})`;

    if(list.length === 0) { 
        grid.innerHTML = '<p style="text-align:center; width:100%; color:grey;">Aucune poule.</p>'; 
        return; 
    }

    list.forEach(c => {
        const div = document.createElement('div');
        div.className = 'chicken-card';
        div.innerHTML = `
            <button class="fav-btn ${c.isFavorite ? 'active' : ''}" onclick="toggleFavorite('${c.id}')"><i class="${c.isFavorite ? 'fas fa-heart active' : 'far fa-heart'}"></i></button>
            <button class="edit-btn" onclick="openChickenModal('${c.id}')"><i class="fas fa-pen"></i></button>
            <img class="chicken-photo" src="${c.photo || 'icon.png'}" onerror="this.src='icon.png'">
            <div class="chicken-name">${c.name}</div>
            <div class="chicken-breed">${c.breed || ''}</div>
            <div class="chicken-age">${getAge(c.date)}</div>
        `;
        grid.appendChild(div);
    });
}

window.toggleFavorite = (id) => { 
    const idx = localChickens.findIndex(c => c.id === id); 
    if (idx > -1) { 
        localChickens[idx].isFavorite = !localChickens[idx].isFavorite; 
        saveData(); 
        renderChickensList(); 
    }
};

window.archiveChicken = () => {
    const id = document.getElementById('chicken-id').value;
    const idx = localChickens.findIndex(c => c.id === id);
    if (idx > -1) {
        if(localChickens[idx].status === 'archived') { 
            if(confirm("Supprimer définitivement cette poule ?")) {
                localChickens.splice(idx, 1); 
            }
        } else { 
            if(confirm("Archiver cette poule ? Elle n'apparaîtra plus dans le poulailler actif.")) {
                localChickens[idx].status = 'archived'; 
            } else {
                return;
            }
        }
        saveData(); 
        document.getElementById('modal-chicken').style.display = 'none'; 
        renderChickensList();
    }
};

window.filterChickens = (type, btn) => { 
    document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active')); 
    btn.classList.add('active'); 
    renderChickensList(); 
    document.getElementById('btn-archive-chicken').innerText = type === 'archived' ? 'Supprimer' : 'Archiver'; 
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
        localChickens.push({ 
            id: 'c' + Date.now(), 
            ...data, 
            status: 'active', 
            isFavorite: false,
            createdAt: new Date().toISOString()
        }); 
    }
    saveData(); 
    document.getElementById('modal-chicken').style.display = 'none'; 
    renderChickensList();
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

    const totalDisplay = document.getElementById('total-eggs-display');
    const monthDisplay = document.getElementById('eggs-month-count');
    
    if (totalDisplay) totalDisplay.innerText = totalCount;
    if (monthDisplay) monthDisplay.innerText = monthCount;
    
    updateChart(localEggs);
    
    const list = document.getElementById('recent-activity-list');
    if (!list) return;
    list.innerHTML = '';
    
    // Trier par date décroissante
    const sortedEggs = [...localEggs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5);
    
    sortedEggs.forEach(e => {
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
            <button class="btn-text-danger" style="margin-left:10px;" onclick="deleteEgg('${e.id}')"><i class="fas fa-trash"></i></button>
        `;
        list.appendChild(li);
    });

    if(window.renderExtensions) window.renderExtensions();
}

window.openAddEggModal = () => {
    const modal = document.getElementById('modal-add-egg');
    document.getElementById('egg-count-input').value = 1;
    document.getElementById('egg-date-input').valueAsDate = new Date();
    modal.style.display = 'flex';
};

window.deleteEgg = (id) => { 
    if(confirm("Supprimer ce ramassage ?")) { 
        localEggs = localEggs.filter(e => e.id !== id); 
        saveData(); 
        renderDashboard(); 
    }
};

// CHART
function initEggsChart() { 
    const ctx = document.getElementById('eggsChart'); 
    if (!ctx) return;
    
    eggsChartInstance = new Chart(ctx.getContext('2d'), { 
        type: 'bar', 
        data: { 
            labels: ['J','F','M','A','M','J','J','A','S','O','N','D'], 
            datasets: [{ label:'Œufs', data:[], backgroundColor:'#007aff' }] 
        }, 
        options: { 
            responsive:true, 
            maintainAspectRatio:false, 
            plugins:{legend:{display:false}}, 
            scales:{x:{grid:{display:false}}, y:{beginAtZero:true}} 
        } 
    }); 
}

function updateChart(eggs) { 
    if (!eggsChartInstance) return;
    const c = new Array(12).fill(0); 
    const y = new Date().getFullYear(); 
    eggs.forEach(e => { 
        if (new Date(e.date).getFullYear() === y) c[new Date(e.date).getMonth()] += (e.count || 1); 
    });
    eggsChartInstance.data.datasets[0].data = c; 
    eggsChartInstance.update(); 
}

// FINANCE
function renderFinance() {
    const list = document.getElementById('finance-list'); 
    if (!list) return;
    list.innerHTML = ''; 
    let total = 0;
    
    localTransactions.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
        total += (t.category === 'income' ? t.amount : -t.amount);
        const li = document.createElement('li'); 
        li.onclick = () => openTransactionModal(t.id);
        li.innerHTML = `
            <div>
                <strong>${formatTransType(t.type)}</strong><br>
                <small>${new Date(t.date).toLocaleDateString()}</small>
            </div>
            <div style="color:${t.category === 'income' ? 'var(--success)' : 'var(--text-dark)'}; font-weight:bold;">
                ${t.category === 'income' ? '+' : '-'}${t.amount}€
            </div>`;
        list.appendChild(li);
    });
    
    const balanceEl = document.getElementById('balance-total');
    if (balanceEl) {
        balanceEl.innerText = total.toFixed(2) + ' €'; 
        balanceEl.style.color = total >= 0 ? 'var(--success)' : 'var(--danger)';
    }
}

window.setTransactionType = (type) => { 
    document.getElementById('btn-expense').classList.remove('active'); 
    document.getElementById('btn-income').classList.remove('active'); 
    if(type === 'expense') document.getElementById('btn-expense').classList.add('active'); 
    else document.getElementById('btn-income').classList.add('active'); 
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
        setTransactionType(t.category); 
        document.getElementById('btn-delete-trans').style.display = 'block'; 
    } else { 
        document.getElementById('trans-id').value = ""; 
        document.getElementById('trans-date').valueAsDate = new Date(); 
        setTransactionType('expense'); 
        document.getElementById('btn-delete-trans').style.display = 'none'; 
    }
    modal.style.display = 'flex';
};

document.getElementById('form-transaction').addEventListener('submit', (e) => { 
    e.preventDefault(); 
    const id = document.getElementById('trans-id').value; 
    const data = { 
        amount: parseFloat(document.getElementById('trans-amount').value), 
        date: document.getElementById('trans-date').value, 
        type: document.getElementById('trans-type').value, 
        category: document.getElementById('trans-category').value,
        updatedAt: new Date().toISOString()
    }; 
    if(id) { 
        const idx = localTransactions.findIndex(t => t.id === id); 
        if(idx>-1) localTransactions[idx] = { id, ...data }; 
    } else { 
        localTransactions.push({ id: 't'+Date.now(), ...data }); 
    } 
    saveData(); 
    document.getElementById('modal-transaction').style.display = 'none'; 
    renderFinance(); 
});

window.deleteTransaction = () => { 
    if(confirm("Supprimer cette transaction ?")) { 
        localTransactions = localTransactions.filter(t => t.id !== document.getElementById('trans-id').value); 
        saveData(); 
        document.getElementById('modal-transaction').style.display = 'none'; 
        renderFinance(); 
    }
};

function formatTransType(t) { 
    const map = { 
        'graines': 'Alimentation', 
        'vente_oeufs': 'Vente Œufs', 
        'soins': 'Véto/Soins', 
        'achat_poule': 'Achat Poule',
        'paille': 'Litière',
        'materiel': 'Matériel'
    }; 
    return map[t] || t; 
}

// ENTRETIEN
function renderMaintenance() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    list.innerHTML = '';
    
    localTasks.sort((a,b) => getDaysDiff(b.lastDone) - getDaysDiff(a.lastDone)).forEach(t => {
        const diff = getDaysDiff(t.lastDone);
        let percent = 100 - ((diff / t.frequency) * 100);
        if (percent < 0) percent = 0;

        let barColor = 'var(--success)';
        if (percent < 50) barColor = 'var(--warning)';
        if (percent < 20) barColor = 'var(--danger)';

        const li = document.createElement('li');
        li.style.display = "flex";
        li.style.alignItems = "center";
        li.style.gap = "15px";

        li.innerHTML = `
            <div style="flex:1; cursor:pointer;" onclick="openEditTaskModal('${t.id}')">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong>${t.title}</strong>
                    <small style="color:${diff >= t.frequency ? 'var(--danger)' : 'var(--text-grey)'}">
                        ${diff >= t.frequency ? '⚠️ En retard' : (t.frequency - diff) + 'j restants'}
                    </small>
                </div>
                <div style="width:100%; height:6px; background:rgba(0,0,0,0.05); border-radius:3px; overflow:hidden;">
                    <div style="width:${percent}%; height:100%; background:${barColor}; transition:width 0.5s ease;"></div>
                </div>
                <div style="margin-top:5px; font-size:11px; color:var(--text-grey); display:flex; justify-content:space-between;">
                    <span>Fait il y a ${diff}j</span>
                    <span>Fréq: ${t.frequency}j</span>
                </div>
            </div>
            <button class="glass-btn-round" style="width:40px; height:40px; border-radius:50%; border:none; background:${diff >= t.frequency ? 'var(--danger)' : 'rgba(0,0,0,0.05)'}; color:${diff >= t.frequency ? 'white' : 'var(--primary)'}; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:pointer;" onclick="event.stopPropagation(); completeTask('${t.id}')">
                <i class="fas fa-check"></i>
            </button>
        `;
        list.appendChild(li);
    });
}

window.completeTask = (id) => { 
    const t = localTasks.find(x => x.id === id); 
    if(t) { 
        t.lastDone = new Date().toISOString(); 
        saveData(); 
        renderMaintenance(); 
    }
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
        localTasks.push({ 
            id: 'task'+Date.now(), 
            ...data, 
            lastDone: new Date().toISOString(),
            createdAt: new Date().toISOString()
        }); 
    } 
    saveData(); 
    document.getElementById('modal-edit-task').style.display = 'none'; 
    renderMaintenance(); 
});

window.deleteCurrentTask = () => { 
    if(confirm("Supprimer cette tâche ?")) { 
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
        }).catch(err => console.error("Erreur compression image:", err));
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
            img.onerror = reject;
        }; 
        reader.onerror = reject; 
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

// DATA - SAUVEGARDE UNIFIÉE ET ROBUSTE
function saveData() { 
    const d = { 
        chickens: localChickens, 
        eggs: localEggs, 
        transactions: localTransactions, 
        tasks: localTasks,
        lastLocalUpdate: new Date().toISOString()
    }; 
    
    try { 
        // TOUJOURS sauvegarder en local (backup)
        localStorage.setItem('poupoules_data', JSON.stringify(d));
        
        // Si connecté, sauvegarder sur Firebase aussi
        if(!isDemoMode && currentUser) {
            db.collection('users').doc(currentUser.uid).set({
                ...d,
                lastSync: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => {
                console.error("Erreur sauvegarde Firebase:", err);
                // Les données restent en localStorage comme backup
            });
        }
    } catch(e) { 
        console.error("Sauvegarde impossible:", e); 
        alert("Erreur de sauvegarde : " + e.message);
    } 
}

function loadLocalData() { 
    try {
        const d = JSON.parse(localStorage.getItem('poupoules_data') || '{"chickens":[]}'); 
        localChickens = d.chickens||[]; 
        localEggs = d.eggs||[]; 
        localTransactions = d.transactions||[]; 
        localTasks = d.tasks||[]; 
        renderChickensList(); 
        renderDashboard(); 
        renderFinance(); 
        renderMaintenance();
    } catch(e) {
        console.error("Erreur chargement local:", e);
        localChickens = []; localEggs = []; localTransactions = []; localTasks = [];
    }
}

// Supprimé loadFirebaseData() car remplacé par setupRealtimeSync

window.login = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
        console.error("Erreur connexion:", err);
        alert("Erreur de connexion : " + err.message);
    });
};

window.exportData = () => { 
    const data = { 
        chickens: localChickens, 
        eggs: localEggs, 
        transactions: localTransactions, 
        tasks: localTasks,
        exportDate: new Date().toISOString()
    };
    const a = document.createElement('a'); 
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2)); 
    a.download = `poulettes-backup-${new Date().toISOString().split('T')[0]}.json`; 
    a.click(); 
};

window.toggleDarkMode = () => { 
    document.body.classList.toggle('dark-mode'); 
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode')); 
};

// Sauvegarde avant fermeture de la page
window.addEventListener('beforeunload', () => {
    if (!isDemoMode && currentUser) {
        saveData();
    }
});
