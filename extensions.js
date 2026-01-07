// extensions.js - VERSION FINALE & CORRIGÉE
// Comprend : Météo (Prioritaire), Stock, Frigo, Journal, Succès, Véto, Coût Revient

// CONFIGURATION
const FEED_KG_PER_DAY = 0.12; // 120g par poule

// ==========================================
// 0. AUTO-INJECTION (Générateur d'interface)
// ==========================================
function injectExtensionContainers() {
    const dashboard = document.getElementById('view-dashboard');
    const settings = document.getElementById('view-settings');
    const finance = document.getElementById('view-finance');
    const maintenance = document.getElementById('view-maintenance');

    if (!dashboard) return;

    // 1. MÉTÉO (FORCE L'AFFICHAGE)
    if (!document.getElementById('weather-tip-container')) {
        const tipDiv = document.createElement('div');
        tipDiv.id = 'weather-tip-container';
        tipDiv.style.marginBottom = "20px";
        
        // On essaie de le mettre après le titre, sinon tout en haut
        const title = dashboard.querySelector('.big-title');
        if (title) {
            title.insertAdjacentElement('afterend', tipDiv);
        } else {
            dashboard.prepend(tipDiv);
        }
    }

    // 2. FRIGO & STOCK
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

    // 3. JOURNAL DE BORD
    if (!document.getElementById('journal-widget-container')) {
        const journalDiv = document.createElement('div');
        journalDiv.id = 'journal-widget-container';
        const activityList = document.getElementById('recent-activity-list');
        if (activityList && activityList.previousElementSibling) {
            activityList.previousElementSibling.insertAdjacentElement('beforebegin', journalDiv);
        } else {
            dashboard.appendChild(journalDiv);
        }
    }

    // 4. COÛT DE REVIENT (Finance)
    if (finance && !document.getElementById('cost-price-container')) {
        const costDiv = document.createElement('div');
        costDiv.id = 'cost-price-container';
        const balanceCard = finance.querySelector('.balance-card');
        if (balanceCard) balanceCard.insertAdjacentElement('afterend', costDiv);
    }

    // 5. GUIDE VÉTO (Entretien)
    if (maintenance && !document.getElementById('vet-widget-container')) {
        const vetDiv = document.createElement('div');
        vetDiv.id = 'vet-widget-container';
        maintenance.appendChild(vetDiv);
    }

    // 6. SUCCÈS (Réglages)
    if (settings && !document.getElementById('achievements-container')) {
        const badgDiv = document.createElement('div');
        badgDiv.id = 'achievements-container';
        const profileCard = settings.querySelector('.profile-header-card');
        if (profileCard) profileCard.insertAdjacentElement('afterend', badgDiv);
    }
}

// ==========================================
// 1. MÉTÉO (PRIORITAIRE & ROBUSTE)
// ==========================================
function renderWeatherTip() {
    const container = document.getElementById('weather-tip-container');
    if (!container) return;

    // Affiche un état de chargement immédiat pour prouver que le widget est là
    if (container.innerHTML === "") {
        container.innerHTML = `<div class="glass-card" style="padding:15px; text-align:center; color:var(--text-grey);"><i class="fas fa-spinner fa-spin"></i> Chargement météo...</div>`;
    }

    const displayTip = (t, loc) => {
        let tip = "Tout va bien !"; 
        let icon = "fa-sun"; 
        let color = "var(--primary)";

        if (t < 0) { tip = `Il gèle (${t}°C) ❄️ ! Graissez les crêtes.`; icon = "fa-snowflake"; color = "#007aff"; }
        else if (t < 10) { tip = `Frais (${t}°C). Gardez la litière sèche.`; icon = "fa-temperature-low"; color = "#5ac8fa"; }
        else if (t > 30) { tip = `Canicule (${t}°C) 🥵 ! Eau fraîche !`; icon = "fa-fire"; color = "#ff3b30"; }
        else if (t > 25) { tip = `Chaud (${t}°C). Changez l'eau souvent.`; icon = "fa-sun"; color = "#ff9500"; }
        else { tip = `Météo douce (${t}°C). Idéal.`; }
        
        container.innerHTML = `
            <div class="glass-card" style="padding:15px; display:flex; gap:15px; align-items:center; background:linear-gradient(to right, var(--glass-bg), rgba(255,255,255,0.4)); border-left: 4px solid ${color};">
                <i class="fas ${icon}" style="font-size:24px; color:${color};"></i>
                <div style="font-size:13px; font-weight:600; color:var(--text-dark); line-height:1.4;">
                    ${tip} <br><span style="font-size:10px; color:var(--text-grey); font-weight:400;">Météo : ${loc}</span>
                </div>
            </div>`;
    };

    const fallback = () => {
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true`)
            .then(r=>r.json())
            .then(d=>displayTip(d.current_weather.temperature, "Paris (Par défaut)"))
            .catch(e => {
                container.innerHTML = `<div class="glass-card" style="padding:10px; text-align:center; font-size:12px;">Météo indisponible (Pas de réseau)</div>`;
            });
    };

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`)
                .then(r=>r.json())
                .then(d=>displayTip(d.current_weather.temperature, "Ma position"))
                .catch(fallback);
            },
            () => fallback() // Erreur ou Refus -> Fallback direct
        );
    } else {
        fallback();
    }
}

// ==========================================
// 2. FRIGO
// ==========================================
let fridgeStock = parseInt(localStorage.getItem('poupoules_fridge_qty') || '0');

function renderFridgeWidget() {
    const container = document.getElementById('fridge-widget-container');
    if (!container) return;
    const dcr = new Date(); dcr.setDate(dcr.getDate() + 28);
    const dcrStr = dcr.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    container.innerHTML = `
        <div class="glass-card" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px;">
            <div style="display:flex; align-items:center; gap:15px;">
                <div class="icon-circle" style="background:rgba(52, 199, 89, 0.2); color:var(--success); font-size:20px;"><i class="fas fa-box-open"></i></div>
                <div><span class="status-label">Stock Frigo</span><div style="font-size:20px; font-weight:800;">${fridgeStock} œufs</div></div>
            </div>
            <div style="display:flex; gap:5px;">
                <button onclick="updateFridge(1)" class="glass-btn-round" style="width:35px; height:35px; border:none; background:rgba(0,0,0,0.05); cursor:pointer; border-radius:50%;"><i class="fas fa-plus"></i></button>
                <button onclick="updateFridge(-1)" class="glass-btn-round" style="width:35px; height:35px; border:none; background:rgba(0,0,0,0.05); cursor:pointer; border-radius:50%;"><i class="fas fa-utensils"></i></button>
                <button onclick="openSellModal()" class="glass-btn-round" style="width:35px; height:35px; background:var(--success); color:white; border:none; cursor:pointer; border-radius:50%;"><i class="fas fa-euro-sign"></i></button>
            </div>
        </div>
        <div style="margin-bottom:20px; font-size:12px; color:var(--text-grey); display:flex; gap:8px; align-items:center; padding:0 10px;">
            <i class="fas fa-calendar-check" style="color:var(--primary);"></i>
            <span>DCR œufs du jour : <strong>${dcrStr}</strong>.</span>
        </div>`;
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

// ==========================================
// 3. STOCK GRAINES
// ==========================================
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
// 4. JOURNAL DE BORD
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
// 5. SUCCÈS
// ==========================================
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

// ==========================================
// 6. CALCULATEUR COÛT DE REVIENT (FINANCE)
// ==========================================
function renderCostPrice() {
    const container = document.getElementById('cost-price-container');
    if (!container) return;

    let totalExpenses = 0;
    if (typeof localTransactions !== 'undefined') {
        localTransactions.forEach(t => { if (t.category === 'expense') totalExpenses += t.amount; });
    }
    
    let totalEggs = 0;
    if (typeof localEggs !== 'undefined') {
        localEggs.forEach(e => totalEggs += (e.count || 1));
    }

    let costPerEgg = 0;
    if (totalEggs > 0) costPerEgg = totalExpenses / totalEggs;
    const isGood = costPerEgg < 0.40;
    const color = isGood ? 'var(--success)' : 'var(--text-grey)';

    container.innerHTML = `
        <div class="glass-card" style="display:flex; justify-content:space-between; align-items:center;">
            <div><span class="status-label" style="display:block; margin-bottom:5px;">Coût de revient</span><span style="font-size:12px; color:var(--text-grey);">Dépenses / Nb d'œufs</span></div>
            <div style="text-align:right;"><div style="font-size:20px; font-weight:800; color:${color};">${costPerEgg.toFixed(2)} €</div><span style="font-size:10px; color:var(--text-grey);">par œuf</span></div>
        </div>
    `;
}

// ==========================================
// 7. GUIDE VÉTO (ENTRETIEN)
// ==========================================
function renderVetGuide() {
    const container = document.getElementById('vet-widget-container');
    if (!container) return;
    const tips = [
        { title: "Poux Rouges", icon: "fa-bug", color:"#ff3b30", text: "Nettoyer poulailler + Terre de Diatomée." },
        { title: "Rhume", icon: "fa-head-side-cough", color:"#5ac8fa", text: "Infusion thym + ail dans l'eau." },
        { title: "Picornage / Plaie", icon: "fa-band-aid", color:"#ff9500", text: "Désinfecter et isoler la poule." },
        { title: "Mal de ponte", icon: "fa-egg", color:"#af52de", text: "Bain tiède + Huile cloaque + Calme." },
        { title: "Gale des pattes", icon: "fa-paw", color:"#8e8e93", text: "Huile de cade ou vaseline sur les pattes." }
    ];
    let html = `<h3 class="section-title">⛑️ Soins d'urgence</h3><div class="glass-list">`;
    tips.forEach(t => {
        html += `<div class="glass-card" style="margin-bottom:10px; padding:15px;"><div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;"><i class="fas ${t.icon}" style="color:${t.color}; font-size:18px;"></i><strong style="font-size:15px;">${t.title}</strong></div><p style="font-size:13px; color:var(--text-dark); line-height:1.4; margin:0;">${t.text}</p></div>`;
    });
    container.innerHTML = html + `</div>`;
}

// MAIN CALL
window.renderExtensions = () => {
    injectExtensionContainers();
    renderWeatherTip();
    renderFridgeWidget();
    renderStockWidget();
    renderJournalWidget();
    renderAchievements();
    renderCostPrice();
    renderVetGuide();
};
