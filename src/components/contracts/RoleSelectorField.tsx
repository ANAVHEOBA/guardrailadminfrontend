import { For, Show } from "solid-js";

export const KNOWN_ACCESS_CONTROL_ROLES = [
  "DEFAULT_ADMIN_ROLE",
  "ADMIN_ROLE",
  "ISSUER_ROLE",
  "COMPLIANCE_ROLE",
  "ORACLE_ROLE",
  "OPERATOR_ROLE",
  "PAUSER_ROLE",
  "TREASURY_ROLE",
] as const;

export const CUSTOM_ROLE_OPTION = "__custom_role__";

interface RoleSelectorFieldProps {
  customRole: string;
  label?: string;
  selectedRole: string;
  onCustomRoleInput: (value: string) => void;
  onSelectedRoleChange: (value: string) => void;
}

export function resolveRoleInput(selectedRole: string, customRole: string) {
  if (selectedRole === CUSTOM_ROLE_OPTION) {
    return customRole.trim();
  }

  return selectedRole.trim();
}

export default function RoleSelectorField(props: RoleSelectorFieldProps) {
  return (
    <>
      <label class="pm-field">
        <span class="pm-field__label">{props.label ?? "Role"}</span>
        <select
          class="pm-field__input"
          value={props.selectedRole}
          onChange={event => props.onSelectedRoleChange(event.currentTarget.value)}
        >
          <For each={KNOWN_ACCESS_CONTROL_ROLES}>
            {role => <option value={role}>{role}</option>}
          </For>
          <option value={CUSTOM_ROLE_OPTION}>Custom bytes32 role</option>
        </select>
      </label>

      <Show when={props.selectedRole === CUSTOM_ROLE_OPTION}>
        <label class="pm-field pm-field--full">
          <span class="pm-field__label">Custom role hex</span>
          <input
            class="pm-field__input"
            type="text"
            placeholder="0x..."
            value={props.customRole}
            onInput={event => props.onCustomRoleInput(event.currentTarget.value)}
          />
          <span class="pm-contract-workflow__hint">
            Provide the full 0x-prefixed bytes32 role value expected by the backend.
          </span>
        </label>
      </Show>
    </>
  );
}
