import { Show } from "solid-js";

import type { AssetRequestResponse, AssetRequestStatus } from "~/lib";

export interface AssetRequestStatusOption {
  value: AssetRequestStatus;
  label: string;
}

interface AssetRequestStatusPanelProps {
  requestId: string;
  request: AssetRequestResponse | null;
  status: AssetRequestStatus;
  statusOptions: AssetRequestStatusOption[];
  reviewNotes: string;
  pending: boolean;
  error?: string | null;
  onRequestIdInput: (value: string) => void;
  onStatusInput: (value: AssetRequestStatus) => void;
  onReviewNotesInput: (value: string) => void;
  onSubmit: () => void;
}

export default function AssetRequestStatusPanel(props: AssetRequestStatusPanelProps) {
  return (
    <div class="pm-asset-market__modal-stack">
      <form
        class="pm-market-form"
        onSubmit={event => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <div class="pm-market-fields">
          <label class="pm-field pm-field--full">
            <span class="pm-field__label">Request ID</span>
            <input
              class="pm-field__input"
              type="text"
              value={props.requestId}
              onInput={event => props.onRequestIdInput(event.currentTarget.value)}
              placeholder="UUID asset request identifier"
            />
          </label>

          <label class="pm-field">
            <span class="pm-field__label">Next status</span>
            <select
              class="pm-field__input"
              value={props.status}
              onInput={event =>
                props.onStatusInput(event.currentTarget.value as AssetRequestStatus)
              }
            >
              {props.statusOptions.map(option => (
                <option value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label class="pm-field pm-field--full">
            <span class="pm-field__label">Review notes</span>
            <textarea
              class="pm-field__textarea"
              rows="5"
              value={props.reviewNotes}
              onInput={event => props.onReviewNotesInput(event.currentTarget.value)}
              placeholder="Decision context, issuer follow-up, or approval conditions"
            />
          </label>
        </div>

        <Show when={props.request}>
          {request => (
            <div class="pm-admin-gate__session">
              <span class="pm-market-chip">{request().status}</span>
              <span class="pm-market-chip">{request().asset_name}</span>
              <span class="pm-market-chip">{request().issuer_name}</span>
            </div>
          )}
        </Show>

        <p class="pm-market-feedback">
          Use this flow for review decisions only. Rejecting a request requires review notes, and
          moving to deployed should normally happen through the dedicated deploy endpoint.
        </p>

        <Show when={props.error}>
          {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
        </Show>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {props.pending ? "Saving..." : "Save review status"}
          </button>
        </div>
      </form>
    </div>
  );
}
