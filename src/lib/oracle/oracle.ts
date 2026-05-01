import {
  encodePathSegment,
  normalizeApiBaseUrl,
  readApiBaseUrlFromEnv,
  requestJson,
  withBearerToken,
} from "../api.ts";
import type {
  AdminAnchorDocumentRequest,
  AdminSetTrustedOracleRequest,
  AdminSubmitValuationAndSyncPricingRequest,
  AdminSubmitValuationRequest,
  OracleClientOptions,
  OracleDocumentResponse,
  OracleDocumentWriteResponse,
  OracleTrustedOracleResponse,
  OracleTrustedOracleWriteResponse,
  OracleValuationResponse,
  OracleValuationWriteResponse,
} from "./types.ts";

export interface OracleClient {
  fetchTrustedOracle(oracleAddress: string): Promise<OracleTrustedOracleResponse>;
  fetchValuation(assetAddress: string): Promise<OracleValuationResponse>;
  fetchDocument(assetAddress: string, documentType: string): Promise<OracleDocumentResponse>;
  setTrustedOracle(
    token: string,
    oracleAddress: string,
    request: AdminSetTrustedOracleRequest,
  ): Promise<OracleTrustedOracleWriteResponse>;
  submitValuation(
    token: string,
    request: AdminSubmitValuationRequest,
  ): Promise<OracleValuationWriteResponse>;
  submitValuationAndSyncPricing(
    token: string,
    request: AdminSubmitValuationAndSyncPricingRequest,
  ): Promise<OracleValuationWriteResponse>;
  anchorDocument(
    token: string,
    assetAddress: string,
    documentType: string,
    request: AdminAnchorDocumentRequest,
  ): Promise<OracleDocumentWriteResponse>;
}

export function createOracleClient(options: OracleClientOptions = {}): OracleClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    fetchTrustedOracle(oracleAddress) {
      return requestJson<OracleTrustedOracleResponse>(
        baseUrl,
        `/oracle/trusted-oracles/${encodePathSegment(oracleAddress)}`,
      );
    },

    fetchValuation(assetAddress) {
      return requestJson<OracleValuationResponse>(
        baseUrl,
        `/oracle/assets/${encodePathSegment(assetAddress)}/valuation`,
      );
    },

    fetchDocument(assetAddress, documentType) {
      return requestJson<OracleDocumentResponse>(
        baseUrl,
        `/oracle/assets/${encodePathSegment(assetAddress)}/documents/${encodePathSegment(documentType)}`,
      );
    },

    setTrustedOracle(token, oracleAddress, request) {
      return requestJson<OracleTrustedOracleWriteResponse>(
        baseUrl,
        `/admin/oracle/trusted-oracles/${encodePathSegment(oracleAddress)}`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    submitValuation(token, request) {
      return requestJson<OracleValuationWriteResponse>(baseUrl, "/admin/oracle/valuations", {
        method: "POST",
        headers: withBearerToken(token),
        json: request,
      });
    },

    submitValuationAndSyncPricing(token, request) {
      return requestJson<OracleValuationWriteResponse>(
        baseUrl,
        "/admin/oracle/valuations/sync-pricing",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    anchorDocument(token, assetAddress, documentType, request) {
      return requestJson<OracleDocumentWriteResponse>(
        baseUrl,
        `/admin/oracle/assets/${encodePathSegment(assetAddress)}/documents/${encodePathSegment(documentType)}`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },
  };
}

export const oracleClient = createOracleClient({
  baseUrl: readApiBaseUrlFromEnv(),
});

export { ApiError } from "../api.ts";
