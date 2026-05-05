import type { AssetDetailResponse, AssetResponse, PaymentTokenDisplayMeta } from "~/lib";

import {
  formatAssetTokenValue,
  formatDateTime,
  formatNumericString,
  formatPaymentTokenValueWithRaw,
  formatUnixTimestamp,
  truncateMiddle,
} from "./format";
import { StatPanel } from "./panels";

interface AssetDetailStatsSectionProps {
  asset: AssetResponse;
  subscriptionBaseUnitsLabel: string;
  subscriptionMarketReferencePrice: string | null;
  subscriptionSettlementPrice: string;
  detail: AssetDetailResponse | null;
  redemptionBaseUnitsLabel: string;
  redemptionMarketReferencePrice: string | null;
  redemptionSettlementPrice: string;
  paymentTokenMeta: PaymentTokenDisplayMeta | null;
}

export default function AssetDetailStatsSection(props: AssetDetailStatsSectionProps) {
  return (
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
          subtitle="Market reference, settlement amount, and stored contract values."
          rows={[
            {
              label: "Subscription market price",
              value: props.subscriptionMarketReferencePrice ?? "Not available",
            },
            {
              label: "Subscription settlement",
              value: props.subscriptionSettlementPrice,
            },
            {
              label: "Subscription raw value",
              value: props.subscriptionBaseUnitsLabel,
            },
            {
              label: "Redemption market price",
              value: props.redemptionMarketReferencePrice ?? "Not available",
            },
            {
              label: "Redemption settlement",
              value: props.redemptionSettlementPrice,
            },
            {
              label: "Redemption raw value",
              value: props.redemptionBaseUnitsLabel,
            },
          ]}
        />
        <StatPanel
          title="Supply"
          subtitle="Token circulation and holder activity."
          rows={[
            {
              label: "Total supply",
              value: formatAssetTokenValue(props.asset.total_supply),
            },
            {
              label: "Max supply",
              value: formatAssetTokenValue(props.asset.max_supply),
            },
            {
              label: "Holders",
              value: formatNumericString(props.asset.holder_count),
            },
            {
              label: "Pending redemptions",
              value: formatNumericString(props.asset.total_pending_redemptions),
            },
          ]}
        />
        <StatPanel
          title="Treasury"
          subtitle="Treasury-backed balances for this asset."
          rows={[
            {
              label: "Balance",
              value: formatPaymentTokenValueWithRaw(
                props.detail?.treasury?.balance ?? null,
                props.paymentTokenMeta,
              ),
            },
            {
              label: "Reserved yield",
              value: formatPaymentTokenValueWithRaw(
                props.detail?.treasury?.reserved_yield ?? null,
                props.paymentTokenMeta,
              ),
            },
            {
              label: "Available liquidity",
              value: formatPaymentTokenValueWithRaw(
                props.detail?.treasury?.available_liquidity ?? null,
                props.paymentTokenMeta,
              ),
            },
            {
              label: "Updated",
              value: formatDateTime(props.detail?.treasury?.updated_at ?? props.asset.updated_at),
            },
          ]}
        />
        <StatPanel
          title="Valuation"
          subtitle="Latest valuation snapshot when available."
          rows={[
            {
              label: "Asset value",
              value: formatNumericString(props.detail?.valuation?.asset_value ?? "0"),
            },
            {
              label: "NAV per token",
              value: formatNumericString(props.detail?.valuation?.nav_per_token ?? "0"),
            },
            {
              label: "On-chain updated",
              value: formatUnixTimestamp(props.detail?.valuation?.onchain_updated_at),
            },
            {
              label: "Reference ID",
              value: truncateMiddle(
                props.detail?.valuation?.reference_id ??
                  "0x0000000000000000000000000000000000000000000000000000000000000000",
              ),
              mono: true,
            },
          ]}
        />
      </div>
    </section>
  );
}
