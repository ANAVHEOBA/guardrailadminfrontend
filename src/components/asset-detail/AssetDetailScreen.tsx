import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, type Accessor } from "solid-js";

import AdminConsole from "~/components/AdminConsole";
import {
  assetClient,
  buildAssetAddressPageHref,
  buildAssetProposalPageHref,
  buildAssetSlugPageHref,
  type AssetHistoryCandleResponse,
  type AssetDetailResponse,
  type AssetHistoryResponse,
  type AssetResponse,
} from "~/lib";
import { getErrorMessage } from "~/lib/api";

type AssetDetailLookupMode = "asset_address" | "proposal" | "slug";
type DetailLoadStatus = "loading" | "ready" | "error";
type HistoryLoadStatus = "idle" | "loading" | "ready" | "error";
type PriceMode = "buy" | "sell";
type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

interface AssetDetailScreenProps {
  mode: AssetDetailLookupMode;
  identifier: Accessor<string>;
}

const TIME_RANGES: readonly TimeRange[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;
const HISTORY_RANGE_MAP: Record<TimeRange, string> = {
  "1D": "1day",
  "1W": "1week",
  "1M": "1month",
  "3M": "3months",
  "1Y": "1year",
  ALL: "all",
};

const RANGE_LABEL_MAP: Record<TimeRange, string> = {
  "1D": "24H",
  "1W": "1W",
  "1M": "1M",
  "3M": "3M",
  "1Y": "1Y",
  ALL: "ALL",
};

function formatDateTime(value: string | null | undefined): string {
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

function formatUnixTimestamp(value: number | null | undefined): string {
  if (!value) {
    return "Not available";
  }

  return formatDateTime(new Date(value * 1000).toISOString());
}

function formatBooleanValue(value: boolean): string {
  return value ? "Enabled" : "Disabled";
}

function formatLookupLabel(mode: AssetDetailLookupMode): string {
  switch (mode) {
    case "asset_address":
      return "Address route";
    case "proposal":
      return "Proposal route";
    case "slug":
      return "Slug route";
  }
}

function readSourceLabel(source: string): string {
  try {
    const url = new URL(source);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return source;
  }
}

function readSummaryCopy(asset: AssetResponse): string {
  if (asset.summary?.trim()) {
    return asset.summary.trim();
  }

  if (asset.market_segment?.trim()) {
    return `${asset.market_segment.trim()} instrument recorded in the Guardrail asset registry.`;
  }

  return "This asset has been registered on-chain and synced into the public Guardrail catalog.";
}

function readHeadlineMeta(asset: AssetResponse): string {
  return asset.market_segment ?? asset.asset_type_name ?? asset.asset_type_id_text ?? asset.asset_type_id;
}

function readStatusTone(assetStateLabel: string): "positive" | "warning" | "neutral" {
  const normalized = assetStateLabel.toLowerCase();

  if (normalized.includes("active") || normalized.includes("live")) {
    return "positive";
  }

  if (normalized.includes("paused") || normalized.includes("halt")) {
    return "warning";
  }

  return "neutral";
}

function truncateMiddle(value: string, start = 6, end = 4): string {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatNumericString(value: string | null | undefined): string {
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

function formatCompactNumericString(value: string | null | undefined): string {
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

function parseNumericString(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function readSpreadText(asset: AssetResponse, mode: PriceMode): string {
  const subscriptionPrice = parseNumericString(asset.price_per_token);
  const redemptionPrice = parseNumericString(asset.redemption_price_per_token);

  if (subscriptionPrice === null || redemptionPrice === null || subscriptionPrice <= 0) {
    return "Current registry pricing";
  }

  const difference = Math.abs(subscriptionPrice - redemptionPrice);

  if (difference === 0) {
    return "No spread between buy and sell";
  }

  const percentage = (difference / subscriptionPrice) * 100;
  const anchorLabel = mode === "buy" ? "vs redemption" : "vs subscription";

  return `${formatNumericString(String(difference))} (${percentage.toFixed(2)}%) ${anchorLabel}`;
}

function readDisplayedRawPrice(asset: AssetResponse, mode: PriceMode): string {
  return mode === "buy" ? asset.price_per_token : asset.redemption_price_per_token;
}

function readCategoryChips(asset: AssetResponse): string[] {
  const values = [
    asset.market_segment,
    asset.asset_type_id_text,
    ...asset.suggested_internal_tags,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(value => value.trim());

  return Array.from(new Set(values)).slice(0, 4);
}

function readHistorySeries(
  history: AssetHistoryResponse | null,
  mode: PriceMode,
): AssetHistoryCandleResponse[] {
  if (!history) {
    return [];
  }

  if (mode === "buy") {
    return history.primary_market_price;
  }

  return history.underlying_market_price.length > 0
    ? history.underlying_market_price
    : history.primary_market_price;
}

function normalizeHistorySeries(
  candles: AssetHistoryCandleResponse[],
  displayedRawPrice: string,
): number[] {
  const values = candles
    .map(candle => parseNumericString(candle.value) ?? parseNumericString(candle.close))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return [];
  }

  const targetValue = parseNumericString(displayedRawPrice);
  const anchorValue = values.at(-1) ?? null;

  if (targetValue === null || anchorValue === null || anchorValue <= 0) {
    return values;
  }

  const scale = targetValue / anchorValue;
  return values.map(value => value * scale);
}

function buildHistoryChangeSummary(series: number[], range: TimeRange) {
  if (series.length < 2) {
    return null;
  }

  const firstValue = series[0];
  const lastValue = series[series.length - 1];
  const change = lastValue - firstValue;
  const percent = firstValue !== 0 ? (change / firstValue) * 100 : 0;
  const sign = change > 0 ? "+" : change < 0 ? "-" : "";

  return {
    amount: `${sign}${formatNumericString(String(Math.abs(change)))}`,
    percent: `${sign}${Math.abs(percent).toFixed(2)}%`,
    tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral",
    label: RANGE_LABEL_MAP[range],
  };
}

function hashSeed(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createIllustrativeSeries(
  asset: AssetResponse,
  range: TimeRange,
  mode: PriceMode,
): number[] {
  const pointCountByRange: Record<TimeRange, number> = {
    "1D": 24,
    "1W": 28,
    "1M": 34,
    "3M": 40,
    "1Y": 48,
    ALL: 56,
  };
  const volatilityByRange: Record<TimeRange, number> = {
    "1D": 0.03,
    "1W": 0.04,
    "1M": 0.06,
    "3M": 0.08,
    "1Y": 0.1,
    ALL: 0.12,
  };
  const displayedPrice =
    parseNumericString(mode === "buy" ? asset.price_per_token : asset.redemption_price_per_token) ??
    100;
  const anchorPrice =
    parseNumericString(mode === "buy" ? asset.redemption_price_per_token : asset.price_per_token) ??
    displayedPrice;
  const pointCount = pointCountByRange[range];
  const volatility = volatilityByRange[range];
  let seed = hashSeed(`${asset.asset_address}:${range}:${mode}`);
  let drift = 0;

  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const points = Array.from({ length: pointCount }, (_, index) => {
    const progress = index / Math.max(pointCount - 1, 1);
    const wave = Math.sin(progress * Math.PI * 3.2) * 0.6 + Math.cos(progress * Math.PI * 1.3) * 0.4;
    const noise = (random() - 0.5) * volatility * 0.9;
    drift = (drift + noise) * 0.86;
    const anchor = anchorPrice + (displayedPrice - anchorPrice) * progress;
    const value = anchor * (1 + wave * volatility * 0.26 + drift);

    return Math.max(displayedPrice * 0.78, value);
  });

  points[pointCount - 1] = displayedPrice;
  return points;
}

function buildChartMetrics(series: number[]) {
  const safeSeries = series.length > 0 ? series : [0, 0];
  const width = 760;
  const height = 280;
  const insetX = 14;
  const insetY = 18;
  const minimum = Math.min(...safeSeries);
  const maximum = Math.max(...safeSeries);
  const span = Math.max(maximum - minimum, Math.max(minimum * 0.02, 1));

  const points = safeSeries.map((value, index) => {
    const x = insetX + (index / Math.max(safeSeries.length - 1, 1)) * (width - insetX * 2);
    const y =
      height -
      insetY -
      ((value - minimum) / span) * (height - insetY * 2);

    return { x, y };
  });

  const line = points.map(point => `${point.x},${point.y}`).join(" ");
  const area = [
    `${points[0]?.x ?? 0},${height - insetY}`,
    ...points.map(point => `${point.x},${point.y}`),
    `${points[points.length - 1]?.x ?? 0},${height - insetY}`,
  ].join(" ");

  return {
    width,
    height,
    line,
    area,
    minimum,
    maximum,
  };
}

function SummaryCard(props: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <article class="pm-asset-market__summary-card">
      <p class="pm-asset-market__summary-label">{props.label}</p>
      <h3 class="pm-asset-market__summary-value">{props.value}</h3>
      <p class="pm-asset-market__summary-meta">{props.meta}</p>
    </article>
  );
}

function StatPanel(props: {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: string; mono?: boolean }>;
}) {
  return (
    <section class="pm-detail__card pm-asset-market__stat-panel">
      <h2 class="pm-detail__card-title">{props.title}</h2>
      <Show when={props.subtitle}>
        <p class="pm-detail__card-copy pm-asset-market__panel-copy">{props.subtitle}</p>
      </Show>
      <div class="pm-asset-market__stat-rows">
        <For each={props.rows}>
          {row => (
            <div class="pm-asset-market__stat-row">
              <span class="pm-asset-market__stat-label">{row.label}</span>
              <span class={`pm-asset-market__stat-value${row.mono ? " pm-asset-market__stat-value--mono" : ""}`}>
                {row.value}
              </span>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <section class="pm-asset-market">
      <section class="pm-asset-market__hero-card">
        <div class="pm-asset-market__hero-top">
          <div class="pm-asset-market__identity">
            <div class="pm-asset-market__avatar pm-compact-card__placeholder" />
            <div class="pm-asset-market__identity-copy">
              <div class="pm-compact-card__line pm-asset-detail__line--medium" />
              <div class="pm-compact-card__line pm-asset-detail__line--small" />
            </div>
          </div>
        </div>

        <div class="pm-asset-market__hero-grid">
          <div class="pm-asset-market__price-surface">
            <div class="pm-asset-market__price-header">
              <div class="pm-asset-market__price-head">
                <div class="pm-compact-card__line pm-compact-card__line--title" />
                <div class="pm-compact-card__line pm-asset-detail__line--medium" />
              </div>
              <div class="pm-asset-market__price-actions">
                <div class="pm-asset-market__toggle">
                  <div class="pm-compact-card__line pm-asset-detail__line--small" />
                </div>
              </div>
            </div>
            <div class="pm-asset-market__chart-frame pm-compact-card__placeholder" />
          </div>

          <aside class="pm-asset-market__about-panel">
            <div class="pm-compact-card__line pm-asset-detail__line--small" />
            <div class="pm-compact-card__line pm-asset-detail__line--long" />
            <div class="pm-compact-card__line pm-asset-detail__line--medium" />
            <div class="pm-compact-card__line pm-asset-detail__line--long" />
          </aside>
        </div>
      </section>

      <div class="pm-asset-market__summary-grid">
        <For each={Array.from({ length: 4 })}>
          {() => (
            <article class="pm-asset-market__summary-card">
              <div class="pm-compact-card__line pm-asset-detail__line--small" />
              <div class="pm-compact-card__line pm-asset-detail__line--medium" />
              <div class="pm-compact-card__line pm-asset-detail__line--long" />
            </article>
          )}
        </For>
      </div>
    </section>
  );
}

async function fetchAssetDetail(
  mode: AssetDetailLookupMode,
  identifier: string,
): Promise<AssetDetailResponse> {
  switch (mode) {
    case "asset_address":
      return assetClient.fetchAssetDetail(identifier);
    case "proposal":
      return assetClient.fetchAssetDetailByProposal(identifier);
    case "slug":
      return assetClient.fetchAssetDetailBySlug(identifier);
  }
}

async function fetchAssetHistory(
  mode: AssetDetailLookupMode,
  identifier: string,
  range: TimeRange,
): Promise<AssetHistoryResponse> {
  const query = {
    range: HISTORY_RANGE_MAP[range],
  };

  switch (mode) {
    case "asset_address":
      return assetClient.fetchAssetHistory(identifier, query);
    case "proposal":
      return assetClient.fetchAssetHistoryByProposal(identifier, query);
    case "slug":
      return assetClient.fetchAssetHistoryBySlug(identifier, query);
  }
}

export default function AssetDetailScreen(props: AssetDetailScreenProps) {
  const [status, setStatus] = createSignal<DetailLoadStatus>("loading");
  const [error, setError] = createSignal<string | null>(null);
  const [detail, setDetail] = createSignal<AssetDetailResponse | null>(null);
  const [historyStatus, setHistoryStatus] = createSignal<HistoryLoadStatus>("idle");
  const [historyError, setHistoryError] = createSignal<string | null>(null);
  const [history, setHistory] = createSignal<AssetHistoryResponse | null>(null);
  const [priceMode, setPriceMode] = createSignal<PriceMode>("buy");
  const [timeRange, setTimeRange] = createSignal<TimeRange>("1D");
  const [showFullSummary, setShowFullSummary] = createSignal(false);
  const [copiedField, setCopiedField] = createSignal<string | null>(null);
  let requestVersion = 0;
  let historyRequestVersion = 0;
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  const asset = createMemo(() => detail()?.asset ?? null);
  const title = createMemo(() => {
    const currentAsset = asset();

    if (currentAsset) {
      return `${currentAsset.name} · Guardrail Admin`;
    }

    return "Asset detail · Guardrail Admin";
  });
  const summary = createMemo(() => {
    const currentAsset = asset();
    return currentAsset ? readSummaryCopy(currentAsset) : "";
  });
  const isSummaryLong = createMemo(() => summary().length > 220);
  const summaryPreview = createMemo(() => {
    if (showFullSummary() || !isSummaryLong()) {
      return summary();
    }

    return `${summary().slice(0, 220).trimEnd()}...`;
  });
  const displayPrice = createMemo(() => {
    const currentAsset = asset();

    if (!currentAsset) {
      return "Not available";
    }

    return formatNumericString(readDisplayedRawPrice(currentAsset, priceMode()));
  });
  const historyCandles = createMemo(() => readHistorySeries(history(), priceMode()));
  const chartSeries = createMemo(() => {
    const currentAsset = asset();

    if (!currentAsset) {
      return [];
    }

    const normalizedHistory = normalizeHistorySeries(
      historyCandles(),
      readDisplayedRawPrice(currentAsset, priceMode()),
    );

    if (normalizedHistory.length > 0) {
      return normalizedHistory;
    }

    return createIllustrativeSeries(currentAsset, timeRange(), priceMode());
  });
  const normalizedHistorySeries = createMemo(() => {
    const currentAsset = asset();

    if (!currentAsset) {
      return [];
    }

    return normalizeHistorySeries(
      historyCandles(),
      readDisplayedRawPrice(currentAsset, priceMode()),
    );
  });
  const chart = createMemo(() => buildChartMetrics(chartSeries()));
  const chartHasHistory = createMemo(() => normalizedHistorySeries().length > 0);
  const chartChange = createMemo(() => buildHistoryChangeSummary(normalizedHistorySeries(), timeRange()));
  const historyLabel = createMemo(() => {
    if (priceMode() === "buy") {
      return "Primary market history";
    }

    if ((history()?.underlying_market_price.length ?? 0) > 0) {
      return "Underlying market history";
    }

    return "Primary market history";
  });
  const categoryChips = createMemo(() => {
    const currentAsset = asset();
    return currentAsset ? readCategoryChips(currentAsset) : [];
  });

  const loadDetail = async (identifier: string) => {
    const version = ++requestVersion;

    setStatus("loading");
    setError(null);
    setDetail(null);
    setShowFullSummary(false);
    setPriceMode("buy");
    setTimeRange("1D");
    setHistory(null);
    setHistoryStatus("idle");
    setHistoryError(null);

    try {
      const response = await fetchAssetDetail(props.mode, identifier);

      if (version !== requestVersion) {
        return;
      }

      setDetail(response);
      setStatus("ready");
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (caughtError) {
      if (version !== requestVersion) {
        return;
      }

      setError(getErrorMessage(caughtError));
      setStatus("error");
    }
  };

  const loadHistory = async (identifier: string, range: TimeRange) => {
    const version = ++historyRequestVersion;

    setHistoryStatus("loading");
    setHistoryError(null);

    try {
      const response = await fetchAssetHistory(props.mode, identifier, range);

      if (version !== historyRequestVersion) {
        return;
      }

      setHistory(response);
      setHistoryStatus("ready");
    } catch (caughtError) {
      if (version !== historyRequestVersion) {
        return;
      }

      setHistory(null);
      setHistoryError(getErrorMessage(caughtError));
      setHistoryStatus("error");
    }
  };

  const copyValue = async (field: string, value: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);

      if (copyResetTimer) {
        clearTimeout(copyResetTimer);
      }

      copyResetTimer = setTimeout(() => {
        setCopiedField(current => (current === field ? null : current));
      }, 1600);
    } catch {
      // Ignore clipboard failures and keep the UI stable.
    }
  };

  createEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const identifier = props.identifier().trim();

    if (!identifier) {
      setError("Asset identifier is missing.");
      setDetail(null);
      setStatus("error");
      return;
    }

    void loadDetail(identifier);
  });

  createEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const identifier = props.identifier().trim();
    const range = timeRange();

    if (!identifier) {
      return;
    }

    void loadHistory(identifier, range);
  });

  return (
    <div class="pm-page">
      <Title>{title()}</Title>
      <AdminConsole />

      <main class="pm-admin-home__main">
        <section class="pm-asset-detail-page">
          <div class="pm-browser__hero pm-asset-detail-page__hero">
            <div class="pm-asset-detail-page__hero-copy">
              <A class="pm-asset-detail__back-link" href="/">
                All assets
              </A>
              <p class="pm-asset-detail__eyebrow">Public asset detail</p>
            </div>
            <div class="pm-browser__button-row">
              <A class="pm-button pm-button--ghost" href="/">
                Back to catalog
              </A>
            </div>
          </div>

          <Show when={status() !== "loading"} fallback={<LoadingState />}>
            <Show
              when={!error()}
              fallback={
                <div class="pm-home__state pm-asset-detail__state-card">
                  <p class="pm-home__state-title">Unable to load asset detail</p>
                  <p class="pm-home__state-copy">{error()}</p>
                  <div class="pm-browser__button-row">
                    <button
                      class="pm-button pm-button--primary"
                      type="button"
                      onClick={() => void loadDetail(props.identifier().trim())}
                    >
                      Retry
                    </button>
                    <A class="pm-button pm-button--ghost" href="/">
                      Back to assets
                    </A>
                  </div>
                </div>
              }
            >
              <Show when={asset()}>
                {currentAsset => {
                  const registryAsset = currentAsset();
                  const assetDetail = detail();
                  const statusTone = readStatusTone(registryAsset.asset_state_label);
                  const displayedRoutes = [
                    {
                      label: "Address route",
                      value: registryAsset.asset_address,
                      href: buildAssetAddressPageHref(registryAsset.asset_address),
                    },
                    {
                      label: "Proposal route",
                      value: registryAsset.proposal_id,
                      href: buildAssetProposalPageHref(registryAsset.proposal_id),
                    },
                    ...(registryAsset.slug
                      ? [
                          {
                            label: "Slug route",
                            value: registryAsset.slug,
                            href: buildAssetSlugPageHref(registryAsset.slug),
                          },
                        ]
                      : []),
                  ];

                  return (
                    <section class="pm-asset-market">
                      <section class="pm-asset-market__hero-card">
                        <div class="pm-asset-market__hero-top">
                          <div class="pm-asset-market__identity">
                            <div class="pm-asset-market__avatar">
                              <Show
                                when={registryAsset.image_url}
                                fallback={
                                  <span class="pm-asset-market__avatar-fallback">
                                    {registryAsset.symbol.charAt(0).toUpperCase() || "A"}
                                  </span>
                                }
                              >
                                <img
                                  src={registryAsset.image_url ?? ""}
                                  alt={`${registryAsset.name} icon`}
                                  loading="eager"
                                  decoding="async"
                                />
                              </Show>
                            </div>

                            <div class="pm-asset-market__identity-copy">
                              <h1 class="pm-asset-market__title">{registryAsset.name}</h1>
                              <p class="pm-asset-market__symbol">{registryAsset.symbol}</p>
                            </div>
                          </div>

                          <div class="pm-asset-market__status-block">
                            <div class={`pm-asset-market__status pm-asset-market__status--${statusTone}`}>
                              <span class="pm-asset-market__status-dot" />
                              <span>{registryAsset.asset_state_label}</span>
                            </div>
                            <Show when={registryAsset.sources[0]}>
                              <a
                                class="pm-asset-market__status-link"
                                href={registryAsset.sources[0]}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View source
                              </a>
                            </Show>
                          </div>
                        </div>

                        <div class="pm-asset-market__hero-grid">
                          <section class={`pm-asset-market__price-surface pm-asset-market__price-surface--${priceMode()}`}>
                            <div class="pm-asset-market__price-header">
                              <div class="pm-asset-market__price-head">
                                <p class="pm-asset-market__kicker">
                                  {priceMode() === "buy" ? "Subscription price" : "Redemption price"}
                                </p>
                                <h2 class="pm-asset-market__price">{displayPrice()}</h2>
                                <div class="pm-asset-market__delta">
                                  <Show
                                    when={chartChange()}
                                    fallback={
                                      <>
                                        <span class="pm-asset-market__delta-chip">Base units</span>
                                        <span>{readSpreadText(registryAsset, priceMode())}</span>
                                      </>
                                    }
                                  >
                                    {change => (
                                      <>
                                        <span
                                          class={`pm-asset-market__delta-badge pm-asset-market__delta-badge--${change().tone}`}
                                        >
                                          {change().amount}
                                        </span>
                                        <span>{change().percent} {change().label}</span>
                                      </>
                                    )}
                                  </Show>
                                </div>
                              </div>

                              <div class="pm-asset-market__price-actions">
                                <div class="pm-asset-market__toggle">
                                  <button
                                    class={`pm-asset-market__toggle-button${
                                      priceMode() === "buy" ? " pm-asset-market__toggle-button--active" : ""
                                    }`}
                                    type="button"
                                    onClick={() => setPriceMode("buy")}
                                  >
                                    Buy
                                  </button>
                                  <button
                                    class={`pm-asset-market__toggle-button${
                                      priceMode() === "sell" ? " pm-asset-market__toggle-button--active" : ""
                                    }`}
                                    type="button"
                                    onClick={() => setPriceMode("sell")}
                                  >
                                    Sell
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div class="pm-asset-market__range-row">
                              <For each={TIME_RANGES}>
                                {range => (
                                  <button
                                    class={`pm-asset-market__range-chip${
                                      timeRange() === range ? " pm-asset-market__range-chip--active" : ""
                                    }`}
                                    type="button"
                                    onClick={() => setTimeRange(range)}
                                  >
                                    {range}
                                  </button>
                                )}
                              </For>
                            </div>

                            <div class={`pm-asset-market__chart-frame pm-asset-market__chart-frame--${priceMode()}`}>
                              <svg
                                class="pm-asset-market__chart"
                                viewBox={`0 0 ${chart().width} ${chart().height}`}
                                preserveAspectRatio="none"
                                aria-hidden="true"
                              >
                                <For each={Array.from({ length: 4 })}>
                                  {(_, index) => {
                                    const y = 24 + (index() / 3) * (chart().height - 48);

                                    return (
                                      <line
                                        x1="12"
                                        y1={y}
                                        x2={chart().width - 12}
                                        y2={y}
                                        class="pm-asset-market__grid-line"
                                      />
                                    );
                                  }}
                                </For>
                                <polygon
                                  points={chart().area}
                                  class={`pm-asset-market__chart-area pm-asset-market__chart-area--${priceMode()}`}
                                />
                                <polyline
                                  points={chart().line}
                                  class={`pm-asset-market__chart-line pm-asset-market__chart-line--${priceMode()}`}
                                />
                              </svg>
                              <div class="pm-asset-market__chart-scale">
                                <span>{formatCompactNumericString(String(chart().maximum))}</span>
                                <span>{formatCompactNumericString(String(chart().minimum))}</span>
                              </div>
                            </div>

                            <p class="pm-asset-market__chart-note">
                              <Show
                                when={chartHasHistory()}
                                fallback={
                                  <span>
                                    Illustrative pricing curve based on current registry values. Historical
                                    market data is not connected yet.
                                  </span>
                                }
                              >
                                <span>
                                  {historyLabel()} · {history()?.interval ?? "unknown interval"} · updated{" "}
                                  {formatUnixTimestamp(history()?.last_updated_at)}
                                </span>
                              </Show>
                              <Show when={historyStatus() === "loading"}>
                                <span> Refreshing history…</span>
                              </Show>
                              <Show when={historyStatus() === "error" && historyError()}>
                                <span> History unavailable: {historyError()}</span>
                              </Show>
                            </p>
                          </section>

                          <aside class="pm-asset-market__about-panel">
                            <div class="pm-asset-market__about-head">
                              <p class="pm-asset-market__panel-kicker">About</p>
                              <p class="pm-asset-market__panel-subcopy">{readHeadlineMeta(registryAsset)}</p>
                            </div>

                            <p class="pm-asset-market__about-copy">
                              {summaryPreview()}
                              <Show when={isSummaryLong()}>
                                <button
                                  class="pm-asset-market__text-button"
                                  type="button"
                                  onClick={() => setShowFullSummary(open => !open)}
                                >
                                  {showFullSummary() ? "Show less" : "Show more"}
                                </button>
                              </Show>
                            </p>

                            <div class="pm-asset-market__fact-stack">
                              <div class="pm-asset-market__fact">
                                <span class="pm-asset-market__fact-label">Category</span>
                                <div class="pm-asset-market__chip-row">
                                  <For each={categoryChips()}>
                                    {chip => <span class="pm-asset-market__chip">{chip}</span>}
                                  </For>
                                </div>
                              </div>

                              <div class="pm-asset-market__fact">
                                <span class="pm-asset-market__fact-label">Onchain address</span>
                                <div class="pm-asset-market__address-row">
                                  <span class="pm-asset-market__address-value">
                                    {truncateMiddle(registryAsset.asset_address)}
                                  </span>
                                  <button
                                    class="pm-asset-market__copy-button"
                                    type="button"
                                    onClick={() => void copyValue("asset_address", registryAsset.asset_address)}
                                  >
                                    {copiedField() === "asset_address" ? "Copied" : "Copy"}
                                  </button>
                                </div>
                              </div>

                              <div class="pm-asset-market__fact-grid">
                                <div class="pm-asset-market__fact">
                                  <span class="pm-asset-market__fact-label">Proposal ID</span>
                                  <span class="pm-asset-market__fact-value">{registryAsset.proposal_id}</span>
                                </div>
                                <div class="pm-asset-market__fact">
                                  <span class="pm-asset-market__fact-label">Asset type</span>
                                  <span class="pm-asset-market__fact-value">
                                    {registryAsset.asset_type_name ??
                                      registryAsset.asset_type_id_text ??
                                      registryAsset.asset_type_id}
                                  </span>
                                </div>
                                <div class="pm-asset-market__fact">
                                  <span class="pm-asset-market__fact-label">Payment token</span>
                                  <span class="pm-asset-market__fact-value">
                                    {truncateMiddle(registryAsset.payment_token_address)}
                                  </span>
                                </div>
                                <div class="pm-asset-market__fact">
                                  <span class="pm-asset-market__fact-label">Lookup used</span>
                                  <span class="pm-asset-market__fact-value">
                                    {formatLookupLabel(props.mode)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </aside>
                        </div>
                      </section>

                      <div class="pm-asset-market__summary-grid">
                        <SummaryCard
                          label="Total supply"
                          value={formatNumericString(registryAsset.total_supply)}
                          meta={`Max supply ${formatNumericString(registryAsset.max_supply)}`}
                        />
                        <SummaryCard
                          label="Investor footprint"
                          value={formatNumericString(registryAsset.holder_count)}
                          meta={`${formatNumericString(registryAsset.total_pending_redemptions)} pending redemptions`}
                        />
                        <SummaryCard
                          label="Treasury liquidity"
                          value={formatNumericString(assetDetail?.treasury?.available_liquidity ?? "0")}
                          meta={`Balance ${formatNumericString(assetDetail?.treasury?.balance ?? "0")}`}
                        />
                        <SummaryCard
                          label="Valuation NAV"
                          value={formatNumericString(assetDetail?.valuation?.nav_per_token ?? "0")}
                          meta={`Updated ${formatDateTime(assetDetail?.valuation?.updated_at ?? registryAsset.updated_at)}`}
                        />
                      </div>

                      <section class="pm-asset-market__section">
                        <div class="pm-asset-market__section-head">
                          <div>
                            <p class="pm-asset-market__section-kicker">Core metrics</p>
                            <h2 class="pm-asset-market__section-title">Statistics</h2>
                          </div>
                        </div>

                        <div class="pm-asset-market__stats-grid">
                          <StatPanel
                            title="Pricing"
                            subtitle="Current registry pricing per token."
                            rows={[
                              {
                                label: "Subscription",
                                value: formatNumericString(registryAsset.price_per_token),
                              },
                              {
                                label: "Redemption",
                                value: formatNumericString(registryAsset.redemption_price_per_token),
                              },
                              {
                                label: "Spread",
                                value: readSpreadText(registryAsset, "buy"),
                              },
                            ]}
                          />
                          <StatPanel
                            title="Supply"
                            subtitle="Token circulation and holder activity."
                            rows={[
                              {
                                label: "Total supply",
                                value: formatNumericString(registryAsset.total_supply),
                              },
                              {
                                label: "Max supply",
                                value: formatNumericString(registryAsset.max_supply),
                              },
                              {
                                label: "Holders",
                                value: formatNumericString(registryAsset.holder_count),
                              },
                              {
                                label: "Pending redemptions",
                                value: formatNumericString(registryAsset.total_pending_redemptions),
                              },
                            ]}
                          />
                          <StatPanel
                            title="Treasury"
                            subtitle="Treasury-backed balances for this asset."
                            rows={[
                              {
                                label: "Balance",
                                value: formatNumericString(assetDetail?.treasury?.balance ?? "0"),
                              },
                              {
                                label: "Reserved yield",
                                value: formatNumericString(assetDetail?.treasury?.reserved_yield ?? "0"),
                              },
                              {
                                label: "Available liquidity",
                                value: formatNumericString(
                                  assetDetail?.treasury?.available_liquidity ?? "0",
                                ),
                              },
                              {
                                label: "Updated",
                                value: formatDateTime(
                                  assetDetail?.treasury?.updated_at ?? registryAsset.updated_at,
                                ),
                              },
                            ]}
                          />
                          <StatPanel
                            title="Valuation"
                            subtitle="Latest valuation snapshot when available."
                            rows={[
                              {
                                label: "Asset value",
                                value: formatNumericString(assetDetail?.valuation?.asset_value ?? "0"),
                              },
                              {
                                label: "NAV per token",
                                value: formatNumericString(assetDetail?.valuation?.nav_per_token ?? "0"),
                              },
                              {
                                label: "On-chain updated",
                                value: formatUnixTimestamp(assetDetail?.valuation?.onchain_updated_at),
                              },
                              {
                                label: "Reference ID",
                                value: truncateMiddle(
                                  assetDetail?.valuation?.reference_id ??
                                    "0x0000000000000000000000000000000000000000000000000000000000000000",
                                ),
                                mono: true,
                              },
                            ]}
                          />
                        </div>
                      </section>

                      <div class="pm-asset-market__lower-grid">
                        <section class="pm-detail__card pm-asset-market__panel">
                          <p class="pm-asset-market__panel-kicker">Registry access</p>
                          <h2 class="pm-detail__card-title">Routes and references</h2>
                          <div class="pm-asset-market__route-table">
                            <For each={displayedRoutes}>
                              {route => (
                                <div class="pm-asset-market__route-row">
                                  <div class="pm-asset-market__route-copy">
                                    <span class="pm-asset-market__route-label">{route.label}</span>
                                    <span class="pm-asset-market__route-value">{route.value}</span>
                                  </div>
                                  <div class="pm-browser__button-row">
                                    <A class="pm-button pm-button--ghost" href={route.href}>
                                      Open
                                    </A>
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>

                          <div class="pm-asset-market__reference-grid">
                            <div class="pm-asset-market__fact">
                              <span class="pm-asset-market__fact-label">Metadata hash</span>
                              <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                                {truncateMiddle(registryAsset.metadata_hash)}
                              </span>
                            </div>
                            <div class="pm-asset-market__fact">
                              <span class="pm-asset-market__fact-label">Last transaction</span>
                              <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                                {registryAsset.last_tx_hash
                                  ? truncateMiddle(registryAsset.last_tx_hash)
                                  : "Not available"}
                              </span>
                            </div>
                          </div>
                        </section>

                        <section class="pm-detail__card pm-asset-market__panel">
                          <p class="pm-asset-market__panel-kicker">Controls</p>
                          <h2 class="pm-detail__card-title">Asset protections and rules</h2>
                          <div class="pm-asset-market__stat-rows">
                            <div class="pm-asset-market__stat-row">
                              <span class="pm-asset-market__stat-label">Controllable</span>
                              <span class="pm-asset-market__stat-value">
                                {formatBooleanValue(registryAsset.controllable)}
                              </span>
                            </div>
                            <div class="pm-asset-market__stat-row">
                              <span class="pm-asset-market__stat-label">Self-service purchase</span>
                              <span class="pm-asset-market__stat-value">
                                {formatBooleanValue(registryAsset.self_service_purchase_enabled)}
                              </span>
                            </div>
                            <div class="pm-asset-market__stat-row">
                              <span class="pm-asset-market__stat-label">Visible</span>
                              <span class="pm-asset-market__stat-value">
                                {formatBooleanValue(registryAsset.visible)}
                              </span>
                            </div>
                            <div class="pm-asset-market__stat-row">
                              <span class="pm-asset-market__stat-label">Searchable</span>
                              <span class="pm-asset-market__stat-value">
                                {formatBooleanValue(registryAsset.searchable)}
                              </span>
                            </div>
                            <Show when={assetDetail?.compliance_rules}>
                              {rules => (
                                <>
                                  <div class="pm-asset-market__stat-row">
                                    <span class="pm-asset-market__stat-label">Transfers</span>
                                    <span class="pm-asset-market__stat-value">
                                      {formatBooleanValue(rules().transfers_enabled)}
                                    </span>
                                  </div>
                                  <div class="pm-asset-market__stat-row">
                                    <span class="pm-asset-market__stat-label">Subscriptions</span>
                                    <span class="pm-asset-market__stat-value">
                                      {formatBooleanValue(rules().subscriptions_enabled)}
                                    </span>
                                  </div>
                                  <div class="pm-asset-market__stat-row">
                                    <span class="pm-asset-market__stat-label">Redemptions</span>
                                    <span class="pm-asset-market__stat-value">
                                      {formatBooleanValue(rules().redemptions_enabled)}
                                    </span>
                                  </div>
                                  <div class="pm-asset-market__stat-row">
                                    <span class="pm-asset-market__stat-label">Accreditation required</span>
                                    <span class="pm-asset-market__stat-value">
                                      {formatBooleanValue(rules().requires_accreditation)}
                                    </span>
                                  </div>
                                </>
                              )}
                            </Show>
                          </div>
                        </section>
                      </div>

                      <section class="pm-asset-market__section">
                        <div class="pm-asset-market__section-head">
                          <div>
                            <p class="pm-asset-market__section-kicker">Documents</p>
                            <h2 class="pm-asset-market__section-title">Sources</h2>
                          </div>
                        </div>

                        <div class="pm-asset-market__documents">
                          <Show
                            when={registryAsset.sources.length > 0}
                            fallback={
                              <p class="pm-detail__card-copy">
                                No source links have been attached to this asset yet.
                              </p>
                            }
                          >
                            <For each={registryAsset.sources}>
                              {(source, index) => (
                                <a
                                  class="pm-asset-market__document-link"
                                  href={source}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <div class="pm-asset-market__document-copy">
                                    <p class="pm-asset-market__document-title">
                                      Source {index() + 1}
                                    </p>
                                    <p class="pm-asset-market__document-meta">
                                      {readSourceLabel(source)}
                                    </p>
                                  </div>
                                  <span class="pm-asset-market__document-action">Open</span>
                                </a>
                              )}
                            </For>
                          </Show>

                          <Show when={registryAsset.image_url}>
                            <a
                              class="pm-asset-market__document-link"
                              href={registryAsset.image_url ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <div class="pm-asset-market__document-copy">
                                <p class="pm-asset-market__document-title">Asset image</p>
                                <p class="pm-asset-market__document-meta">Catalog media reference</p>
                              </div>
                              <span class="pm-asset-market__document-action">Open</span>
                            </a>
                          </Show>
                        </div>
                      </section>
                    </section>
                  );
                }}
              </Show>
            </Show>
          </Show>
        </section>
      </main>
    </div>
  );
}
