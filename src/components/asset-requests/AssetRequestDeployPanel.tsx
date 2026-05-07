import { Show } from "solid-js";

import type { AssetRequestResponse } from "~/lib";

interface AssetRequestDeployPanelProps {
  requestId: string;
  request: AssetRequestResponse | null;
  pending: boolean;
  error?: string | null;
  onRequestIdInput: (value: string) => void;
  onSubmit: () => void;
}

export default function AssetRequestDeployPanel(props: AssetRequestDeployPanelProps) {
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
        </div>

        <Show when={props.request}>
          {request => (
            <div class="pm-admin-gate__session">
              <span class="pm-market-chip">{request().status}</span>
              <span class="pm-market-chip">{request().asset_name}</span>
              <span class="pm-market-chip">{request().proposal_id}</span>
            </div>
          )}
        </Show>

        <p class="pm-market-feedback">
          Deployment will either create the asset from the approved request or attach to an
          existing asset found by proposal ID. Requests that are still submitted, under review, or
          rejected will be blocked by the backend.
        </p>

        <Show when={props.error}>
          {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
        </Show>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {props.pending ? "Deploying..." : "Deploy request"}
          </button>
        </div>
      </form>
    </div>
  );
}
