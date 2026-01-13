// stats.js - Gestion des statistiques annuelles

let statsEggsChartInstance = null;
let statsWasteChartInstance = null;
let currentStatsYear = new Date().getFullYear();

// Fonction appelée par app.js lors de la navigation
window.renderStatsView = () => {
    initYearSelector();
    
    // Récupération des données (localEggs vient de app.js, poupoules_recycling_history du localStorage)
    const eggsData = typeof localEggs !== 'undefined' ? localEggs : [];
    const wasteData = JSON.parse(localStorage.getItem('poupoules_recycling_history') || '[]');

    const stats = calculateAnnualStats(currentStatsYear, eggsData, wasteData);

    // Mise à jour des widgets
    document.getElementById('stat-total-eggs').innerText = stats.totalEggs;
    document.getElementById('stat-total-waste').innerText = stats.totalWaste.toFixed(1) + ' kg';
    
    // Autres stats utiles
    document.getElementById('stat-best-month').innerText = stats.bestMonth;
    document.getElementById('stat-avg-eggs').innerText = stats.avgPerDay.toFixed(1);

    // Graphiques
    renderAnnualEggsChart(stats.monthlyEggs);
    renderAnnualWasteChart(stats.monthlyWaste);
};

function initYearSelector() {
    const yearSelect = document.getElementById('stats-year-select');
    if (!yearSelect || yearSelect.options.length > 0) return;

    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 4; y--) {
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

function calculateAnnualStats(year, eggs, waste) {
    const monthlyEggs = Array(12).fill(0);
    const monthlyWaste = Array(12).fill(0);
    let totalEggs = 0;
    let totalWaste = 0;

    // Calcul Oeufs
    eggs.forEach(e => {
        const d = new Date(e.date);
        if (d.getFullYear() === year) {
            monthlyEggs[d.getMonth()] += (e.count || 0);
            totalEggs += (e.count || 0);
        }
    });

    // Calcul Déchets
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
    
    // Moyenne par jour (si année en cours, on divise par le nombre de jours écoulés)
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
