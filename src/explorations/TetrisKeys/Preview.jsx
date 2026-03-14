import { useEffect, useRef } from 'react'

const BG = '#0C2AEA'
const GRID = 14
const DOT_COLOR = 'rgba(255,255,255,0.5)'
const DOT_R = 0.6
const TILE_SIZE = 10
const RADIUS = 2
const FONT = 'bold 5px monospace'

const TILE_STYLES = [
  { bg: '#fff', color: '#000' },
  { bg: '#fff', color: '#000' },
  { bg: '#fff', color: '#000' },
  { bg: '#111', color: '#fff' },
  { bg: '#FF6B35', color: '#000' },
  { bg: '#FFD700', color: '#000' },
  { bg: '#FF69B4', color: '#000' },
  { bg: 'rgba(180,190,255,0.4)', color: '#fff' },
]

const SYMBOLS = ['*', '0', '/', '↗', '1', '3', '8']

const TETROMINOS = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
  [[1, 0], [1, 0], [1, 1]],
  [[0, 1], [0, 1], [1, 1]],
]

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

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateBoard() {
  const rand = seededRandom(77)
  const cols = 20
  const rows = 12
  const board = []
  for (let r = 0; r < rows; r++) {
    board.push(new Array(cols).fill(null))
  }

  // Place some pieces stacked at the bottom
  function placePiece(shape, startCol, startRow) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue
        const br = startRow + r
        const bc = startCol + c
        if (br >= 0 && br < rows && bc >= 0 && bc < cols && !board[br][bc]) {
          const style = TILE_STYLES[Math.floor(rand() * TILE_STYLES.length)]
          board[br][bc] = {
            ...style,
            symbol: SYMBOLS[Math.floor(rand() * SYMBOLS.length)],
          }
        }
      }
    }
  }

  // Bottom rows — mostly filled (row 11 almost complete, row 10 partial)
  // Fill bottom row almost completely (leave 1-2 gaps)
  for (let c = 0; c < cols; c++) {
    if (c === 7 || c === 15) continue // gaps
    const style = TILE_STYLES[Math.floor(rand() * TILE_STYLES.length)]
    board[rows - 1][c] = { ...style, symbol: SYMBOLS[Math.floor(rand() * SYMBOLS.length)] }
  }

  // Row 10 — partial fill
  for (let c = 0; c < cols; c++) {
    if (rand() < 0.4) continue
    const style = TILE_STYLES[Math.floor(rand() * TILE_STYLES.length)]
    board[rows - 2][c] = { ...style, symbol: SYMBOLS[Math.floor(rand() * SYMBOLS.length)] }
  }

  // Some scattered pieces higher up
  placePiece(TETROMINOS[0], 2, rows - 4) // I piece
  placePiece(TETROMINOS[1], 8, rows - 4) // O piece
  placePiece(TETROMINOS[2], 14, rows - 4) // T piece
  placePiece(TETROMINOS[5], 5, rows - 6) // L piece
  placePiece(TETROMINOS[3], 12, rows - 5) // S piece

  // A falling piece at mid-height
  const fallingPiece = {
    shape: TETROMINOS[2], // T piece
    col: 9,
    row: 3,
    tiles: [],
  }
  for (let r = 0; r < fallingPiece.shape.length; r++) {
    for (let c = 0; c < fallingPiece.shape[r].length; c++) {
      if (fallingPiece.shape[r][c]) {
        const style = TILE_STYLES[Math.floor(rand() * TILE_STYLES.length)]
        fallingPiece.tiles.push({
          dr: r,
          dc: c,
          ...style,
          symbol: SYMBOLS[Math.floor(rand() * SYMBOLS.length)],
        })
      }
    }
  }

  return { board, rows, cols, fallingPiece }
}

export default function TetrisKeysPreview() {
  const canvasRef = useRef(null)
  const dataRef = useRef(null)

  if (!dataRef.current) {
    dataRef.current = generateBoard()
  }

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

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)

    // Dot grid
    ctx.fillStyle = DOT_COLOR
    for (let x = GRID; x < w; x += GRID) {
      for (let y = GRID; y < h; y += GRID) {
        ctx.beginPath()
        ctx.arc(x, y, DOT_R, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const { board, rows, cols, fallingPiece } = dataRef.current
    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Draw board tiles
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = board[r][c]
        if (!tile) continue

        const cx = (c + 0.5) * GRID
        const cy = (r + 0.5) * GRID

        ctx.globalAlpha = 1
        ctx.fillStyle = tile.bg
        roundRect(ctx, cx - TILE_SIZE / 2, cy - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, RADIUS)
        ctx.fill()

        ctx.fillStyle = tile.color
        ctx.fillText(tile.symbol, cx, cy + 0.5)
      }
    }

    // Draw ghost (landing preview)
    let ghostRow = fallingPiece.row
    while (true) {
      let canDrop = true
      for (let r = 0; r < fallingPiece.shape.length; r++) {
        for (let c = 0; c < fallingPiece.shape[r].length; c++) {
          if (!fallingPiece.shape[r][c]) continue
          const br = ghostRow + 1 + r
          const bc = fallingPiece.col + c
          if (br >= rows || (br >= 0 && board[br][bc])) canDrop = false
        }
      }
      if (!canDrop) break
      ghostRow++
    }

    for (const tile of fallingPiece.tiles) {
      const gr = ghostRow + tile.dr
      const gc = fallingPiece.col + tile.dc
      const cx = (gc + 0.5) * GRID
      const cy = (gr + 0.5) * GRID

      ctx.globalAlpha = 0.15
      ctx.fillStyle = tile.bg
      roundRect(ctx, cx - TILE_SIZE / 2, cy - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, RADIUS)
      ctx.fill()
    }

    // Draw falling piece
    for (const tile of fallingPiece.tiles) {
      const pr = fallingPiece.row + tile.dr
      const pc = fallingPiece.col + tile.dc
      const cx = (pc + 0.5) * GRID
      const cy = (pr + 0.5) * GRID

      ctx.globalAlpha = 1
      ctx.fillStyle = tile.bg
      roundRect(ctx, cx - TILE_SIZE / 2, cy - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, RADIUS)
      ctx.fill()

      ctx.fillStyle = tile.color
      ctx.fillText(tile.symbol, cx, cy + 0.5)
    }

    ctx.globalAlpha = 1
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
