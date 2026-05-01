import {
  encodePathSegment,
  normalizeApiBaseUrl,
  readApiBaseUrlFromEnv,
  requestJson,
  withBearerToken,
} from "../api.ts";
import type {
  AdminApproveTreasuryPaymentTokenRequest,
  AdminDepositAssetLiquidityRequest,
  AdminDepositYieldRequest,
  AdminEmergencyWithdrawRequest,
  AdminReleaseCapitalRequest,
  TreasuryAssetResponse,
  TreasuryAssetWriteResponse,
  TreasuryClientOptions,
  TreasuryPaymentTokenApprovalResponse,
  TreasuryStatusResponse,
  TreasuryStatusWriteResponse,
} from "./types.ts";

export interface TreasuryClient {
  fetchStatus(): Promise<TreasuryStatusResponse>;
  fetchAsset(assetAddress: string): Promise<TreasuryAssetResponse>;
  approvePaymentToken(
    token: string,
    request: AdminApproveTreasuryPaymentTokenRequest,
  ): Promise<TreasuryPaymentTokenApprovalResponse>;
  depositAssetLiquidity(
    token: string,
    request: AdminDepositAssetLiquidityRequest,
  ): Promise<TreasuryAssetWriteResponse>;
  releaseCapital(
    token: string,
    request: AdminReleaseCapitalRequest,
  ): Promise<TreasuryAssetWriteResponse>;
  depositYield(
    token: string,
    request: AdminDepositYieldRequest,
  ): Promise<TreasuryAssetWriteResponse>;
  emergencyWithdraw(
    token: string,
    request: AdminEmergencyWithdrawRequest,
  ): Promise<TreasuryStatusWriteResponse>;
  pause(token: string): Promise<TreasuryStatusWriteResponse>;
  unpause(token: string): Promise<TreasuryStatusWriteResponse>;
}

export function createTreasuryClient(options: TreasuryClientOptions = {}): TreasuryClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    fetchStatus() {
      return requestJson<TreasuryStatusResponse>(baseUrl, "/treasury");
    },

    fetchAsset(assetAddress) {
      return requestJson<TreasuryAssetResponse>(
        baseUrl,
        `/treasury/assets/${encodePathSegment(assetAddress)}`,
      );
    },

    approvePaymentToken(token, request) {
      return requestJson<TreasuryPaymentTokenApprovalResponse>(
        baseUrl,
        "/admin/treasury/payment-token/approve",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    depositAssetLiquidity(token, request) {
      return requestJson<TreasuryAssetWriteResponse>(
        baseUrl,
        "/admin/treasury/liquidity/deposit",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    releaseCapital(token, request) {
      return requestJson<TreasuryAssetWriteResponse>(
        baseUrl,
        "/admin/treasury/capital/release",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    depositYield(token, request) {
      return requestJson<TreasuryAssetWriteResponse>(
        baseUrl,
        "/admin/treasury/yield/deposit",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    emergencyWithdraw(token, request) {
      return requestJson<TreasuryStatusWriteResponse>(
        baseUrl,
        "/admin/treasury/emergency-withdraw",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    pause(token) {
      return requestJson<TreasuryStatusWriteResponse>(baseUrl, "/admin/treasury/pause", {
        method: "POST",
        headers: withBearerToken(token),
      });
    },

    unpause(token) {
      return requestJson<TreasuryStatusWriteResponse>(baseUrl, "/admin/treasury/unpause", {
        method: "POST",
        headers: withBearerToken(token),
      });
    },
  };
}

export const treasuryClient = createTreasuryClient({
  baseUrl: readApiBaseUrlFromEnv(),
});

export { ApiError } from "../api.ts";
