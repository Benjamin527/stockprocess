import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveDbPath } from './config.js'

describe('server config', () => {
  it('stores the default database inside the project data directory', () => {
    const rootDir = '/repo/profit-calendar'

    expect(resolveDbPath(rootDir, undefined)).toBe(path.resolve(rootDir, 'data', 'profit-calendar.db'))
  })

  it('keeps DB_PATH as an explicit override', () => {
    expect(resolveDbPath('/repo/profit-calendar', '/custom/profit-calendar.db')).toBe('/custom/profit-calendar.db')
  })

  it('resolves dist-server builds back to the project data directory', () => {
    const rootDir = '/repo/profit-calendar/dist-server'

    expect(resolveDbPath(rootDir, undefined)).toBe(
      path.resolve('/repo/profit-calendar', 'data', 'profit-calendar.db'),
    )
  })
})
