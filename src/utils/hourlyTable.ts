import type {
  CycleTimeRow,
  DowntimeSegment,
  MachineIntervalsData,
  ProduceCountBucket,
  RuntimeSegment,
  StoppageSegment,
} from '../api/types'
import {
  bucketStartToIstClockHourMs,
  utcToIstMs,
} from './timezone'
import {
  type ClockHourBucket,
  formatMinutes,
  formatSeconds,
  overlapMinutes,
} from './hourlyBuckets'

export interface HourlyTableRow {
  key: string
  label: string
  values: string[]
}

export interface HourlyTableData {
  columns: ClockHourBucket[]
  rows: HourlyTableRow[]
  isEmpty: boolean
}

interface SegmentKind {
  startMs: number
  endMs: number
  category: 'runtime' | 'unplannedProduction' | 'stoppage' | 'unknownDowntime'
}

function normalizeSegments(data: MachineIntervalsData): SegmentKind[] {
  const segments: SegmentKind[] = []

  for (const rt of data.runtimes ?? []) {
    const type = rt.type.toLowerCase()
    segments.push({
      startMs: utcToIstMs(rt.start_at),
      endMs: utcToIstMs(rt.end_at),
      category:
        type === 'unknown unplanned production'
          ? 'unplannedProduction'
          : 'runtime',
    })
  }

  for (const dt of data.downtimes ?? []) {
    const isUnknown =
      dt.type.toLowerCase() === 'unknown' ||
      dt.downtime_name.toLowerCase() === 'unknown'
    if (!isUnknown) continue
    segments.push({
      startMs: utcToIstMs(dt.start_at),
      endMs: utcToIstMs(dt.end_at),
      category: 'unknownDowntime',
    })
  }

  for (const st of data.stoppages ?? []) {
    segments.push({
      startMs: utcToIstMs(st.start_at),
      endMs: utcToIstMs(st.end_at),
      category: 'stoppage',
    })
  }

  return segments
}

function aggregateProduceCounts(
  produceCounts: ProduceCountBucket[],
): Map<number, { total: number; pass: number; fail: number }> {
  const map = new Map<number, { total: number; pass: number; fail: number }>()

  for (const bucket of produceCounts ?? []) {
    const hourKey = bucketStartToIstClockHourMs(bucket.bucket_start)
    const existing = map.get(hourKey) ?? { total: 0, pass: 0, fail: 0 }
    existing.pass += bucket.ok_count ?? 0
    existing.fail += bucket.ng_count ?? 0
    existing.total += (bucket.ok_count ?? 0) + (bucket.ng_count ?? 0)
    map.set(hourKey, existing)
  }

  return map
}

function aggregateCycleTimes(
  rows: CycleTimeRow[],
): Map<number, { ideal: number | null; actual: number | null }> {
  const map = new Map<
    number,
    { ideal: number | null; actual: number | null }
  >()

  for (const row of rows ?? []) {
    const hourKey = bucketStartToIstClockHourMs(row.bucket_start)
    map.set(hourKey, {
      ideal: row.ideal_cycle_time_seconds,
      actual: row.actual_cycle_time_seconds,
    })
  }

  return map
}

function minutesForCategory(
  segments: SegmentKind[],
  bucket: ClockHourBucket,
  category: SegmentKind['category'],
  nowMs: number,
): number | null {
  if (bucket.isFuture) return null

  let total = 0
  for (const seg of segments) {
    if (seg.category !== category) continue
    total += overlapMinutes(
      seg.startMs,
      seg.endMs,
      bucket.hourStartMs,
      bucket.hourEndMs,
      nowMs,
    )
  }
  return total
}

export function buildHourlyTable(
  intervals: MachineIntervalsData | undefined,
  cycleTimes: CycleTimeRow[] | undefined,
  buckets: ClockHourBucket[],
  nowMs: number,
): HourlyTableData {
  if (!intervals) {
    return { columns: buckets, rows: [], isEmpty: true }
  }

  const segments = normalizeSegments(intervals)
  const produceMap = aggregateProduceCounts(intervals.produce_counts ?? [])
  const cycleMap = aggregateCycleTimes(cycleTimes ?? [])

  const isEmpty =
    segments.length === 0 &&
    (intervals.produce_counts?.length ?? 0) === 0

  const mkRow = (
    key: string,
    label: string,
    getter: (bucket: ClockHourBucket) => string,
  ): HourlyTableRow => ({
    key,
    label,
    values: buckets.map(getter),
  })

  const rows: HourlyTableRow[] = [
    mkRow('total', 'Total', (b) => {
      if (b.isFuture) return ''
      const v = produceMap.get(b.hourStartMs)
      return v ? String(v.total) : '0'
    }),
    mkRow('pass', 'Pass', (b) => {
      if (b.isFuture) return ''
      const v = produceMap.get(b.hourStartMs)
      return v ? String(v.pass) : '0'
    }),
    mkRow('fail', 'Fail', (b) => {
      if (b.isFuture) return ''
      const v = produceMap.get(b.hourStartMs)
      return v ? String(v.fail) : '0'
    }),
    mkRow('runtime', 'Runtime', (b) =>
      formatMinutes(minutesForCategory(segments, b, 'runtime', nowMs)),
    ),
    mkRow('unplannedProduction', 'Unplanned Production', (b) =>
      formatMinutes(
        minutesForCategory(segments, b, 'unplannedProduction', nowMs),
      ),
    ),
    mkRow('stoppage', 'Stoppage', (b) =>
      formatMinutes(minutesForCategory(segments, b, 'stoppage', nowMs)),
    ),
    mkRow('unknownDowntime', 'Unknown Downtime', (b) =>
      formatMinutes(minutesForCategory(segments, b, 'unknownDowntime', nowMs)),
    ),
    mkRow('idealCycle', 'Ideal Cycle Time', (b) => {
      if (b.isFuture) return ''
      const v = cycleMap.get(b.hourStartMs)
      return formatSeconds(v?.ideal ?? null)
    }),
    mkRow('actualCycle', 'Actual Cycle Time', (b) => {
      if (b.isFuture) return ''
      const v = cycleMap.get(b.hourStartMs)
      return formatSeconds(v?.actual ?? null)
    }),
  ]

  return { columns: buckets, rows, isEmpty }
}

export type { RuntimeSegment, DowntimeSegment, StoppageSegment }
