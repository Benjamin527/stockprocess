import Database from 'better-sqlite3'

import type { GoalSettings, ProfitEntry } from '../src/lib/types.js'

type EntryInput = {
  entryDate: string
  amountUsd: number
  source: string
  note: string
}

type GoalInput = GoalSettings
type EntryRow = {
  id: number
  entry_date: string
  amount_usd: number
  source: string
  note: string
  created_at: string
}

export function createStore(dbPath: string) {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS profit_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      source TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goal_settings (
      year INTEGER PRIMARY KEY,
      annual_target_usd REAL NOT NULL,
      monthly_target_usd REAL NOT NULL
    );
  `)

  const insertEntry = db.prepare(`
    INSERT INTO profit_entries (entry_date, amount_usd, source, note)
    VALUES (@entryDate, @amountUsd, @source, @note)
  `)

  const updateEntryStatement = db.prepare(`
    UPDATE profit_entries
    SET entry_date = @entryDate,
        amount_usd = @amountUsd,
        source = @source,
        note = @note
    WHERE id = @id
  `)

  const deleteEntryStatement = db.prepare(`
    DELETE FROM profit_entries WHERE id = ?
  `)

  const upsertGoals = db.prepare(`
    INSERT INTO goal_settings (year, annual_target_usd, monthly_target_usd)
    VALUES (@year, @annualTargetUsd, @monthlyTargetUsd)
    ON CONFLICT(year) DO UPDATE SET
      annual_target_usd = excluded.annual_target_usd,
      monthly_target_usd = excluded.monthly_target_usd
  `)

  const monthEntriesStatement = db.prepare(`
    SELECT id, entry_date, amount_usd, source, note, created_at
    FROM profit_entries
    WHERE entry_date >= ? AND entry_date < ?
    ORDER BY entry_date ASC, id ASC
  `)

  const yearEntriesStatement = db.prepare(`
    SELECT id, entry_date, amount_usd, source, note, created_at
    FROM profit_entries
    WHERE entry_date >= ? AND entry_date < ?
    ORDER BY entry_date ASC, id ASC
  `)

  const dayEntriesStatement = db.prepare(`
    SELECT id, entry_date, amount_usd, source, note, created_at
    FROM profit_entries
    WHERE entry_date = ?
    ORDER BY id ASC
  `)

  const goalStatement = db.prepare(`
    SELECT year, annual_target_usd, monthly_target_usd
    FROM goal_settings
    WHERE year = ?
  `)

  function mapEntry(row: EntryRow): ProfitEntry {
    return {
      id: row.id,
      entryDate: row.entry_date,
      amountUsd: row.amount_usd,
      source: row.source,
      note: row.note,
      createdAt: row.created_at,
    }
  }

  return {
    close() {
      db.close()
    },
    upsertEntry(input: EntryInput) {
      const result = insertEntry.run(input)
      return Number(result.lastInsertRowid)
    },
    updateEntry(id: number, input: EntryInput) {
      updateEntryStatement.run({ id, ...input })
    },
    deleteEntry(id: number) {
      deleteEntryStatement.run(id)
    },
    getMonthEntries(monthKey: string) {
      const [year, month] = monthKey.split('-').map(Number)
      const start = `${year}-${String(month).padStart(2, '0')}-01`
      const monthNumber = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      const end = `${nextYear}-${String(monthNumber).padStart(2, '0')}-01`
      return (monthEntriesStatement.all(start, end) as EntryRow[]).map(mapEntry)
    },
    getYearEntries(year: number) {
      const start = `${year}-01-01`
      const end = `${year + 1}-01-01`
      return (yearEntriesStatement.all(start, end) as EntryRow[]).map(mapEntry)
    },
    getDayEntries(date: string) {
      return (dayEntriesStatement.all(date) as EntryRow[]).map(mapEntry)
    },
    saveGoalSettings(input: GoalInput) {
      upsertGoals.run(input)
    },
    getGoalSettings(year: number): GoalSettings | null {
      const row = goalStatement.get(year) as
        | { year: number; annual_target_usd: number; monthly_target_usd: number }
        | undefined
      if (!row) {
        return null
      }
      return {
        year: row.year,
        annualTargetUsd: row.annual_target_usd,
        monthlyTargetUsd: row.monthly_target_usd,
      }
    },
  }
}
