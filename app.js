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

// --- DATA INITIALE ---
const DEMO_DATA = {
    chickens: [
        { id: 'c1', name: 'Huguette', breed: 'Rousse', date: '2023-05-10', price: 15, status: 'active', photo: 'icon.png' },
        { id: 'c2', name: 'Gertrude', breed: 'Sussex', date: '2022-08-15', price: 18, status: 'active', photo: 'icon.png' }
    ],
    eggs: [
        { id: 'e1', chickenId: 'c1', chickenName: 'Huguette', date: new Date().toISOString() }
    ],
    transactions: [
        { id: 't1', category: 'expense', type: 'graines', amount: 25.50, date: new Date().toISOString() }
    ],
    treatments: [],
    // NOUVELLE STRUCTURE DE TACHES
    tasks: [
        { id: 'task1', title: 'Changer l\'eau', frequency: 2, lastDone: new Date(Date.now() - 86400000).toISOString() }, // Fait hier (freq 2j)
        { id: 'task2', title: 'Nettoyer le poulailler', frequency: 7, lastDone: new Date(Date.now() - 604800000).toISOString() } // Fait il y a 7j (freq 7j)
    ]
};

// --- STATE ---
let currentUser = null;
let isDemoMode = true;
let localChickens = [...DEMO_DATA.chickens];
let localEggs = [...DEMO_DATA.eggs];
let localTransactions = [...DEMO_DATA.transactions];
let localTreatments = [...DEMO_DATA.treatments];
let localTasks = [...DEMO_DATA.tasks];

let currentChickenId = null;
let currentFilter = 'active'; 
let currentStatsPeriod = 'month';
let eggsChartInstance = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initEggsChart();
    
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }

    fetchWeather();

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            isDemoMode = false;
            updateAuthUI(true);
            loadFirebaseData();
            document.getElementById('header-status').classList.replace('demo', 'connected');
            document.getElementById('header-status').innerText = 'Connecté';
        } else {
            currentUser = null;
            isDemoMode = true;
            updateAuthUI(false);
            loadLocalTasks();
            renderAll();
        }
    });
    
    // Fermeture des modales au clic sur la croix
    document.querySelectorAll('.close-modal').forEach(x => {
        x.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
});

// --- NAVIGATION ---
window.toggleMenu = () => { document.getElementById('menu-overlay').classList.toggle('open'); };
window.navigate = (targetId) => {
    toggleMenu();
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-view'));
    document.getElementById(targetId).classList.add('active-view');
    document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
    const clickedLink = Array.from(document.querySelectorAll('.menu-link')).find(l => l.getAttribute('onclick').includes(targetId));
    if(clickedLink) clickedLink.classList.add('active');
    document.getElementById('scroll-container').scrollTop = 0;
};

// --- FEATURES UTILS ---
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

function fetchWeather() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
                .then(response => response.json())
                .then(data => {
                    const temp = Math.round(data.current_weather.temperature);
                    const widget = document.getElementById('weather-widget');
                    widget.querySelector('span').innerText = `${temp}°C`;
                    widget.style.display = 'flex';
                }).catch(() => {});
        }, () => {});
    }
}

// --- RENDER ---
function renderAll() {
    renderChickensList();
    renderDashboard();
    renderFinance();
    renderTasks();
}

// 1. DASHBOARD & TASKS LOGIC (PLATINUM)
function renderTasks() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    
    // Tri par urgence (Ratio temps écoulé / fréquence)
    const sortedTasks = [...localTasks].sort((a,b) => {
        const ratioA = getDaysDiff(a.lastDone) / a.frequency;
        const ratioB = getDaysDiff(b.lastDone) / b.frequency;
        return ratioB - ratioA;
    });

    let urgentCount = 0;

    sortedTasks.forEach(task => {
        const diff = getDaysDiff(task.lastDone);
        const freq = task.frequency;
        let statusHtml = '';
        let isUrgent = false;

        if (diff >= freq) {
            statusHtml = `<span class="task-badge task-badge-urgent">Fait il y a ${diff}j</span>`;
            isUrgent = true;
            urgentCount++;
        } else if (diff >= freq * 0.8) {
            statusHtml = `<span class="task-badge task-badge-soon">Bientôt</span>`;
        } else {
            statusHtml = `<span class="task-badge task-badge-ok">OK (${diff}j)</span>`;
        }

        const li = document.createElement('li');
        li.className = 'task-item';
        
        // Au clic, on valide la tache (reset lastDone)
        li.onclick = () => confirmCompleteTask(task.id, task.title);

        li.innerHTML = `
            <div class="task-left">
                <div class="task-checkbox">${isUrgent ? '!' : ''}</div>
                <div class="task-content">
                    <h4>${task.title}</h4>
                    <p>Tous les ${freq}j</p>
                </div>
            </div>
            ${statusHtml}
        `;
        list.appendChild(li);
    });
    
    // Update badge count
    const badge = document.getElementById('task-info-count');
    badge.innerText = urgentCount > 0 ? `${urgentCount} urgente(s)` : 'Tout est propre ✨';
    badge.style.color = urgentCount > 0 ? 'var(--danger)' : 'var(--text-light)';
}

function getDaysDiff(dateStr) {
    if(!dateStr) return 999;
    const past = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now - past);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
}

window.confirmCompleteTask = (id, title) => {
    if(confirm(`Marquer "${title}" comme fait maintenant ?`)) {
        const taskIdx = localTasks.findIndex(t => t.id === id);
        if(taskIdx > -1) {
            localTasks[taskIdx].lastDone = new Date().toISOString();
            saveTasksData();
            renderTasks();
        }
    }
};

// GESTION MODALE TASKS (SETTINGS)
window.openTaskManagerModal = () => {
    const list = document.getElementById('settings-tasks-list');
    list.innerHTML = '';
    localTasks.forEach(task => {
        const li = document.createElement('li');
        li.onclick = () => openEditTaskModal(task.id);
        li.style.cursor = 'pointer';
        li.innerHTML = `<span>${task.title}</span><small style="color:var(--text-light)">Tous les ${task.frequency}j</small>`;
        list.appendChild(li);
    });
    document.getElementById('modal-task-manager').style.display = 'flex';
};

window.openEditTaskModal = (taskId = null) => {
    const modal = document.getElementById('modal-edit-task');
    const deleteBtn = document.getElementById('btn-delete-task');
    document.getElementById('form-task').reset();
    
    if(taskId) {
        const t = localTasks.find(x => x.id === taskId);
        document.getElementById('modal-task-title').innerText = "Modifier Tâche";
        document.getElementById('task-id').value = t.id;
        document.getElementById('task-title').value = t.title;
        document.getElementById('task-freq').value = t.frequency;
        deleteBtn.style.display = 'block';
    } else {
        document.getElementById('modal-task-title').innerText = "Nouvelle Tâche";
        document.getElementById('task-id').value = '';
        deleteBtn.style.display = 'none';
    }
    modal.style.display = 'flex';
};

document.getElementById('form-task').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value;
    const freq = parseInt(document.getElementById('task-freq').value);

    if(id) {
        const idx = localTasks.findIndex(t => t.id === id);
        if(idx > -1) {
            localTasks[idx].title = title;
            localTasks[idx].frequency = freq;
        }
    } else {
        localTasks.push({
            id: 'task_'+Date.now(),
            title: title,
            frequency: freq,
            lastDone: new Date(Date.now() - (freq * 86400000 * 2)).toISOString() // Force urgent au début
        });
    }
    saveTasksData();
    document.getElementById('modal-edit-task').style.display = 'none';
    openTaskManagerModal(); // Refresh list
    renderTasks(); // Refresh dashboard
});

window.deleteCurrentTask = () => {
    const id = document.getElementById('task-id').value;
    if(confirm("Supprimer cette tâche ?")) {
        localTasks = localTasks.filter(t => t.id !== id);
        saveTasksData();
        document.getElementById('modal-edit-task').style.display = 'none';
        openTaskManagerModal();
        renderTasks();
    }
};

function saveTasksData() {
    if(isDemoMode) {
        localStorage.setItem('demoTasks', JSON.stringify(localTasks));
    } else {
        db.collection('users').doc(currentUser.uid).collection('settings').doc('tasks').set({ list: localTasks });
    }
}

function loadLocalTasks() {
    const saved = localStorage.getItem('demoTasks');
    if(saved) localTasks = JSON.parse(saved);
}

// 2. DASHBOARD METRICS
function renderDashboard() {
    const now = new Date(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
    let filteredEggs = [], filteredTransactions = [];

    if (currentStatsPeriod === 'month') {
        filteredEggs = localEggs.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
        filteredTransactions = localTransactions.filter(e => { const d = new Date(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
        document.getElementById('label-eggs-display').innerText = "Œufs (Mois)"; document.getElementById('chart-title').innerHTML = '<i class="fas fa-chart-bar"></i> Jours du mois';
    } else {
        filteredEggs = localEggs.filter(e => new Date(e.date).getFullYear() === currentYear);
        filteredTransactions = localTransactions.filter(e => new Date(e.date).getFullYear() === currentYear);
        document.getElementById('label-eggs-display').innerText = "Œufs (Année)"; document.getElementById('chart-title').innerHTML = '<i class="fas fa-chart-bar"></i> Mois de l\'année';
    }
    
    document.getElementById('total-eggs-display').innerText = filteredEggs.length;
    
    const totalExpenses = filteredTransactions.filter(t => t.category === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    const costPerEgg = filteredEggs.length > 0 ? (totalExpenses / filteredEggs.length).toFixed(2) : "0.00";
    document.getElementById('cost-per-egg-display').innerText = costPerEgg + ' €';

    updateEggsChart(filteredEggs);
    
    const list = document.getElementById('recent-activity-list'); list.innerHTML = '';
    const recentEggs = [...localEggs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    recentEggs.forEach(egg => {
        const li = document.createElement('li'); const d = new Date(egg.date);
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;"><span>🥚</span><span style="font-weight:500;">${egg.chickenName}</span></div>
            <div style="display:flex; align-items:center;"><span style="font-size:12px; color:#999; margin-right:5px;">${d.getDate()}/${d.getMonth()+1}</span><button class="delete-icon-btn" onclick="deleteEgg('${egg.id}')"><i class="fas fa-trash-alt"></i></button></div>`;
        list.appendChild(li);
    });
}
function updateEggsChart(eggsData) {
    let labels = [], data = [];
    if (currentStatsPeriod === 'month') { labels = Array.from({length: 31}, (_, i) => i + 1); data = new Array(31).fill(0); eggsData.forEach(e => { data[new Date(e.date).getDate() - 1]++; }); } 
    else { labels = ['J','F','M','A','M','J','J','A','S','O','N','D']; data = new Array(12).fill(0); eggsData.forEach(e => { data[new Date(e.date).getMonth()]++; }); }
    eggsChartInstance.data.labels = labels; eggsChartInstance.data.datasets[0].data = data; eggsChartInstance.update();
}

// 3. POULES (FIX EDIT CLICK)
function renderChickensList() {
    const grid = document.getElementById('chickens-grid'); grid.innerHTML = '';
    const list = localChickens.filter(c => (c.status || 'active') === currentFilter);
    if (list.length === 0) { grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#999; margin-top:30px;">Vide 🐣</p>'; return; }
    list.forEach(chk => {
        const img = chk.photo || 'icon.png';
        const card = document.createElement('div'); 
        card.className = `chicken-card ${chk.status === 'archived' ? 'grayscale-card' : ''}`;
        
        // IMPORTANT: On utilise stopPropagation sur le bouton œuf pour ne pas déclencher l'ouverture du détail
        card.innerHTML = `
            <div onclick="openChickenDetails('${chk.id}')">
                <img src="${img}" class="chicken-img">
                <h3 style="margin:5px 0;">${chk.name}</h3>
                <small style="color:#888">${chk.breed}</small>
            </div>
            ${chk.status === 'active' ? `<button class="egg-btn" onclick="event.stopPropagation(); handleAddEgg('${chk.id}', '${chk.name}')">🥚 A pondu !</button>` : `<small style="display:block;margin-top:10px">Archivée</small>`}
        `;
        grid.appendChild(card);
    });
}
function filterChickens(status, btn) { currentFilter = status; document.querySelectorAll('#view-chickens .segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderChickensList(); }
function switchStatsPeriod(period, btn) { currentStatsPeriod = period; document.querySelectorAll('#view-dashboard .segment-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderDashboard(); }

// 4. FINANCE
function renderFinance() {
    const list = document.getElementById('expenses-list'); list.innerHTML = '';
    localTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let totalIncome = 0; let totalExpense = 0;
    let map = { graines: 0, paille: 0, soins: 0, materiel: 0, autre: 0 }; 

    localTransactions.forEach(trans => {
        if(trans.category === 'income') totalIncome += trans.amount;
        else {
            totalExpense += trans.amount;
            const t = map[trans.type] !== undefined ? trans.type : 'autre'; 
            map[t] += trans.amount;
        }

        const li = document.createElement('li');
        li.className = 'expenses-list-item'; li.onclick = () => openTransactionModal(trans.id);
        const icon = trans.category === 'income' ? '💰' : (trans.type === 'graines' ? '🌾' : (trans.type === 'paille' ? '🛏️' : '💊'));
        const color = trans.category === 'income' ? 'var(--success)' : 'var(--danger)';
        const sign = trans.category === 'income' ? '+' : '-';
        
        li.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; gap:8px"><span style="font-size:18px">${icon}</span><span style="text-transform:capitalize; font-weight:500;">${trans.type || 'Vente'}</span></div>
                <small style="color:#999; margin-left:26px;">${new Date(trans.date).toLocaleDateString()}</small>
            </div>
            <span style="font-weight:600; color:${color}">${sign}${trans.amount}€</span>
        `;
        list.appendChild(li);
    });

    document.getElementById('finance-income').innerText = totalIncome.toFixed(2) + '€';
    document.getElementById('finance-expense').innerText = totalExpense.toFixed(2) + '€';
    document.getElementById('finance-balance').innerText = (totalIncome - totalExpense).toFixed(2) + '€';

    const progressBar = document.getElementById('finance-progress-bar'); progressBar.innerHTML = '';
    if (totalExpense === 0) { progressBar.innerHTML = '<div class="progress-segment" style="width:100%; background-color:#e5e5e5;"></div>'; } 
    else { for (const [type, amount] of Object.entries(map)) { if (amount > 0) { const percentage = (amount / totalExpense) * 100; progressBar.innerHTML += `<div class="progress-segment bg-${type}" style="width:${percentage}%"></div>`; } } }
    const legend = document.getElementById('finance-legend'); legend.innerHTML = ''; const labels = { graines: 'Graines', paille: 'Paille', soins: 'Soins', materiel: 'Matériel', autre: 'Autre' };
    for (const [type, amount] of Object.entries(map)) { if (amount > 0 || totalExpense === 0) { legend.innerHTML += `<div class="legend-item"><div class="legend-color bg-${type}"></div><span>${labels[type]} (${totalExpense > 0 ? Math.round((amount/totalExpense)*100) : 0}%)</span></div>`; } }
}

// --- MODALS ACTIONS ---

// OEUFS
window.handleAddEgg = (id, name) => {
    const newEgg = { id: 'egg_'+Date.now(), chickenId: id, chickenName: name, date: new Date().toISOString() };
    if (isDemoMode) { localEggs.push(newEgg); renderDashboard(); alert(`Top ${name} !`); }
    else { db.collection('users').doc(currentUser.uid).collection('eggs').add(newEgg); }
};
window.deleteEgg = (eggId) => {
    if(confirm("Supprimer cet œuf ?")) {
        if(isDemoMode) { localEggs = localEggs.filter(e => e.id !== eggId); renderDashboard(); }
        else { db.collection('users').doc(currentUser.uid).collection('eggs').doc(eggId).delete(); }
    }
};

// POULES
window.openChickenDetails = (id) => {
    currentChickenId = id; const chk = localChickens.find(c => c.id === id); 
    if(!chk) { console.error("Poule non trouvée avec ID:", id); return; }

    document.getElementById('detail-name').innerText = chk.name; document.getElementById('detail-breed').innerText = chk.breed;
    document.getElementById('detail-price').innerText = (chk.price || 0) + ' €'; document.getElementById('detail-date').innerText = new Date(chk.date).toLocaleDateString();
    document.getElementById('detail-age').innerText = calculateAge(chk.date); document.getElementById('detail-photo').src = chk.photo;
    document.getElementById('detail-total-eggs').innerText = localEggs.filter(e => e.chickenId === id).length;
    
    const healthList = document.getElementById('health-list'); healthList.innerHTML = '';
    const myTreatments = localTreatments.filter(t => t.chickenId === id).sort((a,b) => new Date(b.date) - new Date(a.date));
    if(myTreatments.length === 0) healthList.innerHTML = '<li><small style="color:#999">Aucun soin enregistré</small></li>';
    myTreatments.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `<div><strong>${t.type}</strong> <span style="font-size:12px;color:#777">(${new Date(t.date).toLocaleDateString()})</span><br><small>${t.note || ''}</small></div>`;
        healthList.appendChild(li);
    });

    const archiveBtn = document.getElementById('btn-archive');
    if(chk.status === 'archived') { archiveBtn.innerText = 'Désarchiver'; archiveBtn.className = 'glass-btn primary-btn'; archiveBtn.onclick = () => toggleArchiveStatus(id, 'active'); document.getElementById('detail-status').innerText='Archivée';}
    else { archiveBtn.innerText = 'Archiver'; archiveBtn.className = 'glass-btn danger-btn'; archiveBtn.onclick = () => toggleArchiveStatus(id, 'archived'); document.getElementById('detail-status').innerText='Active';}
    document.getElementById('view-chickens').classList.remove('active-view'); document.getElementById('view-chicken-detail').classList.add('active-view'); 
};
window.closeChickenDetails = () => { document.getElementById('view-chicken-detail').classList.remove('active-view'); document.getElementById('view-chickens').classList.add('active-view'); };

// MODAL TRAITEMENT
window.openTreatmentModal = () => {
    document.getElementById('form-treatment').reset(); document.getElementById('treat-date').valueAsDate = new Date();
    document.getElementById('modal-treatment').style.display = 'flex';
};
document.getElementById('form-treatment').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        chickenId: currentChickenId,
        date: new Date(document.getElementById('treat-date').value).toISOString(),
        type: document.getElementById('treat-type').value,
        note: document.getElementById('treat-note').value
    };
    if(isDemoMode) { localTreatments.push({ id:'t'+Date.now(), ...data }); openChickenDetails(currentChickenId); }
    else { db.collection('users').doc(currentUser.uid).collection('treatments').add(data); }
    document.getElementById('modal-treatment').style.display = 'none';
});

// MODAL TRANSACTION
window.setTransactionType = (type) => {
    document.getElementById('trans-category').value = type;
    document.getElementById('btn-type-expense').className = type === 'expense' ? 'segment-btn active' : 'segment-btn';
    document.getElementById('btn-type-income').className = type === 'income' ? 'segment-btn active' : 'segment-btn';
    document.getElementById('field-expense-type').style.display = type === 'expense' ? 'block' : 'none';
};

window.openTransactionModal = (transId = null) => {
    const modal = document.getElementById('modal-transaction');
    const deleteBtn = document.getElementById('btn-delete-trans');
    document.getElementById('form-transaction').reset();
    setTransactionType('expense');
    document.getElementById('trans-date').valueAsDate = new Date();

    if (transId) {
        const t = localTransactions.find(e => e.id === transId); if (!t) return;
        document.getElementById('modal-transaction-title').innerText = "Modifier";
        document.getElementById('trans-id').value = t.id; 
        document.getElementById('trans-date').value = t.date.split('T')[0];
        document.getElementById('trans-amount').value = t.amount;
        setTransactionType(t.category || 'expense');
        if(t.category === 'expense') document.getElementById('trans-type').value = t.type;
        deleteBtn.style.display = 'flex';
    } else {
        document.getElementById('modal-transaction-title').innerText = "Nouvelle Transaction";
        document.getElementById('trans-id').value = ''; 
        deleteBtn.style.display = 'none';
    }
    modal.style.display = 'flex';
};

document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('trans-id').value;
    const category = document.getElementById('trans-category').value;
    const data = { 
        category: category,
        type: category === 'expense' ? document.getElementById('trans-type').value : 'vente',
        amount: parseFloat(document.getElementById('trans-amount').value), 
        date: new Date(document.getElementById('trans-date').value).toISOString() 
    };
    
    if (isDemoMode) {
        if (id) { const idx = localTransactions.findIndex(e => e.id === id); if (idx !== -1) localTransactions[idx] = { id, ...data }; }
        else { localTransactions.push({ id: 'tr' + Date.now(), ...data }); }
        renderAll();
    } else {
        if (id) { db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).update(data); }
        else { db.collection('users').doc(currentUser.uid).collection('transactions').add(data); }
    }
    document.getElementById('modal-transaction').style.display = 'none';
});

window.deleteCurrentTransaction = () => {
    const id = document.getElementById('trans-id').value; if (!id) return;
    if (confirm("Supprimer cette transaction ?")) {
        if (isDemoMode) { localTransactions = localTransactions.filter(e => e.id !== id); renderAll(); }
        else { db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).delete(); }
        document.getElementById('modal-transaction').style.display = 'none';
    }
};

// GESTION POULES & IMAGE
function compressImage(file, callback) {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image(); img.src = event.target.result;
        img.onload = () => {
            const canvas = document.getElementById('compression-canvas'); const ctx = canvas.getContext('2d');
            const maxWidth = 800; const scaleSize = maxWidth / img.width;
            canvas.width = maxWidth; canvas.height = img.height * scaleSize;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    };
}
document.getElementById('chk-photo-file').addEventListener('change', (e) => { if (e.target.files[0]) { compressImage(e.target.files[0], (src) => { document.getElementById('preview-photo').src = src; }); } });

window.openChickenModal = (isEdit = false) => {
    const modal = document.getElementById('modal-chicken'); 
    const deleteBtn = document.getElementById('btn-delete-chicken');
    document.getElementById('form-chicken').reset();
    
    if (!isEdit) { 
        document.getElementById('modal-chicken-title').innerText="Nouvelle Poule"; 
        document.getElementById('chk-id').value=''; 
        document.getElementById('preview-photo').src='icon.png'; 
        deleteBtn.style.display='none'; 
    }
    else if (isEdit && currentChickenId) {
        const chk = localChickens.find(c => c.id === currentChickenId);
        document.getElementById('modal-chicken-title').innerText="Modifier"; 
        document.getElementById('chk-id').value=chk.id; 
        document.getElementById('chk-name').value=chk.name; 
        document.getElementById('chk-breed').value=chk.breed; 
        document.getElementById('chk-date').value=chk.date||''; 
        document.getElementById('chk-price').value=chk.price||''; 
        document.getElementById('preview-photo').src=chk.photo||'icon.png';
        deleteBtn.style.display='flex';
    }
    modal.style.display='flex';
};
window.editCurrentChicken = () => openChickenModal(true);

document.getElementById('form-chicken').addEventListener('submit', (e) => {
    e.preventDefault(); const id = document.getElementById('chk-id').value;
    const data = { name: document.getElementById('chk-name').value, breed: document.getElementById('chk-breed').value, date: document.getElementById('chk-date').value, price: parseFloat(document.getElementById('chk-price').value), photo: document.getElementById('preview-photo').src, status: 'active' };
    if (isDemoMode) {
        if(id) { const idx = localChickens.findIndex(c => c.id === id); localChickens[idx] = { ...localChickens[idx], ...data }; if(currentChickenId === id) openChickenDetails(id); }
        else { localChickens.push({ id: 'demo'+Date.now(), ...data }); filterChickens('active', document.getElementById('btn-filter-active')); }
        renderChickensList();
    } else {
        if(id) { db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).update(data); if(currentChickenId === id) openChickenDetails(id); }
        else { db.collection('users').doc(currentUser.uid).collection('chickens').add(data); filterChickens('active', document.getElementById('btn-filter-active')); }
    }
    document.getElementById('modal-chicken').style.display='none';
});

window.deleteCurrentChicken = () => {
    const id = document.getElementById('chk-id').value; if (!id) return;
    if (confirm("Supprimer cette poule ?")) {
        if(isDemoMode){localChickens=localChickens.filter(c=>c.id!==id);closeChickenDetails();renderChickensList();}
        else{db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).delete().then(()=>closeChickenDetails());}
        document.getElementById('modal-chicken').style.display='none';
    }
};

window.archiveCurrentChicken = () => toggleArchiveStatus(currentChickenId, 'archived');
function toggleArchiveStatus(id, status) {
    if(isDemoMode) { const chk = localChickens.find(c => c.id === id); if(chk) chk.status = status; closeChickenDetails(); renderChickensList(); }
    else { db.collection('users').doc(currentUser.uid).collection('chickens').doc(id).update({status}); closeChickenDetails(); }
}
function calculateAge(d) { if(!d) return '?'; const m = (new Date().getFullYear()-new Date(d).getFullYear())*12 - new Date(d).getMonth() + new Date().getMonth(); return m<12 ? m+" mois" : Math.floor(m/12)+" ans"; }
function updateAuthUI(isLoggedIn) {
    document.getElementById('auth-logged-out').style.display = isLoggedIn ? 'none' : 'block'; document.getElementById('auth-logged-in').style.display = isLoggedIn ? 'flex' : 'none';
    if(isLoggedIn) { document.getElementById('user-name').innerText = currentUser.displayName; document.getElementById('user-email').innerText = currentUser.email; document.getElementById('user-photo').src = currentUser.photoURL; }
}
document.getElementById('google-login-btn').addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

// DATA
function loadFirebaseData() { 
    const r = db.collection('users').doc(currentUser.uid); 
    r.collection('chickens').onSnapshot(s => { localChickens = s.docs.map(d=>({id:d.id, ...d.data()})); renderAll(); }); 
    r.collection('eggs').orderBy('date').onSnapshot(s => { localEggs = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); }); 
    r.collection('transactions').orderBy('date').onSnapshot(s => { localTransactions = s.docs.map(d=>({id:d.id, ...d.data()})); renderAll(); }); 
    r.collection('treatments').orderBy('date').onSnapshot(s => { localTreatments = s.docs.map(d=>({id:d.id, ...d.data()})); if(currentChickenId) openChickenDetails(currentChickenId); });
    r.collection('settings').doc('tasks').onSnapshot(s => { if(s.exists) { localTasks = s.data().list || []; renderTasks(); }});
}
function initEggsChart() { eggsChartInstance = new Chart(document.getElementById('eggsChart').getContext('2d'), { type: 'bar', data: { labels: [], datasets: [{ label: 'Œufs', data: [], backgroundColor: '#0071e3', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: {legend:{display:false}}, scales:{y:{beginAtZero:true, display:false}, x:{grid:{display:false}}} } }); }
