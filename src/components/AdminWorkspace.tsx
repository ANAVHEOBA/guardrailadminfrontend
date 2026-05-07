import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";

import type { AdminMeResponse } from "~/lib/admin";

type AdminDrawerView = "menu" | "manage_assets";

interface AdminWorkspaceProps {
  profile: AdminMeResponse;
  open: boolean;
  onClose: () => void;
  onOpenAssetManager: () => void;
  onOpenRedemptionManager: () => void;
  onOpenAssetRequestManager: () => void;
  onOpenComplianceManager: () => void;
  onOpenContractsManager: () => void;
  onOpenSystemManager: () => void;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4.5 4.5L13.5 13.5"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
      <path
        d="M13.5 4.5L4.5 13.5"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </svg>
  );
}

export default function AdminWorkspace(props: AdminWorkspaceProps) {
  const [activeView, setActiveView] = createSignal<AdminDrawerView>("menu");

  createEffect(() => {
    if (!props.open) {
      return;
    }

    setActiveView("menu");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const profile = () => props.profile;

  return (
    <Show when={props.open}>
      <div class="pm-admin-drawer__overlay" aria-hidden="true" onClick={props.onClose} />

      <aside
        class="pm-admin-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Admin drawer"
      >
        <header class="pm-admin-drawer__header">
          <div>
            <p class="pm-admin-drawer__eyebrow">Admin</p>
            <h2 class="pm-admin-drawer__title">Control panel</h2>
            <p class="pm-admin-drawer__copy">
              Manage assets, contracts, and operational admin workflows.
            </p>
          </div>

          <button
            class="pm-admin-drawer__close"
            type="button"
            aria-label="Close admin drawer"
            onClick={props.onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div class="pm-admin-drawer__identity">
          <span class="pm-market-chip">Monad #{profile().monad_chain_id}</span>
          <span class="pm-market-chip">
            {profile().user.wallet?.wallet_address ?? "Admin session"}
          </span>
        </div>

        <div class="pm-admin-drawer__stack">
          <button
            class="pm-admin-drawer__action pm-admin-drawer__action--primary"
            type="button"
            onClick={() => {
              props.onClose();
              props.onOpenAssetManager();
            }}
          >
            <span class="pm-admin-drawer__action-title">Manage Assets</span>
            <span class="pm-admin-drawer__action-copy">
              Create, register, and manage asset types and pricing.
            </span>
          </button>

          <button
            class="pm-admin-drawer__action pm-admin-drawer__action--primary"
            type="button"
            onClick={() => {
              props.onClose();
              props.onOpenRedemptionManager();
            }}
          >
            <span class="pm-admin-drawer__action-title">Review Redemptions</span>
            <span class="pm-admin-drawer__action-copy">
              Inspect the pending redemption queue for investors.
            </span>
          </button>

          <button
            class="pm-admin-drawer__action pm-admin-drawer__action--primary"
            type="button"
            onClick={() => {
              props.onClose();
              props.onOpenAssetRequestManager();
            }}
          >
            <span class="pm-admin-drawer__action-title">Asset Requests</span>
            <span class="pm-admin-drawer__action-copy">
              Review issuer submissions, change status, and deploy approved requests.
            </span>
          </button>

          <div class="pm-admin-drawer__group">
            <p class="pm-admin-drawer__group-label">Modules</p>

            <button
              class="pm-admin-drawer__action"
              type="button"
              onClick={() => {
                props.onClose();
                props.onOpenComplianceManager();
              }}
            >
              <span class="pm-admin-drawer__action-title">Compliance</span>
              <span class="pm-admin-drawer__action-copy">
                Investor rules, whitelisting, and policy management.
              </span>
            </button>

            <button
              class="pm-admin-drawer__action"
              type="button"
              onClick={() => {
                props.onClose();
                props.onOpenContractsManager();
              }}
            >
              <span class="pm-admin-drawer__action-title">Contracts</span>
              <span class="pm-admin-drawer__action-copy">
                Access control roles, multisig proposals, and signer operations.
              </span>
            </button>

            <button class="pm-admin-drawer__action" type="button" disabled>
              <span class="pm-admin-drawer__action-title">Treasury</span>
              <span class="pm-admin-drawer__action-copy">
                Liquidity controls, approvals, and pause management.
              </span>
            </button>

            <button class="pm-admin-drawer__action" type="button" disabled>
              <span class="pm-admin-drawer__action-title">Oracle</span>
              <span class="pm-admin-drawer__action-copy">
                Trusted oracle state and valuation submissions.
              </span>
            </button>

            <button
              class="pm-admin-drawer__action"
              type="button"
              onClick={() => {
                props.onClose();
                props.onOpenSystemManager();
              }}
            >
              <span class="pm-admin-drawer__action-title">System</span>
              <span class="pm-admin-drawer__action-copy">
                Health checks, admin bootstrap, profile reads, and uploads.
              </span>
            </button>
          </div>
        </div>
      </aside>
    </Show>
  );
}
