// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "TA_CLE_API",
    authDomain: "TON_DOMAINE.firebaseapp.com",
    projectId: "TON_PROJET",
    storageBucket: "TON_BUCKET",
    messagingSenderId: "...",
    appId: "..."
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 2. DEMO DATA ---
const DEMO_DATA = {
    chickens: [
        { id: 'c1', name: 'Huguette', breed: 'Rousse', date: '2023-05-10', price: 15, status: 'active', photo: 'https://cdn-icons-png.flaticon.com/512/1826/1826224.png' },
        { id: 'c2', name: 'Gertrude', breed: 'Sussex', date: '2022-08-15', price: 18, status: 'active', photo: 'https://cdn-icons-png.flaticon.com/512/2829/2829821.png' },
        { id: 'c3', name: 'Mamie', breed: 'Noire', date: '2020-01-01', price: 12, status: 'archived', photo: null }
    ],
    eggs: [
        { chickenId: 'c1', chickenName: 'Huguette', date: new Date().toISOString() },
        { chickenId: 'c2', chickenName: 'Gertrude', date: new Date().toISOString() },
        { chickenId: 'c2', chickenName: 'Gertrude', date: new Date(new Date().setDate(new Date().getDate()-1)).toISOString() }
    ],
    expenses: [
        { type: 'graines', amount: 14.90, date: new Date().toISOString() },
        { type: 'materiel', amount: 50.00, date: new Date(new Date().setMonth(new Date().getMonth()-1)).toISOString() } // Dépense mois dernier
    ]
};

// --- 3. STATE ---
let currentUser = null;
let isDemoMode = true;
let localChickens = [...DEMO_DATA.chickens];
let localEggs = [...DEMO_DATA.eggs];
let localExpenses = [...DEMO_DATA.expenses];

let currentChickenId = null;
let currentFilter = 'active'; 
let currentStatsPeriod = 'month'; // 'month' ou 'year'

let eggsChartInstance = null;
let financeChartInstance = null;

// --- 4. INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            isDemoMode = false;
            updateAuthUI(true);
            loadFirebaseData();
            document.getElementById('app-status').classList.replace('demo', 'connected');
            document.getElementById('app-status').innerHTML = '<i class="fas fa-cloud"></i> Connecté';
        } else {
            currentUser = null;
            isDemoMode = true;
            updateAuthUI(false);
            renderAll();
        }
    });

    setupNavigation();
});

// --- 5. LOGIQUE D'AFFICHAGE ---

function renderAll() {
    renderChickensList();
    renderDashboard();
    renderFinance();
}

// A. POULES
function renderChickensList() {
    const grid = document.getElementById('chickens-grid');
    grid.innerHTML = '';
    const list = localChickens.filter(c => (c.status || 'active') === currentFilter);

    if (list.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#999; margin-top:30px;">Aucune poule ici 🐣</p>';
        return;
    }

    list.forEach(chk => {
        const img = chk.photo || 'https://cdn-icons-png.flaticon.com/512/1826/1826224.png';
        const card = document.createElement('div');
        card.className = `chicken-card ${chk.status === 'archived' ? 'grayscale-card' : ''}`;
        card.onclick = (e) => { if (!e.target.closest('.egg-btn')) openChickenDetails(chk.id); };

        card.innerHTML = `
            <img src="${img}" class="chicken-img">
            <h3 style="margin:5px 0;">${chk.name}</h3>
            <small style="color:#888">${chk.breed}</small>
            ${chk.status === 'active' ? `
            <button class="egg-btn" onclick="handleAddEgg('${chk.id}', '${chk.name}')">
                <i class="fas fa-egg"></i> A pondu !
            </button>` : `<small style="display:block; margin-top:10px;">Archivée</small>`}
        `;
        grid.appendChild(card);
    });
}

function filterChickens(status, btn) {
    currentFilter = status;
    document.querySelectorAll('#view-chickens .segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChickensList();
}

// B. DASHBOARD (Stats Mensuelles/Annuelles)
function switchStatsPeriod(period, btn) {
    currentStatsPeriod = period;
    document.querySelectorAll('#view-dashboard .segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
}

function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Filtrage des données selon la période
    let filteredEggs = [];
    let filteredExpenses = [];

    if (currentStatsPeriod === 'month') {
        filteredEggs = localEggs.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        filteredExpenses = localExpenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        document.getElementById('label-eggs-display').innerText = "Œufs (Ce mois)";
        document.getElementById('chart-title').innerHTML = '<i class="fas fa-chart-bar"></i> Jours du mois';
    } else {
        // Year
        filteredEggs = localEggs.filter(e => new Date(e.date).getFullYear() === currentYear);
        filteredExpenses = localExpenses.filter(e => new Date(e.date).getFullYear() === currentYear);
        document.getElementById('label-eggs-display').innerText = "Œufs (Cette année)";
        document.getElementById('chart-title').innerHTML = '<i class="fas fa-chart-bar"></i> Mois de l\'année';
    }

    // 2. Affichage des totaux
    document.getElementById('total-eggs-display').innerText = filteredEggs.length;
    const totalSpent = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    document.getElementById('total-spent-display').innerText = totalSpent.toFixed(2) + ' €';

    // 3. Mise à jour du graphique
    updateStatsChart(filteredEggs);

    // 4. Activité récente (toujours les 5 dernières globales)
    const list = document.getElementById('recent-activity-list');
    list.innerHTML = '';
    localEggs.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5).forEach(egg => {
        const li = document.createElement('li');
        const d = new Date(egg.date);
        li.innerHTML = `<span>🥚 ${egg.chickenName}</span><span>${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${d.getMinutes()<10?'0':''}${d.getMinutes()}</span>`;
        list.appendChild(li);
    });
}

function updateStatsChart(eggsData) {
    // Logique simplifiée pour Chart.js
    let labels = [];
    let data = [];

    if (currentStatsPeriod === 'month') {
        // Afficher par jours (simplifié: 1 à 31)
        labels = Array.from({length: 31}, (_, i) => i + 1); // 1..31
        data = new Array(31).fill(0);
        eggsData.forEach(e => {
            const day = new Date(e.date).getDate();
            data[day - 1]++;
        });
    } else {
        // Afficher par mois (Jan à Déc)
        labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        data = new Array(12).fill(0);
        eggsData.forEach(e => {
            const month = new Date(e.date).getMonth();
            data[month]++;
        });
    }

    eggsChartInstance.data.labels = labels;
    eggsChartInstance.data.datasets[0].data = data;
    eggsChartInstance.update();
}


// C. FINANCE
function renderFinance() {
    const list = document.getElementById('expenses-list');
    list.innerHTML = '';
    
    // Tri par date décroissante
    localExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    localExpenses.forEach(exp => {
        const li = document.createElement('li');
        const icon = exp.type === 'graines' ? '🌾' : (exp.type === 'paille' ? '🛏️' : (exp.type === 'materiel' ? '🔨' : '💊'));
        const dateStr = new Date(exp.date).toLocaleDateString('fr-FR');
        li.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; gap:8px">
                    <span style="font-size:18px">${icon}</span>
                    <span style="text-transform:capitalize; font-weight:500;">${exp.type}</span>
                </div>
                <small style="color:#999; margin-left:26px;">${dateStr}</small>
            </div>
            <span style="font-weight:600; color:#ff3b30">-${exp.amount} €</span>
        `;
        list.appendChild(li);
    });

    // Chart Doughnut (Global)
    let map = { graines: 0, paille: 0, soins: 0, materiel: 0, autre: 0 };
    localExpenses.forEach(e => { 
        const t = map[e.type] !== undefined ? e.type : 'autre';
        map[t] += e.amount; 
    });
    financeChartInstance.data.datasets[0].data = Object.values(map);
    financeChartInstance.update();
}

// --- 6. ACTIONS & MODALS ---

window.handleAddEgg = (id, name) => {
    const newEgg = { chickenId: id, chickenName: name, date: new Date().toISOString() };
    if (isDemoMode) {
        localEggs.push(newEgg);
        renderDashboard();
        alert(`Bravo ${name} ! 🥚`);
    } else {
        db.collection('users').doc(currentUser.uid).collection('eggs').add(newEgg);
    }
};

// Modal Dépense (Avec Date)
window.showAddExpenseModal = () => {
    document.getElementById('form-expense').reset();
    document.getElementById('exp-date').valueAsDate = new Date(); // Date par défaut = Aujourd'hui
    document.getElementById('modal-expense').style.display = 'flex';
};

document.getElementById('form-expense').addEventListener('submit', (e) => {
    e.preventDefault();
    const dateInput = document.getElementById('exp-date').value;
    const data = {
        type: document.getElementById('exp-type').value,
        amount: parseFloat(document.getElementById('exp-amount').value),
        date: dateInput ? new Date(dateInput).toISOString() : new Date().toISOString()
    };
    
    if(isDemoMode) {
        localExpenses.push(data);
        renderAll(); // Met à jour dashboard et finance
    } else {
        db.collection('users').doc(currentUser.uid).collection('expenses').add(data);
    }
    document.getElementById('modal-expense').style.display = 'none';
});

// Modal Poule
window.openChickenModal = (isEdit = false) => {
    const modal = document.getElementById('modal-chicken');
    if (isEdit && currentChickenId) {
        const chk = localChickens.find(c => c.id === currentChickenId);
        document.getElementById('modal-chicken-title').innerText = "Modifier";
        document.getElementById('chk-id').value = chk.id;
        document.getElementById('chk-name').value = chk.name;
        document.getElementById('chk-breed').value = chk.breed;
        document.getElementById('chk-date').value = chk.date || '';
        document.getElementById('chk-price').value = chk.price || '';
        document.getElementById('preview-photo').src = chk.photo || 'https://cdn-icons-png.flaticon.com/512/1826/1826224.png';
    } else {
        document.getElementById('form-chicken').reset();
        document.getElementById('modal-chicken-title').innerText = "Nouvelle Poule";
        document.getElementById('chk-id').value = '';
        document.getElementById('preview-photo').src = 'https://cdn-icons-png.flaticon.com/512/1826/1826224.png';
    }
    modal.style.display = 'flex';
};
window.editCurrentChicken = () => openChickenModal(true);

document.getElementById('chk-photo-file').addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('preview-photo').src = e.target.result;
        reader.readAsDataURL(e.target.files[0]);
    }
});

document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('chk-id').value;
    const data = {
        name: document.getElementById('chk-name').value,
        breed: document.getElementById('chk-breed').value,
        date: document.getElementById('chk-date').value,
        price: parseFloat(document.getElementById('chk-price').value),
        photo: document.getElementById('preview-photo').src,
        status: 'active'
    };

    if (isDemoMode) {
        if(id) {
            const idx = localChickens.findIndex(c => c.id === id);
            if(idx !== -1) localChickens[idx] = { ...localChickens[idx], ...data };
            if(currentChickenId === id) openChickenDetails(id);
        } else {
            localChickens.push({ id: 'demo'+Date.now(), ...data });
        }
        renderChickensList();
        document.getElementById('modal-chicken').style.display = 'none';
    } else {
        if(id) {
            db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).update(data);
            if(currentChickenId === id) openChickenDetails(id);
        } else {
            db.collection('users').doc(currentUser.uid).collection('chickens').add(data);
        }
        document.getElementById('modal-chicken').style.display = 'none';
    }
});

// Détail Poule & Archive
window.openChickenDetails = (id) => {
    currentChickenId = id;
    const chk = localChickens.find(c => c.id === id);
    if(!chk) return;
    document.getElementById('detail-name').innerText = chk.name;
    document.getElementById('detail-breed').innerText = chk.breed;
    document.getElementById('detail-price').innerText = (chk.price || 0) + ' €';
    document.getElementById('detail-date').innerText = new Date(chk.date).toLocaleDateString('fr-FR');
    document.getElementById('detail-age').innerText = calculateAge(chk.date);
    document.getElementById('detail-photo').src = chk.photo || '';
    
    const eggsCount = localEggs.filter(e => e.chickenId === id).length;
    document.getElementById('detail-total-eggs').innerText = eggsCount;

    const archiveBtn = document.getElementById('btn-archive');
    if(chk.status === 'archived') {
        archiveBtn.innerHTML = 'Désarchiver';
        archiveBtn.className = 'glass-btn primary-btn';
        archiveBtn.onclick = () => toggleArchiveStatus(id, 'active');
        document.getElementById('detail-status').innerText = 'Archivée';
    } else {
        archiveBtn.innerHTML = 'Archiver';
        archiveBtn.className = 'glass-btn danger-btn';
        archiveBtn.onclick = () => toggleArchiveStatus(id, 'archived');
        document.getElementById('detail-status').innerText = 'Active';
    }
    
    document.getElementById('view-chickens').classList.remove('active-view');
    document.getElementById('view-chicken-detail').classList.add('active-view');
    document.getElementById('main-tabbar').style.display = 'none';
};

window.closeChickenDetails = () => {
    document.getElementById('view-chicken-detail').classList.remove('active-view');
    document.getElementById('view-chickens').classList.add('active-view');
    document.getElementById('main-tabbar').style.display = 'flex';
};

window.archiveCurrentChicken = () => toggleArchiveStatus(currentChickenId, 'archived');
function toggleArchiveStatus(id, status) {
    if(isDemoMode) {
        const chk = localChickens.find(c => c.id === id);
        if(chk) chk.status = status;
        closeChickenDetails();
        renderChickensList();
    } else {
        db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).update({status: status});
        closeChickenDetails();
    }
}

// --- 7. UTILS & SYNC ---
function calculateAge(dateString) {
    if(!dateString) return '?';
    const months = (new Date().getFullYear() - new Date(dateString).getFullYear()) * 12 - new Date(dateString).getMonth() + new Date().getMonth();
    return months < 12 ? months + " mois" : Math.floor(months/12) + " ans";
}

function updateAuthUI(isLoggedIn) {
    document.getElementById('auth-logged-out').style.display = isLoggedIn ? 'none' : 'block';
    document.getElementById('auth-logged-in').style.display = isLoggedIn ? 'flex' : 'none';
    if(isLoggedIn) {
        document.getElementById('user-name').innerText = currentUser.displayName;
        document.getElementById('user-email').innerText = currentUser.email;
        document.getElementById('user-photo').src = currentUser.photoURL;
    }
}

document.getElementById('google-login-btn').addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

function loadFirebaseData() {
    const ref = db.collection('users').doc(currentUser.uid);
    ref.collection('chickens').onSnapshot(snap => { localChickens = snap.docs.map(d=>({id:d.id, ...d.data()})); renderAll(); });
    ref.collection('eggs').orderBy('date').onSnapshot(snap => { localEggs = snap.docs.map(d=>d.data()); renderAll(); });
    ref.collection('expenses').orderBy('date').onSnapshot(snap => { localExpenses = snap.docs.map(d=>d.data()); renderAll(); });
}

function initCharts() {
    eggsChartInstance = new Chart(document.getElementById('eggsChart').getContext('2d'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#0071e3', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: {legend:{display:false}}, scales:{y:{beginAtZero:true, grid:{display:false}}, x:{grid:{display:false}}} }
    });
    financeChartInstance = new Chart(document.getElementById('financeChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Graines', 'Paille', 'Soins', 'Matériel', 'Autre'], datasets: [{ data: [], backgroundColor: ['#ffcc00', '#ff9500', '#ff3b30', '#5856d6', '#8e8e93'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: {legend: {position:'right', labels:{boxWidth:10}}} }
    });
}

function setupNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active-view');
    }));
    document.querySelectorAll('.close-modal').forEach(x => x.addEventListener('click', () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none')));
}
