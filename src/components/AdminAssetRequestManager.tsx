import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
} from "solid-js";

import {
  DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
  assetRequestClient,
  formatBaseUnitsLabel,
  formatPaymentTokenAmountFromBaseUnits,
  readAdminToken,
  type AdminListAssetRequestsQuery,
  type AdminUpdateAssetRequestStatusRequest,
  type AssetRequestDeployResponse,
  type AssetRequestResponse,
  type AssetRequestStatus,
} from "~/lib";
import { useAdminAuth } from "~/lib/admin-auth-context";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";
import { shortenWalletAddress } from "~/lib/wallet/ethereum";

import AdminModal from "./AdminModal";
import {
  AssetRequestDeployPanel,
  AssetRequestStatusPanel,
  type AssetRequestStatusOption,
} from "./asset-requests";

type AssetRequestModalView = "review-desk" | "deploy-desk";
type StatusFilterValue = AssetRequestStatus | "all";

const DEFAULT_LIMIT = 12;

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilterValue; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "deployed", label: "Deployed" },
];

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatStatusLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .split("_")
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatWalletLabel(walletAddress: string | null | undefined) {
  if (!walletAddress) {
    return "Admin wallet";
  }

  return shortenWalletAddress(walletAddress);
}

function formatSettlementValue(value: string) {
  return formatPaymentTokenAmountFromBaseUnits(value, DEFAULT_PAYMENT_TOKEN_DISPLAY_META);
}

function readStatusOptions(request: AssetRequestResponse | null): AssetRequestStatusOption[] {
  switch (request?.status) {
    case "submitted":
      return [
        { value: "submitted", label: "Submitted" },
        { value: "under_review", label: "Under review" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
      ];
    case "under_review":
      return [
        { value: "under_review", label: "Under review" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
      ];
    case "approved":
      return [
        { value: "under_review", label: "Under review" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
      ];
    case "rejected":
      return [
        { value: "rejected", label: "Rejected" },
        { value: "under_review", label: "Under review" },
      ];
    case "deployed":
      return [{ value: "deployed", label: "Deployed" }];
    default:
      return [
        { value: "under_review", label: "Under review" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
      ];
  }
}

function ActionCard(props: {
  actionLabel: string;
  endpoint: string;
  title: string;
  copy: string;
  detail: string;
  onOpen: () => void;
  tone?: "default" | "admin";
}) {
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
              Asset request review and deployment flows stay protected until an admin wallet
              challenge is completed.
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

function QueueCard(props: {
  request: AssetRequestResponse;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      class={`pm-asset-action-card${props.selected ? " pm-asset-action-card--admin" : ""}`}
      type="button"
      onClick={props.onSelect}
    >
      <div class="pm-asset-action-card__header">
        <p class="pm-asset-action-card__eyebrow">{formatStatusLabel(props.request.status)}</p>
        <span class="pm-asset-action-card__pill">
          {formatDateTimeLabel(props.request.created_at)}
        </span>
      </div>

      <div class="pm-asset-action-card__body">
        <h3 class="pm-asset-action-card__title">{props.request.asset_name}</h3>
        <p class="pm-asset-action-card__copy">
          {props.request.issuer_name} ·{" "}
          {props.request.asset_type_id_text ?? props.request.asset_type_id}
        </p>
      </div>

      <div class="pm-asset-action-card__footer">
        <span class="pm-asset-action-card__detail">
          Proposal {props.request.proposal_id} · {props.request.token_symbol}
        </span>
        <span class="pm-asset-action-card__cta">{props.selected ? "Selected" : "Focus"}</span>
      </div>
    </button>
  );
}

function SelectedRequestResult(props: {
  request: AssetRequestResponse;
}) {
  return (
    <div class="pm-market-result">
      <div class="pm-market-result__header">
        <div>
          <p class="pm-market-result__eyebrow">Request spotlight</p>
          <h3 class="pm-market-result__title">{props.request.asset_name}</h3>
        </div>
        <span class="pm-market-result__badge">{formatStatusLabel(props.request.status)}</span>
      </div>

      <div class="pm-market-result__grid">
        <div>
          <span class="pm-market-result__label">Request ID</span>
          <span class="pm-market-result__value">{props.request.id}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Proposal ID</span>
          <span class="pm-market-result__value">{props.request.proposal_id}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Issuer</span>
          <span class="pm-market-result__value">{props.request.issuer_name}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Contact</span>
          <span class="pm-market-result__value">{props.request.contact_name}</span>
          <span class="pm-market-result__subvalue">{props.request.contact_email}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Asset type</span>
          <span class="pm-market-result__value">
            {props.request.asset_type_id_text ?? props.request.asset_type_id}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Market segment</span>
          <span class="pm-market-result__value">{props.request.market_segment ?? "Not set"}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Subscription price</span>
          <span class="pm-market-result__value">
            {formatSettlementValue(props.request.subscription_price)}
          </span>
          <span class="pm-market-result__subvalue">
            {formatBaseUnitsLabel(props.request.subscription_price)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Redemption price</span>
          <span class="pm-market-result__value">
            {formatSettlementValue(props.request.redemption_price)}
          </span>
          <span class="pm-market-result__subvalue">
            {formatBaseUnitsLabel(props.request.redemption_price)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Created</span>
          <span class="pm-market-result__value">{formatDateTimeLabel(props.request.created_at)}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Updated</span>
          <span class="pm-market-result__value">{formatDateTimeLabel(props.request.updated_at)}</span>
        </div>
        <div class="pm-market-result__detail--full">
          <span class="pm-market-result__label">Description</span>
          <span class="pm-market-result__value">{props.request.description}</span>
        </div>
        <div class="pm-market-result__detail--full">
          <span class="pm-market-result__label">Review notes</span>
          <span class="pm-market-result__value">
            {props.request.review_notes?.trim() || "No review notes recorded yet."}
          </span>
        </div>
      </div>
    </div>
  );
}

function DeployResult(props: {
  data: AssetRequestDeployResponse;
}) {
  return (
    <div class="pm-market-result">
      <div class="pm-market-result__header">
        <div>
          <p class="pm-market-result__eyebrow">Deployment completed</p>
          <h3 class="pm-market-result__title">{props.data.asset.name}</h3>
        </div>
        <span class="pm-market-result__badge">Deployed</span>
      </div>

      <div class="pm-market-result__grid">
        <div>
          <span class="pm-market-result__label">Request ID</span>
          <span class="pm-market-result__value">{props.data.request.id}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Asset address</span>
          <span class="pm-market-result__value">{props.data.asset.asset_address}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Transaction</span>
          <span class="pm-market-result__value">{props.data.tx_hash ?? "Reused existing asset"}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Asset status</span>
          <span class="pm-market-result__value">{props.data.asset.asset_state_label}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminAssetRequestManager() {
  let previousToken: string | null = null;

  const auth = useAdminAuth();
  const listTask = useAsyncTask((token: string, query: AdminListAssetRequestsQuery) =>
    assetRequestClient.listForReview(token, query),
  );
  const updateStatusTask = useAsyncTask(
    (token: string, requestId: string, payload: AdminUpdateAssetRequestStatusRequest) =>
      assetRequestClient.updateStatus(token, requestId, payload),
  );
  const deployTask = useAsyncTask((token: string, requestId: string) =>
    assetRequestClient.deploy(token, requestId),
  );

  const [activeModal, setActiveModal] = createSignal<AssetRequestModalView | null>(null);
  const [statusFilter, setStatusFilter] = createSignal<StatusFilterValue>("all");
  const [limit, setLimit] = createSignal(DEFAULT_LIMIT);
  const [offset, setOffset] = createSignal(0);
  const [queueError, setQueueError] = createSignal<string | null>(null);
  const [statusWriteError, setStatusWriteError] = createSignal<string | null>(null);
  const [deployError, setDeployError] = createSignal<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = createSignal("");
  const [selectedRequestFallback, setSelectedRequestFallback] =
    createSignal<AssetRequestResponse | null>(null);
  const [statusDraft, setStatusDraft] = createSignal<AssetRequestStatus>("under_review");
  const [reviewNotes, setReviewNotes] = createSignal("");
  const [latestDeploy, setLatestDeploy] = createSignal<AssetRequestDeployResponse | null>(null);

  const adminToken = () => auth.session()?.token ?? readAdminToken();
  const isAdminConnected = () => Boolean(auth.profile() && adminToken());
  const adminWalletLabel = createMemo(() =>
    formatWalletLabel(auth.profile()?.user.wallet?.wallet_address),
  );
  const currentQueue = createMemo(() => listTask.data()?.asset_requests ?? []);
  const currentSelectedRequest = createMemo(
    () =>
      currentQueue().find(request => request.id === selectedRequestId()) ??
      selectedRequestFallback(),
  );
  const statusOptions = createMemo(() => readStatusOptions(currentSelectedRequest()));
  const pendingReviewCount = createMemo(
    () =>
      currentQueue().filter(
        request => request.status === "submitted" || request.status === "under_review",
      ).length,
  );
  const approvedCount = createMemo(
    () => currentQueue().filter(request => request.status === "approved").length,
  );
  const deployedCount = createMemo(
    () => currentQueue().filter(request => request.status === "deployed").length,
  );

  createEffect(() => {
    const token = adminToken();

    if (!token) {
      previousToken = null;
      return;
    }

    if (token === previousToken) {
      return;
    }

    previousToken = token;
    void refreshQueue(token);
  });

  createEffect(() => {
    const request = currentSelectedRequest();

    if (!request) {
      return;
    }

    if (!statusOptions().some(option => option.value === statusDraft())) {
      setStatusDraft(statusOptions()[0]?.value ?? "under_review");
    }

    if (reviewNotes().trim().length === 0 && request.review_notes) {
      setReviewNotes(request.review_notes);
    }
  });

  function buildListQuery(): AdminListAssetRequestsQuery {
    return {
      status: statusFilter() === "all" ? null : statusFilter(),
      limit: limit(),
      offset: offset(),
    };
  }

  function focusRequest(request: AssetRequestResponse) {
    setSelectedRequestId(request.id);
    setSelectedRequestFallback(request);
    setStatusDraft(readStatusOptions(request)[0]?.value ?? request.status);
    setReviewNotes(request.review_notes ?? "");
  }

  function handleRequestIdInput(value: string) {
    setSelectedRequestId(value);

    if (selectedRequestFallback()?.id !== value) {
      setSelectedRequestFallback(null);
    }
  }

  function openModal(view: AssetRequestModalView) {
    setStatusWriteError(null);
    setDeployError(null);
    setActiveModal(view);
  }

  async function refreshQueue(token = adminToken()) {
    if (!token) {
      return;
    }

    setQueueError(null);

    try {
      const response = await listTask.run(token, buildListQuery());

      if (response.asset_requests.length === 0) {
        return;
      }

      const matched = response.asset_requests.find(
        request => request.id === selectedRequestId(),
      );

      if (matched) {
        focusRequest(matched);
        return;
      }

      if (!selectedRequestId()) {
        focusRequest(response.asset_requests[0]);
      }
    } catch (error) {
      setQueueError(getErrorMessage(error));
    }
  }

  async function handleStatusSubmit() {
    const token = adminToken();

    if (!token) {
      setStatusWriteError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    const requestId = selectedRequestId().trim();

    if (!requestId) {
      setStatusWriteError("Request ID is required.");
      return;
    }

    const nextStatus = statusDraft();
    const notes = reviewNotes().trim();

    if (nextStatus === "rejected" && notes.length === 0) {
      setStatusWriteError("Review notes are required when rejecting an asset request.");
      return;
    }

    setStatusWriteError(null);

    try {
      const response = await updateStatusTask.run(token, requestId, {
        status: nextStatus,
        review_notes: notes || null,
      });
      focusRequest(response);
      setLatestDeploy(null);
      void refreshQueue(token);
    } catch (error) {
      setStatusWriteError(getErrorMessage(error));
    }
  }

  async function handleDeploySubmit() {
    const token = adminToken();

    if (!token) {
      setDeployError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    const requestId = selectedRequestId().trim();

    if (!requestId) {
      setDeployError("Request ID is required.");
      return;
    }

    setDeployError(null);

    try {
      const response = await deployTask.run(token, requestId);
      setLatestDeploy(response);
      focusRequest(response.request);
      void refreshQueue(token);
    } catch (error) {
      setDeployError(getErrorMessage(error));
    }
  }

  return (
    <>
      <div class="pm-asset-admin">
        <section class="pm-asset-admin__hero">
          <div class="pm-asset-admin__hero-copy">
            <div class="pm-asset-admin__masthead">
              <div class="pm-asset-admin__masthead-copy">
                <p class="pm-admin-section-header__eyebrow">Issuance request desk</p>
                <h1 class="pm-asset-admin__title">
                  Review inbound asset requests before they become live instruments.
                </h1>
                <p class="pm-asset-admin__copy">
                  Keep issuer-submitted requests in one operator workspace, move them through the
                  review lifecycle, and deploy approved requests into live assets without dropping
                  into raw endpoint testing.
                </p>
              </div>

              <div class="pm-asset-admin__actions">
                <button
                  class="pm-button pm-button--primary"
                  type="button"
                  onClick={() => void refreshQueue()}
                >
                  Refresh queue
                </button>
                <button
                  class="pm-button pm-button--ghost"
                  type="button"
                  onClick={() => openModal("review-desk")}
                >
                  Review desk
                </button>
              </div>
            </div>

            <div class="pm-asset-admin__stats">
              <DashboardStat
                label="Requests"
                value={formatCount(currentQueue().length)}
                meta="Current filtered review set"
              />
              <DashboardStat
                label="Pending review"
                value={formatCount(pendingReviewCount())}
                meta="Submitted or under-review requests"
              />
              <DashboardStat
                label="Approved"
                value={formatCount(approvedCount())}
                meta="Ready for deployment or follow-up"
              />
              <DashboardStat
                label="Deployed"
                value={formatCount(deployedCount())}
                meta="Requests already materialized as assets"
              />
            </div>
          </div>

          <aside class="pm-asset-admin__session">
            <p class="pm-asset-admin__session-eyebrow">Operator session</p>
            <Show
              when={isAdminConnected()}
              fallback={
                <>
                  <span class="pm-asset-admin__session-status">Write access locked</span>
                  <h2 class="pm-asset-admin__session-title">Authentication required</h2>
                  <p class="pm-asset-admin__session-copy">
                    Queue review is admin-gated because status mutation and deployment operate on
                    the protected issuance workflow.
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
                Review access enabled
              </span>
              <h2 class="pm-asset-admin__session-title">Authenticated and ready</h2>
              <p class="pm-asset-admin__session-copy">
                List review, status decisions, and deployment actions are available from the
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
              <h2 class="pm-tool-section__title">Review queue and guarded actions</h2>
            </div>
            <p class="pm-admin-section-note">
              Read the current request set, focus one request at a time, then move into review or
              deployment with the dedicated admin flows.
            </p>
          </div>

          <div class="pm-asset-admin__lane-grid">
            <section class="pm-asset-admin__lane">
              <div class="pm-asset-admin__lane-head">
                <div>
                  <p class="pm-asset-admin__lane-kicker">Inspect</p>
                  <h3 class="pm-asset-admin__lane-title">Review incoming requests</h3>
                </div>
                <span class="pm-market-chip">Admin</span>
              </div>
              <p class="pm-asset-admin__lane-copy">
                Filter the current review queue, select a request to inspect, and keep the request
                context pinned while you move through approval or deployment.
              </p>

              <form
                class="pm-market-form"
                onSubmit={event => {
                  event.preventDefault();
                  void refreshQueue();
                }}
              >
                <div class="pm-market-fields">
                  <label class="pm-field">
                    <span class="pm-field__label">Status filter</span>
                    <select
                      class="pm-field__input"
                      value={statusFilter()}
                      onInput={event =>
                        setStatusFilter(event.currentTarget.value as StatusFilterValue)
                      }
                    >
                      <For each={STATUS_FILTER_OPTIONS}>
                        {option => <option value={option.value}>{option.label}</option>}
                      </For>
                    </select>
                  </label>

                  <label class="pm-field">
                    <span class="pm-field__label">Limit</span>
                    <select
                      class="pm-field__input"
                      value={String(limit())}
                      onInput={event =>
                        setLimit(Number.parseInt(event.currentTarget.value, 10) || DEFAULT_LIMIT)
                      }
                    >
                      <option value="12">12</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </select>
                  </label>

                  <label class="pm-field">
                    <span class="pm-field__label">Offset</span>
                    <input
                      class="pm-field__input"
                      type="number"
                      min="0"
                      value={String(offset())}
                      onInput={event =>
                        setOffset(Math.max(0, Number.parseInt(event.currentTarget.value, 10) || 0))
                      }
                    />
                  </label>
                </div>

                <div class="pm-market-actions">
                  <button class="pm-button pm-button--primary" type="submit" disabled={listTask.pending()}>
                    {listTask.pending() ? "Refreshing..." : "Refresh review queue"}
                  </button>
                </div>
              </form>

              <Show when={queueError()}>
                {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
              </Show>

              <div class="pm-asset-action-stack">
                <Show
                  when={currentQueue().length > 0}
                  fallback={
                    <div class="pm-market-result">
                      <div class="pm-market-result__header">
                        <div>
                          <p class="pm-market-result__eyebrow">Queue snapshot</p>
                          <h3 class="pm-market-result__title">No requests in this result set</h3>
                        </div>
                      </div>
                      <div class="pm-market-result__grid">
                        <div class="pm-market-result__detail--full">
                          <span class="pm-market-result__label">Operator note</span>
                          <span class="pm-market-result__value">
                            Adjust the filter or offset, then refresh the queue again.
                          </span>
                        </div>
                      </div>
                    </div>
                  }
                >
                  <For each={currentQueue()}>
                    {request => (
                      <QueueCard
                        request={request}
                        selected={request.id === selectedRequestId()}
                        onSelect={() => focusRequest(request)}
                      />
                    )}
                  </For>
                </Show>
              </div>
            </section>

            <section class="pm-asset-admin__lane pm-asset-admin__lane--admin">
              <div class="pm-asset-admin__lane-head">
                <div>
                  <p class="pm-asset-admin__lane-kicker">Operate</p>
                  <h3 class="pm-asset-admin__lane-title">Run guarded review actions</h3>
                </div>
                <span class="pm-market-chip">Admin</span>
              </div>
              <p class="pm-asset-admin__lane-copy">
                Launch the review desk to change request status, or open the deployment desk once a
                request has cleared approval and is ready to become a live asset.
              </p>

              <div class="pm-asset-action-stack">
                <ActionCard
                  actionLabel="Write"
                  endpoint="PUT /admin/asset-requests/{request_id}/status"
                  title="Review desk"
                  copy="Move a request through submitted, under-review, approved, or rejected states without leaving the current queue context."
                  detail="Use for review decisions and issuer feedback"
                  onOpen={() => openModal("review-desk")}
                  tone="admin"
                />
                <ActionCard
                  actionLabel="Write"
                  endpoint="POST /admin/asset-requests/{request_id}/deploy"
                  title="Deploy request"
                  copy="Create a live asset from an approved request or attach deployment state to an existing proposal match."
                  detail="Use after approval when issuance is ready"
                  onOpen={() => openModal("deploy-desk")}
                  tone="admin"
                />
              </div>

              <Show when={updateStatusTask.data()}>
                {request => <SelectedRequestResult request={request()} />}
              </Show>

              <Show when={latestDeploy()}>
                {response => <DeployResult data={response()} />}
              </Show>
            </section>
          </div>
        </section>

        <div class="pm-asset-market__lower-grid">
          <section class="pm-detail__card pm-asset-market__panel">
            <p class="pm-asset-market__panel-kicker">Focused request</p>
            <h2 class="pm-detail__card-title">Current selection</h2>
            <p class="pm-detail__card-copy pm-asset-market__panel-copy">
              Keep one request in focus while you inspect issuer context, pricing terms, and review
              state.
            </p>

            <Show
              when={currentSelectedRequest()}
              fallback={
                <p class="pm-asset-market__panel-subcopy">
                  Select a request from the queue to inspect its full review snapshot.
                </p>
              }
            >
              {request => <SelectedRequestResult request={request()} />}
            </Show>
          </section>

          <section class="pm-detail__card pm-asset-market__panel">
            <p class="pm-asset-market__panel-kicker">Lifecycle</p>
            <h2 class="pm-detail__card-title">Review and deployment state</h2>
            <p class="pm-detail__card-copy pm-asset-market__panel-copy">
              Track the latest review notes and deployment attachment for the focused request.
            </p>

            <Show
              when={currentSelectedRequest()}
              fallback={
                <p class="pm-asset-market__panel-subcopy">
                  No request is currently selected for lifecycle detail.
                </p>
              }
            >
              {request => (
                <div class="pm-asset-market__stat-rows">
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Status</span>
                    <span class="pm-asset-market__stat-value">
                      {formatStatusLabel(request().status)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Reviewed at</span>
                    <span class="pm-asset-market__stat-value">
                      {formatDateTimeLabel(request().reviewed_at)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Deployed at</span>
                    <span class="pm-asset-market__stat-value">
                      {formatDateTimeLabel(request().deployed_at)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Asset address</span>
                    <span class="pm-asset-market__stat-value">
                      {request().deployed_asset_address ?? "Not deployed"}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Deployment transaction</span>
                    <span class="pm-asset-market__stat-value">
                      {request().deployment_tx_hash ?? "Not deployed"}
                    </span>
                  </div>
                </div>
              )}
            </Show>
          </section>
        </div>
      </div>

      <AdminModal
        open={activeModal() === "review-desk"}
        onClose={() => setActiveModal(null)}
        eyebrow="Asset request admin"
        title="Review desk"
        subtitle="Change request status and preserve review context in one focused workflow."
        size="wide"
      >
        <AdminGate
          connected={isAdminConnected()}
          walletLabel={adminWalletLabel()}
          onConnect={auth.openAuthDialog}
        >
          <AssetRequestStatusPanel
            requestId={selectedRequestId()}
            request={currentSelectedRequest()}
            status={statusDraft()}
            statusOptions={statusOptions()}
            reviewNotes={reviewNotes()}
            pending={updateStatusTask.pending()}
            error={statusWriteError()}
            onRequestIdInput={handleRequestIdInput}
            onStatusInput={setStatusDraft}
            onReviewNotesInput={setReviewNotes}
            onSubmit={() => void handleStatusSubmit()}
          />
        </AdminGate>
      </AdminModal>

      <AdminModal
        open={activeModal() === "deploy-desk"}
        onClose={() => setActiveModal(null)}
        eyebrow="Asset request admin"
        title="Deploy request"
        subtitle="Create or attach a live asset from an approved asset request."
        size="wide"
      >
        <AdminGate
          connected={isAdminConnected()}
          walletLabel={adminWalletLabel()}
          onConnect={auth.openAuthDialog}
        >
          <AssetRequestDeployPanel
            requestId={selectedRequestId()}
            request={currentSelectedRequest()}
            pending={deployTask.pending()}
            error={deployError()}
            onRequestIdInput={handleRequestIdInput}
            onSubmit={() => void handleDeploySubmit()}
          />
        </AdminGate>
      </AdminModal>
    </>
  );
}
