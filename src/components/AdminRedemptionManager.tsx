import { createSignal, For, Show } from "solid-js";

import { assetClient, readAdminToken } from "~/lib";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";

import { readRequiredText } from "./admin-form-utils";

const ASSET_TOKEN_DECIMALS = 18;

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatAssetAmount(value: string): string {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return value;
  }

  const digits = normalized.replace(/^0+/, "") || "0";

  if (digits.length <= ASSET_TOKEN_DECIMALS) {
    const fractional = digits
      .padStart(ASSET_TOKEN_DECIMALS, "0")
      .replace(/0+$/, "");

    return fractional.length > 0 ? `0.${fractional}` : "0";
  }

  const splitIndex = digits.length - ASSET_TOKEN_DECIMALS;
  const whole = digits.slice(0, splitIndex).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fractional = digits.slice(splitIndex).replace(/0+$/, "");

  return fractional.length > 0 ? `${whole}.${fractional}` : whole;
}

export default function AdminRedemptionManager() {
  const fetchPendingTask = useAsyncTask((token: string, assetAddress: string) =>
    assetClient.fetchPendingRedemptions(token, assetAddress),
  );
  const [lookupError, setLookupError] = createSignal<string | null>(null);

  const adminToken = () => readAdminToken();

  async function handleLookup(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setLookupError("Connect an admin wallet first.");
      return;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setLookupError(null);

    try {
      const assetAddress = readRequiredText(formData, "asset_address", "Asset address");
      await fetchPendingTask.run(token, assetAddress);
    } catch (error) {
      setLookupError(getErrorMessage(error));
    }
  }

  return (
    <div class="pm-tool-stack">
      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">Admin endpoint</p>
            <h2 class="pm-tool-section__title">Pending redemption queue</h2>
          </div>
          <p class="pm-admin-section-note">
            Review queued redemptions for an asset. This deployment currently exposes queue visibility,
            not manual admin settlement.
          </p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card pm-market-card--wide">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">
                  GET /admin/assets/{'{asset_address}'}/redemptions/pending
                </p>
                <h3 class="pm-market-card__title">Inspect pending redemptions</h3>
              </div>
              <span class="pm-market-card__hint">Admin only</span>
            </div>
            <p class="pm-market-card__copy">
              Pull the live pending-redemption queue for a single asset and identify the affected
              investors before you coordinate the user-side redeem flow.
            </p>
            <form class="pm-market-form" onSubmit={handleLookup}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Asset address</span>
                  <input
                    class="pm-field__input"
                    name="asset_address"
                    type="text"
                    placeholder="0x..."
                    required
                  />
                </label>
              </div>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={fetchPendingTask.pending() || !adminToken()}
                >
                  {fetchPendingTask.pending() ? "Loading..." : "Load pending queue"}
                </button>
              </div>
            </form>
            <p class="pm-market-feedback">
              Manual processing is intentionally disabled by the backend for this asset flow, so this
              screen stays read-only.
            </p>
            <Show when={lookupError()}>
              <p class="pm-market-feedback pm-market-feedback--error">{lookupError()}</p>
            </Show>
          </section>
        </div>
      </div>

      <Show when={fetchPendingTask.data()}>
        {data => (
          <div class="pm-tool-section">
            <div class="pm-tool-section__header">
              <div>
                <h2 class="pm-tool-section__title">
                  {data().asset_name} ({data().asset_symbol})
                </h2>
              </div>
              <p class="pm-admin-section-note">
                Total pending: {formatAssetAmount(data().total_pending_redemptions)} tokens
              </p>
            </div>

            <p class="pm-market-feedback">
              The backend assembles this queue from live holder state. The observed timestamp below is
              when the queue entry was reported, not a settlement confirmation.
            </p>

            <Show
              when={data().pending_redemptions.length > 0}
              fallback={
                <div class="pm-home__state">
                  <p class="pm-home__state-title">No pending redemptions</p>
                  <p class="pm-home__state-copy">There are no pending redemptions for this asset.</p>
                </div>
              }
            >
              <div class="pm-tool-section__grid">
                <For each={data().pending_redemptions}>
                  {redemption => (
                    <section class="pm-market-card">
                      <div class="pm-market-card__header">
                        <div>
                          <h3 class="pm-market-card__title">
                            {redemption.display_name || redemption.email || "Unknown investor"}
                          </h3>
                          <Show when={redemption.email}>
                            <p class="pm-market-card__copy" style="margin-top: 4px;">
                              {redemption.email}
                            </p>
                          </Show>
                        </div>
                        <span class="pm-market-card__hint">Queued</span>
                      </div>

                      <div class="pm-market-result">
                        <div class="pm-market-result__grid">
                          <div class="pm-market-result__detail--full">
                            <span class="pm-market-result__label">Wallet address</span>
                            <span
                              class="pm-market-result__value"
                              style="font-size: 12px; word-break: break-all;"
                            >
                              {redemption.wallet_address}
                            </span>
                          </div>
                          <div>
                            <span class="pm-market-result__label">Pending amount</span>
                            <span
                              class="pm-market-result__value"
                              style="color: var(--pm-accent); font-weight: 600;"
                            >
                              {formatAssetAmount(redemption.pending_amount)} tokens
                            </span>
                          </div>
                          <div>
                            <span class="pm-market-result__label">Observed</span>
                            <span class="pm-market-result__value">
                              {formatTimestamp(redemption.last_redemption_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
