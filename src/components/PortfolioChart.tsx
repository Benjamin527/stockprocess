import { useEffect, useRef, useState } from 'react'

import type { TimelineSummary } from '../lib/calendar'
import type { RangeKey } from '../lib/types'

type ChartPoint = {
  date: string
  amountUsd: number
  x: number
  y: number
}

type ChartGeometry = {
  width: number
  height: number
  points: ChartPoint[]
  linePath: string
  areaPath: string
}

type PortfolioChartProps = {
  chartGeometry: ChartGeometry | null
  selectedRange: RangeKey
  timeline: TimelineSummary | null
  onChangeRange: (range: RangeKey) => void
  rangeOptions: RangeKey[]
  formatCurrency: (value: number) => string
  formatDelta: (value: number) => string
  formatPercent: (value: number) => string
}

export function PortfolioChart({
  chartGeometry,
  selectedRange,
  timeline,
  onChangeRange,
  rangeOptions,
  formatCurrency,
  formatDelta,
  formatPercent,
}: PortfolioChartProps) {
  const [activeChartPointIndex, setActiveChartPointIndex] = useState<number | null>(null)
  const frameRef = useRef<number | null>(null)
  const pendingPointerRef = useRef<{ clientX: number; currentTarget: HTMLDivElement } | null>(null)

  const activeChartPoint =
    chartGeometry && activeChartPointIndex !== null ? chartGeometry.points[activeChartPointIndex] ?? null : null
  const chartReadoutPoint = activeChartPoint ?? chartGeometry?.points.at(-1) ?? null
  const activeTooltipX =
    activeChartPoint && chartGeometry
      ? Math.max(64, Math.min(chartGeometry.width - 64, activeChartPoint.x))
      : null
  const activeTooltipY =
    activeChartPoint ? Math.max(30, activeChartPoint.y - 28) : null

  useEffect(() => {
    setActiveChartPointIndex(null)
  }, [selectedRange, chartGeometry])

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  function getNearestIndex(clientX: number, currentTarget: HTMLDivElement) {
    if (!chartGeometry || chartGeometry.points.length === 0) {
      return null
    }

    if (chartGeometry.points.length === 1) {
      return 0
    }

    const rect = currentTarget.getBoundingClientRect()
    const relativeX = ((clientX - rect.left) / rect.width) * chartGeometry.width
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const [index, point] of chartGeometry.points.entries()) {
      const distance = Math.abs(point.x - relativeX)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    }

    return nearestIndex
  }

  function flushPointerFrame() {
    frameRef.current = null

    if (!pendingPointerRef.current) {
      return
    }

    const nextIndex = getNearestIndex(
      pendingPointerRef.current.clientX,
      pendingPointerRef.current.currentTarget,
    )
    pendingPointerRef.current = null

    setActiveChartPointIndex((current) => (current === nextIndex ? current : nextIndex))
  }

  function queuePointerMove(clientX: number, currentTarget: HTMLDivElement) {
    pendingPointerRef.current = { clientX, currentTarget }

    if (frameRef.current !== null) {
      return
    }

    frameRef.current = requestAnimationFrame(flushPointerFrame)
  }

  function clearHover() {
    pendingPointerRef.current = null

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    setActiveChartPointIndex(null)
  }

  return (
    <div className="section-panel chart-panel">
      <div className="panel-header">
        <div>
          <p className="section-label">Flight Path</p>
          <h3>持仓轨迹</h3>
        </div>
        <div className="chart-summary">
          <div className="chart-summary-block">
            <strong>{formatCurrency(timeline?.latestValue ?? 0)}</strong>
            <span className={(timeline?.changeAmount ?? 0) >= 0 ? 'up-text' : 'down-text'}>
              {formatDelta(timeline?.changeAmount ?? 0)} / {formatPercent(timeline?.changePercent ?? 0)}
            </span>
          </div>
          <div className="chart-summary-block chart-readout" aria-label="Chart readout">
            <span className="section-label">Point Readout</span>
            <strong>{formatCurrency(chartReadoutPoint?.amountUsd ?? timeline?.latestValue ?? 0)}</strong>
            <span>{chartReadoutPoint?.date ?? timeline?.endDate ?? '--'}</span>
          </div>
        </div>
      </div>

      <div className="chart-stage">
        {chartGeometry ? (
          <div
            className="chart-interaction-layer"
            aria-label="持仓金额变化曲线交互区"
            onPointerMove={(event) => queuePointerMove(event.clientX, event.currentTarget)}
            onPointerLeave={clearHover}
            onPointerDown={(event) => queuePointerMove(event.clientX, event.currentTarget)}
          >
            <svg viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`} className="chart-svg" role="img" aria-label="持仓金额变化曲线">
              <defs>
                <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
                </linearGradient>
                <radialGradient id="curve-point-glow">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>
              <path d={chartGeometry.areaPath} fill="url(#curve-fill)" />
              <path d={chartGeometry.linePath} fill="none" stroke="#f5f5f5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {activeChartPoint ? (
                <line
                  x1={activeChartPoint.x}
                  y1={12}
                  x2={activeChartPoint.x}
                  y2={chartGeometry.height - 12}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              ) : null}
              {chartGeometry.points.at(-1) ? (
                <>
                  <circle cx={chartGeometry.points.at(-1)!.x} cy={chartGeometry.points.at(-1)!.y} r="18" fill="url(#curve-point-glow)" />
                  <circle cx={chartGeometry.points.at(-1)!.x} cy={chartGeometry.points.at(-1)!.y} r="7" fill="rgba(255,255,255,0.15)" />
                </>
              ) : null}
              {chartGeometry.points.map((point, index) => (
                <g key={point.date}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={activeChartPointIndex === index ? '6' : '4.5'}
                    fill="#000"
                    stroke="#f5f5f5"
                    strokeWidth="1.5"
                  />
                </g>
              ))}
              {activeChartPoint && activeTooltipX !== null && activeTooltipY !== null ? (
                <g role="group" aria-label="Chart point details">
                  <circle cx={activeChartPoint.x} cy={activeChartPoint.y} r="20" fill="url(#curve-point-glow)" />
                  <circle cx={activeChartPoint.x} cy={activeChartPoint.y} r="8" fill="rgba(255,255,255,0.18)" />
                  <circle
                    cx={activeChartPoint.x}
                    cy={activeChartPoint.y}
                    r="5"
                    fill="#f5f5f5"
                    stroke="#000"
                    strokeWidth="1.4"
                  />
                  <rect
                    x={activeTooltipX - 58}
                    y={activeTooltipY - 40}
                    width="116"
                    height="36"
                    rx="10"
                    fill="rgba(9, 9, 9, 0.96)"
                    stroke="rgba(255,255,255,0.12)"
                  />
                  <text x={activeTooltipX} y={activeTooltipY - 18} fill="#f8fbff" fontSize="12" fontWeight="700" textAnchor="middle">
                    {formatCurrency(activeChartPoint.amountUsd)}
                  </text>
                  <text x={activeTooltipX} y={activeTooltipY - 8} fill="rgba(244,244,244,0.66)" fontSize="9" letterSpacing="1.4" textAnchor="middle">
                    {activeChartPoint.date}
                  </text>
                </g>
              ) : null}
              <rect
                x="0"
                y="0"
                width={chartGeometry.width}
                height={chartGeometry.height}
                fill="transparent"
              />
            </svg>
          </div>
        ) : (
          <div className="chart-empty">这个区间还没有持仓记录，先在日历里补一天看看。</div>
        )}
      </div>

      <div className="chart-footer">
        <div className="range-tabs">
          {rangeOptions.map((range) => (
            <button
              key={range}
              type="button"
              className={`range-tab ${selectedRange === range ? 'active' : ''}`}
              onClick={() => onChangeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="chart-dates">
          <span>{timeline?.startDate ?? '--'}</span>
          <span>{timeline?.endDate ?? '--'}</span>
        </div>
      </div>
    </div>
  )
}
