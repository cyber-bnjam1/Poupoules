// ====================================================================
// APP.JS - COEUR DE L'APPLICATION + SYNC EXTENSIONS
// ====================================================================

// --- VARIABLES GLOBALES ---
let user = null;
let isDemoMode = false;

// Données de base
let localChickens = [];
let localEggs = [];
let localTransactions = [];
let localTasks = [];

// Configuration Firebase (récupérée depuis le HTML normalement)
const db = firebase.firestore();
const auth = firebase.auth();

// ====================================================================
// 1. INITIALISATION
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
            loadData(); // Charge le Cloud et met à jour le LocalStorage
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
            // Cas spécial bouton central
            if(!viewId) return; 
            switchView(viewId);
        });
    });
}

// Connexion / Déconnexion
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => alert("Erreur: " + error.message));
}

function logout() {
    auth.signOut().then(() => location.reload());
}

function startDemo() {
    isDemoMode = true;
    user = { uid: 'demo' };
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    localChickens = [{ id: 1, name: 'Démo', breed: 'Rousse', status: 'active' }];
    renderViews();
    if(window.renderExtensions) window.renderExtensions();
}

// ====================================================================
// 2. GESTION DES DONNÉES (LE COEUR DE LA SYNCHRO)
// ====================================================================

// CHARGEMENT (CLOUD -> LOCAL)
function loadData() {
    if (!user || isDemoMode) return;

    const docRef = db.collection('users').doc(user.uid);

    docRef.get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            
            // 1. Données App (Poules, Oeufs...)
            localChickens = data.chickens || [];
            localEggs = data.eggs || [];
            localTransactions = data.transactions || [];
            localTasks = data.tasks || [];

            // 2. SYNCHRONISATION EXTENSIONS (C'est ici que ça se joue)
            // On prend les données du Cloud et on écrase le LocalStorage du téléphone
            if (data.extensions) {
                if (data.extensions.recycling) {
                    localStorage.setItem('poupoules_recycling_history', JSON.stringify(data.extensions.recycling));
                    // On met à jour la variable globale dans extensions.js si elle est chargée
                    if (typeof window.recyclingHistory !== 'undefined') {
                        window.recyclingHistory = data.extensions.recycling;
                    }
                }
                // (On pourrait ajouter ici health, supplies, etc. sur le même modèle)
            }

            console.log("✅ Données Cloud chargées et injectées en local.");
        } else {
            console.log("✨ Nouveau profil détecté.");
            saveData(); 
        }
        
        // 3. Affichage
        renderViews();
        
        // On force le rafraîchissement du widget Recycleur maintenant qu'on a les données Cloud
        if (typeof window.renderRecyclerWidget === 'function') {
            window.renderRecyclerWidget();
        }

    }).catch((error) => console.error("Erreur chargement:", error));
}

// SAUVEGARDE (LOCAL -> CLOUD)
function saveData() {
    if (!user || isDemoMode) return;

    // 1. On récupère les dernières données du LocalStorage (Extensions)
    // On lit la mémoire du téléphone pour être sûr d'avoir les derniers ajouts (pains, etc.)
    const currentRecycling = JSON.parse(localStorage.getItem('poupoules_recycling_history') || '[]');

    // 2. On prépare le paquet complet
    const dataToSave = {
        chickens: localChickens,
        eggs: localEggs,
        transactions: localTransactions,
        tasks: localTasks,
        // On sauvegarde l'extension dans un objet dédié
        extensions: {
            recycling: currentRecycling
            // plus tard: health, stock, etc.
        }
    };

    // 3. Envoi Firebase
    db.collection('users').doc(user.uid).set(dataToSave)
        .then(() => console.log("☁️ Sauvegarde Cloud réussie"))
        .catch((error) => console.error("Erreur sauvegarde:", error));
}

// ====================================================================
// 3. AFFICHAGE ET ACTIONS
// ====================================================================

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const target = document.getElementById(viewId);
    if(target) target.classList.add('active');
    
    const navBtn = document.querySelector(`.nav-item[data-target="${viewId}"]`);
    if(navBtn) navBtn.classList.add('active');

    renderViews();
    // Si on retourne à l'accueil, on rafraîchit les extensions
    if(viewId === 'view-dashboard' && window.renderExtensions) window.renderExtensions();
}

function renderViews() {
    renderDashboard();
    renderChickens();
    renderFinance();
}

// --- VUE DASHBOARD ---
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
    
    // Graphique Chart.js (si présent)
    renderChart();
}

function renderChart() {
    const ctx = document.getElementById('ponteChart');
    if(!ctx) return;
    // (Code du graphique simplifié ou appel Chart.js si tu l'utilises)
}

// --- VUE POULES ---
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
            <div class="info">
                <div class="name">${c.name}</div>
                <div class="breed">${c.breed}</div>
            </div>
            <button onclick="deleteChicken(${c.id})"><i class="fas fa-trash"></i></button>
        `;
        container.appendChild(div);
    });
}

// --- VUE FINANCE ---
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
            <div class="details">
                <div class="cat">${t.type}</div>
                <div class="date">${new Date(t.date).toLocaleDateString()}</div>
            </div>
            <div class="amount ${isExpense ? 'negative' : 'positive'}">
                ${isExpense ? '-' : '+'} ${parseFloat(t.amount).toFixed(2)} €
            </div>
        `;
        list.appendChild(div);
    });
    const balanceEl = document.querySelector('.balance-amount');
    if(balanceEl) balanceEl.innerText = balance.toFixed(2) + " €";
}

// --- MODALS & ACTIONS ---
function openAddChickenModal() { document.getElementById('modal-chicken').style.display = 'flex'; }
function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }

function saveChicken(e) {
    e.preventDefault();
    localChickens.push({
        id: Date.now(),
        name: document.getElementById('c-name').value,
        breed: document.getElementById('c-breed').value,
        status: 'active'
    });
    saveData(); closeAllModals(); renderViews();
}

function deleteChicken(id) {
    if(confirm("Archiver ?")) {
        const idx = localChickens.findIndex(c => c.id === id);
        if (idx > -1) { localChickens[idx].status = 'archived'; saveData(); renderViews(); }
    }
}

function quickAddEgg() {
    localEggs.push({ id: Date.now(), date: new Date().toISOString(), count: 1 });
    saveData();
    alert("🥚 Œuf ajouté !");
    renderViews();
}

function openTransactionModal() { document.getElementById('modal-transaction').style.display = 'flex'; }
function saveTransaction(e) {
    e.preventDefault();
    localTransactions.push({
        id: Date.now(),
        category: document.getElementById('t-type').value,
        type: document.getElementById('t-label').value,
        amount: parseFloat(document.getElementById('t-amount').value),
        date: new Date().toISOString()
    });
    saveData(); closeAllModals(); renderViews();
}

// EXPORT GLOBAL
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.startDemo = startDemo;
window.switchView = switchView;
window.saveData = saveData; // Important pour extensions.js
window.loadData = loadData;
window.openAddChickenModal = openAddChickenModal;
window.closeAllModals = closeAllModals;
window.saveChicken = saveChicken;
window.deleteChicken = deleteChicken;
window.quickAddEgg = quickAddEgg;
window.openTransactionModal = openTransactionModal;
window.saveTransaction = saveTransaction;
