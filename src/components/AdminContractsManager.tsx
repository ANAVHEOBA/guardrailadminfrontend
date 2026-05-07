import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
} from "solid-js";

import {
  contractsClient,
  readAdminToken,
  type AdminAccessControlRoleMembershipResponse,
  type AdminAccessControlRoleWriteRequest,
  type AdminAccessControlRoleWriteResponse,
  type AdminMultiSigProposalRequest,
  type AdminMultiSigProposalResponse,
  type AdminMultiSigProposalSignatureResponse,
  type AdminMultiSigQuorumWriteRequest,
  type AdminMultiSigSignerWriteRequest,
} from "~/lib";
import { useAdminAuth } from "~/lib/admin-auth-context";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";
import { shortenWalletAddress } from "~/lib/wallet/ethereum";

import AdminModal from "./AdminModal";
import {
  MultisigComposePanel,
  RoleAdministrationPanel,
  RoleMembershipLookupPanel,
  type MultisigComposeSubmission,
  type ProposalLifecycleAction,
  type RoleAdministrationAction,
  ProposalLifecyclePanel,
} from "./contracts";
import { readRequiredText } from "./admin-form-utils";

type ContractsModalView =
  | "access-directory"
  | "role-administration"
  | "multisig-desk"
  | "multisig-compose"
  | "proposal-actions";

interface ActionCardProps {
  actionLabel: string;
  endpoint: string;
  title: string;
  copy: string;
  detail: string;
  onOpen: () => void;
  tone?: "default" | "admin";
}

function formatWalletLabel(walletAddress: string | null | undefined) {
  if (!walletAddress) {
    return "Admin wallet";
  }

  return shortenWalletAddress(walletAddress);
}

function formatUnixTimestampLabel(value: number | null | undefined) {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return "Not set";
  }

  const parsed = new Date(value * 1000);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString();
}

function readProposalStatusLabel(proposal: AdminMultiSigProposalResponse) {
  if (proposal.executed) {
    return "Executed";
  }

  if (proposal.cancelled) {
    return "Cancelled";
  }

  if (proposal.ready_to_execute) {
    return "Ready";
  }

  return "Pending";
}

function ActionCard(props: ActionCardProps) {
  return (
    <button
      class={`pm-asset-action-card${
        props.tone === "admin" ? " pm-asset-action-card--admin" : ""
      }`}
      type="button"
      onClick={props.onOpen}
    >
      <div class="pm-asset-action-card__header">
        <p class="pm-asset-action-card__eyebrow">{props.endpoint}</p>
        <span class="pm-asset-action-card__pill">{props.actionLabel}</span>
      </div>

      <div class="pm-asset-action-card__body">
        <h3 class="pm-asset-action-card__title">{props.title}</h3>
        <p class="pm-asset-action-card__copy">{props.copy}</p>
      </div>

      <div class="pm-asset-action-card__footer">
        <span class="pm-asset-action-card__detail">{props.detail}</span>
        <span class="pm-asset-action-card__cta">Launch</span>
      </div>
    </button>
  );
}

function DashboardStat(props: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div class="pm-asset-admin__stat">
      <span class="pm-asset-admin__stat-label">{props.label}</span>
      <strong class="pm-asset-admin__stat-value">{props.value}</strong>
      <span class="pm-asset-admin__stat-meta">{props.meta}</span>
    </div>
  );
}

function ControlFact(props: {
  label: string;
  value: string;
  meta?: string;
  shorten?: boolean;
}) {
  const shouldShorten = () => props.shorten ?? props.value.startsWith("0x");

  return (
    <div class="pm-asset-admin__fact-card">
      <span class="pm-asset-admin__fact-label">{props.label}</span>
      <strong class="pm-asset-admin__fact-value" title={props.value}>
        {shouldShorten() ? shortenWalletAddress(props.value) : props.value}
      </strong>
      <span class="pm-asset-admin__fact-meta">{props.meta ?? props.value}</span>
    </div>
  );
}

function AdminGate(props: {
  connected: boolean;
  walletLabel: string;
  onConnect: () => void;
  children: JSX.Element;
}) {
  return (
    <Show
      when={props.connected}
      fallback={
        <section class="pm-admin-gate">
          <div>
            <p class="pm-admin-gate__eyebrow">Admin authentication required</p>
            <h3 class="pm-admin-gate__title">Connect an allowlisted wallet</h3>
            <p class="pm-admin-gate__copy">
              Contract governance endpoints stay protected until an admin wallet challenge is
              completed.
            </p>
          </div>

          <div class="pm-admin-gate__actions">
            <button class="pm-button pm-button--primary" type="button" onClick={props.onConnect}>
              Connect admin wallet
            </button>
          </div>
        </section>
      }
    >
      <div class="pm-admin-gate__session">
        <span class="pm-market-chip">Authenticated</span>
        <span class="pm-market-chip">{props.walletLabel}</span>
      </div>
      {props.children}
    </Show>
  );
}

function RoleMembershipResult(props: {
  data: AdminAccessControlRoleMembershipResponse;
  eyebrow: string;
}) {
  return (
    <div class="pm-market-result">
      <div class="pm-market-result__header">
        <div>
          <p class="pm-market-result__eyebrow">{props.eyebrow}</p>
          <h3 class="pm-market-result__title">{props.data.role}</h3>
        </div>
        <span class="pm-market-result__badge">
          {props.data.has_role ? "Assigned" : "Not assigned"}
        </span>
      </div>

      <div class="pm-market-result__grid">
        <div>
          <span class="pm-market-result__label">Access control</span>
          <span class="pm-market-result__value">{props.data.access_control_address}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Account</span>
          <span class="pm-market-result__value">{props.data.account_address}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Role hex</span>
          <span class="pm-market-result__value">{props.data.role_hex}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Admin role</span>
          <span class="pm-market-result__value">{props.data.admin_role}</span>
          <span class="pm-market-result__subvalue">{props.data.admin_role_hex}</span>
        </div>
      </div>
    </div>
  );
}

function RoleWriteResult(props: {
  data: AdminAccessControlRoleWriteResponse;
}) {
  return (
    <div class="pm-market-result">
      <div class="pm-market-result__header">
        <div>
          <p class="pm-market-result__eyebrow">Role mutation confirmed</p>
          <h3 class="pm-market-result__title">{props.data.membership.role}</h3>
        </div>
        <span class="pm-market-result__badge">
          {props.data.action === "granted" ? "Granted" : "Revoked"}
        </span>
      </div>

      <div class="pm-market-result__grid">
        <div>
          <span class="pm-market-result__label">Transaction</span>
          <span class="pm-market-result__value">{props.data.tx_hash}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Account</span>
          <span class="pm-market-result__value">{props.data.membership.account_address}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Role</span>
          <span class="pm-market-result__value">{props.data.membership.role}</span>
          <span class="pm-market-result__subvalue">{props.data.membership.role_hex}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Admin role</span>
          <span class="pm-market-result__value">{props.data.membership.admin_role}</span>
          <span class="pm-market-result__subvalue">{props.data.membership.admin_role_hex}</span>
        </div>
      </div>
    </div>
  );
}

function ProposalSummary(props: {
  eyebrow: string;
  title: string;
  proposal: AdminMultiSigProposalResponse;
  txHash?: string | null;
}) {
  return (
    <div class="pm-market-result">
      <div class="pm-market-result__header">
        <div>
          <p class="pm-market-result__eyebrow">{props.eyebrow}</p>
          <h3 class="pm-market-result__title">{props.title}</h3>
        </div>
        <div class="pm-asset-modal__chips">
          <span class="pm-market-chip">{readProposalStatusLabel(props.proposal)}</span>
          <span class="pm-market-chip">{props.proposal.signatures_count} signatures</span>
        </div>
      </div>

      <div class="pm-market-result__grid">
        <div>
          <span class="pm-market-result__label">Proposal ID</span>
          <span class="pm-market-result__value">{props.proposal.proposal_id}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Proposer</span>
          <span class="pm-market-result__value">{props.proposal.proposer}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Target</span>
          <span class="pm-market-result__value">{props.proposal.target}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Value</span>
          <span class="pm-market-result__value">{props.proposal.value}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Timelock until</span>
          <span class="pm-market-result__value">
            {formatUnixTimestampLabel(props.proposal.timelock_until)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Expires at</span>
          <span class="pm-market-result__value">
            {formatUnixTimestampLabel(props.proposal.expires_at)}
          </span>
        </div>
        <Show when={props.txHash}>
          {txHash => (
            <div class="pm-market-result__detail--full">
              <span class="pm-market-result__label">Transaction</span>
              <span class="pm-market-result__value">{txHash()}</span>
            </div>
          )}
        </Show>
        <div class="pm-market-result__detail--full">
          <span class="pm-market-result__label">Proposal hash</span>
          <span class="pm-market-result__value">{props.proposal.proposal_hash}</span>
        </div>
        <div class="pm-market-result__detail--full">
          <span class="pm-market-result__label">Call data</span>
          <span class="pm-market-result__value">{props.proposal.data}</span>
        </div>
      </div>
    </div>
  );
}

function SignatureResult(props: {
  data: AdminMultiSigProposalSignatureResponse;
}) {
  return (
    <div class="pm-market-result">
      <div class="pm-market-result__header">
        <div>
          <p class="pm-market-result__eyebrow">Signer state</p>
          <h3 class="pm-market-result__title">{props.data.signer_address}</h3>
        </div>
        <span class="pm-market-result__badge">
          {props.data.has_signed ? "Signed" : "Missing signature"}
        </span>
      </div>

      <div class="pm-market-result__grid">
        <div>
          <span class="pm-market-result__label">Multisig</span>
          <span class="pm-market-result__value">{props.data.multisig_address}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Proposal ID</span>
          <span class="pm-market-result__value">{props.data.proposal_id}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminContractsManager() {
  const auth = useAdminAuth();
  const accessControlOverviewTask = useAsyncTask((token: string) =>
    contractsClient.fetchAccessControlOverview(token),
  );
  const roleMembershipTask = useAsyncTask((token: string, role: string, account: string) =>
    contractsClient.fetchAccessControlRoleMembership(token, role, account),
  );
  const grantRoleTask = useAsyncTask(
    (token: string, payload: AdminAccessControlRoleWriteRequest) =>
      contractsClient.grantAccessControlRole(token, payload),
  );
  const revokeRoleTask = useAsyncTask(
    (token: string, payload: AdminAccessControlRoleWriteRequest) =>
      contractsClient.revokeAccessControlRole(token, payload),
  );
  const multisigOverviewTask = useAsyncTask((token: string) =>
    contractsClient.fetchMultisigOverview(token),
  );
  const proposalTask = useAsyncTask((token: string, proposalId: string) =>
    contractsClient.fetchMultisigProposal(token, proposalId),
  );
  const signatureTask = useAsyncTask((token: string, proposalId: string, signer: string) =>
    contractsClient.fetchMultisigProposalSignature(token, proposalId, signer),
  );
  const proposeTransactionTask = useAsyncTask(
    (token: string, payload: AdminMultiSigProposalRequest) =>
      contractsClient.proposeMultisigTransaction(token, payload),
  );
  const addSignerTask = useAsyncTask(
    (token: string, payload: AdminMultiSigSignerWriteRequest) =>
      contractsClient.proposeAddMultisigSigner(token, payload),
  );
  const removeSignerTask = useAsyncTask(
    (token: string, payload: AdminMultiSigSignerWriteRequest) =>
      contractsClient.proposeRemoveMultisigSigner(token, payload),
  );
  const updateQuorumTask = useAsyncTask(
    (token: string, payload: AdminMultiSigQuorumWriteRequest) =>
      contractsClient.proposeUpdateMultisigQuorum(token, payload),
  );
  const signProposalTask = useAsyncTask((token: string, proposalId: string) =>
    contractsClient.signMultisigProposal(token, proposalId),
  );
  const executeProposalTask = useAsyncTask((token: string, proposalId: string) =>
    contractsClient.executeMultisigProposal(token, proposalId),
  );
  const cancelProposalTask = useAsyncTask((token: string, proposalId: string) =>
    contractsClient.cancelMultisigProposal(token, proposalId),
  );

  const [activeModal, setActiveModal] = createSignal<ContractsModalView | null>(null);
  const [roleMembershipError, setRoleMembershipError] = createSignal<string | null>(null);
  const [grantRoleError, setGrantRoleError] = createSignal<string | null>(null);
  const [revokeRoleError, setRevokeRoleError] = createSignal<string | null>(null);
  const [proposalLookupError, setProposalLookupError] = createSignal<string | null>(null);
  const [signatureLookupError, setSignatureLookupError] = createSignal<string | null>(null);
  const [proposeTransactionError, setProposeTransactionError] = createSignal<string | null>(null);
  const [addSignerError, setAddSignerError] = createSignal<string | null>(null);
  const [removeSignerError, setRemoveSignerError] = createSignal<string | null>(null);
  const [updateQuorumError, setUpdateQuorumError] = createSignal<string | null>(null);
  const [proposalActionError, setProposalActionError] = createSignal<string | null>(null);
  const [bootstrappedToken, setBootstrappedToken] = createSignal<string | null>(null);

  const adminToken = () => readAdminToken();
  const isAdminConnected = () => Boolean(auth.profile() && adminToken());
  const adminWalletLabel = () => formatWalletLabel(auth.profile()?.user.wallet?.wallet_address);

  const latestComposedProposal = createMemo(
    () =>
      proposeTransactionTask.data() ??
      addSignerTask.data() ??
      removeSignerTask.data() ??
      updateQuorumTask.data() ??
      null,
  );
  const latestProposalAction = createMemo(
    () => signProposalTask.data() ?? executeProposalTask.data() ?? cancelProposalTask.data() ?? null,
  );
  const latestProposal = createMemo(
    () => proposalTask.data() ?? latestProposalAction()?.proposal ?? latestComposedProposal()?.proposal ?? null,
  );

  async function refreshAccessControlOverview(token = adminToken()) {
    if (!token) {
      return;
    }

    try {
      await accessControlOverviewTask.run(token);
    } catch {
      // Keep the last successful snapshot visible.
    }
  }

  async function refreshMultisigOverview(token = adminToken()) {
    if (!token) {
      return;
    }

    try {
      await multisigOverviewTask.run(token);
    } catch {
      // Keep the last successful snapshot visible.
    }
  }

  function openModal(view: ContractsModalView) {
    if (view === "access-directory") {
      setRoleMembershipError(null);
      void refreshAccessControlOverview();
    }

    if (view === "role-administration") {
      setGrantRoleError(null);
      setRevokeRoleError(null);
    }

    if (view === "multisig-desk") {
      setProposalLookupError(null);
      setSignatureLookupError(null);
      void refreshMultisigOverview();
    }

    if (view === "multisig-compose") {
      setProposeTransactionError(null);
      setAddSignerError(null);
      setRemoveSignerError(null);
      setUpdateQuorumError(null);
    }

    if (view === "proposal-actions") {
      setProposalActionError(null);
    }

    setActiveModal(view);
  }

  createEffect(() => {
    const token = adminToken();

    if (!token) {
      setBootstrappedToken(null);
      return;
    }

    if (bootstrappedToken() === token) {
      return;
    }

    setBootstrappedToken(token);
    void refreshAccessControlOverview(token);
    void refreshMultisigOverview(token);
  });

  async function handleRoleMembershipLookup(payload: AdminAccessControlRoleWriteRequest) {
    const token = adminToken();

    if (!token) {
      setRoleMembershipError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    setRoleMembershipError(null);

    try {
      await roleMembershipTask.run(token, payload.role, payload.account_address);
    } catch (error) {
      setRoleMembershipError(getErrorMessage(error));
    }
  }

  async function handleRoleWrite(
    kind: RoleAdministrationAction,
    payload: AdminAccessControlRoleWriteRequest,
  ) {
    const token = adminToken();

    if (!token) {
      if (kind === "grant") {
        setGrantRoleError("Connect an admin wallet first.");
      } else {
        setRevokeRoleError("Connect an admin wallet first.");
      }
      auth.openAuthDialog();
      return;
    }

    if (kind === "grant") {
      setGrantRoleError(null);

      try {
        await grantRoleTask.run(token, payload);
        void refreshAccessControlOverview(token);
      } catch (error) {
        setGrantRoleError(getErrorMessage(error));
      }

      return;
    }

    setRevokeRoleError(null);

    try {
      await revokeRoleTask.run(token, payload);
      void refreshAccessControlOverview(token);
    } catch (error) {
      setRevokeRoleError(getErrorMessage(error));
    }
  }

  async function handleProposalLookup(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setProposalLookupError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setProposalLookupError(null);

    try {
      await proposalTask.run(token, readRequiredText(formData, "proposal_id", "Proposal ID"));
    } catch (error) {
      setProposalLookupError(getErrorMessage(error));
    }
  }

  async function handleSignatureLookup(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setSignatureLookupError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setSignatureLookupError(null);

    try {
      await signatureTask.run(
        token,
        readRequiredText(formData, "proposal_id", "Proposal ID"),
        readRequiredText(formData, "signer_address", "Signer address"),
      );
    } catch (error) {
      setSignatureLookupError(getErrorMessage(error));
    }
  }

  async function handleMultisigCompose(submission: MultisigComposeSubmission) {
    const token = adminToken();

    if (!token) {
      setProposeTransactionError("Connect an admin wallet first.");
      setAddSignerError("Connect an admin wallet first.");
      setRemoveSignerError("Connect an admin wallet first.");
      setUpdateQuorumError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    setProposeTransactionError(null);
    setRemoveSignerError(null);
    setUpdateQuorumError(null);
    setAddSignerError(null);

    try {
      if (submission.mode === "raw_transaction") {
        await proposeTransactionTask.run(token, submission.payload);
      } else if (submission.mode === "add_signer") {
        await addSignerTask.run(token, submission.payload);
      } else if (submission.mode === "remove_signer") {
        await removeSignerTask.run(token, submission.payload);
      } else {
        await updateQuorumTask.run(token, submission.payload);
      }

      void refreshMultisigOverview(token);
    } catch (error) {
      const message = getErrorMessage(error);

      if (submission.mode === "raw_transaction") {
        setProposeTransactionError(message);
      } else if (submission.mode === "add_signer") {
        setAddSignerError(message);
      } else if (submission.mode === "remove_signer") {
        setRemoveSignerError(message);
      } else {
        setUpdateQuorumError(message);
      }
    }
  }

  async function handleProposalAction(
    action: ProposalLifecycleAction,
    proposalId: string,
  ) {
    const token = adminToken();

    if (!token) {
      setProposalActionError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }
    setProposalActionError(null);

    try {
      if (action === "sign") {
        await signProposalTask.run(token, proposalId);
      } else if (action === "execute") {
        await executeProposalTask.run(token, proposalId);
      } else {
        await cancelProposalTask.run(token, proposalId);
      }

      void refreshMultisigOverview(token);
    } catch (error) {
      setProposalActionError(getErrorMessage(error));
    }
  }

  return (
    <>
      <div class="pm-asset-admin">
        <section class="pm-asset-admin__hero">
          <div class="pm-asset-admin__hero-copy">
            <div class="pm-asset-admin__masthead">
              <div class="pm-asset-admin__masthead-copy">
                <p class="pm-admin-section-header__eyebrow">Governance control plane</p>
                <h1 class="pm-asset-admin__title">
                  Run contract governance from a single operator workspace.
                </h1>
                <p class="pm-asset-admin__copy">
                  Inspect access control, track multisig readiness, and launch guarded proposal
                  workflows without juggling raw endpoint forms in the page body.
                </p>
              </div>

              <div class="pm-asset-admin__actions">
                <button
                  class="pm-button pm-button--primary"
                  type="button"
                  onClick={() => openModal("access-directory")}
                >
                  Role directory
                </button>
                <button
                  class="pm-button pm-button--ghost"
                  type="button"
                  onClick={() => openModal("multisig-desk")}
                >
                  Proposal desk
                </button>
              </div>
            </div>

            <div class="pm-asset-admin__stats">
              <DashboardStat
                label="Known roles"
                value={String(accessControlOverviewTask.data()?.roles.length ?? 8)}
                meta={
                  accessControlOverviewTask.data()
                    ? "Loaded from the live access-control contract"
                    : "Canonical role map for the governance surface"
                }
              />
              <DashboardStat
                label="Signer set"
                value={String(multisigOverviewTask.data()?.signers.length ?? 0)}
                meta={
                  multisigOverviewTask.data()
                    ? "Current multisig signer count"
                    : "Live signer count appears after authentication"
                }
              />
              <DashboardStat
                label="Quorum"
                value={multisigOverviewTask.data()?.quorum ?? "-"}
                meta="Current proposal execution threshold"
              />
              <DashboardStat
                label="Proposals"
                value={multisigOverviewTask.data()?.proposal_count ?? "-"}
                meta="Total proposals recorded by the multisig"
              />
            </div>
          </div>

          <aside class="pm-asset-admin__session">
            <p class="pm-asset-admin__session-eyebrow">Operator session</p>
            <Show
              when={isAdminConnected()}
              fallback={
                <>
                  <span class="pm-asset-admin__session-status">Governance locked</span>
                  <h2 class="pm-asset-admin__session-title">Authentication required</h2>
                  <p class="pm-asset-admin__session-copy">
                    Every contract route in this workspace is protected. Connect an allowlisted
                    admin wallet before reading contract state or proposing multisig changes.
                  </p>
                  <button
                    class="pm-button pm-button--primary"
                    type="button"
                    onClick={auth.openAuthDialog}
                  >
                    Connect admin wallet
                  </button>
                </>
              }
            >
              <span class="pm-asset-admin__session-status pm-asset-admin__session-status--live">
                Governance enabled
              </span>
              <h2 class="pm-asset-admin__session-title">Authenticated and ready</h2>
              <p class="pm-asset-admin__session-copy">
                Protected reads, role mutations, and multisig proposal flows are available from the
                current admin wallet session.
              </p>
              <div class="pm-asset-admin__session-chips">
                <span class="pm-market-chip">{adminWalletLabel()}</span>
                <span class="pm-market-chip">Monad #{auth.profile()?.monad_chain_id ?? "-"}</span>
              </div>
            </Show>
          </aside>
        </section>

        <section class="pm-asset-admin__section pm-asset-admin__section--workspace">
          <div class="pm-tool-section__header">
            <div>
              <p class="pm-admin-section-header__eyebrow">Workspace</p>
              <h2 class="pm-tool-section__title">Inspect first, then mutate</h2>
            </div>
            <p class="pm-admin-section-note">
              Contract reads and writes are grouped by operator task so you can validate roles and
              proposal state before pushing a governance action.
            </p>
          </div>

          <div class="pm-asset-admin__lane-grid">
            <section class="pm-asset-admin__lane">
              <div class="pm-asset-admin__lane-head">
                <div>
                  <p class="pm-asset-admin__lane-kicker">Inspect</p>
                  <h3 class="pm-asset-admin__lane-title">Read protected contract state</h3>
                </div>
                <span class="pm-market-chip">Admin read</span>
              </div>
              <p class="pm-asset-admin__lane-copy">
                Pull the role map, signer set, proposal state, and signature status before acting
                on any contract workflow.
              </p>
              <div class="pm-asset-action-stack">
                <ActionCard
                  actionLabel="Read"
                  endpoint="GET /admin/contracts/access-control"
                  title="Access control directory"
                  copy="Inspect the deployed contract, role hierarchy, and per-account membership in one workspace."
                  detail="Includes role membership lookups"
                  onOpen={() => openModal("access-directory")}
                />
                <ActionCard
                  actionLabel="Read"
                  endpoint="GET /admin/contracts/multisig"
                  title="Proposal desk"
                  copy="Review signer set, quorum, proposal state, and per-signer signatures before any lifecycle action."
                  detail="Best place to validate execution readiness"
                  onOpen={() => openModal("multisig-desk")}
                />
              </div>
            </section>

            <section class="pm-asset-admin__lane pm-asset-admin__lane--admin">
              <div class="pm-asset-admin__lane-head">
                <div>
                  <p class="pm-asset-admin__lane-kicker">Operate</p>
                  <h3 class="pm-asset-admin__lane-title">Run guarded governance workflows</h3>
                </div>
                <span class="pm-market-chip">Admin write</span>
              </div>
              <p class="pm-asset-admin__lane-copy">
                Open focused write modals for role changes, multisig proposal composition, and
                lifecycle operations instead of managing long inline forms.
              </p>
              <div class="pm-asset-action-stack">
                <ActionCard
                  actionLabel="Write"
                  endpoint="POST /admin/contracts/access-control/grant | revoke"
                  title="Role administration"
                  copy="Grant or revoke access-control roles through a dedicated admin workflow."
                  detail="Supports canonical labels or raw bytes32 role values"
                  onOpen={() => openModal("role-administration")}
                  tone="admin"
                />
                <ActionCard
                  actionLabel="Write"
                  endpoint="POST /admin/contracts/multisig/proposals"
                  title="Compose multisig proposals"
                  copy="Create raw proposals, signer changes, and quorum updates from a single composition desk."
                  detail="Signer and quorum changes are encoded as multisig self-calls"
                  onOpen={() => openModal("multisig-compose")}
                  tone="admin"
                />
                <ActionCard
                  actionLabel="Write"
                  endpoint="POST /admin/contracts/multisig/proposals/{proposal_id}/sign | execute | cancel"
                  title="Proposal lifecycle"
                  copy="Drive the sign, execute, and cancel stages from a focused action modal."
                  detail="Use after validating readiness in the proposal desk"
                  onOpen={() => openModal("proposal-actions")}
                  tone="admin"
                />
              </div>
            </section>
          </div>
        </section>

        <section class="pm-asset-admin__overview-grid">
          <article class="pm-asset-snapshot-card">
            <div class="pm-asset-snapshot-card__header">
              <div>
                <p class="pm-market-card__eyebrow">Access control registry</p>
                <h3 class="pm-market-card__title">Current role directory</h3>
              </div>
              <button
                class="pm-button pm-button--ghost"
                type="button"
                disabled={accessControlOverviewTask.pending() || !adminToken()}
                onClick={() => void refreshAccessControlOverview()}
              >
                {accessControlOverviewTask.pending() ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <Show
              when={accessControlOverviewTask.data()}
              fallback={
                <p class="pm-market-feedback">
                  {!adminToken()
                    ? "Connect an admin wallet to load the live role directory."
                    : accessControlOverviewTask.error()
                      ? getErrorMessage(accessControlOverviewTask.error())
                      : "Role directory appears here after the first contract fetch completes."}
                </p>
              }
            >
              <div class="pm-asset-admin__facts-grid">
                <ControlFact
                  label="Access control"
                  value={accessControlOverviewTask.data()!.access_control_address}
                />
                <ControlFact
                  label="Known roles"
                  value={String(accessControlOverviewTask.data()!.roles.length)}
                  meta="Canonical roles returned by the contract"
                  shorten={false}
                />
              </div>

              <div class="pm-asset-admin__facts-grid">
                <For each={accessControlOverviewTask.data()!.roles}>
                  {role => (
                    <ControlFact
                      label={role.role}
                      value={role.admin_role}
                      meta={role.role_hex}
                      shorten={false}
                    />
                  )}
                </For>
              </div>
            </Show>
          </article>

          <article class="pm-asset-snapshot-card">
            <div class="pm-asset-snapshot-card__header">
              <div>
                <p class="pm-market-card__eyebrow">Governance pulse</p>
                <h3 class="pm-market-card__title">Multisig state and latest proposal</h3>
              </div>
              <div class="pm-asset-modal__summary">
                <Show when={multisigOverviewTask.data()}>
                  <span class="pm-market-chip">
                    {multisigOverviewTask.data()!.signers.length} signers
                  </span>
                </Show>
                <button
                  class="pm-button pm-button--ghost"
                  type="button"
                  disabled={multisigOverviewTask.pending() || !adminToken()}
                  onClick={() => void refreshMultisigOverview()}
                >
                  {multisigOverviewTask.pending() ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            <Show
              when={multisigOverviewTask.data()}
              fallback={
                <p class="pm-market-feedback">
                  {!adminToken()
                    ? "Connect an admin wallet to load multisig signer and quorum state."
                    : multisigOverviewTask.error()
                      ? getErrorMessage(multisigOverviewTask.error())
                      : "Multisig overview appears here after the first contract fetch completes."}
                </p>
              }
            >
              <div class="pm-asset-admin__facts-grid">
                <ControlFact
                  label="Multisig"
                  value={multisigOverviewTask.data()!.multisig_address}
                />
                <ControlFact
                  label="Quorum"
                  value={multisigOverviewTask.data()!.quorum}
                  meta="Current execution threshold"
                  shorten={false}
                />
                <ControlFact
                  label="Proposal count"
                  value={multisigOverviewTask.data()!.proposal_count}
                  meta="Total proposals emitted"
                  shorten={false}
                />
                <ControlFact
                  label="Timelock"
                  value={multisigOverviewTask.data()!.timelock_duration}
                  meta="Seconds before ready proposals can execute"
                  shorten={false}
                />
              </div>

              <Show when={multisigOverviewTask.data()!.signers.length > 0}>
                <div class="pm-asset-modal__chips">
                  <For each={multisigOverviewTask.data()!.signers}>
                    {signer => <span class="pm-market-chip">{shortenWalletAddress(signer)}</span>}
                  </For>
                </div>
              </Show>

              <Show
                when={latestProposal()}
                fallback={
                  <div class="pm-asset-admin__empty">
                    <p class="pm-asset-admin__empty-title">No proposal inspected yet</p>
                    <p class="pm-asset-admin__empty-copy">
                      Open the proposal desk to inspect a proposal, or compose a new one from the
                      multisig workflow modal.
                    </p>
                    <div class="pm-asset-admin__empty-actions">
                      <button
                        class="pm-button pm-button--ghost"
                        type="button"
                        onClick={() => openModal("multisig-desk")}
                      >
                        Open proposal desk
                      </button>
                      <button
                        class="pm-button pm-button--primary"
                        type="button"
                        onClick={() => openModal("multisig-compose")}
                      >
                        Compose proposal
                      </button>
                    </div>
                  </div>
                }
              >
                <ProposalSummary
                  eyebrow="Latest proposal context"
                  title={`Proposal #${latestProposal()!.proposal_id}`}
                  proposal={latestProposal()!}
                />
              </Show>
            </Show>
          </article>
        </section>
      </div>

      <AdminModal
        open={activeModal() === "access-directory"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin read"
        title="Access control directory"
        subtitle="Inspect the access-control contract, review role hierarchy, and verify whether an account holds a role."
        size="wide"
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
            <div class="pm-market-actions pm-market-actions--split">
              <div class="pm-asset-modal__chips">
                <Show when={accessControlOverviewTask.data()}>
                  <span class="pm-market-chip">
                    {accessControlOverviewTask.data()!.roles.length} known roles
                  </span>
                </Show>
                <Show when={accessControlOverviewTask.data()}>
                  <span class="pm-market-chip">
                    {shortenWalletAddress(accessControlOverviewTask.data()!.access_control_address)}
                  </span>
                </Show>
              </div>
              <button
                class="pm-button pm-button--primary"
                type="button"
                disabled={accessControlOverviewTask.pending()}
                onClick={() => void refreshAccessControlOverview()}
              >
                {accessControlOverviewTask.pending() ? "Fetching..." : "Fetch directory"}
              </button>
            </div>

            <Show when={accessControlOverviewTask.error()}>
              <p class="pm-market-feedback pm-market-feedback--error">
                {getErrorMessage(accessControlOverviewTask.error())}
              </p>
            </Show>

            <Show when={accessControlOverviewTask.data()}>
              <div class="pm-market-result">
                <div class="pm-market-result__header">
                  <div>
                    <p class="pm-market-result__eyebrow">Directory snapshot</p>
                    <h3 class="pm-market-result__title">Live role hierarchy</h3>
                  </div>
                </div>

                <div class="pm-market-result__grid">
                  <div>
                    <span class="pm-market-result__label">Access control</span>
                    <span class="pm-market-result__value">
                      {accessControlOverviewTask.data()!.access_control_address}
                    </span>
                  </div>
                  <div>
                    <span class="pm-market-result__label">Known roles</span>
                    <span class="pm-market-result__value">
                      {String(accessControlOverviewTask.data()!.roles.length)}
                    </span>
                  </div>
                </div>
              </div>

              <div class="pm-asset-admin__facts-grid">
                <For each={accessControlOverviewTask.data()!.roles}>
                  {role => (
                    <ControlFact
                      label={role.role}
                      value={role.admin_role}
                      meta={role.admin_role_hex}
                      shorten={false}
                    />
                  )}
                </For>
              </div>
            </Show>

            <RoleMembershipLookupPanel
              pending={roleMembershipTask.pending()}
              error={roleMembershipError()}
              onSubmit={handleRoleMembershipLookup}
            />
          </AdminGate>

          <Show when={roleMembershipTask.data()}>
            <RoleMembershipResult
              data={roleMembershipTask.data()!}
              eyebrow="Membership lookup"
            />
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "role-administration"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin write"
        title="Role administration"
        subtitle="Grant or revoke contract roles through a focused workflow instead of editing inline forms."
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
            <RoleAdministrationPanel
              pending={grantRoleTask.pending() || revokeRoleTask.pending()}
              error={grantRoleError() ?? revokeRoleError()}
              onSubmit={handleRoleWrite}
            />
          </AdminGate>

          <Show when={grantRoleTask.data()}>
            <RoleWriteResult data={grantRoleTask.data()!} />
          </Show>

          <Show when={revokeRoleTask.data()}>
            <RoleWriteResult data={revokeRoleTask.data()!} />
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "multisig-desk"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin read"
        title="Proposal desk"
        subtitle="Inspect signer state, verify signatures, and review proposal readiness before you execute a governance action."
        size="wide"
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
            <div class="pm-market-actions pm-market-actions--split">
              <div class="pm-asset-modal__chips">
                <Show when={multisigOverviewTask.data()}>
                  <span class="pm-market-chip">{multisigOverviewTask.data()!.quorum} quorum</span>
                </Show>
                <Show when={multisigOverviewTask.data()}>
                  <span class="pm-market-chip">
                    {multisigOverviewTask.data()!.proposal_count} proposals
                  </span>
                </Show>
              </div>
              <button
                class="pm-button pm-button--primary"
                type="button"
                disabled={multisigOverviewTask.pending()}
                onClick={() => void refreshMultisigOverview()}
              >
                {multisigOverviewTask.pending() ? "Fetching..." : "Fetch overview"}
              </button>
            </div>

            <Show when={multisigOverviewTask.error()}>
              <p class="pm-market-feedback pm-market-feedback--error">
                {getErrorMessage(multisigOverviewTask.error())}
              </p>
            </Show>

            <Show when={multisigOverviewTask.data()}>
              <div class="pm-market-result">
                <div class="pm-market-result__header">
                  <div>
                    <p class="pm-market-result__eyebrow">Multisig snapshot</p>
                    <h3 class="pm-market-result__title">Signer and timelock state</h3>
                  </div>
                  <div class="pm-asset-modal__chips">
                    <span class="pm-market-chip">
                      {multisigOverviewTask.data()!.signers.length} signers
                    </span>
                    <span class="pm-market-chip">
                      {multisigOverviewTask.data()!.timelock_duration}s timelock
                    </span>
                  </div>
                </div>

                <div class="pm-market-result__grid">
                  <div>
                    <span class="pm-market-result__label">Multisig</span>
                    <span class="pm-market-result__value">
                      {multisigOverviewTask.data()!.multisig_address}
                    </span>
                  </div>
                  <div>
                    <span class="pm-market-result__label">Quorum</span>
                    <span class="pm-market-result__value">{multisigOverviewTask.data()!.quorum}</span>
                  </div>
                  <div>
                    <span class="pm-market-result__label">Proposal expiry</span>
                    <span class="pm-market-result__value">
                      {multisigOverviewTask.data()!.proposal_expiry}s
                    </span>
                  </div>
                  <div>
                    <span class="pm-market-result__label">Minimum timelock</span>
                    <span class="pm-market-result__value">
                      {multisigOverviewTask.data()!.min_timelock}s
                    </span>
                  </div>
                </div>
              </div>

              <Show when={multisigOverviewTask.data()!.signers.length > 0}>
                <div class="pm-asset-modal__chips">
                  <For each={multisigOverviewTask.data()!.signers}>
                    {signer => <span class="pm-market-chip">{signer}</span>}
                  </For>
                </div>
              </Show>
            </Show>

            <div class="pm-tool-section__grid">
              <section class="pm-market-card">
                <div class="pm-market-card__header">
                  <div>
                    <p class="pm-market-card__eyebrow">
                      GET /admin/contracts/multisig/proposals/{'{proposal_id}'}
                    </p>
                    <h3 class="pm-market-card__title">Proposal state</h3>
                  </div>
                </div>
                <p class="pm-market-card__copy">
                  Load the proposal details, lifecycle status, timelock, and readiness flags.
                </p>
                <form class="pm-market-form" onSubmit={handleProposalLookup}>
                  <div class="pm-market-fields">
                    <label class="pm-field pm-field--full">
                      <span class="pm-field__label">Proposal ID</span>
                      <input class="pm-field__input" name="proposal_id" type="text" placeholder="0" />
                    </label>
                  </div>
                  <div class="pm-market-actions">
                    <button
                      class="pm-button pm-button--primary"
                      type="submit"
                      disabled={proposalTask.pending()}
                    >
                      {proposalTask.pending() ? "Loading..." : "Fetch proposal"}
                    </button>
                  </div>
                </form>
              </section>

              <section class="pm-market-card">
                <div class="pm-market-card__header">
                  <div>
                    <p class="pm-market-card__eyebrow">
                      GET /admin/contracts/multisig/proposals/{'{proposal_id}'}/signers/{'{signer}'}
                    </p>
                    <h3 class="pm-market-card__title">Signer signature state</h3>
                  </div>
                </div>
                <p class="pm-market-card__copy">
                  Check whether a specific signer has already signed a proposal.
                </p>
                <form class="pm-market-form" onSubmit={handleSignatureLookup}>
                  <div class="pm-market-fields">
                    <label class="pm-field">
                      <span class="pm-field__label">Proposal ID</span>
                      <input class="pm-field__input" name="proposal_id" type="text" placeholder="0" />
                    </label>
                    <label class="pm-field">
                      <span class="pm-field__label">Signer address</span>
                      <input class="pm-field__input" name="signer_address" type="text" placeholder="0x..." />
                    </label>
                  </div>
                  <div class="pm-market-actions">
                    <button
                      class="pm-button pm-button--primary"
                      type="submit"
                      disabled={signatureTask.pending()}
                    >
                      {signatureTask.pending() ? "Checking..." : "Check signature"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </AdminGate>

          <Show when={proposalLookupError()}>
            <p class="pm-market-feedback pm-market-feedback--error">{proposalLookupError()}</p>
          </Show>
          <Show when={signatureLookupError()}>
            <p class="pm-market-feedback pm-market-feedback--error">{signatureLookupError()}</p>
          </Show>

          <Show when={proposalTask.data()}>
            <ProposalSummary
              eyebrow="Proposal lookup"
              title={`Proposal #${proposalTask.data()!.proposal_id}`}
              proposal={proposalTask.data()!}
            />
          </Show>

          <Show when={signatureTask.data()}>
            <SignatureResult data={signatureTask.data()!} />
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "multisig-compose"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin write"
        title="Compose multisig proposals"
        subtitle="Create raw proposals and governance self-calls without scattering signer and quorum mutations across the page."
        size="wide"
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
            <MultisigComposePanel
              pending={
                proposeTransactionTask.pending() ||
                addSignerTask.pending() ||
                removeSignerTask.pending() ||
                updateQuorumTask.pending()
              }
              error={
                proposeTransactionError() ??
                addSignerError() ??
                removeSignerError() ??
                updateQuorumError()
              }
              onSubmit={handleMultisigCompose}
            />
          </AdminGate>

          <Show when={proposeTransactionTask.data()}>
            <ProposalSummary
              eyebrow="Raw proposal created"
              title={`Proposal #${proposeTransactionTask.data()!.proposal.proposal_id}`}
              proposal={proposeTransactionTask.data()!.proposal}
              txHash={proposeTransactionTask.data()!.tx_hash}
            />
          </Show>
          <Show when={addSignerTask.data()}>
            <ProposalSummary
              eyebrow="Signer addition proposed"
              title={`Proposal #${addSignerTask.data()!.proposal.proposal_id}`}
              proposal={addSignerTask.data()!.proposal}
              txHash={addSignerTask.data()!.tx_hash}
            />
          </Show>
          <Show when={removeSignerTask.data()}>
            <ProposalSummary
              eyebrow="Signer removal proposed"
              title={`Proposal #${removeSignerTask.data()!.proposal.proposal_id}`}
              proposal={removeSignerTask.data()!.proposal}
              txHash={removeSignerTask.data()!.tx_hash}
            />
          </Show>
          <Show when={updateQuorumTask.data()}>
            <ProposalSummary
              eyebrow="Quorum update proposed"
              title={`Proposal #${updateQuorumTask.data()!.proposal.proposal_id}`}
              proposal={updateQuorumTask.data()!.proposal}
              txHash={updateQuorumTask.data()!.tx_hash}
            />
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "proposal-actions"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin write"
        title="Proposal lifecycle"
        subtitle="Use a single proposal identifier to sign, execute after quorum and timelock, or cancel when governance requires it."
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
            <ProposalLifecyclePanel
              pending={
                signProposalTask.pending() ||
                executeProposalTask.pending() ||
                cancelProposalTask.pending()
              }
              error={proposalActionError()}
              onSubmit={handleProposalAction}
            />
          </AdminGate>

          <Show when={latestProposalAction()}>
            <ProposalSummary
              eyebrow="Lifecycle action confirmed"
              title={`Proposal #${latestProposalAction()!.proposal.proposal_id}`}
              proposal={latestProposalAction()!.proposal}
              txHash={latestProposalAction()!.tx_hash}
            />
          </Show>
        </div>
      </AdminModal>
    </>
  );
}
