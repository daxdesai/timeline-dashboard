import type {
  DowntimeSegment,
  MachineIntervalsData,
  ProduceCountBucket,
  ProduceRow,
  RuntimeSegment,
  StoppageSegment,
} from '../api/types'
import { formatIst, utcToIstMs } from './timezone'

export type TimelineSegmentKind =
  | 'runtime'
  | 'unplannedProduction'
  | 'stoppage'
  | 'unknownDowntime'
  | 'plannedDowntime'
  | 'unplannedDowntime'

export interface ChartSegment {
  startMs: number
  endMs: number
  kind: TimelineSegmentKind
  label: string
}

export interface ChartMarker {
  timeMs: number
  cumulative: number
  isFail: boolean
  result: string
  tooltipTime: string
}

export const SEGMENT_COLORS: Record<TimelineSegmentKind, string> = {
  runtime: '#00897b',
  unplannedProduction: '#c0ca33',
  stoppage: '#7b1fa2',
  unknownDowntime: '#ef6c57',
  plannedDowntime: '#2e7d32',
  unplannedDowntime: '#e65100',
}

function classifyRuntime(type: string): TimelineSegmentKind {
  const t = type.toLowerCase()
  if (t === 'unknown unplanned production') return 'unplannedProduction'
  return 'runtime'
}

export function classifyDowntime(type: string, name: string): TimelineSegmentKind {
  const t = type.toLowerCase()
  const n = name.toLowerCase()
  if (t === 'unknown' || n === 'unknown') return 'unknownDowntime'
  if (t.includes('planned') && !t.includes('unplanned')) return 'plannedDowntime'
  if (t.includes('unplanned')) return 'unplannedDowntime'
  return 'unknownDowntime'
}

export function buildChartSegments(
  data: MachineIntervalsData,
): ChartSegment[] {
  const segments: ChartSegment[] = []

  for (const rt of data.runtimes ?? []) {
    const kind = classifyRuntime(rt.type)
    segments.push({
      startMs: utcToIstMs(rt.start_at),
      endMs: utcToIstMs(rt.end_at),
      kind,
      label: rt.runtime_name ?? (kind === 'runtime' ? 'RUNTIME' : 'UNPLANNED PRODUCTION'),
    })
  }

  for (const dt of data.downtimes ?? []) {
    const kind = classifyDowntime(dt.type, dt.downtime_name)
    segments.push({
      startMs: utcToIstMs(dt.start_at),
      endMs: utcToIstMs(dt.end_at),
      kind,
      label: (dt.downtime_name ?? dt.type).toUpperCase(),
    })
  }

  for (const st of data.stoppages ?? []) {
    segments.push({
      startMs: utcToIstMs(st.start_at),
      endMs: utcToIstMs(st.end_at),
      kind: 'stoppage',
      label: 'STOPPAGE',
    })
  }

  return segments.sort((a, b) => a.startMs - b.startMs)
}

function buildHourlyMarkers(
  produceCounts: ProduceCountBucket[],
): ChartMarker[] {
  const sorted = [...(produceCounts ?? [])].sort(
    (a, b) => utcToIstMs(a.bucket_start) - utcToIstMs(b.bucket_start),
  )

  let cumulative = 0
  const markers: ChartMarker[] = []

  for (const bucket of sorted) {
    const total = (bucket.ok_count ?? 0) + (bucket.ng_count ?? 0)
    const failCount = bucket.ng_count ?? 0
    const passCount = bucket.ok_count ?? 0
    const timeMs = utcToIstMs(bucket.bucket_start) + 30 * 60_000

    if (total === 0) continue

    cumulative += total
    markers.push({
      timeMs,
      cumulative,
      isFail: failCount > 0 && passCount === 0,
      result: failCount > 0 ? 'FAIL' : 'PASS',
      tooltipTime: formatIst(timeMs),
    })

    if (failCount > 0 && passCount > 0) {
      markers.push({
        timeMs: timeMs + 1000,
        cumulative: cumulative - passCount,
        isFail: true,
        result: 'FAIL',
        tooltipTime: formatIst(timeMs),
      })
    }
  }

  return markers
}

function buildIndividualMarkers(
  data: MachineIntervalsData,
): ChartMarker[] {
  const rows: ProduceRow[] = []

  for (const bucket of data.produces ?? []) {
    for (const p of bucket.produces ?? []) {
      rows.push(p)
    }
  }

  rows.sort((a, b) => utcToIstMs(a.first_seen_ts) - utcToIstMs(b.first_seen_ts))

  let cumulative = 0
  return rows.map((row) => {
    cumulative += 1
    const timeMs = utcToIstMs(row.first_seen_ts)
    const isFail = row.result.toUpperCase() === 'FAIL'
    return {
      timeMs,
      cumulative,
      isFail,
      result: row.result.toUpperCase(),
      tooltipTime: formatIst(timeMs),
    }
  })
}

export function buildChartMarkers(
  data: MachineIntervalsData,
  showIndividual: boolean,
): ChartMarker[] {
  if (showIndividual && data.produces?.length) {
    return buildIndividualMarkers(data)
  }
  return buildHourlyMarkers(data.produce_counts ?? [])
}

export function countUnknownSegments(data: MachineIntervalsData): {
  count: number
  minutes: number
} {
  let count = 0
  let minutes = 0

  for (const dt of data.downtimes ?? []) {
    if (
      dt.type.toLowerCase() === 'unknown' ||
      dt.downtime_name.toLowerCase() === 'unknown'
    ) {
      count += 1
      minutes +=
        (utcToIstMs(dt.end_at) - utcToIstMs(dt.start_at)) / 60_000
    }
  }

  return { count, minutes }
}

export function findLastObservedProduce(
  data: MachineIntervalsData,
  showIndividual: boolean,
): string | null {
  if (showIndividual && data.produces?.length) {
    let latest = 0
    for (const bucket of data.produces) {
      for (const p of bucket.produces ?? []) {
        const ms = utcToIstMs(p.first_seen_ts)
        if (ms > latest) latest = ms
      }
    }
    return latest ? formatIst(latest) : null
  }

  if (!data.produce_counts?.length) return null

  let latest = 0
  for (const bucket of data.produce_counts) {
    const ms = utcToIstMs(bucket.bucket_start)
    if ((bucket.ok_count ?? 0) + (bucket.ng_count ?? 0) > 0 && ms > latest) {
      latest = ms + 30 * 60_000
    }
  }

  return latest ? formatIst(latest) : null
}

export type { RuntimeSegment, DowntimeSegment, StoppageSegment }
