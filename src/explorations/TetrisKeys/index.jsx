import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './TetrisKeys.css'

const BG = '#0C2AEA'
const GRID = 40
const TILE_SIZE = 34
const RADIUS = 6
const DOT_COLOR = 'rgba(255,255,255,0.5)'
const DOT_R = 1.5
const FONT = 'bold 14px monospace'

const SPRING_STIFFNESS = 300
const SPRING_DAMPING = 18

const DROP_INTERVAL = 0.4
const SPAWN_DELAY = 0.3
const CLEAR_FLASH_DURATION = 0.15
const CLEAR_SCALE_DURATION = 0.3
const CLEAR_TOTAL_DURATION = 0.45

const TILE_STYLES = [
  { bg: '#fff', color: '#000', weight: 4 },
  { bg: '#111', color: '#fff', weight: 1 },
  { bg: '#FF6B35', color: '#000', weight: 1 },
  { bg: '#FFD700', color: '#000', weight: 1 },
  { bg: '#FF69B4', color: '#000', weight: 1 },
  { bg: 'rgba(180,190,255,0.4)', color: '#fff', weight: 1 },
]

const SYMBOLS = ['*', '0', '/', '↗', '1', '3', '8']

const TETROMINOS = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  L: [[1, 0], [1, 0], [1, 1]],
  J: [[0, 1], [0, 1], [1, 1]],
}

const PIECE_NAMES = Object.keys(TETROMINOS)

function rotate(matrix) {
  const rows = matrix.length
  const cols = matrix[0].length
  const result = []
  for (let c = 0; c < cols; c++) {
    const newRow = []
    for (let r = rows - 1; r >= 0; r--) {
      newRow.push(matrix[r][c])
    }
    result.push(newRow)
  }
  return result
}

function getRotations(matrix) {
  const rotations = [matrix]
  let current = matrix
  for (let i = 0; i < 3; i++) {
    current = rotate(current)
    rotations.push(current)
  }
  return rotations
}

const ALL_ROTATIONS = {}
for (const name of PIECE_NAMES) {
  ALL_ROTATIONS[name] = getRotations(TETROMINOS[name])
}

function pickWeighted(styles) {
  const total = styles.reduce((s, t) => s + t.weight, 0)
  let r = Math.random() * total
  for (const style of styles) {
    r -= style.weight
    if (r <= 0) return { bg: style.bg, color: style.color }
  }
  return { bg: styles[0].bg, color: styles[0].color }
}

function pickSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
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

function springStep(tile, dt) {
  if (tile.scale >= 0.999 && Math.abs(tile.scaleV) < 0.001) {
    tile.scale = 1
    tile.scaleV = 0
    return
  }
  const displacement = tile.scale - 1
  const springForce = -SPRING_STIFFNESS * displacement
  const dampingForce = -SPRING_DAMPING * tile.scaleV
  tile.scaleV += (springForce + dampingForce) * dt
  tile.scale += tile.scaleV * dt
}

function createBoard(rows, cols) {
  const board = []
  for (let r = 0; r < rows; r++) {
    board.push(new Array(cols).fill(null))
  }
  return board
}

function spawnPiece(cols) {
  const name = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)]
  const rotation = Math.floor(Math.random() * 4)
  const shape = ALL_ROTATIONS[name][rotation]
  const pieceWidth = shape[0].length
  const col = Math.floor(Math.random() * (cols - pieceWidth + 1))

  const tiles = []
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const style = pickWeighted(TILE_STYLES)
        tiles.push({
          dr: r,
          dc: c,
          ...style,
          symbol: pickSymbol(),
        })
      }
    }
  }

  return { name, rotation, col, row: 0, shape, tiles }
}

function collides(piece, board, rows, cols, offsetR = 0, offsetC = 0) {
  const shape = piece.shape
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const br = piece.row + r + offsetR
      const bc = piece.col + c + offsetC
      if (br >= rows || bc < 0 || bc >= cols) return true
      if (br >= 0 && board[br][bc]) return true
    }
  }
  return false
}

function lockPiece(piece, board) {
  for (const tile of piece.tiles) {
    const br = piece.row + tile.dr
    const bc = piece.col + tile.dc
    if (br >= 0 && br < board.length && bc >= 0 && bc < board[0].length) {
      board[br][bc] = {
        bg: tile.bg,
        color: tile.color,
        symbol: tile.symbol,
        scale: 0.01,
        scaleV: 0,
      }
    }
  }
}

function getGhostRow(piece, board, rows, cols) {
  let offset = 0
  while (!collides(piece, board, rows, cols, offset + 1, 0)) {
    offset++
  }
  return piece.row + offset
}

export default function TetrisKeys() {
  const canvasRef = useRef(null)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  const boardRef = useRef(null)
  const currentPieceRef = useRef(null)
  const dropTimerRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const clearingRowsRef = useRef([])
  const boardDimsRef = useRef({ rows: 0, cols: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const cols = Math.floor(window.innerWidth / GRID)
      const rows = Math.floor(window.innerHeight / GRID)
      boardDimsRef.current = { rows, cols }

      if (!boardRef.current || boardRef.current.length !== rows || boardRef.current[0]?.length !== cols) {
        boardRef.current = createBoard(rows, cols)
        currentPieceRef.current = null
        clearingRowsRef.current = []
        dropTimerRef.current = 0
        spawnTimerRef.current = 0
      }
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (now) => {
      const dt = Math.min((now - (lastTimeRef.current || now)) / 1000, 0.05)
      lastTimeRef.current = now

      const w = window.innerWidth
      const h = window.innerHeight
      const { rows, cols } = boardDimsRef.current
      const board = boardRef.current

      if (!board) {
        frameRef.current = requestAnimationFrame(draw)
        return
      }

      // --- Handle clearing rows animation ---
      const clearing = clearingRowsRef.current
      let clearingDone = false
      for (let i = clearing.length - 1; i >= 0; i--) {
        clearing[i].timer += dt
        if (clearing[i].timer >= CLEAR_TOTAL_DURATION) {
          clearingDone = true
        }
      }

      if (clearingDone) {
        // Remove completed rows and collapse
        const rowsToRemove = new Set()
        const remaining = []
        for (const cr of clearing) {
          if (cr.timer >= CLEAR_TOTAL_DURATION) {
            rowsToRemove.add(cr.row)
          } else {
            remaining.push(cr)
          }
        }
        clearingRowsRef.current = remaining

        if (rowsToRemove.size > 0) {
          // Build new board without cleared rows
          const newBoard = []
          for (let r = 0; r < rows; r++) {
            if (!rowsToRemove.has(r)) {
              newBoard.push(board[r])
            }
          }
          // Add empty rows at top
          while (newBoard.length < rows) {
            newBoard.unshift(new Array(cols).fill(null))
          }
          // Apply spring animation to tiles that fell
          for (const removedRow of rowsToRemove) {
            for (let r = 0; r < removedRow; r++) {
              for (let c = 0; c < cols; c++) {
                // Find this tile in the new board (it shifted down)
                // Tiles above removed rows get a spring bump
              }
            }
          }
          // Give falling tiles a spring bump
          const sortedRemoved = [...rowsToRemove].sort((a, b) => a - b)
          const lowestRemoved = sortedRemoved[sortedRemoved.length - 1]
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (newBoard[r][c] && r <= lowestRemoved) {
                newBoard[r][c].scale = 0.85
                newBoard[r][c].scaleV = 2
              }
            }
          }
          boardRef.current = newBoard
        }
      }

      // --- Spawn / drop piece ---
      if (!currentPieceRef.current && clearing.length === 0) {
        spawnTimerRef.current += dt
        if (spawnTimerRef.current >= SPAWN_DELAY) {
          spawnTimerRef.current = 0
          const piece = spawnPiece(cols)
          if (collides(piece, boardRef.current, rows, cols)) {
            // Board full — reset
            boardRef.current = createBoard(rows, cols)
            currentPieceRef.current = null
          } else {
            currentPieceRef.current = piece
            dropTimerRef.current = 0
          }
        }
      }

      if (currentPieceRef.current && clearing.length === 0) {
        dropTimerRef.current += dt
        while (dropTimerRef.current >= DROP_INTERVAL && currentPieceRef.current) {
          dropTimerRef.current -= DROP_INTERVAL
          const piece = currentPieceRef.current

          if (!collides(piece, boardRef.current, rows, cols, 1, 0)) {
            piece.row++
          } else {
            // Lock piece
            lockPiece(piece, boardRef.current)
            currentPieceRef.current = null

            // Check for complete rows
            for (let r = 0; r < rows; r++) {
              let full = true
              for (let c = 0; c < cols; c++) {
                if (!boardRef.current[r][c]) { full = false; break }
              }
              if (full) {
                clearingRowsRef.current.push({ row: r, timer: 0 })
              }
            }
          }
        }
      }

      // --- Animate board tiles ---
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tile = boardRef.current[r]?.[c]
          if (tile) springStep(tile, dt)
        }
      }

      // --- Render ---
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

      ctx.font = FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Draw ghost piece
      const piece = currentPieceRef.current
      if (piece) {
        const ghostRow = getGhostRow(piece, boardRef.current, rows, cols)
        for (const tile of piece.tiles) {
          const gr = ghostRow + tile.dr
          const gc = piece.col + tile.dc
          const cx = (gc + 0.5) * GRID
          const cy = (gr + 0.5) * GRID

          ctx.globalAlpha = 0.15
          ctx.fillStyle = tile.bg
          roundRect(ctx, cx - TILE_SIZE / 2, cy - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, RADIUS)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      // Draw board
      const clearingSet = new Set(clearing.map(cr => cr.row))
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tile = boardRef.current[r]?.[c]
          if (!tile) continue

          const cx = (c + 0.5) * GRID
          const cy = (r + 0.5) * GRID
          const s = tile.scale
          const size = TILE_SIZE * s

          let alpha = Math.min(s / 0.3, 1)

          // Clearing animation
          if (clearingSet.has(r)) {
            const cr = clearing.find(x => x.row === r)
            if (cr) {
              const t = cr.timer
              // Flash white
              if (t < CLEAR_FLASH_DURATION) {
                const flashAlpha = 1 - t / CLEAR_FLASH_DURATION
                // Draw white flash overlay after tile
                ctx.globalAlpha = alpha
                ctx.fillStyle = tile.bg
                roundRect(ctx, cx - size / 2, cy - size / 2, size, size, RADIUS * s)
                ctx.fill()

                if (s > 0.4) {
                  ctx.fillStyle = tile.color
                  ctx.save()
                  ctx.translate(cx, cy + 1)
                  ctx.scale(s, s)
                  ctx.fillText(tile.symbol, 0, 0)
                  ctx.restore()
                }

                ctx.globalAlpha = flashAlpha
                ctx.fillStyle = '#fff'
                roundRect(ctx, cx - size / 2, cy - size / 2, size, size, RADIUS * s)
                ctx.fill()
                ctx.globalAlpha = 1
                continue
              }
              // Scale down
              const scaleT = (t - CLEAR_FLASH_DURATION) / CLEAR_SCALE_DURATION
              const clearScale = Math.max(0, 1 - scaleT)
              const finalSize = TILE_SIZE * clearScale
              alpha *= clearScale

              ctx.globalAlpha = alpha
              ctx.fillStyle = tile.bg
              roundRect(ctx, cx - finalSize / 2, cy - finalSize / 2, finalSize, finalSize, RADIUS * clearScale)
              ctx.fill()

              if (clearScale > 0.4) {
                ctx.fillStyle = tile.color
                ctx.save()
                ctx.translate(cx, cy + 1)
                ctx.scale(clearScale, clearScale)
                ctx.fillText(tile.symbol, 0, 0)
                ctx.restore()
              }
              ctx.globalAlpha = 1
              continue
            }
          }

          ctx.globalAlpha = alpha
          ctx.fillStyle = tile.bg
          roundRect(ctx, cx - size / 2, cy - size / 2, size, size, RADIUS * s)
          ctx.fill()

          if (s > 0.4) {
            ctx.fillStyle = tile.color
            ctx.save()
            ctx.translate(cx, cy + 1)
            ctx.scale(s, s)
            ctx.fillText(tile.symbol, 0, 0)
            ctx.restore()
          }
        }
      }

      // Draw current piece
      if (piece) {
        for (const tile of piece.tiles) {
          const pr = piece.row + tile.dr
          const pc = piece.col + tile.dc
          const cx = (pc + 0.5) * GRID
          const cy = (pr + 0.5) * GRID

          ctx.globalAlpha = 1
          ctx.fillStyle = tile.bg
          roundRect(ctx, cx - TILE_SIZE / 2, cy - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, RADIUS)
          ctx.fill()

          ctx.fillStyle = tile.color
          ctx.fillText(tile.symbol, cx, cy + 1)
        }
      }

      ctx.globalAlpha = 1
      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="tetris-keys-back">← Back</Link>
      </motion.div>
      <canvas ref={canvasRef} className="tetris-keys-canvas" />
    </>
  )
}
