import { createSignal } from "solid-js";

interface InvestorLookupPanelProps {
  error?: string | null;
  onSubmit: (wallet: string) => Promise<void>;
  pending?: boolean;
}

export default function InvestorLookupPanel(props: InvestorLookupPanelProps) {
  const [wallet, setWallet] = createSignal("");
  const [localError, setLocalError] = createSignal<string | null>(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setLocalError(null);

    const normalizedWallet = wallet().trim();
    if (!normalizedWallet) {
      setLocalError("Wallet is required.");
      return;
    }

    await props.onSubmit(normalizedWallet);
  }

  return (
    <section class="pm-market-card">
      <div class="pm-market-card__header">
        <div>
          <p class="pm-market-card__eyebrow">GET /compliance/investors/{'{wallet}'}</p>
          <h3 class="pm-market-card__title">Investor directory</h3>
        </div>
        <span class="pm-market-card__hint">Public</span>
      </div>
      <p class="pm-market-card__copy">
        Read the current investor profile for any wallet, including verification, freeze, validity,
        and derived whitelist state.
      </p>

      <form class="pm-market-form" onSubmit={handleSubmit}>
        <div class="pm-market-fields">
          <label class="pm-field pm-field--full">
            <span class="pm-field__label">Wallet</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="0x..."
              value={wallet()}
              onInput={event => setWallet(event.currentTarget.value)}
            />
          </label>
        </div>

        <div class="pm-contract-workflow__meta">
          <span class="pm-market-chip">Request: wallet</span>
          <span class="pm-market-chip">Live investor state</span>
        </div>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {props.pending ? "Fetching..." : "Fetch investor"}
          </button>
        </div>
      </form>

      {(localError() ?? props.error) && (
        <p class="pm-market-feedback pm-market-feedback--error">{localError() ?? props.error}</p>
      )}
    </section>
  );
}
