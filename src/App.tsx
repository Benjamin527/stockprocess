import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import {
  ArrowDown,
  BatteryCharging,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Grid2X2,
  History,
  PencilLine,
  Plus,
  Power,
  Save,
  Settings,
  Star,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { buildTeslaProgress } from './lib/calendar.js'
import type { MonthlySummary } from './lib/calendar'
import type { GoalSettings, ProfitEntry } from './lib/types'
import './App.css'

type SummaryResponse = {
  goals: GoalSettings
  summary: MonthlySummary
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

type ActiveView = 'dashboard' | 'goals'

const weekdayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
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

function formatSignedCurrency(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatCurrency(value)}`
}

function formatCompactSignedCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return '--'
  }

  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  const suffix = absolute >= 1000 ? 'k' : ''
  const displayValue = absolute >= 1000 ? absolute / 1000 : absolute
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: absolute >= 1000 ? 1 : 0,
    maximumFractionDigits: absolute >= 1000 ? 1 : 2,
  }).format(displayValue)

  return `${sign}$${formatted}${suffix}`
}

function formatCalendarAmount(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(absolute)
  return `${sign}${formatted}`
}

function formatClosedTag(label: string | null) {
  if (!label) {
    return null
  }
  return label.includes('周末') ? '周末' : '休市'
}

function emptyDraft(date: string): EditableEntry {
  return {
    entryDate: date,
    amountUsd: '',
    source: sourceOptions[0].value,
    note: '',
  }
}

function getSourceLabel(source: string) {
  return sourceOptions.find((option) => option.value === source)?.label ?? source
}

function App() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'))
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayEntries, setDayEntries] = useState<EditableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')
  const [goalDraft, setGoalDraft] = useState({ annualTargetUsd: '10000', monthlyTargetUsd: '1000' })

  async function loadSummary(month: string) {
    setLoading(true)
    const response = await fetch(`/api/summary?month=${month}`)
    const data = (await response.json()) as SummaryResponse
    setSummaryData(data)
    setGoalDraft({
      annualTargetUsd: String(data.goals.annualTargetUsd),
      monthlyTargetUsd: String(data.goals.monthlyTargetUsd),
    })
    setLoading(false)
  }

  async function loadDay(date: string) {
    const response = await fetch(`/api/day/${date}`)
    const data = (await response.json()) as DayResponse
    setDayEntries(
      data.entries.length > 0
        ? data.entries.map((entry) => ({
            id: entry.id,
            entryDate: entry.entryDate,
            amountUsd: String(entry.amountUsd),
            source: entry.source,
            note: entry.note,
          }))
        : [emptyDraft(date)],
    )
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      const response = await fetch(`/api/summary?month=${selectedMonth}`)
      const data = (await response.json()) as SummaryResponse

      if (cancelled) {
        return
      }

      setSummaryData(data)
      setGoalDraft({
        annualTargetUsd: String(data.goals.annualTargetUsd),
        monthlyTargetUsd: String(data.goals.monthlyTargetUsd),
      })
      setLoading(false)
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
      const response = await fetch(`/api/day/${currentDate}`)
      const data = (await response.json()) as DayResponse

      if (cancelled) {
        return
      }

      setDayEntries(
        data.entries.length > 0
          ? data.entries.map((entry) => ({
              id: entry.id,
              entryDate: entry.entryDate,
              amountUsd: String(entry.amountUsd),
              source: entry.source,
              note: entry.note,
            }))
          : [emptyDraft(currentDate)],
      )
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [selectedDate])

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

  const summary = summaryData?.summary
  const teslaProgress = buildTeslaProgress(summary?.yearTotal ?? 0)
  const teslaPercent = Math.max(teslaProgress.progress, 0) * 100
  const boundedTeslaPercent = Math.max(0, Math.min(teslaProgress.progress, 1)) * 100

  async function refreshCurrentView(dateToReload?: string | null) {
    await loadSummary(selectedMonth)
    if (dateToReload) {
      await loadDay(dateToReload)
    }
  }

  async function saveGoals() {
    setSaving(true)
    await fetch(`/api/goals/${selectedMonth.slice(0, 4)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        annualTargetUsd: Number(goalDraft.annualTargetUsd),
        monthlyTargetUsd: Number(goalDraft.monthlyTargetUsd),
      }),
    })
    await refreshCurrentView(selectedDate)
    setSaving(false)
  }

  async function saveEntry(entry: EditableEntry) {
    setSaving(true)
    const payload = {
      entryDate: entry.entryDate,
      amountUsd: Number(entry.amountUsd),
      source: entry.source,
      note: entry.note,
    }

    if (entry.id) {
      await fetch(`/api/entries/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    await refreshCurrentView(entry.entryDate)
    setSaving(false)
  }

  async function deleteEntry(id: number, date: string) {
    setSaving(true)
    await fetch(`/api/entries/${id}`, { method: 'DELETE' })
    await refreshCurrentView(date)
    setSaving(false)
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <Gauge size={22} />
          <h1>Alpha Monitor</h1>
        </div>
        <div className="top-actions">
          <Bell size={20} />
          <span className="avatar-dot" />
        </div>
      </header>

      <div className="app-frame">
        {activeView === 'dashboard' ? (
          <>
            <section className="tesla-top-band">
              <div className="panel tesla-panel tesla-panel-top">
                <div className="tesla-status-row">
                  <div className="tesla-status-title">
                    <BatteryCharging size={20} />
                    <span>TSLA TARGET STATUS</span>
                  </div>
                  <strong>{teslaPercent.toFixed(1).replace('.0', '')}%</strong>
                </div>
                <div className="tesla-visual">
                  <span className="tesla-halo" />
                  <img
                    src="/tesla-model-3-stealth.png"
                    alt="Tesla Model 3"
                    className="tesla-car-mark"
                  />
                  <p className="tesla-meta">距离目标还差 {formatCurrency(Math.max(0, teslaProgress.targetUsd - teslaProgress.currentUsd))}</p>
                </div>
                <div className="tesla-progress-bar">
                  <span
                    className="tesla-progress-fill"
                    style={{ width: `${boundedTeslaPercent}%` }}
                  />
                </div>
                <div className="tesla-progress-range">
                  <span>$0.00</span>
                  <span>{formatCurrency(teslaProgress.targetUsd)}</span>
                </div>
              </div>
            </section>

            <section className="dashboard-stack">
              <div className="stat-grid">
                <StatBadge icon={<Power size={22} />} label="本年" tone="gain" value={summary ? formatCompactSignedCurrency(summary.yearTotal) : '--'} />
                <StatBadge icon={<CalendarDays size={22} />} label="本月" tone="loss" value={summary ? formatCompactSignedCurrency(summary.monthTotal) : '--'} />
                <StatBadge icon={<Star size={22} />} label="最佳" tone="loss" value={summary?.bestDay ? formatCompactSignedCurrency(summary.bestDay.amountUsd) : '--'} />
                <StatBadge icon={<ArrowDown size={22} />} label="最低" tone="danger" value={summary?.worstDay ? formatCompactSignedCurrency(summary.worstDay.amountUsd) : '--'} />
              </div>

              <div className="panel panel-calendar app-panel">
            <div className="panel-header app-panel-header">
              <div>
                <h2>收益日历 (USD)</h2>
              </div>
              <span className="calendar-month-label">{dayjs(`${selectedMonth}-01`).format('MMM YYYY')}</span>
              <div className="month-controls">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setSelectedMonth(dayjs(`${selectedMonth}-01`).subtract(1, 'month').format('YYYY-MM'))}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setSelectedMonth(dayjs(`${selectedMonth}-01`).add(1, 'month').format('YYYY-MM'))}
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

                  const tone =
                    day.entryCount === 0
                      ? day.marketState === 'holiday'
                        ? 'holiday'
                        : day.marketState === 'weekend'
                          ? 'weekend'
                          : 'empty'
                      : day.amountUsd > 100
                        ? 'strong-profit'
                        : day.amountUsd > 0
                          ? 'profit'
                          : day.amountUsd < -100
                            ? 'strong-loss'
                            : day.amountUsd < 0
                              ? 'loss'
                              : 'neutral'

                  return (
                    <button
                      key={day.date}
                      type="button"
                      className={`calendar-cell ${tone} ${selectedDate === day.date ? 'selected' : ''}`}
                      onClick={() => setSelectedDate(day.date)}
                      title={day.closedLabel ?? day.date}
                    >
                      <span className="day-number">{String(day.dayOfMonth).padStart(2, '0')}</span>
                      {day.entryCount > 0 ? <div className="calendar-value">{formatCalendarAmount(day.amountUsd)}</div> : null}
                      {day.entryCount === 0 && day.closedLabel ? <span className="empty-copy">{formatClosedTag(day.closedLabel)}</span> : null}
                    </button>
                  )
                }),
              )}
            </div>

            <div className="calendar-legend">
              <span><i className="legend-dot gain" />Gains</span>
              <span><i className="legend-dot loss" />Losses</span>
              <span><i className="legend-dot flat" />Intermediate</span>
            </div>
          </div>

          <div className="panel side-panel app-panel">
            <div className="panel-header compact app-panel-header">
              <div>
                <p className="section-label">最近记录</p>
                <h2>本月最新</h2>
              </div>
            </div>
            <div className="recent-list">
              {summaryData?.recentEntries.map((entry) => (
                <div key={entry.id} className="recent-row">
                  <div>
                    <strong>{dayjs(entry.entryDate).format('M月D日')}</strong>
                    <span>{getSourceLabel(entry.source)}</span>
                  </div>
                  <strong className={entry.amountUsd >= 0 ? 'profit-text' : 'loss-text'}>
                    {formatSignedCurrency(entry.amountUsd)}
                  </strong>
                </div>
              ))}
              {summaryData?.recentEntries.length === 0 ? <p className="empty-state">这个月还没有记录。</p> : null}
            </div>
          </div>
            </section>
          </>
        ) : (
          <section className="dashboard-stack goals-view">
            <div className="goals-page-title">
              <p className="section-label">Target Configuration</p>
              <h2>收益目标</h2>
            </div>

            <div className="panel side-panel app-panel">
              <div className="panel-header compact app-panel-header">
                <div>
                  <p className="section-label">目标配置</p>
                  <h2>进度设置</h2>
                </div>
                <button type="button" className="primary-save-button" onClick={saveGoals} disabled={saving}>
                  <Save size={18} />
                  <span>保存修改</span>
                </button>
              </div>
              <div className="goal-stack">
                <ProgressCard
                  label="年度目标"
                  progress={summary?.yearProgress ?? 0}
                  currentValue={summary?.yearTotal ?? 0}
                  inputValue={goalDraft.annualTargetUsd}
                  onChange={(value) => setGoalDraft((current) => ({ ...current, annualTargetUsd: value }))}
                />
                <ProgressCard
                  label="月度目标"
                  progress={summary?.monthProgress ?? 0}
                  currentValue={summary?.monthTotal ?? 0}
                  inputValue={goalDraft.monthlyTargetUsd}
                  onChange={(value) => setGoalDraft((current) => ({ ...current, monthlyTargetUsd: value }))}
                />
              </div>
            </div>

            <div className="panel side-panel app-panel">
              <div className="panel-header compact app-panel-header">
                <div>
                  <p className="section-label">来源分布</p>
                  <h2>本月贡献</h2>
                </div>
              </div>
              <div className="source-list">
                {summary?.sourceBreakdown.map((item) => (
                  <div key={item.source} className="source-row">
                    <span className="source-name"><Wallet size={16} />{getSourceLabel(item.source)}</span>
                    <strong className={item.amountUsd >= 0 ? 'profit-text' : 'loss-text'}>
                      {formatSignedCurrency(item.amountUsd)}
                    </strong>
                  </div>
                ))}
                {summary?.sourceBreakdown.length === 0 ? <p className="empty-state">本月还没有记录。</p> : null}
              </div>
            </div>

            <div className="panel side-panel app-panel">
              <div className="panel-header compact app-panel-header">
                <div>
                  <p className="section-label">最近记录</p>
                  <h2>本月最新</h2>
                </div>
              </div>
              <div className="recent-list">
                {summaryData?.recentEntries.map((entry) => (
                  <div key={entry.id} className="recent-row">
                    <div>
                      <strong>{dayjs(entry.entryDate).format('M月D日')}</strong>
                      <span>{getSourceLabel(entry.source)}</span>
                    </div>
                    <strong className={entry.amountUsd >= 0 ? 'profit-text' : 'loss-text'}>
                      {formatSignedCurrency(entry.amountUsd)}
                    </strong>
                  </div>
                ))}
                {summaryData?.recentEntries.length === 0 ? <p className="empty-state">这个月还没有记录。</p> : null}
              </div>
            </div>
          </section>
        )}
      </div>

      <aside className={`drawer ${selectedDate ? 'open' : ''}`}>
        <div className="drawer-header">
          <div>
            <p className="section-label">当日编辑</p>
            <h2>{selectedDate ? dayjs(selectedDate).format('YYYY年M月D日') : '选择日期'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setSelectedDate(null)}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {selectedDate ? (
            <>
              {dayEntries.map((entry, index) => (
                <div key={entry.id ?? `draft-${index}`} className="entry-card">
                  <div className="entry-card-header">
                    <PencilLine size={16} />
                    <span>{entry.id ? `记录 #${entry.id}` : '新建记录'}</span>
                  </div>
                  <label>
                    <span>收益金额（USD）</span>
                    <input
                      value={entry.amountUsd}
                      onChange={(event) => {
                        const value = event.target.value
                        setDayEntries((current) =>
                          current.map((item, itemIndex) => (itemIndex === index ? { ...item, amountUsd: value } : item)),
                        )
                      }}
                      placeholder="例如 +30 或 -40"
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
            <p className="empty-state">点击日历中的某一天，直接编辑当天收益。</p>
          )}
        </div>
      </aside>

      <nav className="bottom-nav">
        <button
          type="button"
          className={`bottom-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveView('dashboard')}
        >
          <Grid2X2 size={23} />
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item ${activeView === 'goals' ? 'active' : ''}`}
          onClick={() => setActiveView('goals')}
        >
          <Power size={23} />
          <span>Goals</span>
        </button>
        <button type="button" className="bottom-nav-item muted" aria-disabled="true">
          <History size={23} />
          <span>History</span>
        </button>
        <button type="button" className="bottom-nav-item muted" aria-disabled="true">
          <Settings size={23} />
          <span>Settings</span>
        </button>
      </nav>

      {loading ? <div className="loading-scrim">正在加载收益日历...</div> : null}
    </main>
  )
}

function StatBadge({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  tone: 'gain' | 'loss' | 'danger'
  value: string
}) {
  return (
    <div className={`stat-badge ${tone}`}>
      <div>
        <span className="stat-badge-label">{label}</span>
        <strong className="stat-badge-value">{value}</strong>
      </div>
      <span className="stat-badge-icon">{icon}</span>
    </div>
  )
}

function ProgressCard({
  label,
  progress,
  currentValue,
  inputValue,
  onChange,
}: {
  label: string
  progress: number
  currentValue: number
  inputValue: string
  onChange: (value: string) => void
}) {
  const boundedProgress = Math.max(Math.min(progress, 1), 0)

  return (
    <div className="progress-card">
      <div className="progress-copy">
        <div>
          <span>{label}</span>
          <strong>{formatSignedCurrency(currentValue)}</strong>
        </div>
        <span>{Math.round(boundedProgress * 100)}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${boundedProgress * 100}%` }} />
      </div>
      <label className="goal-input">
        <span>目标值 (USD)</span>
        <input value={inputValue} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  )
}

export default App
