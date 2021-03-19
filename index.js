var cities = {}
var cols = []
const rhna6 = 'Total 6th c. RHNA (current)'
const rhna5 = '5th Cycle RHNA (Total)'
const jurisdiction = 'Jurisdiction'
const county = 'County_display'
const council = 'COG_display'
const duedate = 'Due Date'
const elemDraft = 'Housing Element Draft'
const fifthElement = '5th Cycle Housing Element'
const vli = 'VLI'
const li = 'LI'
const mi = 'MI'
const ami = 'AMI'
const prog = '5th Cycle Progress %'

// new variables made by SKT below
const finalAllocation = 'Final Allocation'
const countVolunteers = 'Interested Volunteers'
const population = 'Population'
const area = 'Area'
const density = 'Density'
function selectionChanged(id) {
    const cityData = cities[id]
    clearCharts()
    populateJurisdictionBoxForCity(cityData)
    populateStatementForCity(cityData)
    populateDueDaysForCity(cityData)
    populateIncomeHistogramForCity(cityData)
    populateResourceLinksForCity(cityData)
    document.getElementById('rhna-data').style.display = 'block'
    window.location.hash = id
}

// Populates the select dropdown with all cities from values.
function populateSelectorWithCities(cities) {
    const selector = document.getElementById('rhna-selector')
    let cities_arr = []
    for (city in cities) {
        cities_arr.push([cities[city].fields[jurisdiction], city])
    }

    cities_arr.sort()

    for ([name, id] of cities_arr) {
        const opt = document.createElement('option')
        opt.innerText = name
        opt.value = id
        selector.appendChild(opt)
    }
}

function clearCharts() {
    const charts = document.getElementById('rhna-charts')
    charts.innerHTML = ''
}
function populateIncomeHistogramForCity(cityArr) {
    const charts = document.getElementById('rhna-charts')
    const canvas = document.createElement('canvas')
    canvas.height = 200
    canvas.width = 400
    charts.appendChild(canvas)

    const ctx = canvas.getContext('2d')

    const chart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [vli, li, mi, ami],
            datasets: [
                {
                    label: '6th Cycle RHNA',
                    backgroundColor: [
                        '#1e697a',
                        '#7a0027',
                        '#db6400',
                        '#f8a62b',
                    ],
                    data: [
                        cityArr.fields[vli][0],
                        cityArr.fields[li][0],
                        cityArr.fields[mi][0],
                        cityArr.fields[ami][0],
                    ],
                },
            ],
        },
        options: {
            legend: { display: true },
            title: {
                display: true,
                fontSize: 16,
                fontColor: '#000',
                text: '6th Cycle RHNA Allocation: By Income',
            },
            /*            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }]
            }
*/
        },
    })
}

function populateJurisdictionBoxForCity(cityArr) {
    document.getElementById('jurisdiction').innerText =
        cityArr.fields[jurisdiction]
    document.getElementById('county').innerText = cityArr.fields[county]
    document.getElementById('cog').innerText = cityArr.fields[council]
}

function populateDueDaysForCity(cityArr) {
    today = new Date()
    const dueDateStr = cityArr.fields[duedate]
    const due = new Date(dueDateStr)
    const one_day = 1000 * 60 * 60 * 24
    const days_left = Math.floor((due.getTime() - today.getTime()) / one_day)
    document.getElementById('element-due-date').innerText = dueDateStr
    document.getElementById('element-due-days').innerText = days_left
}

function populateStatementForCity(cityArr) {
    const statement = document.getElementById('progress-statement')
    const progress = cityArr.fields[prog]

    document.getElementById('5th-count').innerText = cityArr.fields[rhna5]
    document.getElementById('6th-count').innerText = cityArr.fields[rhna6]

    if (
        progress === '' ||
        progress === 'NaN' ||
        progress === '0' ||
        progress === '0%' ||
        progress === '0.0%'
    ) {
        return // No percent competion data.
    }

    const blame = document.getElementById('progress-blame')
    let numericPct = parseFloat(progress)
    let pct = Math.round(numericPct * 100)
    if (numericPct < 0.5) {
        blame.innerText = `${pct}%`
        blame.style.color = 'red'
    } else if (numericPct < 0.9) {
        blame.innerText = `${pct}%`
        blame.style.color = 'orange'
    } else if (numericPct < 2.0) {
        blame.innerText = `${pct}%`
        blame.style.color = 'green'
    } else {
        blame.innerText = `${pct}% - Something is up!`
        blame.style.color = 'green'
    }
}

function populateResourceLinksForCity(cityArr) {
    const fifthElemLink = document.getElementById('5th-element')
    fifthElemLink.href = cityArr.fields[fifthElement]
    fifthElemLink.innerText = cityArr.fields[fifthElement]

    const sixthElemDraftLink = document.getElementById('6th-element')
    sixthElemDraftLink.href = cityArr.fields[elemDraft]
    sixthElemDraftLink.innerText = cityArr.fields[elemDraft]
}

function getAirtableBase() {
    var Airtable = require('airtable')
    var base = new Airtable({ apiKey: 'keyZHNl5mF6KiNGzA' }).base(
        'appRD2z3VXs78iq80'
    )
    return base
}

function getCitiesFromAirtable(base, then) {
    const cities = {}
    return new Promise((resolve, reject) => {
        base('Cities')
            .select({
                view: 'Main View',
            })
            .eachPage(
                function page(records, fetchNextPage) {
                    records.forEach(function (record) {
                        cities[record.id] = record
                    })
                    fetchNextPage()
                },
                function done(err) {
                    if (err) {
                        console.error(err)
                        reject(err)
                    } else {
                        resolve(cities)
                    }
                }
            )
    })
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('rhna-selector').addEventListener('change', (e) => {
        selectionChanged(e.target.value)
    })

    getCitiesFromAirtable(getAirtableBase()).then((csv) => {
        populateSelectorWithCities(csv)
        cities = csv
        cols = Object.keys(Object.values(csv)[0].fields)

        if (window.location.hash.length > 1) {
            const hash = decodeURI(document.location.hash.substring(1))
            document.getElementById('rhna-selector').value = hash
            selectionChanged(hash)
        }
    })
})
