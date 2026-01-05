// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDpVKRam-7sldEss93zRTh8At3pEtJ0SqA",
    authDomain: "poulettes-75fb5.firebaseapp.com",
    projectId: "poulettes-75fb5",
    storageBucket: "poulettes-75fb5.appspot.com",
    messagingSenderId: "479553710488",
    appId: "1:479553710488:web:8cb5ec0285f330c51e23ed"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- ETAT GLOBAL ---
let currentUser = null;
let isDemoMode = true;
let localChickens = [];
let localEggs = [];
let localTransactions = [];
let localTasks = [
    { id: 't1', title: 'Nettoyer le poulailler', frequency: 7, lastDone: new Date().toISOString() },
    { id: 't2', title: 'Changer l\'eau', frequency: 1, lastDone: new Date().toISOString() }
];
let currentStatsPeriod = 'month';
let eggsChartInstance = null;
let currentUploadedPhotoUrl = null;
let currentViewId = 'view-dashboard';

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    initEggsChart();
    fetchWeather();
    
    if(localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            isDemoMode = false;
            document.getElementById('auth-logged-in').style.display = 'block';
            document.getElementById('auth-logged-out').style.display = 'none';
            document.getElementById('user-name').innerText = user.displayName;
            document.getElementById('user-email').innerText = user.email;
            document.getElementById('user-photo').src = user.photoURL || 'icon.png';
            document.getElementById('header-status').innerHTML = '<i class="fas fa-wifi"></i> <span>Cloud</span>';
            loadFirebaseData();
        } else {
            currentUser = null;
            isDemoMode = true;
            document.getElementById('auth-logged-in').style.display = 'none';
            document.getElementById('auth-logged-out').style.display = 'block';
            document.getElementById('header-status').innerHTML = '<i class="fas fa-save"></i> <span>Démo</span>';
            loadLocalData();
            renderAll();
        }
    });

    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => b.closest('.modal').style.display='none');
});

// --- CLOUD STORAGE PHOTOS ---
window.uploadChickenPhoto = async (input) => {
    if (!input.files[0] || isDemoMode) return;
    const file = input.files[0];
    const loader = document.getElementById('upload-loader');
    loader.style.display = 'flex';
    try {
        const ref = storage.ref(`chickens/${currentUser.uid}/${Date.now()}_${file.name}`);
        const snap = await ref.put(file);
        currentUploadedPhotoUrl = await snap.ref.getDownloadURL();
        document.getElementById('preview-photo').src = currentUploadedPhotoUrl;
    } catch (e) { alert("Erreur upload photo"); }
    loader.style.display = 'none';
};

// --- SYNC & DATA ---
function saveData() {
    const data = { chickens: localChickens, eggs: localEggs, transactions: localTransactions, tasks: localTasks };
    localStorage.setItem('poupoules_data', JSON.stringify(data));
    if (currentUser) db.collection('users').doc(currentUser.uid).set(data);
}

function loadFirebaseData() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            localChickens = d.chickens || [];
            localEggs = d.eggs || [];
            localTransactions = d.transactions || [];
            localTasks = d.tasks || localTasks;
            renderAll();
        }
    });
}

function loadLocalData() {
    const d = JSON.parse(localStorage.getItem('poupoules_data'));
    if(d) {
        localChickens = d.chickens || [];
        localEggs = d.eggs || [];
        localTransactions = d.transactions || [];
        localTasks = d.tasks || localTasks;
    }
}

// --- LOGIQUE POULES ---
window.renderChickensList = () => {
    const grid = document.getElementById('chickens-grid');
    grid.innerHTML = '';
    const filter = document.querySelector('#btn-filter-active').classList.contains('active') ? 'active' : 'archived';
    localChickens.filter(c => (c.status || 'active') === filter).forEach(c => {
        const div = document.createElement('div');
        div.className = 'chicken-card';
        div.innerHTML = `
            <button class="edit-chicken-btn" onclick="openChickenModal('${c.id}')"><i class="fas fa-pen"></i></button>
            <img class="chicken-photo" src="${c.photo || 'icon.png'}">
            <div class="chicken-name">${c.name}</div>
        `;
        grid.appendChild(div);
    });
};

window.openChickenModal = (id = null) => {
    const f = document.getElementById('form-chicken');
    f.reset();
    document.getElementById('preview-photo').src = 'icon.png';
    currentUploadedPhotoUrl = null;
    if(id) {
        const c = localChickens.find(x => x.id === id);
        document.getElementById('chicken-id').value = c.id;
        document.getElementById('chicken-name').value = c.name;
        document.getElementById('chicken-breed').value = c.breed;
        document.getElementById('chicken-date').value = c.date;
        document.getElementById('preview-photo').src = c.photo || 'icon.png';
        currentUploadedPhotoUrl = c.photo;
        document.getElementById('btn-delete-chicken').style.display = 'block';
        document.getElementById('btn-archive-chicken').style.display = c.status==='archived'?'none':'block';
    } else {
        document.getElementById('chicken-id').value = '';
        document.getElementById('btn-delete-chicken').style.display = 'none';
        document.getElementById('btn-archive-chicken').style.display = 'none';
    }
    document.getElementById('modal-chicken').style.display = 'flex';
};

document.getElementById('form-chicken').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('chicken-id').value;
    const data = {
        name: document.getElementById('chicken-name').value,
        breed: document.getElementById('chicken-breed').value,
        date: document.getElementById('chicken-date').value,
        photo: currentUploadedPhotoUrl || 'icon.png'
    };
    if(id) {
        const i = localChickens.findIndex(c => c.id === id);
        localChickens[i] = { ...localChickens[i], ...data };
    } else {
        localChickens.push({ id: 'c'+Date.now(), ...data, status: 'active' });
    }
    saveData(); renderChickensList(); document.getElementById('modal-chicken').style.display='none';
};

window.archiveChicken = () => {
    const id = document.getElementById('chicken-id').value;
    const i = localChickens.findIndex(c => c.id === id);
    localChickens[i].status = 'archived';
    saveData(); renderChickensList(); document.getElementById('modal-chicken').style.display='none';
};

window.deleteChicken = () => {
    if(!confirm("Supprimer ?")) return;
    const id = document.getElementById('chicken-id').value;
    localChickens = localChickens.filter(c => c.id !== id);
    saveData(); renderChickensList(); document.getElementById('modal-chicken').style.display='none';
};

// --- LOGIQUE DASHBOARD & CHART ---
function initEggsChart() {
    const ctx = document.getElementById('eggsChart').getContext('2d');
    eggsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#ffcc00' }] },
        options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eggs-today-count').innerText = localEggs.filter(e => e.date.startsWith(today)).length;
    updateEggsChart();
    const act = document.getElementById('recent-activity-list');
    act.innerHTML = '';
    localEggs.slice(-5).reverse().forEach(e => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${e.chickenName}</span><small>${e.date.split('T')[0]}</small>`;
        act.appendChild(li);
    });
}

function updateEggsChart() {
    const labels = []; const values = [];
    // Logique simplifiée pour l'exemple
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate()-i);
        const s = d.toISOString().split('T')[0];
        labels.push(s.split('-')[2]);
        values.push(localEggs.filter(e => e.date.startsWith(s)).length);
    }
    eggsChartInstance.data.labels = labels;
    eggsChartInstance.data.datasets[0].data = values;
    eggsChartInstance.update();
}

// --- AUTRES FONCTIONS ---
window.openAddEggModal = () => {
    const g = document.getElementById('egg-chickens-list');
    g.innerHTML = '';
    localChickens.filter(c => c.status !== 'archived').forEach(c => {
        const d = document.createElement('div');
        d.className = 'selection-card';
        d.innerHTML = `<img src="${c.photo}"><span>${c.name}</span>`;
        d.onclick = () => {
            localEggs.push({ chickenName: c.name, date: new Date().toISOString() });
            saveData(); renderDashboard(); document.getElementById('modal-add-egg').style.display='none';
        };
        g.appendChild(d);
    });
    document.getElementById('modal-add-egg').style.display = 'flex';
};

window.openTransactionModal = () => document.getElementById('modal-transaction').style.display = 'flex';
document.getElementById('form-transaction').onsubmit = (e) => {
    e.preventDefault();
    localTransactions.push({
        amount: parseFloat(document.getElementById('trans-amount').value),
        category: document.getElementById('trans-category').value,
        date: new Date().toISOString()
    });
    saveData(); renderFinance(); document.getElementById('modal-transaction').style.display='none';
};

function renderFinance() {
    const list = document.getElementById('finance-list');
    list.innerHTML = '';
    let bal = 0;
    localTransactions.forEach(t => {
        bal += (t.category === 'income' ? t.amount : -t.amount);
        const li = document.createElement('li');
        li.innerHTML = `<span>${t.category}</span><strong>${t.amount}€</strong>`;
        list.appendChild(li);
    });
    document.getElementById('total-balance').innerText = bal.toFixed(2) + '€';
}

function renderMaintenance() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    localTasks.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${t.title}</span><button onclick="doTask('${t.id}')">Fait</button>`;
        list.appendChild(li);
    });
}

window.doTask = (id) => {
    const i = localTasks.findIndex(t => t.id === id);
    localTasks[i].lastDone = new Date().toISOString();
    saveData(); renderMaintenance();
};

function fetchWeather() {
    navigator.geolocation.getCurrentPosition(p => {
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&current_weather=true`)
        .then(r => r.json()).then(d => {
            const w = document.getElementById('weather-widget');
            w.querySelector('span').innerText = Math.round(d.current_weather.temperature) + '°C';
            w.style.display = 'flex';
        });
    });
}

function renderAll() { renderChickensList(); renderDashboard(); renderFinance(); renderMaintenance(); }

window.navigate = (id) => {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    document.getElementById(id).classList.add('active-view');
    currentViewId = id;
    document.getElementById('menu-overlay').classList.remove('open');
};

window.handleFabClick = () => {
    if(currentViewId === 'view-chickens') openChickenModal();
    else if(currentViewId === 'view-finance') openTransactionModal();
};

window.login = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
window.logout = () => auth.signOut();
window.toggleMenu = () => document.getElementById('menu-overlay').classList.toggle('open');
window.filterChickens = (s, b) => {
    document.querySelectorAll('#view-chickens .segment-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); renderChickensList();
};
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};
