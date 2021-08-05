document.addEventListener('DOMContentLoaded', function () {
  if (!document.getElementsByClassName('list__table')) return

  const Airtable = require('airtable')
  const base = new Airtable({ apiKey: 'keyZHNl5mF6KiNGzA' }).base(
    'appRD2z3VXs78iq80'
  )

  function getTopVolunteers() {
    const fields = {
      total: 'Total score',
      calendar: '# Calendar Entries',
      homework: '# Homework Entries',
      meeting: '# Meeting Reports',
    }

    const volunteer_groups = []
    for (const field in fields) {
      volunteer_groups.push(getTopVolunteersByField(fields[field]))
    }
    return Promise.all(volunteer_groups).then((groups) => {
      const keyed_groups = {}
      let i = 0
      for (const field in fields) {
        keyed_groups[field] = groups[i]
        i++
      }
      return keyed_groups
    })
  }

  function getTopVolunteersByField(field) {
    return new Promise((resolve, reject) => {
      base('Volunteers')
        .select({
          view: 'Individual Leaderboard',
          maxRecords: 5,
          sort: [{ field: field, direction: 'desc' }],
        })
        .firstPage(function (err, records) {
          if (err) {
            console.error(err)
            reject(err)
          } else {
            resolve(
              records.map((record) => {
                return {
                  name: record.fields['Full Name'],
                  location: record.fields['Hometown'],
                  score: record.fields[field],
                }
              })
            )
          }
        })
    })
  }

  getTopVolunteers().then((volunteer_groups) => {
    for (const table of document.getElementsByClassName('list__table')) {
      new Vue({
        el: table,
        data: volunteer_groups,
      })
    }
  })
})
