import { createSignal } from "solid-js";

import AdminJsonResult from "./AdminJsonResult";
import {
  complianceClient,
  readAdminToken,
  type AdminSetComplianceAssetRulesRequest,
  type AdminUpsertComplianceInvestorRequest,
} from "~/lib";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";
import { readOptionalText, readRequiredText } from "./admin-form-utils";

export default function AdminComplianceManager() {
  const investorTask = useAsyncTask((wallet: string) => complianceClient.fetchInvestor(wallet));
  const rulesTask = useAsyncTask((assetAddress: string) =>
    complianceClient.fetchAssetRules(assetAddress),
  );
  const upsertInvestorTask = useAsyncTask(
    (token: string, wallet: string, payload: AdminUpsertComplianceInvestorRequest) =>
      complianceClient.upsertInvestor(token, wallet, payload),
  );
  const setRulesTask = useAsyncTask(
    (token: string, assetAddress: string, payload: AdminSetComplianceAssetRulesRequest) =>
      complianceClient.setAssetRules(token, assetAddress, payload),
  );
  const [investorError, setInvestorError] = createSignal<string | null>(null);
  const [rulesError, setRulesError] = createSignal<string | null>(null);
  const [upsertError, setUpsertError] = createSignal<string | null>(null);
  const [setRulesErr, setSetRulesErr] = createSignal<string | null>(null);

  const adminToken = () => readAdminToken();

  async function handleInvestorLookup(event: SubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setInvestorError(null);

    try {
      await investorTask.run(readRequiredText(formData, "wallet", "Wallet"));
    } catch (error) {
      setInvestorError(getErrorMessage(error));
    }
  }

  async function handleRulesLookup(event: SubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setRulesError(null);

    try {
      await rulesTask.run(readRequiredText(formData, "asset_address", "Asset address"));
    } catch (error) {
      setRulesError(getErrorMessage(error));
    }
  }

  async function handleInvestorUpsert(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setUpsertError("Connect an admin wallet first.");
      return;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setUpsertError(null);

    try {
      const wallet = readRequiredText(formData, "wallet", "Wallet");
      await upsertInvestorTask.run(token, wallet, {
        is_verified: Boolean(formData.get("is_verified")),
        is_accredited: Boolean(formData.get("is_accredited")),
        is_frozen: Boolean(formData.get("is_frozen")),
        valid_until: readOptionalText(formData, "valid_until")
          ? Number(readRequiredText(formData, "valid_until", "Valid until"))
          : null,
        jurisdiction: readRequiredText(formData, "jurisdiction", "Jurisdiction"),
        external_ref: readOptionalText(formData, "external_ref") ?? null,
      });
    } catch (error) {
      setUpsertError(getErrorMessage(error));
    }
  }

  async function handleSetRules(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setSetRulesErr("Connect an admin wallet first.");
      return;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setSetRulesErr(null);

    try {
      const assetAddress = readRequiredText(formData, "asset_address", "Asset address");
      await setRulesTask.run(token, assetAddress, {
        transfers_enabled: Boolean(formData.get("transfers_enabled")),
        subscriptions_enabled: Boolean(formData.get("subscriptions_enabled")),
        redemptions_enabled: Boolean(formData.get("redemptions_enabled")),
        requires_accreditation: Boolean(formData.get("requires_accreditation")),
        min_investment: readRequiredText(formData, "min_investment", "Min investment"),
        max_investor_balance: readRequiredText(
          formData,
          "max_investor_balance",
          "Max investor balance",
        ),
      });
    } catch (error) {
      setSetRulesErr(getErrorMessage(error));
    }
  }

  return (
    <div class="pm-tool-stack">
      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">Public endpoints</p>
            <h2 class="pm-tool-section__title">Compliance reads</h2>
          </div>
          <p class="pm-admin-section-note">
            Public compliance checks and lookup endpoints for investor state and asset rules.
          </p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">GET /compliance/investors/{'{wallet}'}</p>
                <h3 class="pm-market-card__title">Fetch investor</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleInvestorLookup}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Wallet</span>
                  <input class="pm-field__input" name="wallet" type="text" />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={investorTask.pending()}>
                  {investorTask.pending() ? "Loading..." : "Fetch investor"}
                </button>
              </div>
            </form>
            {investorError() && <p class="pm-market-feedback pm-market-feedback--error">{investorError()}</p>}
            {investorTask.data() && <AdminJsonResult value={investorTask.data()} />}
          </section>

          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">GET /compliance/assets/{'{asset}'}/rules</p>
                <h3 class="pm-market-card__title">Fetch asset rules</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleRulesLookup}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Asset address</span>
                  <input class="pm-field__input" name="asset_address" type="text" />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={rulesTask.pending()}>
                  {rulesTask.pending() ? "Loading..." : "Fetch rules"}
                </button>
              </div>
            </form>
            {rulesError() && <p class="pm-market-feedback pm-market-feedback--error">{rulesError()}</p>}
            {rulesTask.data() && <AdminJsonResult value={rulesTask.data()} />}
          </section>
        </div>
      </div>

      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">Admin endpoints</p>
            <h2 class="pm-tool-section__title">Compliance writes</h2>
          </div>
          <p class="pm-admin-section-note">
            Admin endpoints for updating investor state and per-asset rule sets.
          </p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">PUT /admin/compliance/investors/{'{wallet}'}</p>
                <h3 class="pm-market-card__title">Upsert investor</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleInvestorUpsert}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Wallet</span>
                  <input class="pm-field__input" name="wallet" type="text" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Jurisdiction</span>
                  <input class="pm-field__input" name="jurisdiction" type="text" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Valid until (unix)</span>
                  <input class="pm-field__input" name="valid_until" type="number" />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">External ref</span>
                  <input class="pm-field__input" name="external_ref" type="text" />
                </label>
                <label class="pm-checkbox">
                  <input name="is_verified" type="checkbox" />
                  <span>Verified</span>
                </label>
                <label class="pm-checkbox">
                  <input name="is_accredited" type="checkbox" />
                  <span>Accredited</span>
                </label>
                <label class="pm-checkbox">
                  <input name="is_frozen" type="checkbox" />
                  <span>Frozen</span>
                </label>
              </div>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={upsertInvestorTask.pending() || !adminToken()}
                >
                  {upsertInvestorTask.pending() ? "Saving..." : "Upsert investor"}
                </button>
              </div>
            </form>
            {upsertError() && <p class="pm-market-feedback pm-market-feedback--error">{upsertError()}</p>}
            {upsertInvestorTask.data() && <AdminJsonResult value={upsertInvestorTask.data()} />}
          </section>

          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">PUT /admin/compliance/assets/{'{asset}'}/rules</p>
                <h3 class="pm-market-card__title">Set asset rules</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleSetRules}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Asset address</span>
                  <input class="pm-field__input" name="asset_address" type="text" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Min investment</span>
                  <input class="pm-field__input" name="min_investment" type="text" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Max investor balance</span>
                  <input class="pm-field__input" name="max_investor_balance" type="text" />
                </label>
                <label class="pm-checkbox">
                  <input name="transfers_enabled" type="checkbox" checked />
                  <span>Transfers enabled</span>
                </label>
                <label class="pm-checkbox">
                  <input name="subscriptions_enabled" type="checkbox" checked />
                  <span>Subscriptions enabled</span>
                </label>
                <label class="pm-checkbox">
                  <input name="redemptions_enabled" type="checkbox" checked />
                  <span>Redemptions enabled</span>
                </label>
                <label class="pm-checkbox">
                  <input name="requires_accreditation" type="checkbox" />
                  <span>Requires accreditation</span>
                </label>
              </div>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={setRulesTask.pending() || !adminToken()}
                >
                  {setRulesTask.pending() ? "Saving..." : "Set rules"}
                </button>
              </div>
            </form>
            {setRulesErr() && <p class="pm-market-feedback pm-market-feedback--error">{setRulesErr()}</p>}
            {setRulesTask.data() && <AdminJsonResult value={setRulesTask.data()} />}
          </section>
        </div>
      </div>
    </div>
  );
}
