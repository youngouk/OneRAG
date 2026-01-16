// API Response Types
export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

// API 응답에서 받는 실제 문서 타입 (백엔드 응답 구조에 맞게 수정)
export interface ApiDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  status: string;
  chunk_count: number;
  processing_time?: number | null;
  error_message?: string | null;
}

// 프론트엔드에서 사용하는 문서 타입
export interface Document {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  status: 'processing' | 'completed' | 'failed';
  chunks?: number;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
  };
}

export interface UploadResponse {
  success: boolean;
  jobId: string;
  message: string;
}

export interface UploadStatus {
  job_id: string;
  status: 'processing' | 'completed' | 'failed' | 'completed_with_errors';
  progress: number;
  message: string;
  filename?: string;
  chunk_count?: number;
  processing_time?: number;
  error_message?: string | null;
  timestamp?: string;
  documentId?: string; // 백워드 호환성을 위해 유지
  error?: string; // 백워드 호환성을 위해 유지
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Source[];
}

export interface SourceAdditionalMetadata {
  folder?: string;
  full_path?: string;
  uploaded_at?: string;
  batch_processed?: boolean;
  bm42_idf?: boolean;
  doc_type?: string;
  table_count?: number;
  has_images?: boolean;
  data_root?: string;
  priority_level?: string;
  priority_numeric?: number;
  document_series?: string;
  doc_category?: string;
  law_id?: string;
  law_serial_number?: string;
  law_name?: string;
  law_slug?: string;
  agency?: string;
  legal_department?: string;
  agency_phone?: string;
  enacted_date?: string;
  effective_date?: string;
  promulgation_number?: string;
  revision_type?: string;
  revision_reason?: string;
  article_count?: number;
  has_appendix?: boolean;
  appendix_promulgation_date?: string;
  display_title?: string;
  normalized_filename?: string;
  file_url_status?: string;
  multi_query_count?: number;
  score_details?: {
    avg_score?: number;
    max_score?: number;
    diversity_bonus?: number;
  };
}

export interface Source {
  id: number;
  document: string;
  page?: number | null;
  chunk?: number | null;
  relevance: number;
  content_preview: string;
  file_type?: string | null;
  file_path?: string | null;
  file_size?: number | null;
  total_chunks?: number | null;
  file_hash?: string | null;
  load_timestamp?: string | null;
  sheet_name?: string | null;
  format?: string | null;
  json_type?: string | null;
  item_index?: number | null;
  rerank_method?: string | null;
  original_score?: number | null;
  additional_metadata?: SourceAdditionalMetadata | null;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  session_id: string;
  processing_time: number;
  tokens_used: number;
  timestamp: string;
  model_info?: {
    provider: string;
    model: string;
    generation_time: number;
    model_config?: Record<string, unknown>;
  };
}

export interface ChatHistoryEntry {
  id?: string | number;
  role?: 'user' | 'assistant';
  message?: string;
  question?: string;
  prompt?: string;
  response?: string;
  answer?: string;
  content?: string;
  user_message?: string;
  assistant_message?: string;
  session_id?: string;
  timestamp?: string;
  created_at?: string;
  updated_at?: string;
  sources?: Source[];
}

// 세션 정보 API 응답 타입
export interface SessionInfo {
  session_id: string;
  messageCount: number;
  tokensUsed: number;
  processingTime: number;
  modelInfo: {
    provider: string;
    model: string;
    generation_time: number;
    model_config?: Record<string, unknown>;
  };
  timestamp: string;
}

// Qdrant Monitoring Types
export interface QdrantHealthResponse {
  status: string;
  message?: string;
  timestamp?: string;
}

export interface QdrantHealthCheck {
  name: string;
  status: string;
  message?: string;
  latency_ms?: number;
  last_checked?: string;
  details?: Record<string, unknown>;
}

export interface QdrantClusterNode {
  id?: string;
  name?: string;
  role?: string;
  status?: string;
  version?: string;
  uptime_seconds?: number;
  uptime_human?: string;
  region?: string;
  details?: Record<string, unknown>;
}

export interface QdrantClusterInfo {
  name?: string;
  status?: string;
  version?: string;
  region?: string;
  node_count?: number;
  created_at?: string;
  last_updated?: string;
  nodes?: QdrantClusterNode[];
  metadata?: Record<string, unknown>;
}

export interface QdrantCollectionSummary {
  name: string;
  status?: string;
  vector_count?: number;
  points_count?: number; // 백엔드가 points_count를 사용
  indexed_vectors?: number;
  is_active?: boolean;
  shard_count?: number;
  replication_factor?: number;
  size_mb?: number;
  last_update?: string;
  payload_schema?: Record<string, unknown>;
  info?: Record<string, unknown>;
}

export interface QdrantCollectionsOverview {
  total_count?: number;
  active_collection?: string | null;
  active_collection_source?: string;
  items?: QdrantCollectionSummary[];
  collections?: QdrantCollectionSummary[];
  list?: QdrantCollectionSummary[]; // status API의 collections.list
}

export interface QdrantCollectionDetail {
  name: string;
  created_at?: string;
  last_modified?: string;
  configuration?: Record<string, unknown>;
  vectors?: {
    structure?: string;
    size?: number;
    distance?: string;
    dense?: {
      enabled?: boolean;
      dimensions?: number;
      distance_metric?: string;
      count?: number;
    };
    sparse?: {
      enabled?: boolean;
      type?: string;
      count?: number;
    };
    on_disk?: boolean;
    [key: string]: unknown;
  };
  storage?: {
    points_count?: number;
    segments_count?: number;
    memory_usage_mb?: number;
    disk_usage_mb?: number;
    payload_size_mb?: number;
    vectors_size_mb?: number;
  };
  metadata_distribution?: {
    file_types?: Record<string, number>;
    total_unique_files?: number;
    avg_chunks_per_file?: number;
  };
  performance?: {
    avg_search_latency_ms?: number;
    indexing_progress?: number;
    optimization_status?: string;
  };
  statistics?: {
    vector_count?: number;
    indexed_vectors?: number;
    points_count?: number;
    segments_count?: number;
    [key: string]: unknown;
  };
  status?: string;
  payload_schema?: Record<string, unknown>;
  hnsw_config?: Record<string, unknown>;
  optimizers_config?: Record<string, unknown>;
  params?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface QdrantResourceLimits {
  memory_mb?: number;
  disk_mb?: number;
  vector_limit?: number;
  [key: string]: number | undefined;
}

export interface QdrantResourceUsage {
  total_vectors?: number;
  total_memory_mb?: number;
  total_disk_mb?: number;
  usage_percentage?: number | {
    collections?: number;
    vectors?: number;
    memory?: number;
    disk?: number;
  };
  memory_percent?: number;
  disk_percent?: number;
  cpu_percent?: number;
  limits?: {
    max_collections?: number;
    max_vectors_per_collection?: number;
    max_payload_size_mb?: number;
    max_vector_dimensions?: number;
    memory_mb?: number;
    disk_mb?: number;
    vector_limit?: number;
    [key: string]: number | undefined;
  };
  breakdown?: Record<string, unknown>;
}

export interface QdrantMetricsResponse {
  status?: string;
  timestamp?: string;
  metrics?: {
    operations?: {
      searches_per_second?: number;
      upserts_per_second?: number;
      deletes_per_second?: number;
      total_operations_24h?: number;
      [key: string]: number | string | null | undefined;
    };
    performance?: {
      p50_latency_ms?: number;
      p95_latency_ms?: number;
      p99_latency_ms?: number;
      error_rate?: number;
      [key: string]: number | string | null | undefined;
    };
    resources?: {
      cpu_usage_percent?: number;
      memory_usage_percent?: number;
      disk_io_read_mbps?: number;
      disk_io_write_mbps?: number;
      network_in_mbps?: number;
      network_out_mbps?: number;
      [key: string]: number | string | null | undefined;
    };
  };
  // 호환성을 위해 기존 필드도 유지
  operations?: Record<string, number | string | null>;
  performance?: Record<string, number | string | null>;
  resources?: Record<string, number | string | null>;
}

export interface QdrantStatusResponse {
  status?: string;
  timestamp?: string;
  cluster?: QdrantClusterInfo;
  collections?: QdrantCollectionsOverview;
  active_collection_details?: QdrantCollectionDetail | null;
  resource_usage?: QdrantResourceUsage;
  health_checks?: QdrantHealthCheck[] | {
    overall_status?: string;
    checks?: Record<string, string>;
    warnings?: string[];
    recommendations?: string[];
  };
  metadata?: Record<string, unknown>;
}

export interface QdrantCollectionsResponse {
  collections: QdrantCollectionSummary[];
  total_count?: number;
  active_collection?: string | null;
}

export type QdrantCollectionDetailResponse = QdrantCollectionDetail;

export type QdrantResourceUsageResponse = QdrantResourceUsage;

// UI State Types
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

// Form Types
export interface UploadFormData {
  file: File | null;
  description?: string;
}

export interface SearchFilters {
  query: string;
  status?: Document['status'];
  dateFrom?: string;
  dateTo?: string;
}

// ChatEmptyState Settings Types
export interface ChatEmptyStateSettings {
  mainMessage: string;
  subMessage: string;
  suggestions: string[];
}

export interface ChatEmptyStateSettingsUpdateRequest {
  mainMessage?: string;
  subMessage?: string;
  suggestions?: string[];
}

// WebSocket DI 패턴 타입
export type {
  IWebSocket,
  WebSocketFactory,
  WebSocketConfig,
  WebSocketReadyStateType,
} from './websocket';
export {
  WebSocketReadyState,
  defaultWebSocketFactory,
  defaultWebSocketConfig,
} from './websocket';
