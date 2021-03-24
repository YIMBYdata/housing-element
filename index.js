// global object holding all records, keyed by airtable id
const cities = {}

const Airtable = require('airtable')
const base = new Airtable({ apiKey: 'keyZHNl5mF6KiNGzA' }).base(
  'appRD2z3VXs78iq80'
)

const data = { city: null }
const app = new Vue({
  el: '#rhna-data-app',
  data: data,
  computed: {
    progressColor: function () {
      if (this.city.progress < 50) {
        return 'red'
      } else if (this.city.progress < 90) {
        return 'orange'
      } else {
        return 'green'
      }
    },
  },
  updated: function () {
    if (!this.city) return

    if (!this.chartRendered) {
      renderRHNAChart(this.city)
      this.chartRendered = true
    }

    if (this.city.calendarIds) {
      Promise.all(
        this.city.calendarIds.map((calendarId) =>
          base('Calendar').find(calendarId)
        )
      ).then((calendars) => {
        this.city.calendars = calendars.map(normalizeCalendarRecord)
        delete this.city.calendarIds
      })
    }

    // hydrate linked airtable records... manually
  },
})

// allows for parent to set custom display of field as well as
// automatically handling fallback "missing info" call to action
Vue.component('field', {
  props: ['title', 'value'],
  template: `<div>
      {{ title }}:
      <slot v-if="value">{{ value }}</slot>
      <a href="https://airtable.com/shr9fipLLj1WTHKu7" target="_blank" v-else>Missing data, volunteer to help!</a>
    </div>`,
})

function renderRHNAChart(city) {
  const charts = document.getElementById('rhna-charts')
  charts.innerHTML = ''
  const canvas = document.createElement('canvas')
  canvas.height = 200
  canvas.width = 400
  charts.appendChild(canvas)

  const ctx = canvas.getContext('2d')

  const chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: [
        'Very Low Income',
        'Low Income',
        'Moderate Income',
        'Above Moderate Income',
      ],
      datasets: [
        {
          label: '6th Cycle RHNA',
          backgroundColor: ['#1e697a', '#7a0027', '#db6400', '#f8a62b'],
          data: [city.vli, city.li, city.mi, city.ami],
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
    },
  })
}

function selectionChanged(id) {
  data.city = cities[id]
  document.getElementById('rhna-data-app').style.display = 'block'
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

function normalizeCityRecord(record) {
  const fields = {
    ami: 'AMI',
    area: 'Area',
    calendarIds: 'Calendar',
    council: 'COG_display',
    countVolunteers: 'Count (Interested Volunteers)',
    county: 'County_display',
    density: 'Density',
    dueDate: 'Due Date',
    elemDraft: 'Housing Element Draft',
    fifthElement: '5th Cycle Housing Element',
    finalAllocation: 'Final Allocation',
    jurisdiction: 'Jurisdiction',
    li: 'LI',
    mi: 'MI',
    population: 'Population (2010 census)',
    progress: '5th Cycle Progress %',
    rhna5: '5th Cycle RHNA (Total)',
    rhna6: 'Total 6th c. RHNA (current)',
    vli: 'VLI',
  }

  for (key in fields) {
    let value = record.fields[fields[key]]
    if (Array.isArray(value) && value.length == 1) {
      value = value[0]
    }
    fields[key] = value
  }

  if (fields.dueDate) {
    const today = new Date()
    const one_day = 1000 * 60 * 60 * 24
    fields.dueDate = new Date(fields.dueDate)
    fields.dueDaysLeft = Math.floor(
      (fields.dueDate.getTime() - today.getTime()) / one_day
    )
  }

  switch (fields.progress) {
    case '':
    case 'NaN':
    case '0':
    case '0%':
    case '0.0%':
    case undefined:
      fields.progress = null
      break
    default:
      fields.progress = Math.round(parseFloat(fields.progress) * 100)
  }

  fields.calendars = []

  fields.id = record.id
  return fields
}

function normalizeCalendarRecord(record) {
  const fields = {
    date: 'Date & Time',
    description: 'Short description',
    link: 'Website',
  }

  for (key in fields) {
    let value = record.fields[fields[key]]
    if (Array.isArray(value) && value.length == 1) {
      value = value[0]
    }
    fields[key] = value
  }

  fields.date = new Date(fields.date)

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
            (record) => (cities[record.id] = normalizeCityRecord(record))
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
