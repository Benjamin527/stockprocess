import path from 'node:path'

export function resolveDbPath(rootDir: string, envDbPath = process.env.DB_PATH) {
  return envDbPath ?? path.resolve(rootDir, 'data', 'profit-calendar.db')
}
