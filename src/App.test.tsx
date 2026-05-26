// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    averageDailyProfit: 216,
    averageDailyTargetProgress: 4.32,
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
    window.localStorage.clear()
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

  it('switches between dashboard and goals tabs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(summaryResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<App />)

    expect(await screen.findByText('持仓轨迹')).toBeInTheDocument()
    expect(screen.queryByText('计算规则')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Goals' }))

    expect(await screen.findByText('计算规则')).toBeInTheDocument()
    expect(screen.getByText('最新持仓分布')).toBeInTheDocument()
    expect(screen.getByText('最近记录')).toBeInTheDocument()
    expect(screen.queryByText('持仓轨迹')).not.toBeInTheDocument()
  })

  it('shows the point price when hovering the chart point', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(summaryResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<App />)

    const chartInteractionLayer = await screen.findByLabelText('持仓金额变化曲线交互区')
    Object.defineProperty(chartInteractionLayer, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: 640,
        height: 320,
        right: 640,
        bottom: 320,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })
    fireEvent.pointerMove(chartInteractionLayer, { clientX: 400 })

    const tooltip = await screen.findByLabelText('Chart point details')
    expect(within(tooltip).getByText('$5,832.00')).toBeInTheDocument()
    expect(within(tooltip).getByText('2026-05-14')).toBeInTheDocument()
  })

  it('restores the selected tab and range from local storage on reload', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(summaryResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const view = render(<App />)

    await screen.findByText('持仓轨迹')
    fireEvent.click(screen.getByRole('button', { name: '6M' }))
    fireEvent.click(screen.getByRole('button', { name: 'Goals' }))

    expect(window.localStorage.getItem('profit-calendar:active-tab')).toBe('goals')
    expect(window.localStorage.getItem('profit-calendar:selected-range')).toBe('6M')

    view.unmount()

    render(<App />)

    expect(await screen.findByText('计算规则')).toBeInTheDocument()
    expect(screen.queryByText('持仓轨迹')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(await screen.findByRole('button', { name: '6M' })).toHaveClass('active')
  })

  it('shows a dedicated goals summary panel with annual and monthly progress', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(summaryResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Goals' }))

    expect(await screen.findByText('目标总览')).toBeInTheDocument()
    expect(screen.getByText('年度进度')).toBeInTheDocument()
    expect(screen.getByText('月度达成')).toBeInTheDocument()
    expect(screen.getByText('日均达成')).toBeInTheDocument()
    expect(screen.getByText('$216.00 / $50.00')).toBeInTheDocument()
  })

  it('shows the daily objective as a standalone mission card on the dashboard', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(summaryResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<App />)

    expect(await screen.findByText('Daily Objective')).toBeInTheDocument()
    expect(screen.getByText('日均目标进度')).toBeInTheDocument()
    expect(screen.getAllByText('+432.00%').length).toBeGreaterThan(0)
  })

  it('syncs the chart header with the active hovered point', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(summaryResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<App />)

    const chartInteractionLayer = await screen.findByLabelText('持仓金额变化曲线交互区')
    Object.defineProperty(chartInteractionLayer, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: 640,
        height: 320,
        right: 640,
        bottom: 320,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })

    fireEvent.pointerMove(chartInteractionLayer, { clientX: 400 })

    expect(await screen.findByText('Point Readout')).toBeInTheDocument()
    const readout = screen.getByLabelText('Chart readout')
    expect(within(readout).getByText('2026-05-14')).toBeInTheDocument()
    expect(within(readout).getByText('$5,832.00')).toBeInTheDocument()
  })

  it('clears the hovered chart point after leaving the chart', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(summaryResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<App />)

    const chartInteractionLayer = await screen.findByLabelText('持仓金额变化曲线交互区')
    Object.defineProperty(chartInteractionLayer, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: 640,
        height: 320,
        right: 640,
        bottom: 320,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })

    fireEvent.pointerMove(chartInteractionLayer, { clientX: 400 })
    expect(await screen.findByLabelText('Chart point details')).toBeInTheDocument()

    fireEvent.pointerLeave(chartInteractionLayer)

    await waitFor(() => {
      expect(screen.queryByLabelText('Chart point details')).not.toBeInTheDocument()
    })
  })
})
