import { createMemo, createSignal } from "solid-js";

import type { AdminAccessControlRoleWriteRequest } from "~/lib";

import RoleSelectorField, {
  KNOWN_ACCESS_CONTROL_ROLES,
  resolveRoleInput,
} from "./RoleSelectorField";

export type RoleAdministrationAction = "grant" | "revoke";

interface RoleAdministrationPanelProps {
  error?: string | null;
  onSubmit: (
    action: RoleAdministrationAction,
    payload: AdminAccessControlRoleWriteRequest,
  ) => Promise<void>;
  pending?: boolean;
}

export default function RoleAdministrationPanel(props: RoleAdministrationPanelProps) {
  const [action, setAction] = createSignal<RoleAdministrationAction>("grant");
  const [selectedRole, setSelectedRole] = createSignal<string>(KNOWN_ACCESS_CONTROL_ROLES[2]);
  const [customRole, setCustomRole] = createSignal("");
  const [accountAddress, setAccountAddress] = createSignal("");
  const [localError, setLocalError] = createSignal<string | null>(null);

  const roleValue = createMemo(() => resolveRoleInput(selectedRole(), customRole()));
  const endpoint = createMemo(() =>
    action() === "grant"
      ? "POST /admin/contracts/access-control/grant"
      : "POST /admin/contracts/access-control/revoke",
  );
  const title = createMemo(() => (action() === "grant" ? "Grant role" : "Revoke role"));
  const copy = createMemo(() =>
    action() === "grant"
      ? "Assign a role to an account using a canonical role label or a raw 0x-prefixed bytes32 value."
      : "Remove an existing role assignment from an account without switching to a separate form.",
  );
  const buttonLabel = createMemo(() =>
    action() === "grant"
      ? props.pending
        ? "Granting..."
        : "Grant role"
      : props.pending
        ? "Revoking..."
        : "Revoke role",
  );
  const errorMessage = createMemo(() => localError() ?? props.error ?? null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setLocalError(null);

    const role = roleValue();
    const account = accountAddress().trim();

    if (!role) {
      setLocalError("Role is required.");
      return;
    }

    if (!account) {
      setLocalError("Account address is required.");
      return;
    }

    await props.onSubmit(action(), {
      role,
      account_address: account,
    });
  }

  return (
    <section class="pm-market-card">
      <div class="pm-market-card__header">
        <div>
          <p class="pm-market-card__eyebrow">{endpoint()}</p>
          <h3 class="pm-market-card__title">Role administration</h3>
        </div>
        <span class="pm-market-card__hint">Admin only</span>
      </div>
      <p class="pm-market-card__copy">
        Choose the role mutation once, then submit a clean payload that matches the backend
        request shape exactly.
      </p>

      <form class="pm-market-form" onSubmit={handleSubmit}>
        <div class="pm-market-fields">
          <label class="pm-field">
            <span class="pm-field__label">Action</span>
            <select
              class="pm-field__input"
              value={action()}
              onChange={event =>
                setAction(event.currentTarget.value as RoleAdministrationAction)
              }
            >
              <option value="grant">Grant role</option>
              <option value="revoke">Revoke role</option>
            </select>
          </label>

          <RoleSelectorField
            selectedRole={selectedRole()}
            customRole={customRole()}
            onSelectedRoleChange={setSelectedRole}
            onCustomRoleInput={setCustomRole}
          />

          <label class="pm-field">
            <span class="pm-field__label">Account address</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="0x..."
              value={accountAddress()}
              onInput={event => setAccountAddress(event.currentTarget.value)}
            />
          </label>
        </div>

        <div class="pm-contract-workflow__meta">
          <span class="pm-market-chip">{title()}</span>
          <span class="pm-market-chip">{roleValue() || "Select a role"}</span>
          <span class="pm-market-chip">Request: {action()} + role + account_address</span>
        </div>

        <div class="pm-contract-workflow__summary">
          <p class="pm-contract-workflow__summary-title">{title()}</p>
          <p class="pm-contract-workflow__summary-copy">{copy()}</p>
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
