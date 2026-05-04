import { A } from "@solidjs/router";
import { For } from "solid-js";

import type { AssetDetailResponse, AssetResponse } from "~/lib";

import { formatBooleanValue, truncateMiddle } from "./format";
import type { DisplayedRoute } from "./types";

interface AssetDetailReferencePanelsProps {
  asset: AssetResponse;
  detail: AssetDetailResponse | null;
  displayedRoutes: DisplayedRoute[];
}

export default function AssetDetailReferencePanels(props: AssetDetailReferencePanelsProps) {
  const rules = () => props.detail?.compliance_rules ?? null;

  return (
    <div class="pm-asset-market__lower-grid">
      <section class="pm-detail__card pm-asset-market__panel">
        <p class="pm-asset-market__panel-kicker">Registry access</p>
        <h2 class="pm-detail__card-title">Routes and references</h2>
        <div class="pm-asset-market__route-table">
          <For each={props.displayedRoutes}>
            {route => (
              <div class="pm-asset-market__route-row">
                <div class="pm-asset-market__route-copy">
                  <span class="pm-asset-market__route-label">{route.label}</span>
                  <span class="pm-asset-market__route-value">{route.value}</span>
                </div>
                <div class="pm-browser__button-row">
                  <A class="pm-button pm-button--ghost" href={route.href}>
                    Open
                  </A>
                </div>
              </div>
            )}
          </For>
        </div>

        <div class="pm-asset-market__reference-grid">
          <div class="pm-asset-market__fact">
            <span class="pm-asset-market__fact-label">Payment token</span>
            <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
              {truncateMiddle(props.asset.payment_token_address)}
            </span>
          </div>
          <div class="pm-asset-market__fact">
            <span class="pm-asset-market__fact-label">Treasury</span>
            <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
              {truncateMiddle(props.asset.treasury_address)}
            </span>
          </div>
        </div>
      </section>

      <section class="pm-detail__card pm-asset-market__panel">
        <p class="pm-asset-market__panel-kicker">Availability</p>
        <h2 class="pm-detail__card-title">Public access and safeguards</h2>
        <div class="pm-asset-market__stat-rows">
          <div class="pm-asset-market__stat-row">
            <span class="pm-asset-market__stat-label">Self-service purchase</span>
            <span class="pm-asset-market__stat-value">
              {formatBooleanValue(props.asset.self_service_purchase_enabled)}
            </span>
          </div>
          <div class="pm-asset-market__stat-row">
            <span class="pm-asset-market__stat-label">Transfers</span>
            <span class="pm-asset-market__stat-value">
              {rules() ? formatBooleanValue(rules()!.transfers_enabled) : "Not available"}
            </span>
          </div>
          <div class="pm-asset-market__stat-row">
            <span class="pm-asset-market__stat-label">Subscriptions</span>
            <span class="pm-asset-market__stat-value">
              {rules() ? formatBooleanValue(rules()!.subscriptions_enabled) : "Not available"}
            </span>
          </div>
          <div class="pm-asset-market__stat-row">
            <span class="pm-asset-market__stat-label">Redemptions</span>
            <span class="pm-asset-market__stat-value">
              {rules() ? formatBooleanValue(rules()!.redemptions_enabled) : "Not available"}
            </span>
          </div>
          <div class="pm-asset-market__stat-row">
            <span class="pm-asset-market__stat-label">Accreditation required</span>
            <span class="pm-asset-market__stat-value">
              {rules() ? formatBooleanValue(rules()!.requires_accreditation) : "Not available"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
