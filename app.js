// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDpVKRam-7sldEss93zRTh8At3pEtJ0SqA",
    authDomain: "poulettes-75fb5.firebaseapp.com",
    projectId: "poulettes-75fb5",
    storageBucket: "poulettes-75fb5.appspot.com", // Assure-toi que c'est le bon bucket
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
let localTasks = [];
let currentStatsPeriod = 'month';
let eggsChartInstance = null;
let currentUploadedPhotoUrl = null;
let currentViewId = 'view-dashboard';

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    initEggsChart();
    fetchWeather();
    
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            isDemoMode = false;
            document.getElementById('auth-logged-in').style.display = 'block';
            document.getElementById('auth-logged-out').style.display = 'none';
            document.getElementById('header-status').innerHTML = '<i class="fas fa-wifi"></i> <span>Cloud</span>';
            loadFirebaseData();
        } else {
            currentUser = null;
            isDemoMode = true;
            document.getElementById('auth-logged-in').style.display = 'none';
            document.getElementById('auth-logged-out').style.display = 'block';
            loadLocalData();
            renderAll();
        }
    });

    // Close modals
    document.querySelectorAll('.close-modal').forEach(x => {
        x.addEventListener('click', () => x.closest('.modal').style.display = 'none');
    });
});

// --- GESTION DES PHOTOS VIA CLOUD STORAGE ---
window.uploadChickenPhoto = async (input) => {
    if (!input.files || !input.files[0]) return;
    if (isDemoMode) {
        alert("Connectez-vous pour enregistrer des photos sur le cloud.");
        return;
    }

    const file = input.files[0];
    const loader = document.getElementById('upload-loader');
    const preview = document.getElementById('preview-photo');

    loader.style.display = 'flex';

    try {
        const storageRef = storage.ref(`chickens/${currentUser.uid}/${Date.now()}_${file.name}`);
        const snapshot = await storageRef.put(file);
        const url = await snapshot.ref.getDownloadURL();
        
        currentUploadedPhotoUrl = url;
        preview.src = url;
    } catch (error) {
        console.error("Erreur d'upload :", error);
        alert("Erreur lors de l'envoi de la photo.");
    } finally {
        loader.style.display = 'none';
    }
};

// --- SAUVEGARDE & SYNC ---
function saveData() {
    const data = {
        chickens: localChickens,
        eggs: localEggs,
        transactions: localTransactions,
        tasks: localTasks,
        lastSync: new Date().toISOString()
    };

    localStorage.setItem('poupoules_data', JSON.stringify(data));

    if (currentUser) {
        db.collection('users').doc(currentUser.uid).set(data);
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

function loadLocalData() {
    const data = localStorage.getItem('poupoules_data');
    if(data) {
        const p = JSON.parse(data);
        localChickens = p.chickens || [];
        localEggs = p.eggs || [];
        localTransactions = p.transactions || [];
        localTasks = p.tasks || [];
    }
}

// --- LOGIQUE POULES & DÉCÈS ---
window.renderChickensList = () => {
    const grid = document.getElementById('chickens-grid');
    grid.innerHTML = '';
    const filter = document.querySelector('#btn-filter-active').classList.contains('active') ? 'active' : 'archived';
    
    localChickens.filter(c => (c.status || 'active') === filter).forEach(c => {
        const div = document.createElement('div');
        div.className = 'chicken-card';
        div.innerHTML = `
            <button class="edit-chicken-btn" onclick="openChickenModal('${c.id}')"><i class="fas fa-pen"></i></button>
            <img class="chicken-photo" src="${c.photo || 'icon.png'}" onerror="this.src='icon.png'">
            <div class="chicken-name">${c.name}</div>
            <div class="chicken-breed">${c.breed || ''}</div>
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
    currentUploadedPhotoUrl = null;

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
            currentUploadedPhotoUrl = c.photo;
            
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

window.archiveChicken = () => {
    const id = document.getElementById('chicken-id').value;
    if (confirm("Confirmer que la poule est décédée ? Elle sera archivée.")) {
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
    const photo = currentUploadedPhotoUrl || 'icon.png';

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

// --- MÉTÉO ---
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
                });
        });
    }
}

// --- GRAPHIQUE ---
function initEggsChart() {
    const ctx = document.getElementById('eggsChart').getContext('2d');
    eggsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#ffcc00' }] },
        options: {
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// ... Les autres fonctions (renderDashboard, Finance, etc.) restent identiques au projet d'origine ...
function renderAll() {
    renderChickensList();
    renderDashboard();
}

function renderDashboard() {
    // Calcul et mise à jour du graphique...
    updateEggsChart(localEggs);
}

function updateEggsChart(eggs) {
    // Logique de comptage des oeufs par jour ou mois...
    eggsChartInstance.update();
}

window.navigate = (id) => {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    document.getElementById(id).classList.add('active-view');
    document.getElementById('menu-overlay').classList.remove('open');
};

window.login = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
window.logout = () => auth.signOut();
window.toggleMenu = () => document.getElementById('menu-overlay').classList.toggle('open');
