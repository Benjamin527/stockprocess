import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  Plus,
  Save,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { BottomTabs } from './components/BottomTabs.js'
import { GoalsPanel } from './components/GoalsPanel.js'
import { PortfolioChart } from './components/PortfolioChart.js'
import { requestJson, requestVoid } from './lib/api.js'
import { buildTeslaProgress } from './lib/calendar.js'
import type { MonthlySummary, TimelineSummary } from './lib/calendar'
import type { GoalSettings, ProfitEntry, RangeKey } from './lib/types'
import './App.css'

type SummaryResponse = {
  goals: GoalSettings
  summary: MonthlySummary
  timeline: Record<RangeKey, TimelineSummary>
  recentEntries: ProfitEntry[]
}

type DayResponse = {
  entries: ProfitEntry[]
}

type EditableEntry = {
  id?: number
  entryDate: string
  amountUsd: string
  source: string
  note: string
}

type ViewTab = 'dashboard' | 'goals'

const weekdayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const rangeOptions: RangeKey[] = ['1W', '1M', '6M', '1Y']
const STORAGE_KEYS = {
  activeTab: 'profit-calendar:active-tab',
  selectedMonth: 'profit-calendar:selected-month',
  selectedRange: 'profit-calendar:selected-range',
} as const
const sourceOptions = [
  { value: 'Longbridge', label: '长桥' },
  { value: 'Other', label: '其他' },
]

dayjs.locale('zh-cn')

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDelta(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatCurrency(Math.abs(value))}`
}

function formatCompactCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return '--'
  }

  const absolute = Math.abs(value)
  const suffix = absolute >= 1000 ? 'k' : ''
  const displayValue = absolute >= 1000 ? absolute / 1000 : absolute
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: absolute >= 1000 ? 1 : 0,
    maximumFractionDigits: absolute >= 1000 ? 1 : 2,
  }).format(displayValue)

  return `$${formatted}${suffix}`
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${Math.abs(value * 100).toFixed(2)}%`
}

function formatClosedTag(label: string | null) {
  if (!label) {
    return null
  }
  return label.includes('周末') ? '周末' : '休市'
}

function getSourceLabel(source: string) {
  return sourceOptions.find((option) => option.value === source)?.label ?? source
}

function emptyDraft(date: string): EditableEntry {
  return {
    entryDate: date,
    amountUsd: '',
    source: sourceOptions[0].value,
    note: '',
  }
}

function toEditableEntries(entries: ProfitEntry[], date: string): EditableEntry[] {
  return entries.length > 0
    ? entries.map((entry) => ({
        id: entry.id,
        entryDate: entry.entryDate,
        amountUsd: String(entry.amountUsd),
        source: entry.source,
        note: entry.note,
      }))
    : [emptyDraft(date)]
}

function buildChartPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return ''
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

function buildAreaPath(points: Array<{ x: number; y: number }>, height: number) {
  if (points.length === 0) {
    return ''
  }

  const linePath = buildChartPath(points)
  const first = points[0]
  const last = points[points.length - 1]
  return `${linePath} L ${last.x.toFixed(2)} ${height} L ${first.x.toFixed(2)} ${height} Z`
}

function getStoredValue<T extends string>(key: string, fallback: T, allowedValues?: readonly T[]) {
  if (typeof window === 'undefined') {
    return fallback
  }

  const storedValue = window.localStorage.getItem(key)
  if (!storedValue) {
    return fallback
  }

  if (allowedValues && !allowedValues.includes(storedValue as T)) {
    return fallback
  }

  return storedValue as T
}

function App() {
  const [selectedMonth, setSelectedMonth] = useState(() =>
    getStoredValue(STORAGE_KEYS.selectedMonth, dayjs().format('YYYY-MM')),
  )
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayEntries, setDayEntries] = useState<EditableEntry[]>([])
  const [selectedRange, setSelectedRange] = useState<RangeKey>(() =>
    getStoredValue(STORAGE_KEYS.selectedRange, '1M', rangeOptions),
  )
  const [targetDraft, setTargetDraft] = useState('50000')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ViewTab>(() =>
    getStoredValue(STORAGE_KEYS.activeTab, 'dashboard', ['dashboard', 'goals']),
  )

  function applySummaryData(data: SummaryResponse) {
    setSummaryData(data)
    setTargetDraft(String(data.goals.annualTargetUsd))
  }

  async function fetchSummary(month: string) {
    return requestJson<SummaryResponse>(`/api/summary?month=${month}`)
  }

  async function fetchDay(date: string) {
    return requestJson<DayResponse>(`/api/day/${date}`)
  }

  async function loadSummary(month: string) {
    setLoading(true)
    setErrorMessage(null)

    try {
      const data = await fetchSummary(month)
      applySummaryData(data)
    } catch {
      setErrorMessage('加载失败，请稍后重试。')
      throw new Error('Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  async function loadDay(date: string) {
    setErrorMessage(null)

    try {
      const data = await fetchDay(date)
      setDayEntries(toEditableEntries(data.entries, date))
    } catch {
      setErrorMessage('加载失败，请稍后重试。')
      throw new Error('Failed to load day entries')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setErrorMessage(null)

      try {
        const data = await fetchSummary(selectedMonth)

        if (cancelled) {
          return
        }

        applySummaryData(data)
      } catch {
        if (!cancelled) {
          setErrorMessage('加载失败，请稍后重试。')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [selectedMonth])

  useEffect(() => {
    if (!selectedDate) {
      return
    }

    const currentDate = selectedDate
    let cancelled = false

    async function run() {
      setErrorMessage(null)

      try {
        const data = await fetchDay(currentDate)

        if (cancelled) {
          return
        }

        setDayEntries(toEditableEntries(data.entries, currentDate))
      } catch {
        if (!cancelled) {
          setErrorMessage('加载失败，请稍后重试。')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [selectedDate])

  const summary = summaryData?.summary
  const timeline = summaryData?.timeline[selectedRange] ?? null
  const teslaProgress = buildTeslaProgress(summary?.latestValue ?? 0)
  const activeRecordDays = summary?.calendarDays.filter((day) => day.entryCount > 0).length ?? 0
  const latestRecordDate = summary?.latestValueDay?.date ?? null

  const calendarRows = useMemo(() => {
    if (!summaryData) {
      return []
    }

    const firstDay = (dayjs(`${selectedMonth}-01`).day() + 6) % 7
    const cells = [...Array(firstDay).fill(null), ...summaryData.summary.calendarDays]
    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    const rows = []
    for (let index = 0; index < cells.length; index += 7) {
      rows.push(cells.slice(index, index + 7))
    }

    return rows
  }, [selectedMonth, summaryData])

  const calendarRange = useMemo(() => {
    const values = summary?.calendarDays.filter((day) => day.entryCount > 0).map((day) => day.amountUsd) ?? []
    return {
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
    }
  }, [summary])

  const chartGeometry = useMemo(() => {
    if (!timeline || timeline.points.length === 0) {
      return null
    }

    const width = 640
    const height = 240
    const paddingX = 10
    const paddingY = 16
    const amountRange = timeline.maxValue - timeline.minValue || 1
    const rangeStart = dayjs(timeline.startDate)
    const rangeEnd = dayjs(timeline.endDate)
    const timeRange = Math.max(rangeEnd.diff(rangeStart, 'day'), 1)

    const points = timeline.points.map((point) => ({
      ...point,
      x:
        timeline.points.length === 1
          ? width / 2
          : paddingX + (dayjs(point.date).diff(rangeStart, 'day') / timeRange) * (width - paddingX * 2),
      y:
        height -
        paddingY -
        ((point.amountUsd - timeline.minValue) / amountRange) * (height - paddingY * 2),
    }))

    return {
      width,
      height,
      points,
      linePath: buildChartPath(points),
      areaPath: buildAreaPath(points, height - 4),
    }
  }, [timeline])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.activeTab, activeTab)
  }, [activeTab])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.selectedMonth, selectedMonth)
  }, [selectedMonth])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.selectedRange, selectedRange)
  }, [selectedRange])

  async function refreshCurrentView(dateToReload?: string | null) {
    await loadSummary(selectedMonth)
    if (dateToReload) {
      await loadDay(dateToReload)
    }
  }

  async function saveTarget() {
    setSaving(true)
    setErrorMessage(null)

    try {
      await requestVoid(`/api/goals/${selectedMonth.slice(0, 4)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annualTargetUsd: Number(targetDraft),
          monthlyTargetUsd: summaryData?.goals.monthlyTargetUsd ?? 1000,
        }),
      })
      await refreshCurrentView(selectedDate)
    } catch {
      setErrorMessage('保存失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  async function saveEntry(entry: EditableEntry) {
    setSaving(true)
    setErrorMessage(null)
    const payload = {
      entryDate: entry.entryDate,
      amountUsd: Number(entry.amountUsd),
      source: entry.source,
      note: entry.note,
    }

    try {
      if (entry.id) {
        await requestVoid(`/api/entries/${entry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await requestJson<{ id: number }>('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      await refreshCurrentView(entry.entryDate)
    } catch {
      setErrorMessage('保存失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(id: number, date: string) {
    setSaving(true)
    setErrorMessage(null)

    try {
      await requestVoid(`/api/entries/${id}`, { method: 'DELETE' })
      await refreshCurrentView(date)
    } catch {
      setErrorMessage('删除失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <Activity size={20} />
          <div>
            <p>Portfolio Pulse</p>
            <h1>Mission Control</h1>
          </div>
        </div>
        <div className="top-bar-meta">
          <span>{dayjs(`${selectedMonth}-01`).format('MMMM YYYY')}</span>
          <span>{activeRecordDays} Days Logged</span>
        </div>
        <button type="button" className="target-chip" onClick={saveTarget} disabled={saving}>
          <Target size={16} />
          <span>目标 {formatCompactCurrency(Number(targetDraft) || 0)}</span>
        </button>
      </header>

      {errorMessage ? <div className="status-banner">{errorMessage}</div> : null}

      <div className="app-frame">
        <section className="hero-stage">
          <div className="hero-stage-backdrop" />
          <div className="hero-stage-overlay">
            <div className="hero-stage-copy">
              <div className="hero-eyebrow-row">
                <p className="section-label">Tesla Portfolio Mission</p>
                <span className="mission-chip">{dayjs(`${selectedMonth}-01`).format('YYYY / MM')}</span>
              </div>
              <h2 className="hero-title">TESLA HOLDING MISSION CONTROL</h2>
              <div className="hero-metrics">
                <div className="hero-metric">
                  <span className="hero-metric-label">Portfolio Value</span>
                  <strong>{formatCurrency(summary?.latestValue ?? 0)}</strong>
                </div>
                <div className="hero-metric">
                  <span className="hero-metric-label">Month Delta</span>
                  <strong className={(summary?.monthChange ?? 0) >= 0 ? 'up-text' : 'down-text'}>
                    {formatDelta(summary?.monthChange ?? 0)}
                  </strong>
                </div>
                <div className="hero-metric">
                  <span className="hero-metric-label">Mission Progress</span>
                  <strong>{Math.round(Math.max(0, teslaProgress.progress) * 100)}%</strong>
                </div>
              </div>
              <div className="hero-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => latestRecordDate && setSelectedDate(latestRecordDate)}
                  disabled={!latestRecordDate}
                >
                  <CalendarDays size={16} />
                  打开最新记录
                </button>
                <span className="hero-note">
                  距离年度目标还差 {formatCurrency(Math.max(0, teslaProgress.targetUsd - teslaProgress.currentUsd))}
                </span>
              </div>
            </div>

            <div className="hero-stage-aside">
              <div className="mission-card">
                <p className="section-label">Annual Mission</p>
                <div className="mission-value-row">
                  <strong>{formatCurrency(teslaProgress.currentUsd)}</strong>
                  <span>{formatCurrency(teslaProgress.targetUsd)}</span>
                </div>
                <div className="hero-progress-bar">
                  <span
                    className="hero-progress-fill"
                    style={{ width: `${Math.max(0, Math.min(teslaProgress.progress, 1)) * 100}%` }}
                  />
                </div>
                <label className="target-editor">
                  <span>Annual Target (USD)</span>
                  <input value={targetDraft} onChange={(event) => setTargetDraft(event.target.value)} />
                </label>
              </div>

              <div className="mission-card">
                <p className="section-label">Daily Objective</p>
                <div className="mission-value-row">
                  <strong>{formatCurrency(summary?.averageDailyProfit ?? 0)}</strong>
                  <span>{formatCurrency(50)}</span>
                </div>
                <div className="hero-progress-bar">
                  <span
                    className="hero-progress-fill"
                    style={{ width: `${Math.max(0, Math.min(summary?.averageDailyTargetProgress ?? 0, 1)) * 100}%` }}
                  />
                </div>
                <div className="mission-list">
                  <div className="mission-list-row">
                    <span>日均目标进度</span>
                    <strong>{formatPercent(summary?.averageDailyTargetProgress ?? 0)}</strong>
                  </div>
                  <div className="mission-list-row">
                    <span>录入天数</span>
                    <strong>{activeRecordDays}</strong>
                  </div>
                </div>
              </div>

              <div className="mission-card mission-card-muted">
                <p className="section-label">Monthly Objective</p>
                <div className="mission-list">
                  <div className="mission-list-row">
                    <span>月度目标金额</span>
                    <strong>{formatCurrency(summaryData?.goals.monthlyTargetUsd ?? 1000)}</strong>
                  </div>
                  <div className="mission-list-row">
                    <span>当前月盈利</span>
                    <strong>{formatCurrency(summary?.monthChange ?? 0)}</strong>
                  </div>
                  <div className="mission-list-row">
                    <span>记录天数</span>
                    <strong>{activeRecordDays}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {activeTab === 'dashboard' ? (
          <>
            <section className="stat-grid" aria-label="portfolio highlights">
              <StatCard icon={<Wallet size={18} />} label="当前持仓" value={formatCompactCurrency(summary?.latestValue ?? 0)} />
              <StatCard icon={<Target size={18} />} label="月度目标" value={formatPercent(summary?.monthlyTargetProgress ?? 0)} />
              <StatCard icon={<CalendarDays size={18} />} label="日均 50 USD" value={formatPercent(summary?.averageDailyTargetProgress ?? 0)} />
              <StatCard icon={<TrendingUp size={18} />} label="本月最高" value={formatCompactCurrency(summary?.highestValueDay?.amountUsd ?? 0)} />
              <StatCard icon={<TrendingDown size={18} />} label="本月盈利" value={formatCompactCurrency(summary?.monthChange ?? 0)} />
              <StatCard icon={<CalendarDays size={18} />} label="记录天数" value={String(activeRecordDays)} />
            </section>

            <section className="content-grid dashboard-grid">
              <PortfolioChart
                chartGeometry={chartGeometry}
                selectedRange={selectedRange}
                timeline={timeline}
                onChangeRange={setSelectedRange}
                rangeOptions={rangeOptions}
                formatCurrency={formatCurrency}
                formatDelta={formatDelta}
                formatPercent={formatPercent}
              />
            </section>

            <section className="section-panel calendar-panel">
              <div className="panel-header">
                <div>
                  <p className="section-label">Launch Calendar</p>
                  <h3>持仓日历</h3>
                </div>
                <span className="calendar-month-label">{dayjs(`${selectedMonth}-01`).format('MMM YYYY')}</span>
                <div className="month-controls">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setLoading(true)
                      setSelectedMonth(dayjs(`${selectedMonth}-01`).subtract(1, 'month').format('YYYY-MM'))
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setLoading(true)
                      setSelectedMonth(dayjs(`${selectedMonth}-01`).add(1, 'month').format('YYYY-MM'))
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="weekday-row">
                {weekdayLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="calendar-grid">
                {calendarRows.flatMap((row, rowIndex) =>
                  row.map((day, columnIndex) => {
                    if (!day) {
                      return <div key={`empty-${rowIndex}-${columnIndex}`} className="calendar-blank" />
                    }

                    const ratio =
                      day.entryCount > 0 && calendarRange.max !== calendarRange.min
                        ? (day.amountUsd - calendarRange.min) / (calendarRange.max - calendarRange.min)
                        : 0
                    const tone =
                      day.entryCount === 0
                        ? day.marketState === 'holiday'
                          ? 'holiday'
                          : day.marketState === 'weekend'
                            ? 'weekend'
                            : 'empty'
                        : ratio > 0.8
                          ? 'value-5'
                          : ratio > 0.6
                            ? 'value-4'
                            : ratio > 0.35
                              ? 'value-3'
                              : ratio > 0.15
                                ? 'value-2'
                                : 'value-1'

                    return (
                      <button
                        key={day.date}
                        type="button"
                        className={`calendar-cell ${tone} ${selectedDate === day.date ? 'selected' : ''}`}
                        onClick={() => setSelectedDate(day.date)}
                        title={day.closedLabel ?? day.date}
                      >
                        <span className="day-number">{String(day.dayOfMonth).padStart(2, '0')}</span>
                        {day.entryCount > 0 ? <div className="calendar-value">{formatCompactCurrency(day.amountUsd)}</div> : null}
                        {day.entryCount === 0 && day.closedLabel ? <span className="empty-copy">{formatClosedTag(day.closedLabel)}</span> : null}
                      </button>
                    )
                  }),
                )}
              </div>

              <div className="calendar-hint">
                <span>亮度越高，代表当天记录的持仓总额越高。</span>
                <span>点击任意一天可以直接打开记录抽屉。</span>
              </div>
            </section>
          </>
        ) : (
          <GoalsPanel
            activeRecordDays={activeRecordDays}
            goals={summaryData?.goals ?? null}
            latestRecordDate={latestRecordDate}
            recentEntries={summaryData?.recentEntries ?? []}
            summary={summary ?? null}
            teslaProgress={teslaProgress}
            formatCurrency={formatCurrency}
            formatPercent={formatPercent}
            getSourceLabel={getSourceLabel}
          />
        )}
      </div>

      <BottomTabs activeTab={activeTab} onChange={setActiveTab} />

      <aside className={`drawer ${selectedDate ? 'open' : ''}`}>
        <div className="drawer-header">
          <div>
            <p className="section-label">Daily Log</p>
            <h3>{selectedDate ? dayjs(selectedDate).format('YYYY年M月D日') : '选择日期'}</h3>
          </div>
          <button type="button" className="icon-button" onClick={() => setSelectedDate(null)}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {selectedDate ? (
            <>
              <p className="drawer-tip">同一天可以录入多个账户或来源，系统会自动汇总成当天持仓总金额。</p>
              {dayEntries.map((entry, index) => (
                <div key={entry.id ?? `draft-${index}`} className="entry-card">
                  <div className="entry-card-header">
                    <PencilLine size={16} />
                    <span>{entry.id ? `记录 #${entry.id}` : '新建记录'}</span>
                  </div>
                  <label>
                    <span>持仓金额（USD）</span>
                    <input
                      value={entry.amountUsd}
                      onChange={(event) => {
                        const value = event.target.value
                        setDayEntries((current) =>
                          current.map((item, itemIndex) => (itemIndex === index ? { ...item, amountUsd: value } : item)),
                        )
                      }}
                      placeholder="例如 15230.50"
                    />
                  </label>
                  <label>
                    <span>来源</span>
                    <select
                      value={entry.source}
                      onChange={(event) => {
                        const value = event.target.value
                        setDayEntries((current) =>
                          current.map((item, itemIndex) => (itemIndex === index ? { ...item, source: value } : item)),
                        )
                      }}
                    >
                      {sourceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>备注</span>
                    <textarea
                      value={entry.note}
                      onChange={(event) => {
                        const value = event.target.value
                        setDayEntries((current) =>
                          current.map((item, itemIndex) => (itemIndex === index ? { ...item, note: value } : item)),
                        )
                      }}
                      rows={3}
                      placeholder="可选备注"
                    />
                  </label>
                  <div className="entry-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => saveEntry(entry)}
                      disabled={saving || entry.amountUsd.trim() === ''}
                    >
                      <Save size={16} />
                      保存
                    </button>
                    {entry.id ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => deleteEntry(entry.id!, entry.entryDate)}
                        disabled={saving}
                      >
                        <Trash2 size={16} />
                        删除
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="add-entry-button"
                onClick={() => setDayEntries((current) => [...current, emptyDraft(selectedDate)])}
              >
                <Plus size={16} />
                新增一条来源记录
              </button>
            </>
          ) : (
            <p className="empty-state">点击日历中的某一天，直接编辑当天持仓。</p>
          )}
        </div>
      </aside>

      {loading ? <div className="loading-scrim">正在加载持仓面板...</div> : null}
    </main>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="stat-card">
      <span className="stat-card-icon">{icon}</span>
      <span className="stat-card-label">{label}</span>
      <strong className="stat-card-value">{value}</strong>
    </div>
  )
}

export default App
