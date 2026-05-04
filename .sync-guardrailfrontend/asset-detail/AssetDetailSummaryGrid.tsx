import {
  formatPaymentTokenAmountFromBaseUnits,
  type AssetDetailResponse,
  type AssetResponse,
  type PaymentTokenDisplayMeta,
} from "~/lib";

import { formatDateTime, formatNumericString } from "./format";
import { SummaryCard } from "./panels";

interface AssetDetailSummaryGridProps {
  asset: AssetResponse;
  detail: AssetDetailResponse | null;
  paymentTokenMeta: PaymentTokenDisplayMeta;
}

export default function AssetDetailSummaryGrid(props: AssetDetailSummaryGridProps) {
  const holder = () => props.detail?.holder ?? null;

  return (
    <div class="pm-asset-market__summary-grid">
      <SummaryCard
        label="Total supply"
        value={formatNumericString(props.asset.total_supply)}
        meta={`Max supply ${formatNumericString(props.asset.max_supply)}`}
      />
      <SummaryCard
        label="Investor footprint"
        value={formatNumericString(props.asset.holder_count)}
        meta={`${formatNumericString(props.asset.total_pending_redemptions)} pending redemptions`}
      />
      <SummaryCard
        label="Treasury liquidity"
        value={formatPaymentTokenAmountFromBaseUnits(
          props.detail?.treasury?.available_liquidity ?? null,
          props.paymentTokenMeta,
        )}
        meta={`Balance ${formatPaymentTokenAmountFromBaseUnits(
          props.detail?.treasury?.balance ?? null,
          props.paymentTokenMeta,
        )}`}
      />
      <SummaryCard
        label={holder() ? "Your position" : "Latest NAV"}
        value={
          holder()
            ? formatNumericString(holder()?.balance ?? null)
            : formatPaymentTokenAmountFromBaseUnits(
                props.detail?.valuation?.nav_per_token ?? null,
                props.paymentTokenMeta,
              )
        }
        meta={
          holder()
            ? `Pending redemption ${formatNumericString(holder()?.pending_redemption ?? null)}`
            : `Updated ${formatDateTime(
                props.detail?.valuation?.updated_at ?? props.asset.updated_at,
              )}`
        }
      />
    </div>
  );
}
