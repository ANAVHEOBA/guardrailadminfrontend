import {
  encodePathSegment,
  normalizeApiBaseUrl,
  readApiBaseUrlFromEnv,
  requestJson,
  withBearerToken,
} from "../api.ts";
import type {
  AdminBurnAssetRequest,
  AdminControllerTransferRequest,
  AdminCreateAssetRequest,
  AdminIssueAssetRequest,
  AdminProcessRedemptionRequest,
  AdminRegisterAssetTypeRequest,
  AdminSetAssetCatalogRequest,
  AdminSetAssetComplianceRegistryRequest,
  AdminSetAssetMetadataRequest,
  AdminSetAssetPriceRequest,
  AdminSetAssetPricingRequest,
  AdminSetAssetSelfServicePurchaseRequest,
  AdminSetAssetStateRequest,
  AdminSetAssetTreasuryRequest,
  AssetCatalogWriteResponse,
  AssetCheckTransferRequest,
  AssetClientOptions,
  AssetFactoryStatusResponse,
  AssetFactoryWriteResponse,
  AssetHolderStateResponse,
  AssetListResponse,
  AssetPreviewRequest,
  AssetPreviewResponse,
  AssetResponse,
  AssetTransferCheckResponse,
  AssetTypeListResponse,
  AssetTypeResponse,
  AssetTypeWriteResponse,
  AssetWriteResponse,
  GaslessApprovePaymentTokenRequest,
  GaslessAssetActionResponse,
  GaslessCancelRedemptionRequest,
  GaslessClaimYieldRequest,
  GaslessPurchaseAssetRequest,
  GaslessRedeemAssetRequest,
  ListAssetsQuery,
} from "./types.ts";

export interface AssetClient {
  fetchFactoryStatus(): Promise<AssetFactoryStatusResponse>;
  listAssetTypes(): Promise<AssetTypeListResponse>;
  fetchAssetType(assetTypeId: string): Promise<AssetTypeResponse>;
  listAssets(query?: ListAssetsQuery): Promise<AssetListResponse>;
  listAssetsByType(assetTypeId: string): Promise<AssetListResponse>;
  fetchAssetByProposal(proposalId: string): Promise<AssetResponse>;
  fetchAssetBySlug(slug: string): Promise<AssetResponse>;
  fetchAsset(assetAddress: string): Promise<AssetResponse>;
  fetchAssetHolderState(
    assetAddress: string,
    walletAddress: string,
  ): Promise<AssetHolderStateResponse>;
  previewPurchase(assetAddress: string, request: AssetPreviewRequest): Promise<AssetPreviewResponse>;
  previewRedemption(
    assetAddress: string,
    request: AssetPreviewRequest,
  ): Promise<AssetPreviewResponse>;
  checkTransfer(
    assetAddress: string,
    request: AssetCheckTransferRequest,
  ): Promise<AssetTransferCheckResponse>;
  registerAssetType(token: string, request: AdminRegisterAssetTypeRequest): Promise<AssetTypeWriteResponse>;
  unregisterAssetType(token: string, assetTypeId: string): Promise<AssetTypeWriteResponse>;
  pauseFactory(token: string): Promise<AssetFactoryWriteResponse>;
  unpauseFactory(token: string): Promise<AssetFactoryWriteResponse>;
  createAsset(token: string, request: AdminCreateAssetRequest): Promise<AssetWriteResponse>;
  issueAsset(
    token: string,
    assetAddress: string,
    request: AdminIssueAssetRequest,
  ): Promise<AssetWriteResponse>;
  burnAsset(
    token: string,
    assetAddress: string,
    request: AdminBurnAssetRequest,
  ): Promise<AssetWriteResponse>;
  setAssetState(
    token: string,
    assetAddress: string,
    request: AdminSetAssetStateRequest,
  ): Promise<AssetWriteResponse>;
  setSubscriptionPrice(
    token: string,
    assetAddress: string,
    request: AdminSetAssetPriceRequest,
  ): Promise<AssetWriteResponse>;
  setRedemptionPrice(
    token: string,
    assetAddress: string,
    request: AdminSetAssetPriceRequest,
  ): Promise<AssetWriteResponse>;
  setPricing(
    token: string,
    assetAddress: string,
    request: AdminSetAssetPricingRequest,
  ): Promise<AssetWriteResponse>;
  setSelfServicePurchaseEnabled(
    token: string,
    assetAddress: string,
    request: AdminSetAssetSelfServicePurchaseRequest,
  ): Promise<AssetWriteResponse>;
  setMetadataHash(
    token: string,
    assetAddress: string,
    request: AdminSetAssetMetadataRequest,
  ): Promise<AssetWriteResponse>;
  setAssetCatalog(
    token: string,
    assetAddress: string,
    request: AdminSetAssetCatalogRequest,
  ): Promise<AssetCatalogWriteResponse>;
  setComplianceRegistry(
    token: string,
    assetAddress: string,
    request: AdminSetAssetComplianceRegistryRequest,
  ): Promise<AssetWriteResponse>;
  setTreasury(
    token: string,
    assetAddress: string,
    request: AdminSetAssetTreasuryRequest,
  ): Promise<AssetWriteResponse>;
  disableController(token: string, assetAddress: string): Promise<AssetWriteResponse>;
  controllerTransfer(
    token: string,
    assetAddress: string,
    request: AdminControllerTransferRequest,
  ): Promise<AssetWriteResponse>;
  processRedemption(
    token: string,
    assetAddress: string,
    request: AdminProcessRedemptionRequest,
  ): Promise<AssetWriteResponse>;
  approvePaymentToken(
    token: string,
    assetAddress: string,
    request: GaslessApprovePaymentTokenRequest,
  ): Promise<GaslessAssetActionResponse>;
  purchaseAsset(
    token: string,
    assetAddress: string,
    request: GaslessPurchaseAssetRequest,
  ): Promise<GaslessAssetActionResponse>;
  claimYield(
    token: string,
    assetAddress: string,
    request: GaslessClaimYieldRequest,
  ): Promise<GaslessAssetActionResponse>;
  redeemAsset(
    token: string,
    assetAddress: string,
    request: GaslessRedeemAssetRequest,
  ): Promise<GaslessAssetActionResponse>;
  cancelRedemption(
    token: string,
    assetAddress: string,
    request: GaslessCancelRedemptionRequest,
  ): Promise<GaslessAssetActionResponse>;
}

function assetPath(assetAddress: string): string {
  return `/assets/${encodePathSegment(assetAddress)}`;
}

function adminAssetPath(assetAddress: string): string {
  return `/admin${assetPath(assetAddress)}`;
}

export function createAssetClient(options: AssetClientOptions = {}): AssetClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    fetchFactoryStatus() {
      return requestJson<AssetFactoryStatusResponse>(baseUrl, "/assets/factory");
    },

    listAssetTypes() {
      return requestJson<AssetTypeListResponse>(baseUrl, "/assets/types");
    },

    fetchAssetType(assetTypeId) {
      return requestJson<AssetTypeResponse>(
        baseUrl,
        `/assets/types/${encodePathSegment(assetTypeId)}`,
      );
    },

    listAssets(query) {
      return requestJson<AssetListResponse>(baseUrl, "/assets", {
        query,
      });
    },

    listAssetsByType(assetTypeId) {
      return requestJson<AssetListResponse>(
        baseUrl,
        `/assets/by-type/${encodePathSegment(assetTypeId)}`,
      );
    },

    fetchAssetByProposal(proposalId) {
      return requestJson<AssetResponse>(
        baseUrl,
        `/assets/proposals/${encodePathSegment(proposalId)}`,
      );
    },

    fetchAssetBySlug(slug) {
      return requestJson<AssetResponse>(baseUrl, `/assets/slug/${encodePathSegment(slug)}`);
    },

    fetchAsset(assetAddress) {
      return requestJson<AssetResponse>(baseUrl, assetPath(assetAddress));
    },

    fetchAssetHolderState(assetAddress, walletAddress) {
      return requestJson<AssetHolderStateResponse>(
        baseUrl,
        `${assetPath(assetAddress)}/holders/${encodePathSegment(walletAddress)}`,
      );
    },

    previewPurchase(assetAddress, request) {
      return requestJson<AssetPreviewResponse>(
        baseUrl,
        `${assetPath(assetAddress)}/preview/purchase`,
        {
          method: "POST",
          json: request,
        },
      );
    },

    previewRedemption(assetAddress, request) {
      return requestJson<AssetPreviewResponse>(
        baseUrl,
        `${assetPath(assetAddress)}/preview/redemption`,
        {
          method: "POST",
          json: request,
        },
      );
    },

    checkTransfer(assetAddress, request) {
      return requestJson<AssetTransferCheckResponse>(
        baseUrl,
        `${assetPath(assetAddress)}/check/transfer`,
        {
          method: "POST",
          json: request,
        },
      );
    },

    registerAssetType(token, request) {
      return requestJson<AssetTypeWriteResponse>(baseUrl, "/admin/assets/types", {
        method: "POST",
        headers: withBearerToken(token),
        json: request,
      });
    },

    unregisterAssetType(token, assetTypeId) {
      return requestJson<AssetTypeWriteResponse>(
        baseUrl,
        `/admin/assets/types/${encodePathSegment(assetTypeId)}`,
        {
          method: "DELETE",
          headers: withBearerToken(token),
        },
      );
    },

    pauseFactory(token) {
      return requestJson<AssetFactoryWriteResponse>(baseUrl, "/admin/assets/factory/pause", {
        method: "POST",
        headers: withBearerToken(token),
      });
    },

    unpauseFactory(token) {
      return requestJson<AssetFactoryWriteResponse>(baseUrl, "/admin/assets/factory/unpause", {
        method: "POST",
        headers: withBearerToken(token),
      });
    },

    createAsset(token, request) {
      return requestJson<AssetWriteResponse>(baseUrl, "/admin/assets", {
        method: "POST",
        headers: withBearerToken(token),
        json: request,
      });
    },

    issueAsset(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(baseUrl, `${adminAssetPath(assetAddress)}/issue`, {
        method: "POST",
        headers: withBearerToken(token),
        json: request,
      });
    },

    burnAsset(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(baseUrl, `${adminAssetPath(assetAddress)}/burn`, {
        method: "POST",
        headers: withBearerToken(token),
        json: request,
      });
    },

    setAssetState(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(baseUrl, `${adminAssetPath(assetAddress)}/state`, {
        method: "PUT",
        headers: withBearerToken(token),
        json: request,
      });
    },

    setSubscriptionPrice(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(
        baseUrl,
        `${adminAssetPath(assetAddress)}/subscription-price`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    setRedemptionPrice(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(
        baseUrl,
        `${adminAssetPath(assetAddress)}/redemption-price`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    setPricing(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(baseUrl, `${adminAssetPath(assetAddress)}/pricing`, {
        method: "PUT",
        headers: withBearerToken(token),
        json: request,
      });
    },

    setSelfServicePurchaseEnabled(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(
        baseUrl,
        `${adminAssetPath(assetAddress)}/self-service-purchase`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    setMetadataHash(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(baseUrl, `${adminAssetPath(assetAddress)}/metadata`, {
        method: "PUT",
        headers: withBearerToken(token),
        json: request,
      });
    },

    setAssetCatalog(token, assetAddress, request) {
      return requestJson<AssetCatalogWriteResponse>(
        baseUrl,
        `${adminAssetPath(assetAddress)}/catalog`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    setComplianceRegistry(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(
        baseUrl,
        `${adminAssetPath(assetAddress)}/compliance-registry`,
        {
          method: "PUT",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    setTreasury(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(baseUrl, `${adminAssetPath(assetAddress)}/treasury`, {
        method: "PUT",
        headers: withBearerToken(token),
        json: request,
      });
    },

    disableController(token, assetAddress) {
      return requestJson<AssetWriteResponse>(
        baseUrl,
        `${adminAssetPath(assetAddress)}/controller/disable`,
        {
          method: "POST",
          headers: withBearerToken(token),
        },
      );
    },

    controllerTransfer(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(
        baseUrl,
        `${adminAssetPath(assetAddress)}/controller/transfer`,
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    processRedemption(token, assetAddress, request) {
      return requestJson<AssetWriteResponse>(
        baseUrl,
        `${adminAssetPath(assetAddress)}/redemptions/process`,
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    approvePaymentToken(token, assetAddress, request) {
      return requestJson<GaslessAssetActionResponse>(
        baseUrl,
        `${assetPath(assetAddress)}/payment-token/approve`,
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    purchaseAsset(token, assetAddress, request) {
      return requestJson<GaslessAssetActionResponse>(baseUrl, `${assetPath(assetAddress)}/purchase`, {
        method: "POST",
        headers: withBearerToken(token),
        json: request,
      });
    },

    claimYield(token, assetAddress, request) {
      return requestJson<GaslessAssetActionResponse>(
        baseUrl,
        `${assetPath(assetAddress)}/yield/claim`,
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    redeemAsset(token, assetAddress, request) {
      return requestJson<GaslessAssetActionResponse>(baseUrl, `${assetPath(assetAddress)}/redeem`, {
        method: "POST",
        headers: withBearerToken(token),
        json: request,
      });
    },

    cancelRedemption(token, assetAddress, request) {
      return requestJson<GaslessAssetActionResponse>(
        baseUrl,
        `${assetPath(assetAddress)}/redemptions/cancel`,
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },
  };
}

export const assetClient = createAssetClient({
  baseUrl: readApiBaseUrlFromEnv(),
});

export { ApiError } from "../api.ts";
