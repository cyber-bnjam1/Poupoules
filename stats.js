// stats.js - Contient le CSS, le HTML et la logique des statistiques

// 1. DÉFINITION DU STYLE CSS SPÉCIFIQUE
const statsStyle = `
<style id="stats-css">
    .chart-container { position: relative; height: 200px; width: 100%; margin-top:10px; }
    .stat-pill { background: rgba(0,0,0,0.05); padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: 600; color: #8e8e93; }
    .success-color { background: rgba(52, 199, 89, 0.2); color: #34c759; }
</style>`;

// 2. DÉFINITION DU CONTENU HTML
const statsViewHTML = `
<section id="view-stats">
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <h1 class="big-title">Statistiques</h1>
        <select id="stats-year-select" style="width:auto; padding:5px 15px; border-radius:15px; font-weight:bold; background:rgba(0,0,0,0.05); border:none;"></select>
    </div>

    <div class="status-row">
        <div class="glass-card mini-status-card">
            <div class="icon-circle egg-color"><i class="fas fa-egg"></i></div>
            <div class="status-info">
                <span class="status-label">Total Œufs</span>
                <span class="status-value" id="stat-total-eggs">0</span>
            </div>
        </div>
        <div class="glass-card mini-status-card">
            <div class="icon-circle success-color"><i class="fas fa-recycle"></i></div>
            <div class="status-info">
                <span class="status-label">Total Déchets</span>
                <span class="status-value" id="stat-total-waste">0 kg</span>
            </div>
        </div>
    </div>

    <div class="glass-card chart-card">
        <h3><i class="fas fa-chart-area"></i> Courbe de Ponte</h3>
        <div class="chart-container">
            <canvas id="chart-stats-eggs"></canvas>
        </div>
    </div>

    <div class="glass-card chart-card">
        <h3><i class="fas fa-dumpster"></i> Recyclage Déchets</h3>
        <div class="chart-container">
            <canvas id="chart-stats-waste"></canvas>
        </div>
    </div>

    <h3 class="section-title">Autres statistiques</h3>
    <div class="glass-card" style="padding:15px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:10px;">
            <span style="color:#8e8e93;">Meilleur mois</span>
            <span style="font-weight:bold;" id="stat-best-month">-</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
            <span style="color:#8e8e93;">Moyenne œufs/jour</span>
            <span style="font-weight:bold;" id="stat-avg-eggs">0</span>
        </div>
    </div>
    <div style="height:100px;"></div>
</section>
`;

// 3. LOGIQUE JAVASCRIPT
let statsEggsChartInstance = null;
let statsWasteChartInstance = null;
let currentStatsYear = new Date().getFullYear();

// Cette fonction est appelée par app.js quand on clique sur le menu
window.renderStatsView = () => {
    // A. Injection du HTML et CSS si pas encore présents
    const container = document.getElementById('scroll-container');
    if (!document.getElementById('view-stats')) {
        document.head.insertAdjacentHTML('beforeend', statsStyle);
        container.insertAdjacentHTML('beforeend', statsViewHTML);
        initYearSelector(); // On initialise le sélecteur une fois le HTML créé
    }

    // B. Calculs et Mise à jour
    const eggsData = typeof localEggs !== 'undefined' ? localEggs : [];
    const wasteData = JSON.parse(localStorage.getItem('poupoules_recycling_history') || '[]');
    const stats = calculateAnnualStats(currentStatsYear, eggsData, wasteData);

    // Update DOM
    document.getElementById('stat-total-eggs').innerText = stats.totalEggs;
    document.getElementById('stat-total-waste').innerText = stats.totalWaste.toFixed(1) + ' kg';
    document.getElementById('stat-best-month').innerText = stats.bestMonth;
    document.getElementById('stat-avg-eggs').innerText = stats.avgPerDay.toFixed(1);

    // Rendu Graphiques
    renderAnnualEggsChart(stats.monthlyEggs);
    renderAnnualWasteChart(stats.monthlyWaste);
};

function initYearSelector() {
    const yearSelect = document.getElementById('stats-year-select');
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    
    // --- MODIFICATION ICI ---
    // On part de l'année actuelle et on descend jusqu'à 2025 seulement.
    // L'année prochaine (2026), la boucle fera 2026, 2025.
    // Dans 2 ans (2027), elle fera 2027, 2026, 2025, etc.
    for (let y = currentYear; y >= 2025; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.innerText = y;
        if (y === currentStatsYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    
    yearSelect.addEventListener('change', (e) => {
        currentStatsYear = parseInt(e.target.value);
        window.renderStatsView(); // Re-render avec la nouvelle année
    });
}

function calculateAnnualStats(year, eggs, waste) {
    const monthlyEggs = Array(12).fill(0);
    const monthlyWaste = Array(12).fill(0);
    let totalEggs = 0;
    let totalWaste = 0;

    eggs.forEach(e => {
        const d = new Date(e.date);
        if (d.getFullYear() === year) {
            monthlyEggs[d.getMonth()] += (e.count || 0);
            totalEggs += (e.count || 0);
        }
    });

    waste.forEach(w => {
        const d = new Date(w.date);
        if (d.getFullYear() === year) {
            monthlyWaste[d.getMonth()] += (w.qty || 0);
            totalWaste += (w.qty || 0);
        }
    });

    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const maxEggs = Math.max(...monthlyEggs);
    const bestMonth = maxEggs > 0 ? months[monthlyEggs.indexOf(maxEggs)] + ` (${maxEggs})` : '-';
    
    const isCurrentYear = year === new Date().getFullYear();
    const days = isCurrentYear ? Math.ceil((new Date() - new Date(year, 0, 1)) / (1000*60*60*24)) : 365;
    const avgPerDay = days > 0 ? totalEggs / days : 0;

    return { monthlyEggs, monthlyWaste, totalEggs, totalWaste, bestMonth, avgPerDay };
}

function renderAnnualEggsChart(data) {
    const ctx = document.getElementById('chart-stats-eggs');
    if (!ctx) return;
    if (statsEggsChartInstance) statsEggsChartInstance.destroy();

    statsEggsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
            datasets: [{
                label: 'Œufs',
                data: data,
                borderColor: '#ff9500',
                backgroundColor: 'rgba(255, 149, 0, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { display: false } } }
        }
    });
}

function renderAnnualWasteChart(data) {
    const ctx = document.getElementById('chart-stats-waste');
    if (!ctx) return;
    if (statsWasteChartInstance) statsWasteChartInstance.destroy();

    statsWasteChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
            datasets: [{
                label: 'Déchets (kg)',
                data: data,
                backgroundColor: '#34c759',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { borderDash: [5, 5] } } }
        }
    });
}
