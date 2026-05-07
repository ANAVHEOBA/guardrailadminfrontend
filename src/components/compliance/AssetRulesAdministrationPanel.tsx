import { createMemo, createSignal } from "solid-js";

import type { AdminSetComplianceAssetRulesRequest } from "~/lib";

interface AssetRulesAdministrationPanelProps {
  error?: string | null;
  onSubmit: (
    assetAddress: string,
    payload: AdminSetComplianceAssetRulesRequest,
  ) => Promise<void>;
  pending?: boolean;
}

export default function AssetRulesAdministrationPanel(
  props: AssetRulesAdministrationPanelProps,
) {
  const [assetAddress, setAssetAddress] = createSignal("");
  const [minInvestment, setMinInvestment] = createSignal("");
  const [maxInvestorBalance, setMaxInvestorBalance] = createSignal("");
  const [transfersEnabled, setTransfersEnabled] = createSignal(true);
  const [subscriptionsEnabled, setSubscriptionsEnabled] = createSignal(true);
  const [redemptionsEnabled, setRedemptionsEnabled] = createSignal(true);
  const [requiresAccreditation, setRequiresAccreditation] = createSignal(false);
  const [localError, setLocalError] = createSignal<string | null>(null);

  const posture = createMemo(() => {
    if (!subscriptionsEnabled()) {
      return "Subscriptions paused";
    }

    return requiresAccreditation() ? "Accredited access" : "Open eligibility";
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setLocalError(null);

    const normalizedAssetAddress = assetAddress().trim();
    const normalizedMinInvestment = minInvestment().trim();
    const normalizedMaxInvestorBalance = maxInvestorBalance().trim();

    if (!normalizedAssetAddress) {
      setLocalError("Asset address is required.");
      return;
    }

    if (!normalizedMinInvestment) {
      setLocalError("Min investment is required.");
      return;
    }

    if (!normalizedMaxInvestorBalance) {
      setLocalError("Max investor balance is required.");
      return;
    }

    await props.onSubmit(normalizedAssetAddress, {
      transfers_enabled: transfersEnabled(),
      subscriptions_enabled: subscriptionsEnabled(),
      redemptions_enabled: redemptionsEnabled(),
      requires_accreditation: requiresAccreditation(),
      min_investment: normalizedMinInvestment,
      max_investor_balance: normalizedMaxInvestorBalance,
    });
  }

  return (
    <section class="pm-market-card">
      <div class="pm-market-card__header">
        <div>
          <p class="pm-market-card__eyebrow">PUT /admin/compliance/assets/{'{asset}'}/rules</p>
          <h3 class="pm-market-card__title">Asset policy</h3>
        </div>
        <span class="pm-market-card__hint">Admin only</span>
      </div>
      <p class="pm-market-card__copy">
        Update the policy tuple the contract evaluates at buy, transfer, and redeem time. Numeric
        fields should be sent in raw contract units.
      </p>

      <form class="pm-market-form" onSubmit={handleSubmit}>
        <div class="pm-market-fields">
          <label class="pm-field pm-field--full">
            <span class="pm-field__label">Asset address</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="0x..."
              value={assetAddress()}
              onInput={event => setAssetAddress(event.currentTarget.value)}
            />
          </label>
          <label class="pm-field">
            <span class="pm-field__label">Min investment</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="1000000000000000000"
              value={minInvestment()}
              onInput={event => setMinInvestment(event.currentTarget.value)}
            />
          </label>
          <label class="pm-field">
            <span class="pm-field__label">Max investor balance</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="250000000000000000000000"
              value={maxInvestorBalance()}
              onInput={event => setMaxInvestorBalance(event.currentTarget.value)}
            />
          </label>
          <label class="pm-checkbox">
            <input
              type="checkbox"
              checked={transfersEnabled()}
              onChange={event => setTransfersEnabled(event.currentTarget.checked)}
            />
            <span>Transfers enabled</span>
          </label>
          <label class="pm-checkbox">
            <input
              type="checkbox"
              checked={subscriptionsEnabled()}
              onChange={event => setSubscriptionsEnabled(event.currentTarget.checked)}
            />
            <span>Subscriptions enabled</span>
          </label>
          <label class="pm-checkbox">
            <input
              type="checkbox"
              checked={redemptionsEnabled()}
              onChange={event => setRedemptionsEnabled(event.currentTarget.checked)}
            />
            <span>Redemptions enabled</span>
          </label>
          <label class="pm-checkbox">
            <input
              type="checkbox"
              checked={requiresAccreditation()}
              onChange={event => setRequiresAccreditation(event.currentTarget.checked)}
            />
            <span>Requires accreditation</span>
          </label>
        </div>

        <div class="pm-contract-workflow__meta">
          <span class="pm-market-chip">{posture()}</span>
          <span class="pm-market-chip">Request: rules tuple</span>
        </div>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {props.pending ? "Saving..." : "Set rules"}
          </button>
        </div>
      </form>

      {(localError() ?? props.error) && (
        <p class="pm-market-feedback pm-market-feedback--error">{localError() ?? props.error}</p>
      )}
    </section>
  );
}
