import dayjs from 'dayjs'

import type { GoalSettings, ProfitEntry, TeslaProgress } from './types.js'

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

export type MonthlySummary = {
  monthKey: string
  monthTotal: number
  yearTotal: number
  monthProgress: number
  yearProgress: number
  calendarDays: CalendarDay[]
  bestDay: SummaryDay | null
  worstDay: SummaryDay | null
  sourceBreakdown: Array<{ source: string; amountUsd: number }>
}

const TESLA_TARGET_USD = 50000

export function buildTeslaProgress(yearTotal: number): TeslaProgress {
  return {
    currentUsd: yearTotal,
    targetUsd: TESLA_TARGET_USD,
    progress: yearTotal / TESLA_TARGET_USD,
  }
}

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

export function buildMonthlySummary(
  entries: ProfitEntry[],
  goals: GoalSettings,
  monthKey: string,
): MonthlySummary {
  const monthStart = dayjs(`${monthKey}-01`)
  const monthEnd = monthStart.endOf('month')
  const yearKey = String(goals.year)
  const holidays = getNyseHolidayMap(monthStart.year())

  const yearEntries = entries.filter((entry) => entry.entryDate.startsWith(yearKey))
  const monthEntries = yearEntries.filter((entry) => {
    const date = dayjs(entry.entryDate)
    return !date.isBefore(monthStart, 'day') && !date.isAfter(monthEnd, 'day')
  })

  const monthTotal = monthEntries.reduce((total, entry) => total + entry.amountUsd, 0)
  const yearTotal = yearEntries.reduce((total, entry) => total + entry.amountUsd, 0)

  const entryMap = new Map<string, { amountUsd: number; entryCount: number }>()
  const sourceMap = new Map<string, number>()

  for (const entry of monthEntries) {
    const existing = entryMap.get(entry.entryDate) ?? { amountUsd: 0, entryCount: 0 }
    existing.amountUsd += entry.amountUsd
    existing.entryCount += 1
    entryMap.set(entry.entryDate, existing)
    sourceMap.set(entry.source, (sourceMap.get(entry.source) ?? 0) + entry.amountUsd)
  }

  const calendarDays: CalendarDay[] = []
  for (let day = 1; day <= monthEnd.date(); day += 1) {
    const date = monthStart.date(day).format('YYYY-MM-DD')
    const entry = entryMap.get(date)
    const currentDate = monthStart.date(day)
    const holidayLabel = holidays.get(date)
    const isWeekend = currentDate.day() === 0 || currentDate.day() === 6
    calendarDays.push({
      date,
      dayOfMonth: day,
      amountUsd: entry?.amountUsd ?? 0,
      entryCount: entry?.entryCount ?? 0,
      isCurrentMonth: true,
      marketState: holidayLabel ? 'holiday' : isWeekend ? 'weekend' : 'open',
      closedLabel: holidayLabel ?? (isWeekend ? '周末休市' : null),
    })
  }

  const dailyTotals = calendarDays
    .filter((day) => day.entryCount > 0)
    .map((day) => ({ date: day.date, amountUsd: day.amountUsd }))

  const bestDay = dailyTotals.reduce<SummaryDay | null>((best, day) => {
    if (!best || day.amountUsd > best.amountUsd) {
      return day
    }
    return best
  }, null)

  const worstDay = dailyTotals.reduce<SummaryDay | null>((worst, day) => {
    if (!worst || day.amountUsd < worst.amountUsd) {
      return day
    }
    return worst
  }, null)

  return {
    monthKey,
    monthTotal,
    yearTotal,
    monthProgress: goals.monthlyTargetUsd === 0 ? 0 : monthTotal / goals.monthlyTargetUsd,
    yearProgress: goals.annualTargetUsd === 0 ? 0 : yearTotal / goals.annualTargetUsd,
    calendarDays,
    bestDay,
    worstDay,
    sourceBreakdown: [...sourceMap.entries()]
      .map(([source, amountUsd]) => ({ source, amountUsd }))
      .sort((left, right) => right.amountUsd - left.amountUsd),
  }
}
