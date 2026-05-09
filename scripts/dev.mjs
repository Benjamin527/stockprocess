import { spawn } from 'node:child_process'

const commands = [
  ['dev:server', ['run', 'dev:server']],
  ['dev:client', ['run', 'dev:client', '--', '--host', '127.0.0.1']],
]

let shuttingDown = false

const children = commands.map(([name, args]) => {
  const child = spawn('npm', args, {
    env: process.env,
    shell: true,
    stdio: 'inherit',
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    stopChildren()
    process.exit(code ?? (signal ? 1 : 0))
  })

  child.on('error', (error) => {
    console.error(`[${name}] ${error.message}`)
    if (!shuttingDown) {
      shuttingDown = true
      stopChildren()
      process.exit(1)
    }
  })

  return child
})

function stopChildren() {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }
}

process.on('SIGINT', () => {
  shuttingDown = true
  stopChildren()
})

process.on('SIGTERM', () => {
  shuttingDown = true
  stopChildren()
})
