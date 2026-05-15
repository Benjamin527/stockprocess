import { describe, expect, it } from 'vitest'

import {
  buildPortfolioSummary,
  buildPortfolioTimeline,
  buildPortfolioTargetProgress,
} from './calendar.js'
import type { GoalSettings, ProfitEntry } from './types.js'

describe('buildPortfolioSummary', () => {
  it('aggregates daily holdings into calendar, summary cards, and source composition', () => {
    const entries: ProfitEntry[] = [
      {
        id: 1,
        entryDate: '2026-04-30',
        amountUsd: 1200,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-04-30T08:00:00Z',
      },
      {
        id: 2,
        entryDate: '2026-05-01',
        amountUsd: 1300,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-01T08:00:00Z',
      },
      {
        id: 3,
        entryDate: '2026-05-01',
        amountUsd: 300,
        source: 'Other',
        note: '',
        createdAt: '2026-05-01T08:05:00Z',
      },
      {
        id: 4,
        entryDate: '2026-05-03',
        amountUsd: 1700,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-03T08:00:00Z',
      },
      {
        id: 5,
        entryDate: '2026-05-03',
        amountUsd: 250,
        source: 'Other',
        note: '',
        createdAt: '2026-05-03T08:05:00Z',
      },
      {
        id: 6,
        entryDate: '2026-05-08',
        amountUsd: 1500,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-08T08:00:00Z',
      },
    ]

    const goals: GoalSettings = {
      year: 2026,
      annualTargetUsd: 2500,
      monthlyTargetUsd: 1000,
    }

    const summary = buildPortfolioSummary(entries, goals, '2026-05')

    expect(summary.latestValue).toBe(1500)
    expect(summary.highestValueDay?.date).toBe('2026-05-03')
    expect(summary.highestValueDay?.amountUsd).toBe(1950)
    expect(summary.lowestValueDay?.date).toBe('2026-05-08')
    expect(summary.monthChange).toBe(-100)
    expect(summary.monthlyTotal).toBe(5050)
    expect(summary.monthlyTargetProgress).toBeCloseTo(-0.1)
    expect(summary.targetProgress).toBeCloseTo(0.6)
    expect(summary.calendarDays.find((day) => day.date === '2026-05-01')?.amountUsd).toBe(1600)
    expect(summary.calendarDays.find((day) => day.date === '2026-05-03')?.entryCount).toBe(2)
    expect(summary.sourceBreakdown).toEqual([
      { source: 'Longbridge', amountUsd: 1500 },
    ])
  })

  it('uses the first record in the month as fallback profit baseline when no prior month value exists', () => {
    const entries: ProfitEntry[] = [
      {
        id: 1,
        entryDate: '2026-05-11',
        amountUsd: 5811,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-11T08:00:00Z',
      },
      {
        id: 2,
        entryDate: '2026-05-12',
        amountUsd: 5710,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-12T08:00:00Z',
      },
      {
        id: 3,
        entryDate: '2026-05-13',
        amountUsd: 5814,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-13T08:00:00Z',
      },
      {
        id: 4,
        entryDate: '2026-05-14',
        amountUsd: 5832,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-14T08:00:00Z',
      },
    ]

    const goals: GoalSettings = {
      year: 2026,
      annualTargetUsd: 50000,
      monthlyTargetUsd: 1000,
    }

    const summary = buildPortfolioSummary(entries, goals, '2026-05')

    expect(summary.monthChange).toBe(21)
    expect(summary.monthlyTargetProgress).toBeCloseTo(0.021)
  })

  it('uses the first record inside the month as the explicit monthly profit baseline', () => {
    const entries: ProfitEntry[] = [
      {
        id: 1,
        entryDate: '2026-04-30',
        amountUsd: 1200,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-04-30T08:00:00Z',
      },
      {
        id: 2,
        entryDate: '2026-05-01',
        amountUsd: 5400,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-01T08:00:00Z',
      },
      {
        id: 3,
        entryDate: '2026-05-14',
        amountUsd: 5832,
        source: 'Longbridge',
        note: '',
        createdAt: '2026-05-14T08:00:00Z',
      },
    ]

    const goals: GoalSettings = {
      year: 2026,
      annualTargetUsd: 50000,
      monthlyTargetUsd: 1000,
    }

    const summary = buildPortfolioSummary(entries, goals, '2026-05')

    expect(summary.monthChange).toBe(432)
    expect(summary.monthlyTargetProgress).toBeCloseTo(0.432)
  })

  it('marks weekends and NYSE holidays as market closed states', () => {
    const goals: GoalSettings = {
      year: 2026,
      annualTargetUsd: 2500,
      monthlyTargetUsd: 1000,
    }

    const summary = buildPortfolioSummary([], goals, '2026-05')
    const weekend = summary.calendarDays.find((day) => day.date === '2026-05-03')
    const memorialDay = summary.calendarDays.find((day) => day.date === '2026-05-25')
    const tradingDay = summary.calendarDays.find((day) => day.date === '2026-05-04')

    expect(weekend?.marketState).toBe('weekend')
    expect(weekend?.closedLabel).toBe('周末休市')
    expect(memorialDay?.marketState).toBe('holiday')
    expect(memorialDay?.closedLabel).toBe('阵亡将士纪念日')
    expect(tradingDay?.marketState).toBe('open')
  })
})

describe('buildPortfolioTimeline', () => {
  const entries: ProfitEntry[] = [
    {
      id: 1,
      entryDate: '2025-05-31',
      amountUsd: 700,
      source: 'Longbridge',
      note: '',
      createdAt: '2025-05-31T08:00:00Z',
    },
    {
      id: 2,
      entryDate: '2025-11-20',
      amountUsd: 900,
      source: 'Longbridge',
      note: '',
      createdAt: '2025-11-20T08:00:00Z',
    },
    {
      id: 3,
      entryDate: '2026-04-28',
      amountUsd: 1200,
      source: 'Longbridge',
      note: '',
      createdAt: '2026-04-28T08:00:00Z',
    },
    {
      id: 4,
      entryDate: '2026-05-05',
      amountUsd: 1300,
      source: 'Longbridge',
      note: '',
      createdAt: '2026-05-05T08:00:00Z',
    },
    {
      id: 5,
      entryDate: '2026-05-10',
      amountUsd: 1400,
      source: 'Longbridge',
      note: '',
      createdAt: '2026-05-10T08:00:00Z',
    },
  ]

  it('returns 1W timeline points within the trailing week window', () => {
    const timeline = buildPortfolioTimeline(entries, '1W', '2026-05-15')

    expect(timeline.startDate).toBe('2026-05-11')
    expect(timeline.endDate).toBe('2026-05-17')
    expect(timeline.points.map((point) => point.date)).toEqual([])
    expect(timeline.changeAmount).toBe(0)
  })

  it('returns 1Y timeline points across year boundaries', () => {
    const timeline = buildPortfolioTimeline(entries, '1Y', '2026-05-15')

    expect(timeline.points.map((point) => point.date)).toEqual([
      '2025-05-31',
      '2025-11-20',
      '2026-04-28',
      '2026-05-05',
      '2026-05-10',
    ])
    expect(timeline.changeAmount).toBe(700)
    expect(timeline.changePercent).toBeCloseTo(1)
  })

  it('caps the current month timeline at the current day instead of month end', () => {
    const timeline = buildPortfolioTimeline(
      [
        ...entries,
        {
          id: 6,
          entryDate: '2026-05-25',
          amountUsd: 1900,
          source: 'Longbridge',
          note: '',
          createdAt: '2026-05-25T08:00:00Z',
        },
      ],
      '1M',
      '2026-05-15',
    )

    expect(timeline.endDate).toBe('2026-05-15')
    expect(timeline.points.some((point) => point.date === '2026-05-25')).toBe(false)
  })
})

describe('buildPortfolioTargetProgress', () => {
  it('computes holdings target progress from current value', () => {
    const progress = buildPortfolioTargetProgress(12500, 50000)

    expect(progress.targetUsd).toBe(50000)
    expect(progress.currentUsd).toBe(12500)
    expect(progress.progress).toBe(0.25)
  })
})
