import {
  encodePathSegment,
  normalizeApiBaseUrl,
  readApiBaseUrlFromEnv,
  requestJson,
  withBearerToken,
} from "../api.ts";
import type {
  AdminListAssetRequestsQuery,
  AdminUpdateAssetRequestStatusRequest,
  AssetRequestClientOptions,
  AssetRequestDeployResponse,
  AssetRequestListResponse,
  AssetRequestResponse,
} from "./types.ts";

export interface AssetRequestClient {
  listForReview(
    token: string,
    query?: AdminListAssetRequestsQuery,
  ): Promise<AssetRequestListResponse>;
  updateStatus(
    token: string,
    requestId: string,
    request: AdminUpdateAssetRequestStatusRequest,
  ): Promise<AssetRequestResponse>;
  deploy(token: string, requestId: string): Promise<AssetRequestDeployResponse>;
}

export function createAssetRequestClient(
  options: AssetRequestClientOptions = {},
): AssetRequestClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    listForReview(token, query) {
      return requestJson<AssetRequestListResponse>(baseUrl, "/admin/asset-requests", {
        headers: withBearerToken(token),
        query,
      });
    },

    updateStatus(token, requestId, request) {
      return requestJson<AssetRequestResponse>(
        baseUrl,
        `/admin/asset-requests/${encodePathSegment(requestId)}/status`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    deploy(token, requestId) {
      return requestJson<AssetRequestDeployResponse>(
        baseUrl,
        `/admin/asset-requests/${encodePathSegment(requestId)}/deploy`,
        {
          method: "POST",
          headers: withBearerToken(token),
        },
      );
    },
  };
}

export const assetRequestClient = createAssetRequestClient({
  baseUrl: readApiBaseUrlFromEnv(),
});
