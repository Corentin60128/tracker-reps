if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/assets/js/sw.js')
}

let currentMonth = 1
let currentWeek = 1
let programmeData = null
let currentView = 'session'

fetch('assets/data/programme.json')
    .then(response => response.json())
    .then(data => {
        programmeData = data
        displaySession()
        document.getElementById('mois-1').classList.add('active')
        document.getElementById('semaine-1').classList.add('active')
    })

// ─────────────────────────────────────────────
// NAVIGATION VUES
// ─────────────────────────────────────────────

function showView(view) {
    currentView = view

    document.querySelectorAll('#nav-views li').forEach(li => li.classList.remove('active'))
    document.getElementById(`view-${view}`).classList.add('active')

    const main = document.getElementById('main')
    const stats = document.getElementById('section-stats')
    const composition = document.getElementById('section-composition')

    main.classList.add('hidden')
    stats.classList.add('hidden')
    composition.classList.add('hidden')

    if (view === 'session') {
        main.classList.remove('hidden')
    } else if (view === 'stats') {
        stats.classList.remove('hidden')
        initGraphique()
        renderPoidsSection()
    } else if (view === 'composition') {
        composition.classList.remove('hidden')
        renderCompositionSection()
    }
}

// ─────────────────────────────────────────────
// SÉANCE
// ─────────────────────────────────────────────

function displaySession() {
    const today = new Date().getDay()

    const sessionByDay = {
        1: 0,
        2: 1,
        3: 2,
        4: 3,
        5: 4
    }

    const sessionIndex = sessionByDay[today]
    const session = programmeData.sessions[sessionIndex]
    const main = document.getElementById('main')

    let exercicesHTML = ''

    session.exercices.forEach(exercice => {
        // Filtre semaine A/B
        if (exercice.semaine) {
            const semaineType = currentWeek % 2 === 1 ? 'A' : 'B'
            if (exercice.semaine !== semaineType) return
        }

        let seriesHTML = ''

        for(let i = 1; i <= exercice.series; i++) {
            const key = `m${currentMonth}_w${currentWeek}_session${session.id}_exercice${exercice.id}_serie${i}`
            const savedValue = localStorage.getItem(key) || ''

            seriesHTML += `
                <input 
                    type="text" 
                    placeholder="S${i} kg x reps" 
                    value="${savedValue}"
                    oninput="localStorage.setItem('${key}', this.value)"
                >
            `
        }

        exercicesHTML += `
            <div class="exercice">
                ${exercice.superset ? '<span class="badge-superset">⚡ Superset</span>' : ''}
                <h3>${exercice.nom}</h3>
                <p>${exercice.series} séries — ${exercice.reps} reps</p>
                ${seriesHTML}
            </div>
        `
    })

    let circuitHTML = ''

    if(session.circuit_abdos) {
        let itemsHTML = ''

        session.circuit_abdos.forEach(item => {
            const key = `m${currentMonth}_w${currentWeek}_session${session.id}_circuit_${item.nom}`
            const savedValue = localStorage.getItem(key) || ''

            itemsHTML += `
                <div class="circuit-item">
                    <span>${item.nom}</span>
                    <input type="text" placeholder="sec" value="${savedValue}"
                        oninput="localStorage.setItem('${key}', this.value)">
                </div>
            `
        })

        circuitHTML = `
            <div class="circuit">
                <h3>🔁 Circuit abdos — 4 tours</h3>
                ${itemsHTML}
            </div>
        `
    }

    const noteKey = `m${currentMonth}_w${currentWeek}_session${session.id}_note`
    const savedNote = localStorage.getItem(noteKey) || ''

    main.innerHTML = `
        <h2>${session.titre}</h2>
        <p>${session.focus}</p>
        ${exercicesHTML}
        ${circuitHTML}
        <textarea 
            placeholder="📝 Notes de séance, ressenti, RPE..."
            oninput="localStorage.setItem('${noteKey}', this.value)"
        >${savedNote}</textarea>
    `
}

function setMonth(month) {
    currentMonth = month
    document.querySelectorAll('#nav-mois li').forEach(li => li.classList.remove('active'))
    document.getElementById(`mois-${month}`).classList.add('active')
    displaySession()
    if (currentView === 'stats') {
        renderChart()
        renderPoidsChart()
    }
}

function setWeek(week) {
    currentWeek = week
    document.querySelectorAll('#nav-semaine li').forEach(li => li.classList.remove('active'))
    document.getElementById(`semaine-${week}`).classList.add('active')
    displaySession()
    if (currentView === 'stats') {
        renderChart()
        renderPoidsChart()
    }
}

// ─────────────────────────────────────────────
// GRAPHIQUE EXERCICES
// ─────────────────────────────────────────────

let chartInstance = null

function getExerciceList() {
    const exercices = []
    programmeData.sessions.forEach(session => {
        session.exercices.forEach(ex => {
            if (!exercices.find(e => e.id === ex.id)) {
                exercices.push({ id: ex.id, nom: ex.nom, sessionId: session.id })
            }
        })
    })
    return exercices
}

function populateSelect() {
    const select = document.getElementById('select-exercice')
    if (!select) return
    const exercices = getExerciceList()
    select.innerHTML = exercices.map(ex =>
        `<option value="${ex.id}_${ex.sessionId}">${ex.nom}</option>`
    ).join('')
}

function getPoidsMax12Semaines(exerciceId, sessionId) {
    const data = []
    const labels = []

    for (let month = 1; month <= 3; month++) {
        for (let week = 1; week <= 4; week++) {
            labels.push(`M${month} S${week}`)
            let poidsMax = null

            for (let serie = 1; serie <= 10; serie++) {
                const key = `m${month}_w${week}_session${sessionId}_exercice${exerciceId}_serie${serie}`
                const val = localStorage.getItem(key)
                if (!val) continue

                const match = val.replace(',', '.').match(/(\d+(\.\d+)?)/)
                if (match) {
                    const poids = parseFloat(match[1])
                    if (poidsMax === null || poids > poidsMax) poidsMax = poids
                }
            }

            data.push(poidsMax)
        }
    }

    return { data, labels }
}

function calcProgression(data) {
    const valeurs = data.filter(v => v !== null)
    if (valeurs.length < 2) return null

    const debut = valeurs[0]
    const fin = valeurs[valeurs.length - 1]
    const pct = ((fin - debut) / debut) * 100

    return { debut, fin, pct: Math.round(pct * 10) / 10 }
}

function renderProgressionCard(cardId, data, unite = 'kg') {
    const card = document.getElementById(cardId)
    if (!card) return

    const result = calcProgression(data)

    if (!result) {
        card.innerHTML = `<p class="prog-empty">Pas encore assez de données</p>`
        return
    }

    const { debut, fin, pct } = result
    const isPositif = pct >= 0
    const sign = isPositif ? '+' : ''
    const classe = isPositif ? 'prog-positif' : 'prog-negatif'
    const emoji = isPositif ? '📈' : '📉'

    card.innerHTML = `
        <div class="prog-left">
            <span class="prog-label">Progression totale</span>
            <span class="prog-detail">${debut} ${unite} → ${fin} ${unite}</span>
        </div>
        <div class="prog-right ${classe}">
            <span class="prog-emoji">${emoji}</span>
            <span class="prog-pct">${sign}${pct}%</span>
        </div>
    `
}

function renderChart() {
    const select = document.getElementById('select-exercice')
    if (!select || !select.value) return

    const [exerciceId, sessionId] = select.value.split('_')
    const { data, labels } = getPoidsMax12Semaines(exerciceId, sessionId)

    renderProgressionCard('progression-card', data, 'kg')

    if (chartInstance) chartInstance.destroy()

    const canvas = document.getElementById('myChart')
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Poids max (kg)',
                data,
                borderColor: '#7c3aed',
                backgroundColor: 'rgba(124, 58, 237, 0.15)',
                borderWidth: 2,
                pointBackgroundColor: (ctx) => {
                    const colors = ['#7c3aed', '#a855f7', '#ec4899']
                    return colors[Math.floor(ctx.dataIndex / 4)]
                },
                pointBorderColor: 'transparent',
                pointRadius: 6,
                pointHoverRadius: 8,
                tension: 0.4,
                fill: true,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    borderColor: '#2a2a2a',
                    borderWidth: 1,
                    titleColor: '#a855f7',
                    bodyColor: '#f0f0f0',
                    callbacks: {
                        label: ctx => ctx.raw !== null ? `${ctx.raw} kg` : 'Pas de données'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: (ctx) => ctx.index % 4 === 0 ? '#a855f7' : '#666666',
                        font: (ctx) => ({ weight: ctx.index % 4 === 0 ? '600' : '400' })
                    },
                    grid: { color: '#2a2a2a' }
                },
                y: {
                    beginAtZero: false,
                    ticks: { color: '#666666' },
                    grid: { color: '#2a2a2a' },
                    title: { display: true, text: 'kg', color: '#666666' }
                }
            }
        }
    })
}

function initGraphique() {
    populateSelect()
    renderChart()
}

// ─────────────────────────────────────────────
// GRAPHIQUE POIDS CORPOREL
// ─────────────────────────────────────────────

let poidsChartInstance = null

function getPoids12Semaines() {
    const data = []
    const labels = []

    for (let month = 1; month <= 3; month++) {
        for (let week = 1; week <= 4; week++) {
            labels.push(`M${month} S${week}`)
            const key = `poids_m${month}_w${week}`
            const val = localStorage.getItem(key)
            const match = val ? val.replace(',', '.').match(/(\d+(\.\d+)?)/) : null
            data.push(match ? parseFloat(match[1]) : null)
        }
    }

    return { data, labels }
}

function renderPoidsSection() {
    const container = document.getElementById('poids-inputs')
    if (!container) return

    let html = ''
    for (let month = 1; month <= 3; month++) {
        html += `<p class="poids-mois-label">Mois ${month}</p>`
        html += `<div class="poids-grid">`
        for (let week = 1; week <= 4; week++) {
            const key = `poids_m${month}_w${week}`
            const saved = localStorage.getItem(key) || ''
            html += `
                <div class="poids-input-wrap">
                    <label>S${week}</label>
                    <input 
                        type="number" 
                        placeholder="kg" 
                        value="${saved}"
                        oninput="localStorage.setItem('${key}', this.value); renderPoidsChart()"
                    >
                </div>
            `
        }
        html += `</div>`
    }
    container.innerHTML = html
    renderPoidsChart()
}

function renderPoidsChart() {
    const { data, labels } = getPoids12Semaines()

    renderProgressionCard('poids-progression-card', data, 'kg')

    if (poidsChartInstance) poidsChartInstance.destroy()

    const canvas = document.getElementById('poidsChart')
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    poidsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Poids (kg)',
                data,
                borderColor: '#ec4899',
                backgroundColor: 'rgba(236, 72, 153, 0.15)',
                borderWidth: 2,
                pointBackgroundColor: (ctx) => {
                    const colors = ['#ec4899', '#f472b6', '#fb7185']
                    return colors[Math.floor(ctx.dataIndex / 4)]
                },
                pointBorderColor: 'transparent',
                pointRadius: 6,
                pointHoverRadius: 8,
                tension: 0.4,
                fill: true,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    borderColor: '#2a2a2a',
                    borderWidth: 1,
                    titleColor: '#ec4899',
                    bodyColor: '#f0f0f0',
                    callbacks: {
                        label: ctx => ctx.raw !== null ? `${ctx.raw} kg` : 'Pas de données'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: (ctx) => ctx.index % 4 === 0 ? '#f472b6' : '#666666',
                        font: (ctx) => ({ weight: ctx.index % 4 === 0 ? '600' : '400' })
                    },
                    grid: { color: '#2a2a2a' }
                },
                y: {
                    beginAtZero: false,
                    ticks: { color: '#666666' },
                    grid: { color: '#2a2a2a' },
                    title: { display: true, text: 'kg', color: '#666666' }
                }
            }
        }
    })
}

// ─────────────────────────────────────────────
// COMPOSITION CORPORELLE
// ─────────────────────────────────────────────

function getComposition12Semaines(type) {
    const data = []
    const labels = []

    for (let month = 1; month <= 3; month++) {
        for (let week = 1; week <= 4; week++) {
            labels.push(`M${month} S${week}`)
            const key = `${type}_m${month}_w${week}`
            const val = localStorage.getItem(key)
            const match = val ? val.replace(',', '.').match(/(\d+(\.\d+)?)/) : null
            data.push(match ? parseFloat(match[1]) : null)
        }
    }

    return { data, labels }
}

function renderCompositionSection() {
    const container = document.getElementById('composition-inputs')
    if (!container) return

    const metrics = [
        { key: 'masse_grasse', label: 'Masse grasse', unite: '%', color: '#f97316' },
        { key: 'masse_musculaire', label: 'Masse musculaire', unite: 'kg', color: '#10b981' },
        { key: 'volume_hydrique', label: 'Volume hydrique', unite: '%', color: '#3b82f6' }
    ]

    let html = ''

    metrics.forEach(metric => {
        html += `
            <div class="composition-block">
                <h3 class="composition-titre" style="color: ${metric.color}">${metric.label}</h3>
                <div id="prog-${metric.key}" class="progression-card"></div>
                <div id="inputs-${metric.key}">
        `

        for (let month = 1; month <= 3; month++) {
            html += `<p class="poids-mois-label">Mois ${month}</p><div class="poids-grid">`
            for (let week = 1; week <= 4; week++) {
                const key = `${metric.key}_m${month}_w${week}`
                const saved = localStorage.getItem(key) || ''
                html += `
                    <div class="poids-input-wrap">
                        <label>S${week}</label>
                        <input 
                            type="number" 
                            placeholder="${metric.unite}" 
                            value="${saved}"
                            oninput="localStorage.setItem('${key}', this.value); renderCompositionCharts()"
                        >
                    </div>
                `
            }
            html += `</div>`
        }

        html += `
                </div>
                <canvas id="chart-${metric.key}" height="120"></canvas>
            </div>
        `
    })

    container.innerHTML = html
    renderCompositionCharts()
}

function renderCompositionCharts() {
    const metrics = [
        { key: 'masse_grasse', label: 'Masse grasse', unite: '%', color: '#f97316' },
        { key: 'masse_musculaire', label: 'Masse musculaire', unite: 'kg', color: '#10b981' },
        { key: 'volume_hydrique', label: 'Volume hydrique', unite: '%', color: '#3b82f6' }
    ]

    metrics.forEach(metric => {
        const { data, labels } = getComposition12Semaines(metric.key)

        renderProgressionCard(`prog-${metric.key}`, data, metric.unite)

        const canvas = document.getElementById(`chart-${metric.key}`)
        if (!canvas) return

        if (canvas._chartInstance) canvas._chartInstance.destroy()

        const ctx = canvas.getContext('2d')
        canvas._chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: metric.label,
                    data,
                    borderColor: metric.color,
                    backgroundColor: metric.color + '26',
                    borderWidth: 2,
                    pointBackgroundColor: metric.color,
                    pointBorderColor: 'transparent',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.4,
                    fill: true,
                    spanGaps: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a1a1a',
                        borderColor: '#2a2a2a',
                        borderWidth: 1,
                        titleColor: metric.color,
                        bodyColor: '#f0f0f0',
                        callbacks: {
                            label: ctx => ctx.raw !== null ? `${ctx.raw} ${metric.unite}` : 'Pas de données'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#666666' },
                        grid: { color: '#2a2a2a' }
                    },
                    y: {
                        beginAtZero: false,
                        ticks: { color: '#666666' },
                        grid: { color: '#2a2a2a' },
                        title: { display: true, text: metric.unite, color: '#666666' }
                    }
                }
            }
        })
    })
}