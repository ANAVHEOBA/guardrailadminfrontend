import { createMemo, createSignal } from "solid-js";

export type ProposalLifecycleAction = "sign" | "execute" | "cancel";

interface ProposalLifecyclePanelProps {
  error?: string | null;
  onSubmit: (action: ProposalLifecycleAction, proposalId: string) => Promise<void>;
  pending?: boolean;
}

export default function ProposalLifecyclePanel(props: ProposalLifecyclePanelProps) {
  const [action, setAction] = createSignal<ProposalLifecycleAction>("sign");
  const [proposalId, setProposalId] = createSignal("");
  const [localError, setLocalError] = createSignal<string | null>(null);

  const endpoint = createMemo(
    () => `POST /admin/contracts/multisig/proposals/{proposal_id}/${action()}`,
  );
  const buttonLabel = createMemo(() => {
    if (props.pending) {
      if (action() === "sign") {
        return "Signing...";
      }

      if (action() === "execute") {
        return "Executing...";
      }

      return "Cancelling...";
    }

    if (action() === "sign") {
      return "Sign proposal";
    }

    if (action() === "execute") {
      return "Execute proposal";
    }

    return "Cancel proposal";
  });
  const copy = createMemo(() => {
    if (action() === "sign") {
      return "Submit only the proposal_id path parameter to record a multisig signature.";
    }

    if (action() === "execute") {
      return "Submit only the proposal_id path parameter once quorum and timelock are satisfied.";
    }

    return "Submit only the proposal_id path parameter to cancel a proposal before execution.";
  });
  const errorMessage = createMemo(() => localError() ?? props.error ?? null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setLocalError(null);

    const normalizedProposalId = proposalId().trim();

    if (!normalizedProposalId) {
      setLocalError("Proposal ID is required.");
      return;
    }

    await props.onSubmit(action(), normalizedProposalId);
  }

  return (
    <section class="pm-market-card">
      <div class="pm-market-card__header">
        <div>
          <p class="pm-market-card__eyebrow">{endpoint()}</p>
          <h3 class="pm-market-card__title">Proposal lifecycle</h3>
        </div>
        <span class="pm-market-card__hint">Admin only</span>
      </div>
      <p class="pm-market-card__copy">
        Use one dropdown to decide the proposal action, then send the exact path-based request the
        backend expects.
      </p>

      <form class="pm-market-form" onSubmit={handleSubmit}>
        <div class="pm-market-fields">
          <label class="pm-field">
            <span class="pm-field__label">Action</span>
            <select
              class="pm-field__input"
              value={action()}
              onChange={event =>
                setAction(event.currentTarget.value as ProposalLifecycleAction)
              }
            >
              <option value="sign">Sign</option>
              <option value="execute">Execute</option>
              <option value="cancel">Cancel</option>
            </select>
          </label>
          <label class="pm-field">
            <span class="pm-field__label">Proposal ID</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="0"
              value={proposalId()}
              onInput={event => setProposalId(event.currentTarget.value)}
            />
          </label>
        </div>

        <div class="pm-contract-workflow__summary">
          <p class="pm-contract-workflow__summary-title">
            {action() === "sign"
              ? "Record a signer approval"
              : action() === "execute"
                ? "Execute a ready proposal"
                : "Cancel an open proposal"}
          </p>
          <p class="pm-contract-workflow__summary-copy">{copy()}</p>
        </div>

        <div class="pm-contract-workflow__meta">
          <span class="pm-market-chip">{action()}</span>
          <span class="pm-market-chip">Request: proposal_id path only</span>
        </div>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {buttonLabel()}
          </button>
        </div>
      </form>

      {errorMessage() && <p class="pm-market-feedback pm-market-feedback--error">{errorMessage()}</p>}
    </section>
  );
}
