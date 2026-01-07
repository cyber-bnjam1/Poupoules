// ====================================================================
// APP.JS - COEUR DE L'APPLICATION (Version Sécurisée)
// ====================================================================

// --- VARIABLES GLOBALES ---
let user = null;
let isDemoMode = false;

// Initialisation immédiate des variables pour éviter le bug "écran blanc"
let localChickens = [];
let localEggs = [];
let localTransactions = [];
let localTasks = [];

// On initialise l'objet des extensions ICI pour être sûr qu'il existe
window.localExtensionData = {
    recycling: [],
    health: [],
    sales: [],
    records: { heaviest: 0, lightest: 1000 },
    supplies: {},
    fridge: 0,
    stock: { quantity: 0, date: null },
    notes: []
};

// --- CONFIGURATION FIREBASE ---
const db = firebase.firestore();
const auth = firebase.auth();

// ====================================================================
// 1. DÉMARRAGE
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    auth.onAuthStateChanged((firebaseUser) => {
        if (firebaseUser) {
            user = firebaseUser;
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
            loadData();
        } else {
            user = null;
            if (!isDemoMode) {
                document.getElementById('auth-container').style.display = 'flex';
                document.getElementById('app-container').style.display = 'none';
            }
        }
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const viewId = e.currentTarget.getAttribute('data-target');
            switchView(viewId);
        });
    });
}

// Connexion / Déconnexion
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert("Erreur: " + e.message));
}
function logout() { auth.signOut().then(() => location.reload()); }

// ====================================================================
// 2. GESTION DES DONNÉES (CLOUD)
// ====================================================================

function loadData() {
    if (!user || isDemoMode) return;

    db.collection('users').doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            
            // Chargement des données de base
            localChickens = data.chickens || [];
            localEggs = data.eggs || [];
            localTransactions = data.transactions || [];
            localTasks = data.tasks || [];

            // Chargement des Extensions (Fusion sécurisée)
            if (data.extensions) {
                // On fusionne pour ne pas écraser les valeurs par défaut manquantes
                window.localExtensionData = { ...window.localExtensionData, ...data.extensions };
            }
            
            // TENTATIVE DE MIGRATION LOCALE -> CLOUD (Si c'est la première fois)
            if (typeof window.migrateLocalStorageToCloud === 'function') {
                window.migrateLocalStorageToCloud();
            }

            console.log("Données chargées.");
        } else {
            saveData(); // Création profil vierge
        }
        renderViews();
    }).catch((error) => console.error("Erreur chargement:", error));
}

function saveData() {
    if (!user || isDemoMode) return;

    const dataToSave = {
        chickens: localChickens,
        eggs: localEggs,
        transactions: localTransactions,
        tasks: localTasks,
        extensions: window.localExtensionData // Sauvegarde le gros objet extensions
    };

    db.collection('users').doc(user.uid).set(dataToSave).catch(e => console.error(e));
}

// ====================================================================
// 3. AFFICHAGE
// ====================================================================

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(viewId);
    if(target) target.classList.add('active');
    
    const navBtn = document.querySelector(`.nav-item[data-target="${viewId}"]`);
    if(navBtn) navBtn.classList.add('active');

    renderViews();
}

function renderViews() {
    renderDashboard();
    renderChickens();
    renderFinance();
    
    // Appel sécurisé aux extensions
    if (typeof window.renderExtensions === 'function') {
        window.renderExtensions();
    }
}

// --- DASHBOARD ---
function renderDashboard() {
    const activeCount = localChickens.filter(c => c.status === 'active').length;
    document.getElementById('summary-chicken-count').innerText = activeCount + " Poules";

    const now = new Date();
    let eggsThisMonth = 0;
    localEggs.forEach(e => {
        const d = new Date(e.date);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            eggsThisMonth += (e.count || 1);
        }
    });
    document.getElementById('summary-egg-count').innerText = eggsThisMonth + " Oeufs";
}

// --- POULES ---
function renderChickens() {
    const container = document.getElementById('chickens-list');
    if(!container) return;
    container.innerHTML = '';
    const activeFilter = document.querySelector('.segment-btn.active')?.innerText === 'Archives';

    localChickens.forEach(c => {
        if (activeFilter && c.status === 'active') return;
        if (!activeFilter && c.status === 'archived') return;

        const div = document.createElement('div');
        div.className = 'chicken-card';
        div.innerHTML = `
            <img src="${c.img || 'https://img.icons8.com/color/96/chicken.png'}" alt="Poule">
            <div class="info"><div class="name">${c.name}</div><div class="breed">${c.breed}</div></div>
            <button onclick="deleteChicken(${c.id})" style="border:none;background:none;color:#ccc;"><i class="fas fa-trash"></i></button>
        `;
        container.appendChild(div);
    });
}

// --- FINANCE ---
function renderFinance() {
    const list = document.getElementById('transaction-list');
    if(!list) return;
    list.innerHTML = '';
    let balance = 0;
    localTransactions.sort((a,b) => new Date(b.date) - new Date(a.date));
    localTransactions.forEach(t => {
        const isExpense = t.category === 'expense';
        balance += isExpense ? -t.amount : t.amount;
        const div = document.createElement('div');
        div.className = 'transaction-item';
        div.innerHTML = `
            <div class="icon-box ${isExpense ? 'expense' : 'income'}"><i class="fas ${isExpense ? 'fa-shopping-bag' : 'fa-coins'}"></i></div>
            <div class="details"><div class="cat">${t.type}</div><div class="date">${new Date(t.date).toLocaleDateString()}</div></div>
            <div class="amount ${isExpense ? 'negative' : 'positive'}">${isExpense ? '-' : '+'} ${parseFloat(t.amount).toFixed(2)} €</div>
        `;
        list.appendChild(div);
    });
    const balanceEl = document.querySelector('.balance-amount');
    if(balanceEl) balanceEl.innerText = balance.toFixed(2) + " €";
}

// --- FONCTIONS GLOBALES (MODALS) ---
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.switchView = switchView;
window.openAddChickenModal = () => document.getElementById('modal-chicken').style.display = 'flex';
window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');

window.saveChicken = (e) => {
    e.preventDefault();
    localChickens.push({ id: Date.now(), name: document.getElementById('c-name').value, breed: document.getElementById('c-breed').value, status: 'active' });
    saveData(); window.closeAllModals(); renderViews();
};
window.deleteChicken = (id) => {
    if(confirm("Archiver ?")) {
        const idx = localChickens.findIndex(c => c.id === id);
        if(idx > -1) { localChickens[idx].status = 'archived'; saveData(); renderViews(); }
    }
};
window.quickAddEgg = () => {
    localEggs.push({ id: Date.now(), date: new Date().toISOString(), count: 1 });
    if(window.updateFridge) window.updateFridge(1); else saveData();
    alert("🥚 Œuf ajouté !"); renderViews();
};
window.openTransactionModal = () => document.getElementById('modal-transaction').style.display = 'flex';
window.saveTransaction = (e) => {
    e.preventDefault();
    localTransactions.push({ id: Date.now(), category: document.getElementById('t-type').value, type: document.getElementById('t-label').value, amount: parseFloat(document.getElementById('t-amount').value), date: new Date().toISOString() });
    saveData(); window.closeAllModals(); renderViews();
};
