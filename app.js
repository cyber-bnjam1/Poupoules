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
            document.getElementById('user-name').innerText = user.displayName || 'Éleveur';
            document.getElementById('user-email').innerText = user.email;
            document.getElementById('user-photo').src = user.photoURL || 'icon.png';
            document.getElementById('header-status').classList.replace('demo', 'connected');
            document.getElementById('header-status').innerHTML = '<i class="fas fa-wifi"></i> <span>Cloud</span>';
            loadFirebaseData();
        } else {
            currentUser = null;
            isDemoMode = true;
            document.getElementById('auth-logged-in').style.display = 'none';
            document.getElementById('auth-logged-out').style.display = 'block';
            document.getElementById('header-status').classList.replace('connected', 'demo');
            document.getElementById('header-status').innerHTML = '<i class="fas fa-save"></i> <span>Démo</span>';
            loadLocalData();
            renderAll();
        }
    });

    document.querySelectorAll('.close-modal').forEach(x => {
        x.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
});

// --- NAVIGATION ---
window.toggleMenu = () => { document.getElementById('menu-overlay').classList.toggle('open'); };

window.navigate = (targetId) => {
    document.getElementById('menu-overlay').classList.remove('open');
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    const target = document.getElementById(targetId);
    if(target) target.classList.add('active-view');
    
    document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
    const link = Array.from(document.querySelectorAll('.menu-link')).find(l => l.getAttribute('onclick').includes(targetId));
    if(link) link.classList.add('active');
    
    document.getElementById('scroll-container').scrollTop = 0;
    currentViewId = targetId;
    updateFabVisibility(targetId);
};

function updateFabVisibility(viewId) {
    const fab = document.getElementById('main-fab');
    fab.classList.add('hidden');
    if (['view-chickens', 'view-finance', 'view-maintenance'].includes(viewId)) {
        fab.classList.remove('hidden');
    }
}

window.handleFabClick = () => {
    if (currentViewId === 'view-chickens') openChickenModal();
    else if (currentViewId === 'view-finance') openTransactionModal();
    else if (currentViewId === 'view-maintenance') openEditTaskModal();
};

function renderAll() {
    renderChickensList();
    renderDashboard();
    renderFinance();
    renderMaintenance();
}

// --- 1. DASHBOARD & CHART ---
function initEggsChart() {
    const ctx = document.getElementById('eggsChart').getContext('2d');
    eggsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#ffcc00', borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { 
                    beginAtZero: true, 
                    grid: { display: false },
                    ticks: {
                        stepSize: 1, // Pas de 1 en 1
                        precision: 0  // Entiers uniquement
                    }
                }, 
                x: { grid: { display: false } } 
            }
        }
    });
}

function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let filteredEggs = [];
    if (currentStatsPeriod === 'month') {
        filteredEggs = localEggs.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
        document.getElementById('label-eggs-display').innerText = "Œufs (Mois)";
    } else {
        filteredEggs = localEggs.filter(e => new Date(e.date).getFullYear() === currentYear);
        document.getElementById('label-eggs-display').innerText = "Œufs (Année)";
    }
    document.getElementById('total-eggs-display').innerText = filteredEggs.length;
    
    const yearTransactions = localTransactions.filter(e => new Date(e.date).getFullYear() === currentYear && e.category === 'expense');
    const totalExpenses = yearTransactions.reduce((acc, curr) => acc + curr.amount, 0);
    const yearEggs = localEggs.filter(e => new Date(e.date).getFullYear() === currentYear).length;
    const cost = yearEggs > 0 ? (totalExpenses / yearEggs).toFixed(2) : "0.00";
    document.getElementById('cost-per-egg-display').innerText = cost + ' €';

    const todayStr = now.toISOString().split('T')[0];
    const eggsToday = localEggs.filter(e => e.date.startsWith(todayStr)).length;
    document.getElementById('eggs-today-count').innerText = eggsToday > 0 ? `${eggsToday} œuf(s)` : 'Rien';

    updateEggsChart(filteredEggs);

    const list = document.getElementById('recent-activity-list');
    list.innerHTML = '';
    [...localEggs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 8).forEach(egg => {
        const li = document.createElement('li');
        const d = new Date(egg.date);
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="background:var(--color-graines); width:8px; height:8px; border-radius:50%;"></div>
                <span style="font-weight:600;">${egg.chickenName}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:13px; color:var(--text-light);">${d.getDate()}/${d.getMonth()+1}</span>
                <button class="delete-icon-btn" onclick="deleteEgg('${egg.id}')"><i class="fas fa-times"></i></button>
            </div>`;
        list.appendChild(li);
    });
}

function updateEggsChart(data) {
    const labels = [];
    const values = [];
    if(currentStatsPeriod === 'month') {
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
        for(let i=1; i<=daysInMonth; i++) labels.push(i);
        const counts = new Array(daysInMonth).fill(0);
        data.forEach(e => { const d = new Date(e.date).getDate(); counts[d-1]++; });
        values.push(...counts);
    } else {
        const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
        labels.push(...months);
        const counts = new Array(12).fill(0);
        data.forEach(e => { const m = new Date(e.date).getMonth(); counts[m]++; });
        values.push(...counts);
    }
    eggsChartInstance.data.labels = labels;
    eggsChartInstance.data.datasets[0].data = values;
    eggsChartInstance.update();
}

// --- 2. GESTION DES POULES & PHOTO ---
window.handlePhotoUpload = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            document.getElementById('preview-photo').src = base64Image;
            tempPhotoBase64 = base64Image; // Stockage base64 pour persistance
        };
        reader.readAsDataURL(input.files[0]);
    }
};

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
            <div class="chicken-breed">${c.breed || 'Inconnue'}</div>`;
        grid.appendChild(div);
    });
};

window.openChickenModal = (chickenId = null) => {
    const modal = document.getElementById('modal-chicken');
    const form = document.getElementById('form-chicken');
    const deleteBtn = document.getElementById('btn-delete-chicken');
    const archiveBtn = document.getElementById('btn-archive-chicken');

    form.reset();
    document.getElementById('preview-photo').src = 'icon.png';
    tempPhotoBase64 = null;
    
    if (chickenId) {
        const c = localChickens.find(x => x.id === chickenId);
        if (c) {
            document.getElementById('modal-chicken-title').innerText = "Modifier Poule";
            document.getElementById('chicken-id').value = c.id;
            document.getElementById('chicken-name').value = c.name;
            document.getElementById('chicken-breed').value = c.breed || '';
            document.getElementById('chicken-date').value = c.date;
            document.getElementById('chicken-price').value = c.price || 0;
            if(c.photo) document.getElementById('preview-photo').src = c.photo;
            deleteBtn.style.display = 'block';
            archiveBtn.style.display = c.status !== 'archived' ? 'block' : 'none';
        }
    } else {
        document.getElementById('modal-chicken-title').innerText = "Nouvelle Poule";
        document.getElementById('chicken-id').value = "";
        document.getElementById('chicken-date').valueAsDate = new Date();
        deleteBtn.style.display = 'none';
        archiveBtn.style.display = 'none';
    }
    modal.style.display = 'flex';
};

window.archiveChicken = () => {
    const id = document.getElementById('chicken-id').value;
    if(confirm("Confirmer que cette poule est décédée ? Elle sera rangée dans les archives.")) {
        const idx = localChickens.findIndex(c => c.id === id);
        if (idx > -1) {
            localChickens[idx].status = 'archived';
            saveData();
            document.getElementById('modal-chicken').style.display = 'none';
            renderChickensList();
        }
    }
};

document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('chicken-id').value;
    const name = document.getElementById('chicken-name').value;
    const breed = document.getElementById('chicken-breed').value;
    const date = document.getElementById('chicken-date').value;
    const price = parseFloat(document.getElementById('chicken-price').value) || 0;
    const photo = tempPhotoBase64 || document.getElementById('preview-photo').getAttribute('src');
    
    if (id) {
        const idx = localChickens.findIndex(c => c.id === id);
        if (idx > -1) localChickens[idx] = { ...localChickens[idx], name, breed, date, price, photo }; 
    } else {
        localChickens.push({ id: 'c' + Date.now(), name, breed, date, price, photo, status: 'active' });
    }
    saveData();
    document.getElementById('modal-chicken').style.display = 'none';
    renderChickensList();
});

// --- 3. SAUVEGARDE & CLOUD ---
function saveData() {
    const dataObj = {
        chickens: localChickens,
        eggs: localEggs,
        transactions: localTransactions,
        tasks: localTasks
    };

    // Sauvegarde locale (Persistance immédiate)
    localStorage.setItem('poupoules_data', JSON.stringify(dataObj));

    // Sauvegarde Firebase (Persistance Cloud incluant images Base64)
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).set(dataObj)
        .catch(err => console.error("Erreur Cloud:", err));
    }
}

function loadFirebaseData() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            localChickens = data.chickens || [];
            localEggs = data.eggs || [];
            localTransactions = data.transactions || [];
            localTasks = data.tasks || [];
            renderAll();
        } else {
            loadLocalData();
            renderAll();
        }
    });
}

function loadLocalData() {
    const data = localStorage.getItem('poupoules_data');
    if(data) {
        const parsed = JSON.parse(data);
        localChickens = parsed.chickens || [];
        localEggs = parsed.eggs || [];
        localTransactions = parsed.transactions || [];
        localTasks = parsed.tasks || [];
    }
}

// --- 4. AUTRES FONCTIONS (Budget, Entretien, etc.) ---
window.filterChickens = (status, btn) => {
    document.querySelectorAll('#view-chickens .segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChickensList();
};

window.deleteChicken = () => {
    const id = document.getElementById('chicken-id').value;
    if(confirm("Supprimer DÉFINITIVEMENT cette poule ?")) {
        localChickens = localChickens.filter(c => c.id !== id);
        saveData();
        document.getElementById('modal-chicken').style.display = 'none';
        renderChickensList();
    }
};

window.completeTask = (id) => {
    const task = localTasks.find(t => t.id === id);
    if(task) { task.lastDone = new Date().toISOString(); saveData(); renderMaintenance(); }
};

window.deleteEgg = (eggId) => {
    if(confirm("Supprimer cet œuf ?")) {
        localEggs = localEggs.filter(e => e.id !== eggId);
        saveData();
        renderDashboard();
    }
};

window.openAddEggModal = () => {
    const modal = document.getElementById('modal-add-egg');
    const grid = document.getElementById('egg-chickens-list');
    grid.innerHTML = '';
    localChickens.filter(c => c.status === 'active').forEach(c => {
        const card = document.createElement('div');
        card.className = 'selection-card';
        card.innerHTML = `<img src="${c.photo || 'icon.png'}"><span>${c.name}</span>`;
        card.onclick = () => { 
            localEggs.push({ id: 'egg_' + Date.now(), chickenId: c.id, chickenName: c.name, date: new Date().toISOString() });
            saveData();
            renderDashboard();
            modal.style.display = 'none'; 
        };
        grid.appendChild(card);
    });
    modal.style.display = 'flex';
};

function renderMaintenance() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    localTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `
            <div class="task-left">
                <div><h4 style="margin:0;">${task.title}</h4><small>Tous les ${task.frequency}j</small></div>
            </div>
            <button class="glass-btn-round" onclick="completeTask('${task.id}')"><i class="fas fa-check"></i></button>`;
        list.appendChild(li);
    });
}

function renderFinance() {
    const list = document.getElementById('finance-list');
    list.innerHTML = '';
    localTransactions.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div><span style="font-weight:600;">${t.type}</span><br><small>${t.date.split('T')[0]}</small></div>
            <div style="font-weight:bold;">${t.amount.toFixed(2)}€</div>`;
        list.appendChild(li);
    });
}

window.switchStatsPeriod = (period, btn) => {
    currentStatsPeriod = period;
    document.querySelectorAll('#view-dashboard .segment-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
};

function fetchWeather() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&current_weather=true`)
                .then(r => r.json()).then(data => {
                    const temp = Math.round(data.current_weather.temperature);
                    const w = document.getElementById('weather-widget');
                    w.querySelector('span').innerText = `${temp}°C`;
                    w.style.display = 'flex';
                }).catch(() => {});
        }, () => {});
    }
}

window.login = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
window.logout = () => auth.signOut();
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};
