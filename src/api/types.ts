export interface ApiEnvelope<T> {
  trace_id: string
  status_code: number
  message: string
  data: T
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface User {
  id: string
  hid?: number
  username: string
  name: string
  email: string
  customer_id?: string
  customer_name?: string
  designation_id?: string
  designation_name?: string
  department_id?: string
  department_name?: string
  status?: string
  roles: string[]
}

export interface AssetNode {
  id: string
  name: string
  codename: string | null
  assetlevel_id: number
  hierarchy: unknown
  children: AssetNode[]
}

export interface Shift {
  id: string
  code: string
  name: string
  shift_timings: [string, string]
  is_active: boolean
}

export interface EntityScope {
  type: 'asset'
  asset: {
    asset_id: string
    asset_level_id: number
  }
}

export interface TimeRange {
  from_ts: string
  to_ts: string
}

export interface RuntimeSegment {
  start_at: string
  end_at: string
  type: string
  runtime_name: string | null
}

export interface DowntimeSegment {
  start_at: string
  end_at: string
  downtime_name: string
  type: string
}

export interface StoppageSegment {
  start_at: string
  end_at: string
  type?: string
  stoppage_name?: string | null
}

export interface ProduceCountBucket {
  bucket_start: string
  part_model_id: string
  ok_count: number
  ng_count: number
}

export interface ProduceRow {
  produce_id: string
  first_seen_ts: string
  result: 'PASS' | 'FAIL' | string
  produce_type: string
  part_model_id: string
}

export interface ProducesBucket {
  bucket_start: string
  part_model_id: string
  produces: ProduceRow[]
}

export interface MachineIntervalsData {
  machine_ids: number[]
  runtimes: RuntimeSegment[]
  downtimes: DowntimeSegment[]
  stoppages: StoppageSegment[]
  produce_counts: ProduceCountBucket[]
  produces?: ProducesBucket[]
}

export interface CycleTimeRow {
  entity_type?: string
  entity_id?: string
  bucket_start: string
  ideal_cycle_time_seconds: number | null
  actual_cycle_time_seconds: number | null
}

export interface FlatAsset {
  id: string
  name: string
  codename: string | null
  assetlevel_id: number
  depth: number
  label: string
}
