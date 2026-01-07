// extensions.js - VERSION CORRIGÉE (Boutons Recycleur)
// Comprend : Météo, Stock, Frigo, Journal, Succès, Véto, Santé, Ventes, Coût, Almanach, Hall of Fame
// + BIO-RECYCLEUR V2 (Fix Bug Boutons)

// CONFIG
const FEED_KG_PER_DAY = 0.12; // 120g par poule
const MARKET_EGG_PRICE = 0.45; 

// ==========================================
// 0. AUTO-INJECTION (Mise en page)
// ==========================================
function injectExtensionContainers() {
    const dashboard = document.getElementById('view-dashboard');
    const settings = document.getElementById('view-settings');
    const finance = document.getElementById('view-finance');
    const maintenance = document.getElementById('view-maintenance');
    const chickens = document.getElementById('view-chickens');

    if (!dashboard) return;

    // 1. MÉTÉO & ALMANACH
    if (!document.getElementById('weather-tip-container')) {
        const tipDiv = document.createElement('div');
        tipDiv.id = 'weather-tip-container';
        tipDiv.style.marginBottom = "10px";
        const title = dashboard.querySelector('.big-title');
        if (title) title.insertAdjacentElement('afterend', tipDiv);
        else dashboard.prepend(tipDiv);
    }
    if (!document.getElementById('almanac-container')) {
        const almanacDiv = document.createElement('div');
        almanacDiv.id = 'almanac-container';
        almanacDiv.style.marginBottom = "20px";
        const weather = document.getElementById('weather-tip-container');
        if(weather) weather.insertAdjacentElement('afterend', almanacDiv);
    }

    // 2. FRIGO, STOCK & RECYCLEUR
    let stockContainer = document.getElementById('stock-widget-container');
    if (!stockContainer) {
        stockContainer = document.createElement('div');
        stockContainer.id = 'stock-widget-container';
        const chartCard = dashboard.querySelector('.chart-card');
        if (chartCard) dashboard.insertBefore(stockContainer, chartCard);
        else {
            const statusRow = dashboard.querySelector('.status-row');
            if(statusRow) statusRow.insertAdjacentElement('afterend', stockContainer);
        }
    }
    if (!document.getElementById('fridge-widget-container')) {
        const fridgeDiv = document.createElement('div');
        fridgeDiv.id = 'fridge-widget-container';
        stockContainer.parentNode.insertBefore(fridgeDiv, stockContainer);
    }
    if (!document.getElementById('recycler-widget-container')) {
        const recyclerDiv = document.createElement('div');
        recyclerDiv.id = 'recycler-widget-container';
        recyclerDiv.style.marginTop = "20px";
        const chart = dashboard.querySelector('.chart-card');
        if(chart) chart.insertAdjacentElement('afterend', recyclerDiv);
    }

    // 3. JOURNAL
    if (!document.getElementById('journal-widget-container')) {
        const journalDiv = document.createElement('div');
        journalDiv.id = 'journal-widget-container';
        const activityList = document.getElementById('recent-activity-list');
        if (activityList && activityList.previousElementSibling) activityList.previousElementSibling.insertAdjacentElement('beforebegin', journalDiv);
        else dashboard.appendChild(journalDiv);
    }

    // 4. HALL OF FAME
    if (chickens && !document.getElementById('hall-of-fame-container')) {
        const hallDiv = document.createElement('div');
        hallDiv.id = 'hall-of-fame-container';
        hallDiv.style.marginBottom = "20px";
        const filter = chickens.querySelector('.segment-control');
        if(filter) filter.insertAdjacentElement('afterend', hallDiv);
    }

    // 5. FINANCE
    if (finance) {
        if (!document.getElementById('cost-price-container')) {
            const costDiv = document.createElement('div');
            costDiv.id = 'cost-price-container';
            const balanceCard = finance.querySelector('.balance-card');
            if (balanceCard) balanceCard.insertAdjacentElement('afterend', costDiv);
        }
        if (!document.getElementById('savings-piggy-container')) {
            const piggyDiv = document.createElement('div');
            piggyDiv.id = 'savings-piggy-container';
            piggyDiv.style.marginTop = "10px";
            const cost = document.getElementById('cost-price-container');
            if(cost) cost.insertAdjacentElement('afterend', piggyDiv);
        }
        if (!document.getElementById('sales-register-container')) {
            const salesDiv = document.createElement('div');
            salesDiv.id = 'sales-register-container';
            salesDiv.style.marginTop = "20px";
            salesDiv.style.marginBottom = "20px";
            const target = document.getElementById('savings-piggy-container') || finance.querySelector('.balance-card');
            if(target) target.insertAdjacentElement('afterend', salesDiv);
        }
    }

    // 6. ENTRETIEN
    if (maintenance) {
        if (!document.getElementById('health-widget-container')) {
            const healthDiv = document.createElement('div');
            healthDiv.id = 'health-widget-container';
            maintenance.appendChild(healthDiv);
        }
        if (!document.getElementById('vet-widget-container')) {
            const vetDiv = document.createElement('div');
            vetDiv.id = 'vet-widget-container';
            vetDiv.style.marginTop = "30px";
            maintenance.appendChild(vetDiv);
        }
    }

    // 7. SUCCÈS
    if (settings && !document.getElementById('achievements-container')) {
        const badgDiv = document.createElement('div');
        badgDiv.id = 'achievements-container';
        const profileCard = settings.querySelector('.profile-header-card');
        if (profileCard) profileCard.insertAdjacentElement('afterend', badgDiv);
    }
}

// ==========================================
// 1. BIO-RECYCLEUR V2 (Graphique + Correction + FIX BUG BOUTONS)
// ==========================================
let recyclingHistory = JSON.parse(localStorage.getItem('poupoules_recycling_history') || '[]');

if (localStorage.getItem('poupoules_recycled') && recyclingHistory.length === 0) {
    const oldTotal = parseFloat(localStorage.getItem('poupoules_recycled'));
    if (oldTotal > 0) {
        recyclingHistory.push({ date: new Date().toISOString(), qty: oldTotal });
        localStorage.removeItem('poupoules_recycled');
        localStorage.setItem('poupoules_recycling_history', JSON.stringify(recyclingHistory));
    }
}

function renderRecyclerWidget() {
    const container = document.getElementById('recycler-widget-container');
    if (!container) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calcul du total du mois en cours
    let monthTotal = 0;
    recyclingHistory.forEach(item => {
        const d = new Date(item.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            monthTotal += item.qty;
        }
    });

    // Génération du petit graphique
    let chartHtml = '<div style="display:flex; align-items:flex-end; gap:5px; height:40px; margin-top:10px; padding-top:10px; border-top:1px solid rgba(0,0,0,0.05);">';
    const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        const m = d.getMonth();
        const y = d.getFullYear();
        let val = 0;
        recyclingHistory.forEach(item => {
            const itemD = new Date(item.date);
            if(itemD.getMonth() === m && itemD.getFullYear() === y) val += item.qty;
        });
        const h = Math.min((val / 20) * 100, 100); 
        const isCurrent = (i === 0);
        chartHtml += `<div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end;"><div style="width:100%; height:${Math.max(h, 5)}%; background:${isCurrent ? 'var(--success)' : 'rgba(52, 199, 89, 0.3)'}; border-radius:2px;"></div><div style="font-size:9px; color:var(--text-grey); margin-top:2px;">${months[m]}</div></div>`;
    }
    chartHtml += '</div>';

    container.innerHTML = `
        <div class="glass-card" style="background:linear-gradient(to right, rgba(255,255,255,0.8), rgba(200, 255, 200, 0.4)); border:1px solid rgba(52, 199, 89, 0.2);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="icon-circle" style="background:rgba(52, 199, 89, 0.2); color:var(--success);"><i class="fas fa-recycle"></i></div>
                    <div class="status-info">
                        <span class="status-label">Bio-Recycleur</span>
                        <span class="status-value" style="font-size:14px; color:var(--text-dark);">Ce mois-ci</span>
                    </div>
                </div>
                <div style="text-align:right;" onclick="editRecyclingTotal()">
                    <span style="font-size:24px; font-weight:800; color:var(--success); cursor:pointer;">${monthTotal.toFixed(2)} <span style="font-size:12px;">kg</span> <i class="fas fa-pen" style="font-size:10px; opacity:0.5;"></i></span>
                </div>
            </div>
            ${chartHtml}
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button type="button" onclick="addRecycling(event, 0.75)" style="flex:1; background:rgba(255,255,255,0.5); border:1px solid var(--success); color:var(--success); border-radius:10px; padding:8px; font-size:12px; font-weight:bold; cursor:pointer;">+ 1/2 Boîte</button>
                <button type="button" onclick="addRecycling(event, 1.5)" style="flex:1; background:var(--success); color:white; border:none; border-radius:10px; padding:8px; font-size:12px; font-weight:bold; cursor:pointer;">+ Boîte Pleine</button>
            </div>
        </div>
    `;
}

// Fonction corrigée avec gestion de l'événement pour éviter le rechargement
window.addRecycling = (e, qty) => {
    if(e) {
        e.preventDefault(); // Empêche le comportement par défaut (rechargement)
        e.stopPropagation(); // Arrête la propagation
    }
    
    recyclingHistory.push({ date: new Date().toISOString(), qty: qty });
    localStorage.setItem('poupoules_recycling_history', JSON.stringify(recyclingHistory));
    renderRecyclerWidget();
    
    // Feedback visuel sur le bouton cliqué
    if(e && e.target) {
        const btn = e.target;
        const originalText = btn.innerText;
        btn.innerText = "Ajouté !";
        setTimeout(() => btn.innerText = originalText, 1000);
    }
};

window.editRecyclingTotal = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let currentTotal = 0;
    recyclingHistory.forEach(item => {
        const d = new Date(item.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) currentTotal += item.qty;
    });

    const newVal = prompt("Corriger le total de ce mois (kg) :", currentTotal.toFixed(2));
    if (newVal !== null && !isNaN(parseFloat(newVal))) {
        const target = parseFloat(newVal);
        if (target < 0) return;
        recyclingHistory = recyclingHistory.filter(item => {
            const d = new Date(item.date);
            return !(d.getMonth() === currentMonth && d.getFullYear() === currentYear);
        });
        if (target > 0) { recyclingHistory.push({ date: new Date().toISOString(), qty: target }); }
        localStorage.setItem('poupoules_recycling_history', JSON.stringify(recyclingHistory));
        renderRecyclerWidget();
    }
};

// ==========================================
// 2. HALL OF FAME
// ==========================================
let eggRecords = JSON.parse(localStorage.getItem('poupoules_records') || '{"heaviest": 0, "lightest": 1000}');

function renderHallOfFame() {
    const container = document.getElementById('hall-of-fame-container');
    if (!container) return;
    const heavy = eggRecords.heaviest > 0 ? eggRecords.heaviest + 'g' : '--';
    const light = eggRecords.lightest < 1000 ? eggRecords.lightest + 'g' : '--';

    container.innerHTML = `
        <div class="glass-card" style="padding:15px; position:relative;">
            <div style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:#ffd700; color:#333; padding:2px 10px; border-radius:10px; font-size:10px; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.1);">HALL OF FAME</div>
            <div style="display:flex; justify-content:space-around; align-items:center; margin-top:5px;">
                <div style="text-align:center;" onclick="updateRecord('heaviest')">
                    <div style="font-size:24px;">🦖</div>
                    <div style="font-size:11px; color:var(--text-grey); text-transform:uppercase; margin-top:2px;">Le Monstre</div>
                    <div style="font-size:16px; font-weight:800; color:var(--text-dark);">${heavy}</div>
                </div>
                <div style="width:1px; height:30px; background:rgba(0,0,0,0.1);"></div>
                <div style="text-align:center;" onclick="updateRecord('lightest')">
                    <div style="font-size:14px; margin-bottom:5px;">💎</div>
                    <div style="font-size:11px; color:var(--text-grey); text-transform:uppercase;">Le Bijou</div>
                    <div style="font-size:16px; font-weight:800; color:var(--text-dark);">${light}</div>
                </div>
            </div>
            <div style="text-align:center; margin-top:10px; font-size:10px; color:var(--primary); font-style:italic;">Cliquez sur un score pour le modifier</div>
        </div>
    `;
}

window.updateRecord = (type) => {
    const val = prompt(type === 'heaviest' ? "Nouveau record Poids Lourd (g) ?" : "Nouveau record Poids Plume (g) ?");
    if(val && !isNaN(val)) {
        const weight = parseFloat(val);
        if(type === 'heaviest') {
            if(weight > eggRecords.heaviest || eggRecords.heaviest === 0) { eggRecords.heaviest = weight; alert("💪 Nouveau record !"); } else { alert("Pas un record !"); return; }
        } else {
            if(weight < eggRecords.lightest) { eggRecords.lightest = weight; alert("✨ Nouveau record !"); } else { alert("Pas un record !"); return; }
        }
        localStorage.setItem('poupoules_records', JSON.stringify(eggRecords));
        renderHallOfFame();
    }
};

// ==========================================
// 3. MÉTÉO (PRIORITAIRE)
// ==========================================
function renderWeatherTip() {
    const container = document.getElementById('weather-tip-container');
    if (!container) return;
    if (container.innerHTML === "") container.innerHTML = `<div class="glass-card" style="padding:15px; text-align:center; color:var(--text-grey);"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>`;

    const displayTip = (t, loc) => {
        let tip = "Tout va bien !"; let icon = "fa-sun"; let color = "var(--primary)";
        if (t < 0) { tip = `Il gèle (${t}°C) ❄️ ! Graissez les crêtes.`; icon = "fa-snowflake"; color = "#007aff"; }
        else if (t < 10) { tip = `Frais (${t}°C). Gardez la litière sèche.`; icon = "fa-temperature-low"; color = "#5ac8fa"; }
        else if (t > 30) { tip = `Canicule (${t}°C) 🥵 ! Eau fraîche !`; icon = "fa-fire"; color = "#ff3b30"; }
        else if (t > 25) { tip = `Chaud (${t}°C). Changez l'eau souvent.`; icon = "fa-sun"; color = "#ff9500"; }
        container.innerHTML = `<div class="glass-card" style="padding:15px; display:flex; gap:15px; align-items:center; background:linear-gradient(to right, var(--glass-bg), rgba(255,255,255,0.4)); border-left: 4px solid ${color};"><i class="fas ${icon}" style="font-size:24px; color:${color};"></i><div style="font-size:13px; font-weight:600; color:var(--text-dark); line-height:1.4;">${tip} <br><span style="font-size:10px; color:var(--text-grey); font-weight:400;">Météo : ${loc}</span></div></div>`;
    };

    const fallback = () => { fetch(`https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true`).then(r=>r.json()).then(d=>displayTip(d.current_weather.temperature, "Paris (Défaut)")).catch(e=>{container.innerHTML=`<div class="glass-card" style="padding:10px;text-align:center;font-size:12px;">Météo HS</div>`}); };

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`).then(r=>r.json()).then(d=>displayTip(d.current_weather.temperature, "Ma position")).catch(fallback),
            fallback
        );
    } else fallback();
}

// ==========================================
// 4. ALMANACH SAISONNIER
// ==========================================
function renderAlmanac() {
    const container = document.getElementById('almanac-container'); if (!container) return;
    const month = new Date().getMonth(); 
    const almanacData = [
        { title: "Janvier : Grand Froid", text: "Eau tiède et maïs pour l'énergie." },
        { title: "Février : Patience", text: "Nettoyez les nichoirs." },
        { title: "Mars : Le Réveil", text: "Vermifuge avant la saison." },
        { title: "Avril : Pleine Saison", text: "Donnez des coquilles d'huîtres." },
        { title: "Mai : Attention Parasites", text: "Surveillez les poux rouges." },
        { title: "Juin : Hydratation", text: "Eau fraîche à l'ombre." },
        { title: "Juillet : Canicule", text: "Mouillez le sol si besoin." },
        { title: "Août : Parasites 2", text: "Traitez à la terre de diatomée." },
        { title: "Septembre : La Mue", text: "Protéines pour refaire les plumes." },
        { title: "Octobre : L'Automne", text: "Attention au rhume (Coryza)." },
        { title: "Novembre : Jours courts", text: "La ponte baisse, c'est normal." },
        { title: "Décembre : Repos", text: "Laissez-les se reposer." }
    ];
    const current = almanacData[month];
    container.innerHTML = `<div style="background:rgba(255,255,255,0.5); padding:10px 15px; border-radius:15px; border:1px dashed var(--text-grey); font-size:12px; color:var(--text-dark); display:flex; gap:10px; align-items:center;"><i class="fas fa-calendar-alt" style="font-size:20px; color:var(--text-grey);"></i><div><strong style="display:block; margin-bottom:2px; text-transform:uppercase; font-size:10px; color:var(--text-grey);">${current.title}</strong><span>${current.text}</span></div></div>`;
}

// ==========================================
// 5. FRIGO & STOCK
// ==========================================
let fridgeStock = parseInt(localStorage.getItem('poupoules_fridge_qty') || '0');
function renderFridgeWidget() {
    const container = document.getElementById('fridge-widget-container'); if (!container) return;
    const dcr = new Date(); dcr.setDate(dcr.getDate() + 28);
    const dcrStr = dcr.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    container.innerHTML = `<div class="glass-card" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px;"><div style="display:flex; align-items:center; gap:15px;"><div class="icon-circle" style="background:rgba(52, 199, 89, 0.2); color:var(--success); font-size:20px;"><i class="fas fa-box-open"></i></div><div><span class="status-label">Stock Frigo</span><div style="font-size:20px; font-weight:800;">${fridgeStock} œufs</div></div></div><div style="display:flex; gap:5px;"><button onclick="updateFridge(1)" class="glass-btn-round" style="width:35px; height:35px; border:none; background:rgba(0,0,0,0.05); cursor:pointer; border-radius:50%;"><i class="fas fa-plus"></i></button><button onclick="updateFridge(-1)" class="glass-btn-round" style="width:35px; height:35px; border:none; background:rgba(0,0,0,0.05); cursor:pointer; border-radius:50%;"><i class="fas fa-utensils"></i></button><button onclick="openSellModal()" class="glass-btn-round" style="width:35px; height:35px; background:var(--success); color:white; border:none; cursor:pointer; border-radius:50%;"><i class="fas fa-euro-sign"></i></button></div></div><div style="margin-bottom:20px; font-size:12px; color:var(--text-grey); display:flex; gap:8px; align-items:center; padding:0 10px;"><i class="fas fa-calendar-check" style="color:var(--primary);"></i><span>DCR œufs du jour : <strong>${dcrStr}</strong>.</span></div>`;
}
window.updateFridge = (amount) => { fridgeStock += amount; if (fridgeStock < 0) fridgeStock = 0; localStorage.setItem('poupoules_fridge_qty', fridgeStock); renderFridgeWidget(); checkAchievements(); };
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

let stockData = JSON.parse(localStorage.getItem('poupoules_stock') || '{"quantity": 0, "date": null}');
function renderStockWidget() {
    const container = document.getElementById('stock-widget-container'); if (!container) return;
    const activeCount = typeof localChickens !== 'undefined' ? localChickens.filter(c => c.status === 'active').length : 0;
    if (activeCount === 0 || !stockData.date || stockData.quantity <= 0) { container.innerHTML = `<div class="glass-card stock-card" onclick="openStockModal()"><div style="display:flex; align-items:center; gap:10px;"><div class="icon-circle" style="background:rgba(142, 142, 147, 0.2); color:#555;"><i class="fas fa-wheat"></i></div><div class="status-info"><span class="status-label">Stock Graines</span><span class="status-value" style="font-size:14px; color:var(--primary);">Configurer</span></div></div></div>`; return; }
    const daysGone = Math.floor((new Date() - new Date(stockData.date)) / (1000 * 60 * 60 * 24));
    const consumed = daysGone * (activeCount * FEED_KG_PER_DAY);
    let current = stockData.quantity - consumed; let percent = (current / stockData.quantity) * 100; if (current < 0) { current = 0; percent = 0; }
    let color = percent < 10 ? 'var(--danger)' : (percent < 30 ? 'var(--warning)' : 'var(--success)');
    container.innerHTML = `<div class="glass-card stock-card" onclick="openStockModal()"><div class="stock-header"><span class="stock-title"><i class="fas fa-wheat"></i> Réserve</span><span class="stock-value">${current.toFixed(1)} kg</span></div><div class="stock-bar-bg"><div class="stock-bar-fill" style="width: ${percent}%; background: ${color};"></div></div><div class="stock-footer"><small>Conso: ${(activeCount * FEED_KG_PER_DAY).toFixed(2)} kg/j</small><small>Reste ~${Math.floor(current / (activeCount * FEED_KG_PER_DAY))} jours</small></div></div>`;
}
window.saveStock = (e) => { e.preventDefault(); const qty = parseFloat(document.getElementById('stock-qty').value); if (qty > 0) { stockData = { quantity: qty, date: new Date().toISOString() }; localStorage.setItem('poupoules_stock', JSON.stringify(stockData)); document.getElementById('modal-stock').style.display = 'none'; renderStockWidget(); }};
window.openStockModal = () => { document.getElementById('modal-stock').style.display = 'flex'; document.getElementById('stock-qty').value = stockData.quantity || ''; };

// ==========================================
// 6. JOURNAL
// ==========================================
let localNotes = JSON.parse(localStorage.getItem('poupoules_notes') || '[]');
function renderJournalWidget() {
    const container = document.getElementById('journal-widget-container'); if (!container) return;
    let notesHtml = ''; const recentNotes = localNotes.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    if (recentNotes.length === 0) notesHtml = `<li style="color:var(--text-grey); font-size:14px; padding:10px; text-align:center;">Rien à signaler.</li>`;
    else recentNotes.forEach(n => notesHtml += `<li style="display:flex; flex-direction:column; align-items:flex-start; gap:5px; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:10px;"><div style="display:flex; justify-content:space-between; width:100%;"><small style="color:var(--text-grey); font-weight:600;">${new Date(n.date).toLocaleDateString()}</small><i class="fas fa-times" style="color:var(--text-grey); cursor:pointer;" onclick="deleteNote('${n.id}')"></i></div><span style="font-size:15px;">${n.text}</span></li>`);
    container.innerHTML = `<h3 class="section-title">📝 Journal</h3><div class="glass-card"><form onsubmit="addNote(event)" style="display:flex; gap:10px; margin-bottom:15px;"><input type="text" id="new-note-input" placeholder="Événement..." required style="flex:1;"><button type="submit" class="glass-btn-round" style="width:40px; height:40px; background:var(--primary); color:white; border:none; border-radius:12px;"><i class="fas fa-paper-plane"></i></button></form><ul class="glass-list" style="background:transparent; border:none; box-shadow:none; padding:0; gap:10px;">${notesHtml}</ul></div>`;
}
window.addNote = (e) => { e.preventDefault(); const input = document.getElementById('new-note-input'); if (input.value) { localNotes.push({ id: 'n'+Date.now(), text: input.value, date: new Date().toISOString() }); localStorage.setItem('poupoules_notes', JSON.stringify(localNotes)); renderJournalWidget(); }};
window.deleteNote = (id) => { if(confirm("Effacer ?")) { localNotes = localNotes.filter(n => n.id !== id); localStorage.setItem('poupoules_notes', JSON.stringify(localNotes)); renderJournalWidget(); }};

// ==========================================
// 7. CARNET SANTÉ
// ==========================================
let localHealth = JSON.parse(localStorage.getItem('poupoules_health') || '[]');
function renderHealthWidget() {
    const container = document.getElementById('health-widget-container'); if (!container) return;
    let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><h3 class="section-title" style="margin:0;">💉 Carnet de Santé</h3><button onclick="openHealthModal()" style="background:var(--primary); color:white; border:none; padding:5px 12px; border-radius:15px; font-size:12px; font-weight:bold;">+ Ajouter</button></div>`;
    if(localHealth.length === 0) { html += `<div class="glass-card" style="padding:20px; text-align:center; color:gray; font-size:13px;">Aucun soin enregistré.</div>`; } else { html += `<div class="glass-list">`; localHealth.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5).forEach(h => { let rappelInfo = ""; let borderColor = "transparent"; if (h.nextDate) { const today = new Date(); const next = new Date(h.nextDate); const diffTime = next - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (diffDays < 0) { rappelInfo = `<br><span style="color:var(--danger); font-weight:bold; font-size:11px;">⚠️ Rappel dépassé depuis ${Math.abs(diffDays)}j</span>`; borderColor = "var(--danger)"; } else if (diffDays < 15) { rappelInfo = `<br><span style="color:var(--warning); font-weight:bold; font-size:11px;">⏰ Rappel dans ${diffDays}j</span>`; borderColor = "var(--warning)"; } else { rappelInfo = `<br><span style="color:var(--success); font-size:11px;">📅 Prochain: ${new Date(h.nextDate).toLocaleDateString()}</span>`; } } html += `<div class="glass-card" style="margin-bottom:10px; padding:15px; border-left:4px solid ${borderColor}; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:bold; font-size:15px;">${h.type}</div><div style="font-size:13px; color:var(--text-dark);">${h.product}</div><div style="font-size:11px; color:var(--text-grey); margin-top:2px;">Fait le ${new Date(h.date).toLocaleDateString()} ${rappelInfo}</div></div><button onclick="deleteHealth('${h.id}')" style="background:none; border:none; color:#ccc;"><i class="fas fa-trash"></i></button></div>`; }); html += `</div>`; } container.innerHTML = html;
}
window.openHealthModal = () => { document.getElementById('modal-health-treatment').style.display = 'flex'; document.getElementById('health-date').valueAsDate = new Date(); window.autoFillHealth(); };
window.autoFillHealth = () => { const type = document.getElementById('health-type').value; const dateInput = document.getElementById('health-date').value; if(!dateInput) return; const date = new Date(dateInput); let next = new Date(date); let tip = ""; if (type === 'Vermifuge') { next.setMonth(next.getMonth() + 6); tip = "Tous les 6 mois"; } else if (type === 'Anti-Poux') { next.setMonth(next.getMonth() + 3); tip = "Tous les 3 mois"; } else if (type === 'Vaccin') { next.setFullYear(next.getFullYear() + 1); tip = "Rappel annuel"; } else { next = null; } const nextInput = document.getElementById('health-next-date'); const tipSpan = document.getElementById('health-tip'); if (next) { nextInput.value = next.toISOString().split('T')[0]; tipSpan.innerText = "Suggestion : " + tip; } else { nextInput.value = ""; tipSpan.innerText = ""; } };
window.saveHealthTreatment = (e) => { e.preventDefault(); const newItem = { id: 'h' + Date.now(), type: document.getElementById('health-type').value, product: document.getElementById('health-product').value, date: document.getElementById('health-date').value, nextDate: document.getElementById('health-next-date').value }; localHealth.push(newItem); localStorage.setItem('poupoules_health', JSON.stringify(localHealth)); document.getElementById('modal-health-treatment').style.display = 'none'; renderHealthWidget(); };
window.deleteHealth = (id) => { if(confirm("Supprimer ce soin ?")) { localHealth = localHealth.filter(h => h.id !== id); localStorage.setItem('poupoules_health', JSON.stringify(localHealth)); renderHealthWidget(); }};

// ==========================================
// 8. REGISTRE VENTES
// ==========================================
let localSales = JSON.parse(localStorage.getItem('poupoules_sales') || '[]');
function renderSalesWidget() {
    const container = document.getElementById('sales-register-container'); if (!container) return;
    let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><h3 class="section-title" style="margin:0;">🤝 Ventes Clients</h3><button onclick="openClientSaleModal()" style="background:var(--success); color:white; border:none; padding:5px 12px; border-radius:15px; font-size:12px; font-weight:bold;">+ Nouvelle Vente</button></div>`;
    if(localSales.length === 0) { html += `<div class="glass-card" style="padding:15px; text-align:center; color:gray; font-size:13px;">Aucune vente enregistrée.</div>`; } else { html += `<div class="glass-list">`; localSales.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5).forEach(s => { const statusIcon = s.status === 'paid' ? '✅' : '⏳'; const statusColor = s.status === 'paid' ? 'var(--text-grey)' : 'var(--warning)'; html += `<div class="glass-card" style="margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:bold; font-size:15px;">${s.client}</div><div style="font-size:13px;">${s.qty} œufs • <strong>${s.price} €</strong></div><div style="font-size:11px; color:${statusColor}; margin-top:2px;">${statusIcon} ${new Date(s.date).toLocaleDateString()}</div></div>${s.status === 'pending' ? `<button onclick="markAsPaid('${s.id}')" style="background:var(--primary); color:white; border:none; border-radius:10px; padding:5px 10px; font-size:11px;">Régler</button>` : ''}</div>`; }); html += `</div>`; } container.innerHTML = html;
}
window.openClientSaleModal = () => { document.getElementById('modal-client-sale').style.display = 'flex'; document.getElementById('client-date').valueAsDate = new Date(); };
window.saveClientSale = (e) => { e.preventDefault(); const price = parseFloat(document.getElementById('client-price').value); const sale = { id: 's' + Date.now(), client: document.getElementById('client-name').value, qty: parseInt(document.getElementById('client-qty').value), price: price, status: document.getElementById('client-status').value, date: document.getElementById('client-date').value }; localSales.push(sale); localStorage.setItem('poupoules_sales', JSON.stringify(localSales)); if (typeof localTransactions !== 'undefined' && window.saveData) { if (sale.status === 'paid') { localTransactions.push({ id: 't' + Date.now(), category: 'income', type: 'vente_oeufs', amount: price, date: sale.date }); window.saveData(); if(window.renderFinance) window.renderFinance(); } } if(window.updateFridge) window.updateFridge(-sale.qty); document.getElementById('modal-client-sale').style.display = 'none'; renderSalesWidget(); };
window.markAsPaid = (id) => { const idx = localSales.findIndex(s => s.id === id); if(idx > -1) { if(confirm("Confirmer que " + localSales[idx].client + " a payé ?")) { localSales[idx].status = 'paid'; localStorage.setItem('poupoules_sales', JSON.stringify(localSales)); if (typeof localTransactions !== 'undefined' && window.saveData) { localTransactions.push({ id: 't' + Date.now(), category: 'income', type: 'vente_oeufs', amount: localSales[idx].price, date: new Date().toISOString() }); window.saveData(); if(window.renderFinance) window.renderFinance(); } renderSalesWidget(); } } };

// ==========================================
// 9. COÛT, TIRELIRE, VÉTO & SUCCÈS
// ==========================================
function renderCostPrice() {
    const container = document.getElementById('cost-price-container'); if (!container) return;
    let totalExpenses = 0; if (typeof localTransactions !== 'undefined') { localTransactions.forEach(t => { if (t.category === 'expense') totalExpenses += t.amount; }); }
    let totalEggs = 0; if (typeof localEggs !== 'undefined') { localEggs.forEach(e => totalEggs += (e.count || 1)); }
    let costPerEgg = 0; if (totalEggs > 0) costPerEgg = totalExpenses / totalEggs;
    const isGood = costPerEgg < 0.40; const color = isGood ? 'var(--success)' : 'var(--text-grey)';
    container.innerHTML = `<div class="glass-card" style="display:flex; justify-content:space-between; align-items:center;"><div><span class="status-label" style="display:block; margin-bottom:5px;">Coût de revient</span><span style="font-size:12px; color:var(--text-grey);">Dépenses / Nb d'œufs</span></div><div style="text-align:right;"><div style="font-size:20px; font-weight:800; color:${color};">${costPerEgg.toFixed(2)} €</div><span style="font-size:10px; color:var(--text-grey);">par œuf</span></div></div>`;
}

function renderSavingsPiggy() {
    const container = document.getElementById('savings-piggy-container'); if (!container) return;
    let totalEggs = 0; if (typeof localEggs !== 'undefined') { localEggs.forEach(e => totalEggs += (e.count || 1)); }
    const theoreticalValue = totalEggs * MARKET_EGG_PRICE;
    container.innerHTML = `<div class="glass-card" style="display:flex; justify-content:space-between; align-items:center; background:linear-gradient(to right, rgba(255,255,255,0.8), rgba(255, 230, 200, 0.4)); border:1px solid rgba(255, 149, 0, 0.2);"><div><div style="display:flex; align-items:center; gap:5px;"><i class="fas fa-piggy-bank" style="color:#ff9500; font-size:16px;"></i><span class="status-label">Économies (Théorique)</span></div><span style="font-size:10px; color:var(--text-grey);">Valeur Bio (0,45€/œuf)</span></div><div style="text-align:right; font-weight:800; font-size:18px; color:#ff9500;">~${theoreticalValue.toFixed(0)} €</div></div>`;
}

function renderVetGuide() {
    const container = document.getElementById('vet-widget-container'); if (!container) return;
    const tips = [ { title: "Poux Rouges", icon: "fa-bug", color:"#ff3b30", text: "Nettoyer + Terre de Diatomée." }, { title: "Rhume", icon: "fa-head-side-cough", color:"#5ac8fa", text: "Thym + Ail dans l'eau." }, { title: "Picornage", icon: "fa-band-aid", color:"#ff9500", text: "Désinfecter et isoler." }, { title: "Gale des pattes", icon: "fa-paw", color:"#8e8e93", text: "Huile de cade sur les pattes." } ];
    let html = `<h3 class="section-title">⛑️ Soins d'urgence</h3><div class="glass-list">`;
    tips.forEach(t => html += `<div class="glass-card" style="margin-bottom:10px; padding:15px;"><div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;"><i class="fas ${t.icon}" style="color:${t.color}; font-size:18px;"></i><strong style="font-size:15px;">${t.title}</strong></div><p style="font-size:13px; color:var(--text-dark); line-height:1.4; margin:0;">${t.text}</p></div>`);
    container.innerHTML = html + `</div>`;
}

function checkAchievements() {
    let eggTotal = 0; if(typeof localEggs !== 'undefined') localEggs.forEach(e => eggTotal += (e.count || 1));
    const badges = [ { id: 'first', icon: 'fa-crow', title: 'Débutant', check: () => localChickens.length > 0 }, { id: 'egg100', icon: 'fa-egg', title: 'Pondeuse', check: () => eggTotal >= 100 }, { id: 'rich', icon: 'fa-coins', title: 'Rentier', check: () => { let t = 0; localTransactions.forEach(x => t += (x.category==='income'?x.amount:-x.amount)); return t > 0; }} ];
    return badges.map(b => ({ ...b, unlocked: b.check() }));
}
function renderAchievements() {
    const container = document.getElementById('achievements-container'); if (!container) return;
    const data = checkAchievements();
    let html = `<h3 class="settings-header">Succès</h3><div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(80px, 1fr)); gap:10px; padding:0 15px 20px 15px;">`;
    data.forEach(b => {
        const opacity = b.unlocked ? '1' : '0.4'; const color = b.unlocked ? 'var(--warning)' : 'var(--text-grey)'; const bg = b.unlocked ? 'rgba(255, 149, 0, 0.1)' : 'rgba(0,0,0,0.05)';
        html += `<div style="background:${bg}; border-radius:15px; padding:10px 5px; text-align:center; opacity:${opacity}; display:flex; flex-direction:column; align-items:center;"><div style="font-size:20px; color:${color}; margin-bottom:5px;"><i class="fas ${b.icon}"></i></div><div style="font-size:10px; font-weight:700; color:var(--text-dark);">${b.title}</div></div>`;
    });
    container.innerHTML = html + `</div>`;
}

// MAIN CALL
window.renderExtensions = () => {
    injectExtensionContainers();
    renderWeatherTip();
    renderAlmanac();
    renderFridgeWidget();
    renderStockWidget();
    renderRecyclerWidget(); // CORRIGÉ
    renderJournalWidget();
    renderHallOfFame();
    renderCostPrice();
    renderSavingsPiggy();
    renderSalesWidget();
    renderHealthWidget();
    renderVetGuide();
    renderAchievements();
};
