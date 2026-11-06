import {
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  LinearFilter,
  NoColorSpace,
  ShaderMaterial,
  Vector2,
  type Texture,
} from 'three'
import type { DepthMap } from '../depth/protocol'
import { depthToRgba } from '../depth/normalize'

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uImage;
  uniform sampler2D uDepth;
  uniform float uStrength;
  uniform vec2 uTexel;
  uniform vec3 uFogColor;
  varying vec2 vUv;

  float readDepth(vec2 uv) {
    return texture2D(uDepth, clamp(uv, vec2(0.0), vec2(1.0))).r;
  }

  void main() {
    vec3 base = texture2D(uImage, vUv).rgb;
    float d = readDepth(vUv);
    float dx = readDepth(vUv + vec2(uTexel.x, 0.0)) - readDepth(vUv - vec2(uTexel.x, 0.0));
    float dy = readDepth(vUv + vec2(0.0, uTexel.y)) - readDepth(vUv - vec2(0.0, uTexel.y));

    float effect = clamp(uStrength, 0.0, 1.0);
    vec3 normal = normalize(vec3(-dx * uStrength * 6.0, -dy * uStrength * 6.0, 1.0));
    float diffuse = max(dot(normal, normalize(vec3(-0.35, 0.55, 0.75))), 0.0);
    float shade = mix(1.0, 0.86 + 0.14 * diffuse, effect);
    float fog = (1.0 - smoothstep(0.0, 0.55, d)) * 0.22 * effect;

    vec3 color = mix(base * shade, uFogColor, fog);
    gl_FragColor = vec4(color, 1.0);

    #include <colorspace_fragment>
  }
`

export function createDepthTexture(depth: DepthMap): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = depth.width
  canvas.height = depth.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create a canvas for the depth texture.')
  }

  context.putImageData(
    new ImageData(depthToRgba(depth.data), depth.width, depth.height),
    0,
    0,
  )

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = NoColorSpace
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.flipY = true
  texture.needsUpdate = true
  return texture
}

export function createDepthMaterial(options: {
  image: Texture
  depth: DepthMap
  depthTexture: Texture
  strength: number
}): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uImage: { value: options.image },
      uDepth: { value: options.depthTexture },
      uStrength: { value: options.strength },
      uTexel: {
        value: new Vector2(1 / options.depth.width, 1 / options.depth.height),
      },
      uFogColor: { value: new Color(0x0a0a0b) },
    },
    vertexShader,
    fragmentShader,
    toneMapped: false,
  })
}
