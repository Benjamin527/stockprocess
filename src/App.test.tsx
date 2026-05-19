// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

const summaryResponse = {
  goals: {
    year: 2026,
    annualTargetUsd: 50000,
    monthlyTargetUsd: 1000,
  },
  summary: {
    monthKey: '2026-05',
    latestValue: 5832,
    monthChange: 432,
    targetProgress: 0.11664,
    monthlyTotal: 28567,
    monthlyTargetProgress: 0.432,
    calendarDays: [
      {
        date: '2026-05-01',
        dayOfMonth: 1,
        amountUsd: 5400,
        entryCount: 1,
        isCurrentMonth: true,
        marketState: 'open',
        closedLabel: null,
      },
    ],
    highestValueDay: { date: '2026-05-14', amountUsd: 5832 },
    lowestValueDay: { date: '2026-05-01', amountUsd: 5400 },
    latestValueDay: { date: '2026-05-14', amountUsd: 5832 },
    sourceBreakdown: [{ source: 'Longbridge', amountUsd: 5832 }],
  },
  timeline: {
    '1W': {
      range: '1W',
      startDate: '2026-05-11',
      endDate: '2026-05-17',
      points: [],
      minValue: 0,
      maxValue: 0,
      latestValue: 0,
      changeAmount: 0,
      changePercent: 0,
    },
    '1M': {
      range: '1M',
      startDate: '2026-04-15',
      endDate: '2026-05-14',
      points: [{ date: '2026-05-14', amountUsd: 5832 }],
      minValue: 5832,
      maxValue: 5832,
      latestValue: 5832,
      changeAmount: 0,
      changePercent: 0,
    },
    '6M': {
      range: '6M',
      startDate: '2025-11-15',
      endDate: '2026-05-14',
      points: [{ date: '2026-05-14', amountUsd: 5832 }],
      minValue: 5832,
      maxValue: 5832,
      latestValue: 5832,
      changeAmount: 0,
      changePercent: 0,
    },
    '1Y': {
      range: '1Y',
      startDate: '2025-05-15',
      endDate: '2026-05-14',
      points: [{ date: '2026-05-14', amountUsd: 5832 }],
      minValue: 5832,
      maxValue: 5832,
      latestValue: 5832,
      changeAmount: 0,
      changePercent: 0,
    },
  },
  recentEntries: [],
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows an error message and clears the loading state when the initial summary request fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'))

    render(<App />)

    expect(screen.getByText('正在加载持仓面板...')).toBeInTheDocument()

    expect(await screen.findByText('加载失败，请稍后重试。')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('正在加载持仓面板...')).not.toBeInTheDocument()
    })
  })

  it('re-enables the save button and shows an error message when saving the target fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(summaryResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'save failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    render(<App />)

    const saveButton = await screen.findByRole('button', { name: /目标 \$50\.0k/i })
    expect(saveButton).toBeEnabled()

    fireEvent.click(saveButton)

    await screen.findByText('保存失败，请稍后重试。')
    await waitFor(() => {
      expect(saveButton).toBeEnabled()
    })
  })
})
