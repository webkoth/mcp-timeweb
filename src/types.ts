// Response format enum
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

// Common API response structure
export interface ApiResponse<T> {
  response_id?: string;
  meta?: {
    total?: number;
  };
  [key: string]: T | string | { total?: number } | undefined;
}

// Account status
export interface AccountStatus {
  is_blocked: boolean;
  is_permanent_blocked: boolean;
  company_info?: {
    name: string;
    inn: string;
  };
  is_email_verified?: boolean;
  ym_client_id?: string;
  restrictions?: {
    servers_limit?: number;
    is_blocked?: boolean;
    is_send_billing_letters?: boolean;
    is_technical_works?: boolean;
  };
}

// Finances
export interface Finances {
  balance: number;
  currency: string;
  discount_end_date_at: string | null;
  discount_percent: number;
  hourly_cost: number;
  hourly_fee: number;
  monthly_cost: number;
  monthly_fee: number;
  total_paid: number;
  hours_left: number | null;
  autopay_card_info: string | null;
}

// Cloud Server
export interface Server {
  id: number;
  name: string;
  comment: string;
  os: {
    id: number;
    name: string;
    version: string | null;
  } | null;
  software: {
    id: number;
    name: string;
  } | null;
  preset_id: number | null;
  location: string;
  configurator_id: number | null;
  configurator?: {
    cpu: number;
    ram: number;
    disk: number;
  };
  boot_mode: string;
  status: string;
  start_at: string | null;
  is_ddos_guard: boolean;
  is_bandwidth_unlimited: boolean;
  bandwidth?: number;
  cpu: number;
  cpu_frequency: string;
  ram: number;
  disks: ServerDisk[];
  avatar_id: string | null;
  vnc_pass: string;
  root_pass: string | null;
  image: ServerImage | null;
  networks: ServerNetwork[];
  cloud_init: string | null;
  is_qemu_agent: boolean;
  availability_zone: string;
  created_at: string;
  main_ipv4?: string;
}

export interface ServerDisk {
  id: number;
  size: number;
  used: number;
  type: string;
  is_mounted: boolean;
  is_system: boolean;
  system_name: string;
  status: string;
}

export interface ServerImage {
  id: string;
  name: string;
}

export interface ServerNetwork {
  type: string;
  nat_mode: string | null;
  bandwidth: number | null;
  ips: ServerIP[];
  is_ddos_guard: boolean;
}

export interface ServerIP {
  ip: string;
  is_main: boolean;
  ptr: string | null;
  type: string;
}

// Database
export interface DatabaseCluster {
  id: number;
  created_at: string;
  location: string;
  name: string;
  networks: DatabaseNetwork[];
  type: string;
  hash_type: string | null;
  port: number;
  host?: string;
  status: string;
  preset_id: number;
  disk_stats: {
    size: number;
    used: number;
  } | null;
  config_parameters?: {
    auto_increment_increment?: string;
    auto_increment_offset?: string;
    innodb_io_capacity?: string;
    innodb_purge_threads?: string;
    innodb_read_io_threads?: string;
    innodb_thread_concurrency?: string;
    innodb_write_io_threads?: string;
    join_buffer_size?: string;
    max_allowed_packet?: string;
    max_heap_table_size?: string;
    read_buffer_size?: string;
    read_rnd_buffer_size?: string;
    sort_buffer_size?: string;
    tmp_table_size?: string;
    table_open_cache?: string;
    thread_cache_size?: string;
    query_cache_size?: string;
  };
  admin?: {
    login: string;
    password?: string;
  };
  is_only_local_ip_access: boolean;
  availability_zone: string;
}

export interface DatabaseNetwork {
  type: string;
  ips: string[];
}

// Kubernetes Cluster
export interface K8sCluster {
  id: number;
  name: string;
  created_at: string;
  status: string;
  description: string;
  ha: boolean;
  k8s_version: string;
  network_driver: string;
  ingress: boolean;
  preset_id: number;
  cpu: number;
  ram: number;
  disk: number;
  node_groups: K8sNodeGroup[];
}

export interface K8sNodeGroup {
  id: number;
  name: string;
  created_at: string;
  node_count: number;
  preset_id: number;
  cpu: number;
  ram: number;
  disk: number;
}

// S3 Storage
export interface S3Storage {
  id: number;
  name: string;
  location: string;
  status: string;
  preset_id: number;
  disk_stats: {
    size: number;
    used: number;
  };
  type: string;
  bucket_suffix: string;
  access_key: string;
  secret_key: string;
  endpoint?: string;
  created_at: string;
}

// Domain
export interface Domain {
  id: number;
  fqdn: string;
  registered_at: string | null;
  expiration_date: string | null;
  prime_dns: string | null;
  provider: string;
  is_autoprolong_enabled: boolean | null;
  is_whois_privacy_enabled: boolean | null;
  linked_ip: string | null;
  is_premium: boolean;
  is_prolong_allowed: boolean;
  allowed_buy_periods: number[];
  registrant: string | null;
  is_tech_support_allowed: boolean | null;
  request_status: string | null;
  dns_status: string | null;
  tld_id: number | null;
  subdomains: Subdomain[];
}

export interface Subdomain {
  id: number;
  fqdn: string;
}

// DNS Record
export interface DnsRecord {
  id: number;
  type: string;
  subdomain?: string;
  value: string;
  ttl?: number;
  priority?: number;
  data?: DnsRecordData;
}

export interface DnsRecordData {
  value: string;
  priority?: number;
  weight?: number;
  port?: number;
  target?: string;
  expire?: number;
  minimum?: number;
  refresh?: number;
  retry?: number;
  subdomain?: string;
}

// SSH Key
export interface SshKey {
  id: number;
  name: string;
  body: string;
  fingerprint?: string;
  created_at: string;
  used_at: string | null;
  used_by: { id: number; name: string }[];
  is_default: boolean;
  expired_at: string | null;
}

// Floating IP
export interface FloatingIp {
  id: string;
  ip: string;
  ptr: string | null;
  server_id: number | null;
  database_id: number | null;
  balancer_id: number | null;
  resource_id?: number | null;
  resource_type?: string;
  is_ddos_guard: boolean;
  created_at: string;
  availability_zone: string;
  comment: string | null;
}

// VPC
export interface Vpc {
  id: string;
  name: string;
  subnet_v4: string;
  location: string;
  description: string;
  availability_zone: string;
  created_at: string;
  is_default: boolean;
}

// Project
export interface Project {
  id: number;
  account_id: string;
  name: string;
  description: string;
  avatar_id: string | null;
  is_default: boolean;
}

// Balancer
export interface Balancer {
  id: number;
  algo: string;
  created_at: string;
  fall: number;
  inter: number;
  ip: string | null;
  local_ip: string | null;
  is_sticky: boolean;
  is_use_proxy: boolean;
  is_ssl: boolean;
  is_keepalive: boolean;
  name: string;
  port: number;
  preset_id: number;
  is_fast: boolean;
  rise: number;
  status: string;
  timeout: number;
  ips: string[];
  rules: BalancerRule[];
  availability_zone: string;
}

export interface BalancerRule {
  id: number;
  balancer_proto: string;
  balancer_port: number;
  server_proto: string;
  server_port: number;
}

// App
export interface App {
  id: number;
  name: string;
  type: string;
  status: string;
  provider: {
    id: number;
    type: string;
  } | null;
  repository: {
    id: number;
    name: string;
    full_name: string;
    clone_url: string;
  } | null;
  branch: string | null;
  commit: {
    id: string;
    message: string;
  } | null;
  preset: {
    id: number;
    name: string;
    cpu: number;
    ram: number;
    disk: number;
  };
  framework: {
    id: number;
    name: string;
  };
  envs: { key: string; value: string }[];
  domains: string[];
  created_at: string;
}

// Location
export interface Location {
  id: string;
  country?: string;
  city?: string;
  description?: string;
  description_ru?: string;
  description_en?: string;
  is_default?: boolean;
  flags?: {
    is_server_available: boolean;
    is_dbaas_available: boolean;
    is_kubernetes_available: boolean;
    is_s3_available: boolean;
    is_balancer_available: boolean;
    is_vpc_available: boolean;
  };
}

// Server Preset
export interface ServerPreset {
  id: number;
  location: string;
  cpu: number;
  ram: number;
  disk: number;
  disk_type: string;
  bandwidth: number;
  price: number;
  currency: string;
  description?: string;
}

// Database Preset
export interface DatabasePreset {
  id: number;
  description?: string;
  type: string;
  cpu: number;
  ram: number;
  disk: number;
  price: number;
  currency: string;
  location: string;
}

// S3 Preset
export interface S3Preset {
  id: number;
  description?: string;
  disk: number;
  price: number;
  currency: string;
  location: string;
}

// OS Image
export interface OsImage {
  id: number;
  name: string;
  version?: string;
  family?: string;
  description?: string;
}

// K8s Version
export interface K8sVersion {
  version: string;
  is_default?: boolean;
}

// AI Agent
export interface AiAgent {
  id: number;
  name: string;
  model: string;
  preset_id: number;
  status: string;
  created_at: string;
  system_prompt: string | null;
  tokens_used: number;
  tokens_limit: number;
}

// Knowledge Base
export interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  document_count: number;
  tokens_used: number;
  tokens_limit: number;
}

// Firewall Group
export interface FirewallGroup {
  id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  incoming_traffic_policy: string;
  outgoing_traffic_policy: string;
  server_ids: number[];
}

// Firewall Rule
export interface FirewallRule {
  id: number;
  direction: string;
  protocol: string;
  port: string | null;
  cidr: string;
  description: string | null;
}

// Server Log
export interface ServerLog {
  timestamp: string;
  level: string;
  message: string;
}

// Server Statistics
export interface ServerStatistics {
  cpu: {
    percent: number;
    timestamp: string;
  }[];
  ram: {
    percent: number;
    used: number;
    total: number;
    timestamp: string;
  }[];
  disk: {
    percent: number;
    used: number;
    total: number;
    timestamp: string;
  }[];
  network_rx: {
    bytes: number;
    timestamp: string;
  }[];
  network_tx: {
    bytes: number;
    timestamp: string;
  }[];
}

// Database Backup
export interface DatabaseBackup {
  id: number;
  name: string;
  created_at: string;
  status: string;
  size: number;
  type: string;
  comment: string | null;
}

// Database Auto Backup Settings
export interface DatabaseAutoBackupSettings {
  is_enabled: boolean;
  copy_count: number;
  interval: string;
  day_of_week: number | null;
  start_at: string;
}

// Balancer Preset
export interface BalancerPreset {
  id: number;
  description: string | null;
  bandwidth: number;
  replica_count: number;
  request_per_second: number | null;
  price: number;
  currency: string;
  location: string;
}
