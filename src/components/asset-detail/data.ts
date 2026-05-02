import type {
  AssetDetailResponse,
  AssetHistoryResponse,
  AssetResponse,
  PaymentTokenQuoteResponse,
} from "~/lib";

import type { AssetDetailLookupMode, TimeRange } from "./types";
import { fetchAssetDetail, fetchAssetHistory, fetchAssetPaymentTokenQuote } from "./api";

const ASSET_FEED_STORAGE_KEY = "guardrail-asset-feed/v2";
const LEGACY_ASSET_FEED_STORAGE_KEY = "guardrail-asset-feed/v1";

interface AssetFeedState {
  assets: AssetResponse[];
  nextOffset: number;
  hasMore: boolean;
}

interface AssetDetailBundle {
  detail: AssetDetailResponse;
  historyByRange: Partial<Record<TimeRange, AssetHistoryResponse>>;
  paymentTokenQuote: PaymentTokenQuoteResponse | null;
}

const assetBundleCache = new Map<string, AssetDetailBundle>();
const assetBundleRequestCache = new Map<string, Promise<AssetDetailBundle>>();
const assetHistoryRequestCache = new Map<string, Promise<AssetHistoryResponse>>();

function isAssetFeedState(value: unknown): value is AssetFeedState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AssetFeedState>;

  return (
    Array.isArray(candidate.assets) &&
    typeof candidate.nextOffset === "number" &&
    typeof candidate.hasMore === "boolean"
  );
}

function readStoredFeed(): AssetFeedState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(ASSET_FEED_STORAGE_KEY) ??
      window.sessionStorage.getItem(LEGACY_ASSET_FEED_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return isAssetFeedState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function matchesIdentifier(asset: AssetResponse, identifier: string): boolean {
  const normalized = identifier.trim().toLowerCase();

  return (
    asset.asset_address.toLowerCase() === normalized ||
    asset.slug?.toLowerCase() === normalized ||
    asset.proposal_id.toLowerCase() === normalized
  );
}

function findAssetInStoredFeed(identifier: string): AssetResponse | null {
  const feed = readStoredFeed();

  if (!feed) {
    return null;
  }

  return feed.assets.find(asset => matchesIdentifier(asset, identifier)) ?? null;
}

function buildProjectedDetail(asset: AssetResponse): AssetDetailResponse {
  return {
    asset,
    treasury: null,
    compliance_rules: null,
    valuation: null,
    holder: null,
    unavailable_sections: [],
  };
}

function readCacheKeysForAsset(asset: AssetResponse): string[] {
  return [
    asset.asset_address.toLowerCase(),
    asset.slug?.toLowerCase() ?? null,
    asset.proposal_id.toLowerCase(),
  ].filter((value): value is string => Boolean(value));
}

function readCacheKeysForLookup(mode: AssetDetailLookupMode, identifier: string): string[] {
  const normalized = identifier.trim().toLowerCase();

  switch (mode) {
    case "public":
      return [normalized];
    case "asset_address":
      return [normalized];
    case "proposal":
      return [normalized];
    case "slug":
      return [normalized];
  }
}

function readCachedBundle(mode: AssetDetailLookupMode, identifier: string): AssetDetailBundle | null {
  for (const key of readCacheKeysForLookup(mode, identifier)) {
    const cached = assetBundleCache.get(key);

    if (cached) {
      return cached;
    }
  }

  return null;
}

function writeCachedBundle(bundle: AssetDetailBundle) {
  for (const key of readCacheKeysForAsset(bundle.detail.asset)) {
    assetBundleCache.set(key, bundle);
  }
}

function buildBundleRequestKey(
  mode: AssetDetailLookupMode,
  identifier: string,
  range: TimeRange,
): string {
  return `${mode}:${identifier.trim().toLowerCase()}:${range}`;
}

function buildHistoryRequestKey(
  asset: AssetResponse,
  range: TimeRange,
): string {
  return `${asset.asset_address.toLowerCase()}:${range}`;
}

export function readProjectedAssetDetailView(
  mode: AssetDetailLookupMode,
  identifier: string,
): AssetDetailResponse | null {
  const cachedBundle = readCachedBundle(mode, identifier);

  if (cachedBundle) {
    return cachedBundle.detail;
  }

  const feedAsset = findAssetInStoredFeed(identifier);

  return feedAsset ? buildProjectedDetail(feedAsset) : null;
}

export function readCachedAssetHistory(
  mode: AssetDetailLookupMode,
  identifier: string,
  range: TimeRange,
): AssetHistoryResponse | null {
  return readCachedBundle(mode, identifier)?.historyByRange[range] ?? null;
}

export function readCachedPaymentTokenQuote(
  mode: AssetDetailLookupMode,
  identifier: string,
): PaymentTokenQuoteResponse | null {
  return readCachedBundle(mode, identifier)?.paymentTokenQuote ?? null;
}

export async function primeAssetDetailBundle(
  mode: AssetDetailLookupMode,
  identifier: string,
  range: TimeRange,
): Promise<AssetDetailBundle> {
  const cachedBundle = readCachedBundle(mode, identifier);

  if (cachedBundle?.historyByRange[range]) {
    return cachedBundle;
  }

  const requestKey = buildBundleRequestKey(mode, identifier, range);
  const cachedRequest = assetBundleRequestCache.get(requestKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = (async () => {
    const detailPromise = cachedBundle?.detail
      ? Promise.resolve(cachedBundle.detail)
      : fetchAssetDetail(mode, identifier);
    const historyPromise = fetchAssetHistory(mode, identifier, range).catch(() => null);
    const [detail, history] = await Promise.all([detailPromise, historyPromise]);
    const paymentTokenQuote =
      cachedBundle?.paymentTokenQuote ??
      (await fetchAssetPaymentTokenQuote(detail.asset).catch(() => null));
    const nextBundle: AssetDetailBundle = {
      detail,
      historyByRange: {
        ...(cachedBundle?.historyByRange ?? {}),
        ...(history ? { [range]: history } : {}),
      },
      paymentTokenQuote: paymentTokenQuote ?? cachedBundle?.paymentTokenQuote ?? null,
    };

    writeCachedBundle(nextBundle);
    return nextBundle;
  })().finally(() => {
    assetBundleRequestCache.delete(requestKey);
  });

  assetBundleRequestCache.set(requestKey, request);
  return request;
}

export async function loadAssetHistoryRange(
  mode: AssetDetailLookupMode,
  identifier: string,
  range: TimeRange,
): Promise<AssetHistoryResponse> {
  const cachedBundle = readCachedBundle(mode, identifier);
  const cachedHistory = cachedBundle?.historyByRange[range];

  if (cachedHistory) {
    return cachedHistory;
  }

  const detail = cachedBundle?.detail ?? (await fetchAssetDetail(mode, identifier));
  const requestKey = buildHistoryRequestKey(detail.asset, range);
  const cachedRequest = assetHistoryRequestCache.get(requestKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = fetchAssetHistory(mode, identifier, range).then(history => {
    const nextBundle: AssetDetailBundle = {
      detail,
      historyByRange: {
        ...(cachedBundle?.historyByRange ?? {}),
        [range]: history,
      },
      paymentTokenQuote: cachedBundle?.paymentTokenQuote ?? null,
    };

    writeCachedBundle(nextBundle);
    return history;
  }).finally(() => {
    assetHistoryRequestCache.delete(requestKey);
  });

  assetHistoryRequestCache.set(requestKey, request);
  return request;
}

export function primePublicAssetDetailFromAsset(
  asset: Pick<AssetResponse, "asset_address" | "slug">,
  range: TimeRange = "1D",
): Promise<AssetDetailBundle> {
  const identifier = asset.slug ?? asset.asset_address;

  return primeAssetDetailBundle("public", identifier, range);
}
