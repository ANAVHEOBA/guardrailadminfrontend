export interface HealthClientOptions {
  baseUrl?: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
}
