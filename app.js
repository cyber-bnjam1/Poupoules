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
if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
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

// ============================================================
// STATE GLOBAL
// ============================================================
let localChickens = [], localEggs = [], localTasks = [];

// Données extensions conservées
let extNotes = [];
let extHealth = [];
let extSuppliesState = {};
let extEggRecords = { heaviest: 0, lightest: 1000 };

let currentUser = null, isDemoMode = true;
let currentViewId = 'view-dashboard';
let tempPhotoBase64 = null;
let unsubscribeFirestore = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }
    updateFabVisibility('view-dashboard');

    loadLocalData();

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            isDemoMode = false;
            await checkAndMigrateLocalData(user.uid);
            setupRealtimeSync(user.uid);
            updateUIForConnectedUser(user);
        } else {
            currentUser = null;
            isDemoMode = true;
            if (unsubscribeFirestore) {
                unsubscribeFirestore();
                unsubscribeFirestore = null;
            }
            loadLocalData();
            updateUIForGuestUser();
        }
    });

    document.querySelectorAll('.close-modal').forEach(b => {
        b.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none');
    });

    document.getElementById('form-add-egg').addEventListener('submit', (e) => {
        e.preventDefault();
        const count = parseInt(document.getElementById('egg-count-input').value);
        const date = document.getElementById('egg-date-input').value;
        const chickenId = document.getElementById('egg-chicken-input').value; 
        
        if (count > 0 && date) {
            const newEgg = {
                id: 'e' + Date.now(),
                count: count,
                date: new Date(date).toISOString(),
                chickenId: chickenId || null, 
                createdAt: new Date().toISOString()
            };
            localEggs.push(newEgg);
            saveData();
            renderDashboard();
            document.getElementById('modal-add-egg').style.display = 'none';
        }
    });
});

// ============================================================
// MIGRATION : LocalStorage vers Firebase à la première connexion
// ============================================================
async function checkAndMigrateLocalData(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) {
            console.log("Migration des donnees locales vers Firebase...");
            const coreData = JSON.parse(localStorage.getItem('poupoules_data') || '{}');
            const extData = buildExtDataFromLocalStorage();
            await db.collection('users').doc(uid).set({
                chickens: coreData.chickens || [],
                eggs: coreData.eggs || [],
                tasks: coreData.tasks || [],
                ...extData,
                lastSync: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Migration reussie !");
        }
    } catch (error) {
        console.error("Erreur lors de la migration:", error);
    }
}

function buildExtDataFromLocalStorage() {
    return {
        extNotes:         JSON.parse(localStorage.getItem('poupoules_notes') || '[]'),
        extHealth:        JSON.parse(localStorage.getItem('poupoules_health') || '[]'),
        extSuppliesState: JSON.parse(localStorage.getItem('poupoules_supplies') || '{}'),
        extEggRecords:    JSON.parse(localStorage.getItem('poupoules_records') || '{"heaviest":0,"lightest":1000}'),
    };
}

// ============================================================
// SYNCHRONISATION TEMPS RÉEL
// ============================================================
let _syncInProgress = false;

function setupRealtimeSync(uid) {
    if (unsubscribeFirestore) unsubscribeFirestore();

    updateSyncStatus('loading');

    const localDateStr = localStorage.getItem('poupoules_last_update');
    const localDate = localDateStr ? new Date(localDateStr) : new Date(0);
    let initialPushDone = false;

    unsubscribeFirestore = db.collection('users').doc(uid)
        .onSnapshot({ includeMetadataChanges: false }, (doc) => {
            if (doc.metadata.hasPendingWrites || doc.metadata.fromCache) return;

            if (doc.exists) {
                const data = doc.data();

                if (!initialPushDone) {
                    initialPushDone = true;
                    const firebaseDate = data.lastLocalUpdate ? new Date(data.lastLocalUpdate) : new Date(0);
                    if (localDate > firebaseDate) {
                        console.log('[Firebase] Local plus récent, push initial vers Firebase');
                        saveData();
                        updateSyncStatus('ok');
                        return;
                    }
                }

                localChickens = data.chickens || [];
                localEggs     = data.eggs     || [];
                localTasks    = data.tasks    || [];

                extNotes         = data.extNotes         || [];
                extHealth        = data.extHealth        || [];
                extSuppliesState = data.extSuppliesState || {};
                extEggRecords    = data.extEggRecords    || { heaviest: 0, lightest: 1000 };

                persistToLocalStorage();
                renderChickensList();
                renderDashboard();
                renderMaintenance();

                updateSyncStatus('ok');
                console.log(`[Firebase] Sync OK — ${localChickens.length} poules, ${localEggs.length} oeufs`);
            } else {
                initialPushDone = true;
                console.log("[Firebase] Document absent, création depuis localStorage...");
                db.collection('users').doc(uid).set({
                    chickens: localChickens, eggs: localEggs, tasks: localTasks,
                    ...buildExtDataFromLocalStorage(),
                    lastLocalUpdate: new Date().toISOString(),
                    lastSync: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }, (error) => {
            console.error("[Firebase] Erreur de synchronisation:", error);
            updateSyncStatus('error');
            loadLocalData();
        });
}

function updateSyncStatus(state) {
    const badge = document.getElementById('header-status');
    if (!badge) return;
    if (state === 'loading') {
        badge.classList.remove('status-green', 'status-red', 'status-orange', 'demo');
        badge.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        badge.title = 'Synchronisation en cours...';
    } else if (state === 'ok') {
        badge.classList.remove('status-orange', 'status-red', 'demo');
        badge.classList.add('status-green');
        badge.innerHTML = '<i class="fas fa-wifi"></i>';
        badge.title = 'Synchronise avec Firebase';
    } else if (state === 'error') {
        badge.classList.remove('status-green', 'status-orange', 'demo');
        badge.classList.add('status-red');
        badge.innerHTML = '<i class="fas fa-wifi"></i>';
        badge.title = 'Erreur de synchronisation — donnees locales';
    }
}

window.forceSyncFromFirebase = async () => {
    if (!currentUser) { alert("Vous devez etre connecte pour synchroniser."); return; }
    const btn = document.getElementById('btn-force-sync');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sync...'; }
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            localChickens = data.chickens || [];
            localEggs     = data.eggs     || [];
            localTasks    = data.tasks    || [];
            extNotes         = data.extNotes         || [];
            extHealth        = data.extHealth        || [];
            extSuppliesState = data.extSuppliesState || {};
            extEggRecords    = data.extEggRecords    || { heaviest: 0, lightest: 1000 };
            persistToLocalStorage();
            renderChickensList();
            renderDashboard();
            renderMaintenance();
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Synchronise !'; setTimeout(() => { btn.innerHTML = '<i class="fas fa-sync-alt"></i> Forcer la synchronisation'; }, 2000); }
        } else {
            alert("Aucune donnee trouvee sur Firebase pour ce compte.");
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Forcer la synchronisation'; }
        }
    } catch (err) {
        console.error("[Firebase] Erreur sync forcee:", err);
        alert("Erreur : " + err.message);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Forcer la synchronisation'; }
    }
};

// ============================================================
// SAUVEGARDE UNIFIÉE
// ============================================================
function saveData() {
    persistToLocalStorage();

    if (!isDemoMode && currentUser) {
        db.collection('users').doc(currentUser.uid).set({
            ...buildFullPayload(),
            lastSync: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        .catch(err => {
            console.error("Erreur sauvegarde Firebase:", err);
        });
    }
}

function buildFullPayload() {
    return {
        chickens:        localChickens,
        eggs:            localEggs,
        tasks:           localTasks,
        lastLocalUpdate: new Date().toISOString(),
        extNotes,
        extHealth,
        extSuppliesState,
        extEggRecords,
    };
}

function persistToLocalStorage() {
    try {
        const now = new Date().toISOString();
        localStorage.setItem('poupoules_data', JSON.stringify({
            chickens: localChickens, eggs: localEggs, tasks: localTasks,
            lastLocalUpdate: now
        }));
        localStorage.setItem('poupoules_last_update', now);
        localStorage.setItem('poupoules_notes',    JSON.stringify(extNotes));
        localStorage.setItem('poupoules_health',   JSON.stringify(extHealth));
        localStorage.setItem('poupoules_supplies', JSON.stringify(extSuppliesState));
        localStorage.setItem('poupoules_records',  JSON.stringify(extEggRecords));
    } catch (e) {
        console.error("Erreur persistance localStorage:", e);
    }
}

// ============================================================
// CHARGEMENT LOCAL
// ============================================================
function loadLocalData() {
    try {
        const d = JSON.parse(localStorage.getItem('poupoules_data') || '{}');
        localChickens = d.chickens || [];
        localEggs     = d.eggs     || [];
        localTasks    = d.tasks    || [];

        extNotes         = JSON.parse(localStorage.getItem('poupoules_notes')    || '[]');
        extHealth        = JSON.parse(localStorage.getItem('poupoules_health')   || '[]');
        extSuppliesState = JSON.parse(localStorage.getItem('poupoules_supplies') || '{}');
        extEggRecords    = JSON.parse(localStorage.getItem('poupoules_records')  || '{"heaviest":0,"lightest":1000}');

        renderChickensList();
        renderDashboard();
        renderMaintenance();
    } catch (e) {
        console.error("Erreur chargement local:", e);
        localChickens = []; localEggs = []; localTasks = [];
    }
}

// ============================================================
// UI CONNEXION
// ============================================================
function updateUIForConnectedUser(user) {
    const statusBadge = document.getElementById('header-status');
    if (statusBadge) {
        statusBadge.classList.remove('demo', 'status-orange', 'status-red');
        statusBadge.classList.add('status-green');
        statusBadge.innerHTML = '<i class="fas fa-wifi"></i>';
        statusBadge.title = 'Synchronise avec Firebase';
    }
    document.getElementById('auth-container').innerHTML = `
        <img src="${user.photoURL || 'icon.png'}" style="width:80px; height:80px; border-radius:50%; margin-bottom:10px;">
        <h3>${user.displayName || 'Utilisateur'}</h3>
        <p style="color:gray; margin-bottom:15px;">${user.email}</p>
        <button class="btn-text-danger" onclick="auth.signOut()">Se deconnecter</button>
        <div style="margin-top:10px; font-size:12px; color:var(--success);">
            <i class="fas fa-cloud"></i> Toutes les donnees synchronisees
        </div>`;
}

function updateUIForGuestUser() {
    const statusBadge = document.getElementById('header-status');
    if (statusBadge) {
        statusBadge.classList.remove('status-green', 'status-orange', 'status-red');
        statusBadge.classList.add('demo', 'status-orange');
        statusBadge.innerHTML = '<i class="fas fa-wifi"></i>';
        statusBadge.title = 'Mode invite - donnees locales uniquement';
    }
    document.getElementById('auth-container').innerHTML = `
        <div style="width:80px; height:80px; background:#ddd; border-radius:50%; margin:0 auto 10px auto; display:flex; align-items:center; justify-content:center; font-size:30px; color:white;"><i class="fas fa-user"></i></div>
        <h3>Mode Invite</h3>
        <p style="color:gray; margin-bottom:15px;">Sauvegarde locale uniquement</p>
        <button class="btn-primary" onclick="login()">Connexion Google</button>
        <div style="margin-top:10px; font-size:12px; color:var(--warning);">
            <i class="fas fa-exclamation-triangle"></i> Risque de perte de donnees
        </div>`;
}

// ============================================================
// NAVIGATION
// ============================================================
window.toggleMenu = () => document.getElementById('menu-overlay').classList.toggle('open');

window.navigate = (targetId) => {
    document.getElementById('menu-overlay').classList.remove('open');
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));

    if (targetId === 'view-stats' && window.renderStatsView) {
        window.renderStatsView();
    }

    const target = document.getElementById(targetId);
    if (target) target.classList.add('active-view');

    currentViewId = targetId;
    updateFabVisibility(targetId);

    const sc = document.getElementById('scroll-container');
    if (sc) sc.scrollTop = 0;
};

function updateFabVisibility(viewId) {
    const fab = document.getElementById('main-fab');
    if (['view-chickens', 'view-maintenance'].includes(viewId)) {
        fab.classList.remove('hidden');
    } else {
        fab.classList.add('hidden');
    }
}

window.handleFabClick = () => {
    if (currentViewId === 'view-chickens') openChickenModal();
    if (currentViewId === 'view-maintenance') openEditTaskModal();
};

window.adjustEggCount = (val) => {
    const input = document.getElementById('egg-count-input');
    let v = parseInt(input.value) + val;
    if (v < 1) v = 1;
    input.value = v;
};

// ============================================================
// POULES
// ============================================================
function renderChickensList() {
    const grid = document.getElementById('chickens-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const filter = document.querySelector('#btn-filter-active').classList.contains('active') ? 'active' : 'archived';

    const list = localChickens
        .filter(c => (c.status || 'active') === filter)
        .sort((a, b) => (b.isFavorite === true) - (a.isFavorite === true));

    const title = document.querySelector('#view-chickens .big-title');
    if (title) title.innerText = `Mon Cheptel (${list.length})`;

    if (list.length === 0) {
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
        if (localChickens[idx].status === 'archived') {
            if (confirm("Supprimer definitivement cette poule ?")) localChickens.splice(idx, 1);
        } else {
            if (confirm("Archiver cette poule ?")) localChickens[idx].status = 'archived';
            else return;
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
    if (id) {
        const c = localChickens.find(x => x.id === id);
        document.getElementById('modal-chicken-title').innerText = "Modifier";
        document.getElementById('chicken-id').value = c.id;
        document.getElementById('chicken-name').value = c.name;
        document.getElementById('chicken-breed').value = c.breed;
        document.getElementById('chicken-date').value = c.date;
        document.getElementById('chicken-health').value = c.health;
        if (c.photo) document.getElementById('preview-photo').src = c.photo;
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
        name:   document.getElementById('chicken-name').value,
        breed:  document.getElementById('chicken-breed').value,
        date:   document.getElementById('chicken-date').value,
        health: document.getElementById('chicken-health').value,
        photo:  tempPhotoBase64 || document.getElementById('preview-photo').src
    };
    if (id) {
        const idx = localChickens.findIndex(c => c.id === id);
        if (idx > -1) localChickens[idx] = { ...localChickens[idx], ...data };
    } else {
        localChickens.push({ id: 'c' + Date.now(), ...data, status: 'active', isFavorite: false, createdAt: new Date().toISOString() });
    }
    saveData();
    document.getElementById('modal-chicken').style.display = 'none';
    renderChickensList();
});

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Lundi
    startOfWeek.setHours(0,0,0,0);

    let monthCount = 0, weekCount = 0;

    localEggs.forEach(e => {
        const qty = e.count || 1;
        const d = new Date(e.date);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) monthCount += qty;
        if (d >= startOfWeek && d <= now) weekCount += qty;
    });

    const monthDisplay = document.getElementById('eggs-month-count');
    const weekDisplay = document.getElementById('eggs-week-count');
    if (monthDisplay) monthDisplay.innerText = monthCount;
    if (weekDisplay) weekDisplay.innerText = weekCount;

    const list = document.getElementById('recent-activity-list');
    if (!list) return;
    list.innerHTML = '';

    [...localEggs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).forEach(e => {
        const qty = e.count || 1;
        const chicken = localChickens.find(c => c.id === e.chickenId);
        const author = chicken ? chicken.name : 'Général';
        const iconColor = chicken ? 'var(--primary)' : '#ff9500';

        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="background:${iconColor}; width:10px; height:10px; border-radius:50%;"></div>
                <strong>${author}</strong>
            </div>
            <div style="text-align:right;">
                <span style="display:block; font-weight:bold;">${qty} oeuf${qty > 1 ? 's' : ''}</span>
                <span style="font-size:11px; color:gray;">${new Date(e.date).toLocaleDateString()}</span>
            </div>
            <button class="btn-text-danger" style="margin-left:10px;" onclick="deleteEgg('${e.id}')"><i class="fas fa-trash"></i></button>
        `;
        list.appendChild(li);
    });

    if (window.renderExtensions) window.renderExtensions();
}

window.openAddEggModal = () => {
    document.getElementById('egg-count-input').value = 1;
    document.getElementById('egg-date-input').valueAsDate = new Date();
    
    const select = document.getElementById('egg-chicken-input');
    select.innerHTML = '<option value="">-- Non spécifié / Général --</option>';
    localChickens.filter(c => (c.status || 'active') === 'active').forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name} (${c.breed || 'Inconnue'})</option>`;
    });

    document.getElementById('modal-add-egg').style.display = 'flex';
};

window.deleteEgg = (id) => {
    if (confirm("Supprimer ce ramassage ?")) {
        localEggs = localEggs.filter(e => e.id !== id);
        saveData();
        renderDashboard();
    }
};

// ============================================================
// ENTRETIEN
// ============================================================
function renderMaintenance() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    list.innerHTML = '';
    updateMaintenanceBadge();

    localTasks.sort((a, b) => getDaysDiff(b.lastDone) - getDaysDiff(a.lastDone)).forEach(t => {
        const diff = getDaysDiff(t.lastDone);
        let percent = Math.max(0, 100 - ((diff / t.frequency) * 100));
        const barColor = percent < 20 ? 'var(--danger)' : (percent < 50 ? 'var(--warning)' : 'var(--success)');

        const li = document.createElement('li');
        li.style.cssText = "display:flex; align-items:center; gap:15px;";
        li.innerHTML = `
            <div style="flex:1; cursor:pointer;" onclick="openEditTaskModal('${t.id}')">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong>${t.title}</strong>
                    <small style="color:${diff >= t.frequency ? 'var(--danger)' : 'var(--text-grey)'}">
                        ${diff >= t.frequency ? 'En retard' : (t.frequency - diff) + 'j restants'}
                    </small>
                </div>
                <div style="width:100%; height:6px; background:rgba(0,0,0,0.05); border-radius:3px; overflow:hidden;">
                    <div style="width:${percent}%; height:100%; background:${barColor}; transition:width 0.5s ease;"></div>
                </div>
                <div style="margin-top:5px; font-size:11px; color:var(--text-grey); display:flex; justify-content:space-between;">
                    <span>Fait il y a ${diff}j</span><span>Freq: ${t.frequency}j</span>
                </div>
            </div>
            <button style="width:40px; height:40px; border-radius:50%; border:none; background:${diff >= t.frequency ? 'var(--danger)' : 'rgba(0,0,0,0.05)'}; color:${diff >= t.frequency ? 'white' : 'var(--primary)'}; display:flex; align-items:center; justify-content:center; font-size:16px; cursor:pointer;" onclick="event.stopPropagation(); completeTask('${t.id}')">
                <i class="fas fa-check"></i>
            </button>
        `;
        list.appendChild(li);
    });
}

window.completeTask = (id) => {
    const t = localTasks.find(x => x.id === id);
    if (t) { t.lastDone = new Date().toISOString(); saveData(); renderMaintenance(); }
};

window.openEditTaskModal = (id = null) => {
    document.getElementById('form-task').reset();
    if (id) {
        const t = localTasks.find(x => x.id === id);
        document.getElementById('task-id').value = t.id;
        document.getElementById('task-title').value = t.title;
        document.getElementById('task-freq').value = t.frequency;
        document.getElementById('btn-delete-task').style.display = 'block';
    } else {
        document.getElementById('task-id').value = "";
        document.getElementById('btn-delete-task').style.display = 'none';
    }
    document.getElementById('modal-edit-task').style.display = 'flex';
};

document.getElementById('form-task').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const data = { title: document.getElementById('task-title').value, frequency: parseInt(document.getElementById('task-freq').value) };
    if (id) {
        const idx = localTasks.findIndex(t => t.id === id);
        if (idx > -1) localTasks[idx] = { ...localTasks[idx], ...data };
    } else {
        localTasks.push({ id: 'task' + Date.now(), ...data, lastDone: new Date().toISOString(), createdAt: new Date().toISOString() });
    }
    saveData();
    document.getElementById('modal-edit-task').style.display = 'none';
    renderMaintenance();
});

window.deleteCurrentTask = () => {
    if (confirm("Supprimer cette tache ?")) {
        localTasks = localTasks.filter(t => t.id !== document.getElementById('task-id').value);
        saveData();
        document.getElementById('modal-edit-task').style.display = 'none';
        renderMaintenance();
    }
};

// ============================================================
// UTILS
// ============================================================
window.handlePhotoUpload = (input) => {
    if (input.files && input.files[0]) {
        compressImage(input.files[0], 150, 0.4)
            .then(b => { document.getElementById('preview-photo').src = b; tempPhotoBase64 = b; })
            .catch(err => console.error("Erreur compression image:", err));
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
                let w = img.width, h = img.height;
                if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; }
                elem.width = w; elem.height = h;
                elem.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(elem.toDataURL('image/webp', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

function getAge(d) {
    if (!d) return '';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 7) return 'Poussin';
    if (days < 30) return Math.floor(days / 7) + ' sem.';
    const m = Math.floor(days / 30);
    return m < 12 ? m + ' mois' : Math.floor(m / 12) + ' an' + (Math.floor(m / 12) > 1 ? 's' : '');
}

function updateMaintenanceBadge() {
    const badge = document.getElementById('maintenance-badge');
    if (!badge) return;
    const overdueCount = localTasks.filter(t => getDaysDiff(t.lastDone) >= t.frequency).length;
    if (overdueCount > 0) {
        badge.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:var(--danger);"></i> ${overdueCount}`;
        badge.style.color = 'var(--danger)';
    } else {
        badge.innerHTML = `<i class="fas fa-check" style="color:var(--success);"></i>`;
        badge.style.color = 'var(--success)';
    }
}

function getDaysDiff(d) {
    return Math.floor((new Date() - new Date(d)) / (1000 * 60 * 60 * 24));
}

// ============================================================
// AUTH & EXPORT
// ============================================================
window.login = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
        console.error("Erreur connexion:", err);
        alert("Erreur de connexion : " + err.message);
    });
};

window.exportData = () => {
    const data = { ...buildFullPayload(), exportDate: new Date().toISOString() };
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    a.download = `poulettes-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};
