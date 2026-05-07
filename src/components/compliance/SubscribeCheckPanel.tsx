import { createSignal } from "solid-js";

import type { ComplianceCheckSubscribeRequest } from "~/lib";

interface SubscribeCheckPanelProps {
  error?: string | null;
  onSubmit: (request: ComplianceCheckSubscribeRequest) => Promise<void>;
  pending?: boolean;
}

export default function SubscribeCheckPanel(props: SubscribeCheckPanelProps) {
  const [assetAddress, setAssetAddress] = createSignal("");
  const [investorWallet, setInvestorWallet] = createSignal("");
  const [amount, setAmount] = createSignal("");
  const [resultingBalance, setResultingBalance] = createSignal("");
  const [localError, setLocalError] = createSignal<string | null>(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setLocalError(null);

    const payload = {
      asset_address: assetAddress().trim(),
      investor_wallet: investorWallet().trim(),
      amount: amount().trim(),
      resulting_balance: resultingBalance().trim(),
    };

    if (!payload.asset_address) {
      setLocalError("Asset address is required.");
      return;
    }

    if (!payload.investor_wallet) {
      setLocalError("Investor wallet is required.");
      return;
    }

    if (!payload.amount) {
      setLocalError("Amount is required.");
      return;
    }

    if (!payload.resulting_balance) {
      setLocalError("Resulting balance is required.");
      return;
    }

    await props.onSubmit(payload);
  }

  return (
    <section class="pm-market-card">
      <div class="pm-market-card__header">
        <div>
          <p class="pm-market-card__eyebrow">POST /compliance/check/subscribe</p>
          <h3 class="pm-market-card__title">Subscription check</h3>
        </div>
        <span class="pm-market-card__hint">Public</span>
      </div>
      <p class="pm-market-card__copy">
        Simulate whether a wallet can buy into an asset before you touch the admin tools. Use raw
        contract-unit amounts for the request.
      </p>

      <form class="pm-market-form" onSubmit={handleSubmit}>
        <div class="pm-market-fields">
          <label class="pm-field">
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
            <span class="pm-field__label">Investor wallet</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="0x..."
              value={investorWallet()}
              onInput={event => setInvestorWallet(event.currentTarget.value)}
            />
          </label>
          <label class="pm-field">
            <span class="pm-field__label">Amount</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="1000000000000000000"
              value={amount()}
              onInput={event => setAmount(event.currentTarget.value)}
            />
          </label>
          <label class="pm-field">
            <span class="pm-field__label">Resulting balance</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="1000000000000000000"
              value={resultingBalance()}
              onInput={event => setResultingBalance(event.currentTarget.value)}
            />
          </label>
        </div>

        <div class="pm-contract-workflow__summary">
          <p class="pm-contract-workflow__summary-title">Eligibility preview</p>
          <p class="pm-contract-workflow__summary-copy">
            Check the same public compliance decision path the backend uses before a purchase is
            submitted.
          </p>
        </div>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {props.pending ? "Checking..." : "Run check"}
          </button>
        </div>
      </form>

      {(localError() ?? props.error) && (
        <p class="pm-market-feedback pm-market-feedback--error">{localError() ?? props.error}</p>
      )}
    </section>
  );
}
