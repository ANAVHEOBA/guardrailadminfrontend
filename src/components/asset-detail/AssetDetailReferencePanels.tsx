import { A } from "@solidjs/router";
import { For, Show, createEffect, createSignal } from "solid-js";

import type { AssetDetailResponse, AssetResponse } from "~/lib";
import { assetClient, readAdminToken } from "~/lib";
import { useAdminAuth } from "~/lib/admin-auth-context";
import { getErrorMessage } from "~/lib/api";
import AdminModal from "~/components/AdminModal";

import { formatBooleanValue, truncateMiddle } from "./format";
import type { DisplayedRoute } from "./types";

interface AssetDetailReferencePanelsProps {
  asset: AssetResponse;
  detail: AssetDetailResponse | null;
  displayedRoutes: DisplayedRoute[];
  onAssetUpdated?: (asset: AssetResponse) => void;
}

export default function AssetDetailReferencePanels(props: AssetDetailReferencePanelsProps) {
  const auth = useAdminAuth();
  const [isToggleModalOpen, setToggleModalOpen] = createSignal(false);
  const [togglePending, setTogglePending] = createSignal(false);
  const [toggleError, setToggleError] = createSignal<string | null>(null);
  const [toggleStatus, setToggleStatus] = createSignal<string | null>(null);
  const [selfServiceEnabled, setSelfServiceEnabled] = createSignal(
    props.asset.self_service_purchase_enabled,
  );

  const adminToken = () => auth.session()?.token ?? readAdminToken();
  const isAdminConnected = () => Boolean(auth.profile() && adminToken());
  const nextSelfServiceState = () => !selfServiceEnabled();

  createEffect(() => {
    setSelfServiceEnabled(props.asset.self_service_purchase_enabled);
  });

  const openToggleModal = () => {
    setToggleError(null);
    setToggleStatus(null);
    setToggleModalOpen(true);
  };

  const closeToggleModal = () => {
    if (togglePending()) {
      return;
    }
    setToggleModalOpen(false);
  };

  const runSelfServiceToggle = async () => {
    const token = adminToken();

    if (!token) {
      setToggleError("Connect an admin wallet first.");
      return;
    }

    setToggleError(null);
    setToggleStatus(null);
    setTogglePending(true);

    try {
      console.info("[asset-controls] setSelfServicePurchaseEnabled:start", {
        assetAddress: props.asset.asset_address,
        currentEnabled: props.asset.self_service_purchase_enabled,
        nextEnabled: nextSelfServiceState(),
      });

      const response = await assetClient.setSelfServicePurchaseEnabled(
        token,
        props.asset.asset_address,
        { enabled: nextSelfServiceState() },
      );
      console.info("[asset-controls] setSelfServicePurchaseEnabled:success", response);
      setSelfServiceEnabled(response.asset.self_service_purchase_enabled);
      props.onAssetUpdated?.(response.asset);
      setToggleStatus(
        `Updated. Backend now reports self-service purchase as ${
          response.asset.self_service_purchase_enabled ? "Enabled" : "Disabled"
        }.`,
      );
    } catch (error) {
      console.error("[asset-controls] setSelfServicePurchaseEnabled:error", error);
      setToggleError(getErrorMessage(error));
    } finally {
      setTogglePending(false);
    }
  };

  return (
    <>
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
              <span class="pm-asset-market__fact-label">Metadata hash</span>
              <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                {truncateMiddle(props.asset.metadata_hash)}
              </span>
            </div>
            <div class="pm-asset-market__fact">
              <span class="pm-asset-market__fact-label">Last transaction</span>
              <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                {props.asset.last_tx_hash ? truncateMiddle(props.asset.last_tx_hash) : "Not available"}
              </span>
            </div>
          </div>
        </section>

        <section class="pm-detail__card pm-asset-market__panel">
          <p class="pm-asset-market__panel-kicker">Controls</p>
          <h2 class="pm-detail__card-title">Asset protections and rules</h2>
          <div class="pm-asset-market__stat-rows">
            <div class="pm-asset-market__stat-row">
              <span class="pm-asset-market__stat-label">Controllable</span>
              <span class="pm-asset-market__stat-value">
                {formatBooleanValue(props.asset.controllable)}
              </span>
            </div>
            <div class="pm-asset-market__stat-row">
              <span class="pm-asset-market__stat-label">Self-service purchase</span>
              <span class="pm-asset-market__stat-value">
                {formatBooleanValue(selfServiceEnabled())}
              </span>
            </div>
            <div class="pm-asset-market__stat-row">
              <span class="pm-asset-market__stat-label">Visible</span>
              <span class="pm-asset-market__stat-value">{formatBooleanValue(props.asset.visible)}</span>
            </div>
            <div class="pm-asset-market__stat-row">
              <span class="pm-asset-market__stat-label">Searchable</span>
              <span class="pm-asset-market__stat-value">
                {formatBooleanValue(props.asset.searchable)}
              </span>
            </div>
            <Show when={props.detail?.compliance_rules}>
              {rules => (
                <>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Transfers</span>
                    <span class="pm-asset-market__stat-value">
                      {formatBooleanValue(rules().transfers_enabled)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Subscriptions</span>
                    <span class="pm-asset-market__stat-value">
                      {formatBooleanValue(rules().subscriptions_enabled)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Redemptions</span>
                    <span class="pm-asset-market__stat-value">
                      {formatBooleanValue(rules().redemptions_enabled)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Accreditation required</span>
                    <span class="pm-asset-market__stat-value">
                      {formatBooleanValue(rules().requires_accreditation)}
                    </span>
                  </div>
                </>
              )}
            </Show>
          </div>
          <div class="pm-market-actions">
            <button class="pm-button pm-button--ghost" type="button" onClick={openToggleModal}>
              {nextSelfServiceState() ? "Enable self-service purchase" : "Disable self-service purchase"}
            </button>
          </div>
        </section>
      </div>

      <AdminModal
        open={isToggleModalOpen()}
        onClose={closeToggleModal}
        eyebrow="Asset controls"
        title={nextSelfServiceState() ? "Enable self-service purchase" : "Disable self-service purchase"}
        subtitle={`Update self-service purchase flag for ${props.asset.name}.`}
      >
        <div class="pm-asset-market__modal-stack">
          <Show
            when={isAdminConnected()}
            fallback={
              <div class="pm-asset-market__auth-gate">
                <p>Admin auth is required before you can update self-service purchase.</p>
                <button class="pm-button pm-button--primary" type="button" onClick={auth.openAuthDialog}>
                  Authenticate admin wallet
                </button>
              </div>
            }
          >
            <p class="pm-market-feedback">
              Current state: {formatBooleanValue(selfServiceEnabled())}.
            </p>
            <Show when={toggleError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>
            <Show when={toggleStatus()}>
              {message => <p class="pm-market-feedback">{message()}</p>}
            </Show>
            <div class="pm-market-actions">
              <button class="pm-button pm-button--ghost" type="button" onClick={closeToggleModal} disabled={togglePending()}>
                Cancel
              </button>
              <button class="pm-button pm-button--primary" type="button" onClick={() => void runSelfServiceToggle()} disabled={togglePending()}>
                {togglePending()
                  ? "Submitting..."
                  : nextSelfServiceState()
                    ? "Enable self-service purchase"
                    : "Disable self-service purchase"}
              </button>
            </div>
          </Show>
        </div>
      </AdminModal>
    </>
  );
}
