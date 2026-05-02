import { Title } from "@solidjs/meta";
import { Show, createEffect, createMemo, createSignal, sharedConfig } from "solid-js";

import AdminConsole from "~/components/AdminConsole";
import {
  buildAssetAddressPageHref,
  buildAssetProposalPageHref,
  DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
  formatBaseUnitsLabel,
  formatMarketReferenceAmountFromBaseUnits,
  formatPaymentTokenAmountFromBaseUnits,
  type AssetDetailResponse,
  type AssetHistoryResponse,
  type PaymentTokenQuoteResponse,
} from "~/lib";
import { getErrorMessage } from "~/lib/api";
import AssetDetailErrorState from "./AssetDetailErrorState";
import AssetDetailHero from "./AssetDetailHero";
import AssetDetailPageHeader from "./AssetDetailPageHeader";
import AssetDetailReferencePanels from "./AssetDetailReferencePanels";
import {
  loadAssetHistoryRange,
  primeAssetDetailBundle,
  readCachedAssetHistory,
  readCachedPaymentTokenQuote,
  readProjectedAssetDetailView,
} from "./data";
import AssetDetailSourcesSection from "./AssetDetailSourcesSection";
import AssetDetailStatsSection from "./AssetDetailStatsSection";
import AssetDetailSummaryGrid from "./AssetDetailSummaryGrid";
import {
  formatLookupLabel,
  readCategoryChips,
  readDisplayedRawPrice,
  readSpreadText,
  readStatusTone,
  readSummaryCopy,
  truncateMiddle,
} from "./format";
import {
  buildChartMetrics,
  buildHistoryChangeSummary,
  normalizeHistorySeries,
  readHistorySeries,
} from "./history";
import { LoadingState } from "./panels";
import type {
  AssetDetailScreenProps,
  DetailLoadStatus,
  DisplayedRoute,
  HistoryLoadStatus,
  PriceMode,
  TimeRange,
} from "./types";
import { TIME_RANGES } from "./types";

export default function AssetDetailScreen(props: AssetDetailScreenProps) {
  const canUseProjectedInitialView =
    typeof window !== "undefined" && sharedConfig.done === true;
  const initialProjectedDetail = canUseProjectedInitialView
    ? readProjectedAssetDetailView(props.mode, props.identifier())
    : null;
  const initialHistory = canUseProjectedInitialView
    ? readCachedAssetHistory(props.mode, props.identifier(), "1D")
    : null;
  const initialPaymentTokenQuote = canUseProjectedInitialView
    ? readCachedPaymentTokenQuote(props.mode, props.identifier())
    : null;

  const [status, setStatus] = createSignal<DetailLoadStatus>(
    initialProjectedDetail ? "ready" : "loading",
  );
  const [error, setError] = createSignal<string | null>(null);
  const [detail, setDetail] = createSignal<AssetDetailResponse | null>(initialProjectedDetail);
  const [historyStatus, setHistoryStatus] = createSignal<HistoryLoadStatus>(
    initialHistory ? "ready" : "idle",
  );
  const [historyError, setHistoryError] = createSignal<string | null>(null);
  const [history, setHistory] = createSignal<AssetHistoryResponse | null>(initialHistory);
  const [paymentTokenQuote, setPaymentTokenQuote] = createSignal<PaymentTokenQuoteResponse | null>(
    initialPaymentTokenQuote,
  );
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
  const paymentTokenMeta = createMemo(() => ({
    symbol: paymentTokenQuote()?.payment_token_symbol ?? DEFAULT_PAYMENT_TOKEN_DISPLAY_META.symbol,
    decimals:
      paymentTokenQuote()?.payment_token_decimals ?? DEFAULT_PAYMENT_TOKEN_DISPLAY_META.decimals,
    marketCurrency:
      paymentTokenQuote()?.market_currency ?? DEFAULT_PAYMENT_TOKEN_DISPLAY_META.marketCurrency,
    marketCurrencyPerPaymentToken:
      paymentTokenQuote()?.market_currency_per_payment_token ??
      DEFAULT_PAYMENT_TOKEN_DISPLAY_META.marketCurrencyPerPaymentToken,
  }));
  const displayPrice = createMemo(() => {
    const currentAsset = asset();

    if (!currentAsset) {
      return "Not available";
    }

    return formatPaymentTokenAmountFromBaseUnits(
      readDisplayedRawPrice(currentAsset, priceMode()),
      paymentTokenMeta(),
    );
  });
  const rawPriceLabel = createMemo(() => {
    const currentAsset = asset();

    if (!currentAsset) {
      return "Not available";
    }

    return formatBaseUnitsLabel(readDisplayedRawPrice(currentAsset, priceMode()));
  });
  const marketReferencePrice = createMemo(() => {
    const currentAsset = asset();

    if (!currentAsset) {
      return null;
    }

    return formatMarketReferenceAmountFromBaseUnits(
      readDisplayedRawPrice(currentAsset, priceMode()),
      paymentTokenMeta(),
    );
  });
  const subscriptionSettlementPrice = createMemo(() => {
    const currentAsset = asset();
    return currentAsset
      ? formatPaymentTokenAmountFromBaseUnits(currentAsset.price_per_token, paymentTokenMeta())
      : "Not available";
  });
  const redemptionSettlementPrice = createMemo(() => {
    const currentAsset = asset();
    return currentAsset
      ? formatPaymentTokenAmountFromBaseUnits(
          currentAsset.redemption_price_per_token,
          paymentTokenMeta(),
        )
      : "Not available";
  });
  const subscriptionBaseUnitsLabel = createMemo(() => {
    const currentAsset = asset();
    return currentAsset ? formatBaseUnitsLabel(currentAsset.price_per_token) : "Not available";
  });
  const redemptionBaseUnitsLabel = createMemo(() => {
    const currentAsset = asset();
    return currentAsset
      ? formatBaseUnitsLabel(currentAsset.redemption_price_per_token)
      : "Not available";
  });
  const subscriptionMarketReferencePrice = createMemo(() => {
    const currentAsset = asset();
    return currentAsset
      ? formatMarketReferenceAmountFromBaseUnits(currentAsset.price_per_token, paymentTokenMeta())
      : null;
  });
  const redemptionMarketReferencePrice = createMemo(() => {
    const currentAsset = asset();
    return currentAsset
      ? formatMarketReferenceAmountFromBaseUnits(
          currentAsset.redemption_price_per_token,
          paymentTokenMeta(),
        )
      : null;
  });
  const paymentTokenLabel = createMemo(() => {
    const currentAsset = asset();

    if (!currentAsset) {
      return "Not available";
    }

    return `${paymentTokenMeta().symbol} · ${truncateMiddle(currentAsset.payment_token_address)}`;
  });
  const historyCandles = createMemo(() => readHistorySeries(history(), priceMode()));
  const chartSeries = createMemo(() => {
    const currentAsset = asset();

    if (!currentAsset) {
      return [];
    }

    return normalizeHistorySeries(
      historyCandles(),
      readDisplayedRawPrice(currentAsset, priceMode()),
      paymentTokenMeta(),
    );
  });
  const chart = createMemo(() => buildChartMetrics(chartSeries()));
  const chartHasHistory = createMemo(() => chartSeries().length > 0);
  const chartChange = createMemo(() => buildHistoryChangeSummary(chartSeries(), timeRange()));
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
    const projectedDetail = readProjectedAssetDetailView(props.mode, identifier);
    const projectedHistory = readCachedAssetHistory(props.mode, identifier, "1D");
    const projectedPaymentTokenQuote = readCachedPaymentTokenQuote(props.mode, identifier);

    setStatus(projectedDetail ? "ready" : "loading");
    setError(null);
    setDetail(projectedDetail);
    setShowFullSummary(false);
    setPriceMode("buy");
    setTimeRange("1D");
    setHistory(projectedHistory);
    setPaymentTokenQuote(projectedPaymentTokenQuote);
    setHistoryStatus(projectedHistory ? "ready" : "idle");
    setHistoryError(null);

    try {
      const bundle = await primeAssetDetailBundle(props.mode, identifier, "1D");

      if (version !== requestVersion) {
        return;
      }

      setDetail(bundle.detail);
      setPaymentTokenQuote(bundle.paymentTokenQuote);
      setHistory(bundle.historyByRange["1D"] ?? null);
      setHistoryStatus(bundle.historyByRange["1D"] ? "ready" : "idle");
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
    const cachedHistory = readCachedAssetHistory(props.mode, identifier, range);

    if (cachedHistory) {
      setHistory(cachedHistory);
      setHistoryStatus("ready");
      setHistoryError(null);
      return;
    }

    setHistoryStatus("loading");
    setHistoryError(null);

    try {
      const response = await loadAssetHistoryRange(props.mode, identifier, range);

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

    if (range === "1D") {
      const cachedHistory = readCachedAssetHistory(props.mode, identifier, range);

      if (cachedHistory) {
        setHistory(cachedHistory);
        setHistoryStatus("ready");
        setHistoryError(null);
      }

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
          <AssetDetailPageHeader />

          <Show when={status() !== "loading"} fallback={<LoadingState />}>
            <Show
              when={!error()}
              fallback={
                <AssetDetailErrorState
                  error={error()}
                  onRetry={() => void loadDetail(props.identifier().trim())}
                />
              }
            >
              <Show when={asset()}>
                {currentAsset => {
                  const registryAsset = currentAsset();
                  const assetDetail = detail();
                  const statusTone = readStatusTone(registryAsset.asset_state_label);
                  const displayedRoutes: DisplayedRoute[] = [
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
                  ];

                  return (
                    <section class="pm-asset-market">
                      <AssetDetailHero
                        asset={registryAsset}
                        baseUnitsLabel={rawPriceLabel()}
                        categoryChips={categoryChips()}
                        chart={chart()}
                        chartChange={chartChange()}
                        chartHasHistory={chartHasHistory()}
                        copiedField={copiedField()}
                        displayPrice={displayPrice()}
                        history={history()}
                        historyError={historyError()}
                        historyLabel={historyLabel()}
                        historyStatus={historyStatus()}
                        lookupLabel={formatLookupLabel(props.mode, props.identifier())}
                        marketReferencePrice={marketReferencePrice()}
                        onCopyValue={(field, value) => void copyValue(field, value)}
                        onSetPriceMode={setPriceMode}
                        onSetTimeRange={setTimeRange}
                        onToggleSummary={() => setShowFullSummary(open => !open)}
                        paymentTokenLabel={paymentTokenLabel()}
                        priceMode={priceMode()}
                        spreadText={readSpreadText(registryAsset, priceMode(), paymentTokenMeta())}
                        statusTone={statusTone}
                        sourceHref={registryAsset.sources[0]}
                        summaryPreview={summaryPreview()}
                        isSummaryLong={isSummaryLong()}
                        showFullSummary={showFullSummary()}
                        timeRange={timeRange()}
                        timeRanges={TIME_RANGES}
                      />

                      <AssetDetailSummaryGrid asset={registryAsset} detail={assetDetail} />

                      <AssetDetailStatsSection
                        asset={registryAsset}
                        detail={assetDetail}
                        redemptionBaseUnitsLabel={redemptionBaseUnitsLabel()}
                        redemptionMarketReferencePrice={redemptionMarketReferencePrice()}
                        redemptionSettlementPrice={redemptionSettlementPrice()}
                        subscriptionBaseUnitsLabel={subscriptionBaseUnitsLabel()}
                        subscriptionMarketReferencePrice={subscriptionMarketReferencePrice()}
                        subscriptionSettlementPrice={subscriptionSettlementPrice()}
                      />

                      <AssetDetailReferencePanels
                        asset={registryAsset}
                        detail={assetDetail}
                        displayedRoutes={displayedRoutes}
                      />

                      <AssetDetailSourcesSection asset={registryAsset} />
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
