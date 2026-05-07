import { createMemo, createSignal } from "solid-js";

export type WhitelistAction = "add" | "remove";

interface WhitelistActionPanelProps {
  error?: string | null;
  onSubmit: (action: WhitelistAction, wallet: string) => Promise<void>;
  pending?: boolean;
}

export default function WhitelistActionPanel(props: WhitelistActionPanelProps) {
  const [action, setAction] = createSignal<WhitelistAction>("add");
  const [wallet, setWallet] = createSignal("");
  const [localError, setLocalError] = createSignal<string | null>(null);

  const endpoint = createMemo(() =>
    action() === "add"
      ? "POST /admin/compliance/investors/{wallet}/whitelist"
      : "DELETE /admin/compliance/investors/{wallet}/whitelist",
  );
  const title = createMemo(() => (action() === "add" ? "Add to whitelist" : "Remove from whitelist"));
  const copy = createMemo(() =>
    action() === "add"
      ? "Explicitly allow an investor wallet through the whitelist path when you need direct operator control."
      : "Remove direct whitelist eligibility from a wallet without changing the rest of the investor profile.",
  );

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setLocalError(null);

    const normalizedWallet = wallet().trim();
    if (!normalizedWallet) {
      setLocalError("Wallet is required.");
      return;
    }

    await props.onSubmit(action(), normalizedWallet);
  }

  return (
    <section class="pm-market-card">
      <div class="pm-market-card__header">
        <div>
          <p class="pm-market-card__eyebrow">{endpoint()}</p>
          <h3 class="pm-market-card__title">Whitelist operations</h3>
        </div>
        <span class="pm-market-card__hint">Admin only</span>
      </div>
      <p class="pm-market-card__copy">
        Use the dedicated whitelist endpoints when you need a direct add/remove action instead of a
        broader investor-profile update.
      </p>

      <form class="pm-market-form" onSubmit={handleSubmit}>
        <div class="pm-market-fields">
          <label class="pm-field">
            <span class="pm-field__label">Action</span>
            <select
              class="pm-field__input"
              value={action()}
              onChange={event => setAction(event.currentTarget.value as WhitelistAction)}
            >
              <option value="add">Add to whitelist</option>
              <option value="remove">Remove from whitelist</option>
            </select>
          </label>
          <label class="pm-field">
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

        <div class="pm-contract-workflow__summary">
          <p class="pm-contract-workflow__summary-title">{title()}</p>
          <p class="pm-contract-workflow__summary-copy">{copy()}</p>
        </div>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {props.pending ? "Submitting..." : title()}
          </button>
        </div>
      </form>

      {(localError() ?? props.error) && (
        <p class="pm-market-feedback pm-market-feedback--error">{localError() ?? props.error}</p>
      )}
    </section>
  );
}
