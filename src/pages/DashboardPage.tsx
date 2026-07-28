import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { formatApiErrorMessage } from '../api/client'
import { FilterBar } from '../components/dashboard/FilterBar'
import { HourlySummaryTable } from '../components/dashboard/HourlySummaryTable'
import { TimelineChart } from '../components/dashboard/TimelineChart'
import {
  useDashboardData,
  useDashboardMeta,
  type DashboardFilters,
} from '../hooks/useDashboardData'
const DEFAULT_DATE = '2026-06-23'

export function DashboardPage() {
  const meta = useDashboardMeta()
  const [filters, setFilters] = useState<DashboardFilters>({
    asset: null,
    shift: null,
    dateStr: DEFAULT_DATE,
    showIndividualProduces: false,
  })
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialized || meta.isLoading) return
    if (meta.defaultAsset || meta.defaultShift) {
      setFilters((prev) => ({
        ...prev,
        asset: prev.asset ?? meta.defaultAsset ?? null,
        shift: prev.shift ?? meta.defaultShift ?? null,
        dateStr: prev.dateStr || DEFAULT_DATE,
      }))
      setInitialized(true)
    }
  }, [meta.defaultAsset, meta.defaultShift, meta.isLoading, initialized])

  const dashboard = useDashboardData(filters)

  const errorMessage = dashboard.error
    ? formatApiErrorMessage(dashboard.error)
    : null

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        {meta.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={28} />
          </Box>
        ) : meta.error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => meta.refetchMeta()}>
                Retry
              </Button>
            }
          >
            Failed to load filters.
          </Alert>
        ) : (
          <FilterBar
            assets={meta.assets}
            shifts={meta.shifts}
            asset={filters.asset}
            shift={filters.shift}
            dateStr={filters.dateStr}
            showIndividualProduces={filters.showIndividualProduces}
            shiftStartMs={dashboard.timeWindow?.startMs}
            shiftEndMs={dashboard.timeWindow?.endMs}
            isFetching={dashboard.isFetching}
            onAssetChange={(asset) => setFilters((f) => ({ ...f, asset }))}
            onShiftChange={(shift) => setFilters((f) => ({ ...f, shift }))}
            onDateChange={(dateStr) => setFilters((f) => ({ ...f, dateStr }))}
            onToggleIndividual={(showIndividualProduces) =>
              setFilters((f) => ({ ...f, showIndividualProduces }))
            }
            onRefresh={dashboard.refetch}
          />
        )}
      </Paper>

      {dashboard.isLoading && !dashboard.intervals ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : errorMessage ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={dashboard.refetch}>
              Retry
            </Button>
          }
        >
          {errorMessage}
        </Alert>
      ) : dashboard.timeWindow && !dashboard.isLoading ? (
        dashboard.intervals ? (
          <>
            {dashboard.hourlyTable.isEmpty ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                No production data for this shift.
              </Alert>
            ) : null}

            <Paper variant="outlined" sx={{ p: 2 }}>
              <TimelineChart
                data={dashboard.intervals}
                shiftStartMs={dashboard.timeWindow.startMs}
                shiftEndMs={dashboard.timeWindow.endMs}
                showIndividualProduces={filters.showIndividualProduces}
              />
            </Paper>

            <HourlySummaryTable table={dashboard.hourlyTable} />
          </>
        ) : (
          <Alert severity="info">No production data for this shift.</Alert>
        )
      ) : (
        <Typography color="text.secondary">
          Select an asset, date, and shift to view the timeline.
        </Typography>
      )}
    </Box>
  )
}
