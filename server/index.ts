import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildMonthlySummary } from '../src/lib/calendar.js'
import { createStore } from './store.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const publicDir = path.resolve(rootDir, '..', 'dist')
const dbPath = process.env.DB_PATH ?? path.resolve(rootDir, '..', 'data', 'profit-calendar.db')
const port = Number(process.env.PORT ?? 3000)

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const app = express()
const store = createStore(dbPath)

app.use(express.json())

app.get('/api/summary', (request, response) => {
  const month = typeof request.query.month === 'string' ? request.query.month : new Date().toISOString().slice(0, 7)
  const year = Number(month.slice(0, 4))
  const goals =
    store.getGoalSettings(year) ??
    ({
      year,
      annualTargetUsd: 10000,
      monthlyTargetUsd: 1000,
    } as const)
  const entries = store.getYearEntries(year)
  const monthEntries = store.getMonthEntries(month)
  const summary = buildMonthlySummary(entries, goals, month)

  response.json({
    goals,
    summary,
    recentEntries: monthEntries.slice(-8).reverse(),
  })
})

app.get('/api/day/:date', (request, response) => {
  response.json({ entries: store.getDayEntries(request.params.date) })
})

app.put('/api/goals/:year', (request, response) => {
  const year = Number(request.params.year)
  const input = {
    year,
    annualTargetUsd: Number(request.body.annualTargetUsd),
    monthlyTargetUsd: Number(request.body.monthlyTargetUsd),
  }
  store.saveGoalSettings(input)
  response.json({ goals: input })
})

app.post('/api/entries', (request, response) => {
  const id = store.upsertEntry({
    entryDate: String(request.body.entryDate),
    amountUsd: Number(request.body.amountUsd),
    source: String(request.body.source),
    note: String(request.body.note ?? ''),
  })
  response.status(201).json({ id })
})

app.put('/api/entries/:id', (request, response) => {
  store.updateEntry(Number(request.params.id), {
    entryDate: String(request.body.entryDate),
    amountUsd: Number(request.body.amountUsd),
    source: String(request.body.source),
    note: String(request.body.note ?? ''),
  })
  response.status(204).end()
})

app.delete('/api/entries/:id', (request, response) => {
  store.deleteEntry(Number(request.params.id))
  response.status(204).end()
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(publicDir))
  app.use((_request, response) => {
    response.sendFile(path.join(publicDir, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`profit-calendar server listening on http://localhost:${port}`)
})
