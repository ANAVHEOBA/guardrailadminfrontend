import type { AssetDetailResponse, AssetResponse } from "~/lib";

import { formatDateTime, formatNumericString } from "./format";
import { SummaryCard } from "./panels";

interface AssetDetailSummaryGridProps {
  asset: AssetResponse;
  detail: AssetDetailResponse | null;
}

export default function AssetDetailSummaryGrid(props: AssetDetailSummaryGridProps) {
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
        value={formatNumericString(props.detail?.treasury?.available_liquidity ?? "0")}
        meta={`Balance ${formatNumericString(props.detail?.treasury?.balance ?? "0")}`}
      />
      <SummaryCard
        label="Valuation NAV"
        value={formatNumericString(props.detail?.valuation?.nav_per_token ?? "0")}
        meta={`Updated ${formatDateTime(props.detail?.valuation?.updated_at ?? props.asset.updated_at)}`}
      />
    </div>
  );
}
