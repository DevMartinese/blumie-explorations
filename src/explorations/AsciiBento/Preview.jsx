import { useEffect, useRef } from 'react'

function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
function lerp(a, b, t) { return a + (b - a) * t }

function valueNoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz)
  return lerp(
    lerp(
      lerp(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx),
      lerp(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx),
      fy
    ),
    lerp(
      lerp(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx),
      lerp(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx),
      fy
    ),
    fz
  )
}

function fbm(x, y, z, octaves) {
  let v = 0, a = 0.5
  for (let i = 0; i < octaves; i++) {
    v += a * valueNoise3(x, y, z)
    x *= 2; y *= 2; z *= 2; a *= 0.5
  }
  return v
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export default function AsciiBentoPreview() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const w = rect.width
    const h = rect.height
    const gap = 3
    const pad = 4
    const t = 2.5

    // Background
    ctx.fillStyle = '#D0D0D0'
    ctx.fillRect(0, 0, w, h)

    // Bento cell dimensions
    const innerW = w - pad * 2 - gap
    const innerH = h - pad * 2 - gap
    const topH = innerH * 0.58
    const botH = innerH - topH
    const leftW = innerW * 0.4
    const rightW = innerW - leftW

    const cellR = 3

    // ─── Top-left: Terrain ───
    const tlx = pad, tly = pad
    ctx.save()
    roundRect(ctx, tlx, tly, leftW, topH, cellR)
    ctx.clip()
    ctx.fillStyle = '#F5DDD0'
    ctx.fillRect(tlx, tly, leftW, topH)

    const terrainCell = 4
    const terrainCols = Math.ceil(leftW / terrainCell)
    const terrainRows = Math.ceil(topH / terrainCell)
    ctx.fillStyle = '#E07850'
    for (let row = 0; row < terrainRows; row++) {
      for (let col = 0; col < terrainCols; col++) {
        const px = tlx + col * terrainCell
        const py = tly + row * terrainCell
        const gradient = (col / terrainCols + row / terrainRows) / 2
        const n = fbm(px * 0.02 + 50, py * 0.02 + 50, t * 0.06, 3)
        const elev = gradient * 0.55 + n * 0.45
        if (elev > 0.35) {
          ctx.globalAlpha = 0.4 + elev * 0.5
          const s = terrainCell * (0.2 + elev * 0.4)
          ctx.fillRect(px + (terrainCell - s) / 2, py + (terrainCell - s) / 2, s, s)
        }
      }
    }
    ctx.globalAlpha = 1
    ctx.restore()

    // ─── Top-right: Flow ───
    const trx = pad + leftW + gap, tryy = pad
    ctx.save()
    roundRect(ctx, trx, tryy, rightW, topH, cellR)
    ctx.clip()
    ctx.fillStyle = '#E8E0C8'
    ctx.fillRect(trx, tryy, rightW, topH)

    const flowCell = 4
    const flowTile = 3
    const flowCols = Math.ceil(rightW / flowCell)
    const flowRows = Math.ceil(topH / flowCell)
    const regions = [
      '#B8E8A0', '#F5E6A0', '#80DEB0', '#FFB8D8', '#A8A8FF',
    ]
    for (let row = 0; row < flowRows; row++) {
      for (let col = 0; col < flowCols; col++) {
        const px = trx + col * flowCell
        const py = tryy + row * flowCell
        const nx = px * 0.015
        const ny = py * 0.015
        let bestIdx = 0, bestVal = -1
        for (let i = 0; i < regions.length; i++) {
          const ox = hash3(i * 73.1, i * 37.9, 0) * 500
          const oy = hash3(i * 91.3, i * 53.1, 0) * 500
          const n = fbm(nx + ox, ny + oy, t * 0.12, 3)
          if (n > bestVal) { bestVal = n; bestIdx = i }
        }
        ctx.fillStyle = regions[bestIdx]
        const off = (flowCell - flowTile) / 2
        roundRect(ctx, px + off, py + off, flowTile, flowTile, 1)
        ctx.fill()
      }
    }
    ctx.restore()

    // ─── Bottom: Waves ───
    const bx = pad, by = pad + topH + gap
    const bw = w - pad * 2
    ctx.save()
    roundRect(ctx, bx, by, bw, botH, cellR)
    ctx.clip()
    ctx.fillStyle = '#D8DCE8'
    ctx.fillRect(bx, by, bw, botH)

    const wavesCell = 4
    const wavesTile = 3
    const wavesCols = Math.ceil(bw / wavesCell)
    const wavesRows = Math.ceil(botH / wavesCell)
    for (let row = 0; row < wavesRows; row++) {
      for (let col = 0; col < wavesCols; col++) {
        const px = bx + col * wavesCell
        const py = by + row * wavesCell
        const nx = px * 0.018
        const ny = py * 0.018
        const wave = fbm(nx * 0.7 + 10, ny * 1.8 + 10, t * 0.08, 3)
        const wave2 = fbm(nx * 0.5 + 200, ny * 1.5 + 200, t * 0.056, 2)
        const combined = wave * 0.6 + wave2 * 0.4

        if (combined > 0.52) {
          ctx.fillStyle = '#5566CC'
          const off = (wavesCell - wavesTile) / 2
          roundRect(ctx, px + off, py + off, wavesTile, wavesTile, 1)
          ctx.fill()
        } else {
          ctx.globalAlpha = 0.3
          ctx.fillStyle = '#9098B0'
          ctx.beginPath()
          ctx.arc(px + wavesCell / 2, py + wavesCell / 2, 0.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
    }
    ctx.restore()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
