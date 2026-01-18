// extensions.js - VERSION STABLE + PAIN
// S'affiche en bas du Dashboard pour être sûr d'apparaître sur TON design.

const FEED_KG_PER_DAY = 0.12; 
const MARKET_EGG_PRICE = 0.45; 

// ==========================================
// 1. SAUVEGARDE CLOUD (Migration)
// ==========================================
window.migrateLocalStorageToCloud = function() {
    let hasChanged = false;
    const keys = {
        'poupoules_recycling_history': 'recycling',
        'poupoules_health': 'health',
        'poupoules_sales': 'sales',
        'poupoules_records': 'records',
        'poupoules_supplies': 'supplies',
        'poupoules_fridge_qty': 'fridge',
        'poupoules_stock': 'stock',
        'poupoules_notes': 'notes'
    };

    for (const [localKey, cloudKey] of Object.entries(keys)) {
        const val = localStorage.getItem(localKey);
        if (val) {
            try {
                if (cloudKey === 'fridge') window.localExtensionData[cloudKey] = parseInt(val);
                else window.localExtensionData[cloudKey] = JSON.parse(val);
                localStorage.removeItem(localKey); hasChanged = true;
            } catch(e) {}
        }
    }
    if(hasChanged && window.saveData) window.saveData();
};

// ==========================================
// 2. INJECTION HTML (Sécurisée)
// ==========================================
function injectExtensionContainers() {
    // On cherche ton Dashboard
    const dashboard = document.getElementById('view-dashboard');
    if (!dashboard) return;

    // --- BIO-RECYCLEUR (PAIN) ---
    // On l'ajoute TOUT EN BAS du dashboard pour être sûr qu'il s'affiche
    if (!document.getElementById('recycler-widget-container')) {
        const div = document.createElement('div'); 
        div.id = 'recycler-widget-container'; 
        div.style.marginTop = "25px";
        div.style.marginBottom = "25px";
        dashboard.appendChild(div); // Ajout direct à la fin
    }

    // --- Autres Widgets (Météo, etc.) ---
    if (!document.getElementById('weather-tip-container')) {
        const div = document.createElement('div'); div.id = 'weather-tip-container'; div.style.marginBottom = "10px";
        dashboard.insertBefore(div, dashboard.firstChild); // Tout en haut
    }
    
    // --- Carnet de Santé (Marge corrigée) ---
    const maintenance = document.getElementById('view-maintenance');
    if (maintenance) {
        if (!document.getElementById('health-widget-container')) {
            const div = document.createElement('div'); 
            div.id = 'health-widget-container'; 
            div.style.marginTop = "50px"; // Marge demandée
            maintenance.appendChild(div);
        }
    }
    
    // --- Succès ---
    const settings = document.getElementById('view-settings');
    if (settings && !document.getElementById('achievements-container')) {
        const div = document.createElement('div'); div.id = 'achievements-container';
        settings.appendChild(div);
    }
    
    // --- Stock / Frigo / Finance (Injection standard) ---
    // (J'allège le code pour éviter les conflits avec ton HTML)
    injectStandardWidgets(dashboard);
}

function injectStandardWidgets(dashboard) {
    if (!document.getElementById('stock-widget-container')) {
        const div = document.createElement('div'); div.id = 'stock-widget-container';
        // On essaie de le mettre avant le recycleur s'il existe
        const recycler = document.getElementById('recycler-widget-container');
        if(recycler) dashboard.insertBefore(div, recycler);
        else dashboard.appendChild(div);
    }
    // Les autres conteneurs si besoin...
    if (!document.getElementById('fridge-widget-container')) {
        const div = document.createElement('div'); div.id = 'fridge-widget-container';
        const stock = document.getElementById('stock-widget-container');
        if(stock) stock.parentNode.insertBefore(div, stock);
    }
     const finance = document.getElementById('view-finance');
    if (finance && !document.getElementById('sales-register-container')) {
         const div = document.createElement('div'); div.id = 'sales-register-container'; div.style.marginTop = "20px";
         finance.appendChild(div);
    }
}


// ==========================================
// 3. FONCTIONS WIDGETS
// ==========================================

// --- LE fameux BIO-RECYCLEUR (Avec PAIN) ---
function renderRecyclerWidget() {
    const container = document.getElementById('recycler-widget-container'); if (!container) return;
    const history = window.localExtensionData.recycling || [];
    const now = new Date(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
    let monthTotal = 0; 
    history.forEach(item => { const d = new Date(item.date); if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) { monthTotal += item.qty; } });

    // Graphique simplifié
    let chartHtml = '<div style="display:flex; align-items:flex-end; gap:5px; height:40px; margin-top:10px; padding-top:10px; border-top:1px solid rgba(0,0,0,0.05);">';
    const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    for (let i = 5; i >= 0; i--) { 
        const d = new Date(); d.setMonth(now.getMonth() - i); 
        const m = d.getMonth(); const y = d.getFullYear(); let val = 0; 
        history.forEach(item => { const itemD = new Date(item.date); if(itemD.getMonth() === m && itemD.getFullYear() === y) val += item.qty; }); 
        const h = Math.min((val / 20) * 100, 100); const isCurrent = (i === 0); 
        chartHtml += `<div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end;"><div style="width:100%; height:${Math.max(h, 5)}%; background:${isCurrent ? 'var(--success)' : 'rgba(52, 199, 89, 0.3)'}; border-radius:2px;"></div><div style="font-size:9px; color:var(--text-grey); margin-top:2px;">${months[m]}</div></div>`; 
    } chartHtml += '</div>';

    container.innerHTML = `
        <div class="glass-card" style="background:linear-gradient(to right, rgba(255,255,255,0.8), rgba(200, 255, 200, 0.4)); border:1px solid rgba(52, 199, 89, 0.2);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="icon-circle" style="background:rgba(52, 199, 89, 0.2); color:var(--success);"><i class="fas fa-recycle"></i></div>
                    <div class="status-info"><span class="status-label">Bio-Recycleur</span><span class="status-value" style="font-size:14px; color:var(--text-dark);">Ce mois-ci</span></div>
                </div>
                <div style="text-align:right;" onclick="editRecyclingTotal()">
                    <span style="font-size:24px; font-weight:800; color:var(--success); cursor:pointer;">${monthTotal.toFixed(2)} <span style="font-size:12px;">kg</span> <i class="fas fa-pen" style="font-size:10px; opacity:0.5;"></i></span>
                </div>
            </div>
            ${chartHtml}
            
            <div style="margin-top:15px; margin-bottom:5px; font-size:10px; color:var(--success); font-weight:800; text-transform:uppercase;">♻️ Compost (Boîte)</div>
            <div style="display:flex; gap:10px;">
                <button type="button" onclick="addRecycling(event, 0.75)" style="flex:1; background:rgba(255,255,255,0.5); border:1px solid var(--success); color:var(--success); border-radius:10px; padding:8px; font-size:12px; font-weight:bold; cursor:pointer;">+ 1/2 Boîte</button>
                <button type="button" onclick="addRecycling(event, 1.5)" style="flex:1; background:var(--success); color:white; border:none; border-radius:10px; padding:8px; font-size:12px; font-weight:bold; cursor:pointer;">+ Boîte Pleine</button>
            </div>

            <div style="margin-top:15px; margin-bottom:5px; font-size:10px; color:#d35400; font-weight:800; text-transform:uppercase;">🥖 Pain Dur</div>
            <div style="display:flex; gap:5px;">
                <button type="button" onclick="addRecycling(event, 0.06)" style="flex:1; background:rgba(255,240,230,0.8); border:1px solid #d35400; color:#d35400; border-radius:10px; padding:6px; font-size:11px; font-weight:bold; cursor:pointer;">1/4 Bag.</button>
                <button type="button" onclick="addRecycling(event, 0.125)" style="flex:1; background:rgba(255,240,230,0.8); border:1px solid #d35400; color:#d35400; border-radius:10px; padding:6px; font-size:11px; font-weight:bold; cursor:pointer;">1/2 Bag.</button>
                <button type="button" onclick="addRecycling(event, 0.25)" style="flex:1; background:#d35400; color:white; border:none; border-radius:10px; padding:6px; font-size:11px; font-weight:bold; cursor:pointer;">1 Baguette</button>
            </div>
        </div>
    `;
}

window.addRecycling = (e, qty) => {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    if(!window.localExtensionData.recycling) window.localExtensionData.recycling = [];
    window.localExtensionData.recycling.push({ date: new Date().toISOString(), qty: qty });
    if(window.saveData) window.saveData(); 
    renderRecyclerWidget(); checkAchievements();
    if(e && e.target) { const btn = e.target; const txt = btn.innerText; btn.innerText = "Miam !"; setTimeout(() => btn.innerText = txt, 1000); }
};
window.editRecyclingTotal = () => {
    if(!window.localExtensionData.recycling) window.localExtensionData.recycling = [];
    const currentMonth = new Date().getMonth(); const currentYear = new Date().getFullYear();
    let currentTotal = 0; window.localExtensionData.recycling.forEach(item => { const d = new Date(item.date); if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) currentTotal += item.qty; });
    const newVal = prompt("Corriger le total de ce mois (kg) :", currentTotal.toFixed(2));
    if (newVal !== null && !isNaN(parseFloat(newVal))) {
        const target = parseFloat(newVal); if (target < 0) return;
        window.localExtensionData.recycling = window.localExtensionData.recycling.filter(item => { const d = new Date(item.date); return !(d.getMonth() === currentMonth && d.getFullYear() === currentYear); });
        if (target > 0) { window.localExtensionData.recycling.push({ date: new Date().toISOString(), qty: target }); }
        if(window.saveData) window.saveData(); renderRecyclerWidget(); checkAchievements();
    }
};

// --- AUTRES FONCTIONS ESSENTIELLES (Santé, Stock, Météo...) ---

function renderWeatherTip() { const container = document.getElementById('weather-tip-container'); if (!container) return; if (container.innerHTML === "") container.innerHTML = `<div class="glass-card" style="padding:15px; text-align:center; color:var(--text-grey);"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>`; const displayTip = (t, loc) => { let tip = "Tout va bien !"; let icon = "fa-sun"; let color = "var(--primary)"; if (t < 0) { tip = `Il gèle (${t}°C) ❄️ ! Graissez les crêtes.`; icon = "fa-snowflake"; color = "#007aff"; } else if (t < 10) { tip = `Frais (${t}°C). Gardez la litière sèche.`; icon = "fa-temperature-low"; color = "#5ac8fa"; } else if (t > 30) { tip = `Canicule (${t}°C) 🥵 ! Eau fraîche !`; icon = "fa-fire"; color = "#ff3b30"; } else if (t > 25) { tip = `Chaud (${t}°C). Changez l'eau souvent.`; icon = "fa-sun"; color = "#ff9500"; } container.innerHTML = `<div class="glass-card" style="padding:15px; display:flex; gap:15px; align-items:center; background:linear-gradient(to right, var(--glass-bg), rgba(255,255,255,0.4)); border-left: 4px solid ${color};"><i class="fas ${icon}" style="font-size:24px; color:${color};"></i><div style="font-size:13px; font-weight:600; color:var(--text-dark); line-height:1.4;">${tip} <br><span style="font-size:10px; color:var(--text-grey); font-weight:400;">Météo : ${loc}</span></div></div>`; }; const fallback = () => { fetch(`https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true`).then(r=>r.json()).then(d=>displayTip(d.current_weather.temperature, "Paris (Défaut)")).catch(e=>{container.innerHTML=`<div class="glass-card" style="padding:10px;text-align:center;font-size:12px;">Météo HS</div>`}); }; if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition((pos) => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`).then(r=>r.json()).then(d=>displayTip(d.current_weather.temperature, "Ma position")).catch(fallback), fallback); } else fallback(); }

function renderHealthWidget() { const container = document.getElementById('health-widget-container'); if (!container) return; const health = window.localExtensionData.health || []; let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><h3 class="section-title" style="margin:0;">💉 Carnet de Santé</h3><button onclick="openHealthModal()" style="background:var(--primary); color:white; border:none; padding:5px 12px; border-radius:15px; font-size:12px; font-weight:bold;">+ Ajouter</button></div>`; if(health.length === 0) { html += `<div class="glass-card" style="padding:20px; text-align:center; color:gray; font-size:13px;">Aucun soin enregistré.</div>`; } else { html += `<div class="glass-list">`; health.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5).forEach(h => { let rappelInfo = ""; let borderColor = "transparent"; if (h.nextDate) { const today = new Date(); const next = new Date(h.nextDate); const diffTime = next - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (diffDays < 0) { rappelInfo = `<br><span style="color:var(--danger); font-weight:bold; font-size:11px;">⚠️ Rappel dépassé depuis ${Math.abs(diffDays)}j</span>`; borderColor = "var(--danger)"; } else if (diffDays < 15) { rappelInfo = `<br><span style="color:var(--warning); font-weight:bold; font-size:11px;">⏰ Rappel dans ${diffDays}j</span>`; borderColor = "var(--warning)"; } else { rappelInfo = `<br><span style="color:var(--success); font-size:11px;">📅 Prochain: ${new Date(h.nextDate).toLocaleDateString()}</span>`; } } html += `<div class="glass-card" style="margin-bottom:10px; padding:15px; border-left:4px solid ${borderColor}; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:bold; font-size:15px;">${h.type}</div><div style="font-size:13px; color:var(--text-dark);">${h.product}</div><div style="font-size:11px; color:var(--text-grey); margin-top:2px;">Fait le ${new Date(h.date).toLocaleDateString()} ${rappelInfo}</div></div><button onclick="deleteHealth('${h.id}')" style="background:none; border:none; color:#ccc;"><i class="fas fa-trash"></i></button></div>`; }); html += `</div>`; } container.innerHTML = html; }
window.openHealthModal = () => { document.getElementById('modal-health-treatment').style.display = 'flex'; document.getElementById('health-date').valueAsDate = new Date(); window.autoFillHealth(); };
window.autoFillHealth = () => { const type = document.getElementById('health-type').value; const dateInput = document.getElementById('health-date').value; if(!dateInput) return; const date = new Date(dateInput); let next = new Date(date); let tip = ""; if (type === 'Vermifuge') { next.setMonth(next.getMonth() + 6); tip = "Tous les 6 mois"; } else if (type === 'Anti-Poux') { next.setMonth(next.getMonth() + 3); tip = "Tous les 3 mois"; } else if (type === 'Vaccin') { next.setFullYear(next.getFullYear() + 1); tip = "Rappel annuel"; } else { next = null; } const nextInput = document.getElementById('health-next-date'); const tipSpan = document.getElementById('health-tip'); if (next) { nextInput.value = next.toISOString().split('T')[0]; tipSpan.innerText = "Suggestion : " + tip; } else { nextInput.value = ""; tipSpan.innerText = ""; } };
window.saveHealthTreatment = (e) => { e.preventDefault(); const newItem = { id: 'h' + Date.now(), type: document.getElementById('health-type').value, product: document.getElementById('health-product').value, date: document.getElementById('health-date').value, nextDate: document.getElementById('health-next-date').value }; if(!window.localExtensionData.health) window.localExtensionData.health = []; window.localExtensionData.health.push(newItem); if(window.saveData) window.saveData(); document.getElementById('modal-health-treatment').style.display = 'none'; renderHealthWidget(); checkAchievements(); };
window.deleteHealth = (id) => { if(confirm("Supprimer ce soin ?")) { window.localExtensionData.health = window.localExtensionData.health.filter(h => h.id !== id); if(window.saveData) window.saveData(); renderHealthWidget(); }};

function renderStockWidget() { const container = document.getElementById('stock-widget-container'); if (!container) return; const stockData = window.localExtensionData.stock || { quantity: 0, date: null }; const activeCount = typeof localChickens !== 'undefined' ? localChickens.filter(c => c.status === 'active').length : 0; if (activeCount === 0 || !stockData.date || stockData.quantity <= 0) { container.innerHTML = `<div class="glass-card stock-card" onclick="openStockModal()"><div style="display:flex; align-items:center; gap:10px;"><div class="icon-circle" style="background:rgba(142, 142, 147, 0.2); color:#555;"><i class="fas fa-wheat"></i></div><div class="status-info"><span class="status-label">Stock Graines</span><span class="status-value" style="font-size:14px; color:var(--primary);">Configurer</span></div></div></div>`; return; } const daysGone = Math.floor((new Date() - new Date(stockData.date)) / (1000 * 60 * 60 * 24)); const consumed = daysGone * (activeCount * FEED_KG_PER_DAY); let current = stockData.quantity - consumed; let percent = (current / stockData.quantity) * 100; if (current < 0) { current = 0; percent = 0; } let color = percent < 10 ? 'var(--danger)' : (percent < 30 ? 'var(--warning)' : 'var(--success)'); container.innerHTML = `<div class="glass-card stock-card" onclick="openStockModal()"><div class="stock-header"><span class="stock-title"><i class="fas fa-wheat"></i> Réserve</span><span class="stock-value">${current.toFixed(1)} kg</span></div><div class="stock-bar-bg"><div class="stock-bar-fill" style="width: ${percent}%; background: ${color};"></div></div><div class="stock-footer"><small>Conso: ${(activeCount * FEED_KG_PER_DAY).toFixed(2)} kg/j</small><small>Reste ~${Math.floor(current / (activeCount * FEED_KG_PER_DAY))} jours</small></div></div>`; }
window.saveStock = (e) => { e.preventDefault(); const qty = parseFloat(document.getElementById('stock-qty').value); if (qty > 0) { window.localExtensionData.stock = { quantity: qty, date: new Date().toISOString() }; if(window.saveData) window.saveData(); document.getElementById('modal-stock').style.display = 'none'; renderStockWidget(); }};
window.openStockModal = () => { document.getElementById('modal-stock').style.display = 'flex'; document.getElementById('stock-qty').value = (window.localExtensionData.stock && window.localExtensionData.stock.quantity) || ''; };

function renderFridgeWidget() { const container = document.getElementById('fridge-widget-container'); if (!container) return; const fridgeStock = window.localExtensionData.fridge || 0; const dcr = new Date(); dcr.setDate(dcr.getDate() + 28); const dcrStr = dcr.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); container.innerHTML = `<div class="glass-card" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:15px;"><div style="display:flex; align-items:center; gap:15px;"><div class="icon-circle" style="background:rgba(52, 199, 89, 0.2); color:var(--success); font-size:20px;"><i class="fas fa-box-open"></i></div><div><span class="status-label">Stock Frigo</span><div style="font-size:20px; font-weight:800;">${fridgeStock} œufs</div></div></div><div style="display:flex; gap:5px;"><button onclick="updateFridge(1)" class="glass-btn-round" style="width:35px; height:35px; border:none; background:rgba(0,0,0,0.05); cursor:pointer; border-radius:50%;"><i class="fas fa-plus"></i></button><button onclick="updateFridge(-1)" class="glass-btn-round" style="width:35px; height:35px; border:none; background:rgba(0,0,0,0.05); cursor:pointer; border-radius:50%;"><i class="fas fa-utensils"></i></button><button onclick="openSellModal()" class="glass-btn-round" style="width:35px; height:35px; background:var(--success); color:white; border:none; cursor:pointer; border-radius:50%;"><i class="fas fa-euro-sign"></i></button></div></div><div style="margin-bottom:20px; font-size:12px; color:var(--text-grey); display:flex; gap:8px; align-items:center; padding:0 10px;"><i class="fas fa-calendar-check" style="color:var(--primary);"></i><span>DCR œufs du jour : <strong>${dcrStr}</strong>.</span></div>`; }
window.updateFridge = (amount) => { if(typeof window.localExtensionData.fridge === 'undefined') window.localExtensionData.fridge = 0; window.localExtensionData.fridge += amount; if (window.localExtensionData.fridge < 0) window.localExtensionData.fridge = 0; if(window.saveData) window.saveData(); renderFridgeWidget(); checkAchievements(); };
window.openSellModal = () => { const fridge = window.localExtensionData.fridge || 0; const qty = prompt("Nombre d'œufs vendus ?", "6"); if (qty && qty > 0 && qty <= fridge) { const price = prompt("Prix total (€) ?", (qty * 0.5).toFixed(2)); if (price) { updateFridge(-parseInt(qty)); if (typeof localTransactions !== 'undefined') { localTransactions.push({ id: 't'+Date.now(), category:'income', type:'vente_oeufs', amount:parseFloat(price), date:new Date().toISOString() }); if(window.saveData) window.saveData(); if(window.renderFinance) window.renderFinance(); alert(`Vente de ${price}€ enregistrée !`); checkAchievements(); } } } else if (qty > fridge) alert("Pas assez de stock !"); };

function renderSalesWidget() { const container = document.getElementById('sales-register-container'); if (!container) return; const sales = window.localExtensionData.sales || []; let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><h3 class="section-title" style="margin:0;">🤝 Ventes Clients</h3><button onclick="openClientSaleModal()" style="background:var(--success); color:white; border:none; padding:5px 12px; border-radius:15px; font-size:12px; font-weight:bold;">+ Nouvelle Vente</button></div>`; if(sales.length === 0) { html += `<div class="glass-card" style="padding:15px; text-align:center; color:gray; font-size:13px;">Aucune vente enregistrée.</div>`; } else { html += `<div class="glass-list">`; sales.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5).forEach(s => { const statusIcon = s.status === 'paid' ? '✅' : '⏳'; const statusColor = s.status === 'paid' ? 'var(--text-grey)' : 'var(--warning)'; html += `<div class="glass-card" style="margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:bold; font-size:15px;">${s.client}</div><div style="font-size:13px;">${s.qty} œufs • <strong>${s.price} €</strong></div><div style="font-size:11px; color:${statusColor}; margin-top:2px;">${statusIcon} ${new Date(s.date).toLocaleDateString()}</div></div>${s.status === 'pending' ? `<button onclick="markAsPaid('${s.id}')" style="background:var(--primary); color:white; border:none; border-radius:10px; padding:5px 10px; font-size:11px;">Régler</button>` : ''}</div>`; }); html += `</div>`; } container.innerHTML = html; } window.openClientSaleModal = () => { document.getElementById('modal-client-sale').style.display = 'flex'; document.getElementById('client-date').valueAsDate = new Date(); }; window.saveClientSale = (e) => { e.preventDefault(); const price = parseFloat(document.getElementById('client-price').value); const sale = { id: 's' + Date.now(), client: document.getElementById('client-name').value, qty: parseInt(document.getElementById('client-qty').value), price: price, status: document.getElementById('client-status').value, date: document.getElementById('client-date').value }; if(!window.localExtensionData.sales) window.localExtensionData.sales = []; window.localExtensionData.sales.push(sale); if (typeof localTransactions !== 'undefined' && window.saveData) { if (sale.status === 'paid') { localTransactions.push({ id: 't' + Date.now(), category: 'income', type: 'vente_oeufs', amount: price, date: sale.date }); } } if(window.updateFridge) window.updateFridge(-sale.qty); if(window.saveData) window.saveData(); document.getElementById('modal-client-sale').style.display = 'none'; renderSalesWidget(); checkAchievements(); }; window.markAsPaid = (id) => { const idx = window.localExtensionData.sales.findIndex(s => s.id === id); if(idx > -1) { if(confirm("Confirmer que " + window.localExtensionData.sales[idx].client + " a payé ?")) { window.localExtensionData.sales[idx].status = 'paid'; if (typeof localTransactions !== 'undefined' && window.saveData) { localTransactions.push({ id: 't' + Date.now(), category: 'income', type: 'vente_oeufs', amount: window.localExtensionData.sales[idx].price, date: new Date().toISOString() }); window.saveData(); if(window.renderFinance) window.renderFinance(); } renderSalesWidget(); checkAchievements(); } } };

function checkAchievements() { let eggTotal = 0; if(typeof localEggs !== 'undefined') localEggs.forEach(e => eggTotal += (e.count || 1)); const recyc = window.localExtensionData.recycling || []; let recycledTotal = 0; recyc.forEach(r => recycledTotal += r.qty); const sales = window.localExtensionData.sales || []; const health = window.localExtensionData.health || []; const fridge = window.localExtensionData.fridge || 0; const records = window.localExtensionData.records || { heaviest:0 }; const badges = [ { id: 'first', icon: 'fa-crow', title: 'Débutant', desc: "Posséder au moins 1 poule.", check: () => (typeof localChickens !== 'undefined' && localChickens.length > 0) }, { id: 'mama', icon: 'fa-users', title: 'Mère Poule', desc: "Avoir un cheptel de 5 poules ou plus.", check: () => (typeof localChickens !== 'undefined' && localChickens.length >= 5) }, { id: 'egg1', icon: 'fa-egg', title: 'Premier Œuf', desc: "Avoir ramassé son tout premier œuf !", check: () => eggTotal >= 1 }, { id: 'egg100', icon: 'fa-layer-group', title: 'L\'Habitué', desc: "Avoir ramassé plus de 100 œufs au total.", check: () => eggTotal >= 100 }, { id: 'egg500', icon: 'fa-industry', title: 'L\'Usine', desc: "Avoir ramassé plus de 500 œufs.", check: () => eggTotal >= 500 }, { id: 'recycler1', icon: 'fa-leaf', title: 'Petit Écolo', desc: "Avoir commencé à recycler des déchets.", check: () => recycledTotal > 0 }, { id: 'recycler20', icon: 'fa-tree', title: 'Grand Écolo', desc: "Avoir recyclé plus de 20kg de déchets !", check: () => recycledTotal >= 20 }, { id: 'vet', icon: 'fa-user-md', title: 'Gardien', desc: "Avoir enregistré un soin.", check: () => health.length > 0 }, { id: 'sale', icon: 'fa-handshake', title: 'Commerçant', desc: "Avoir réalisé une vente.", check: () => sales.length > 0 }, { id: 'rich', icon: 'fa-coins', title: 'Rentier', desc: "Avoir un bilan financier positif.", check: () => { let t = 0; if(typeof localTransactions !== 'undefined') localTransactions.forEach(x => t += (x.category==='income'?x.amount:-x.amount)); return t > 0; } }, { id: 'record', icon: 'fa-trophy', title: 'Champion', desc: "Avoir enregistré un record.", check: () => records.heaviest > 0 }, { id: 'stock', icon: 'fa-box', title: 'Fourmi', desc: "Avoir > 24 œufs en stock.", check: () => fridge >= 24 } ]; return badges.map(b => ({ ...b, unlocked: b.check() })); }
function renderAchievements() { const container = document.getElementById('achievements-container'); if (!container) return; const data = checkAchievements(); let html = `<h3 class="settings-header">Succès (${data.filter(d=>d.unlocked).length}/${data.length})</h3><div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(80px, 1fr)); gap:10px; padding:0 15px 20px 15px;">`; data.forEach(b => { const opacity = b.unlocked ? '1' : '0.4'; const color = b.unlocked ? 'var(--warning)' : 'var(--text-grey)'; const bg = b.unlocked ? 'rgba(255, 149, 0, 0.1)' : 'rgba(0,0,0,0.05)'; const safeTitle = b.title.replace(/'/g, "\\'"); const safeDesc = b.desc.replace(/'/g, "\\'"); html += `<div onclick="showBadgeInfo('${safeTitle}', '${safeDesc}', ${b.unlocked})" style="background:${bg}; border-radius:15px; padding:10px 5px; text-align:center; opacity:${opacity}; display:flex; flex-direction:column; align-items:center; cursor:pointer; transition: transform 0.1s;"><div style="font-size:20px; color:${color}; margin-bottom:5px;"><i class="fas ${b.icon}"></i></div><div style="font-size:10px; font-weight:700; color:var(--text-dark);">${b.title}</div></div>`; }); container.innerHTML = html + `</div>`; } window.showBadgeInfo = (title, desc, unlocked) => { alert(`${unlocked ? "✅ SUCCÈS DÉBLOQUÉ !" : "🔒 SUCCÈS VERROUILLÉ"}\n\n🏆 ${title}\n${desc}`); };

// ==========================================
// MAIN CALL
// ==========================================
window.renderExtensions = () => {
    migrateLocalStorageToCloud();
    injectExtensionContainers();
    renderWeatherTip();
    renderRecyclerWidget(); // Appelé explicitement
    renderHealthWidget();
    renderStockWidget();
    renderFridgeWidget();
    renderSalesWidget();
    renderAchievements();
};
