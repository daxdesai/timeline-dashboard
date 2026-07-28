import RefreshIcon from '@mui/icons-material/Refresh'
import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  FormControlLabel,
  Tooltip,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import type { FlatAsset, Shift } from '../../api/types'
import {
  formatDatePickerValue,
  formatSummaryRange,
  parseDatePickerValue,
} from '../../utils/timezone'

interface FilterBarProps {
  assets: FlatAsset[]
  shifts: Shift[]
  asset: FlatAsset | null
  shift: Shift | null
  dateStr: string
  showIndividualProduces: boolean
  shiftStartMs?: number
  shiftEndMs?: number
  isFetching?: boolean
  onAssetChange: (asset: FlatAsset | null) => void
  onShiftChange: (shift: Shift | null) => void
  onDateChange: (dateStr: string) => void
  onToggleIndividual: (value: boolean) => void
  onRefresh: () => void
}

export function FilterBar({
  assets,
  shifts,
  asset,
  shift,
  dateStr,
  showIndividualProduces,
  shiftStartMs,
  shiftEndMs,
  isFetching,
  onAssetChange,
  onShiftChange,
  onDateChange,
  onToggleIndividual,
  onRefresh,
}: FilterBarProps) {
  const selectedDate = dateStr ? parseDatePickerValue(dateStr) : null

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap' }}
        useFlexGap
      >
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="asset-label">Asset</InputLabel>
          <Select
            labelId="asset-label"
            label="Asset"
            value={asset?.id ?? ''}
            onChange={(e) => {
              const next = assets.find((a) => a.id === e.target.value) ?? null
              onAssetChange(next)
            }}
          >
            {assets.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {'\u00A0'.repeat(a.depth * 2)}
                {a.name}
                {a.codename ? ` (${a.codename})` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <DatePicker
          label="Date"
          value={selectedDate}
          onChange={(value) => {
            if (value) onDateChange(formatDatePickerValue(value))
          }}
          slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
        />

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="shift-label">Shift</InputLabel>
          <Select
            labelId="shift-label"
            label="Shift"
            value={shift?.id ?? ''}
            onChange={(e) => {
              const next = shifts.find((s) => s.id === e.target.value) ?? null
              onShiftChange(next)
            }}
          >
            {shifts.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name} ({s.shift_timings[0]} – {s.shift_timings[1]})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={showIndividualProduces}
              onChange={(e) => onToggleIndividual(e.target.checked)}
            />
          }
          label="Show individual produces"
        />

        <Tooltip title="Refresh data">
          <span>
            <IconButton onClick={onRefresh} disabled={isFetching}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {asset && shiftStartMs != null && shiftEndMs != null && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 2, flexWrap: 'wrap' }}
          useFlexGap
        >
          <Chip label={asset.name} size="small" />
          <Chip label={formatSummaryRange(shiftStartMs, shiftEndMs)} size="small" />
          {shift && (
            <Chip label={`Shift: ${shift.name}`} size="small" variant="outlined" />
          )}
        </Stack>
      )}
    </Box>
  )
}
