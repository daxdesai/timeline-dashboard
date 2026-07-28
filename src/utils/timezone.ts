import { addDays, format, parseISO } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'

export const IST = 'Asia/Kolkata'

export function utcToIstMs(utcIso: string): number {
  return toZonedTime(parseISO(utcIso), IST).getTime()
}

export function formatIst(
  ms: number,
  pattern = 'dd MMM, HH:mm:ss',
): string {
  return formatInTimeZone(new Date(ms), IST, pattern)
}

export function formatIstTime(ms: number): string {
  return formatInTimeZone(new Date(ms), IST, 'HH:mm')
}

export function formatIstHourRange(startMs: number, endMs: number): string {
  return `${formatInTimeZone(new Date(startMs), IST, 'HH:mm')} - ${formatInTimeZone(new Date(endMs), IST, 'HH:mm')}`
}

/** Combine a calendar date (yyyy-MM-dd) with shift HH:MM in IST, return UTC ISO bounds. */
export function buildShiftTimeRange(
  dateStr: string,
  shiftStart: string,
  shiftEnd: string,
): { from_ts: string; to_ts: string; startMs: number; endMs: number } {
  const [startH, startM] = shiftStart.split(':').map(Number)
  const [endH, endM] = shiftEnd.split(':').map(Number)

  const startLocal = `${dateStr}T${shiftStart}:00`
  const startUtc = fromZonedTime(startLocal, IST)

  const crossesMidnight =
    endH < startH || (endH === startH && endM <= startM)

  const endDateStr = crossesMidnight
    ? format(addDays(parseISO(`${dateStr}T00:00:00`), 1), 'yyyy-MM-dd')
    : dateStr

  const endLocal = `${endDateStr}T${shiftEnd}:00`
  const endUtc = fromZonedTime(endLocal, IST)

  return {
    from_ts: startUtc.toISOString(),
    to_ts: endUtc.toISOString(),
    startMs: startUtc.getTime(),
    endMs: endUtc.getTime(),
  }
}

/** Floor a timestamp to the start of its IST clock hour. */
export function floorToIstClockHour(ms: number): number {
  const zoned = toZonedTime(new Date(ms), IST)
  zoned.setMinutes(0, 0, 0)
  return fromZonedTime(zoned, IST).getTime()
}

/** Map a UTC bucket_start ISO string to its IST clock-hour start (ms). */
export function bucketStartToIstClockHourMs(utcIso: string): number {
  return floorToIstClockHour(utcToIstMs(utcIso))
}

export function nowIstMs(): number {
  return Date.now()
}

export function formatSummaryRange(startMs: number, endMs: number): string {
  const start = formatInTimeZone(new Date(startMs), IST, 'dd MMM, HH:mm')
  const end = formatInTimeZone(new Date(endMs), IST, 'dd MMM, HH:mm')
  return `${start} – ${end}`
}

export function formatDatePickerValue(date: Date): string {
  return formatInTimeZone(date, IST, 'yyyy-MM-dd')
}

export function parseDatePickerValue(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00`, IST)
}
