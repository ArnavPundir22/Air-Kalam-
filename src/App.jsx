import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import './App.css'

const BOARD_WIDTH = 1280
const BOARD_HEIGHT = 720
const DRAW_GESTURE = [0, 1, 0, 0, 0]
const PAUSE_GESTURE = [0, 1, 1, 0, 0]
const CLEAR_GESTURE = [1, 1, 1, 1, 1]
const ERASER_GESTURE = [0, 0, 0, 0, 1]

const COLORS = [
  { name: 'Red', rgb: [255, 0, 0], hex: '#ff0000' },
  { name: 'Green', rgb: [0, 255, 0], hex: '#00ff00' },
  { name: 'Blue', rgb: [0, 0, 255], hex: '#0000ff' },
  { name: 'Yellow', rgb: [255, 255, 0], hex: '#ffff00' },
  { name: 'Black', rgb: [0, 0, 0], hex: '#000000' },
]

const ERASER = { name: 'Eraser', rgb: [255, 255, 255], hex: '#ffffff' }

const sameGesture = (a, b) => a.length === b.length && a.every((value, index) => value === b[index])

const getFingerStates = (landmarks) => {
  const fingers = []
  fingers.push(landmarks[4].x > landmarks[3].x ? 1 : 0)

  const tipIds = [8, 12, 16, 20]
  const pipIds = [6, 10, 14, 18]
  tipIds.forEach((tipId, index) => {
    fingers.push(landmarks[tipId].y < landmarks[pipIds[index]].y ? 1 : 0)
  })

  return fingers
}

function App() {
  const videoRef = useRef(null)
  const displayCanvasRef = useRef(null)
  const boardCanvasRef = useRef(null)
  const boardContextRef = useRef(null)
  const handLandmarkerRef = useRef(null)
  const animationFrameRef = useRef(null)
  const streamRef = useRef(null)
  const lastVideoTimeRef = useRef(-1)
  const previousPointRef = useRef(null)
  const penColorRef = useRef(COLORS[2])
  const brushSizeRef = useRef(7)
  const drawingRef = useRef(false)
  const statusRef = useRef('Ready')
  const currentToolRef = useRef(COLORS[2].name)

  const [status, setStatus] = useState('Ready')
  const [currentTool, setCurrentTool] = useState(COLORS[2].name)
  const [currentToolHex, setCurrentToolHex] = useState(COLORS[2].hex)
  const [brushSize, setBrushSize] = useState(7)
  const [theme, setTheme] = useState('dark')
  const [cameraReady, setCameraReady] = useState(false)

  const updateStatus = useCallback((nextStatus) => {
    if (statusRef.current !== nextStatus) {
      statusRef.current = nextStatus
      setStatus(nextStatus)
    }
  }, [])

  const updateTool = useCallback((tool) => {
    if (currentToolRef.current !== tool.name) {
      currentToolRef.current = tool.name
      setCurrentTool(tool.name)
      setCurrentToolHex(tool.hex)
    }
  }, [])

  const clearBoard = useCallback(() => {
    if (!boardContextRef.current) return
    boardContextRef.current.fillStyle = '#ffffff'
    boardContextRef.current.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)
    previousPointRef.current = null
    updateStatus('Canvas cleared')
  }, [updateStatus])

  const setPenFromPalette = useCallback(
    (color) => {
      penColorRef.current = color
      updateTool(color)
      updateStatus('Pen color changed')
    },
    [updateStatus, updateTool],
  )

  const saveBoard = useCallback(() => {
    if (!boardCanvasRef.current) return
    const link = document.createElement('a')
    link.href = boardCanvasRef.current.toDataURL('image/png')
    link.download = 'drawing.png'
    link.click()
    updateStatus('Drawing downloaded as PNG')
  }, [updateStatus])

  useEffect(() => {
    brushSizeRef.current = brushSize
  }, [brushSize])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const boardCanvas = document.createElement('canvas')
    boardCanvas.width = BOARD_WIDTH
    boardCanvas.height = BOARD_HEIGHT

    const boardContext = boardCanvas.getContext('2d')
    boardContext.fillStyle = '#ffffff'
    boardContext.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)

    boardCanvasRef.current = boardCanvas
    boardContextRef.current = boardContext
  }, [])

  useEffect(() => {
    let isMounted = true

    const drawDisplay = (cursorPoint) => {
      const canvas = displayCanvasRef.current
      const board = boardCanvasRef.current
      if (!canvas || !board) return

      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const scale = Math.min(canvas.width / BOARD_WIDTH, canvas.height / BOARD_HEIGHT)
      const displayWidth = Math.floor(BOARD_WIDTH * scale)
      const displayHeight = Math.floor(BOARD_HEIGHT * scale)
      const offsetX = Math.floor((canvas.width - displayWidth) / 2)
      const offsetY = Math.floor((canvas.height - displayHeight) / 2)

      ctx.drawImage(board, offsetX, offsetY, displayWidth, displayHeight)

      if (cursorPoint) {
        const cx = offsetX + Math.floor(cursorPoint.x * (displayWidth / BOARD_WIDTH))
        const cy = offsetY + Math.floor(cursorPoint.y * (displayHeight / BOARD_HEIGHT))

        ctx.beginPath()
        ctx.fillStyle = '#000000'
        ctx.arc(cx, cy, Math.max(6, brushSizeRef.current), 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.fillStyle = '#00ff00'
        ctx.arc(cx, cy, Math.max(3, Math.floor(brushSizeRef.current / 2)), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const processFrame = () => {
      const video = videoRef.current
      const handLandmarker = handLandmarkerRef.current
      const boardContext = boardContextRef.current

      if (!video || !handLandmarker || !boardContext) {
        animationFrameRef.current = requestAnimationFrame(processFrame)
        return
      }

      let cursorPoint = null
      if (video.readyState >= 2 && lastVideoTimeRef.current !== video.currentTime) {
        lastVideoTimeRef.current = video.currentTime

        const result = handLandmarker.detectForVideo(video, performance.now())
        if (result.landmarks.length > 0) {
          const mirroredLandmarks = result.landmarks[0].map((landmark) => ({
            x: 1 - landmark.x,
            y: landmark.y,
          }))

          const fingers = getFingerStates(mirroredLandmarks)
          const indexPoint = mirroredLandmarks[8]

          cursorPoint = {
            x: Math.round(indexPoint.x * BOARD_WIDTH),
            y: Math.round(indexPoint.y * BOARD_HEIGHT),
          }

          if (sameGesture(fingers, DRAW_GESTURE)) {
            drawingRef.current = true
          } else if (sameGesture(fingers, PAUSE_GESTURE)) {
            drawingRef.current = false
            previousPointRef.current = null
          } else if (sameGesture(fingers, CLEAR_GESTURE)) {
            clearBoard()
          } else if (sameGesture(fingers, ERASER_GESTURE)) {
            penColorRef.current = ERASER
            updateTool(ERASER)
            updateStatus('Eraser mode')
          }

          if (drawingRef.current && cursorPoint) {
            if (!previousPointRef.current) {
              previousPointRef.current = cursorPoint
            } else {
              boardContext.beginPath()
              boardContext.lineCap = 'round'
              boardContext.lineJoin = 'round'
              boardContext.lineWidth = brushSizeRef.current
              boardContext.strokeStyle = `rgb(${penColorRef.current.rgb.join(',')})`
              boardContext.moveTo(previousPointRef.current.x, previousPointRef.current.y)
              boardContext.lineTo(cursorPoint.x, cursorPoint.y)
              boardContext.stroke()
              previousPointRef.current = cursorPoint
            }
          }
        } else {
          previousPointRef.current = null
        }
      }

      drawDisplay(cursorPoint)
      animationFrameRef.current = requestAnimationFrame(processFrame)
    }

    const initialize = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        streamRef.current = stream

        if (!videoRef.current) return

        videoRef.current.srcObject = stream
        await videoRef.current.play()

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
        )

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          },
          numHands: 1,
          runningMode: 'VIDEO',
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        if (!isMounted) return
        setCameraReady(true)
        animationFrameRef.current = requestAnimationFrame(processFrame)
      } catch {
        updateStatus('Camera permission denied or unavailable')
      }
    }

    initialize()

    return () => {
      isMounted = false
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (handLandmarkerRef.current) handLandmarkerRef.current.close()
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop())
    }
  }, [clearBoard, updateStatus, updateTool])

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>✋🖋️ Air-Kalam (React)</h1>
        <p>Gesture-controlled virtual whiteboard in the browser.</p>
      </header>

      <main className="app-main">
        <section className="board-section">
          <canvas ref={displayCanvasRef} className="board-canvas" aria-label="Whiteboard canvas" />
        </section>

        <aside className="controls-section">
          <h2>🎨 Tools</h2>

          <div className="camera-block">
            <p>📷 Camera Preview</p>
            <video ref={videoRef} muted playsInline className="camera-preview" />
            {!cameraReady && <span className="camera-status">Waiting for camera...</span>}
          </div>

          <div className="buttons-grid">
            <button type="button" onClick={clearBoard}>
              Clear Canvas
            </button>
            <button type="button" onClick={saveBoard}>
              Save Drawing
            </button>
            <button
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            >
              Toggle Dark/Light
            </button>
          </div>

          <div className="palette">
            <p>Pen Colors</p>
            <div className="current-tool">
              <span className="dot" style={{ backgroundColor: currentToolHex }} />
              <span>{currentTool}</span>
            </div>
            {COLORS.map((color) => (
              <button key={color.name} type="button" onClick={() => setPenFromPalette(color)}>
                {color.name}
              </button>
            ))}
          </div>

          <div className="brush-control">
            <label htmlFor="brush-size">Brush Size: {brushSize}</label>
            <input
              id="brush-size"
              type="range"
              min="1"
              max="60"
              value={brushSize}
              onChange={(event) => {
                const size = Number(event.target.value)
                setBrushSize(size)
                updateStatus(`Brush size: ${size}`)
              }}
            />
          </div>
        </aside>
      </main>

      <footer className="status-bar">{status}</footer>
    </div>
  )
}

export default App
