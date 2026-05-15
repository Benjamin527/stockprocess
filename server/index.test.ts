import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { buildApp, resolveTimelineEndDate } from './index.js'
import { createStore } from './store.js'

describe('resolveTimelineEndDate', () => {
  it('uses the current day for the currently selected month', () => {
    expect(resolveTimelineEndDate('2026-05', '2026-05-15')).toBe('2026-05-15')
  })

  it('uses month end for historical months', () => {
    expect(resolveTimelineEndDate('2026-04', '2026-05-15')).toBe('2026-04-30')
  })
})

describe('api validation', () => {
  it('rejects malformed entry payloads', async () => {
    const store = createStore(':memory:')
    const app = buildApp({
      store,
      publicDir: '/tmp/unused',
      isProduction: false,
    })

    const response = await request(app)
      .post('/api/entries')
      .send({
        entryDate: 'bad-date',
        amountUsd: 'not-a-number',
        source: '',
        note: '',
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Invalid request')
    expect(response.body.details).toBeInstanceOf(Array)

    store.close()
  })

  it('accepts a valid entry payload and returns the saved id', async () => {
    const store = createStore(':memory:')
    const app = buildApp({
      store,
      publicDir: '/tmp/unused',
      isProduction: false,
    })

    const response = await request(app)
      .post('/api/entries')
      .send({
        entryDate: '2026-05-15',
        amountUsd: 6000,
        source: 'Longbridge',
        note: 'ok',
      })

    expect(response.status).toBe(201)
    expect(typeof response.body.id).toBe('number')

    store.close()
  })
})
