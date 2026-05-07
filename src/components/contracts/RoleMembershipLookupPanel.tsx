import { createMemo, createSignal } from "solid-js";

import type { AdminAccessControlRoleWriteRequest } from "~/lib";

import RoleSelectorField, {
  KNOWN_ACCESS_CONTROL_ROLES,
  resolveRoleInput,
} from "./RoleSelectorField";

interface RoleMembershipLookupPanelProps {
  error?: string | null;
  onSubmit: (payload: AdminAccessControlRoleWriteRequest) => Promise<void>;
  pending?: boolean;
}

export default function RoleMembershipLookupPanel(props: RoleMembershipLookupPanelProps) {
  const [selectedRole, setSelectedRole] = createSignal<string>(KNOWN_ACCESS_CONTROL_ROLES[2]);
  const [customRole, setCustomRole] = createSignal("");
  const [accountAddress, setAccountAddress] = createSignal("");
  const [localError, setLocalError] = createSignal<string | null>(null);

  const roleValue = createMemo(() => resolveRoleInput(selectedRole(), customRole()));
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

    await props.onSubmit({
      role,
      account_address: account,
    });
  }

  return (
    <section class="pm-market-card">
      <div class="pm-market-card__header">
        <div>
          <p class="pm-market-card__eyebrow">
            GET /admin/contracts/access-control/roles/{'{role}'}/accounts/{'{account}'}
          </p>
          <h3 class="pm-market-card__title">Role membership</h3>
        </div>
      </div>
      <p class="pm-market-card__copy">
        Select a role from the known contract set, or switch to a custom bytes32 role when needed.
      </p>

      <form class="pm-market-form" onSubmit={handleSubmit}>
        <div class="pm-market-fields">
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
          <span class="pm-market-chip">Lookup role: {roleValue() || "Select a role"}</span>
          <span class="pm-market-chip">Protected read</span>
        </div>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {props.pending ? "Checking..." : "Check membership"}
          </button>
        </div>
      </form>

      {errorMessage() && <p class="pm-market-feedback pm-market-feedback--error">{errorMessage()}</p>}
    </section>
  );
}
