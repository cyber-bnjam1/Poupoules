// extensions.js — VERSION ALLÉGÉE
// Supprimé : Frigo, Réserve Graines, Bio-Recycleur, Ventes Clients, Coût de revient, Tirelire
// Conservé : Météo, Almanach, Taux de ponte, Check-Matériel, Hall of Fame, Journal, Carnet Santé, Soins d'urgence, Succès

// ==========================================
// 0. AUTO-INJECTION DES CONTENEURS
// ==========================================
function injectExtensionContainers() {
    const dashboard   = document.getElementById('view-dashboard');
    const settings    = document.getElementById('view-settings');
    const maintenance = document.getElementById('view-maintenance');
    const chickens    = document.getElementById('view-chickens');

    if (!dashboard) return;

    // METEO & ALMANACH
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
        document.getElementById('weather-tip-container').insertAdjacentElement('afterend', almanacDiv);
    }

    // INDICATEUR DE FORME
    if (!document.getElementById('laying-rate-container')) {
        const rateDiv = document.createElement('div');
        rateDiv.id = 'laying-rate-container';
        rateDiv.style.marginBottom = "20px";
        const almanac = document.getElementById('almanac-container');
        almanac.insertAdjacentElement('afterend', rateDiv);
    }

    // CHECK-MATÉRIEL
    if (!document.getElementById('supplies-widget-container')) {
        const suppliesDiv = document.createElement('div');
        suppliesDiv.id = 'supplies-widget-container';
        suppliesDiv.style.marginBottom = "15px";
        const rateDiv = document.getElementById('laying-rate-container');
        rateDiv.insertAdjacentElement('afterend', suppliesDiv);
    }

    // JOURNAL
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

    // HALL OF FAME (dans poules)
    if (chickens && !document.getElementById('hall-of-fame-container')) {
        const hallDiv = document.createElement('div');
        hallDiv.id = 'hall-of-fame-container';
        hallDiv.style.marginBottom = "20px";
        const filter = chickens.querySelector('.segment-control');
        if (filter) filter.insertAdjacentElement('afterend', hallDiv);
    }

    // ENTRETIEN
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

    // SUCCÈS
    if (settings && !document.getElementById('achievements-container')) {
        const badgDiv = document.createElement('div');
        badgDiv.id = 'achievements-container';
        const profileCard = settings.querySelector('.profile-header-card');
        if (profileCard) profileCard.insertAdjacentElement('afterend', badgDiv);
    }
}

// ==========================================
// 1. INDICATEUR DE FORME (par race)
// ==========================================
const BREED_EGGS_PER_WEEK = {
    'isa': 6, 'rousse': 6, 'leghorn': 6, 'legorne': 6,
    'sussex': 5, 'marans': 4, 'wyandotte': 4, 'australorp': 5,
    'cendree': 4, 'grise': 4, 'noire': 4, 'harco': 4, 'black': 4,
    'rhode': 5, 'plymouth': 4, 'faverolles': 4, 'barnevelder': 4,
    'orpington': 3, 'brahma': 3, 'vorwerk': 4,
    'pekin': 2, 'soie': 2, 'silkie': 2, 'bantam': 2, 'cochin': 2,
    'sebright': 2, 'chabo': 2, 'araucana': 3, 'ameraucana': 3,
    'padoue': 2, 'gatinaise': 3, 'houdan': 3,
    'default': 4,
};

const BREED_MAX_LAYING_YEARS = {
    'isa': 3, 'rousse': 3, 'leghorn': 4, 'sussex': 5, 'marans': 5,
    'wyandotte': 5, 'australorp': 5, 'cendree': 5, 'harco': 4, 'noire': 4,
    'rhode': 5, 'plymouth': 5, 'faverolles': 5, 'orpington': 6, 'brahma': 6,
    'pekin': 7, 'soie': 7, 'silkie': 7, 'cochin': 7, 'sebright': 6,
    'chabo': 7, 'araucana': 5, 'ameraucana': 5, 'default': 5,
};

function getBreedEggsPerWeek(breed) {
    if (!breed) return BREED_EGGS_PER_WEEK['default'];
    const b = breed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const [key, val] of Object.entries(BREED_EGGS_PER_WEEK)) {
        if (key === 'default') continue;
        if (b.includes(key)) return val;
    }
    return BREED_EGGS_PER_WEEK['default'];
}

function getBreedMaxLayingYears(breed) {
    if (!breed) return BREED_MAX_LAYING_YEARS['default'];
    const b = breed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const [key, val] of Object.entries(BREED_MAX_LAYING_YEARS)) {
        if (key === 'default') continue;
        if (b.includes(key)) return val;
    }
    return BREED_MAX_LAYING_YEARS['default'];
}

function getChickenAgeYears(chicken) {
    if (!chicken.date) return 0;
    return (Date.now() - new Date(chicken.date).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

function isLowSeasonPeriod() {
    const month = new Date().getMonth();
    return month >= 8 || month <= 1;
}

function getSeasonalCoefficient() {
    const coefficients = [0.55, 0.65, 0.85, 0.95, 1.00, 1.00, 0.95, 0.90, 0.75, 0.60, 0.50, 0.50];
    return coefficients[new Date().getMonth()];
}

function renderLayingRate() {
    const container = document.getElementById('laying-rate-container');
    if (!container) return;

    const activeChickens = (typeof localChickens !== 'undefined')
        ? localChickens.filter(c => (c.status || 'active') === 'active')
        : [];

    if (activeChickens.length === 0) { container.innerHTML = ''; return; }

    const seasonCoeff = getSeasonalCoefficient();
    const isLowSeason = isLowSeasonPeriod();
    const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    const currentMonthName = monthNames[new Date().getMonth()];

    const agingAlerts = [];
    activeChickens.forEach(c => {
        const ageYears = getChickenAgeYears(c);
        const maxYears = getBreedMaxLayingYears(c.breed);
        if (ageYears >= maxYears) agingAlerts.push({ name: c.name, age: ageYears, max: maxYears, status: 'over' });
        else if (ageYears >= maxYears - 0.5) agingAlerts.push({ name: c.name, age: ageYears, max: maxYears, status: 'soon' });
    });

    const inactiveHealth = ['molting', 'broody'];
    const pontingChickens = activeChickens.filter(c => !inactiveHealth.includes(c.health));
    const inactiveCount = activeChickens.length - pontingChickens.length;

    const rawCapacity = pontingChickens.reduce((sum, c) => sum + getBreedEggsPerWeek(c.breed), 0);
    const theoreticalWeeklyCapacity = Math.round(rawCapacity * seasonCoeff);

    const now = new Date();
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(now.getDate() - 7);
    let eggsLast7Days = 0;
    if (typeof localEggs !== 'undefined') {
        localEggs.forEach(e => {
            const d = new Date(e.date);
            if (d >= oneWeekAgo && d <= now) eggsLast7Days += (e.count || 1);
        });
    }

    const rate = theoreticalWeeklyCapacity > 0 ? (eggsLast7Days / theoreticalWeeklyCapacity) * 100 : 0;
    const rateCapped = Math.min(rate, 100);

    let color = 'var(--success)', icon = 'fa-chart-line', text = "Le cheptel est en pleine forme !";
    if (rate < 70) { color = 'var(--warning)'; icon = 'fa-meh'; text = "Ponte moyenne, a surveiller."; }
    if (rate < 40) { color = 'var(--danger)'; icon = 'fa-notes-medical'; text = "Baisse de régime importante."; }

    const breedSummary = pontingChickens.reduce((acc, c) => {
        const key = c.breed || 'Inconnue';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    const breedDetail = Object.entries(breedSummary)
        .map(([breed, count]) => `${count} ${breed} (~${Math.round(getBreedEggsPerWeek(breed) * seasonCoeff * count)}/sem)`)
        .join(' · ');

    let seasonBadge = '';
    if (isLowSeason) {
        const seasonPct = Math.round(seasonCoeff * 100);
        seasonBadge = `
            <div style="display:flex; align-items:center; gap:6px; background:rgba(90,120,255,0.08); border:1px solid rgba(90,120,255,0.2); border-radius:8px; padding:6px 10px; margin-top:8px;">
                <i class="fas fa-moon" style="color:#5b7fff; font-size:12px;"></i>
                <span style="font-size:11px; color:var(--text-grey);">Basse saison (${currentMonthName}) — capacité réduite à <strong style="color:var(--text-dark);">${seasonPct}%</strong> du potentiel normal</span>
            </div>`;
    }

    let inactiveBadge = '';
    if (inactiveCount > 0) {
        const inactiveNames = activeChickens
            .filter(c => inactiveHealth.includes(c.health))
            .map(c => `${c.name} (${c.health === 'molting' ? 'en mue' : 'couve'})`)
            .join(', ');
        inactiveBadge = `
            <div style="display:flex; align-items:center; gap:6px; background:rgba(255,149,0,0.08); border:1px solid rgba(255,149,0,0.2); border-radius:8px; padding:6px 10px; margin-top:8px;">
                <i class="fas fa-feather" style="color:var(--warning); font-size:12px;"></i>
                <span style="font-size:11px; color:var(--text-grey);">${inactiveNames} — non comptabilisée${inactiveCount > 1 ? 's' : ''} dans le calcul</span>
            </div>`;
    }

    let ageBadgesHtml = '';
    agingAlerts.forEach(alert => {
        const ageStr = alert.age < 2
            ? Math.round(alert.age * 12) + ' mois'
            : alert.age.toFixed(1).replace('.', ',') + ' ans';
        if (alert.status === 'over') {
            ageBadgesHtml += `
                <div style="display:flex; align-items:center; gap:6px; background:rgba(255,59,48,0.08); border:1px solid rgba(255,59,48,0.2); border-radius:8px; padding:6px 10px; margin-top:8px;">
                    <i class="fas fa-hourglass-end" style="color:var(--danger); font-size:12px;"></i>
                    <span style="font-size:11px; color:var(--text-grey);"><strong style="color:var(--text-dark);">${alert.name}</strong> — ${ageStr}, au-delà de l'âge de ponte optimal (${alert.max} ans pour sa race)</span>
                </div>`;
        } else {
            ageBadgesHtml += `
                <div style="display:flex; align-items:center; gap:6px; background:rgba(255,149,0,0.08); border:1px solid rgba(255,149,0,0.2); border-radius:8px; padding:6px 10px; margin-top:8px;">
                    <i class="fas fa-hourglass-half" style="color:var(--warning); font-size:12px;"></i>
                    <span style="font-size:11px; color:var(--text-grey);"><strong style="color:var(--text-dark);">${alert.name}</strong> — ${ageStr}, approche de la fin de sa période de ponte (${alert.max} ans)</span>
                </div>`;
        }
    });

    container.innerHTML = `
        <div class="glass-card" style="padding:12px 15px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="icon-circle" style="background:${color}20; color:${color}; width:35px; height:35px; font-size:16px; flex-shrink:0;">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div>
                        <span style="font-size:11px; color:var(--text-grey); display:block;">Taux de ponte (7j)</span>
                        <span style="font-size:13px; color:var(--text-dark); font-weight:600;">${text}</span>
                    </div>
                </div>
                <div style="text-align:right; flex-shrink:0; margin-left:10px;">
                    <div style="font-size:18px; font-weight:800; color:${color};">${rate.toFixed(0)}%</div>
                    <div style="font-size:10px; color:var(--text-grey);">${eggsLast7Days} / ${theoreticalWeeklyCapacity} œufs</div>
                </div>
            </div>
            <div style="width:100%; height:6px; background:rgba(0,0,0,0.07); border-radius:3px; overflow:hidden;">
                <div style="width:${rateCapped}%; height:100%; background:${color}; border-radius:3px; transition:width 0.5s ease;"></div>
            </div>
            <div style="font-size:10px; color:var(--text-grey); margin-top:6px; line-height:1.4;">${breedDetail}</div>
            ${seasonBadge}
            ${inactiveBadge}
            ${ageBadgesHtml}
        </div>`;
}

// ==========================================
// 2. CHECK-MATÉRIEL
// ==========================================
function renderSuppliesWidget() {
    const container = document.getElementById('supplies-widget-container');
    if (!container) return;
    const items = [
        { id: 'straw',   label: 'Paille / Litiere',  icon: 'fa-layer-group' },
        { id: 'oyster',  label: 'Coquilles',          icon: 'fa-cookie' },
        { id: 'diatom',  label: 'Terre Diatomee',     icon: 'fa-shield-virus' },
        { id: 'vitamins',label: 'Vitamines',           icon: 'fa-pills' }
    ];
    let html = `<div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:5px;">`;
    items.forEach(item => {
        const isOk  = extSuppliesState[item.id] !== false;
        const color = isOk ? 'var(--success)' : 'var(--danger)';
        const bg    = isOk ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)';
        const text  = isOk ? 'En stock' : 'Acheter';
        const icon  = isOk ? 'fa-check' : 'fa-shopping-cart';
        html += `<div onclick="toggleSupply('${item.id}')" style="min-width:80px; flex:1; background:${bg}; border:1px solid ${color}; border-radius:10px; padding:8px; display:flex; flex-direction:column; align-items:center; cursor:pointer;"><i class="fas ${item.icon}" style="color:${color}; margin-bottom:5px;"></i><span style="font-size:10px; font-weight:bold; color:var(--text-dark); text-align:center; margin-bottom:2px;">${item.label}</span><div style="font-size:9px; color:${color}; display:flex; align-items:center; gap:3px;"><i class="fas ${icon}"></i> ${text}</div></div>`;
    });
    container.innerHTML = html + `</div>`;
}

window.toggleSupply = (id) => {
    extSuppliesState[id] = extSuppliesState[id] === false ? true : false;
    saveData();
    renderSuppliesWidget();
};

// ==========================================
// 3. HALL OF FAME
// ==========================================
function renderHallOfFame() {
    const container = document.getElementById('hall-of-fame-container');
    if (!container) return;
    const heavy = extEggRecords.heaviest > 0 ? extEggRecords.heaviest + 'g' : '--';
    const light = extEggRecords.lightest < 1000 ? extEggRecords.lightest + 'g' : '--';
    container.innerHTML = `<div class="glass-card" style="padding:15px; position:relative;"><div style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:#ffd700; color:#333; padding:2px 10px; border-radius:10px; font-size:10px; font-weight:bold;">HALL OF FAME</div><div style="display:flex; justify-content:space-around; align-items:center; margin-top:5px;"><div style="text-align:center;" onclick="updateRecord('heaviest')"><div style="font-size:24px;">&#x1F996;</div><div style="font-size:11px; color:var(--text-grey); text-transform:uppercase; margin-top:2px;">Le Monstre</div><div style="font-size:16px; font-weight:800; color:var(--text-dark);">${heavy}</div></div><div style="width:1px; height:30px; background:rgba(0,0,0,0.1);"></div><div style="text-align:center;" onclick="updateRecord('lightest')"><div style="font-size:14px; margin-bottom:5px;">&#x1F48E;</div><div style="font-size:11px; color:var(--text-grey); text-transform:uppercase;">Le Bijou</div><div style="font-size:16px; font-weight:800; color:var(--text-dark);">${light}</div></div></div><div style="text-align:center; margin-top:10px; font-size:10px; color:var(--primary); font-style:italic;">Cliquez sur un score pour le modifier</div></div>`;
}

window.updateRecord = (type) => {
    const val = prompt(type === 'heaviest' ? "Nouveau record Poids Lourd (g) ?" : "Nouveau record Poids Plume (g) ?");
    if (val && !isNaN(val)) {
        const weight = parseFloat(val);
        if (type === 'heaviest') {
            if (weight > extEggRecords.heaviest || extEggRecords.heaviest === 0) { extEggRecords.heaviest = weight; alert("Nouveau record !"); }
            else { alert("Pas un record !"); return; }
        } else {
            if (weight < extEggRecords.lightest) { extEggRecords.lightest = weight; alert("Nouveau record !"); }
            else { alert("Pas un record !"); return; }
        }
        saveData();
        renderHallOfFame();
        checkAchievements();
    }
};

// ==========================================
// 4. MÉTÉO
// ==========================================
function renderWeatherTip() {
    const container = document.getElementById('weather-tip-container');
    if (!container) return;
    if (container.innerHTML === "") container.innerHTML = `<div class="glass-card" style="padding:15px; text-align:center; color:var(--text-grey);"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>`;

    const displayTip = (t, loc) => {
        let tip = "Tout va bien !", icon = "fa-sun", color = "var(--primary)";
        if (t < 0)  { tip = `Il gele (${t}°C). Graissez les cretes.`; icon = "fa-snowflake"; color = "#007aff"; }
        else if (t < 10) { tip = `Frais (${t}°C). Gardez la litiere seche.`; icon = "fa-temperature-low"; color = "#5ac8fa"; }
        else if (t > 30) { tip = `Canicule (${t}°C) ! Eau fraiche !`; icon = "fa-fire"; color = "#ff3b30"; }
        else if (t > 25) { tip = `Chaud (${t}°C). Changez l'eau souvent.`; icon = "fa-sun"; color = "#ff9500"; }
        container.innerHTML = `<div class="glass-card" style="padding:15px; display:flex; gap:15px; align-items:center; border-left:4px solid ${color};"><i class="fas ${icon}" style="font-size:24px; color:${color};"></i><div style="font-size:13px; font-weight:600; color:var(--text-dark); line-height:1.4;">${tip}<br><span style="font-size:10px; color:var(--text-grey); font-weight:400;">Meteo : ${loc}</span></div></div>`;
    };

    const fallback = () => {
        fetch('https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current_weather=true')
            .then(r => r.json()).then(d => displayTip(d.current_weather.temperature, "Paris (Defaut)"))
            .catch(() => { container.innerHTML = `<div class="glass-card" style="padding:10px; text-align:center; font-size:12px;">Meteo HS</div>`; });
    };

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`).then(r => r.json()).then(d => displayTip(d.current_weather.temperature, "Ma position")).catch(fallback),
            fallback
        );
    } else fallback();
}

// ==========================================
// 5. ALMANACH
// ==========================================
function renderAlmanac() {
    const container = document.getElementById('almanac-container');
    if (!container) return;
    const almanacData = [
        { title: "Janvier : Grand Froid",   text: "Eau tiede et mais pour l'energie." },
        { title: "Fevrier : Patience",       text: "Nettoyez les nichoirs." },
        { title: "Mars : Le Reveil",         text: "Vermifuge avant la saison." },
        { title: "Avril : Pleine Saison",    text: "Donnez des coquilles d'huitres." },
        { title: "Mai : Attention Parasites",text: "Surveillez les poux rouges." },
        { title: "Juin : Hydratation",       text: "Eau fraiche a l'ombre." },
        { title: "Juillet : Canicule",       text: "Mouillez le sol si besoin." },
        { title: "Aout : Parasites 2",       text: "Traitez a la terre de diatomee." },
        { title: "Septembre : La Mue",       text: "Proteines pour refaire les plumes." },
        { title: "Octobre : L'Automne",      text: "Attention au rhume (Coryza)." },
        { title: "Novembre : Jours courts",  text: "La ponte baisse, c'est normal." },
        { title: "Decembre : Repos",         text: "Laissez-les se reposer." }
    ];
    const current = almanacData[new Date().getMonth()];
    container.innerHTML = `<div style="background:rgba(255,255,255,0.5); padding:10px 15px; border-radius:15px; border:1px dashed var(--text-grey); font-size:12px; color:var(--text-dark); display:flex; gap:10px; align-items:center;"><i class="fas fa-calendar-alt" style="font-size:20px; color:var(--text-grey);"></i><div><strong style="display:block; margin-bottom:2px; text-transform:uppercase; font-size:10px; color:var(--text-grey);">${current.title}</strong><span>${current.text}</span></div></div>`;
}

// ==========================================
// 6. JOURNAL
// ==========================================
function renderJournalWidget() {
    const container = document.getElementById('journal-widget-container');
    if (!container) return;
    let notesHtml = '';
    const recentNotes = [...extNotes].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    if (recentNotes.length === 0) {
        notesHtml = `<li style="color:var(--text-grey); font-size:14px; padding:10px; text-align:center;">Rien a signaler.</li>`;
    } else {
        recentNotes.forEach(n => {
            notesHtml += `<li style="display:flex; flex-direction:column; align-items:flex-start; gap:5px; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:10px;"><div style="display:flex; justify-content:space-between; width:100%;"><small style="color:var(--text-grey); font-weight:600;">${new Date(n.date).toLocaleDateString()}</small><i class="fas fa-times" style="color:var(--text-grey); cursor:pointer;" onclick="deleteNote('${n.id}')"></i></div><span style="font-size:15px;">${n.text}</span></li>`;
        });
    }
    container.innerHTML = `<h3 class="section-title">Journal</h3><div class="glass-card"><form onsubmit="addNote(event)" style="display:flex; gap:10px; margin-bottom:15px;"><input type="text" id="new-note-input" placeholder="Evenement..." required style="flex:1;"><button type="submit" style="width:40px; height:40px; background:var(--primary); color:white; border:none; border-radius:12px;"><i class="fas fa-paper-plane"></i></button></form><ul class="glass-list" style="background:transparent; border:none; box-shadow:none; padding:0; gap:10px;">${notesHtml}</ul></div>`;
}

window.addNote = (e) => {
    e.preventDefault();
    const input = document.getElementById('new-note-input');
    if (input.value) {
        extNotes.push({ id: 'n' + Date.now(), text: input.value, date: new Date().toISOString() });
        saveData();
        renderJournalWidget();
    }
};

window.deleteNote = (id) => {
    if (confirm("Effacer ?")) {
        extNotes = extNotes.filter(n => n.id !== id);
        saveData();
        renderJournalWidget();
    }
};

// ==========================================
// 7. CARNET SANTÉ & SOINS D'URGENCE
// ==========================================
function renderHealthWidget() {
    const container = document.getElementById('health-widget-container');
    if (!container) return;
    let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><h3 class="section-title" style="margin:0;">Carnet de Sante</h3><button onclick="openHealthModal()" style="background:var(--primary); color:white; border:none; padding:5px 12px; border-radius:15px; font-size:12px; font-weight:bold;">+ Ajouter</button></div>`;

    if (extHealth.length === 0) {
        html += `<div class="glass-card" style="padding:20px; text-align:center; color:gray; font-size:13px;">Aucun soin enregistre.</div>`;
    } else {
        html += `<div class="glass-list">`;
        [...extHealth].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).forEach(h => {
            let rappelInfo = "", borderColor = "transparent";
            if (h.nextDate) {
                const diffDays = Math.ceil((new Date(h.nextDate) - new Date()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) { rappelInfo = `<br><span style="color:var(--danger); font-weight:bold; font-size:11px;">Rappel depasse depuis ${Math.abs(diffDays)}j</span>`; borderColor = "var(--danger)"; }
                else if (diffDays < 15) { rappelInfo = `<br><span style="color:var(--warning); font-weight:bold; font-size:11px;">Rappel dans ${diffDays}j</span>`; borderColor = "var(--warning)"; }
                else { rappelInfo = `<br><span style="color:var(--success); font-size:11px;">Prochain: ${new Date(h.nextDate).toLocaleDateString()}</span>`; }
            }
            html += `<div class="glass-card" style="margin-bottom:10px; padding:15px; border-left:4px solid ${borderColor}; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:bold; font-size:15px;">${h.type}</div><div style="font-size:13px; color:var(--text-dark);">${h.product}</div><div style="font-size:11px; color:var(--text-grey); margin-top:2px;">Fait le ${new Date(h.date).toLocaleDateString()} ${rappelInfo}</div></div><button onclick="deleteHealth('${h.id}')" style="background:none; border:none; color:#ccc;"><i class="fas fa-trash"></i></button></div>`;
        });
        html += `</div>`;
    }
    container.innerHTML = html;
}

window.openHealthModal = () => {
    document.getElementById('modal-health-treatment').style.display = 'flex';
    document.getElementById('health-date').valueAsDate = new Date();
    window.autoFillHealth();
};

window.autoFillHealth = () => {
    const type = document.getElementById('health-type').value;
    const dateInput = document.getElementById('health-date').value;
    if (!dateInput) return;
    const date = new Date(dateInput);
    let next = new Date(date), tip = "";
    if (type === 'Vermifuge') { next.setMonth(next.getMonth() + 6); tip = "Tous les 6 mois"; }
    else if (type === 'Anti-Poux') { next.setMonth(next.getMonth() + 3); tip = "Tous les 3 mois"; }
    else if (type === 'Vaccin') { next.setFullYear(next.getFullYear() + 1); tip = "Rappel annuel"; }
    else { next = null; }
    const nextInput = document.getElementById('health-next-date');
    const tipSpan = document.getElementById('health-tip');
    if (next) { nextInput.value = next.toISOString().split('T')[0]; tipSpan.innerText = "Suggestion : " + tip; }
    else { nextInput.value = ""; tipSpan.innerText = ""; }
};

window.saveHealthTreatment = (e) => {
    e.preventDefault();
    extHealth.push({
        id: 'h' + Date.now(),
        type:     document.getElementById('health-type').value,
        product:  document.getElementById('health-product').value,
        date:     document.getElementById('health-date').value,
        nextDate: document.getElementById('health-next-date').value
    });
    saveData();
    document.getElementById('modal-health-treatment').style.display = 'none';
    renderHealthWidget();
    checkAchievements();
};

window.deleteHealth = (id) => {
    if (confirm("Supprimer ce soin ?")) {
        extHealth = extHealth.filter(h => h.id !== id);
        saveData();
        renderHealthWidget();
    }
};

function renderVetGuide() {
    const container = document.getElementById('vet-widget-container');
    if (!container) return;
    const tips = [
        { title: "Poux Rouges",    icon: "fa-bug",             color: "#ff3b30", text: "Nettoyer + Terre de Diatomee." },
        { title: "Rhume",          icon: "fa-head-side-cough", color: "#5ac8fa", text: "Thym + Ail dans l'eau." },
        { title: "Picornage",      icon: "fa-band-aid",        color: "#ff9500", text: "Desinfecter et isoler." },
        { title: "Gale des pattes",icon: "fa-paw",             color: "#8e8e93", text: "Huile de cade sur les pattes." }
    ];
    let html = `<h3 class="section-title">Soins d'urgence</h3><div class="glass-list">`;
    tips.forEach(t => html += `<div class="glass-card" style="margin-bottom:10px; padding:15px;"><div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;"><i class="fas ${t.icon}" style="color:${t.color}; font-size:18px;"></i><strong style="font-size:15px;">${t.title}</strong></div><p style="font-size:13px; color:var(--text-dark); line-height:1.4; margin:0;">${t.text}</p></div>`);
    container.innerHTML = html + `</div>`;
}

// ==========================================
// 8. SUCCÈS & BADGES
// ==========================================
function checkAchievements() {
    let eggTotal = 0;
    if (typeof localEggs !== 'undefined') localEggs.forEach(e => eggTotal += (e.count || 1));

    const badges = [
        { id: 'first',   icon: 'fa-crow',       title: 'Debutant',     desc: "Posseder au moins 1 poule.",                       check: () => localChickens.length > 0 },
        { id: 'mama',    icon: 'fa-users',       title: 'Mere Poule',   desc: "Avoir un cheptel de 5 poules ou plus.",            check: () => localChickens.length >= 5 },
        { id: 'egg1',    icon: 'fa-egg',         title: 'Premier Oeuf', desc: "Avoir ramasse son tout premier oeuf !",            check: () => eggTotal >= 1 },
        { id: 'egg100',  icon: 'fa-layer-group', title: "L'Habitue",    desc: "Avoir ramasse plus de 100 oeufs au total.",        check: () => eggTotal >= 100 },
        { id: 'egg500',  icon: 'fa-industry',    title: "L'Usine",      desc: "Avoir ramasse plus de 500 oeufs !",                check: () => eggTotal >= 500 },
        { id: 'vet',     icon: 'fa-user-md',     title: 'Gardien',      desc: "Avoir enregistre au moins un soin.",               check: () => extHealth.length > 0 },
        { id: 'record',  icon: 'fa-trophy',      title: 'Champion',     desc: "Avoir enregistre un record dans le Hall of Fame.", check: () => extEggRecords.heaviest > 0 },
    ];
    return badges.map(b => ({ ...b, unlocked: b.check() }));
}

function renderAchievements() {
    const container = document.getElementById('achievements-container');
    if (!container) return;
    const data = checkAchievements();
    let html = `<h3 class="settings-header">Succes (${data.filter(d => d.unlocked).length}/${data.length})</h3><div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(80px, 1fr)); gap:10px; padding:0 15px 20px 15px;">`;

    data.forEach(b => {
        const opacity = b.unlocked ? '1' : '0.4';
        const color   = b.unlocked ? 'var(--warning)' : 'var(--text-grey)';
        const bg      = b.unlocked ? 'rgba(255, 149, 0, 0.1)' : 'rgba(0,0,0,0.05)';
        const safeTitle = b.title.replace(/'/g, "\\'");
        const safeDesc  = b.desc.replace(/'/g, "\\'");
        html += `<div onclick="showBadgeInfo('${safeTitle}', '${safeDesc}', ${b.unlocked})" style="background:${bg}; border-radius:15px; padding:10px 5px; text-align:center; opacity:${opacity}; display:flex; flex-direction:column; align-items:center; cursor:pointer;"><div style="font-size:20px; color:${color}; margin-bottom:5px;"><i class="fas ${b.icon}"></i></div><div style="font-size:10px; font-weight:700; color:var(--text-dark);">${b.title}</div></div>`;
    });
    container.innerHTML = html + `</div>`;
}

window.showBadgeInfo = (title, desc, unlocked) => {
    const status = unlocked ? "SUCCES DEBLOQUE !" : "SUCCES VERROUILLE";
    alert(`${status}\n\n${title}\n${desc}`);
};

// ==========================================
// 9. POINT D'ENTRÉE PRINCIPAL
// ==========================================
window.renderExtensions = () => {
    injectExtensionContainers();
    renderWeatherTip();
    renderAlmanac();
    renderLayingRate();
    renderSuppliesWidget();
    renderJournalWidget();
    renderHallOfFame();
    renderHealthWidget();
    renderVetGuide();
    renderAchievements();
};
