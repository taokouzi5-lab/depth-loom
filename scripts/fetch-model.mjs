import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const HF = 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main'
const OUT_DIR = 'public/models/depth-anything-v2-small'

const FILES = [
  {
    url: `${HF}/config.json`,
    dest: `${OUT_DIR}/config.json`,
    bytes: 38,
  },
  {
    url: `${HF}/preprocessor_config.json`,
    dest: `${OUT_DIR}/preprocessor_config.json`,
    bytes: 461,
  },
  {
    url: `${HF}/onnx/model_q4f16.onnx`,
    dest: `${OUT_DIR}/onnx/model_q4f16.onnx`,
    bytes: 19_126_267,
    sha256: 'eca72971aea64216d767c70c534160de53b5435b588d362bac6dbd5a73f9bf1e',
  },
  {
    url: `${HF}/onnx/model_quantized.onnx`,
    dest: `${OUT_DIR}/onnx/model_quantized.onnx`,
    bytes: 27_258_801,
    sha256: 'fcf51f1b230362b28690bb9d1809bf0431f29cad20534e3f589bd7285547f20d',
  },
  {
    url: 'https://raw.githubusercontent.com/DepthAnything/Depth-Anything-V2/main/LICENSE',
    dest: `${OUT_DIR}/LICENSE`,
  },
]

async function sha256(file) {
  const data = await readFile(file)
  return createHash('sha256').update(data).digest('hex')
}

async function isCurrent(file) {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

let failed = false

for (const file of FILES) {
  const dest = path.resolve(file.dest)
  await mkdir(path.dirname(dest), { recursive: true })

  if (await isCurrent(dest)) {
    const info = await stat(dest)
    if (!file.bytes || info.size === file.bytes) {
      if (file.sha256 && (await sha256(dest)) !== file.sha256) {
        process.stdout.write(`SHA256 mismatch, re-downloading ${file.dest}\n`)
      } else {
        process.stdout.write(`ok ${file.dest}\n`)
        continue
      }
    }
  }

  process.stdout.write(`downloading ${file.url}\n`)
  try {
    const response = await fetch(file.url, { signal: AbortSignal.timeout(600_000) })
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (file.bytes && buffer.length !== file.bytes) {
      throw new Error(`expected ${file.bytes} bytes, got ${buffer.length}`)
    }
    if (file.sha256) {
      const actual = createHash('sha256').update(buffer).digest('hex')
      if (actual !== file.sha256) {
        throw new Error(`sha256 mismatch: expected ${file.sha256}, got ${actual}`)
      }
    }
    await writeFile(dest, buffer)
    process.stdout.write(`wrote ${file.dest} (${buffer.length} bytes)\n`)
  } catch (error) {
    failed = true
    process.stderr.write(`failed ${file.dest}: ${error.message}\n`)
  }
}

if (failed) {
  process.exitCode = 1
} else {
  process.stdout.write('model files are ready\n')
}
