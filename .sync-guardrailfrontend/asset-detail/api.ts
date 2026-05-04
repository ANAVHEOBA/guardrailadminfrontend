import {
  assetClient,
  complianceClient,
  inferMarketCurrencyFromAsset,
  oracleClient,
  treasuryClient,
  type AssetDetailResponse,
  type AssetHistoryResponse,
  type AssetPaymentTokenQuoteResponse,
  type AssetResponse,
} from "~/lib";

import { isAssetAddressIdentifier } from "./format";
import type { AssetDetailLookupMode, TimeRange } from "./types";
import { HISTORY_RANGE_MAP } from "./types";

async function fetchBaseAssetDetail(
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

async function hydrateOptionalAssetSections(
  detail: AssetDetailResponse,
): Promise<AssetDetailResponse> {
  const assetAddress = detail.asset.asset_address;
  const [treasury, complianceRules, valuation] = await Promise.all([
    detail.treasury
      ? Promise.resolve(detail.treasury)
      : treasuryClient.fetchTreasuryAsset(assetAddress).catch(() => null),
    detail.compliance_rules
      ? Promise.resolve(detail.compliance_rules)
      : complianceClient.fetchAssetRules(assetAddress).catch(() => null),
    detail.valuation
      ? Promise.resolve(detail.valuation)
      : oracleClient.fetchValuation(assetAddress).catch(() => null),
  ]);

  const availableSections = new Set<string>();

  if (treasury) {
    availableSections.add("treasury");
  }

  if (complianceRules) {
    availableSections.add("compliance_rules");
  }

  if (valuation) {
    availableSections.add("valuation");
  }

  return {
    ...detail,
    treasury: treasury ?? detail.treasury ?? null,
    compliance_rules: complianceRules ?? detail.compliance_rules ?? null,
    valuation: valuation ?? detail.valuation ?? null,
    unavailable_sections: detail.unavailable_sections.filter(
      section => !availableSections.has(section),
    ),
  };
}

export async function fetchAssetDetail(
  mode: AssetDetailLookupMode,
  identifier: string,
): Promise<AssetDetailResponse> {
  const detail = await fetchBaseAssetDetail(mode, identifier);
  return hydrateOptionalAssetSections(detail);
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
): Promise<AssetPaymentTokenQuoteResponse> {
  const marketCurrency = inferMarketCurrencyFromAsset(asset) ?? undefined;

  return assetClient.fetchPaymentTokenQuote(
    marketCurrency ? { market_currency: marketCurrency } : undefined,
  );
}
