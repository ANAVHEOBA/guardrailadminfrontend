import type { Accessor } from "solid-js";

export type AssetDetailLookupMode = "public" | "asset_address" | "proposal" | "slug";
export type DetailLoadStatus = "loading" | "ready" | "error";
export type HistoryLoadStatus = "idle" | "loading" | "ready" | "error";
export type PriceMode = "buy" | "sell";
export type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export interface AssetDetailScreenProps {
  mode: AssetDetailLookupMode;
  identifier: Accessor<string>;
}

export interface HistoryChangeSummary {
  amount: string;
  percent: string;
  tone: "positive" | "negative" | "neutral";
  label: string;
}

export interface ChartMetrics {
  width: number;
  height: number;
  line: string;
  area: string;
  minimum: number;
  maximum: number;
}

export interface DisplayedRoute {
  label: string;
  value: string;
  href: string;
}

export interface StatRow {
  label: string;
  value: string;
  mono?: boolean;
}

export const TIME_RANGES: readonly TimeRange[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;

export const HISTORY_RANGE_MAP: Record<TimeRange, string> = {
  "1D": "1day",
  "1W": "1week",
  "1M": "1month",
  "3M": "3months",
  "1Y": "1year",
  ALL: "all",
};

export const RANGE_LABEL_MAP: Record<TimeRange, string> = {
  "1D": "24H",
  "1W": "1W",
  "1M": "1M",
  "3M": "3M",
  "1Y": "1Y",
  ALL: "ALL",
};
