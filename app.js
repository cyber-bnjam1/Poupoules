// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDpVKRam-7sldEss93zRTh8At3pEtJ0SqA",
    authDomain: "poulettes-75fb5.firebaseapp.com",
    projectId: "poulettes-75fb5",
    storageBucket: "poulettes-75fb5.firebasestorage.app",
    messagingSenderId: "479553710488",
    appId: "1:479553710488:web:8cb5ec0285f330c51e23ed"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }
    initEggsChart();
    fetchWeather();
    updateFabVisibility('view-dashboard');

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

    document.querySelectorAll('.close-modal').forEach(x => {
        x.addEventListener('click', () => x.closest('.modal').style.display = 'none');
    });
});

// --- SAUVEGARDE & PERSISTANCE ---
function saveData() {
    const data = {
        chickens: localChickens,
        eggs: localEggs,
        transactions: localTransactions,
        tasks: localTasks
    };
    localStorage.setItem('poupoules_data', JSON.stringify(data));
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).set(data);
    }
}

function loadLocalData() {
    const data = JSON.parse(localStorage.getItem('poupoules_data'));
    if(data) {
        localChickens = data.chickens || [];
        localEggs = data.eggs || [];
        localTransactions = data.transactions || [];
        localTasks = data.tasks || [];
    }
}

function loadFirebaseData() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            localChickens = d.chickens || [];
            localEggs = d.eggs || [];
            localTransactions = d.transactions || [];
            localTasks = d.tasks || [];
            renderAll();
        }
    });
}

// --- PHOTO GESTION (Base64 Persistant) ---
window.handlePhotoUpload = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const b64 = e.target.result;
            document.getElementById('preview-photo').src = b64;
            tempPhotoBase64 = b64;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

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
    tempPhotoBase64 = null;
    if(id) {
        const c = localChickens.find(x => x.id === id);
        document.getElementById('chicken-id').value = c.id;
        document.getElementById('chicken-name').value = c.name;
        document.getElementById('chicken-breed').value = c.breed;
        document.getElementById('chicken-date').value = c.date;
        document.getElementById('chicken-price').value = c.price;
        if(c.photo) document.getElementById('preview-photo').src = c.photo;
        document.getElementById('btn-delete-chicken').style.display = 'block';
        document.getElementById('btn-archive-chicken').style.display = c.status === 'archived' ? 'none' : 'block';
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
    const photo = tempPhotoBase64 || document.getElementById('preview-photo').src;
    const chickenData = {
        name: document.getElementById('chicken-name').value,
        breed: document.getElementById('chicken-breed').value,
        date: document.getElementById('chicken-date').value,
        price: document.getElementById('chicken-price').value,
        photo: photo
    };
    if(id) {
        const idx = localChickens.findIndex(c => c.id === id);
        localChickens[idx] = { ...localChickens[idx], ...chickenData };
    } else {
        localChickens.push({ id: 'c'+Date.now(), ...chickenData, status: 'active' });
    }
    saveData(); renderChickensList(); document.getElementById('modal-chicken').style.display='none';
};

window.archiveChicken = () => {
    const id = document.getElementById('chicken-id').value;
    const idx = localChickens.findIndex(c => c.id === id);
    localChickens[idx].status = 'archived';
    saveData(); renderChickensList(); document.getElementById('modal-chicken').style.display='none';
};

// --- GRAPHIQUE CORRIGÉ ---
function initEggsChart() {
    const ctx = document.getElementById('eggsChart').getContext('2d');
    eggsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#ffcc00' }] },
        options: { 
            scales: { 
                y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } 
            } 
        }
    });
}

// --- MÉTÉO ---
function fetchWeather() {
    navigator.geolocation.getCurrentPosition(pos => {
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`)
            .then(r => r.json()).then(data => {
                const w = document.getElementById('weather-widget');
                w.querySelector('span').innerText = Math.round(data.current_weather.temperature) + '°C';
                w.style.display = 'flex';
            });
    });
}

// --- FONCTIONS DASHBOARD / FINANCE / TACHES (RESTAURÉES) ---
function renderAll() {
    renderChickensList();
    renderDashboard();
    renderFinance();
    renderMaintenance();
}

function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eggs-today-count').innerText = localEggs.filter(e => e.date.startsWith(today)).length;
    updateEggsChart();
}

function updateEggsChart() {
    const labels = []; const values = [];
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

window.openAddEggModal = () => {
    const grid = document.getElementById('egg-chickens-list');
    grid.innerHTML = '';
    localChickens.filter(c => c.status !== 'archived').forEach(c => {
        const div = document.createElement('div');
        div.className = 'selection-card';
        div.innerHTML = `<img src="${c.photo || 'icon.png'}"><span>${c.name}</span>`;
        div.onclick = () => {
            localEggs.push({ chickenName: c.name, date: new Date().toISOString() });
            saveData(); renderDashboard(); document.getElementById('modal-add-egg').style.display='none';
        };
        grid.appendChild(div);
    });
    document.getElementById('modal-add-egg').style.display = 'flex';
};

function renderMaintenance() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    localTasks.forEach(t => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `<span>${t.title}</span><button onclick="completeTask('${t.id}')">Fait</button>`;
        list.appendChild(li);
    });
}

window.completeTask = (id) => {
    const idx = localTasks.findIndex(t => t.id === id);
    localTasks[idx].lastDone = new Date().toISOString();
    saveData(); renderMaintenance();
};

function renderFinance() {
    const list = document.getElementById('finance-list');
    list.innerHTML = '';
    localTransactions.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${t.type || 'Autre'}</span><strong>${t.amount}€</strong>`;
        list.appendChild(li);
    });
}

// --- UTILS ---
window.navigate = (id) => {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    document.getElementById(id).classList.add('active-view');
    currentViewId = id;
    document.getElementById('menu-overlay').classList.remove('open');
    updateFabVisibility(id);
};

function updateFabVisibility(id) {
    const fab = document.getElementById('main-fab');
    fab.classList.toggle('hidden', !['view-chickens', 'view-finance'].includes(id));
}

window.handleFabClick = () => {
    if(currentViewId === 'view-chickens') openChickenModal();
    else if(currentViewId === 'view-finance') document.getElementById('modal-transaction').style.display='flex';
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
