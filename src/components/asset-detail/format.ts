import {
  convertBaseUnitsToDisplayNumber,
  DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
  type AssetResponse,
} from "~/lib";

import type { AssetDetailLookupMode, PriceMode } from "./types";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function formatUnixTimestamp(value: number | null | undefined): string {
  if (!value) {
    return "Not available";
  }

  return formatDateTime(new Date(value * 1000).toISOString());
}

export function formatBooleanValue(value: boolean): string {
  return value ? "Enabled" : "Disabled";
}

export function isAssetAddressIdentifier(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function formatLookupLabel(mode: AssetDetailLookupMode, identifier: string): string {
  switch (mode) {
    case "public":
      return isAssetAddressIdentifier(identifier) ? "Address route" : "Title route";
    case "asset_address":
      return "Address route";
    case "proposal":
      return "Proposal route";
    case "slug":
      return "Slug route";
  }
}

export function readSourceLabel(source: string): string {
  try {
    const url = new URL(source);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return source;
  }
}

export function readSummaryCopy(asset: AssetResponse): string {
  if (asset.summary?.trim()) {
    return asset.summary.trim();
  }

  if (asset.market_segment?.trim()) {
    return `${asset.market_segment.trim()} instrument recorded in the Guardrail asset registry.`;
  }

  return "This asset has been registered on-chain and synced into the public Guardrail catalog.";
}

export function readHeadlineMeta(asset: AssetResponse): string {
  return (
    asset.market_segment ??
    asset.asset_type_name ??
    asset.asset_type_id_text ??
    asset.asset_type_id
  );
}

export function readStatusTone(
  assetStateLabel: string,
): "positive" | "warning" | "neutral" {
  const normalized = assetStateLabel.toLowerCase();

  if (normalized.includes("active") || normalized.includes("live")) {
    return "positive";
  }

  if (normalized.includes("paused") || normalized.includes("halt")) {
    return "warning";
  }

  return "neutral";
}

export function truncateMiddle(value: string, start = 6, end = 4): string {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function formatNumericString(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }

  const normalized = value.trim();

  if (!normalized) {
    return "Not available";
  }

  if (/^-?\d+$/.test(normalized)) {
    const negative = normalized.startsWith("-");
    const digits = negative ? normalized.slice(1) : normalized;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return negative ? `-${grouped}` : grouped;
  }

  const numeric = Number(normalized);

  if (Number.isFinite(numeric)) {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 4,
    }).format(numeric);
  }

  return value;
}

export function formatCompactNumericString(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }

  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(numeric);
  }

  return formatNumericString(value);
}

export function formatDisplayNumber(
  value: number | null | undefined,
  maximumFractionDigits = 6,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not available";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: value > 0 && value < 1 ? Math.min(2, maximumFractionDigits) : 0,
  }).format(value);
}

export function parseNumericString(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

export function readSpreadText(
  asset: AssetResponse,
  mode: PriceMode,
  paymentTokenMeta = DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
): string {
  const subscriptionPrice = convertBaseUnitsToDisplayNumber(
    asset.price_per_token,
    paymentTokenMeta,
  );
  const redemptionPrice = convertBaseUnitsToDisplayNumber(
    asset.redemption_price_per_token,
    paymentTokenMeta,
  );

  if (subscriptionPrice === null || redemptionPrice === null || subscriptionPrice <= 0) {
    return "Current registry pricing";
  }

  const difference = Math.abs(subscriptionPrice - redemptionPrice);

  if (difference === 0) {
    return "No spread between buy and sell";
  }

  const percentage = (difference / subscriptionPrice) * 100;
  const anchorLabel = mode === "buy" ? "vs redemption" : "vs subscription";

  return `${formatDisplayNumber(difference)} ${paymentTokenMeta.symbol} (${percentage.toFixed(2)}%) ${anchorLabel}`;
}

export function readDisplayedRawPrice(asset: AssetResponse, mode: PriceMode): string {
  return mode === "buy" ? asset.price_per_token : asset.redemption_price_per_token;
}

export function readCategoryChips(asset: AssetResponse): string[] {
  const values = [
    asset.market_segment,
    asset.asset_type_id_text,
    ...asset.suggested_internal_tags,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(value => value.trim());

  return Array.from(new Set(values)).slice(0, 4);
}
