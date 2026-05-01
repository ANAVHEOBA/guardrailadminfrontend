import {
  encodePathSegment,
  normalizeApiBaseUrl,
  readApiBaseUrlFromEnv,
  requestJson,
  withBearerToken,
} from "../api.ts";
import type {
  AdminBatchUpsertComplianceInvestorsRequest,
  AdminComplianceAssetRulesUpsertResponse,
  AdminComplianceInvestorBatchUpsertResponse,
  AdminComplianceInvestorUpsertResponse,
  AdminComplianceJurisdictionRestrictionUpsertResponse,
  AdminSetComplianceAssetRulesRequest,
  AdminSetComplianceJurisdictionRestrictionRequest,
  AdminUpsertComplianceInvestorRequest,
  ComplianceAssetRulesResponse,
  ComplianceCheckRedeemRequest,
  ComplianceCheckResponse,
  ComplianceCheckSubscribeRequest,
  ComplianceCheckTransferRequest,
  ComplianceClientOptions,
  ComplianceInvestorResponse,
  ComplianceJurisdictionRestrictionResponse,
} from "./types.ts";

export interface ComplianceClient {
  fetchInvestor(wallet: string): Promise<ComplianceInvestorResponse>;
  fetchAssetRules(assetAddress: string): Promise<ComplianceAssetRulesResponse>;
  fetchJurisdictionRestriction(
    assetAddress: string,
    jurisdiction: string,
  ): Promise<ComplianceJurisdictionRestrictionResponse>;
  checkSubscribe(request: ComplianceCheckSubscribeRequest): Promise<ComplianceCheckResponse>;
  checkTransfer(request: ComplianceCheckTransferRequest): Promise<ComplianceCheckResponse>;
  checkRedeem(request: ComplianceCheckRedeemRequest): Promise<ComplianceCheckResponse>;
  upsertInvestor(
    token: string,
    wallet: string,
    request: AdminUpsertComplianceInvestorRequest,
  ): Promise<AdminComplianceInvestorUpsertResponse>;
  batchUpsertInvestors(
    token: string,
    request: AdminBatchUpsertComplianceInvestorsRequest,
  ): Promise<AdminComplianceInvestorBatchUpsertResponse>;
  setAssetRules(
    token: string,
    assetAddress: string,
    request: AdminSetComplianceAssetRulesRequest,
  ): Promise<AdminComplianceAssetRulesUpsertResponse>;
  setJurisdictionRestriction(
    token: string,
    assetAddress: string,
    jurisdiction: string,
    request: AdminSetComplianceJurisdictionRestrictionRequest,
  ): Promise<AdminComplianceJurisdictionRestrictionUpsertResponse>;
}

export function createComplianceClient(options: ComplianceClientOptions = {}): ComplianceClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    fetchInvestor(wallet) {
      return requestJson<ComplianceInvestorResponse>(
        baseUrl,
        `/compliance/investors/${encodePathSegment(wallet)}`,
      );
    },

    fetchAssetRules(assetAddress) {
      return requestJson<ComplianceAssetRulesResponse>(
        baseUrl,
        `/compliance/assets/${encodePathSegment(assetAddress)}/rules`,
      );
    },

    fetchJurisdictionRestriction(assetAddress, jurisdiction) {
      return requestJson<ComplianceJurisdictionRestrictionResponse>(
        baseUrl,
        `/compliance/assets/${encodePathSegment(assetAddress)}/jurisdictions/${encodePathSegment(jurisdiction)}`,
      );
    },

    checkSubscribe(request) {
      return requestJson<ComplianceCheckResponse>(baseUrl, "/compliance/check/subscribe", {
        method: "POST",
        json: request,
      });
    },

    checkTransfer(request) {
      return requestJson<ComplianceCheckResponse>(baseUrl, "/compliance/check/transfer", {
        method: "POST",
        json: request,
      });
    },

    checkRedeem(request) {
      return requestJson<ComplianceCheckResponse>(baseUrl, "/compliance/check/redeem", {
        method: "POST",
        json: request,
      });
    },

    upsertInvestor(token, wallet, request) {
      return requestJson<AdminComplianceInvestorUpsertResponse>(
        baseUrl,
        `/admin/compliance/investors/${encodePathSegment(wallet)}`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    batchUpsertInvestors(token, request) {
      return requestJson<AdminComplianceInvestorBatchUpsertResponse>(
        baseUrl,
        "/admin/compliance/investors/batch",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    setAssetRules(token, assetAddress, request) {
      return requestJson<AdminComplianceAssetRulesUpsertResponse>(
        baseUrl,
        `/admin/compliance/assets/${encodePathSegment(assetAddress)}/rules`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    setJurisdictionRestriction(token, assetAddress, jurisdiction, request) {
      return requestJson<AdminComplianceJurisdictionRestrictionUpsertResponse>(
        baseUrl,
        `/admin/compliance/assets/${encodePathSegment(assetAddress)}/jurisdictions/${encodePathSegment(jurisdiction)}`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },
  };
}

export const complianceClient = createComplianceClient({
  baseUrl: readApiBaseUrlFromEnv(),
});

export { ApiError } from "../api.ts";
