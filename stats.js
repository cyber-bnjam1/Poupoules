// stats.js - Gestion des statistiques avancées

let currentStatsYear = new Date().getFullYear();
let statsEggsChart = null;
let statsWasteChart = null;

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    initStatsYearSelector();
});

// Initialise le sélecteur d'année
function initStatsYearSelector() {
    const selector = document.getElementById('stats-year-select');
    if (!selector) return;

    selector.innerHTML = '';
    const currentYear = new Date().getFullYear();
    // On propose les 5 dernières années
    for (let y = currentYear; y >= currentYear - 4; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.innerText = y;
        if (y === currentStatsYear) opt.selected = true;
        selector.appendChild(opt);
    }

    selector.addEventListener('change', (e) => {
        currentStatsYear = parseInt(e.target.value);
        window.renderStatsView();
    });
}

// Fonction principale appelée lors de l'affichage de l'onglet
window.renderStatsView = () => {
    // Vérification de la présence des données
    // localEggs vient de app.js, recyclingHistory est stocké dans le localStorage par extensions.js
    const eggsData = typeof localEggs !== 'undefined' ? localEggs : [];
    const wasteData = JSON.parse(localStorage.getItem('poupoules_recycling_history') || '[]');

    const stats = calculateStats(currentStatsYear, eggsData, wasteData);

    // Mise à jour des widgets
    document.getElementById('stat-total-eggs-year').innerText = stats.totalEggs;
    document.getElementById('stat-total-waste-year').innerText = stats.totalWaste.toFixed(1) + ' kg';
    
    // Mise à jour des "Autres stats"
    document.getElementById('stat-best-month-eggs').innerText = stats.bestMonthEggs;
    document.getElementById('stat-avg-eggs').innerText = stats.avgEggsPerDay.toFixed(1);
    document.getElementById('stat-savings').innerText = stats.savings.toFixed(2) + ' €';

    // Rendu des graphiques
    renderEggsChart(stats.monthlyEggs);
    renderWasteChart(stats.monthlyWaste);
};

// Fonction de calcul des données
function calculateStats(year, eggs, waste) {
    const monthlyEggs = Array(12).fill(0);
    const monthlyWaste = Array(12).fill(0);
    let totalEggs = 0;
    let totalWaste = 0;

    // Agrégation Oeufs
    eggs.forEach(e => {
        const d = new Date(e.date);
        if (d.getFullYear() === year) {
            const count = parseInt(e.count || 0);
            monthlyEggs[d.getMonth()] += count;
            totalEggs += count;
        }
    });

    // Agrégation Déchets
    waste.forEach(w => {
        const d = new Date(w.date);
        if (d.getFullYear() === year) {
            const qty = parseFloat(w.qty || 0);
            monthlyWaste[d.getMonth()] += qty;
            totalWaste += qty;
        }
    });

    // Stats utiles supplémentaires
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const maxEggs = Math.max(...monthlyEggs);
    const bestMonthIndex = monthlyEggs.indexOf(maxEggs);
    const bestMonthEggs = maxEggs > 0 ? months[bestMonthIndex] + ` (${maxEggs})` : '-';
    
    // Moyenne œufs/jour (sur l'année entière ou jusqu'à aujourd'hui si année en cours)
    let daysInYear = 365;
    if (year === new Date().getFullYear()) {
        const start = new Date(year, 0, 0);
        const diff = new Date() - start;
        const oneDay = 1000 * 60 * 60 * 24;
        daysInYear = Math.floor(diff / oneDay);
    }
    const avgEggsPerDay = daysInYear > 0 ? totalEggs / daysInYear : 0;

    // Economies estimées (Prix moyen ~0.45€, variable définie dans extensions.js ou hardcodée ici)
    const price = typeof MARKET_EGG_PRICE !== 'undefined' ? MARKET_EGG_PRICE : 0.45;
    const savings = totalEggs * price;

    return { 
        monthlyEggs, totalEggs, 
        monthlyWaste, totalWaste,
        bestMonthEggs, avgEggsPerDay, savings 
    };
}

// Graphique Courbe Oeufs
function renderEggsChart(data) {
    const ctx = document.getElementById('chart-annual-eggs');
    if(!ctx) return;
    
    if (statsEggsChart) statsEggsChart.destroy();

    statsEggsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
            datasets: [{
                label: 'Œufs',
                data: data,
                borderColor: '#ff9500', // Warning color
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
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

// Graphique Barres Déchets
function renderWasteChart(data) {
    const ctx = document.getElementById('chart-annual-waste');
    if(!ctx) return;

    if (statsWasteChart) statsWasteChart.destroy();

    statsWasteChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
            datasets: [{
                label: 'Déchets (kg)',
                data: data,
                backgroundColor: '#34c759', // Success color
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
                x: { grid: { display: false } }
            }
        }
    });
}
