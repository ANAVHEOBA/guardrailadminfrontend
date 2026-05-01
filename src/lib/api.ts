export type ApiQueryPrimitive = string | number | boolean;
export type ApiQueryValue = ApiQueryPrimitive | null | undefined;
export type ApiQueryParams = Record<string, ApiQueryValue>;

interface ErrorResponseLike {
  error?: string;
  message?: string;
}

export interface JsonRequestInit extends RequestInit {
  json?: unknown;
  query?: ApiQueryParams;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Request failed.";
}

export function readApiBaseUrlFromEnv(): string | undefined {
  return import.meta.env?.VITE_API_BASE_URL?.trim();
}

export function normalizeApiBaseUrl(rawBaseUrl: string | undefined): string {
  if (!rawBaseUrl) {
    return "";
  }

  return rawBaseUrl.replace(/\/+$/, "");
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export function withBearerToken(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function buildApiUrl(baseUrl: string, path: string, query?: ApiQueryParams): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }

    params.set(key, String(value));
  }

  const search = params.toString();

  if (!baseUrl) {
    return search ? `${normalizedPath}?${search}` : normalizedPath;
  }

  return search ? `${baseUrl}${normalizedPath}?${search}` : `${baseUrl}${normalizedPath}`;
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: JsonRequestInit = {},
): Promise<T> {
  const { json, query, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  headers.set("Accept", "application/json");

  let body = requestInit.body;

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  const response = await fetch(buildApiUrl(baseUrl, path, query), {
    ...requestInit,
    headers,
    body,
    credentials: requestInit.credentials ?? "include",
  });

  if (!response.ok) {
    let message = response.statusText || "Request failed";

    try {
      const payload = (await response.json()) as ErrorResponseLike;

      if (typeof payload.error === "string" && payload.error.length > 0) {
        message = payload.error;
      } else if (typeof payload.message === "string" && payload.message.length > 0) {
        message = payload.message;
      }
    } catch {
      // Fall back to the HTTP status text when the body is not valid JSON.
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
