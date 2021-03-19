// global object holding all records, keyed by airtable id
window.cities = {}

const Airtable = require('airtable')
const base = new Airtable({ apiKey: 'keyZHNl5mF6KiNGzA' }).base(
  'appRD2z3VXs78iq80'
)

function selectionChanged(id) {
  const cityData = cities[id]
  console.log(cityData)
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
  for (id in cities) {
    cities_arr.push([cities[id].jurisdiction, id])
  }

  cities_arr.sort()

  for ([jurisdiction, id] of cities_arr) {
    const opt = document.createElement('option')
    opt.innerText = jurisdiction
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
      labels: ['vli', 'li', 'mi', 'ami'],
      datasets: [
        {
          label: '6th Cycle RHNA',
          backgroundColor: ['#1e697a', '#7a0027', '#db6400', '#f8a62b'],
          data: [cityArr.vli, cityArr.li, cityArr.mi, cityArr.ami],
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
  document.getElementById('jurisdiction').innerText = cityArr.jurisdiction
  document.getElementById('county').innerText = cityArr.county
  document.getElementById('cog').innerText = cityArr.council
}

function populateDueDaysForCity(cityArr) {
  today = new Date()
  const dueDateStr = cityArr.duedate
  const due = new Date(dueDateStr)
  const one_day = 1000 * 60 * 60 * 24
  const days_left = Math.floor((due.getTime() - today.getTime()) / one_day)
  document.getElementById('element-due-date').innerText = dueDateStr
  document.getElementById('element-due-days').innerText = days_left
}

function populateStatementForCity(cityArr) {
  const statement = document.getElementById('progress-statement')
  const progress = cityArr.prog

  document.getElementById('5th-count').innerText = cityArr.rhna5
  document.getElementById('6th-count').innerText = cityArr.rhna6

  if (
    progress === '' ||
    progress === 'NaN' ||
    progress === '0' ||
    progress === '0%' ||
    progress === '0.0%'
  ) {
    return // No percent completion data.
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
  fifthElemLink.href = cityArr.fifthElement
  fifthElemLink.innerText = cityArr.fifthElement

  const sixthElemDraftLink = document.getElementById('6th-element')
  sixthElemDraftLink.href = cityArr.elemDraft
  sixthElemDraftLink.innerText = cityArr.elemDraft
}

function normalizeRecord(record) {
  const fields = {
    ami: 'AMI',
    area: 'Area',
    council: 'COG_display',
    countVolunteers: 'Interested Volunteers',
    county: 'County_display',
    density: 'Density',
    duedate: 'Due Date',
    elemDraft: 'Housing Element Draft',
    fifthElement: '5th Cycle Housing Element',
    finalAllocation: 'Final Allocation',
    jurisdiction: 'Jurisdiction',
    li: 'LI',
    mi: 'MI',
    population: 'Population',
    prog: '5th Cycle Progress %',
    rhna5: '5th Cycle RHNA (Total)',
    rhna6: 'Total 6th c. RHNA (current)',
    vli: 'VLI',
  }

  for (key in fields) {
    let value = record.fields[fields[key]]
    if (key == 'countVolunteers') {
      value = Array.isArray(value) ? value.length : 0
    } else if (Array.isArray(value) && value.length == 1) {
      value = value[0]
    }
    fields[key] = value
  }
  fields.id = record.id
  return fields
}

function populateCitiesFromAirtable() {
  return new Promise((resolve, reject) => {
    base('Cities')
      .select({ view: 'Main View' })
      .eachPage(
        function page(records, fetchNextPage) {
          records.forEach(
            (record) => (cities[record.id] = normalizeRecord(record))
          )
          fetchNextPage()
        },
        function done(err) {
          if (err) {
            console.error(err)
            reject(err)
          } else {
            resolve()
          }
        }
      )
  })
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('rhna-selector').addEventListener('change', (e) => {
    selectionChanged(e.target.value)
  })

  populateCitiesFromAirtable().then(() => {
    populateSelectorWithCities(cities)

    if (window.location.hash.length > 1) {
      const hash = decodeURI(document.location.hash.substring(1))
      document.getElementById('rhna-selector').value = hash
      selectionChanged(hash)
    }
  })
})
