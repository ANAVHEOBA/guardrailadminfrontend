import type {
  AssetHistoryCandleResponse,
  AssetHistoryResponse,
  PaymentTokenDisplayMeta,
} from "~/lib";
import { convertBaseUnitsToDisplayNumber } from "~/lib";

import type {
  ChartMetrics,
  HistoryChangeSummary,
  PriceMode,
  TimeRange,
} from "./types";
import { RANGE_LABEL_MAP } from "./types";
import { formatDisplayNumber } from "./format";

export function readHistorySeries(
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

export function normalizeHistorySeries(
  candles: AssetHistoryCandleResponse[],
  displayedRawPrice: string,
  paymentTokenMeta: PaymentTokenDisplayMeta,
): number[] {
  const values = candles
    .map(candle =>
      convertBaseUnitsToDisplayNumber(candle.value, paymentTokenMeta) ??
      convertBaseUnitsToDisplayNumber(candle.close, paymentTokenMeta),
    )
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return [];
  }

  const targetValue = convertBaseUnitsToDisplayNumber(displayedRawPrice, paymentTokenMeta);
  const anchorValue = values.at(-1) ?? null;

  if (targetValue === null || anchorValue === null || anchorValue <= 0) {
    return values;
  }

  const scale = targetValue / anchorValue;
  return values.map(value => value * scale);
}

export function buildHistoryChangeSummary(
  series: number[],
  range: TimeRange,
): HistoryChangeSummary | null {
  if (series.length < 2) {
    return null;
  }

  const firstValue = series[0];
  const lastValue = series[series.length - 1];
  const change = lastValue - firstValue;
  const percent = firstValue !== 0 ? (change / firstValue) * 100 : 0;
  const sign = change > 0 ? "+" : change < 0 ? "-" : "";

  return {
    amount: `${sign}${formatDisplayNumber(Math.abs(change))}`,
    percent: `${sign}${Math.abs(percent).toFixed(2)}%`,
    tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral",
    label: RANGE_LABEL_MAP[range],
  };
}

export function buildChartMetrics(series: number[]): ChartMetrics {
  const safeSeries = series.length > 0 ? series : [0, 0];
  const width = 760;
  const height = 280;
  const insetX = 14;
  const insetY = 18;
  const minimum = Math.min(...safeSeries);
  const maximum = Math.max(...safeSeries);
  const fallbackSpan = Math.max(
    Math.abs(minimum) * 0.02,
    Math.abs(maximum) * 0.02,
    0.000001,
  );
  const span = Math.max(maximum - minimum, fallbackSpan);

  const points = safeSeries.map((value, index) => {
    const x = insetX + (index / Math.max(safeSeries.length - 1, 1)) * (width - insetX * 2);
    const y =
      height - insetY - ((value - minimum) / span) * (height - insetY * 2);

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
