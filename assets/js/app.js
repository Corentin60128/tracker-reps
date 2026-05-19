if ('serviceWorker' in navigator) {
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
        document.getElementById('month-1').classList.add('active')
        document.getElementById('week-1').classList.add('active')
    })

// ─────────────────────────────────────────────
// VIEW NAVIGATION
// ─────────────────────────────────────────────

function showView(view) {
    currentView = view

    document.querySelectorAll('#nav-views li').forEach(li => li.classList.remove('active'))
    document.getElementById(`view-${view}`).classList.add('active')

    document.getElementById('main').classList.add('hidden')
    document.getElementById('section-stats').classList.add('hidden')
    document.getElementById('section-body').classList.add('hidden')

    if (view === 'session') {
        document.getElementById('main').classList.remove('hidden')
    } else if (view === 'stats') {
        document.getElementById('section-stats').classList.remove('hidden')
        initChart()
    } else if (view === 'body') {
        document.getElementById('section-body').classList.remove('hidden')
        renderBodySection()
    }
}

// ─────────────────────────────────────────────
// SESSION
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

    let exercisesHTML = ''

    session.exercices.forEach(exercise => {
        let seriesHTML = ''

        for (let i = 1; i <= exercise.series; i++) {
            const key = `m${currentMonth}_w${currentWeek}_session${session.id}_exercise${exercise.id}_set${i}`
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

        exercisesHTML += `
            <div class="exercice">
                ${exercise.superset ? '<span class="badge-superset">⚡ Superset</span>' : ''}
                <h3>${exercise.nom}</h3>
                <p>${exercise.series} séries — ${exercise.reps} reps</p>
                ${seriesHTML}
            </div>
        `
    })

    let circuitHTML = ''

    if (session.circuit_abdos) {
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
        ${exercisesHTML}
        ${circuitHTML}
        <textarea 
            placeholder="📝 Notes de séance, ressenti, RPE..."
            oninput="localStorage.setItem('${noteKey}', this.value)"
        >${savedNote}</textarea>
    `
}

function setMonth(month) {
    currentMonth = month
    document.querySelectorAll('#nav-month li').forEach(li => li.classList.remove('active'))
    document.getElementById(`month-${month}`).classList.add('active')
    displaySession()
    if (currentView === 'stats') renderChart()
    if (currentView === 'body') renderAllBodyCharts()
}

function setWeek(week) {
    currentWeek = week
    document.querySelectorAll('#nav-week li').forEach(li => li.classList.remove('active'))
    document.getElementById(`week-${week}`).classList.add('active')
    displaySession()
    if (currentView === 'stats') renderChart()
    if (currentView === 'body') renderAllBodyCharts()
}

// ─────────────────────────────────────────────
// STATS — EXERCISE CHART
// ─────────────────────────────────────────────

let exerciseChartInstance = null

function getExerciseList() {
    const exercises = []
    programmeData.sessions.forEach(session => {
        session.exercices.forEach(ex => {
            if (!exercises.find(e => e.id === ex.id && e.sessionId === session.id)) {
                exercises.push({ id: ex.id, nom: ex.nom, sessionId: session.id, sessionTitle: session.titre })
            }
        })
    })
    return exercises
}

function populateSelect() {
    const select = document.getElementById('select-exercise')
    if (!select) return
    const exercises = getExerciseList()
    select.innerHTML = exercises.map(ex =>
        `<option value="${ex.id}_${ex.sessionId}">${ex.nom} — ${ex.sessionTitle}</option>`
    ).join('')
}

function getMaxWeight12Weeks(exerciseId, sessionId) {
    const data = []
    const labels = []

    for (let month = 1; month <= 3; month++) {
        for (let week = 1; week <= 4; week++) {
            labels.push(`M${month} W${week}`)
            let maxWeight = null

            for (let set = 1; set <= 10; set++) {
                const key = `m${month}_w${week}_session${sessionId}_exercise${exerciseId}_set${set}`
                const val = localStorage.getItem(key)
                if (!val) continue

                const match = val.replace(',', '.').match(/(\d+(\.\d+)?)/)
                if (match) {
                    const weight = parseFloat(match[1])
                    if (maxWeight === null || weight > maxWeight) maxWeight = weight
                }
            }

            data.push(maxWeight)
        }
    }

    return { data, labels }
}

function calcProgression(data) {
    const values = data.filter(v => v !== null)
    if (values.length < 2) return null
    const start = values[0]
    const end = values[values.length - 1]
    const pct = ((end - start) / start) * 100
    return { start, end, pct: Math.round(pct * 10) / 10 }
}

function renderProgressionCard(cardId, data, unit = 'kg', inverseColors = false) {
    const card = document.getElementById(cardId)
    if (!card) return

    const result = calcProgression(data)

    if (!result) {
        card.innerHTML = `<p class="prog-empty">Pas encore assez de données</p>`
        return
    }

    const { start, end, pct } = result
    const isPositive = pct >= 0
    const sign = isPositive ? '+' : ''
    const isGood = inverseColors ? !isPositive : isPositive
    const colorClass = isGood ? 'prog-positif' : 'prog-negatif'
    const emoji = isGood ? '📈' : '📉'

    card.innerHTML = `
        <div class="prog-left">
            <span class="prog-label">Progression totale</span>
            <span class="prog-detail">${start} ${unit} → ${end} ${unit}</span>
        </div>
        <div class="prog-right ${colorClass}">
            <span class="prog-emoji">${emoji}</span>
            <span class="prog-pct">${sign}${pct}%</span>
        </div>
    `
}

function buildChart(canvasId, labels, data, color, colorAlpha, unit, accentColor) {
    const canvas = document.getElementById(canvasId)
    if (!canvas) return null

    const ctx = canvas.getContext('2d')
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data,
                borderColor: color,
                backgroundColor: colorAlpha,
                borderWidth: 2,
                pointBackgroundColor: color,
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
                    titleColor: accentColor || color,
                    bodyColor: '#f0f0f0',
                    callbacks: {
                        label: ctx => ctx.raw !== null ? `${ctx.raw} ${unit}` : 'No data'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: (ctx) => ctx.index % 4 === 0 ? (accentColor || color) : '#666666',
                        font: (ctx) => ({ weight: ctx.index % 4 === 0 ? '600' : '400' })
                    },
                    grid: { color: '#2a2a2a' }
                },
                y: {
                    beginAtZero: false,
                    ticks: { color: '#666666' },
                    grid: { color: '#2a2a2a' },
                    title: { display: true, text: unit, color: '#666666' }
                }
            }
        }
    })
}

function renderChart() {
    const select = document.getElementById('select-exercise')
    if (!select || !select.value) return

    const [exerciseId, sessionId] = select.value.split('_')
    const { data, labels } = getMaxWeight12Weeks(exerciseId, sessionId)

    renderProgressionCard('card-exercise-progress', data, 'kg')

    if (exerciseChartInstance) exerciseChartInstance.destroy()
    exerciseChartInstance = buildChart('chart-exercise', labels, data, '#7c3aed', 'rgba(124,58,237,0.15)', 'kg', '#a855f7')
}

function initChart() {
    populateSelect()
    renderChart()
}

// ─────────────────────────────────────────────
// BODY COMPOSITION
// ─────────────────────────────────────────────

const bodyMetrics = [
    { key: 'weight',  label: '⚖️ Poids total',     unit: 'kg', color: '#ec4899', colorAlpha: 'rgba(236,72,153,0.15)',  inverse: true  },
    { key: 'fat',     label: '🟠 Masse grasse',     unit: '%',  color: '#f97316', colorAlpha: 'rgba(249,115,22,0.15)', inverse: true  },
    { key: 'muscle',  label: '💪 Masse musculaire', unit: '%',  color: '#22d3ee', colorAlpha: 'rgba(34,211,238,0.15)', inverse: false },
    { key: 'hydro',   label: '💧 Volume hydrique',  unit: '%',  color: '#4ade80', colorAlpha: 'rgba(74,222,128,0.15)', inverse: false },
]

let bodyChartInstances = {}

function getMetric12Weeks(metricKey) {
    const data = []
    const labels = []

    for (let month = 1; month <= 3; month++) {
        for (let week = 1; week <= 4; week++) {
            labels.push(`M${month} W${week}`)
            const key = `body_${metricKey}_m${month}_w${week}`
            const val = localStorage.getItem(key)
            const match = val ? val.replace(',', '.').match(/(\d+(\.\d+)?)/) : null
            data.push(match ? parseFloat(match[1]) : null)
        }
    }

    return { data, labels }
}

function renderBodySection() {
    const container = document.getElementById('body-inputs-container')
    if (!container) return

    let html = ''

    bodyMetrics.forEach(metric => {
        html += `
            <div class="body-bloc">
                <h2 class="stats-title" style="color:${metric.color}">${metric.label}</h2>
                <p class="stats-subtitle">Évolution sur 3 mois</p>
                <div id="inputs-${metric.key}"></div>
                <div id="card-${metric.key}" class="progression-card"></div>
                <div class="chart-wrapper">
                    <canvas id="chart-${metric.key}"></canvas>
                </div>
                <div class="stats-divider"></div>
            </div>
        `
    })

    container.innerHTML = html

    bodyMetrics.forEach(metric => {
        const inputContainer = document.getElementById(`inputs-${metric.key}`)
        let inputsHTML = ''

        for (let month = 1; month <= 3; month++) {
            inputsHTML += `<p class="poids-mois-label">Month ${month}</p><div class="poids-grid">`
            for (let week = 1; week <= 4; week++) {
                const key = `body_${metric.key}_m${month}_w${week}`
                const saved = localStorage.getItem(key) || ''
                inputsHTML += `
                    <div class="poids-input-wrap">
                        <label>W${week}</label>
                        <input 
                            type="number" 
                            placeholder="${metric.unit}" 
                            value="${saved}"
                            oninput="localStorage.setItem('${key}', this.value); renderSingleBodyChart('${metric.key}')"
                        >
                    </div>
                `
            }
            inputsHTML += `</div>`
        }

        inputContainer.innerHTML = inputsHTML
    })

    renderAllBodyCharts()
}

function renderSingleBodyChart(metricKey) {
    const metric = bodyMetrics.find(m => m.key === metricKey)
    if (!metric) return

    const { data, labels } = getMetric12Weeks(metricKey)

    renderProgressionCard(`card-${metricKey}`, data, metric.unit, metric.inverse)

    if (bodyChartInstances[metricKey]) bodyChartInstances[metricKey].destroy()
    bodyChartInstances[metricKey] = buildChart(`chart-${metricKey}`, labels, data, metric.color, metric.colorAlpha, metric.unit)
}

function renderAllBodyCharts() {
    bodyMetrics.forEach(m => renderSingleBodyChart(m.key))
}