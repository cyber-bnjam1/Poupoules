// stats.js — Statistiques de ponte uniquement (section déchets supprimée)

// 1. CSS SPÉCIFIQUE
const statsStyle = `
<style id="stats-css">
    .chart-container { position: relative; height: 200px; width: 100%; margin-top:10px; }
    .stat-pill { background: rgba(0,0,0,0.05); padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: 600; color: #8e8e93; }
</style>`;

// 2. HTML
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
            <div class="icon-circle primary-color"><i class="fas fa-calendar-check"></i></div>
            <div class="status-info">
                <span class="status-label">Moy. / jour</span>
                <span class="status-value" id="stat-avg-eggs">0</span>
            </div>
        </div>
    </div>

    <div class="glass-card chart-card">
        <h3><i class="fas fa-chart-area"></i> Courbe de Ponte</h3>
        <div class="chart-container">
            <canvas id="chart-stats-eggs"></canvas>
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
            <span style="font-weight:bold;" id="stat-avg-eggs-2">0</span>
        </div>
    </div>
    
    <h3 class="section-title">Ponte individuelle</h3>
    <ul id="stats-chicken-list" class="glass-list"></ul>
    <div style="height:100px;"></div>
</section>
`;

// 3. LOGIQUE
let statsEggsChartInstance = null;
let currentStatsYear = new Date().getFullYear();

window.renderStatsView = () => {
    const container = document.getElementById('scroll-container');
    if (!document.getElementById('view-stats')) {
        document.head.insertAdjacentHTML('beforeend', statsStyle);
        container.insertAdjacentHTML('beforeend', statsViewHTML);
        initYearSelector();
    }

    const eggsData = typeof localEggs !== 'undefined' ? localEggs : [];
    const stats = calculateAnnualStats(currentStatsYear, eggsData);

    document.getElementById('stat-total-eggs').innerText = stats.totalEggs;
    document.getElementById('stat-avg-eggs').innerText   = stats.avgPerDay.toFixed(1);
    document.getElementById('stat-best-month').innerText = stats.bestMonth;
    document.getElementById('stat-avg-eggs-2').innerText = stats.avgPerDay.toFixed(1);

    renderAnnualEggsChart(stats.monthlyEggs);

    // NOUVEAU : Affichage des statistiques par poule
    const list = document.getElementById('stats-chicken-list');
    if (list) {
        list.innerHTML = '';
        const chickenStats = {};
        
        eggsData.forEach(e => {
            if (new Date(e.date).getFullYear() === currentStatsYear && e.chickenId) {
                chickenStats[e.chickenId] = (chickenStats[e.chickenId] || 0) + (e.count || 1);
            }
        });

        const sortedChickens = Object.keys(chickenStats).sort((a,b) => chickenStats[b] - chickenStats[a]);
        
        if (sortedChickens.length === 0) {
            list.innerHTML = '<li style="display:flex; justify-content:center; color:var(--text-grey);">Aucune ponte individuelle enregistrée pour cette année.</li>';
        } else {
            sortedChickens.forEach(id => {
                const c = localChickens.find(x => x.id === id);
                if (c) {
                    list.innerHTML += `
                        <li>
                            <div style="display:flex; align-items:center; gap:15px;">
                                <img src="${c.photo || 'icon.png'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                                <div>
                                    <strong>${c.name}</strong>
                                    <div style="font-size:11px; color:var(--text-grey);">${c.breed || 'Inconnue'}</div>
                                </div>
                            </div>
                            <div style="font-size:18px; font-weight:bold; color:var(--primary);">${chickenStats[id]} <i class="fas fa-egg" style="font-size:12px;"></i></div>
                        </li>`;
                }
            });
        }
    }
};

function initYearSelector() {
    const yearSelect = document.getElementById('stats-year-select');
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let y = currentYear; y >= 2025; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.innerText = y;
        if (y === currentStatsYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    yearSelect.addEventListener('change', (e) => {
        currentStatsYear = parseInt(e.target.value);
        window.renderStatsView();
    });
}

function calculateAnnualStats(year, eggs) {
    const monthlyEggs = Array(12).fill(0);
    let totalEggs = 0;

    eggs.forEach(e => {
        const d = new Date(e.date);
        if (d.getFullYear() === year) {
            monthlyEggs[d.getMonth()] += (e.count || 0);
            totalEggs += (e.count || 0);
        }
    });

    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const maxEggs = Math.max(...monthlyEggs);
    const bestMonth = maxEggs > 0 ? months[monthlyEggs.indexOf(maxEggs)] + ` (${maxEggs})` : '-';

    const isCurrentYear = year === new Date().getFullYear();
    const days = isCurrentYear ? Math.ceil((new Date() - new Date(year, 0, 1)) / (1000 * 60 * 60 * 24)) : 365;
    const avgPerDay = days > 0 ? totalEggs / days : 0;

    return { monthlyEggs, totalEggs, bestMonth, avgPerDay };
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
