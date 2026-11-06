import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
// Resolve the package entry (package.json itself is not exported).
const ortEntry = require.resolve('onnxruntime-web')
const dist = path.dirname(ortEntry)
const out = path.resolve('public/ort')

const entries = await readdir(dist)
const runtimeFiles = entries.filter(
  (name) =>
    name.startsWith('ort-wasm-') &&
    (name.endsWith('.wasm') || name.endsWith('.mjs')),
)

if (runtimeFiles.length === 0) {
  throw new Error(`No ORT runtime files found in ${dist}`)
}

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

await Promise.all(
  runtimeFiles.map((name) => cp(path.join(dist, name), path.join(out, name))),
)

process.stdout.write(
  `Copied ${runtimeFiles.length} ONNX Runtime files into public/ort/\n`,
)
