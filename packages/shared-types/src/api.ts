export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface ApiError {
  detail: string;
  status_code: number;
}

export interface HealthStatus {
  status: "ok" | "error";
  environment?: string;
  db?: string;
  redis?: string;
  ai_enabled?: boolean;
}
