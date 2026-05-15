import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dayjs from 'dayjs'
import { z } from 'zod'

import { buildPortfolioSummary, buildPortfolioTimeline } from '../src/lib/calendar.js'
import { resolveDbPath } from './config.js'
import { createStore } from './store.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const publicDir = path.resolve(rootDir, '..', 'dist')
const dbPath = resolveDbPath(rootDir)
const port = Number(process.env.PORT ?? 3000)

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const entrySchema = z.object({
  entryDate: dateSchema,
  amountUsd: z.number().finite(),
  source: z.string().trim().min(1).max(64),
  note: z.string().max(500).default(''),
})

const goalSchema = z.object({
  annualTargetUsd: z.number().nonnegative(),
  monthlyTargetUsd: z.number(),
})

class RequestValidationError extends Error {
  details: Array<{ path: string; message: string }>

  constructor(details: Array<{ path: string; message: string }>) {
    super('Invalid request')
    this.name = 'RequestValidationError'
    this.details = details
  }
}

export function resolveTimelineEndDate(month: string, today = dayjs().format('YYYY-MM-DD')) {
  const selectedMonth = dayjs(`${month}-01`)
  const currentDay = dayjs(today)

  if (selectedMonth.isSame(currentDay, 'month')) {
    return currentDay.format('YYYY-MM-DD')
  }

  return selectedMonth.endOf('month').format('YYYY-MM-DD')
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input)

  if (!result.success) {
    throw new RequestValidationError(
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    )
  }

  return result.data
}

type AppDeps = {
  store: ReturnType<typeof createStore>
  publicDir: string
  isProduction: boolean
}

function withErrorHandling(handler: express.RequestHandler): express.RequestHandler {
  return (request, response, next) => {
    try {
      handler(request, response, next)
    } catch (error) {
      next(error)
    }
  }
}

export function buildApp({ store, publicDir, isProduction }: AppDeps) {
  const app = express()

  app.use(express.json())

  app.get('/api/summary', withErrorHandling((request, response) => {
    const month = parseOrThrow(
      monthSchema,
      typeof request.query.month === 'string' ? request.query.month : dayjs().format('YYYY-MM'),
    )
    const year = Number(month.slice(0, 4))
    const goals =
      store.getGoalSettings(year) ??
      ({
        year,
        annualTargetUsd: 50000,
        monthlyTargetUsd: 1000,
      } as const)
    const timelineEndDate = resolveTimelineEndDate(month)
    const timelineStartDate = dayjs(timelineEndDate).subtract(1, 'year').add(1, 'day').format('YYYY-MM-DD')
    const entries = store.getEntriesBetween(
      timelineStartDate,
      dayjs(timelineEndDate).add(1, 'day').format('YYYY-MM-DD'),
    )
    const monthEntries = store.getMonthEntries(month)
    const summary = buildPortfolioSummary(entries, goals, month)

    response.json({
      goals,
      summary,
      profitRule: {
        baseline: 'first-entry-of-month',
        description: 'Current month profit uses the last holding in the month minus the first holding recorded in the same month.',
      },
      timeline: {
        '1W': buildPortfolioTimeline(entries, '1W', timelineEndDate),
        '1M': buildPortfolioTimeline(entries, '1M', timelineEndDate),
        '6M': buildPortfolioTimeline(entries, '6M', timelineEndDate),
        '1Y': buildPortfolioTimeline(entries, '1Y', timelineEndDate),
      },
      recentEntries: monthEntries.slice(-8).reverse(),
    })
  }))

  app.get('/api/day/:date', withErrorHandling((request, response) => {
    const date = parseOrThrow(dateSchema, request.params.date)
    response.json({ entries: store.getDayEntries(date) })
  }))

  app.put('/api/goals/:year', withErrorHandling((request, response) => {
    const year = Number(request.params.year)
    const body = parseOrThrow(goalSchema, request.body)
    const input = {
      year,
      annualTargetUsd: body.annualTargetUsd,
      monthlyTargetUsd: body.monthlyTargetUsd,
    }
    store.saveGoalSettings(input)
    response.json({ goals: input })
  }))

  app.post('/api/entries', withErrorHandling((request, response) => {
    const input = parseOrThrow(entrySchema, request.body)
    const id = store.upsertEntry(input)
    response.status(201).json({ id })
  }))

  app.put('/api/entries/:id', withErrorHandling((request, response) => {
    const id = Number(request.params.id)
    const input = parseOrThrow(entrySchema, request.body)
    store.updateEntry(id, input)
    response.status(204).end()
  }))

  app.delete('/api/entries/:id', withErrorHandling((request, response) => {
    store.deleteEntry(Number(request.params.id))
    response.status(204).end()
  }))

  if (isProduction) {
    app.use(express.static(publicDir))
    app.use((_request, response) => {
      response.sendFile(path.join(publicDir, 'index.html'))
    })
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    void next

    if (error instanceof RequestValidationError) {
      response.status(400).json({
        error: 'Invalid request',
        details: error.details,
      })
      return
    }

    console.error('[api error]', error)
    response.status(500).json({ error: 'Internal server error' })
  })

  return app
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const store = createStore(dbPath)
const app = buildApp({
  store,
  publicDir,
  isProduction: process.env.NODE_ENV === 'production',
})

if (process.env.VITEST !== 'true') {
  app.listen(port, () => {
    console.log(`profit-calendar server listening on http://localhost:${port}`)
    console.log(`profit-calendar database path: ${dbPath}`)
  })
}
