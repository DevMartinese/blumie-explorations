import {
  Fn, float, vec2, vec3, vec4, uniform, uv, time, screenUV,
  normalLocal, sin, cos, floor, fract, abs, max, min, mix,
  smoothstep, step, dot, normalize, length, hash,
  select, mod, pow, clamp,
} from 'three/tsl'

// --- Shared utilities ---

const valueNoise3 = Fn(([x, y, z]) => {
  const ix = floor(x)
  const iy = floor(y)
  const iz = floor(z)
  const fx_raw = x.sub(ix)
  const fy_raw = y.sub(iy)
  const fz_raw = z.sub(iz)
  // Hermite fade
  const fx = fx_raw.mul(fx_raw).mul(fx_raw).mul(fx_raw.mul(fx_raw.mul(6).sub(15)).add(10))
  const fy = fy_raw.mul(fy_raw).mul(fy_raw).mul(fy_raw.mul(fy_raw.mul(6).sub(15)).add(10))
  const fz = fz_raw.mul(fz_raw).mul(fz_raw).mul(fz_raw.mul(fz_raw.mul(6).sub(15)).add(10))

  const h = (a, b, c) => hash(sin(a.mul(127.1).add(b.mul(311.7)).add(c.mul(74.7))).mul(43758.5453))

  const c000 = h(ix, iy, iz)
  const c100 = h(ix.add(1), iy, iz)
  const c010 = h(ix, iy.add(1), iz)
  const c110 = h(ix.add(1), iy.add(1), iz)
  const c001 = h(ix, iy, iz.add(1))
  const c101 = h(ix.add(1), iy, iz.add(1))
  const c011 = h(ix, iy.add(1), iz.add(1))
  const c111 = h(ix.add(1), iy.add(1), iz.add(1))

  return mix(
    mix(mix(c000, c100, fx), mix(c010, c110, fx), fy),
    mix(mix(c001, c101, fx), mix(c011, c111, fx), fy),
    fz
  )
})

const fbm4 = Fn(([x_in, y_in, z_in]) => {
  const v = float(0).toVar()
  const a = float(0.5).toVar()
  const px = x_in.toVar()
  const py = y_in.toVar()
  const pz = z_in.toVar()
  // Unrolled 4 octaves
  v.addAssign(a.mul(valueNoise3(px, py, pz)))
  px.mulAssign(2); py.mulAssign(2); pz.mulAssign(2); a.mulAssign(0.5)
  v.addAssign(a.mul(valueNoise3(px, py, pz)))
  px.mulAssign(2); py.mulAssign(2); pz.mulAssign(2); a.mulAssign(0.5)
  v.addAssign(a.mul(valueNoise3(px, py, pz)))
  px.mulAssign(2); py.mulAssign(2); pz.mulAssign(2); a.mulAssign(0.5)
  v.addAssign(a.mul(valueNoise3(px, py, pz)))
  return v
})

const GRID_SIZE = 100.0
const TILE_RATIO = 0.857

const sdRoundRect = Fn(([uv_in, s, r]) => {
  const d = abs(uv_in.sub(vec2(0.5))).sub(s).add(r)
  return length(max(d, vec2(0))).add(min(max(d.x, d.y), 0)).sub(r)
})

const sdCircle = Fn(([uv_in, r]) => {
  return length(uv_in.sub(vec2(0.5))).sub(r)
})

const sdDash = Fn(([uv_in, w, h]) => {
  const d = abs(uv_in.sub(vec2(0.5))).sub(vec2(w, h))
  return max(d.x, d.y)
})

const cellUv = (pos) => fract(pos.mul(GRID_SIZE))

// --- Shader 1: Waves ---
export function createWavesShader() {
  return Fn(() => {
    const pos = screenUV
    const blueBg = vec3(0.333, 0.4, 0.8)
    const baseBg = vec3(0.847, 0.863, 0.91)
    const blueLight = vec3(0.44, 0.5, 0.867)
    const grayTile = vec3(0.753, 0.776, 0.831)
    const grayDot = vec3(0.565, 0.596, 0.69)
    const whiteBg = vec3(0.91, 0.925, 0.957)

    const ns = float(5.0)
    const t = time.mul(0.08)
    const wave = fbm4(pos.x.mul(0.7).mul(ns).add(10), pos.y.mul(1.8).mul(ns).add(10), t)
    const wave2 = fbm4(pos.x.mul(0.5).mul(ns).add(200), pos.y.mul(1.5).mul(ns).add(200), t.mul(0.7))
    const combined = wave.mul(0.6).add(wave2.mul(0.4))

    const scatter = valueNoise3(pos.x.mul(20).add(500), pos.y.mul(20).add(500), time.mul(0.12))

    const cu = cellUv(pos)
    const tileHalf = float(TILE_RATIO * 0.5)
    const tile = sdRoundRect(cu, tileHalf, float(0.06))
    const dotSdf = sdCircle(cu, float(0.08))

    const isBlue = combined.greaterThan(0.48)
    const isScatter = combined.greaterThan(0.40).and(scatter.greaterThan(0.55))
    const edgeDist = abs(combined.sub(0.48))
    const isEdgeWhite = edgeDist.lessThan(0.02).and(scatter.greaterThan(0.45))
    const inTile = tile.lessThan(0)
    const inDot = dotSdf.lessThan(0)

    // Blue region
    const blueResult = select(inTile, select(inDot, blueLight, blueBg), baseBg)
    // Scatter region
    const scatterResult = select(inTile, mix(blueLight, blueBg, 0.2), baseBg)
    // Edge white region
    const edgeResult = select(inTile, whiteBg, baseBg)
    // Gray region
    const grayResult = select(inTile, select(inDot, grayDot, grayTile), baseBg)

    const result = select(isBlue, blueResult,
      select(isScatter, scatterResult,
        select(isEdgeWhite, edgeResult, grayResult)))

    return vec4(result, 1)
  })()
}

// --- Shader 2: Terrain ---
export function createTerrainShader() {
  return Fn(() => {
    const pos = screenUV
    const coral = vec3(0.878, 0.471, 0.314)
    const peach = vec3(0.961, 0.867, 0.816)

    const ns = float(5.0)
    const gradient = pos.x.mul(0.5).add(pos.y.mul(0.5))
    const noise = fbm4(pos.x.mul(ns).add(50), pos.y.mul(ns).add(50), time.mul(0.06))
    const elev = gradient.mul(0.55).add(noise.mul(0.45))

    const detail = valueNoise3(pos.x.mul(25).add(333), pos.y.mul(25).add(333), time.mul(0.1))

    const cu = cellUv(pos)
    const alpha = float(0.5).add(elev.mul(0.5))

    // Shape SDFs
    const smallDot = sdCircle(cu, float(0.1))
    const medDot = sdCircle(cu, float(0.18))
    const dash = sdDash(cu, float(0.22), float(0.08))
    const smallSq = sdRoundRect(cu, float(0.15), float(0.03))
    const medSq = sdRoundRect(cu, float(0.2), float(0.04))
    const lgSq = sdRoundRect(cu, float(0.3), float(0.05))

    const filledColor = mix(peach, coral, alpha)

    // Pick shape by elevation band
    const shape7 = select(detail.greaterThan(0.5), lgSq, select(detail.greaterThan(0.3), medSq, smallSq))
    const shape6 = select(detail.greaterThan(0.55), medSq, lgSq)
    const shape5 = select(detail.greaterThan(0.5), smallSq, medSq)
    const shape4 = select(detail.greaterThan(0.6), dash, smallSq)
    const shape3 = select(detail.greaterThan(0.5), medDot, dash)
    const shape2 = select(detail.greaterThan(0.4), smallDot, medDot)
    const shape1 = select(detail.greaterThan(0.5), smallDot, float(1))

    const activeSdf = select(elev.greaterThan(0.75), shape7,
      select(elev.greaterThan(0.66), shape6,
        select(elev.greaterThan(0.58), shape5,
          select(elev.greaterThan(0.50), shape4,
            select(elev.greaterThan(0.42), shape3,
              select(elev.greaterThan(0.35), shape2,
                select(elev.greaterThan(0.25), shape1, float(1))))))))

    const result = select(activeSdf.lessThan(0), filledColor, peach)
    return vec4(result, 1)
  })()
}

// --- Shader 3: Flow ---
export function createFlowShader() {
  return Fn(() => {
    const pos = screenUV
    const colors = [
      vec3(0.722, 0.91, 0.627),
      vec3(0.961, 0.902, 0.627),
      vec3(0.502, 0.871, 0.69),
      vec3(1.0, 0.722, 0.847),
      vec3(0.659, 0.659, 1.0),
    ]
    const darks = [
      vec3(0.29, 0.478, 0.188),
      vec3(0.541, 0.478, 0.188),
      vec3(0.102, 0.416, 0.251),
      vec3(0.541, 0.125, 0.314),
      vec3(0.188, 0.188, 0.627),
    ]

    const ns = float(4.0)
    const t = time.mul(0.06)
    const eps = float(0.01)

    // Curl noise advection
    const n0 = fbm4(pos.x.mul(12), pos.y.mul(12), t)
    const nx = fbm4(pos.x.add(eps).mul(12), pos.y.mul(12), t)
    const ny = fbm4(pos.x.mul(12), pos.y.add(eps).mul(12), t)
    const curlX = ny.sub(n0).div(eps)
    const curlY = nx.sub(n0).div(eps).negate()
    const advX = pos.x.add(curlX.mul(0.005))
    const advY = pos.y.add(curlY.mul(0.005))

    // 5 competing regions — unrolled
    const offsets = [
      [17.0, 0.0], [34.0, 23.0], [51.0, 46.0], [68.0, 69.0], [85.0, 92.0]
    ]

    const vals = offsets.map(([ox, oy]) =>
      fbm4(advX.mul(8).add(ox), advY.mul(8).add(oy), t)
    )

    // Find best and second best
    const bestVal = float(0).toVar()
    const secondBest = float(0).toVar()
    const bestCol = vec3(colors[0]).toVar()
    const bestDark = vec3(darks[0]).toVar()

    bestVal.assign(vals[0])
    for (let i = 1; i < 5; i++) {
      const isBetter = vals[i].greaterThan(bestVal)
      secondBest.assign(select(isBetter, bestVal, select(vals[i].greaterThan(secondBest), vals[i], secondBest)))
      bestCol.assign(select(isBetter, colors[i], bestCol))
      bestDark.assign(select(isBetter, darks[i], bestDark))
      bestVal.assign(select(isBetter, vals[i], bestVal))
    }

    const edge = bestVal.sub(secondBest)
    const tileScale = select(edge.lessThan(0.02), mix(float(0.6), float(1.0), edge.div(0.02)), float(1.0))

    const cu = cellUv(pos)
    const tileHalf = float(TILE_RATIO * 0.5).mul(tileScale)
    const tile = sdRoundRect(cu, tileHalf, float(0.06).mul(tileScale))
    const dotSdf = sdCircle(cu, float(0.06))

    const inTile = tile.lessThan(0)
    const inDot = dotSdf.lessThan(0)

    const tileResult = select(inDot, bestDark, bestCol)
    const gapResult = bestCol.mul(0.85)
    const result = select(inTile, tileResult, gapResult)

    return vec4(result, 1)
  })()
}

// --- Shader 4: Dither ---
export function createDitherShader() {
  return Fn(() => {
    // Diffuse lighting
    const lightDir = normalize(vec3(0.5, 0.8, 0.6))
    const diffuse = max(dot(normalLocal, lightDir), 0).mul(0.6).add(0.4)

    // Bayer 4x4 ordered dither
    const gridPos = screenUV.mul(GRID_SIZE)
    const cx = mod(floor(gridPos.x), 4)
    const cy = mod(floor(gridPos.y), 4)
    const idx = cy.mul(4).add(cx)

    // Approximate Bayer matrix via math (avoid arrays)
    // threshold = ((idx * 13 + 7) % 16) / 16
    const threshold = fract(idx.mul(13).add(7).div(16)).mul(0.8).add(0.1)

    const lit = diffuse.greaterThan(threshold)

    const bright = vec3(0.961, 0.635, 0.439) // coral/orange
    const dark = vec3(0.18, 0.12, 0.08)

    const result = select(lit, bright, dark)
    return vec4(result, 1)
  })()
}
