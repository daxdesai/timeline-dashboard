import { floorToIstClockHour, formatIstTime, nowIstMs } from './timezone'

export interface ClockHourBucket {
  /** Start of the IST clock hour (ms). */
  hourStartMs: number
  /** End of the IST clock hour (ms). */
  hourEndMs: number
  /** Intersection with the shift window. */
  clipStartMs: number
  clipEndMs: number
  /** Hour is entirely in the future relative to now. */
  isFuture: boolean
  label: string
}

export function getShiftClockHourBuckets(
  shiftStartMs: number,
  shiftEndMs: number,
  nowMs: number = nowIstMs(),
): ClockHourBucket[] {
  const buckets: ClockHourBucket[] = []
  let hourStartMs = floorToIstClockHour(shiftStartMs)

  while (hourStartMs < shiftEndMs) {
    const hourEndMs = hourStartMs + 60 * 60 * 1000
    const clipStartMs = Math.max(hourStartMs, shiftStartMs)
    const clipEndMs = Math.min(hourEndMs, shiftEndMs)

    if (clipStartMs < clipEndMs) {
      buckets.push({
        hourStartMs,
        hourEndMs,
        clipStartMs,
        clipEndMs,
        isFuture: hourStartMs >= nowMs,
        label: `${formatIstTime(hourStartMs)} - ${formatIstTime(hourEndMs)}`,
      })
    }

    hourStartMs = hourEndMs
  }

  return buckets
}

/** Minutes of [startMs, endMs) overlapping [rangeStart, rangeEnd), capped at nowMs. */
export function overlapMinutes(
  startMs: number,
  endMs: number,
  rangeStartMs: number,
  rangeEndMs: number,
  nowMs: number = nowIstMs(),
): number {
  const effectiveEnd = Math.min(endMs, rangeEndMs, nowMs)
  const effectiveStart = Math.max(startMs, rangeStartMs)
  if (effectiveStart >= effectiveEnd) return 0
  return (effectiveEnd - effectiveStart) / 60_000
}

export function formatMinutes(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  if (value === 0) return '0 mins'
  return `${value.toFixed(1)} mins`
}

export function formatSeconds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return `${Math.round(value)} secs`
}
