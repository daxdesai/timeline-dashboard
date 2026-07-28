import {
  Box,
  Chip,
  Stack,
  Typography,
  Alert,
} from '@mui/material'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { MachineIntervalsData } from '../../api/types'
import {
  buildChartMarkers,
  buildChartSegments,
  countUnknownSegments,
  findLastObservedProduce,
  SEGMENT_COLORS,
  type ChartSegment,
} from '../../utils/chartData'
import {
  downsamplePassMarkers,
  drawMarker,
  findNearestMarker,
  projectMarkers,
  type RenderMarker,
} from '../../utils/chartRender'
import { formatIstTime } from '../../utils/timezone'

const CHART_HEIGHT = 360
const MARGIN = { top: 24, right: 24, bottom: 48, left: 56 }
const MIN_ZOOM_MS = 60_000

interface TimelineChartProps {
  data: MachineIntervalsData
  shiftStartMs: number
  shiftEndMs: number
  showIndividualProduces: boolean
}

interface ZoomRange {
  startMs: number
  endMs: number
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(800)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next) setWidth(next)
    })
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [ref])

  return width
}

export function TimelineChart({
  data,
  shiftStartMs,
  shiftEndMs,
  showIndividualProduces,
}: TimelineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerWidth = useContainerWidth(containerRef)

  const [zoom, setZoom] = useState<ZoomRange | null>(null)
  const [hovered, setHovered] = useState<RenderMarker | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const selectionRef = useRef<{ startX: number; endX: number } | null>(null)

  const visibleRange = zoom ?? { startMs: shiftStartMs, endMs: shiftEndMs }

  const segments = useMemo(() => buildChartSegments(data), [data])
  const markers = useMemo(
    () => buildChartMarkers(data, showIndividualProduces),
    [data, showIndividualProduces],
  )

  const unknownInfo = useMemo(() => countUnknownSegments(data), [data])
  const lastProduce = useMemo(
    () => findLastObservedProduce(data, showIndividualProduces),
    [data, showIndividualProduces],
  )

  const chartWidth = Math.max(300, containerWidth - MARGIN.left - MARGIN.right)
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom
  const spanMs = visibleRange.endMs - visibleRange.startMs

  const maxCumulative = useMemo(
    () => Math.max(1, ...markers.map((m) => m.cumulative)),
    [markers],
  )

  const timeToX = useCallback(
    (ms: number) =>
      MARGIN.left + ((ms - visibleRange.startMs) / spanMs) * chartWidth,
    [visibleRange.startMs, spanMs, chartWidth],
  )

  const cumulativeToY = useCallback(
    (value: number) =>
      MARGIN.top + plotHeight - (value / maxCumulative) * plotHeight,
    [maxCumulative, plotHeight],
  )

  const allRenderMarkers = useMemo(
    () => projectMarkers(markers, timeToX, cumulativeToY, showIndividualProduces ? 3 : 5),
    [markers, timeToX, cumulativeToY, showIndividualProduces],
  )

  const displayMarkers = useMemo(
    () => downsamplePassMarkers(allRenderMarkers, chartWidth + MARGIN.left + MARGIN.right),
    [allRenderMarkers, chartWidth],
  )

  const visibleSegments = useMemo(
    () =>
      segments.filter(
        (s) => s.endMs > visibleRange.startMs && s.startMs < visibleRange.endMs,
      ),
    [segments, visibleRange],
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = CHART_HEIGHT * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${CHART_HEIGHT}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, containerWidth, CHART_HEIGHT)

    ctx.fillStyle = '#fafafa'
    ctx.fillRect(MARGIN.left, MARGIN.top, chartWidth, plotHeight)

    for (const seg of visibleSegments) {
      const x1 = timeToX(Math.max(seg.startMs, visibleRange.startMs))
      const x2 = timeToX(Math.min(seg.endMs, visibleRange.endMs))
      const w = Math.max(1, x2 - x1)
      ctx.fillStyle = SEGMENT_COLORS[seg.kind] ?? '#bdbdbd'
      ctx.fillRect(x1, MARGIN.top, w, plotHeight)

      if (w > 28) {
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.translate(x1 + w / 2, MARGIN.top + plotHeight / 2)
        ctx.rotate(-Math.PI / 2)
        const label =
          seg.label.length > 18 ? `${seg.label.slice(0, 16)}…` : seg.label
        ctx.fillText(label, 0, 0)
        ctx.restore()
      }
    }

    if (!showIndividualProduces && allRenderMarkers.length > 1) {
      ctx.beginPath()
      ctx.strokeStyle = '#1565c0'
      ctx.lineWidth = 2
      let lineStarted = false
      for (const m of allRenderMarkers) {
        if (m.x < MARGIN.left || m.x > MARGIN.left + chartWidth) continue
        if (!lineStarted) {
          ctx.moveTo(m.x, m.y)
          lineStarted = true
        } else {
          ctx.lineTo(m.x, m.y)
        }
      }
      if (lineStarted) ctx.stroke()
    }

    for (const m of displayMarkers) {
      if (m.x < MARGIN.left - 10 || m.x > MARGIN.left + chartWidth + 10) continue
      drawMarker(ctx, m, showIndividualProduces)
    }

    ctx.strokeStyle = '#bdbdbd'
    ctx.lineWidth = 1
    ctx.strokeRect(MARGIN.left, MARGIN.top, chartWidth, plotHeight)

    ctx.fillStyle = '#616161'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    const tickCount = Math.min(8, Math.max(4, Math.floor(chartWidth / 100)))
    for (let i = 0; i <= tickCount; i += 1) {
      const t = visibleRange.startMs + (spanMs * i) / tickCount
      const x = timeToX(t)
      ctx.fillText(formatIstTime(t), x, CHART_HEIGHT - 16)
      ctx.beginPath()
      ctx.moveTo(x, MARGIN.top + plotHeight)
      ctx.lineTo(x, MARGIN.top + plotHeight + 4)
      ctx.stroke()
    }

    ctx.textAlign = 'right'
    ctx.fillText('0', MARGIN.left - 8, MARGIN.top + plotHeight)
    ctx.fillText(String(maxCumulative), MARGIN.left - 8, MARGIN.top + 12)
    ctx.save()
    ctx.translate(14, MARGIN.top + plotHeight / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('Cumulative production', 0, 0)
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.fillText('Shift time', MARGIN.left + chartWidth / 2, CHART_HEIGHT - 2)

    const sel = selectionRef.current
    if (sel && isSelecting) {
      const x1 = Math.min(sel.startX, sel.endX)
      const x2 = Math.max(sel.startX, sel.endX)
      ctx.fillStyle = 'rgba(21, 101, 192, 0.15)'
      ctx.fillRect(x1, MARGIN.top, x2 - x1, plotHeight)
      ctx.strokeStyle = '#1565c0'
      ctx.strokeRect(x1, MARGIN.top, x2 - x1, plotHeight)
    }
  }, [
    allRenderMarkers,
    chartWidth,
    containerWidth,
    displayMarkers,
    isSelecting,
    maxCumulative,
    plotHeight,
    showIndividualProduces,
    spanMs,
    timeToX,
    visibleRange,
    visibleSegments,
  ])

  useEffect(() => {
    draw()
  }, [draw])

  const xToTime = useCallback(
    (x: number) =>
      visibleRange.startMs + ((x - MARGIN.left) / chartWidth) * spanMs,
    [visibleRange.startMs, chartWidth, spanMs],
  )

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!e.shiftKey) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    selectionRef.current = { startX: x, endX: x }
    setIsSelecting(true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isSelecting && selectionRef.current) {
      selectionRef.current.endX = x
      draw()
      return
    }

    const nearest = findNearestMarker(allRenderMarkers, x, y)
    setHovered(nearest)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !selectionRef.current) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    selectionRef.current.endX = x

    const x1 = Math.min(selectionRef.current.startX, selectionRef.current.endX)
    const x2 = Math.max(selectionRef.current.startX, selectionRef.current.endX)

    selectionRef.current = null
    setIsSelecting(false)

    if (x2 - x1 < 8) return

    const startMs = xToTime(x1)
    const endMs = xToTime(x2)
    if (endMs - startMs >= MIN_ZOOM_MS) {
      setZoom({
        startMs: Math.max(shiftStartMs, startMs),
        endMs: Math.min(shiftEndMs, endMs),
      })
    }
  }

  const handleDoubleClick = () => setZoom(null)

  const legendItems: { kind: ChartSegment['kind']; label: string }[] = [
    { kind: 'runtime', label: 'Runtime' },
    { kind: 'unplannedProduction', label: 'Unplanned Production' },
    { kind: 'plannedDowntime', label: 'Planned Downtime' },
    { kind: 'unknownDowntime', label: 'Unplanned Downtime' },
    { kind: 'stoppage', label: 'Minor Stoppage' },
  ]

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
        Production History
      </Typography>

      <Stack
        direction="row"
        spacing={2}
        sx={{ mb: 1, flexWrap: 'wrap' }}
        useFlexGap
      >
        {legendItems.map((item) => (
          <Stack
            key={item.kind}
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center' }}
          >
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: 0.5,
                bgcolor: SEGMENT_COLORS[item.kind],
              }}
            />
            <Typography variant="caption">{item.label}</Typography>
          </Stack>
        ))}
        <Typography variant="caption" color="text.secondary">
          ● Pass &nbsp; ✕ Fail
        </Typography>
      </Stack>

      <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHovered(null)
            if (isSelecting) {
              selectionRef.current = null
              setIsSelecting(false)
            }
          }}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: isSelecting ? 'col-resize' : 'crosshair', display: 'block' }}
        />

        {hovered && (
          <Box
            sx={{
              position: 'absolute',
              left: Math.min(hovered.x + 12, containerWidth - 180),
              top: Math.max(hovered.y - 40, 8),
              bgcolor: 'rgba(33,33,33,0.9)',
              color: '#fff',
              px: 1.5,
              py: 0.75,
              borderRadius: 1,
              pointerEvents: 'none',
              fontSize: 12,
            }}
          >
            <div>{hovered.tooltipTime}</div>
            <div>{hovered.result}</div>
          </Box>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Shift + drag to zoom into a time range · double-click to reset
        {!showIndividualProduces && ' · Colored line = cumulative production (OK + NG)'}
        {showIndividualProduces && ' · Circles = PASS, Crosses = FAIL'}
      </Typography>

      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap' }}
      >
        {lastProduce && (
          <Chip
            size="small"
            label={`Last observed produce at: ${lastProduce}`}
            variant="outlined"
          />
        )}
        {unknownInfo.count > 0 && (
          <Alert severity="warning" sx={{ py: 0, flex: 1 }}>
            {unknownInfo.count} unknown segment{unknownInfo.count === 1 ? '' : 's'} —{' '}
            {unknownInfo.minutes.toFixed(1)} min
          </Alert>
        )}
      </Stack>
    </Box>
  )
}
