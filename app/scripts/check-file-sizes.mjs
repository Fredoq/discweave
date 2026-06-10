import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceRoot = path.join(root, 'src')
const maxLines = 600

const sourceFiles = await collectSourceFiles(sourceRoot)
const oversized = []

for (const file of sourceFiles) {
  const relativePath = toRepositoryPath(file)
  const lineCount = await countLines(file)
  if (lineCount <= maxLines) {
    continue
  }

  oversized.push({ lineCount, relativePath })
}

if (oversized.length > 0) {
  console.error(`Files above ${maxLines} lines:`)
  for (const file of oversized) {
    console.error(`- ${file.relativePath}: ${file.lineCount}`)
  }

  process.exitCode = 1
} else {
  console.log(`File-size check passed (${maxLines} line limit).`)
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        return collectSourceFiles(fullPath)
      }

      return isManualFrontendFile(fullPath) ? [fullPath] : []
    }),
  )

  return files.flat()
}

function isManualFrontendFile(file) {
  return /\.(css|ts|tsx)$/.test(file) && !file.endsWith('.d.ts')
}

async function countLines(file) {
  const content = await readFile(file, 'utf8')
  if (content.length === 0) {
    return 0
  }

  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  return lines.length - (lines.at(-1) === '' ? 1 : 0)
}

function toRepositoryPath(file) {
  return path.relative(root, file).split(path.sep).join('/')
}
