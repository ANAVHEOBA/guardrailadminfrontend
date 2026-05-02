import { Show, createEffect, createMemo, createSignal } from "solid-js";

import AdminModal from "~/components/AdminModal";
import { useAdminAuth } from "~/lib/admin-auth-context";
import {
  readAdminToken,
  treasuryClient,
  type AssetResponse,
  type TreasuryAssetResponse,
  type TreasuryPaymentTokenApprovalResponse,
  type TreasuryStatusResponse,
} from "~/lib";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";

import {
  formatDateTime,
  formatNumericString,
  truncateMiddle,
} from "./format";

type TreasuryModalView =
  | "fetch-status"
  | "fetch-asset"
  | "approve-payment-token"
  | "deposit-liquidity"
  | "release-capital"
  | "deposit-yield"
  | "pause-state"
  | "emergency-withdraw";

interface AssetDetailTreasurySectionProps {
  asset: AssetResponse;
  treasury: TreasuryAssetResponse | null;
  onTreasuryUpdated?: (treasury: TreasuryAssetResponse) => void;
}

interface ReleaseCapitalDraft {
  amount: string;
  recipient_wallet: string;
  reference_id: string;
}

interface DepositYieldDraft {
  amount: string;
  data: string;
}

interface EmergencyWithdrawDraft {
  token_address: string;
  amount: string;
  recipient_wallet: string;
}

function requireTextValue(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function formatPauseState(paused: boolean) {
  return paused ? "Paused" : "Active";
}

export default function AssetDetailTreasurySection(
  props: AssetDetailTreasurySectionProps,
) {
  let previousAssetAddress: string | null = null;
  const auth = useAdminAuth();
  const statusTask = useAsyncTask(() => treasuryClient.fetchStatus());
  const assetTask = useAsyncTask(() => treasuryClient.fetchAsset(props.asset.asset_address));
  const approveTask = useAsyncTask((token: string, amount: string) =>
    treasuryClient.approvePaymentToken(token, { amount }),
  );
  const depositTask = useAsyncTask((token: string, amount: string) =>
    treasuryClient.depositAssetLiquidity(token, {
      asset_address: props.asset.asset_address,
      amount,
    }),
  );
  const releaseTask = useAsyncTask(
    (token: string, amount: string, recipientWallet: string, referenceId: string) =>
      treasuryClient.releaseCapital(token, {
        asset_address: props.asset.asset_address,
        amount,
        recipient_wallet: recipientWallet,
        reference_id: referenceId,
      }),
  );
  const depositYieldTask = useAsyncTask((token: string, amount: string, data?: string | null) =>
    treasuryClient.depositYield(token, {
      asset_address: props.asset.asset_address,
      amount,
      data,
    }),
  );
  const pauseTask = useAsyncTask((token: string) => treasuryClient.pause(token));
  const unpauseTask = useAsyncTask((token: string) => treasuryClient.unpause(token));
  const emergencyWithdrawTask = useAsyncTask(
    (token: string, tokenAddress: string, amount: string, recipientWallet: string) =>
      treasuryClient.emergencyWithdraw(token, {
        token_address: tokenAddress,
        amount,
        recipient_wallet: recipientWallet,
      }),
  );
  const [activeModal, setActiveModal] = createSignal<TreasuryModalView | null>(null);
  const [statusError, setStatusError] = createSignal<string | null>(null);
  const [assetError, setAssetError] = createSignal<string | null>(null);
  const [approveError, setApproveError] = createSignal<string | null>(null);
  const [depositError, setDepositError] = createSignal<string | null>(null);
  const [releaseError, setReleaseError] = createSignal<string | null>(null);
  const [depositYieldError, setDepositYieldError] = createSignal<string | null>(null);
  const [pauseError, setPauseError] = createSignal<string | null>(null);
  const [emergencyWithdrawError, setEmergencyWithdrawError] = createSignal<string | null>(null);
  const [approveAmount, setApproveAmount] = createSignal("");
  const [depositAmount, setDepositAmount] = createSignal("");
  const [releaseDraft, setReleaseDraft] = createSignal<ReleaseCapitalDraft>({
    amount: "",
    recipient_wallet: "",
    reference_id: "",
  });
  const [depositYieldDraft, setDepositYieldDraft] = createSignal<DepositYieldDraft>({
    amount: "",
    data: "",
  });
  const [emergencyWithdrawDraft, setEmergencyWithdrawDraft] =
    createSignal<EmergencyWithdrawDraft>({
      token_address: props.asset.payment_token_address,
      amount: "",
      recipient_wallet: "",
    });
  const [statusSnapshot, setStatusSnapshot] = createSignal<TreasuryStatusResponse | null>(null);
  const [assetSnapshot, setAssetSnapshot] = createSignal<TreasuryAssetResponse | null>(props.treasury);
  const [approvalSnapshot, setApprovalSnapshot] =
    createSignal<TreasuryPaymentTokenApprovalResponse | null>(null);

  const adminToken = () => auth.session()?.token ?? readAdminToken();
  const isAdminConnected = () => Boolean(auth.profile() && adminToken());
  const currentStatus = createMemo(() => {
    const writeStatus =
      pauseTask.data()?.treasury ??
      unpauseTask.data()?.treasury ??
      emergencyWithdrawTask.data()?.treasury ??
      null;

    return writeStatus ?? statusSnapshot();
  });
  const currentAssetTreasury = createMemo(() => {
    const writeAsset =
      depositTask.data()?.asset ??
      releaseTask.data()?.asset ??
      depositYieldTask.data()?.asset ??
      null;

    return writeAsset ?? assetSnapshot() ?? props.treasury;
  });

  createEffect(() => {
    const assetAddress = props.asset.asset_address;

    if (assetAddress === previousAssetAddress) {
      return;
    }

    previousAssetAddress = assetAddress;
    setActiveModal(null);
    setStatusError(null);
    setAssetError(null);
    setApproveError(null);
    setDepositError(null);
    setReleaseError(null);
    setDepositYieldError(null);
    setPauseError(null);
    setEmergencyWithdrawError(null);
    setApproveAmount("");
    setDepositAmount("");
    setReleaseDraft({
      amount: "",
      recipient_wallet: "",
      reference_id: "",
    });
    setDepositYieldDraft({
      amount: "",
      data: "",
    });
    setEmergencyWithdrawDraft({
      token_address: props.asset.payment_token_address,
      amount: "",
      recipient_wallet: "",
    });
    setStatusSnapshot(null);
    setAssetSnapshot(props.treasury);
    setApprovalSnapshot(null);
    statusTask.reset();
    assetTask.reset();
    approveTask.reset();
    depositTask.reset();
    releaseTask.reset();
    depositYieldTask.reset();
    pauseTask.reset();
    unpauseTask.reset();
    emergencyWithdrawTask.reset();
  });

  const syncAssetTreasury = (assetTreasury: TreasuryAssetResponse) => {
    setAssetSnapshot(assetTreasury);
    props.onTreasuryUpdated?.(assetTreasury);
  };

  const syncTreasuryWrite = (response: { treasury: TreasuryStatusResponse; asset?: TreasuryAssetResponse }) => {
    setStatusSnapshot(response.treasury);

    if (response.asset) {
      syncAssetTreasury(response.asset);
    }
  };

  async function runStatusLookup() {
    setStatusError(null);

    try {
      const response = await statusTask.run();
      setStatusSnapshot(response);
      return response;
    } catch (error) {
      setStatusError(getErrorMessage(error));
      return null;
    }
  }

  async function runAssetLookup() {
    setAssetError(null);

    try {
      const response = await assetTask.run();
      syncAssetTreasury(response);
      return response;
    } catch (error) {
      setAssetError(getErrorMessage(error));
      return null;
    }
  }

  function openModal(view: TreasuryModalView) {
    setStatusError(null);
    setAssetError(null);
    setApproveError(null);
    setDepositError(null);
    setReleaseError(null);
    setDepositYieldError(null);
    setPauseError(null);
    setEmergencyWithdrawError(null);

    if (view === "fetch-status" || view === "pause-state") {
      void runStatusLookup();
    }

    if (view === "fetch-asset") {
      void runAssetLookup();
    }

    setActiveModal(view);
  }

  async function handleApproveSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setApproveError("Connect an admin wallet first.");
      return;
    }

    setApproveError(null);

    try {
      const response = await approveTask.run(
        token,
        requireTextValue(approveAmount(), "Amount"),
      );
      setApprovalSnapshot(response);
    } catch (error) {
      setApproveError(getErrorMessage(error));
    }
  }

  async function handleDepositSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setDepositError("Connect an admin wallet first.");
      return;
    }

    setDepositError(null);

    try {
      const response = await depositTask.run(
        token,
        requireTextValue(depositAmount(), "Amount"),
      );
      syncTreasuryWrite(response);
    } catch (error) {
      setDepositError(getErrorMessage(error));
    }
  }

  async function handleReleaseCapitalSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setReleaseError("Connect an admin wallet first.");
      return;
    }

    setReleaseError(null);

    try {
      const draft = releaseDraft();
      const response = await releaseTask.run(
        token,
        requireTextValue(draft.amount, "Amount"),
        requireTextValue(draft.recipient_wallet, "Recipient wallet"),
        requireTextValue(draft.reference_id, "Reference ID"),
      );
      syncTreasuryWrite(response);
    } catch (error) {
      setReleaseError(getErrorMessage(error));
    }
  }

  async function handleDepositYieldSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setDepositYieldError("Connect an admin wallet first.");
      return;
    }

    setDepositYieldError(null);

    try {
      const draft = depositYieldDraft();
      const response = await depositYieldTask.run(
        token,
        requireTextValue(draft.amount, "Amount"),
        draft.data.trim() || null,
      );
      syncTreasuryWrite(response);
    } catch (error) {
      setDepositYieldError(getErrorMessage(error));
    }
  }

  async function runPause(action: "pause" | "unpause") {
    const token = adminToken();

    if (!token) {
      setPauseError("Connect an admin wallet first.");
      return;
    }

    setPauseError(null);

    try {
      const response =
        action === "pause" ? await pauseTask.run(token) : await unpauseTask.run(token);
      setStatusSnapshot(response.treasury);
    } catch (error) {
      setPauseError(getErrorMessage(error));
    }
  }

  async function handleEmergencyWithdrawSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setEmergencyWithdrawError("Connect an admin wallet first.");
      return;
    }

    setEmergencyWithdrawError(null);

    try {
      const draft = emergencyWithdrawDraft();
      const response = await emergencyWithdrawTask.run(
        token,
        requireTextValue(draft.token_address, "Token address"),
        requireTextValue(draft.amount, "Amount"),
        requireTextValue(draft.recipient_wallet, "Recipient wallet"),
      );
      setStatusSnapshot(response.treasury);
    } catch (error) {
      setEmergencyWithdrawError(getErrorMessage(error));
    }
  }

  function renderAdminGate(copy: string) {
    return (
      <section class="pm-admin-gate">
        <div>
          <p class="pm-admin-gate__eyebrow">Admin authentication required</p>
          <h3 class="pm-admin-gate__title">Connect an allowlisted wallet</h3>
          <p class="pm-admin-gate__copy">{copy}</p>
        </div>

        <div class="pm-admin-gate__actions">
          <button class="pm-button pm-button--primary" type="button" onClick={auth.openAuthDialog}>
            Connect admin wallet
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div class="pm-asset-market__lower-grid">
        <section class="pm-detail__card pm-asset-market__panel">
          <p class="pm-asset-market__panel-kicker">Treasury</p>
          <h2 class="pm-detail__card-title">Liquidity and settlement</h2>
          <p class="pm-detail__card-copy pm-asset-market__panel-copy">
            Keep the treasury flow attached to the asset. Read global treasury state, inspect this
            asset’s balance, and open only the actions needed to fund or manage liquidity.
          </p>

          <div class="pm-asset-market__fact-grid">
            <div class="pm-asset-market__fact">
              <span class="pm-asset-market__fact-label">Treasury address</span>
              <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                {truncateMiddle(props.asset.treasury_address)}
              </span>
            </div>
            <div class="pm-asset-market__fact">
              <span class="pm-asset-market__fact-label">Payment token</span>
              <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                {truncateMiddle(props.asset.payment_token_address)}
              </span>
            </div>
          </div>

          <Show
            when={currentAssetTreasury()}
            fallback={
              <p class="pm-asset-market__panel-subcopy">
                No treasury asset snapshot is currently cached for this asset.
              </p>
            }
          >
            {treasury => (
              <div class="pm-asset-market__stat-rows">
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Balance</span>
                  <span class="pm-asset-market__stat-value">
                    {formatNumericString(treasury().balance)}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Reserved yield</span>
                  <span class="pm-asset-market__stat-value">
                    {formatNumericString(treasury().reserved_yield)}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Available liquidity</span>
                  <span class="pm-asset-market__stat-value">
                    {formatNumericString(treasury().available_liquidity)}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Updated</span>
                  <span class="pm-asset-market__stat-value">
                    {formatDateTime(treasury().updated_at)}
                  </span>
                </div>
              </div>
            )}
          </Show>
        </section>

        <section class="pm-detail__card pm-asset-market__panel">
          <p class="pm-asset-market__panel-kicker">Treasury tools</p>
          <h2 class="pm-detail__card-title">Core flow</h2>
          <div class="pm-asset-market__control-grid">
            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("fetch-status")}
            >
              <span class="pm-asset-market__control-button-title">Fetch treasury status</span>
              <span class="pm-asset-market__control-button-copy">
                Read global treasury state and pause status.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("fetch-asset")}
            >
              <span class="pm-asset-market__control-button-title">Fetch asset treasury</span>
              <span class="pm-asset-market__control-button-copy">
                Refresh this asset’s balance and available liquidity.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("approve-payment-token")}
            >
              <span class="pm-asset-market__control-button-title">Approve payment token</span>
              <span class="pm-asset-market__control-button-copy">
                Approve treasury token spend from the admin wallet.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("deposit-liquidity")}
            >
              <span class="pm-asset-market__control-button-title">Deposit liquidity</span>
              <span class="pm-asset-market__control-button-copy">
                Move payment-token liquidity into this asset’s treasury bucket.
              </span>
            </button>
          </div>

          <div class="pm-asset-market__about-head">
            <p class="pm-asset-market__panel-kicker">Advanced treasury</p>
            <p class="pm-asset-market__panel-subcopy">
              Release capital, deposit yield, manage pause state, or trigger emergency withdraw only
              when you need deeper treasury operations.
            </p>
          </div>

          <div class="pm-asset-market__control-grid">
            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("release-capital")}
            >
              <span class="pm-asset-market__control-button-title">Release capital</span>
              <span class="pm-asset-market__control-button-copy">
                Send treasury capital to a recipient wallet with a reference ID.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("deposit-yield")}
            >
              <span class="pm-asset-market__control-button-title">Deposit yield</span>
              <span class="pm-asset-market__control-button-copy">
                Add reserved yield for this asset and attach optional data.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("pause-state")}
            >
              <span class="pm-asset-market__control-button-title">Pause state</span>
              <span class="pm-asset-market__control-button-copy">
                Read or toggle the global treasury pause flag.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("emergency-withdraw")}
            >
              <span class="pm-asset-market__control-button-title">Emergency withdraw</span>
              <span class="pm-asset-market__control-button-copy">
                Withdraw a token amount to a recipient wallet.
              </span>
            </button>
          </div>
        </section>
      </div>

      <AdminModal
        open={activeModal() === "fetch-status"}
        onClose={() => setActiveModal(null)}
        eyebrow="Treasury"
        title="Fetch treasury status"
        subtitle="Read the current global treasury state."
      >
        <div class="pm-asset-market__modal-stack">
          <div class="pm-market-actions">
            <button class="pm-button pm-button--primary" type="button" disabled={statusTask.pending()} onClick={() => void runStatusLookup()}>
              {statusTask.pending() ? "Loading..." : "Refresh status"}
            </button>
          </div>

          <Show when={statusError()}>
            {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
          </Show>

          <Show when={currentStatus()}>
            {status => (
              <section class="pm-asset-market__modal-result">
                <div class="pm-asset-market__fact-grid">
                  <div class="pm-asset-market__fact">
                    <span class="pm-asset-market__fact-label">Treasury address</span>
                    <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                      {truncateMiddle(status().treasury_address)}
                    </span>
                  </div>
                  <div class="pm-asset-market__fact">
                    <span class="pm-asset-market__fact-label">Payment token</span>
                    <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                      {truncateMiddle(status().payment_token_address)}
                    </span>
                  </div>
                </div>
                <div class="pm-asset-market__stat-rows">
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Pause state</span>
                    <span class="pm-asset-market__stat-value">
                      {formatPauseState(status().paused)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Tracked balance</span>
                    <span class="pm-asset-market__stat-value">
                      {formatNumericString(status().total_tracked_balance)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Reserved yield</span>
                    <span class="pm-asset-market__stat-value">
                      {formatNumericString(status().total_reserved_yield)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Updated</span>
                    <span class="pm-asset-market__stat-value">
                      {formatDateTime(status().updated_at)}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "fetch-asset"}
        onClose={() => setActiveModal(null)}
        eyebrow="Treasury"
        title="Fetch asset treasury"
        subtitle={`Refresh the treasury snapshot for ${props.asset.name}.`}
      >
        <div class="pm-asset-market__modal-stack">
          <div class="pm-asset-market__fact-grid">
            <div class="pm-asset-market__fact">
              <span class="pm-asset-market__fact-label">Asset</span>
              <span class="pm-asset-market__fact-value">{props.asset.name}</span>
            </div>
            <div class="pm-asset-market__fact">
              <span class="pm-asset-market__fact-label">Address</span>
              <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                {truncateMiddle(props.asset.asset_address)}
              </span>
            </div>
          </div>

          <div class="pm-market-actions">
            <button class="pm-button pm-button--primary" type="button" disabled={assetTask.pending()} onClick={() => void runAssetLookup()}>
              {assetTask.pending() ? "Loading..." : "Refresh asset treasury"}
            </button>
          </div>

          <Show when={assetError()}>
            {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
          </Show>

          <Show when={currentAssetTreasury()}>
            {treasury => (
              <section class="pm-asset-market__modal-result">
                <div class="pm-asset-market__stat-rows">
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Balance</span>
                    <span class="pm-asset-market__stat-value">
                      {formatNumericString(treasury().balance)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Reserved yield</span>
                    <span class="pm-asset-market__stat-value">
                      {formatNumericString(treasury().reserved_yield)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Available liquidity</span>
                    <span class="pm-asset-market__stat-value">
                      {formatNumericString(treasury().available_liquidity)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Updated</span>
                    <span class="pm-asset-market__stat-value">
                      {formatDateTime(treasury().updated_at)}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "approve-payment-token"}
        onClose={() => setActiveModal(null)}
        eyebrow="Treasury"
        title="Approve payment token"
        subtitle="Approve treasury token spend from the admin wallet."
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can approve payment-token spend.")}
        >
          <div class="pm-asset-market__modal-stack">
            <form class="pm-market-form" onSubmit={handleApproveSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Amount</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={approveAmount()}
                    onInput={event => setApproveAmount(event.currentTarget.value)}
                  />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={approveTask.pending()}>
                  {approveTask.pending() ? "Submitting..." : "Approve payment token"}
                </button>
              </div>
            </form>

            <Show when={approveError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={approvalSnapshot()}>
              {approval => (
                <section class="pm-asset-market__modal-result">
                  <div class="pm-asset-market__fact-grid">
                    <div class="pm-asset-market__fact">
                      <span class="pm-asset-market__fact-label">Transaction</span>
                      <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                        {truncateMiddle(approval().tx_hash)}
                      </span>
                    </div>
                    <div class="pm-asset-market__fact">
                      <span class="pm-asset-market__fact-label">Approved amount</span>
                      <span class="pm-asset-market__fact-value">
                        {formatNumericString(approval().approved_amount)}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </Show>
          </div>
        </Show>
      </AdminModal>

      <AdminModal
        open={activeModal() === "deposit-liquidity"}
        onClose={() => setActiveModal(null)}
        eyebrow="Treasury"
        title="Deposit asset liquidity"
        subtitle={`Deposit payment-token liquidity into ${props.asset.name}.`}
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can deposit treasury liquidity.")}
        >
          <div class="pm-asset-market__modal-stack">
            <form class="pm-market-form" onSubmit={handleDepositSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Amount</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={depositAmount()}
                    onInput={event => setDepositAmount(event.currentTarget.value)}
                  />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={depositTask.pending()}>
                  {depositTask.pending() ? "Submitting..." : "Deposit liquidity"}
                </button>
              </div>
            </form>

            <Show when={depositError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={depositTask.data()}>
              {response => (
                <section class="pm-asset-market__modal-result">
                  <div class="pm-asset-market__fact-grid">
                    <div class="pm-asset-market__fact">
                      <span class="pm-asset-market__fact-label">Transaction</span>
                      <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                        {truncateMiddle(response().tx_hash)}
                      </span>
                    </div>
                    <div class="pm-asset-market__fact">
                      <span class="pm-asset-market__fact-label">Available liquidity</span>
                      <span class="pm-asset-market__fact-value">
                        {formatNumericString(response().asset.available_liquidity)}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </Show>
          </div>
        </Show>
      </AdminModal>

      <AdminModal
        open={activeModal() === "release-capital"}
        onClose={() => setActiveModal(null)}
        eyebrow="Treasury"
        title="Release capital"
        subtitle={`Send capital from ${props.asset.name} treasury to a recipient wallet.`}
        size="wide"
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can release treasury capital.")}
        >
          <div class="pm-asset-market__modal-stack">
            <form class="pm-market-form" onSubmit={handleReleaseCapitalSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field">
                  <span class="pm-field__label">Amount</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={releaseDraft().amount}
                    onInput={event =>
                      setReleaseDraft(current => ({
                        ...current,
                        amount: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Reference ID</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={releaseDraft().reference_id}
                    onInput={event =>
                      setReleaseDraft(current => ({
                        ...current,
                        reference_id: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Recipient wallet</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={releaseDraft().recipient_wallet}
                    onInput={event =>
                      setReleaseDraft(current => ({
                        ...current,
                        recipient_wallet: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={releaseTask.pending()}>
                  {releaseTask.pending() ? "Submitting..." : "Release capital"}
                </button>
              </div>
            </form>

            <Show when={releaseError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={releaseTask.data()}>
              {response => (
                <section class="pm-asset-market__modal-result">
                  <div class="pm-asset-market__fact-grid">
                    <div class="pm-asset-market__fact">
                      <span class="pm-asset-market__fact-label">Transaction</span>
                      <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                        {truncateMiddle(response().tx_hash)}
                      </span>
                    </div>
                    <div class="pm-asset-market__fact">
                      <span class="pm-asset-market__fact-label">Balance</span>
                      <span class="pm-asset-market__fact-value">
                        {formatNumericString(response().asset.balance)}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </Show>
          </div>
        </Show>
      </AdminModal>

      <AdminModal
        open={activeModal() === "deposit-yield"}
        onClose={() => setActiveModal(null)}
        eyebrow="Treasury"
        title="Deposit yield"
        subtitle={`Increase reserved yield for ${props.asset.name}.`}
        size="wide"
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can deposit yield.")}
        >
          <div class="pm-asset-market__modal-stack">
            <form class="pm-market-form" onSubmit={handleDepositYieldSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field">
                  <span class="pm-field__label">Amount</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={depositYieldDraft().amount}
                    onInput={event =>
                      setDepositYieldDraft(current => ({
                        ...current,
                        amount: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Data</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={depositYieldDraft().data}
                    onInput={event =>
                      setDepositYieldDraft(current => ({
                        ...current,
                        data: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={depositYieldTask.pending()}>
                  {depositYieldTask.pending() ? "Submitting..." : "Deposit yield"}
                </button>
              </div>
            </form>

            <Show when={depositYieldError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={depositYieldTask.data()}>
              {response => (
                <section class="pm-asset-market__modal-result">
                  <div class="pm-asset-market__fact-grid">
                    <div class="pm-asset-market__fact">
                      <span class="pm-asset-market__fact-label">Transaction</span>
                      <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                        {truncateMiddle(response().tx_hash)}
                      </span>
                    </div>
                    <div class="pm-asset-market__fact">
                      <span class="pm-asset-market__fact-label">Reserved yield</span>
                      <span class="pm-asset-market__fact-value">
                        {formatNumericString(response().asset.reserved_yield)}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </Show>
          </div>
        </Show>
      </AdminModal>

      <AdminModal
        open={activeModal() === "pause-state"}
        onClose={() => setActiveModal(null)}
        eyebrow="Treasury"
        title="Pause state"
        subtitle="Read and control the global treasury pause flag."
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can change treasury pause state.")}
        >
          <div class="pm-asset-market__modal-stack">
            <Show when={statusError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={currentStatus()}>
              {status => (
                <section class="pm-asset-market__modal-result">
                  <div class="pm-asset-market__stat-rows">
                    <div class="pm-asset-market__stat-row">
                      <span class="pm-asset-market__stat-label">Pause state</span>
                      <span class="pm-asset-market__stat-value">
                        {formatPauseState(status().paused)}
                      </span>
                    </div>
                    <div class="pm-asset-market__stat-row">
                      <span class="pm-asset-market__stat-label">Updated</span>
                      <span class="pm-asset-market__stat-value">
                        {formatDateTime(status().updated_at)}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </Show>

            <div class="pm-market-actions pm-market-actions--group">
              <button class="pm-button pm-button--primary" type="button" disabled={pauseTask.pending()} onClick={() => void runPause("pause")}>
                {pauseTask.pending() ? "Pausing..." : "Pause treasury"}
              </button>
              <button class="pm-button pm-button--ghost" type="button" disabled={unpauseTask.pending()} onClick={() => void runPause("unpause")}>
                {unpauseTask.pending() ? "Unpausing..." : "Unpause treasury"}
              </button>
            </div>

            <Show when={pauseError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>
          </div>
        </Show>
      </AdminModal>

      <AdminModal
        open={activeModal() === "emergency-withdraw"}
        onClose={() => setActiveModal(null)}
        eyebrow="Treasury"
        title="Emergency withdraw"
        subtitle="Withdraw a token amount to a recipient wallet."
        size="wide"
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can run an emergency withdraw.")}
        >
          <div class="pm-asset-market__modal-stack">
            <form class="pm-market-form" onSubmit={handleEmergencyWithdrawSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Token address</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={emergencyWithdrawDraft().token_address}
                    onInput={event =>
                      setEmergencyWithdrawDraft(current => ({
                        ...current,
                        token_address: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Amount</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={emergencyWithdrawDraft().amount}
                    onInput={event =>
                      setEmergencyWithdrawDraft(current => ({
                        ...current,
                        amount: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Recipient wallet</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={emergencyWithdrawDraft().recipient_wallet}
                    onInput={event =>
                      setEmergencyWithdrawDraft(current => ({
                        ...current,
                        recipient_wallet: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={emergencyWithdrawTask.pending()}>
                  {emergencyWithdrawTask.pending() ? "Submitting..." : "Emergency withdraw"}
                </button>
              </div>
            </form>

            <Show when={emergencyWithdrawError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={emergencyWithdrawTask.data()}>
              {response => (
                <section class="pm-asset-market__modal-result">
                  <div class="pm-asset-market__fact-grid">
                    <div class="pm-asset-market__fact">
                      <span class="pm-asset-market__fact-label">Transaction</span>
                      <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                        {truncateMiddle(response().tx_hash)}
                      </span>
                    </div>
                    <div class="pm-asset-market__fact">
                      <span class="pm-asset-market__fact-label">Pause state</span>
                      <span class="pm-asset-market__fact-value">
                        {formatPauseState(response().treasury.paused)}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </Show>
          </div>
        </Show>
      </AdminModal>
    </>
  );
}
