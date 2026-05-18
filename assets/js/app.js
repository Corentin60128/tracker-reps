if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/assets/js/sw.js')
}

let currentMonth = 1
let currentWeek = 1
let programmeData = null

fetch('assets/data/programme.json')
    .then(response => response.json())
    .then(data => {
        programmeData = data
        displaySession()
    })

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
}

function setWeek(week) {
    currentWeek = week
    document.querySelectorAll('#nav-semaine li').forEach(li => li.classList.remove('active'))
    document.getElementById(`semaine-${week}`).classList.add('active')
    displaySession()
}