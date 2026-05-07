import { createMemo, createSignal } from "solid-js";

import type {
  AdminMultiSigProposalRequest,
  AdminMultiSigQuorumWriteRequest,
  AdminMultiSigSignerWriteRequest,
} from "~/lib";

export type MultisigComposeMode =
  | "raw_transaction"
  | "add_signer"
  | "remove_signer"
  | "update_quorum";

export type MultisigComposeSubmission =
  | {
      mode: "raw_transaction";
      payload: AdminMultiSigProposalRequest;
    }
  | {
      mode: "add_signer" | "remove_signer";
      payload: AdminMultiSigSignerWriteRequest;
    }
  | {
      mode: "update_quorum";
      payload: AdminMultiSigQuorumWriteRequest;
    };

interface MultisigComposePanelProps {
  error?: string | null;
  onSubmit: (submission: MultisigComposeSubmission) => Promise<void>;
  pending?: boolean;
}

function readModeConfig(mode: MultisigComposeMode) {
  switch (mode) {
    case "raw_transaction":
      return {
        endpoint: "POST /admin/contracts/multisig/proposals",
        title: "Propose raw transaction",
        copy:
          "Send the backend its native raw proposal payload: target, calldata, and an optional value.",
        buttonLabel: "Create proposal",
      };
    case "add_signer":
      return {
        endpoint: "POST /admin/contracts/multisig/signers/add",
        title: "Propose signer addition",
        copy:
          "Encode an `addSigner` self-call and submit only the signer_address expected by the backend.",
        buttonLabel: "Propose add signer",
      };
    case "remove_signer":
      return {
        endpoint: "POST /admin/contracts/multisig/signers/remove",
        title: "Propose signer removal",
        copy:
          "Encode a `removeSigner` self-call and submit only the signer_address expected by the backend.",
        buttonLabel: "Propose remove signer",
      };
    case "update_quorum":
      return {
        endpoint: "POST /admin/contracts/multisig/quorum",
        title: "Propose quorum update",
        copy:
          "Encode an `updateQuorum` self-call and submit only the quorum value expected by the backend.",
        buttonLabel: "Propose quorum",
      };
  }
}

export default function MultisigComposePanel(props: MultisigComposePanelProps) {
  const [mode, setMode] = createSignal<MultisigComposeMode>("raw_transaction");
  const [target, setTarget] = createSignal("");
  const [value, setValue] = createSignal("0");
  const [data, setData] = createSignal("");
  const [signerAddress, setSignerAddress] = createSignal("");
  const [quorum, setQuorum] = createSignal("2");
  const [localError, setLocalError] = createSignal<string | null>(null);

  const config = createMemo(() => readModeConfig(mode()));
  const errorMessage = createMemo(() => localError() ?? props.error ?? null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setLocalError(null);

    if (mode() === "raw_transaction") {
      const normalizedTarget = target().trim();
      const normalizedData = data().trim();
      const normalizedValue = value().trim();

      if (!normalizedTarget) {
        setLocalError("Target is required.");
        return;
      }

      if (!normalizedData) {
        setLocalError("Call data is required.");
        return;
      }

      await props.onSubmit({
        mode: "raw_transaction",
        payload: {
          target: normalizedTarget,
          data: normalizedData,
          value: normalizedValue ? normalizedValue : null,
        },
      });
      return;
    }

    if (mode() === "update_quorum") {
      const normalizedQuorum = quorum().trim();

      if (!normalizedQuorum) {
        setLocalError("Quorum is required.");
        return;
      }

      await props.onSubmit({
        mode: "update_quorum",
        payload: { quorum: normalizedQuorum },
      });
      return;
    }

    const normalizedSigner = signerAddress().trim();

    if (!normalizedSigner) {
      setLocalError("Signer address is required.");
      return;
    }

    await props.onSubmit({
      mode: mode(),
      payload: { signer_address: normalizedSigner },
    });
  }

  return (
    <section class="pm-market-card">
      <div class="pm-market-card__header">
        <div>
          <p class="pm-market-card__eyebrow">{config().endpoint}</p>
          <h3 class="pm-market-card__title">Compose multisig proposals</h3>
        </div>
        <span class="pm-market-card__hint">Admin only</span>
      </div>
      <p class="pm-market-card__copy">
        Pick one proposal mode at a time so the form only shows the fields the backend actually
        accepts for that endpoint.
      </p>

      <form class="pm-market-form" onSubmit={handleSubmit}>
        <div class="pm-market-fields">
          <label class="pm-field">
            <span class="pm-field__label">Proposal mode</span>
            <select
              class="pm-field__input"
              value={mode()}
              onChange={event => setMode(event.currentTarget.value as MultisigComposeMode)}
            >
              <option value="raw_transaction">Raw transaction</option>
              <option value="add_signer">Add signer</option>
              <option value="remove_signer">Remove signer</option>
              <option value="update_quorum">Update quorum</option>
            </select>
          </label>
        </div>

        <div class="pm-contract-workflow__summary">
          <p class="pm-contract-workflow__summary-title">{config().title}</p>
          <p class="pm-contract-workflow__summary-copy">{config().copy}</p>
        </div>

        <div class="pm-market-fields">
          {mode() === "raw_transaction" && (
            <>
              <label class="pm-field">
                <span class="pm-field__label">Target</span>
                <input
                  class="pm-field__input"
                  type="text"
                  placeholder="0x..."
                  value={target()}
                  onInput={event => setTarget(event.currentTarget.value)}
                />
              </label>
              <label class="pm-field">
                <span class="pm-field__label">Value</span>
                <input
                  class="pm-field__input"
                  type="text"
                  placeholder="0"
                  value={value()}
                  onInput={event => setValue(event.currentTarget.value)}
                />
              </label>
              <label class="pm-field pm-field--full">
                <span class="pm-field__label">Call data</span>
                <textarea
                  class="pm-field__textarea"
                  rows="5"
                  placeholder="0x..."
                  value={data()}
                  onInput={event => setData(event.currentTarget.value)}
                />
              </label>
            </>
          )}

          {(mode() === "add_signer" || mode() === "remove_signer") && (
            <label class="pm-field pm-field--full">
              <span class="pm-field__label">Signer address</span>
              <input
                class="pm-field__input"
                type="text"
                placeholder="0x..."
                value={signerAddress()}
                onInput={event => setSignerAddress(event.currentTarget.value)}
              />
            </label>
          )}

          {mode() === "update_quorum" && (
            <label class="pm-field pm-field--full">
              <span class="pm-field__label">New quorum</span>
              <input
                class="pm-field__input"
                type="text"
                placeholder="2"
                value={quorum()}
                onInput={event => setQuorum(event.currentTarget.value)}
              />
            </label>
          )}
        </div>

        <div class="pm-contract-workflow__meta">
          <span class="pm-market-chip">{config().title}</span>
          <span class="pm-market-chip">
            {mode() === "raw_transaction"
              ? "Request: target + data + optional value"
              : mode() === "update_quorum"
                ? "Request: quorum"
                : "Request: signer_address"}
          </span>
        </div>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {props.pending ? "Submitting..." : config().buttonLabel}
          </button>
        </div>
      </form>

      {errorMessage() && <p class="pm-market-feedback pm-market-feedback--error">{errorMessage()}</p>}
    </section>
  );
}
