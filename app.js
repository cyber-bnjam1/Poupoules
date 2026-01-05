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
let tempPhotoBase64 = null; // Stockage temporaire de la nouvelle image
let currentViewId = 'view-dashboard';

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }
    initEggsChart();
    fetchWeather(); // RÉINTÉGRATION
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

// --- PERSISTANCE & SAUVEGARDE ---
function saveData() {
    const data = {
        chickens: localChickens,
        eggs: localEggs,
        transactions: localTransactions,
        tasks: localTasks
    };

    localStorage.setItem('poupoules_data', JSON.stringify(data));

    if (currentUser) {
        db.collection('users').doc(currentUser.uid).set(data)
          .then(() => console.log("Cloud sync ok"))
          .catch(err => console.error("Cloud error:", err));
    }
}

function loadLocalData() {
    const data = localStorage.getItem('poupoules_data');
    if(data) {
        const p = JSON.parse(data);
        localChickens = sanitizeChickens(p.chickens);
        localEggs = p.eggs || [];
        localTransactions = p.transactions || [];
        localTasks = p.tasks || [];
    }
}

function loadFirebaseData() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            localChickens = sanitizeChickens(d.chickens);
            localEggs = d.eggs || [];
            localTransactions = d.transactions || [];
            localTasks = d.tasks || [];
            renderAll();
        } else {
            loadLocalData();
            renderAll();
        }
    });
}

// --- GESTION PHOTO (Base64) ---
window.handlePhotoUpload = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const b64 = e.target.result;
            document.getElementById('preview-photo').src = b64;
            tempPhotoBase64 = b64; // On capture l'image ici
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
        // On affiche l'image stockée ou l'icône par défaut
        const imgSrc = (c.photo && c.photo !== 'icon.png') ? c.photo : 'icon.png';
        div.innerHTML = `
            <button class="edit-chicken-btn" onclick="openChickenModal('${c.id}')"><i class="fas fa-pen"></i></button>
            <img class="chicken-photo" src="${imgSrc}">
            <div class="chicken-name">${c.name}</div>
            <div class="chicken-breed">${c.breed || 'Inconnue'}</div>
        `;
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
    tempPhotoBase64 = null; // Reset obligatoire
    
    if (chickenId) {
        const c = localChickens.find(x => x.id === chickenId);
        if (c) {
            document.getElementById('modal-chicken-title').innerText = "Modifier Poule";
            document.getElementById('chicken-id').value = c.id;
            document.getElementById('chicken-name').value = c.name;
            document.getElementById('chicken-breed').value = c.breed || '';
            document.getElementById('chicken-date').value = c.date;
            document.getElementById('chicken-price').value = c.price || 0;
            
            // Recharger la photo existante dans la preview
            if(c.photo && c.photo !== 'icon.png') {
                document.getElementById('preview-photo').src = c.photo;
            }
            
            deleteBtn.style.display = 'block';
            archiveBtn.style.display = (c.status !== 'archived') ? 'block' : 'none';
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

document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('chicken-id').value;
    const name = document.getElementById('chicken-name').value;
    const breed = document.getElementById('chicken-breed').value;
    const date = document.getElementById('chicken-date').value;
    const price = parseFloat(document.getElementById('chicken-price').value) || 0;

    if (id) {
        const idx = localChickens.findIndex(c => c.id === id);
        if (idx > -1) {
            // Mise à jour : on prend la nouvelle photo OU on garde l'ancienne
            const currentPhoto = localChickens[idx].photo || 'icon.png';
            const finalPhoto = tempPhotoBase64 || currentPhoto;
            localChickens[idx] = { ...localChickens[idx], name, breed, date, price, photo: finalPhoto };
        }
    } else {
        // Création : nouvelle photo ou par défaut
        const finalPhoto = tempPhotoBase64 || 'icon.png';
        localChickens.push({ id: 'c' + Date.now(), name, breed, date, price, photo: finalPhoto, status: 'active' });
    }
    
    saveData();
    document.getElementById('modal-chicken').style.display = 'none';
    renderChickensList();
});

window.archiveChicken = () => {
    const id = document.getElementById('chicken-id').value;
    if(confirm("Mettre cette poule dans 'Décédée' ?")) {
        const idx = localChickens.findIndex(c => c.id === id);
        if (idx > -1) {
            localChickens[idx].status = 'archived';
            saveData();
            document.getElementById('modal-chicken').style.display = 'none';
            renderChickensList();
        }
    }
};

// --- GRAPHIQUE (Axe Y en entiers) ---
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
                    ticks: { stepSize: 1, precision: 0 } // PAS DE 1 EN 1
                }, 
                x: { grid: { display: false } } 
            }
        }
    });
}

// --- RÉINTÉGRATION MÉTÉO ---
function fetchWeather() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`)
                .then(r => r.json())
                .then(data => {
                    const temp = Math.round(data.current_weather.temperature);
                    const w = document.getElementById('weather-widget');
                    w.querySelector('span').innerText = `${temp}°C`;
                    w.style.display = 'flex';
                }).catch(() => {});
        }, () => {});
    }
}

// --- FONCTIONS RESTANTES (Nécessaires pour le fonctionnement) ---
function renderAll() {
    renderChickensList();
    renderDashboard();
    renderFinance();
    renderMaintenance();
}

function sanitizeChickens(list) {
    if(!Array.isArray(list)) return [];
    return list.map(c => ({
        id: c.id || 'c' + Math.random(),
        name: c.name || 'Sans nom',
        breed: c.breed || '',
        date: c.date || new Date().toISOString().split('T')[0],
        price: c.price || 0,
        status: c.status || 'active',
        photo: c.photo || 'icon.png'
    }));
}

function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let filteredEggs = (currentStatsPeriod === 'month') ? 
        localEggs.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }) :
        localEggs.filter(e => new Date(e.date).getFullYear() === currentYear);
    
    document.getElementById('total-eggs-display').innerText = filteredEggs.length;
    document.getElementById('eggs-today-count').innerText = localEggs.filter(e => e.date.startsWith(now.toISOString().split('T')[0])).length + ' œuf(s)';
    updateEggsChart(filteredEggs);
}

function updateEggsChart(data) {
    const labels = []; const values = [];
    if(currentStatsPeriod === 'month') {
        const days = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
        for(let i=1; i<=days; i++) { labels.push(i); values.push(0); }
        data.forEach(e => { values[new Date(e.date).getDate()-1]++; });
    } else {
        const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
        labels.push(...months); values.push(...new Array(12).fill(0));
        data.forEach(e => { values[new Date(e.date).getMonth()]++; });
    }
    eggsChartInstance.data.labels = labels;
    eggsChartInstance.data.datasets[0].data = values;
    eggsChartInstance.update();
}

window.navigate = (targetId) => {
    document.getElementById('menu-overlay').classList.remove('open');
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    const target = document.getElementById(targetId);
    if(target) target.classList.add('active-view');
    currentViewId = targetId;
    updateFabVisibility(targetId);
};

function updateFabVisibility(viewId) {
    const fab = document.getElementById('main-fab');
    fab.classList.add('hidden');
    if (['view-chickens', 'view-finance', 'view-maintenance'].includes(viewId)) fab.classList.remove('hidden');
}

window.filterChickens = (s, b) => { 
    document.querySelectorAll('#view-chickens .segment-btn').forEach(btn => btn.classList.remove('active'));
    b.classList.add('active'); renderChickensList(); 
};

window.switchStatsPeriod = (p, b) => { 
    currentStatsPeriod = p; 
    document.querySelectorAll('#view-dashboard .segment-btn').forEach(btn => btn.classList.remove('active'));
    b.classList.add('active'); renderDashboard(); 
};

window.login = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
window.logout = () => auth.signOut();
window.toggleMenu = () => { document.getElementById('menu-overlay').classList.toggle('open'); };
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

function renderMaintenance() {} // (Logique existante)
function renderFinance() {} // (Logique existante)
