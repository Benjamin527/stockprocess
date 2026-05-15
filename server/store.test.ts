import { afterEach, describe, expect, it } from 'vitest'

import { createStore } from './store.js'

describe('store', () => {
  const stores: Array<ReturnType<typeof createStore>> = []

  afterEach(() => {
    for (const store of stores) {
      store.close()
    }
    stores.length = 0
  })

  it('persists daily holding records and returns entries across a trailing range', () => {
    const store = createStore(':memory:')
    stores.push(store)

    store.saveGoalSettings({
      year: 2026,
      annualTargetUsd: 30000,
      monthlyTargetUsd: 0,
    })

    store.upsertEntry({
      entryDate: '2025-12-20',
      amountUsd: 800,
      source: 'Longbridge',
      note: '',
    })
    store.upsertEntry({
      entryDate: '2026-05-02',
      amountUsd: 1300,
      source: 'Longbridge',
      note: '',
    })
    store.upsertEntry({
      entryDate: '2026-05-02',
      amountUsd: 400,
      source: 'Other',
      note: 'secondary account',
    })
    store.upsertEntry({
      entryDate: '2026-05-10',
      amountUsd: 1500,
      source: 'Longbridge',
      note: '',
    })

    const month = store.getMonthEntries('2026-05')
    const trailingYear = store.getEntriesBetween('2025-05-15', '2026-05-16')
    const goals = store.getGoalSettings(2026)

    expect(goals?.annualTargetUsd).toBe(30000)
    expect(month).toHaveLength(3)
    expect(month.filter((entry) => entry.entryDate === '2026-05-02')).toHaveLength(2)
    expect(trailingYear.map((entry) => entry.entryDate)).toEqual([
      '2025-12-20',
      '2026-05-02',
      '2026-05-02',
      '2026-05-10',
    ])
  })

  it('applies schema migrations and creates the date index', () => {
    const store = createStore(':memory:')
    stores.push(store)

    const migrationMeta = store.getMeta('schema_version')
    const indexes = store.getIndexes()

    expect(migrationMeta).toBe('1')
    expect(indexes).toContain('idx_portfolio_entries_date')
  })
})
