// ====================================================================
// APP.JS - COEUR DE L'APPLICATION (Version Cloud Complete)
// Gère : Auth, Navigation, Données de base + SYNC EXTENSIONS
// ====================================================================

// --- VARIABLES GLOBALES ---
let user = null;
let isDemoMode = false;

// Données Principales
let localChickens = [];
let localEggs = [];
let localTransactions = [];
let localTasks = [];

// (Note : window.localExtensionData est géré dans extensions.js mais sauvegardé ici)

// --- CONFIGURATION FIREBASE ---
// (Si tu as ta config ici, garde-la. Sinon, elle est probablement dans ton HTML)
const db = firebase.firestore();
const auth = firebase.auth();

// ====================================================================
// 1. INITIALISATION & AUTHENTIFICATION
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Écouteur d'état de connexion
    auth.onAuthStateChanged((firebaseUser) => {
        if (firebaseUser) {
            user = firebaseUser;
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
            loadData(); // On charge TOUT (y compris extensions)
        } else {
            user = null;
            if (!isDemoMode) {
                document.getElementById('auth-container').style.display = 'flex';
                document.getElementById('app-container').style.display = 'none';
            }
        }
    });

    // Navigation (Onglets du bas)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const viewId = e.currentTarget.getAttribute('data-target');
            switchView(viewId);
        });
    });
}

// Connexion Google
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
        console.error("Erreur Auth:", error);
        alert("Erreur de connexion : " + error.message);
    });
}

// Déconnexion
function logout() {
    auth.signOut().then(() => {
        location.reload();
    });
}

// Mode Démo
function startDemo() {
    isDemoMode = true;
    user = { uid: 'demo' };
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    
    // Données fictives pour la démo
    localChickens = [
        { id: 1, name: 'Gertrude', breed: 'Rousse', age: 2, status: 'active', img: 'https://img.icons8.com/color/96/chicken.png' },
        { id: 2, name: 'Huguette', breed: 'Sussex', age: 1, status: 'active', img: 'https://img.icons8.com/color/96/chicken.png' }
    ];
    localEggs = [];
    localTransactions = [];
    
    renderViews();
    if(window.renderExtensions) window.renderExtensions();
}

// ====================================================================
// 2. GESTION DES DONNÉES (CLOUD SYNC) - C'EST ICI QUE TOUT SE JOUE
// ====================================================================

// CHARGEMENT
function loadData() {
    if (!user || isDemoMode) return;

    const docRef = db.collection('users').doc(user.uid);

    docRef.get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            
            // 1. Chargement des données de base
            localChickens = data.chickens || [];
            localEggs = data.eggs || [];
            localTransactions = data.transactions || [];
            localTasks = data.tasks || [];

            // 2. Chargement des Extensions (LA NOUVEAUTÉ IMPORTANTE)
            // On vérifie si extensions.js a bien initialisé la variable, sinon on le fait
            if (typeof window.localExtensionData === 'undefined') {
                window.localExtensionData = {};
            }
            
            // On fusionne avec ce qui vient du Cloud
            if (data.extensions) {
                window.localExtensionData = data.extensions;
            }

            console.log("Données chargées depuis le Cloud !");
        } else {
            console.log("Nouvel utilisateur, création du profil...");
            saveData(); // Crée le document vide
        }
        
        // 3. Affichage
        renderViews();
        
        // On force le rafraîchissement des widgets (Météo, Stocks, etc.)
        if (typeof window.renderExtensions === 'function') {
            window.renderExtensions();
        }

    }).catch((error) => {
        console.error("Erreur chargement:", error);
    });
}

// SAUVEGARDE
function saveData() {
    if (!user || isDemoMode) return;

    // On prépare le paquet à envoyer
    // On s'assure que window.localExtensionData existe (évite les bugs)
    const extensionsToSave = window.localExtensionData || {};

    const dataToSave = {
        chickens: localChickens,
        eggs: localEggs,
        transactions: localTransactions,
        tasks: localTasks,
        extensions: extensionsToSave // <--- SAUVEGARDE TOUT CE QUI EST DANS EXTENSIONS.JS
    };

    db.collection('users').doc(user.uid).set(dataToSave)
        .then(() => {
            console.log("Sauvegarde Cloud OK");
        })
        .catch((error) => {
            console.error("Erreur sauvegarde:", error);
        });
}

// ====================================================================
// 3. GESTION DE L'AFFICHAGE (VIEWS)
// ====================================================================

function switchView(viewId) {
    // Masquer toutes les vues
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Afficher la vue demandée
    const target = document.getElementById(viewId);
    if(target) target.classList.add('active');
    
    // Activer le bouton nav correspondant
    const navBtn = document.querySelector(`.nav-item[data-target="${viewId}"]`);
    if(navBtn) navBtn.classList.add('active');

    // Rafraîchir les données
    renderViews();
    
    // Si on retourne sur le Dashboard, on réaffiche bien les extensions
    if (viewId === 'view-dashboard' && typeof window.renderExtensions === 'function') {
        window.renderExtensions();
    }
}

function renderViews() {
    renderDashboard();
    renderChickens();
    renderFinance();
    // Les extensions s'injectent toutes seules via extensions.js
}

// --- VUE DASHBOARD ---
function renderDashboard() {
    // Résumé Poules
    const activeCount = localChickens.filter(c => c.status === 'active').length;
    document.getElementById('summary-chicken-count').innerText = activeCount + " Poules";

    // Résumé Oeufs (Mois en cours)
    const now = new Date();
    let eggsThisMonth = 0;
    localEggs.forEach(e => {
        const d = new Date(e.date);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            eggsThisMonth += (e.count || 1);
        }
    });
    document.getElementById('summary-egg-count').innerText = eggsThisMonth + " Oeufs";

    // Graphique simple (Si présent)
    renderChart();
}

// Graphique Ponte (Simplifié)
function renderChart() {
    const ctx = document.getElementById('ponteChart');
    if(!ctx) return;
    
    // Données factices pour l'exemple visuel (à connecter aux vraies données si tu veux aller plus loin)
    // Ici on laisse le CSS gérer les barres pour l'instant
}

// --- VUE POULES ---
function renderChickens() {
    const container = document.getElementById('chickens-list');
    if(!container) return;
    container.innerHTML = '';

    const activeFilter = document.querySelector('.segment-btn.active')?.innerText === 'Archives';

    localChickens.forEach(c => {
        // Filtre Actif/Archive
        if (activeFilter && c.status === 'active') return;
        if (!activeFilter && c.status === 'archived') return;

        const div = document.createElement('div');
        div.className = 'chicken-card';
        div.innerHTML = `
            <img src="${c.img || 'https://img.icons8.com/color/96/chicken.png'}" alt="Poule">
            <div class="info">
                <div class="name">${c.name}</div>
                <div class="breed">${c.breed} • ${c.age} ans</div>
            </div>
            <button onclick="deleteChicken(${c.id})" style="background:transparent; border:none; color:#ccc;"><i class="fas fa-trash"></i></button>
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
    
    // Tri par date décroissante
    localTransactions.sort((a,b) => new Date(b.date) - new Date(a.date));

    localTransactions.forEach(t => {
        const isExpense = t.category === 'expense';
        balance += isExpense ? -t.amount : t.amount;

        const div = document.createElement('div');
        div.className = 'transaction-item';
        div.innerHTML = `
            <div class="icon-box ${isExpense ? 'expense' : 'income'}">
                <i class="fas ${isExpense ? 'fa-shopping-bag' : 'fa-coins'}"></i>
            </div>
            <div class="details">
                <div class="cat">${t.type || (isExpense ? 'Dépense' : 'Vente')}</div>
                <div class="date">${new Date(t.date).toLocaleDateString()}</div>
            </div>
            <div class="amount ${isExpense ? 'negative' : 'positive'}">
                ${isExpense ? '-' : '+'} ${parseFloat(t.amount).toFixed(2)} €
            </div>
        `;
        list.appendChild(div);
    });

    // Mise à jour Solde total
    const balanceEl = document.querySelector('.balance-amount');
    if(balanceEl) balanceEl.innerText = balance.toFixed(2) + " €";
}


// ====================================================================
// 4. ACTIONS UTILISATEUR (MODALS & AJOUTS)
// ====================================================================

// --- POULES ---
function openAddChickenModal() {
    document.getElementById('modal-chicken').style.display = 'flex';
}
function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}
function saveChicken(e) {
    e.preventDefault();
    const name = document.getElementById('c-name').value;
    const breed = document.getElementById('c-breed').value;
    
    localChickens.push({
        id: Date.now(),
        name: name,
        breed: breed,
        age: 1,
        status: 'active',
        img: 'https://img.icons8.com/color/96/chicken.png'
    });
    
    saveData(); // Sauvegarde Cloud
    closeAllModals();
    renderChickens();
    renderDashboard();
    
    // Check succès "Débutant"
    if(window.renderExtensions) window.renderExtensions();
}
function deleteChicken(id) {
    if(confirm("Voulez-vous archiver cette poule ?")) {
        const idx = localChickens.findIndex(c => c.id === id);
        if (idx > -1) {
            localChickens[idx].status = 'archived';
            saveData();
            renderChickens();
            renderDashboard();
        }
    }
}

// --- OEUFS ---
function quickAddEgg() {
    // Ajout d'un œuf au jour actuel
    localEggs.push({
        id: Date.now(),
        date: new Date().toISOString(),
        count: 1
    });
    
    // Animation visuelle simple
    alert("🥚 Œuf ajouté !");
    
    // Mise à jour Frigo dans extension si dispo
    if (typeof window.updateFridge === 'function') {
        window.updateFridge(1); 
    } else {
        saveData(); // Si pas d'extension, on sauvegarde quand même
    }
    
    renderDashboard();
}

// --- FINANCE ---
function openTransactionModal() {
    document.getElementById('modal-transaction').style.display = 'flex';
}
function saveTransaction(e) {
    e.preventDefault();
    const type = document.getElementById('t-type').value; // expense / income
    const amount = parseFloat(document.getElementById('t-amount').value);
    const label = document.getElementById('t-label').value;

    localTransactions.push({
        id: Date.now(),
        category: type,
        type: label,
        amount: amount,
        date: new Date().toISOString()
    });

    saveData();
    closeAllModals();
    renderFinance();
    if(window.renderExtensions) window.renderExtensions(); // Check succès "Rentier"
}

// Exposé globalement pour les boutons HTML
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.switchView = switchView;
window.openAddChickenModal = openAddChickenModal;
window.closeAllModals = closeAllModals;
window.saveChicken = saveChicken;
window.deleteChicken = deleteChicken;
window.quickAddEgg = quickAddEgg;
window.openTransactionModal = openTransactionModal;
window.saveTransaction = saveTransaction;
window.startDemo = startDemo;
