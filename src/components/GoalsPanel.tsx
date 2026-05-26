import dayjs from 'dayjs'

import type { MonthlySummary } from '../lib/calendar'
import type { GoalSettings, TeslaProgress, ProfitEntry } from '../lib/types'

type GoalsPanelProps = {
  activeRecordDays: number
  goals: GoalSettings | null
  latestRecordDate: string | null
  recentEntries: ProfitEntry[]
  summary: MonthlySummary | null
  teslaProgress: TeslaProgress
  formatCurrency: (value: number) => string
  formatPercent: (value: number) => string
  getSourceLabel: (source: string) => string
}

export function GoalsPanel({
  activeRecordDays,
  goals,
  latestRecordDate,
  recentEntries,
  summary,
  teslaProgress,
  formatCurrency,
  formatPercent,
  getSourceLabel,
}: GoalsPanelProps) {
  return (
    <section className="goals-grid">
      <div className="section-panel goals-summary-panel">
        <div className="panel-header compact">
          <div>
            <p className="section-label">Goals Overview</p>
            <h3>目标总览</h3>
          </div>
        </div>
        <div className="goals-summary-grid">
          <div className="goal-summary-card">
            <span className="goal-summary-label">年度进度</span>
            <strong>{Math.round(Math.max(0, teslaProgress.progress) * 100)}%</strong>
            <span className="goal-summary-detail">
              {formatCurrency(teslaProgress.currentUsd)} / {formatCurrency(teslaProgress.targetUsd)}
            </span>
          </div>
          <div className="goal-summary-card">
            <span className="goal-summary-label">月度达成</span>
            <strong>{formatPercent(summary?.monthlyTargetProgress ?? 0)}</strong>
            <span className="goal-summary-detail">
              {formatCurrency(summary?.monthChange ?? 0)} / {formatCurrency(goals?.monthlyTargetUsd ?? 1000)}
            </span>
          </div>
          <div className="goal-summary-card">
            <span className="goal-summary-label">日均达成</span>
            <strong>{formatPercent(summary?.averageDailyTargetProgress ?? 0)}</strong>
            <span className="goal-summary-detail">
              {formatCurrency(summary?.averageDailyProfit ?? 0)} / {formatCurrency(50)}
            </span>
          </div>
          <div className="goal-summary-card">
            <span className="goal-summary-label">最新记录日</span>
            <strong>{latestRecordDate ? dayjs(latestRecordDate).format('M月D日') : '--'}</strong>
            <span className="goal-summary-detail">{activeRecordDays} 个记录日</span>
          </div>
        </div>
      </div>

      <div className="section-panel side-panel">
        <div className="brief-block">
          <div className="panel-header compact">
            <div>
              <p className="section-label">Mission Rules</p>
              <h3>计算规则</h3>
            </div>
          </div>
          <p className="brief-copy">本月盈利按“本月最后一条持仓减去本月第一条持仓”计算。日均目标按这个差值除以当月实际录入天数，并以 50 USD 作为目标基线。</p>
        </div>
      </div>

      <div className="section-panel side-panel">
        <div className="brief-block">
          <div className="panel-header compact">
            <div>
              <p className="section-label">Composition</p>
              <h3>最新持仓分布</h3>
            </div>
          </div>
          <div className="source-list">
            {summary?.sourceBreakdown.map((item) => (
              <div key={item.source} className="source-row">
                <span>{getSourceLabel(item.source)}</span>
                <strong>{formatCurrency(item.amountUsd)}</strong>
              </div>
            ))}
            {summary?.sourceBreakdown.length === 0 ? <p className="empty-state">还没有可展示的持仓分布。</p> : null}
          </div>
        </div>
      </div>

      <div className="section-panel side-panel">
        <div className="brief-block">
          <div className="panel-header compact">
            <div>
              <p className="section-label">Recent Logs</p>
              <h3>最近记录</h3>
            </div>
          </div>
          <div className="recent-list">
            {recentEntries.map((entry) => (
              <div key={entry.id} className="recent-row">
                <div>
                  <strong>{dayjs(entry.entryDate).format('M月D日')}</strong>
                  <span>{getSourceLabel(entry.source)}</span>
                </div>
                <strong>{formatCurrency(entry.amountUsd)}</strong>
              </div>
            ))}
            {recentEntries.length === 0 ? <p className="empty-state">这个月还没有记录。</p> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
