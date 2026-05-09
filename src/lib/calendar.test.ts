import { describe, expect, it } from 'vitest'

import { buildMonthlySummary, buildTeslaProgress } from './calendar.js'
import type { GoalSettings, ProfitEntry } from './types.js'

describe('buildMonthlySummary', () => {
  it('aggregates daily entries into month, year, and progress metrics', () => {
    const entries: ProfitEntry[] = [
      {
        id: 1,
        entryDate: '2026-05-01',
        amountUsd: 20,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-01T08:00:00Z',
      },
      {
        id: 2,
        entryDate: '2026-05-02',
        amountUsd: 30,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-02T08:00:00Z',
      },
      {
        id: 3,
        entryDate: '2026-05-04',
        amountUsd: -40,
        source: 'Other',
        note: '',
        createdAt: '2026-05-04T08:00:00Z',
      },
      {
        id: 4,
        entryDate: '2026-01-10',
        amountUsd: 100,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-01-10T08:00:00Z',
      },
    ]

    const goals: GoalSettings = {
      year: 2026,
      annualTargetUsd: 1000,
      monthlyTargetUsd: 200,
    }

    const summary = buildMonthlySummary(entries, goals, '2026-05')

    expect(summary.monthTotal).toBe(10)
    expect(summary.yearTotal).toBe(110)
    expect(summary.monthProgress).toBeCloseTo(0.05)
    expect(summary.yearProgress).toBeCloseTo(0.11)
    expect(summary.calendarDays.find((day) => day.date === '2026-05-04')?.amountUsd).toBe(-40)
    expect(summary.bestDay?.date).toBe('2026-05-02')
    expect(summary.worstDay?.date).toBe('2026-05-04')
  })

  it('marks weekends and NYSE holidays as market closed states', () => {
    const goals: GoalSettings = {
      year: 2026,
      annualTargetUsd: 1000,
      monthlyTargetUsd: 200,
    }

    const summary = buildMonthlySummary([], goals, '2026-05')
    const weekend = summary.calendarDays.find((day) => day.date === '2026-05-03')
    const memorialDay = summary.calendarDays.find((day) => day.date === '2026-05-25')
    const tradingDay = summary.calendarDays.find((day) => day.date === '2026-05-04')

    expect(weekend?.marketState).toBe('weekend')
    expect(weekend?.closedLabel).toBe('周末休市')
    expect(memorialDay?.marketState).toBe('holiday')
    expect(memorialDay?.closedLabel).toBe('阵亡将士纪念日')
    expect(tradingDay?.marketState).toBe('open')
  })

  it('computes tesla target progress from current year profit', () => {
    const progress = buildTeslaProgress(12500)

    expect(progress.targetUsd).toBe(50000)
    expect(progress.currentUsd).toBe(12500)
    expect(progress.progress).toBe(0.25)
  })
})
