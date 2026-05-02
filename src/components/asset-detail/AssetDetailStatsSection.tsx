import type { AssetDetailResponse, AssetResponse } from "~/lib";

import {
  formatDateTime,
  formatNumericString,
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
              value: formatNumericString(props.asset.total_supply),
            },
            {
              label: "Max supply",
              value: formatNumericString(props.asset.max_supply),
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
              value: formatNumericString(props.detail?.treasury?.balance ?? "0"),
            },
            {
              label: "Reserved yield",
              value: formatNumericString(props.detail?.treasury?.reserved_yield ?? "0"),
            },
            {
              label: "Available liquidity",
              value: formatNumericString(props.detail?.treasury?.available_liquidity ?? "0"),
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
