import path from 'node:path'

export function resolveDbPath(rootDir: string, envDbPath = process.env.DB_PATH) {
  if (envDbPath) {
    return envDbPath
  }

  const normalizedRoot = rootDir.endsWith(`${path.sep}dist-server`)
    ? path.dirname(rootDir)
    : rootDir

  return path.resolve(normalizedRoot, 'data', 'profit-calendar.db')
}
