import { createSignal } from "solid-js";

import AdminJsonResult from "./AdminJsonResult";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";
import { readAdminToken, treasuryClient } from "~/lib";
import { readRequiredText } from "./admin-form-utils";

export default function AdminTreasuryManager() {
  const statusTask = useAsyncTask(() => treasuryClient.fetchStatus());
  const assetTask = useAsyncTask((assetAddress: string) => treasuryClient.fetchAsset(assetAddress));
  const approveTask = useAsyncTask((token: string, amount: string) =>
    treasuryClient.approvePaymentToken(token, { amount }),
  );
  const depositTask = useAsyncTask((token: string, assetAddress: string, amount: string) =>
    treasuryClient.depositAssetLiquidity(token, {
      asset_address: assetAddress,
      amount,
    }),
  );
  const pauseTask = useAsyncTask((token: string) => treasuryClient.pause(token));
  const unpauseTask = useAsyncTask((token: string) => treasuryClient.unpause(token));
  const [assetError, setAssetError] = createSignal<string | null>(null);
  const [approveError, setApproveError] = createSignal<string | null>(null);
  const [depositError, setDepositError] = createSignal<string | null>(null);
  const [pauseError, setPauseError] = createSignal<string | null>(null);

  const adminToken = () => readAdminToken();

  async function handleAssetLookup(event: SubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setAssetError(null);

    try {
      await assetTask.run(readRequiredText(formData, "asset_address", "Asset address"));
    } catch (error) {
      setAssetError(getErrorMessage(error));
    }
  }

  async function handleApproveSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setApproveError("Connect an admin wallet first.");
      return;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setApproveError(null);

    try {
      await approveTask.run(token, readRequiredText(formData, "amount", "Amount"));
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

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setDepositError(null);

    try {
      await depositTask.run(
        token,
        readRequiredText(formData, "asset_address", "Asset address"),
        readRequiredText(formData, "amount", "Amount"),
      );
    } catch (error) {
      setDepositError(getErrorMessage(error));
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
      if (action === "pause") {
        await pauseTask.run(token);
      } else {
        await unpauseTask.run(token);
      }
    } catch (error) {
      setPauseError(getErrorMessage(error));
    }
  }

  return (
    <div class="pm-tool-stack">
      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">Public endpoints</p>
            <h2 class="pm-tool-section__title">Treasury reads</h2>
          </div>
          <p class="pm-admin-section-note">Read global treasury state and per-asset liquidity snapshots.</p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">GET /treasury</p>
                <h3 class="pm-market-card__title">Treasury status</h3>
              </div>
            </div>
            <div class="pm-market-actions">
              <button
                class="pm-button pm-button--primary"
                type="button"
                disabled={statusTask.pending()}
                onClick={() => void statusTask.run()}
              >
                {statusTask.pending() ? "Loading..." : "Fetch treasury"}
              </button>
            </div>
            {statusTask.error() && (
              <p class="pm-market-feedback pm-market-feedback--error">
                {getErrorMessage(statusTask.error())}
              </p>
            )}
            {statusTask.data() && <AdminJsonResult value={statusTask.data()} />}
          </section>

          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">GET /treasury/assets/{'{asset_address}'}</p>
                <h3 class="pm-market-card__title">Treasury asset</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleAssetLookup}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Asset address</span>
                  <input class="pm-field__input" name="asset_address" type="text" />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={assetTask.pending()}>
                  {assetTask.pending() ? "Loading..." : "Fetch asset"}
                </button>
              </div>
            </form>
            {assetError() && <p class="pm-market-feedback pm-market-feedback--error">{assetError()}</p>}
            {assetTask.data() && <AdminJsonResult value={assetTask.data()} />}
          </section>
        </div>
      </div>

      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">Admin endpoints</p>
            <h2 class="pm-tool-section__title">Treasury controls</h2>
          </div>
          <p class="pm-admin-section-note">Approve token spending, deposit liquidity, and pause treasury operations.</p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">POST /admin/treasury/payment-token/approve</p>
                <h3 class="pm-market-card__title">Approve payment token</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleApproveSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Amount</span>
                  <input class="pm-field__input" name="amount" type="text" />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={approveTask.pending() || !adminToken()}>
                  {approveTask.pending() ? "Submitting..." : "Approve"}
                </button>
              </div>
            </form>
            {approveError() && <p class="pm-market-feedback pm-market-feedback--error">{approveError()}</p>}
            {approveTask.data() && <AdminJsonResult value={approveTask.data()} />}
          </section>

          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">POST /admin/treasury/liquidity/deposit</p>
                <h3 class="pm-market-card__title">Deposit asset liquidity</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleDepositSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Asset address</span>
                  <input class="pm-field__input" name="asset_address" type="text" />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Amount</span>
                  <input class="pm-field__input" name="amount" type="text" />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={depositTask.pending() || !adminToken()}>
                  {depositTask.pending() ? "Submitting..." : "Deposit liquidity"}
                </button>
              </div>
            </form>
            {depositError() && <p class="pm-market-feedback pm-market-feedback--error">{depositError()}</p>}
            {depositTask.data() && <AdminJsonResult value={depositTask.data()} />}
          </section>

          <section class="pm-market-card pm-market-card--wide">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">POST /admin/treasury/pause | /unpause</p>
                <h3 class="pm-market-card__title">Pause state</h3>
              </div>
            </div>
            <p class="pm-market-card__copy">
              Toggle the global treasury pause flag from the admin wallet.
            </p>
            <div class="pm-market-actions pm-market-actions--group">
              <button class="pm-button pm-button--primary" type="button" disabled={pauseTask.pending() || !adminToken()} onClick={() => void runPause("pause")}>
                {pauseTask.pending() ? "Pausing..." : "Pause treasury"}
              </button>
              <button class="pm-button pm-button--ghost" type="button" disabled={unpauseTask.pending() || !adminToken()} onClick={() => void runPause("unpause")}>
                {unpauseTask.pending() ? "Unpausing..." : "Unpause treasury"}
              </button>
            </div>
            {pauseError() && <p class="pm-market-feedback pm-market-feedback--error">{pauseError()}</p>}
            {(pauseTask.data() || unpauseTask.data()) && (
              <AdminJsonResult value={pauseTask.data() ?? unpauseTask.data()} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
