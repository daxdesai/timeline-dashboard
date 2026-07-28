import { apiRequest } from './client'
import type {
  AssetNode,
  CycleTimeRow,
  EntityScope,
  LoginResponse,
  MachineIntervalsData,
  Shift,
  TimeRange,
  User,
} from './types'

export function login(username: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ username, password }),
  })
}

export function fetchMe() {
  return apiRequest<User>('/auth/me')
}

export function logout() {
  return apiRequest<null>('/auth/logout', { method: 'POST' })
}

export function fetchAssetTree() {
  return apiRequest<AssetNode[]>('/core/assets/tree')
}

export function fetchShifts() {
  return apiRequest<Shift[]>('/core/shifts')
}

export function fetchMachineIntervals(
  entityScope: EntityScope,
  timeRange: TimeRange,
  exactProduces: boolean,
) {
  return apiRequest<MachineIntervalsData>(
    '/analytics-query/machine-intervals',
    {
      method: 'POST',
      body: JSON.stringify({
        entity_scope: entityScope,
        time_range: timeRange,
        produce_counts: true,
        exact_produces: exactProduces,
        group_produce_counts_by_part_model: true,
      }),
    },
  )
}

export function fetchCycleTimeMetrics(
  entityScope: EntityScope,
  timeRange: TimeRange,
) {
  return apiRequest<CycleTimeRow[]>('/analytics-query', {
    method: 'POST',
    body: JSON.stringify({
      entity_scope: entityScope,
      metrics: ['ideal_cycle_time_seconds', 'actual_cycle_time_seconds'],
      time_range: timeRange,
      distribution: 'hourly',
    }),
  })
}
