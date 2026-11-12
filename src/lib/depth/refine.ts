/**
 * Joint bilateral filter: pull depth edges toward color edges. This is the
 * depth-edge cleaning step used by production 3D-photo pipelines; without it a
 * soft depth boundary bleeding across a sharp color edge leaves a halo when the
 * layers move.
 */
export function refineDepthWithColor(
  depth: Float32Array,
  depthWidth: number,
  depthHeight: number,
  rgba: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
): Float32Array {
  if (
    depthWidth <= 0 ||
    depthHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    depth.length !== depthWidth * depthHeight ||
    rgba.length < imageWidth * imageHeight * 4
  ) {
    return depth
  }

  const radius = 2
  const sigmaSpace = 2
  const sigmaColor = 0.1
  const spatial: number[] = []
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      spatial.push(
        Math.exp(
          -(offsetX * offsetX + offsetY * offsetY) /
            (2 * sigmaSpace * sigmaSpace),
        ),
      )
    }
  }

  const output = new Float32Array(depth.length)
  const colorScaleX = imageWidth / depthWidth
  const colorScaleY = imageHeight / depthHeight

  for (let y = 0; y < depthHeight; y += 1) {
    const centerY = clamp(
      Math.floor((y + 0.5) * colorScaleY),
      0,
      imageHeight - 1,
    )
    for (let x = 0; x < depthWidth; x += 1) {
      const centerX = clamp(
        Math.floor((x + 0.5) * colorScaleX),
        0,
        imageWidth - 1,
      )
      const centerIndex = (centerY * imageWidth + centerX) * 4
      const centerR = rgba[centerIndex]
      const centerG = rgba[centerIndex + 1]
      const centerB = rgba[centerIndex + 2]

      let sum = 0
      let weightSum = 0
      let spatialIndex = 0

      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const sampleY = clamp(y + offsetY, 0, depthHeight - 1)
        const colorY = clamp(
          Math.floor((sampleY + 0.5) * colorScaleY),
          0,
          imageHeight - 1,
        )
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sampleX = clamp(x + offsetX, 0, depthWidth - 1)
          const colorX = clamp(
            Math.floor((sampleX + 0.5) * colorScaleX),
            0,
            imageWidth - 1,
          )
          const colorIndex = (colorY * imageWidth + colorX) * 4
          const differenceR = (rgba[colorIndex] - centerR) / 255
          const differenceG = (rgba[colorIndex + 1] - centerG) / 255
          const differenceB = (rgba[colorIndex + 2] - centerB) / 255
          const colorDistance =
            differenceR * differenceR +
            differenceG * differenceG +
            differenceB * differenceB
          const weight =
            spatial[spatialIndex] *
            Math.exp(-colorDistance / (2 * sigmaColor * sigmaColor))
          spatialIndex += 1

          sum += depth[sampleY * depthWidth + sampleX] * weight
          weightSum += weight
        }
      }

      output[y * depthWidth + x] =
        weightSum > 0 ? sum / weightSum : depth[y * depthWidth + x]
    }
  }

  return output
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
