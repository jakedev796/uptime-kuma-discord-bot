export interface Monitor {
  id: number;
  name: string;
  type: string;
  url?: string;
  active: boolean;
  interval: number;
  tags?: MonitorTag[];
}

export interface MonitorTag {
  tag_id: number;
  monitor_id: number;
  value: string | null;
  name: string;
  color: string;
}

export interface Heartbeat {
  monitorID: number;
  status: HeartbeatStatus;
  time: string;
  msg: string;
  ping: number | null;
  important: boolean;
  duration: number;
  localDateTime: string;
  timezone: string;
  retries: number;
  downCount: number;
}

export enum HeartbeatStatus {
  DOWN = 0,
  UP = 1,
  PENDING = 2,
  MAINTENANCE = 3,
}

export interface MonitorStats {
  monitor: Monitor;
  currentStatus: HeartbeatStatus;
  lastHeartbeat?: Heartbeat;
  avgPing?: number;
  uptime24h?: number;
}

export interface UptimeKumaResponse {
  ok: boolean;
  msg?: string;
  token?: string;
}

