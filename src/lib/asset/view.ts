import { encodePathSegment } from "../api.ts";
import type { AssetResponse } from "./types.ts";

export interface PaymentTokenDisplayMeta {
  symbol: string;
  decimals: number;
  marketCurrency?: string | null;
  marketCurrencyPerPaymentToken?: string | null;
}

export const DEFAULT_PAYMENT_TOKEN_DISPLAY_META: PaymentTokenDisplayMeta = {
  symbol: "USDC",
  decimals: 6,
  marketCurrency: null,
  marketCurrencyPerPaymentToken: null,
};

const ASSET_TYPE_CURRENCY_MAP: Record<string, string> = {
  AE: "aed",
  AU: "aud",
  BR: "brl",
  CA: "cad",
  CH: "chf",
  CN: "cny",
  EG: "egp",
  EU: "eur",
  GB: "gbp",
  GH: "ghs",
  IN: "inr",
  JP: "jpy",
  KE: "kes",
  MX: "mxn",
  NG: "ngn",
  SA: "sar",
  SG: "sgd",
  UK: "gbp",
  US: "usd",
  ZA: "zar",
};

export function buildAssetAddressPageHref(assetAddress: string): string {
  return `/assets/${encodePathSegment(assetAddress)}`;
}

export function buildAssetSlugPageHref(slug: string): string {
  return `/assets/${encodePathSegment(slug)}`;
}

export function buildAssetProposalPageHref(proposalId: string): string {
  return `/assets/proposals/${encodePathSegment(proposalId)}`;
}

export function buildPreferredAssetPageHref(
  asset: Pick<AssetResponse, "asset_address" | "slug">,
): string {
  if (asset.slug) {
    return buildAssetSlugPageHref(asset.slug);
  }

  return buildAssetAddressPageHref(asset.asset_address);
}

function formatGroupedInteger(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function normalizeIntegerString(value: string | null | undefined): {
  digits: string;
  negative: boolean;
} | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  const negative = normalized.startsWith("-");
  const digits = (negative ? normalized.slice(1) : normalized).replace(/^0+(?=\d)/, "");

  return {
    digits: digits || "0",
    negative,
  };
}

export function inferMarketCurrencyFromAsset(
  asset: Pick<
    AssetResponse,
    "asset_type_id" | "asset_type_id_text" | "asset_type_name" | "market_segment" | "suggested_internal_tags"
  >,
): string | null {
  const explicitPrefix = [asset.asset_type_id_text, asset.asset_type_id]
    .map(value => value?.trim())
    .filter(Boolean)
    .map(value => value!.match(/\b([A-Z]{2})(?=[_-])/))
    .find(Boolean)?.[1];

  if (explicitPrefix && ASSET_TYPE_CURRENCY_MAP[explicitPrefix]) {
    return ASSET_TYPE_CURRENCY_MAP[explicitPrefix];
  }

  const descriptor = [
    asset.asset_type_name,
    asset.asset_type_id_text,
    asset.asset_type_id,
    asset.market_segment,
    ...asset.suggested_internal_tags,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase();

  if (descriptor.includes("nigeria") || descriptor.includes(" ngn ")) {
    return "ngn";
  }

  if (descriptor.includes("u.s.") || descriptor.includes("united states") || descriptor.includes(" usd ")) {
    return "usd";
  }

  if (descriptor.includes("euro") || descriptor.includes(" eur ")) {
    return "eur";
  }

  if (
    descriptor.includes("british") ||
    descriptor.includes("united kingdom") ||
    descriptor.includes(" gbp ")
  ) {
    return "gbp";
  }

  return null;
}

export function formatBaseUnitsLabel(value: string | null | undefined): string {
  const normalized = normalizeIntegerString(value);

  if (!normalized) {
    return "Not available";
  }

  return `${normalized.negative ? "-" : ""}${formatGroupedInteger(normalized.digits)} base units`;
}

export function formatPaymentTokenAmountFromBaseUnits(
  value: string | null | undefined,
  meta: PaymentTokenDisplayMeta | null | undefined = DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
): string {
  const normalized = normalizeIntegerString(value);

  if (!normalized) {
    return "Not available";
  }

  const decimals = Math.max(0, meta?.decimals ?? DEFAULT_PAYMENT_TOKEN_DISPLAY_META.decimals);
  const symbol = meta?.symbol?.trim() || DEFAULT_PAYMENT_TOKEN_DISPLAY_META.symbol;

  if (decimals === 0) {
    return `${normalized.negative ? "-" : ""}${formatGroupedInteger(normalized.digits)} ${symbol}`;
  }

  const padded = normalized.digits.padStart(decimals + 1, "0");
  const wholeDigits = padded.slice(0, -decimals) || "0";
  const fractionDigits = padded.slice(-decimals).replace(/0+$/, "");
  const whole = formatGroupedInteger(wholeDigits);
  const amount = fractionDigits ? `${whole}.${fractionDigits}` : whole;

  return `${normalized.negative ? "-" : ""}${amount} ${symbol}`;
}

export function convertBaseUnitsToDisplayNumber(
  value: string | null | undefined,
  meta: PaymentTokenDisplayMeta | null | undefined = DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
): number | null {
  const normalized = normalizeIntegerString(value);

  if (!normalized) {
    return null;
  }

  const decimals = Math.max(0, meta?.decimals ?? DEFAULT_PAYMENT_TOKEN_DISPLAY_META.decimals);
  const padded = normalized.digits.padStart(decimals + 1, "0");
  const wholeDigits = padded.slice(0, -decimals) || "0";
  const fractionDigits = padded.slice(-decimals);
  const amount = Number(`${normalized.negative ? "-" : ""}${wholeDigits}.${fractionDigits}`);

  return Number.isFinite(amount) ? amount : null;
}

export function formatMarketReferenceAmountFromBaseUnits(
  value: string | null | undefined,
  meta: PaymentTokenDisplayMeta | null | undefined,
): string | null {
  const settlementAmount = convertBaseUnitsToDisplayNumber(value, meta);
  const rate = Number(meta?.marketCurrencyPerPaymentToken ?? "");
  const marketCurrency = meta?.marketCurrency?.trim().toUpperCase();

  if (
    settlementAmount === null ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    !marketCurrency
  ) {
    return null;
  }

  const marketAmount = settlementAmount * rate;

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: marketCurrency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(marketAmount);
}
