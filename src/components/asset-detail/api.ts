import {
  assetClient,
  marketClient,
  type AssetDetailResponse,
  type AssetHistoryResponse,
  type AssetResponse,
  type PaymentTokenQuoteResponse,
} from "~/lib";
import { inferMarketCurrencyFromAsset } from "~/lib";

import { isAssetAddressIdentifier } from "./format";
import type { AssetDetailLookupMode, TimeRange } from "./types";
import { HISTORY_RANGE_MAP } from "./types";

export async function fetchAssetDetail(
  mode: AssetDetailLookupMode,
  identifier: string,
): Promise<AssetDetailResponse> {
  switch (mode) {
    case "public":
      return isAssetAddressIdentifier(identifier)
        ? assetClient.fetchAssetDetail(identifier)
        : assetClient.fetchAssetDetailBySlug(identifier);
    case "asset_address":
      return assetClient.fetchAssetDetail(identifier);
    case "proposal":
      return assetClient.fetchAssetDetailByProposal(identifier);
    case "slug":
      return assetClient.fetchAssetDetailBySlug(identifier);
  }
}

export async function fetchAssetHistory(
  mode: AssetDetailLookupMode,
  identifier: string,
  range: TimeRange,
): Promise<AssetHistoryResponse> {
  const query = {
    range: HISTORY_RANGE_MAP[range],
  };

  switch (mode) {
    case "public":
      return isAssetAddressIdentifier(identifier)
        ? assetClient.fetchAssetHistory(identifier, query)
        : assetClient.fetchAssetHistoryBySlug(identifier, query);
    case "asset_address":
      return assetClient.fetchAssetHistory(identifier, query);
    case "proposal":
      return assetClient.fetchAssetHistoryByProposal(identifier, query);
    case "slug":
      return assetClient.fetchAssetHistoryBySlug(identifier, query);
  }
}

export async function fetchAssetPaymentTokenQuote(
  asset: AssetResponse,
): Promise<PaymentTokenQuoteResponse> {
  const marketCurrency = inferMarketCurrencyFromAsset(asset) ?? undefined;

  return marketClient.fetchPaymentTokenQuote(
    marketCurrency ? { market_currency: marketCurrency } : undefined,
  );
}
