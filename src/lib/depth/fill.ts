/**
 * Push-pull colour fill for the background plate.
 *
 * The foreground mask marks pixels that must not contribute colour. A plain
 * low-resolution inpainting loses sharpness and leaves visible banding; a
 * masked pyramid averages only background pixels at every level, then pulls
 * those averages back down, so the filled region inherits the surrounding
 * colours at increasing detail without ever mixing in foreground colour.
 */

export type RgbaImage = {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Work resolution of the fill. Higher is sharper but costs more time. */
export const FILL_MAX_WIDTH = 384

interface Level {
  width: number
  height: number
  color: Float32Array
  valid: Uint8Array
}

const COLOR_CHANNELS = 3

function createBaseLevel(
  source: RgbaImage,
  keepMask: Uint8Array,
  width: number,
  height: number,
): Level {
  const level: Level = {
    width,
    height,
    color: new Float32Array(width * height * COLOR_CHANNELS),
    valid: new Uint8Array(width * height),
  }
  const stepX = source.width / width
  const stepY = source.height / height

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      source.height - 1,
      Math.floor((y + 0.5) * stepY),
    )
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        source.width - 1,
        Math.floor((x + 0.5) * stepX),
      )
      const sourceIndex = sourceY * source.width + sourceX
      const index = y * width + x
      if (keepMask[sourceIndex] < 128) continue

      level.valid[index] = 1
      level.color[index * COLOR_CHANNELS] = source.data[sourceIndex * 4]
      level.color[index * COLOR_CHANNELS + 1] =
        source.data[sourceIndex * 4 + 1]
      level.color[index * COLOR_CHANNELS + 2] =
        source.data[sourceIndex * 4 + 2]
    }
  }
  return level
}

function pushDown(levels: Level[]): void {
  for (;;) {
    const fine = levels[levels.length - 1]
    if (fine.width === 1 && fine.height === 1) return

    const width = Math.max(1, Math.ceil(fine.width / 2))
    const height = Math.max(1, Math.ceil(fine.height / 2))
    const coarse: Level = {
      width,
      height,
      color: new Float32Array(width * height * COLOR_CHANNELS),
      valid: new Uint8Array(width * height),
    }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let count = 0
        let red = 0
        let green = 0
        let blue = 0
        for (let offsetY = 0; offsetY < 2; offsetY += 1) {
          const sourceY = y * 2 + offsetY
          if (sourceY >= fine.height) continue
          for (let offsetX = 0; offsetX < 2; offsetX += 1) {
            const sourceX = x * 2 + offsetX
            if (sourceX >= fine.width) continue
            const sourceIndex = sourceY * fine.width + sourceX
            if (!fine.valid[sourceIndex]) continue
            red += fine.color[sourceIndex * COLOR_CHANNELS]
            green += fine.color[sourceIndex * COLOR_CHANNELS + 1]
            blue += fine.color[sourceIndex * COLOR_CHANNELS + 2]
            count += 1
          }
        }
        if (count === 0) continue
        const index = y * width + x
        coarse.valid[index] = 1
        coarse.color[index * COLOR_CHANNELS] = red / count
        coarse.color[index * COLOR_CHANNELS + 1] = green / count
        coarse.color[index * COLOR_CHANNELS + 2] = blue / count
      }
    }
    levels.push(coarse)
  }
}

function averageValid(level: Level): [number, number, number] {
  let count = 0
  let red = 0
  let green = 0
  let blue = 0
  for (let index = 0; index < level.valid.length; index += 1) {
    if (!level.valid[index]) continue
    red += level.color[index * COLOR_CHANNELS]
    green += level.color[index * COLOR_CHANNELS + 1]
    blue += level.color[index * COLOR_CHANNELS + 2]
    count += 1
  }
  if (count === 0) return [0, 0, 0]
  return [red / count, green / count, blue / count]
}

function sampleLevel(
  level: Level,
  x: number,
  y: number,
  ratioX: number,
  ratioY: number,
): [number, number, number] {
  const sourceX = Math.min(
    Math.max((x + 0.5) / ratioX - 0.5, 0),
    level.width - 1,
  )
  const sourceY = Math.min(
    Math.max((y + 0.5) / ratioY - 0.5, 0),
    level.height - 1,
  )
  const x0 = Math.floor(sourceX)
  const y0 = Math.floor(sourceY)
  const x1 = Math.min(level.width - 1, x0 + 1)
  const y1 = Math.min(level.height - 1, y0 + 1)
  const fx = sourceX - x0
  const fy = sourceY - y0

  let red = 0
  let green = 0
  let blue = 0
  let total = 0
  const add = (px: number, py: number, weight: number): void => {
    if (weight <= 0) return
    const index = py * level.width + px
    red += level.color[index * COLOR_CHANNELS] * weight
    green += level.color[index * COLOR_CHANNELS + 1] * weight
    blue += level.color[index * COLOR_CHANNELS + 2] * weight
    total += weight
  }
  add(x0, y0, (1 - fx) * (1 - fy))
  add(x1, y0, fx * (1 - fy))
  add(x0, y1, (1 - fx) * fy)
  add(x1, y1, fx * fy)

  if (total === 0) return [0, 0, 0]
  return [red / total, green / total, blue / total]
}

function pullUp(levels: Level[], fallback: [number, number, number]): void {
  const coarsest = levels[levels.length - 1]
  for (let index = 0; index < coarsest.valid.length; index += 1) {
    if (coarsest.valid[index]) continue
    coarsest.color[index * COLOR_CHANNELS] = fallback[0]
    coarsest.color[index * COLOR_CHANNELS + 1] = fallback[1]
    coarsest.color[index * COLOR_CHANNELS + 2] = fallback[2]
    coarsest.valid[index] = 1
  }

  for (let depth = levels.length - 2; depth >= 0; depth -= 1) {
    const fine = levels[depth]
    const coarse = levels[depth + 1]
    const ratioX = fine.width / coarse.width
    const ratioY = fine.height / coarse.height

    for (let y = 0; y < fine.height; y += 1) {
      for (let x = 0; x < fine.width; x += 1) {
        const index = y * fine.width + x
        if (fine.valid[index]) continue
        const [red, green, blue] = sampleLevel(coarse, x, y, ratioX, ratioY)
        fine.color[index * COLOR_CHANNELS] = red
        fine.color[index * COLOR_CHANNELS + 1] = green
        fine.color[index * COLOR_CHANNELS + 2] = blue
        fine.valid[index] = 1
      }
    }
  }
}

/**
 * Fill the depth values under a foreground mask with the surrounding
 * background depth. The displaced background mesh must not inherit the
 * foreground's depth, or it would bulge towards the camera where the cutout
 * used to be.
 */
export function fillDepthWithBackground(
  depth: { data: Float32Array; width: number; height: number },
  keepMask: Uint8Array,
  maxWidth = FILL_MAX_WIDTH,
): Float32Array | null {
  const { data, width, height } = depth
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    const value = Math.round(Math.min(1, Math.max(0, data[index])) * 255)
    rgba[index * 4] = value
    rgba[index * 4 + 1] = value
    rgba[index * 4 + 2] = value
    rgba[index * 4 + 3] = 255
  }

  const filled = createPushPullFill(
    { data: rgba, width, height },
    keepMask,
    maxWidth,
  )
  if (!filled) return null

  const output = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      Math.max(((y + 0.5) / height) * filled.height - 0.5, 0),
      filled.height - 1,
    )
    const y0 = Math.floor(sourceY)
    const y1 = Math.min(filled.height - 1, y0 + 1)
    const fy = sourceY - y0
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (keepMask[index] >= 128) {
        output[index] = data[index]
        continue
      }
      const sourceX = Math.min(
        Math.max(((x + 0.5) / width) * filled.width - 0.5, 0),
        filled.width - 1,
      )
      const x0 = Math.floor(sourceX)
      const x1 = Math.min(filled.width - 1, x0 + 1)
      const fx = sourceX - x0
      const top =
        filled.data[(y0 * filled.width + x0) * 4] * (1 - fx) +
        filled.data[(y0 * filled.width + x1) * 4] * fx
      const bottom =
        filled.data[(y1 * filled.width + x0) * 4] * (1 - fx) +
        filled.data[(y1 * filled.width + x1) * 4] * fx
      output[index] = (top * (1 - fy) + bottom * fy) / 255
    }
  }
  return output
}

/**
 * Fill every pixel where `keepMask` is below 128 using only colours from
 * pixels above it. Downloaded to at most `maxWidth` for speed; the caller
 * scales the result back up. Returns null when the image has no background
 * pixel at all.
 */
export function createPushPullFill(
  source: RgbaImage,
  keepMask: Uint8Array,
  maxWidth = FILL_MAX_WIDTH,
): RgbaImage | null {
  if (source.width <= 0 || source.height <= 0) return null
  if (source.data.length < source.width * source.height * 4) return null
  if (keepMask.length < source.width * source.height) return null

  let hasValid = false
  for (let index = 0; index < keepMask.length; index += 1) {
    if (keepMask[index] >= 128) {
      hasValid = true
      break
    }
  }
  if (!hasValid) return null

  const scale = Math.min(1, maxWidth / source.width)
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const levels = [createBaseLevel(source, keepMask, width, height)]
  pushDown(levels)
  pullUp(levels, averageValid(levels[0]))

  const finest = levels[0]
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = finest.color[index * COLOR_CHANNELS]
    data[index * 4 + 1] = finest.color[index * COLOR_CHANNELS + 1]
    data[index * 4 + 2] = finest.color[index * COLOR_CHANNELS + 2]
    data[index * 4 + 3] = 255
  }
  return { data, width, height }
}
