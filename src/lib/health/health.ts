import { normalizeApiBaseUrl, readApiBaseUrlFromEnv, requestJson } from "../api.ts";
import type { HealthClientOptions, HealthResponse } from "./types.ts";

export interface HealthClient {
  fetchHealth(): Promise<HealthResponse>;
}

export function createHealthClient(options: HealthClientOptions = {}): HealthClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    fetchHealth() {
      return requestJson<HealthResponse>(baseUrl, "/health");
    },
  };
}

export const healthClient = createHealthClient({
  baseUrl: readApiBaseUrlFromEnv(),
});

export { ApiError } from "../api.ts";
