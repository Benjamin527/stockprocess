import dayjs from 'dayjs'

import type { GoalSettings, ProfitEntry, RangeKey, TeslaProgress } from './types.js'

export type CalendarDay = {
  date: string
  dayOfMonth: number
  amountUsd: number
  entryCount: number
  isCurrentMonth: boolean
  marketState: 'open' | 'weekend' | 'holiday'
  closedLabel: string | null
}

export type SummaryDay = {
  date: string
  amountUsd: number
}

export type TimelinePoint = {
  date: string
  amountUsd: number
}

export type TimelineSummary = {
  range: RangeKey
  startDate: string
  endDate: string
  points: TimelinePoint[]
  minValue: number
  maxValue: number
  latestValue: number
  changeAmount: number
  changePercent: number
}

export type MonthlySummary = {
  monthKey: string
  latestValue: number
  monthChange: number
  targetProgress: number
  monthlyTotal: number
  monthlyTargetProgress: number
  calendarDays: CalendarDay[]
  highestValueDay: SummaryDay | null
  lowestValueDay: SummaryDay | null
  latestValueDay: SummaryDay | null
  sourceBreakdown: Array<{ source: string; amountUsd: number }>
}

const DEFAULT_PORTFOLIO_TARGET_USD = 50000

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, nth: number) {
  const firstDay = new Date(year, monthIndex, 1)
  const offset = (weekday - firstDay.getDay() + 7) % 7
  return new Date(year, monthIndex, 1 + offset + (nth - 1) * 7)
}

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number) {
  const lastDay = new Date(year, monthIndex + 1, 0)
  const offset = (lastDay.getDay() - weekday + 7) % 7
  return new Date(year, monthIndex, lastDay.getDate() - offset)
}

function observeFixedHoliday(date: Date) {
  const observed = new Date(date)
  if (date.getDay() === 6) {
    observed.setDate(date.getDate() - 1)
  } else if (date.getDay() === 0) {
    observed.setDate(date.getDate() + 1)
  }
  return observed
}

function formatDateKey(date: Date) {
  return dayjs(date).format('YYYY-MM-DD')
}

function calculateEasterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function getNyseHolidayMap(targetYear: number) {
  const holidays = new Map<string, string>()

  for (const year of [targetYear - 1, targetYear, targetYear + 1]) {
    const goodFriday = calculateEasterSunday(year)
    goodFriday.setDate(goodFriday.getDate() - 2)

    const holidayPairs: Array<[string, Date]> = [
      ['元旦休市', observeFixedHoliday(new Date(year, 0, 1))],
      ['马丁路德金纪念日', nthWeekdayOfMonth(year, 0, 1, 3)],
      ['总统日', nthWeekdayOfMonth(year, 1, 1, 3)],
      ['耶稣受难日', goodFriday],
      ['阵亡将士纪念日', lastWeekdayOfMonth(year, 4, 1)],
      ['六月节', observeFixedHoliday(new Date(year, 5, 19))],
      ['独立日休市', observeFixedHoliday(new Date(year, 6, 4))],
      ['劳动节休市', nthWeekdayOfMonth(year, 8, 1, 1)],
      ['感恩节休市', nthWeekdayOfMonth(year, 10, 4, 4)],
      ['圣诞节休市', observeFixedHoliday(new Date(year, 11, 25))],
    ]

    for (const [label, date] of holidayPairs) {
      if (date.getFullYear() === targetYear) {
        holidays.set(formatDateKey(date), label)
      }
    }
  }

  return holidays
}

function aggregateDailyTotals(entries: ProfitEntry[]) {
  const dailyTotals = new Map<string, { amountUsd: number; entryCount: number }>()

  for (const entry of entries) {
    const current = dailyTotals.get(entry.entryDate) ?? { amountUsd: 0, entryCount: 0 }
    current.amountUsd += entry.amountUsd
    current.entryCount += 1
    dailyTotals.set(entry.entryDate, current)
  }

  return [...dailyTotals.entries()]
    .map(([date, values]) => ({
      date,
      amountUsd: values.amountUsd,
      entryCount: values.entryCount,
    }))
    .sort((left, right) => left.date.localeCompare(right.date))
}

function getWeekWindow(anchorDate: dayjs.Dayjs) {
  const dayOffset = (anchorDate.day() + 6) % 7
  const startDate = anchorDate.subtract(dayOffset, 'day')
  const endDate = startDate.add(6, 'day')

  return { startDate, endDate }
}

function getRangeWindow(endDate: dayjs.Dayjs, range: RangeKey) {
  if (range === '1W') {
    return getWeekWindow(endDate)
  }
  if (range === '1M') {
    return {
      startDate: endDate.subtract(1, 'month').add(1, 'day'),
      endDate,
    }
  }
  if (range === '6M') {
    return {
      startDate: endDate.subtract(6, 'month').add(1, 'day'),
      endDate,
    }
  }
  return {
    startDate: endDate.subtract(1, 'year').add(1, 'day'),
    endDate,
  }
}

export function buildPortfolioTargetProgress(
  currentUsd: number,
  targetUsd = DEFAULT_PORTFOLIO_TARGET_USD,
): TeslaProgress {
  return {
    currentUsd,
    targetUsd,
    progress: targetUsd === 0 ? 0 : currentUsd / targetUsd,
  }
}

export function buildTeslaProgress(yearTotal: number): TeslaProgress {
  return buildPortfolioTargetProgress(yearTotal, DEFAULT_PORTFOLIO_TARGET_USD)
}

export function buildPortfolioSummary(
  entries: ProfitEntry[],
  goals: GoalSettings,
  monthKey: string,
): MonthlySummary {
  const monthStart = dayjs(`${monthKey}-01`)
  const monthEnd = monthStart.endOf('month')
  const holidays = getNyseHolidayMap(monthStart.year())
  const monthEntries = entries.filter((entry) => {
    const date = dayjs(entry.entryDate)
    return !date.isBefore(monthStart, 'day') && !date.isAfter(monthEnd, 'day')
  })
  const dailyTotals = aggregateDailyTotals(monthEntries)
  const dailyMap = new Map(dailyTotals.map((day) => [day.date, day]))

  const calendarDays: CalendarDay[] = []
  for (let day = 1; day <= monthEnd.date(); day += 1) {
    const currentDate = monthStart.date(day)
    const date = currentDate.format('YYYY-MM-DD')
    const aggregate = dailyMap.get(date)
    const holidayLabel = holidays.get(date)
    const isWeekend = currentDate.day() === 0 || currentDate.day() === 6

    calendarDays.push({
      date,
      dayOfMonth: day,
      amountUsd: aggregate?.amountUsd ?? 0,
      entryCount: aggregate?.entryCount ?? 0,
      isCurrentMonth: true,
      marketState: holidayLabel ? 'holiday' : isWeekend ? 'weekend' : 'open',
      closedLabel: holidayLabel ?? (isWeekend ? '周末休市' : null),
    })
  }

  const latestValueDay = dailyTotals.at(-1)
    ? { date: dailyTotals.at(-1)!.date, amountUsd: dailyTotals.at(-1)!.amountUsd }
    : null
  const firstValueDay = dailyTotals[0]
    ? { date: dailyTotals[0].date, amountUsd: dailyTotals[0].amountUsd }
    : null
  const monthProfit =
    latestValueDay && firstValueDay ? latestValueDay.amountUsd - firstValueDay.amountUsd : 0

  const highestValueDay = dailyTotals.reduce<SummaryDay | null>((highest, day) => {
    if (!highest || day.amountUsd > highest.amountUsd) {
      return { date: day.date, amountUsd: day.amountUsd }
    }
    return highest
  }, null)

  const lowestValueDay = dailyTotals.reduce<SummaryDay | null>((lowest, day) => {
    if (!lowest || day.amountUsd < lowest.amountUsd) {
      return { date: day.date, amountUsd: day.amountUsd }
    }
    return lowest
  }, null)

  const latestDate = latestValueDay?.date
  const sourceBreakdown = latestDate
    ? monthEntries
        .filter((entry) => entry.entryDate === latestDate)
        .reduce((map, entry) => {
          map.set(entry.source, (map.get(entry.source) ?? 0) + entry.amountUsd)
          return map
        }, new Map<string, number>())
    : new Map<string, number>()

  return {
    monthKey,
    latestValue: latestValueDay?.amountUsd ?? 0,
    monthChange: monthProfit,
    monthlyTotal: dailyTotals.reduce((total, day) => total + day.amountUsd, 0),
    monthlyTargetProgress:
      goals.monthlyTargetUsd === 0 ? 0 : monthProfit / goals.monthlyTargetUsd,
    targetProgress:
      goals.annualTargetUsd === 0
        ? 0
        : (latestValueDay?.amountUsd ?? 0) / goals.annualTargetUsd,
    calendarDays,
    highestValueDay,
    lowestValueDay,
    latestValueDay,
    sourceBreakdown: [...sourceBreakdown.entries()]
      .map(([source, amountUsd]) => ({ source, amountUsd }))
      .sort((left, right) => right.amountUsd - left.amountUsd),
  }
}

export function buildPortfolioTimeline(
  entries: ProfitEntry[],
  range: RangeKey,
  endDateInput: string,
): TimelineSummary {
  const anchorDate = dayjs(endDateInput)
  const { startDate, endDate } = getRangeWindow(anchorDate, range)
  const points = aggregateDailyTotals(
    entries.filter((entry) => {
      const current = dayjs(entry.entryDate)
      return !current.isBefore(startDate, 'day') && !current.isAfter(endDate, 'day')
    }),
  ).map((point) => ({
    date: point.date,
    amountUsd: point.amountUsd,
  }))

  const latestValue = points.at(-1)?.amountUsd ?? 0
  const firstValue = points[0]?.amountUsd ?? latestValue
  const minValue = points.length > 0 ? Math.min(...points.map((point) => point.amountUsd)) : 0
  const maxValue = points.length > 0 ? Math.max(...points.map((point) => point.amountUsd)) : 0
  const changeAmount = latestValue - firstValue
  const changePercent = firstValue === 0 ? 0 : changeAmount / firstValue

  return {
    range,
    startDate: startDate.format('YYYY-MM-DD'),
    endDate: endDate.format('YYYY-MM-DD'),
    points,
    minValue,
    maxValue,
    latestValue,
    changeAmount,
    changePercent,
  }
}
