import type { ChartMarker } from './chartData'

export interface RenderMarker {
  x: number
  y: number
  radius: number
  isFail: boolean
  result: string
  tooltipTime: string
  timeMs: number
}

const PASS_COLOR = '#1565c0'
const FAIL_COLOR = '#c62828'
const PASS_FILL = '#ffffff'

/** Build pixel positions once; never parse dates in the render loop. */
export function projectMarkers(
  markers: ChartMarker[],
  timeToX: (ms: number) => number,
  cumulativeToY: (value: number) => number,
  markerRadius: number,
): RenderMarker[] {
  return markers.map((m) => ({
    x: timeToX(m.timeMs),
    y: cumulativeToY(m.cumulative),
    radius: markerRadius,
    isFail: m.isFail,
    result: m.result,
    tooltipTime: m.tooltipTime,
    timeMs: m.timeMs,
  }))
}

/**
 * Thin PASS markers per pixel column when zoomed out.
 * FAIL markers are never dropped.
 */
export function downsamplePassMarkers(
  markers: RenderMarker[],
  chartWidth: number,
  maxPassPerColumn = 2,
): RenderMarker[] {
  if (markers.length <= chartWidth * maxPassPerColumn) {
    return markers
  }

  const fails = markers.filter((m) => m.isFail)
  const passes = markers.filter((m) => !m.isFail)

  const columns = new Map<number, RenderMarker[]>()
  for (const m of passes) {
    const col = Math.max(0, Math.min(chartWidth - 1, Math.floor(m.x)))
    const list = columns.get(col) ?? []
    list.push(m)
    columns.set(col, list)
  }

  const sampledPasses: RenderMarker[] = []
  for (const list of columns.values()) {
    if (list.length <= maxPassPerColumn) {
      sampledPasses.push(...list)
      continue
    }
    const step = list.length / maxPassPerColumn
    for (let i = 0; i < maxPassPerColumn; i += 1) {
      sampledPasses.push(list[Math.floor(i * step)]!)
    }
  }

  return [...fails, ...sampledPasses].sort((a, b) => a.timeMs - b.timeMs)
}

export function findNearestMarker(
  markers: RenderMarker[],
  mouseX: number,
  mouseY: number,
  threshold = 12,
): RenderMarker | null {
  let best: RenderMarker | null = null
  let bestDist = threshold * threshold

  for (const m of markers) {
    const dx = m.x - mouseX
    const dy = m.y - mouseY
    const dist = dx * dx + dy * dy
    if (dist <= bestDist) {
      bestDist = dist
      best = m
    }
  }

  return best
}

export function drawMarker(
  ctx: CanvasRenderingContext2D,
  marker: RenderMarker,
  showIndividual: boolean,
) {
  if (marker.isFail) {
    ctx.strokeStyle = FAIL_COLOR
    ctx.lineWidth = 2
    const s = marker.radius
    ctx.beginPath()
    ctx.moveTo(marker.x - s, marker.y - s)
    ctx.lineTo(marker.x + s, marker.y + s)
    ctx.moveTo(marker.x + s, marker.y - s)
    ctx.lineTo(marker.x - s, marker.y + s)
    ctx.stroke()
    return
  }

  ctx.beginPath()
  ctx.arc(marker.x, marker.y, marker.radius, 0, Math.PI * 2)
  ctx.fillStyle = showIndividual ? PASS_FILL : PASS_FILL
  ctx.fill()
  ctx.strokeStyle = PASS_COLOR
  ctx.lineWidth = 1.5
  ctx.stroke()
}

export { PASS_COLOR, FAIL_COLOR }
