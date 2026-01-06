// extensions.js - Version ULTIME
// Comprend : Stock, Météo, Frigo, Stats, Fraîcheur, Journal, Succès.

// CONFIG
const FEED_KG_PER_DAY = 0.12; // 120g par poule

// ==========================================
// 0. AUTO-INJECTION (Le "Magicien" du DOM)
// ==========================================
function injectExtensionContainers() {
    const dashboard = document.getElementById('view-dashboard');
    const settings = document.getElementById('view-settings');
    
    if (!dashboard || !settings) return;

    // 1. MÉTÉO (Haut du Dashboard)
    if (!document.getElementById('weather-tip-container')) {
        const tipDiv = document.createElement('div');
        tipDiv.id = 'weather-tip-container';
        tipDiv.style.marginBottom = "20px";
        const title = dashboard.querySelector('.big-title');
        if (title) title.insertAdjacentElement('afterend', tipDiv);
        else dashboard.prepend(tipDiv);
    }

    // 2. FRIGO & FRAÎCHEUR & STOCK (Avant les graphiques)
    let stockContainer = document.getElementById('stock-widget-container');
    if (!stockContainer) {
        stockContainer = document.createElement('div');
        stockContainer.id = 'stock-widget-container';
        const chartCard = dashboard.querySelector('.chart-card');
        if (chartCard) dashboard.insertBefore(stockContainer, chartCard);
        else dashboard.querySelector('.status-row')?.insertAdjacentElement('afterend', stockContainer);
    }

    if (!document.getElementById('fridge-widget-container')) {
        const fridgeDiv = document.createElement('div');
        fridgeDiv.id = 'fridge-widget-container';
        stockContainer.parentNode.insertBefore(fridgeDiv, stockContainer);
    }

    // 3. JOURNAL DE BORD (Bas du Dashboard)
    if (!document.getElementById('journal-widget-container')) {
        const journalDiv = document.createElement('div');
        journalDiv.id = 'journal-widget-container';
        // On l'ajoute avant la liste des derniers œufs
        const activityList = document.getElementById('recent-activity-list');
        if (activityList && activityList.previousElementSibling) {
            activityList.previousElementSibling.insertAdjacentElement('beforebegin', journalDiv);
        } else {
            dashboard.appendChild(journalDiv);
        }
    }

    // 4. SUCCÈS (Dans les Réglages)
    if (!document.getElementById('achievements-container')) {
        const badgDiv = document.createElement('div');
        badgDiv.id = 'achievements-container';
        // Insérer après la carte profil
        const profileCard = settings.querySelector('.profile-header-card');
        if (profileCard) profileCard.insertAdjacentElement('afterend', badgDiv);
    }
}

// ==========================================
// 1. GESTION FRIGO & FRAÎCHEUR (DCR)
// ==========================================
let fridgeStock = parseInt(localStorage.getItem('poupoules_fridge_qty') || '0');

function renderFridgeWidget() {
    const container = document.getElementById('fridge-widget-container');
    if (!container) return;

    // Calcul date de fraîcheur (Aujourd'hui + 28 jours)
    const dcr = new Date();
    dcr.setDate(dcr.getDate() + 28);
    const dcrStr = dcr.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    container.innerHTML = `
        <div class="glass-card" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px;">
            <div style="display:flex; align-items:center; gap:15px;">
                <div class="icon-circle" style="background:rgba(52, 199, 89, 0.2); color:var(--success); font-size:20px;">
                    <i class="fas fa-box-open"></i>
                </div>
                <div>
                    <span class="status-label">Stock Frigo</span>
                    <div style="font-size:20px; font-weight:800;">${fridgeStock} œufs</div>
                </div>
            </div>
            <div style="display:flex; gap:5px;">
                <button onclick="updateFridge(1)" class="glass-btn-round" style="width:35px; height:35px; border:none; background:rgba(0,0,0,0.05); cursor:pointer; border-radius:50%;"><i class="fas fa-plus"></i></button>
                <button onclick="updateFridge(-1)" class="glass-btn-round" style="width:35px; height:35px; border:none; background:rgba(0,0,0,0.05); cursor:pointer; border-radius:50%;"><i class="fas fa-utensils"></i></button>
                <button onclick="openSellModal()" class="glass-btn-round" style="width:35px; height:35px; background:var(--success); color:white; border:none; cursor:pointer; border-radius:50%;"><i class="fas fa-euro-sign"></i></button>
            </div>
        </div>

        <div style="margin-bottom:20px; font-size:12px; color:var(--text-grey); display:flex; gap:8px; align-items:center; padding:0 10px;">
            <i class="fas fa-calendar-check" style="color:var(--primary);"></i>
            <span>Les œufs du jour sont à consommer avant le <strong>${dcrStr}</strong>.</span>
        </div>
    `;
}

window.updateFridge = (amount) => {
    fridgeStock += amount;
    if (fridgeStock < 0) fridgeStock = 0;
    localStorage.setItem('poupoules_fridge_qty', fridgeStock);
    renderFridgeWidget();
    checkAchievements(); // Vérif Succès
};

window.openSellModal = () => {
    const qty = prompt("Nombre d'œufs vendus ?", "6");
    if (qty && qty > 0 && qty <= fridgeStock) {
        const price = prompt("Prix total (€) ?", (qty * 0.5).toFixed(2));
        if (price) {
            updateFridge(-parseInt(qty));
            if (typeof localTransactions !== 'undefined') {
                localTransactions.push({ id: 't'+Date.now(), category:'income', type:'vente_oeufs', amount:parseFloat(price), date:new Date().toISOString() });
                if(window.saveData) window.saveData();
                if(window.renderFinance) window.renderFinance();
                alert(`Vente de ${price}€ enregistrée !`);
                checkAchievements();
            }
        }
    } else if (qty > fridgeStock) alert("Pas assez de stock !");
};

// ==========================================
// 2. STOCK GRAINES
// ==========================================
let stockData = JSON.parse(localStorage.getItem('poupoules_stock') || '{"quantity": 0, "date": null}');

function renderStockWidget() {
    const container = document.getElementById('stock-widget-container');
    if (!container) return;
    const activeCount = typeof localChickens !== 'undefined' ? localChickens.filter(c => c.status === 'active').length : 0;
    
    if (activeCount === 0 || !stockData.date || stockData.quantity <= 0) {
        container.innerHTML = `<div class="glass-card stock-card" onclick="openStockModal()"><div style="display:flex; align-items:center; gap:10px;"><div class="icon-circle" style="background:rgba(142, 142, 147, 0.2); color:#555;"><i class="fas fa-wheat"></i></div><div class="status-info"><span class="status-label">Stock Graines</span><span class="status-value" style="font-size:14px; color:var(--primary);">Configurer</span></div></div></div>`;
        return;
    }

    const daysGone = Math.floor((new Date() - new Date(stockData.date)) / (1000 * 60 * 60 * 24));
    const consumed = daysGone * (activeCount * FEED_KG_PER_DAY);
    let current = stockData.quantity - consumed;
    let percent = (current / stockData.quantity) * 100;
    if (current < 0) { current = 0; percent = 0; }
    let color = percent < 10 ? 'var(--danger)' : (percent < 30 ? 'var(--warning)' : 'var(--success)');

    container.innerHTML = `
        <div class="glass-card stock-card" onclick="openStockModal()">
            <div class="stock-header"><span class="stock-title"><i class="fas fa-wheat"></i> Réserve</span><span class="stock-value">${current.toFixed(1)} kg</span></div>
            <div class="stock-bar-bg"><div class="stock-bar-fill" style="width: ${percent}%; background: ${color};"></div></div>
            <div class="stock-footer"><small>Conso: ${(activeCount * FEED_KG_PER_DAY).toFixed(2)} kg/j</small><small>Reste ~${Math.floor(current / (activeCount * FEED_KG_PER_DAY))} jours</small></div>
        </div>`;
}

window.saveStock = (e) => { e.preventDefault(); const qty = parseFloat(document.getElementById('stock-qty').value); if (qty > 0) { stockData = { quantity: qty, date: new Date().toISOString() }; localStorage.setItem('poupoules_stock', JSON.stringify(stockData)); document.getElementById('modal-stock').style.display = 'none'; renderStockWidget(); }};
window.openStockModal = () => { document.getElementById('modal-stock').style.display = 'flex'; document.getElementById('stock-qty').value = stockData.quantity || ''; };


// ==========================================
// 3. JOURNAL DE BORD (NOTES)
// ==========================================
let localNotes = JSON.parse(localStorage.getItem('poupoules_notes') || '[]');

function renderJournalWidget() {
    const container = document.getElementById('journal-widget-container');
    if (!container) return;

    let notesHtml = '';
    const recentNotes = localNotes.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 3);

    if (recentNotes.length === 0) {
        notesHtml = `<li style="color:var(--text-grey); font-size:14px; padding:10px; text-align:center;">Rien à signaler.</li>`;
    } else {
        recentNotes.forEach(note => {
            notesHtml += `
                <li style="display:flex; flex-direction:column; align-items:flex-start; gap:5px; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; width:100%;">
                        <small style="color:var(--text-grey); font-weight:600;">${new Date(note.date).toLocaleDateString()}</small>
                        <i class="fas fa-times" style="color:var(--text-grey); cursor:pointer;" onclick="deleteNote('${note.id}')"></i>
                    </div>
                    <span style="font-size:15px;">${note.text}</span>
                </li>
            `;
        });
    }

    container.innerHTML = `
        <h3 class="section-title">📝 Journal de bord</h3>
        <div class="glass-card">
            <form onsubmit="addNote(event)" style="display:flex; gap:10px; margin-bottom:15px;">
                <input type="text" id="new-note-input" placeholder="Événement (ex: Vu un renard...)" required style="flex:1;">
                <button type="submit" class="glass-btn-round" style="width:40px; height:40px; background:var(--primary); color:white; border:none; border-radius:12px;"><i class="fas fa-paper-plane"></i></button>
            </form>
            <ul class="glass-list" style="background:transparent; border:none; box-shadow:none; padding:0; gap:10px;">
                ${notesHtml}
            </ul>
        </div>
    `;
}

window.addNote = (e) => {
    e.preventDefault();
    const input = document.getElementById('new-note-input');
    if (input.value) {
        localNotes.push({ id: 'n'+Date.now(), text: input.value, date: new Date().toISOString() });
        localStorage.setItem('poupoules_notes', JSON.stringify(localNotes));
        renderJournalWidget();
    }
};

window.deleteNote = (id) => {
    if(confirm("Effacer cette note ?")) {
        localNotes = localNotes.filter(n => n.id !== id);
        localStorage.setItem('poupoules_notes', JSON.stringify(localNotes));
        renderJournalWidget();
    }
};


// ==========================================
// 4. SUCCÈS (GAMIFICATION)
// ==========================================
function checkAchievements() {
    // Liste des Badges
    const badges = [
        { id: 'first_chicken', icon: 'fa-crow', title: 'Premier Pas', desc: 'Avoir au moins 1 poule', check: () => localChickens.length > 0 },
        { id: 'big_flock', icon: 'fa-users', title: 'Grande Famille', desc: 'Avoir 5 poules ou plus', check: () => localChickens.length >= 5 },
        { id: 'egg_master', icon: 'fa-egg', title: 'Pondeuse d\'Or', desc: '100 œufs ramassés (total)', check: () => localEggs.length >= 100 },
        { id: 'rich', icon: 'fa-coins', title: 'Rentier', desc: 'Avoir un budget positif', check: () => {
             let tot = 0; localTransactions.forEach(t => tot += (t.category==='income'?t.amount:-t.amount)); return tot > 0;
        }},
        { id: 'fridge_full', icon: 'fa-box', title: 'Garde Manger', desc: 'Avoir 24 œufs au frigo', check: () => fridgeStock >= 24 }
    ];

    return badges.map(b => ({ ...b, unlocked: b.check() }));
}

function renderAchievements() {
    const container = document.getElementById('achievements-container');
    if (!container) return;

    const data = checkAchievements();
    let html = `<h3 class="settings-header">Succès & Badges</h3><div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); gap:10px; padding:0 15px 20px 15px;">`;
    
    data.forEach(b => {
        const opacity = b.unlocked ? '1' : '0.4';
        const color = b.unlocked ? 'var(--warning)' : 'var(--text-grey)';
        const bg = b.unlocked ? 'rgba(255, 149, 0, 0.1)' : 'rgba(0,0,0,0.05)';
        
        html += `
            <div style="background:${bg}; border-radius:15px; padding:15px 5px; text-align:center; opacity:${opacity}; display:flex; flex-direction:column; align-items:center;">
                <div style="font-size:24px; color:${color}; margin-bottom:5px;"><i class="fas ${b.icon}"></i></div>
                <div style="font-size:10px; font-weight:700; color:var(--text-dark);">${b.title}</div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}


// ==========================================
// 5. STATS PODIUM (EXISTANT)
// ==========================================
function renderAdvancedStats() {
    const container = document.getElementById('advanced-stats-container');
    if (!container) return;
    const counts = {}; localEggs.forEach(e => { if(!counts[e.chickenName]) counts[e.chickenName]=0; counts[e.chickenName]++; });
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0,3);
    if (sorted.length === 0) { container.innerHTML = ''; return; }
    const medals = ['🥇', '🥈', '🥉'];
    let html = `<h3 class="section-title">🏆 Top Pondeuses</h3><div class="podium-container">`;
    sorted.forEach((item, index) => {
        let photo = 'icon.png'; const c = localChickens.find(x => x.name === item[0]); if (c && c.photo) photo = c.photo;
        html += `<div class="podium-item rank-${index+1}"><div class="medal">${medals[index]}</div><img src="${photo}" class="podium-photo"><span class="podium-name">${item[0]}</span><span class="podium-score">${item[1]}</span></div>`;
    });
    container.innerHTML = html + `</div>`;
}

// ==========================================
// 6. MÉTÉO (AVEC FALLBACK)
// ==========================================
function renderWeatherTip() {
    const container = document.getElementById('weather-tip-container');
    if (!container) return;

    const displayTip = (t, loc) => {
        let tip = "Tout va bien !"; let icon = "fa-sun"; let color = "var(--primary)";
        if (t < 0) { tip = `Il gèle (${t}°C) ❄️ ! Graissez les crêtes.`; icon = "fa-snowflake"; color = "#007aff"; }
        else if (t < 10) { tip = `Frais (${t}°C). Litière sèche SVP.`; icon = "fa-temperature-low"; color = "#5ac8fa"; }
        else if (t > 30) { tip = `Canicule (${t}°C) 🥵 ! Eau fraîche !`; icon = "fa-fire"; color = "#ff3b30"; }
        else if (t > 25) { tip = `Chaud (${t}°C). Changez l'eau.`; icon = "fa-sun"; color = "#ff9500"; }
        else { tip = `Météo douce (${t}°C). Idéal.`; }
        container.innerHTML = `<div class="glass-card" style="padding:15px; display:flex; gap:15px; align-items:center; background:linear-gradient(to right, var(--glass-bg), rgba(255,255,255,0.4)); border-left: 4px solid ${color};"><i class="fas ${icon}" style="font-size:24px; color:${color};"></i><div style="font-size:13px; font-weight:600; color:var(--text-dark); line-height:1.4;">${tip} <br><span style="font-size:10px; color:var(--text-grey); font-weight:400;">${loc}</span></div></div>`;
    };

    const fallback = () => fetch(`https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true`).then(r=>r.json()).then(d=>displayTip(d.current_weather.temperature, "Paris (Défaut)")).catch(()=>{});

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`).then(r=>r.json()).then(d=>displayTip(d.current_weather.temperature, "Ma position")).catch(fallback),
            fallback
        );
    } else fallback();
}

// ==========================================
// MAIN CALL
// ==========================================
window.renderExtensions = () => {
    injectExtensionContainers();
    renderFridgeWidget();
    renderStockWidget();
    renderJournalWidget(); // Nouveau !
    renderWeatherTip();
    renderAdvancedStats();
    renderAchievements(); // Nouveau !
};
