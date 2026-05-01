import { createSignal } from "solid-js";

import AdminJsonResult from "./AdminJsonResult";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";
import { oracleClient, readAdminToken } from "~/lib";
import { readRequiredText } from "./admin-form-utils";

export default function AdminOracleManager() {
  const trustedOracleTask = useAsyncTask((oracleAddress: string) =>
    oracleClient.fetchTrustedOracle(oracleAddress),
  );
  const valuationTask = useAsyncTask((assetAddress: string) =>
    oracleClient.fetchValuation(assetAddress),
  );
  const setTrustedTask = useAsyncTask((token: string, oracleAddress: string, trusted: boolean) =>
    oracleClient.setTrustedOracle(token, oracleAddress, { trusted }),
  );
  const submitValuationTask = useAsyncTask(
    (
      token: string,
      assetAddress: string,
      assetValue: string,
      navPerToken: string,
      referenceId: string,
    ) =>
      oracleClient.submitValuation(token, {
        asset_address: assetAddress,
        asset_value: assetValue,
        nav_per_token: navPerToken,
        reference_id: referenceId,
      }),
  );
  const [trustedLookupError, setTrustedLookupError] = createSignal<string | null>(null);
  const [valuationError, setValuationError] = createSignal<string | null>(null);
  const [setTrustedError, setSetTrustedError] = createSignal<string | null>(null);
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  const adminToken = () => readAdminToken();

  async function handleTrustedLookup(event: SubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setTrustedLookupError(null);

    try {
      await trustedOracleTask.run(readRequiredText(formData, "oracle_address", "Oracle address"));
    } catch (error) {
      setTrustedLookupError(getErrorMessage(error));
    }
  }

  async function handleValuationLookup(event: SubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setValuationError(null);

    try {
      await valuationTask.run(readRequiredText(formData, "asset_address", "Asset address"));
    } catch (error) {
      setValuationError(getErrorMessage(error));
    }
  }

  async function handleSetTrusted(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setSetTrustedError("Connect an admin wallet first.");
      return;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setSetTrustedError(null);

    try {
      await setTrustedTask.run(
        token,
        readRequiredText(formData, "oracle_address", "Oracle address"),
        Boolean(formData.get("trusted")),
      );
    } catch (error) {
      setSetTrustedError(getErrorMessage(error));
    }
  }

  async function handleSubmitValuation(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setSubmitError("Connect an admin wallet first.");
      return;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setSubmitError(null);

    try {
      await submitValuationTask.run(
        token,
        readRequiredText(formData, "asset_address", "Asset address"),
        readRequiredText(formData, "asset_value", "Asset value"),
        readRequiredText(formData, "nav_per_token", "NAV per token"),
        readRequiredText(formData, "reference_id", "Reference ID"),
      );
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  }

  return (
    <div class="pm-tool-stack">
      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">Public endpoints</p>
            <h2 class="pm-tool-section__title">Oracle reads</h2>
          </div>
          <p class="pm-admin-section-note">Read trust assignments and stored valuations from public routes.</p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">GET /oracle/trusted-oracles/{'{oracle_address}'}</p>
                <h3 class="pm-market-card__title">Trusted oracle</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleTrustedLookup}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Oracle address</span>
                  <input class="pm-field__input" name="oracle_address" type="text" />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={trustedOracleTask.pending()}>
                  {trustedOracleTask.pending() ? "Loading..." : "Fetch oracle"}
                </button>
              </div>
            </form>
            {trustedLookupError() && (
              <p class="pm-market-feedback pm-market-feedback--error">{trustedLookupError()}</p>
            )}
            {trustedOracleTask.data() && <AdminJsonResult value={trustedOracleTask.data()} />}
          </section>

          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">GET /oracle/assets/{'{asset_address}'}/valuation</p>
                <h3 class="pm-market-card__title">Current valuation</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleValuationLookup}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Asset address</span>
                  <input class="pm-field__input" name="asset_address" type="text" />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={valuationTask.pending()}>
                  {valuationTask.pending() ? "Loading..." : "Fetch valuation"}
                </button>
              </div>
            </form>
            {valuationError() && <p class="pm-market-feedback pm-market-feedback--error">{valuationError()}</p>}
            {valuationTask.data() && <AdminJsonResult value={valuationTask.data()} />}
          </section>
        </div>
      </div>

      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">Admin endpoints</p>
            <h2 class="pm-tool-section__title">Oracle writes</h2>
          </div>
          <p class="pm-admin-section-note">
            Update trusted-oracle flags and submit new valuation payloads from the admin wallet.
          </p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">PUT /admin/oracle/trusted-oracles/{'{oracle_address}'}</p>
                <h3 class="pm-market-card__title">Set trust state</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleSetTrusted}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Oracle address</span>
                  <input class="pm-field__input" name="oracle_address" type="text" />
                </label>
                <label class="pm-checkbox">
                  <input name="trusted" type="checkbox" />
                  <span>Trusted</span>
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={setTrustedTask.pending() || !adminToken()}>
                  {setTrustedTask.pending() ? "Saving..." : "Set trust state"}
                </button>
              </div>
            </form>
            {setTrustedError() && <p class="pm-market-feedback pm-market-feedback--error">{setTrustedError()}</p>}
            {setTrustedTask.data() && <AdminJsonResult value={setTrustedTask.data()} />}
          </section>

          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">POST /admin/oracle/valuations</p>
                <h3 class="pm-market-card__title">Submit valuation</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleSubmitValuation}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Asset address</span>
                  <input class="pm-field__input" name="asset_address" type="text" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Asset value</span>
                  <input class="pm-field__input" name="asset_value" type="text" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">NAV per token</span>
                  <input class="pm-field__input" name="nav_per_token" type="text" />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Reference ID</span>
                  <input class="pm-field__input" name="reference_id" type="text" />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={submitValuationTask.pending() || !adminToken()}>
                  {submitValuationTask.pending() ? "Submitting..." : "Submit valuation"}
                </button>
              </div>
            </form>
            {submitError() && <p class="pm-market-feedback pm-market-feedback--error">{submitError()}</p>}
            {submitValuationTask.data() && <AdminJsonResult value={submitValuationTask.data()} />}
          </section>
        </div>
      </div>
    </div>
  );
}
