import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('development startup scripts', () => {
  it('starts the client and API server together from npm run dev', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts.dev).toBe('node scripts/dev.mjs')
    expect(packageJson.scripts['dev:client']).toBe('vite')
    expect(packageJson.scripts['dev:server']).toBe('tsx watch server/index.ts')
    expect(fs.readFileSync('scripts/dev.mjs', 'utf8')).toContain('dev:server')
    expect(fs.readFileSync('scripts/dev.mjs', 'utf8')).toContain('dev:client')
  })
})
