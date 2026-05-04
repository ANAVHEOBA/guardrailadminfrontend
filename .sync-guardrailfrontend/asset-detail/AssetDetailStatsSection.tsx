import {
  formatPaymentTokenAmountFromBaseUnits,
  type AssetDetailResponse,
  type AssetResponse,
  type PaymentTokenDisplayMeta,
} from "~/lib";

import {
  formatDateTime,
  formatNumericString,
  formatUnixTimestamp,
} from "./format";
import { StatPanel } from "./panels";

interface AssetDetailStatsSectionProps {
  asset: AssetResponse;
  detail: AssetDetailResponse | null;
  paymentTokenMeta: PaymentTokenDisplayMeta;
  redemptionMarketReferencePrice: string | null;
  redemptionSettlementPrice: string;
  subscriptionMarketReferencePrice: string | null;
  subscriptionSettlementPrice: string;
}

export default function AssetDetailStatsSection(props: AssetDetailStatsSectionProps) {
  const holder = () => props.detail?.holder ?? null;

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
          subtitle="Settlement values from the public registry."
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
              label: "Redemption market price",
              value: props.redemptionMarketReferencePrice ?? "Not available",
            },
            {
              label: "Redemption settlement",
              value: props.redemptionSettlementPrice,
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
          subtitle="Treasury-backed balances and valuation snapshots."
          rows={[
            {
              label: "Balance",
              value: formatPaymentTokenAmountFromBaseUnits(
                props.detail?.treasury?.balance ?? null,
                props.paymentTokenMeta,
              ),
            },
            {
              label: "Reserved yield",
              value: formatPaymentTokenAmountFromBaseUnits(
                props.detail?.treasury?.reserved_yield ?? null,
                props.paymentTokenMeta,
              ),
            },
            {
              label: "Available liquidity",
              value: formatPaymentTokenAmountFromBaseUnits(
                props.detail?.treasury?.available_liquidity ?? null,
                props.paymentTokenMeta,
              ),
            },
            {
              label: "NAV per token",
              value: formatPaymentTokenAmountFromBaseUnits(
                props.detail?.valuation?.nav_per_token ?? null,
                props.paymentTokenMeta,
              ),
            },
          ]}
        />
        <StatPanel
          title="Account"
          subtitle={
            holder()
              ? "Wallet-specific balances from the user endpoint."
              : "Sign in with a linked wallet to view your balances."
          }
          rows={
            holder()
              ? [
                  {
                    label: "Asset balance",
                    value: formatNumericString(holder()?.balance ?? null),
                  },
                  {
                    label: "Unlocked balance",
                    value: formatNumericString(holder()?.unlocked_balance ?? null),
                  },
                  {
                    label: "Pending redemption",
                    value: formatNumericString(holder()?.pending_redemption ?? null),
                  },
                  {
                    label: "Wallet cash",
                    value: formatPaymentTokenAmountFromBaseUnits(
                      holder()?.payment_token_balance ?? null,
                      props.paymentTokenMeta,
                    ),
                  },
                ]
              : [
                  {
                    label: "Status",
                    value: "Wallet not connected",
                  },
                  {
                    label: "Updated",
                    value: formatDateTime(props.asset.updated_at),
                  },
                  {
                    label: "Valuation timestamp",
                    value: formatUnixTimestamp(props.detail?.valuation?.onchain_updated_at),
                  },
                  {
                    label: "Asset status",
                    value: props.asset.asset_state_label,
                  },
                ]
          }
        />
      </div>
    </section>
  );
}
