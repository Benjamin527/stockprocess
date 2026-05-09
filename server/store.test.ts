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

  it('persists multiple sources on the same day and returns monthly totals', () => {
    const store = createStore(':memory:')
    stores.push(store)

    store.saveGoalSettings({
      year: 2026,
      annualTargetUsd: 10000,
      monthlyTargetUsd: 1000,
    })

    store.upsertEntry({
      entryDate: '2026-05-02',
      amountUsd: 20,
      source: 'Longbridge',
      note: '',
    })
    store.upsertEntry({
      entryDate: '2026-05-02',
      amountUsd: 10,
      source: 'Other',
      note: 'manual adjustment',
    })
    store.upsertEntry({
      entryDate: '2026-05-04',
      amountUsd: -40,
      source: 'Longbridge',
      note: '',
    })

    const month = store.getMonthEntries('2026-05')
    const goals = store.getGoalSettings(2026)

    expect(goals?.annualTargetUsd).toBe(10000)
    expect(month).toHaveLength(3)
    expect(month.filter((entry) => entry.entryDate === '2026-05-02')).toHaveLength(2)
    expect(month.reduce((total, entry) => total + entry.amountUsd, 0)).toBe(-10)
  })
})
