import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const blockingSeverities = new Set(['high', 'critical'])
const allowlistPath = path.join(
  process.cwd(),
  'scripts',
  'audit-allowlist.json',
)

const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'))
const allowedIds = new Set(allowlist.advisories.map((advisory) => advisory.id))
const report = await runAudit()

const blocking = new Map()
const allowedSeen = new Set()

for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const source of vulnerability.via) {
    if (
      typeof source !== 'object' ||
      !blockingSeverities.has(source.severity)
    ) {
      continue
    }

    const id = advisoryId(source.url)
    if (allowedIds.has(id)) {
      allowedSeen.add(id)
      continue
    }

    blocking.set(id, `${source.name}: ${source.title} (${source.url})`)
  }
}

for (const id of allowedIds) {
  if (!allowedSeen.has(id)) {
    console.warn(
      `Allowlisted advisory ${id} is no longer reported; remove it from scripts/audit-allowlist.json.`,
    )
  }
}

if (blocking.size > 0) {
  console.error('High or critical advisories found:')
  for (const description of blocking.values()) {
    console.error(`- ${description}`)
  }

  process.exitCode = 1
} else {
  console.log(
    `Audit passed (${allowedSeen.size} allowlisted advisories, see scripts/audit-allowlist.json).`,
  )
}

async function runAudit() {
  try {
    const { stdout } = await execFileAsync('npm', ['audit', '--json'], {
      maxBuffer: 32 * 1024 * 1024,
    })
    return JSON.parse(stdout)
  } catch (error) {
    // npm audit exits non-zero whenever it finds any advisory; the JSON report is still on stdout.
    if (typeof error.stdout === 'string' && error.stdout.length > 0) {
      return JSON.parse(error.stdout)
    }

    throw error
  }
}

function advisoryId(url) {
  return url.split('/').pop() ?? url
}
