import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { HourlyTableData } from '../../utils/hourlyTable'

interface HourlySummaryTableProps {
  table: HourlyTableData
}

export function HourlySummaryTable({ table }: HourlySummaryTableProps) {
  if (!table.columns.length) return null

  return (
    <Paper variant="outlined" sx={{ mt: 3, overflow: 'hidden' }}>
      <Typography variant="subtitle1" sx={{ px: 2, py: 1.5, fontWeight: 600 }}>
        Hourly Production &amp; Downtime Summary
      </Typography>
      <TableContainer sx={{ maxHeight: 480 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, minWidth: 160 }}>Param</TableCell>
              {table.columns.map((col) => (
                <TableCell
                  key={col.hourStartMs}
                  align="center"
                  sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {table.rows.map((row) => (
              <TableRow key={row.key} hover>
                <TableCell sx={{ fontWeight: 500 }}>{row.label}</TableCell>
                {row.values.map((value, idx) => (
                  <TableCell key={`${row.key}-${idx}`} align="center">
                    {value}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
