import { For, Show } from "solid-js";

import type { AssetHistoryResponse, AssetResponse } from "~/lib";

import {
  formatDisplayNumber,
  formatUnixTimestamp,
  readHeadlineMeta,
  truncateMiddle,
} from "./format";
import type {
  ChartMetrics,
  HistoryChangeSummary,
  HistoryLoadStatus,
  PriceMode,
  TimeRange,
} from "./types";

interface AssetDetailHeroProps {
  asset: AssetResponse;
  baseUnitsLabel: string;
  categoryChips: string[];
  chart: ChartMetrics;
  chartChange: HistoryChangeSummary | null;
  chartHasHistory: boolean;
  copiedField: string | null;
  displayPrice: string;
  history: AssetHistoryResponse | null;
  historyError: string | null;
  historyLabel: string;
  historyStatus: HistoryLoadStatus;
  lookupLabel: string;
  marketReferencePrice?: string | null;
  onCopyValue: (field: string, value: string) => void;
  onSetPriceMode: (mode: PriceMode) => void;
  onSetTimeRange: (range: TimeRange) => void;
  onToggleSummary: () => void;
  paymentTokenLabel: string;
  priceMode: PriceMode;
  spreadText: string;
  statusTone: "positive" | "warning" | "neutral";
  sourceHref?: string | null;
  summaryPreview: string;
  isSummaryLong: boolean;
  showFullSummary: boolean;
  timeRange: TimeRange;
  timeRanges: readonly TimeRange[];
}

export default function AssetDetailHero(props: AssetDetailHeroProps) {
  return (
    <section class="pm-asset-market__hero-card">
      <div class="pm-asset-market__hero-top">
        <div class="pm-asset-market__identity">
          <div class="pm-asset-market__avatar">
            <Show
              when={props.asset.image_url}
              fallback={
                <span class="pm-asset-market__avatar-fallback">
                  {props.asset.symbol.charAt(0).toUpperCase() || "A"}
                </span>
              }
            >
              <img
                src={props.asset.image_url ?? ""}
                alt={`${props.asset.name} icon`}
                loading="eager"
                decoding="async"
              />
            </Show>
          </div>

          <div class="pm-asset-market__identity-copy">
            <h1 class="pm-asset-market__title">{props.asset.name}</h1>
            <p class="pm-asset-market__symbol">{props.asset.symbol}</p>
          </div>
        </div>

        <div class="pm-asset-market__status-block">
          <div class={`pm-asset-market__status pm-asset-market__status--${props.statusTone}`}>
            <span class="pm-asset-market__status-dot" />
            <span>{props.asset.asset_state_label}</span>
          </div>
          <Show when={props.sourceHref}>
            <a
              class="pm-asset-market__status-link"
              href={props.sourceHref ?? "#"}
              target="_blank"
              rel="noreferrer"
            >
              View source
            </a>
          </Show>
        </div>
      </div>

      <div class="pm-asset-market__hero-grid">
        <section class={`pm-asset-market__price-surface pm-asset-market__price-surface--${props.priceMode}`}>
          <div class="pm-asset-market__price-header">
            <div class="pm-asset-market__price-head">
              <p class="pm-asset-market__kicker">
                {props.priceMode === "buy" ? "Subscription price" : "Redemption price"}
              </p>
              <h2 class="pm-asset-market__price">{props.displayPrice}</h2>
              <div class="pm-asset-market__delta">
                <Show
                  when={props.chartChange}
                  fallback={
                    <>
                      <span class="pm-asset-market__delta-chip">Settlement</span>
                      <span>{props.spreadText}</span>
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
                      <span>
                        {change().percent} {change().label}
                      </span>
                    </>
                  )}
                </Show>
              </div>

              <div class="pm-asset-market__price-meta">
                <Show when={props.marketReferencePrice}>
                  <p class="pm-asset-market__price-meta-row">
                    <span class="pm-asset-market__price-meta-label">Market price</span>
                    <span>{props.marketReferencePrice}</span>
                  </p>
                </Show>
                <p class="pm-asset-market__price-meta-row">
                  <span class="pm-asset-market__price-meta-label">On-chain value</span>
                  <span>{props.baseUnitsLabel}</span>
                </p>
              </div>
            </div>

            <div class="pm-asset-market__price-actions">
              <div class="pm-asset-market__toggle">
                <button
                  class={`pm-asset-market__toggle-button${
                    props.priceMode === "buy" ? " pm-asset-market__toggle-button--active" : ""
                  }`}
                  type="button"
                  onClick={() => props.onSetPriceMode("buy")}
                >
                  Buy
                </button>
                <button
                  class={`pm-asset-market__toggle-button${
                    props.priceMode === "sell" ? " pm-asset-market__toggle-button--active" : ""
                  }`}
                  type="button"
                  onClick={() => props.onSetPriceMode("sell")}
                >
                  Sell
                </button>
              </div>
            </div>
          </div>

          <div class="pm-asset-market__range-row">
            <For each={props.timeRanges}>
              {range => (
                <button
                  class={`pm-asset-market__range-chip${
                    props.timeRange === range ? " pm-asset-market__range-chip--active" : ""
                  }`}
                  type="button"
                  onClick={() => props.onSetTimeRange(range)}
                >
                  {range}
                </button>
              )}
            </For>
          </div>

          <div class={`pm-asset-market__chart-frame pm-asset-market__chart-frame--${props.priceMode}`}>
            <Show
              when={props.chartHasHistory}
              fallback={
                <div class="pm-asset-market__chart-empty">
                  <p class="pm-asset-market__chart-empty-title">No price history yet</p>
                  <p class="pm-asset-market__chart-empty-copy">
                    This chart only renders backend history. Try another range after the backend records snapshots.
                  </p>
                </div>
              }
            >
              <svg
                class="pm-asset-market__chart"
                viewBox={`0 0 ${props.chart.width} ${props.chart.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <For each={Array.from({ length: 4 })}>
                  {(_, index) => {
                    const y = 24 + (index() / 3) * (props.chart.height - 48);

                    return (
                      <line
                        x1="12"
                        y1={y}
                        x2={props.chart.width - 12}
                        y2={y}
                        class="pm-asset-market__grid-line"
                      />
                    );
                  }}
                </For>
                <polygon
                  points={props.chart.area}
                  class={`pm-asset-market__chart-area pm-asset-market__chart-area--${props.priceMode}`}
                />
                <polyline
                  points={props.chart.line}
                  class={`pm-asset-market__chart-line pm-asset-market__chart-line--${props.priceMode}`}
                />
              </svg>
              <div class="pm-asset-market__chart-scale">
                <span>{formatDisplayNumber(props.chart.maximum)}</span>
                <span>{formatDisplayNumber(props.chart.minimum)}</span>
              </div>
            </Show>
          </div>

          <p class="pm-asset-market__chart-note">
            <Show when={props.chartHasHistory}>
              <span>
                Settlement chart ·{" "}
                {props.historyLabel} · {props.history?.interval ?? "unknown interval"} · updated{" "}
                {formatUnixTimestamp(props.history?.last_updated_at)}
              </span>
            </Show>
            <Show when={!props.chartHasHistory && props.historyStatus === "ready"}>
              <span>No backend history is available for this range yet.</span>
            </Show>
            <Show when={props.historyStatus === "loading"}>
              <span> Refreshing history…</span>
            </Show>
            <Show when={props.historyStatus === "error" && props.historyError}>
              <span> History unavailable: {props.historyError}</span>
            </Show>
          </p>
        </section>

        <aside class="pm-asset-market__about-panel">
          <div class="pm-asset-market__about-head">
            <p class="pm-asset-market__panel-kicker">About</p>
            <p class="pm-asset-market__panel-subcopy">{readHeadlineMeta(props.asset)}</p>
          </div>

          <p class="pm-asset-market__about-copy">
            {props.summaryPreview}
            <Show when={props.isSummaryLong}>
              <button
                class="pm-asset-market__text-button"
                type="button"
                onClick={props.onToggleSummary}
              >
                {props.showFullSummary ? "Show less" : "Show more"}
              </button>
            </Show>
          </p>

          <div class="pm-asset-market__fact-stack">
            <div class="pm-asset-market__fact">
              <span class="pm-asset-market__fact-label">Category</span>
              <div class="pm-asset-market__chip-row">
                <For each={props.categoryChips}>
                  {chip => <span class="pm-asset-market__chip">{chip}</span>}
                </For>
              </div>
            </div>

            <div class="pm-asset-market__fact">
              <span class="pm-asset-market__fact-label">Onchain address</span>
              <div class="pm-asset-market__address-row">
                <span class="pm-asset-market__address-value">
                  {truncateMiddle(props.asset.asset_address)}
                </span>
                <button
                  class="pm-asset-market__copy-button"
                  type="button"
                  onClick={() => props.onCopyValue("asset_address", props.asset.asset_address)}
                >
                  {props.copiedField === "asset_address" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div class="pm-asset-market__fact-grid">
              <div class="pm-asset-market__fact">
                <span class="pm-asset-market__fact-label">Proposal ID</span>
                <span class="pm-asset-market__fact-value">{props.asset.proposal_id}</span>
              </div>
              <div class="pm-asset-market__fact">
                <span class="pm-asset-market__fact-label">Asset type</span>
                <span class="pm-asset-market__fact-value">
                  {props.asset.asset_type_name ??
                    props.asset.asset_type_id_text ??
                    props.asset.asset_type_id}
                </span>
              </div>
              <div class="pm-asset-market__fact">
                <span class="pm-asset-market__fact-label">Payment token</span>
                <span class="pm-asset-market__fact-value">{props.paymentTokenLabel}</span>
              </div>
              <div class="pm-asset-market__fact">
                <span class="pm-asset-market__fact-label">Lookup used</span>
                <span class="pm-asset-market__fact-value">{props.lookupLabel}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
