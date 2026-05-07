import { createSignal } from "solid-js";

interface AssetRulesLookupPanelProps {
  error?: string | null;
  onSubmit: (assetAddress: string) => Promise<void>;
  pending?: boolean;
}

export default function AssetRulesLookupPanel(props: AssetRulesLookupPanelProps) {
  const [assetAddress, setAssetAddress] = createSignal("");
  const [localError, setLocalError] = createSignal<string | null>(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setLocalError(null);

    const normalizedAssetAddress = assetAddress().trim();
    if (!normalizedAssetAddress) {
      setLocalError("Asset address is required.");
      return;
    }

    await props.onSubmit(normalizedAssetAddress);
  }

  return (
    <section class="pm-market-card">
      <div class="pm-market-card__header">
        <div>
          <p class="pm-market-card__eyebrow">GET /compliance/assets/{'{asset}'}/rules</p>
          <h3 class="pm-market-card__title">Asset policy snapshot</h3>
        </div>
        <span class="pm-market-card__hint">Public</span>
      </div>
      <p class="pm-market-card__copy">
        Pull the active transfer, subscription, redemption, accreditation, and balance limits for a
        specific asset.
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
        </div>

        <div class="pm-contract-workflow__meta">
          <span class="pm-market-chip">Request: asset</span>
          <span class="pm-market-chip">Live rules</span>
        </div>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {props.pending ? "Fetching..." : "Fetch rules"}
          </button>
        </div>
      </form>

      {(localError() ?? props.error) && (
        <p class="pm-market-feedback pm-market-feedback--error">{localError() ?? props.error}</p>
      )}
    </section>
  );
}
