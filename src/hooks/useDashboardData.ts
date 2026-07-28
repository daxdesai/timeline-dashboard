import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  fetchAssetTree,
  fetchCycleTimeMetrics,
  fetchMachineIntervals,
  fetchShifts,
} from '../api/endpoints'
import type { EntityScope, FlatAsset, Shift } from '../api/types'
import { findDefaultAsset, flattenAssetTree } from '../utils/assets'
import { getShiftClockHourBuckets } from '../utils/hourlyBuckets'
import { buildHourlyTable } from '../utils/hourlyTable'
import { buildShiftTimeRange, nowIstMs } from '../utils/timezone'

export interface DashboardFilters {
  asset: FlatAsset | null
  shift: Shift | null
  dateStr: string
  showIndividualProduces: boolean
}

export function useDashboardMeta() {
  const assetsQuery = useQuery({
    queryKey: ['assets-tree'],
    queryFn: fetchAssetTree,
    staleTime: 5 * 60_000,
  })

  const shiftsQuery = useQuery({
    queryKey: ['shifts'],
    queryFn: fetchShifts,
    staleTime: 5 * 60_000,
  })

  const assets = useMemo(
    () => flattenAssetTree(assetsQuery.data ?? []),
    [assetsQuery.data],
  )

  const shifts = useMemo(
    () => (shiftsQuery.data ?? []).filter((s) => s.is_active),
    [shiftsQuery.data],
  )

  const defaultAsset = useMemo(() => findDefaultAsset(assets), [assets])

  return {
    assets,
    shifts,
    defaultAsset,
    defaultShift: shifts[0] ?? null,
    isLoading: assetsQuery.isLoading || shiftsQuery.isLoading,
    error: assetsQuery.error ?? shiftsQuery.error,
    refetchMeta: () => {
      void assetsQuery.refetch()
      void shiftsQuery.refetch()
    },
  }
}

export function useDashboardData(filters: DashboardFilters) {
  const timeWindow = useMemo(() => {
    if (!filters.shift || !filters.dateStr) return null
    return buildShiftTimeRange(
      filters.dateStr,
      filters.shift.shift_timings[0],
      filters.shift.shift_timings[1],
    )
  }, [filters.dateStr, filters.shift])

  const entityScope: EntityScope | null = useMemo(() => {
    if (!filters.asset) return null
    return {
      type: 'asset',
      asset: {
        asset_id: filters.asset.id,
        asset_level_id: filters.asset.assetlevel_id,
      },
    }
  }, [filters.asset])

  const queryEnabled = Boolean(entityScope && timeWindow)

  const intervalsQuery = useQuery({
    queryKey: [
      'machine-intervals',
      entityScope?.asset.asset_id,
      entityScope?.asset.asset_level_id,
      timeWindow?.from_ts,
      timeWindow?.to_ts,
      filters.showIndividualProduces,
    ],
    queryFn: () =>
      fetchMachineIntervals(
        entityScope!,
        {
          from_ts: timeWindow!.from_ts,
          to_ts: timeWindow!.to_ts,
        },
        filters.showIndividualProduces,
      ),
    enabled: queryEnabled,
    retry: 2,
  })

  const cycleTimeQuery = useQuery({
    queryKey: [
      'cycle-time',
      entityScope?.asset.asset_id,
      entityScope?.asset.asset_level_id,
      timeWindow?.from_ts,
      timeWindow?.to_ts,
    ],
    queryFn: () =>
      fetchCycleTimeMetrics(entityScope!, {
        from_ts: timeWindow!.from_ts,
        to_ts: timeWindow!.to_ts,
      }),
    enabled: queryEnabled,
    retry: 2,
  })

  const buckets = useMemo(() => {
    if (!timeWindow) return []
    return getShiftClockHourBuckets(timeWindow.startMs, timeWindow.endMs)
  }, [timeWindow])

  const hourlyTable = useMemo(
    () =>
      buildHourlyTable(
        intervalsQuery.data,
        cycleTimeQuery.data,
        buckets,
        nowIstMs(),
      ),
    [intervalsQuery.data, cycleTimeQuery.data, buckets],
  )

  const isLoading =
    intervalsQuery.isLoading ||
    intervalsQuery.isFetching ||
    cycleTimeQuery.isLoading ||
    cycleTimeQuery.isFetching

  const error = intervalsQuery.error ?? cycleTimeQuery.error

  const refetch = () => {
    void intervalsQuery.refetch()
    void cycleTimeQuery.refetch()
  }

  return {
    timeWindow,
    intervals: intervalsQuery.data,
    cycleTimes: cycleTimeQuery.data,
    hourlyTable,
    buckets,
    isLoading,
    error,
    refetch,
    isFetching: intervalsQuery.isFetching || cycleTimeQuery.isFetching,
  }
}
