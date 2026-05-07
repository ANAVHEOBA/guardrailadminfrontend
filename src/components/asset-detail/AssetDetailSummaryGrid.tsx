import {
  formatBaseUnitsLabel,
  type AssetDetailResponse,
  type AssetResponse,
  type PaymentTokenDisplayMeta,
} from "~/lib";

import {
  formatAssetTokenValue,
  formatDateTime,
  formatNumericString,
  formatPaymentTokenValue,
  formatPaymentTokenValueWithRaw,
} from "./format";
import { SummaryCard } from "./panels";

interface AssetDetailSummaryGridProps {
  asset: AssetResponse;
  detail: AssetDetailResponse | null;
  paymentTokenMeta: PaymentTokenDisplayMeta | null;
}

export default function AssetDetailSummaryGrid(props: AssetDetailSummaryGridProps) {
  return (
    <div class="pm-asset-market__summary-grid">
      <SummaryCard
        label="Total supply"
        value={formatAssetTokenValue(props.asset.total_supply)}
        meta={`Max supply ${formatAssetTokenValue(props.asset.max_supply)}`}
      />
      <SummaryCard
        label="Investor footprint"
        value={formatNumericString(props.asset.holder_count)}
        meta={`${formatNumericString(props.asset.total_pending_redemptions)} pending redemptions`}
      />
      <SummaryCard
        label="Treasury liquidity"
        value={formatPaymentTokenValue(
          props.detail?.treasury?.available_liquidity ?? null,
          props.paymentTokenMeta,
        )}
        meta={`Balance ${formatPaymentTokenValueWithRaw(
          props.detail?.treasury?.balance ?? null,
          props.paymentTokenMeta,
        )}`}
      />
      <SummaryCard
        label="Valuation NAV"
        value={formatPaymentTokenValue(
          props.detail?.valuation?.nav_per_token ?? null,
          props.paymentTokenMeta,
        )}
        meta={`${formatBaseUnitsLabel(
          props.detail?.valuation?.nav_per_token ?? null,
        )} · Updated ${formatDateTime(props.detail?.valuation?.updated_at ?? props.asset.updated_at)}`}
      />
    </div>
  );
}
