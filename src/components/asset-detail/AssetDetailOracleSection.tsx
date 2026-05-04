import { Show, createEffect, createMemo, createSignal } from "solid-js";

import AdminModal from "~/components/AdminModal";
import { useAdminAuth } from "~/lib/admin-auth-context";
import {
  oracleClient,
  readAdminToken,
  type AssetResponse,
  type OracleDocumentResponse,
  type OracleTrustedOracleResponse,
  type OracleValuationResponse,
  type OracleValuationWriteResponse,
} from "~/lib";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";

import {
  formatDateTime,
  formatNumericString,
  formatUnixTimestamp,
  truncateMiddle,
} from "./format";

type OracleModalView =
  | "fetch-valuation"
  | "submit-valuation"
  | "sync-pricing"
  | "fetch-document"
  | "anchor-document"
  | "fetch-trusted-oracle"
  | "set-trusted-oracle";

interface AssetDetailOracleSectionProps {
  asset: AssetResponse;
  valuation: OracleValuationResponse | null;
  onPricingUpdated?: (subscriptionPrice: string, redemptionPrice: string) => void;
  onValuationUpdated?: (valuation: OracleValuationResponse) => void;
}

interface ValuationDraft {
  asset_value: string;
  nav_per_token: string;
  reference_id: string;
}

interface SyncPricingDraft extends ValuationDraft {
  subscription_price: string;
  redemption_price: string;
}

interface AnchorDocumentDraft {
  document_type: string;
  document_hash: string;
  reference_id: string;
}

function requireTextValue(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function buildValuationDraft(
  valuation: OracleValuationResponse | null | undefined,
): ValuationDraft {
  return {
    asset_value: valuation?.asset_value ?? "",
    nav_per_token: valuation?.nav_per_token ?? "",
    reference_id: valuation?.reference_id_text ?? valuation?.reference_id ?? "",
  };
}

function buildSyncPricingDraft(
  asset: AssetResponse,
  valuation: OracleValuationResponse | null | undefined,
): SyncPricingDraft {
  return {
    asset_value: valuation?.asset_value ?? "",
    nav_per_token: valuation?.nav_per_token ?? "",
    subscription_price: asset.price_per_token,
    redemption_price: asset.redemption_price_per_token,
    reference_id: valuation?.reference_id_text ?? valuation?.reference_id ?? "",
  };
}

function buildAnchorDocumentDraft(
  document: OracleDocumentResponse | null | undefined,
): AnchorDocumentDraft {
  return {
    document_type: document?.document_type ?? "",
    document_hash: document?.document_hash ?? "",
    reference_id: document?.reference_id_text ?? document?.reference_id ?? "",
  };
}

function formatTrustState(value: boolean) {
  return value ? "Trusted" : "Not trusted";
}

export default function AssetDetailOracleSection(props: AssetDetailOracleSectionProps) {
  let previousAssetAddress: string | null = null;
  const auth = useAdminAuth();
  const valuationTask = useAsyncTask(() => oracleClient.fetchValuation(props.asset.asset_address));
  const documentTask = useAsyncTask((documentType: string) =>
    oracleClient.fetchDocument(props.asset.asset_address, documentType),
  );
  const trustedOracleTask = useAsyncTask((oracleAddress: string) =>
    oracleClient.fetchTrustedOracle(oracleAddress),
  );
  const submitValuationTask = useAsyncTask(
    (token: string, draft: ValuationDraft) =>
      oracleClient.submitValuation(token, {
        asset_address: props.asset.asset_address,
        asset_value: draft.asset_value,
        nav_per_token: draft.nav_per_token,
        reference_id: draft.reference_id,
      }),
  );
  const syncPricingTask = useAsyncTask(
    (token: string, draft: SyncPricingDraft) =>
      oracleClient.submitValuationAndSyncPricing(token, {
        asset_address: props.asset.asset_address,
        asset_value: draft.asset_value,
        nav_per_token: draft.nav_per_token,
        subscription_price: draft.subscription_price,
        redemption_price: draft.redemption_price,
        reference_id: draft.reference_id,
      }),
  );
  const anchorDocumentTask = useAsyncTask(
    (token: string, draft: AnchorDocumentDraft) =>
      oracleClient.anchorDocument(
        token,
        props.asset.asset_address,
        draft.document_type,
        {
          document_hash: draft.document_hash,
          reference_id: draft.reference_id,
        },
      ),
  );
  const setTrustedOracleTask = useAsyncTask(
    (token: string, oracleAddress: string, trusted: boolean) =>
      oracleClient.setTrustedOracle(token, oracleAddress, { trusted }),
  );
  const [activeModal, setActiveModal] = createSignal<OracleModalView | null>(null);
  const [valuationError, setValuationError] = createSignal<string | null>(null);
  const [documentError, setDocumentError] = createSignal<string | null>(null);
  const [trustedOracleError, setTrustedOracleError] = createSignal<string | null>(null);
  const [submitValuationError, setSubmitValuationError] = createSignal<string | null>(null);
  const [syncPricingError, setSyncPricingError] = createSignal<string | null>(null);
  const [anchorDocumentError, setAnchorDocumentError] = createSignal<string | null>(null);
  const [trustedOracleUpdateError, setTrustedOracleUpdateError] = createSignal<string | null>(null);
  const [valuationDraft, setValuationDraft] = createSignal<ValuationDraft>(
    buildValuationDraft(props.valuation),
  );
  const [syncPricingDraft, setSyncPricingDraft] = createSignal<SyncPricingDraft>(
    buildSyncPricingDraft(props.asset, props.valuation),
  );
  const [documentLookupType, setDocumentLookupType] = createSignal("");
  const [anchorDocumentDraft, setAnchorDocumentDraft] = createSignal<AnchorDocumentDraft>(
    buildAnchorDocumentDraft(null),
  );
  const [trustedOracleAddress, setTrustedOracleAddress] = createSignal("");
  const [trustedOracleFlag, setTrustedOracleFlag] = createSignal(false);

  const adminToken = () => auth.session()?.token ?? readAdminToken();
  const isAdminConnected = () => Boolean(auth.profile() && adminToken());
  const currentValuation = createMemo(
    () =>
      syncPricingTask.data()?.valuation ??
      submitValuationTask.data()?.valuation ??
      valuationTask.data() ??
      props.valuation ??
      null,
  );
  const currentDocument = createMemo(
    () => anchorDocumentTask.data()?.document ?? documentTask.data() ?? null,
  );
  const currentTrustedOracle = createMemo(
    () => setTrustedOracleTask.data()?.trusted_oracle ?? trustedOracleTask.data() ?? null,
  );

  createEffect(() => {
    const assetAddress = props.asset.asset_address;

    if (assetAddress === previousAssetAddress) {
      return;
    }

    previousAssetAddress = assetAddress;
    setActiveModal(null);
    setValuationError(null);
    setDocumentError(null);
    setTrustedOracleError(null);
    setSubmitValuationError(null);
    setSyncPricingError(null);
    setAnchorDocumentError(null);
    setTrustedOracleUpdateError(null);
    setValuationDraft(buildValuationDraft(props.valuation));
    setSyncPricingDraft(buildSyncPricingDraft(props.asset, props.valuation));
    setDocumentLookupType("");
    setAnchorDocumentDraft(buildAnchorDocumentDraft(null));
    setTrustedOracleAddress("");
    setTrustedOracleFlag(false);
    valuationTask.reset();
    documentTask.reset();
    trustedOracleTask.reset();
    submitValuationTask.reset();
    syncPricingTask.reset();
    anchorDocumentTask.reset();
    setTrustedOracleTask.reset();
  });

  const syncValuationWrite = (response: OracleValuationWriteResponse) => {
    props.onValuationUpdated?.(response.valuation);
  };

  async function runValuationLookup() {
    setValuationError(null);

    try {
      const response = await valuationTask.run();
      setValuationDraft(buildValuationDraft(response));
      setSyncPricingDraft(buildSyncPricingDraft(props.asset, response));
      return response;
    } catch (error) {
      setValuationError(getErrorMessage(error));
      return null;
    }
  }

  async function runDocumentLookup() {
    setDocumentError(null);

    try {
      const response = await documentTask.run(
        requireTextValue(documentLookupType(), "Document type"),
      );
      setAnchorDocumentDraft(buildAnchorDocumentDraft(response));
      return response;
    } catch (error) {
      setDocumentError(getErrorMessage(error));
      return null;
    }
  }

  async function runTrustedOracleLookup() {
    setTrustedOracleError(null);

    try {
      const response = await trustedOracleTask.run(
        requireTextValue(trustedOracleAddress(), "Oracle address"),
      );
      setTrustedOracleFlag(response.is_trusted);
      return response;
    } catch (error) {
      setTrustedOracleError(getErrorMessage(error));
      return null;
    }
  }

  function openModal(view: OracleModalView) {
    setValuationError(null);
    setDocumentError(null);
    setTrustedOracleError(null);
    setSubmitValuationError(null);
    setSyncPricingError(null);
    setAnchorDocumentError(null);
    setTrustedOracleUpdateError(null);

    if (view === "fetch-valuation") {
      void runValuationLookup();
    }

    if (view === "submit-valuation") {
      setValuationDraft(buildValuationDraft(currentValuation()));
    }

    if (view === "sync-pricing") {
      setSyncPricingDraft(buildSyncPricingDraft(props.asset, currentValuation()));
    }

    if (view === "fetch-document") {
      setDocumentLookupType(
        currentDocument()?.document_type_text ?? currentDocument()?.document_type ?? "",
      );
    }

    if (view === "anchor-document") {
      setAnchorDocumentDraft(buildAnchorDocumentDraft(currentDocument()));
    }

    if (view === "fetch-trusted-oracle" || view === "set-trusted-oracle") {
      setTrustedOracleAddress(currentTrustedOracle()?.oracle_address ?? "");
      setTrustedOracleFlag(currentTrustedOracle()?.is_trusted ?? false);
    }

    setActiveModal(view);
  }

  async function handleSubmitValuation(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setSubmitValuationError("Connect an admin wallet first.");
      return;
    }

    setSubmitValuationError(null);

    try {
      const draft = valuationDraft();
      const response = await submitValuationTask.run(token, {
        asset_value: requireTextValue(draft.asset_value, "Asset value"),
        nav_per_token: requireTextValue(draft.nav_per_token, "NAV per token"),
        reference_id: requireTextValue(draft.reference_id, "Reference ID"),
      });
      syncValuationWrite(response);
    } catch (error) {
      setSubmitValuationError(getErrorMessage(error));
    }
  }

  async function handleSyncPricing(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setSyncPricingError("Connect an admin wallet first.");
      return;
    }

    setSyncPricingError(null);

    try {
      const draft = syncPricingDraft();
      const response = await syncPricingTask.run(token, {
        asset_value: requireTextValue(draft.asset_value, "Asset value"),
        nav_per_token: requireTextValue(draft.nav_per_token, "NAV per token"),
        subscription_price: requireTextValue(draft.subscription_price, "Subscription price"),
        redemption_price: requireTextValue(draft.redemption_price, "Redemption price"),
        reference_id: requireTextValue(draft.reference_id, "Reference ID"),
      });

      syncValuationWrite(response);
      props.onPricingUpdated?.(draft.subscription_price, draft.redemption_price);
    } catch (error) {
      setSyncPricingError(getErrorMessage(error));
    }
  }

  async function handleAnchorDocument(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setAnchorDocumentError("Connect an admin wallet first.");
      return;
    }

    setAnchorDocumentError(null);

    try {
      const draft = anchorDocumentDraft();
      await anchorDocumentTask.run(token, {
        document_type: requireTextValue(draft.document_type, "Document type"),
        document_hash: requireTextValue(draft.document_hash, "Document hash"),
        reference_id: requireTextValue(draft.reference_id, "Reference ID"),
      });
    } catch (error) {
      setAnchorDocumentError(getErrorMessage(error));
    }
  }

  async function handleSetTrustedOracle(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setTrustedOracleUpdateError("Connect an admin wallet first.");
      return;
    }

    setTrustedOracleUpdateError(null);

    try {
      const response = await setTrustedOracleTask.run(
        token,
        requireTextValue(trustedOracleAddress(), "Oracle address"),
        trustedOracleFlag(),
      );
      setTrustedOracleAddress(response.trusted_oracle.oracle_address);
    } catch (error) {
      setTrustedOracleUpdateError(getErrorMessage(error));
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
          <p class="pm-asset-market__panel-kicker">Oracle</p>
          <h2 class="pm-detail__card-title">Valuation and documents</h2>
          <p class="pm-detail__card-copy pm-asset-market__panel-copy">
            Keep oracle actions attached to the asset. Read the live valuation, anchor reference
            documents, and sync pricing from one place.
          </p>

          <Show
            when={currentValuation()}
            fallback={
              <p class="pm-asset-market__panel-subcopy">
                No oracle valuation snapshot is currently cached for this asset.
              </p>
            }
          >
            {valuation => (
              <div class="pm-asset-market__stat-rows">
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Asset value</span>
                  <span class="pm-asset-market__stat-value">
                    {formatNumericString(valuation().asset_value)}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">NAV per token</span>
                  <span class="pm-asset-market__stat-value">
                    {formatNumericString(valuation().nav_per_token)}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">On-chain updated</span>
                  <span class="pm-asset-market__stat-value">
                    {formatUnixTimestamp(valuation().onchain_updated_at)}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Reference ID</span>
                  <span class="pm-asset-market__stat-value pm-asset-market__stat-value--mono">
                    {truncateMiddle(valuation().reference_id_text ?? valuation().reference_id)}
                  </span>
                </div>
              </div>
            )}
          </Show>
        </section>

        <section class="pm-detail__card pm-asset-market__panel">
          <p class="pm-asset-market__panel-kicker">Oracle tools</p>
          <h2 class="pm-detail__card-title">Asset flow</h2>
          <div class="pm-asset-market__control-grid">
            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("fetch-valuation")}
            >
              <span class="pm-asset-market__control-button-title">Fetch valuation</span>
              <span class="pm-asset-market__control-button-copy">
                Read the current valuation stored for this asset.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("submit-valuation")}
            >
              <span class="pm-asset-market__control-button-title">Submit valuation</span>
              <span class="pm-asset-market__control-button-copy">
                Write a new valuation snapshot without changing pricing.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("sync-pricing")}
            >
              <span class="pm-asset-market__control-button-title">Sync pricing</span>
              <span class="pm-asset-market__control-button-copy">
                Submit valuation and update subscription and redemption pricing together.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("fetch-document")}
            >
              <span class="pm-asset-market__control-button-title">Fetch document</span>
              <span class="pm-asset-market__control-button-copy">
                Read an anchored oracle document by document type.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("anchor-document")}
            >
              <span class="pm-asset-market__control-button-title">Anchor document</span>
              <span class="pm-asset-market__control-button-copy">
                Store a document hash and reference ID for this asset.
              </span>
            </button>
          </div>

          <div class="pm-asset-market__about-head">
            <p class="pm-asset-market__panel-kicker">Trusted oracle</p>
            <p class="pm-asset-market__panel-subcopy">
              These routes are not asset-specific, but they still fit better here than on a separate
              admin page when you are managing a valuation flow.
            </p>
          </div>

          <div class="pm-asset-market__control-grid">
            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("fetch-trusted-oracle")}
            >
              <span class="pm-asset-market__control-button-title">Fetch trusted oracle</span>
              <span class="pm-asset-market__control-button-copy">
                Read current trust state for any oracle address.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("set-trusted-oracle")}
            >
              <span class="pm-asset-market__control-button-title">Set trusted oracle</span>
              <span class="pm-asset-market__control-button-copy">
                Update trust state for an oracle address from the admin wallet.
              </span>
            </button>
          </div>
        </section>
      </div>

      <AdminModal
        open={activeModal() === "fetch-valuation"}
        onClose={() => setActiveModal(null)}
        eyebrow="Oracle"
        title="Fetch valuation"
        subtitle={`Read the stored valuation for ${props.asset.name}.`}
      >
        <div class="pm-asset-market__modal-stack">
          <div class="pm-market-actions">
            <button
              class="pm-button pm-button--primary"
              type="button"
              disabled={valuationTask.pending()}
              onClick={() => void runValuationLookup()}
            >
              {valuationTask.pending() ? "Loading..." : "Refresh valuation"}
            </button>
          </div>

          <Show when={valuationError()}>
            {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
          </Show>

          <Show when={currentValuation()}>
            {valuation => (
              <section class="pm-asset-market__modal-result">
                <div class="pm-asset-market__stat-rows">
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Asset value</span>
                    <span class="pm-asset-market__stat-value">
                      {formatNumericString(valuation().asset_value)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">NAV per token</span>
                    <span class="pm-asset-market__stat-value">
                      {formatNumericString(valuation().nav_per_token)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">On-chain updated</span>
                    <span class="pm-asset-market__stat-value">
                      {formatUnixTimestamp(valuation().onchain_updated_at)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Reference ID</span>
                    <span class="pm-asset-market__stat-value pm-asset-market__stat-value--mono">
                      {truncateMiddle(valuation().reference_id_text ?? valuation().reference_id)}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "submit-valuation"}
        onClose={() => setActiveModal(null)}
        eyebrow="Oracle"
        title="Submit valuation"
        subtitle={`Write a new valuation snapshot for ${props.asset.name}.`}
        size="wide"
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can submit a valuation.")}
        >
          <div class="pm-asset-market__modal-stack">
            <form class="pm-market-form" onSubmit={handleSubmitValuation}>
              <div class="pm-market-fields">
                <label class="pm-field">
                  <span class="pm-field__label">Asset value</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={valuationDraft().asset_value}
                    onInput={event =>
                      setValuationDraft(current => ({
                        ...current,
                        asset_value: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">NAV per token</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={valuationDraft().nav_per_token}
                    onInput={event =>
                      setValuationDraft(current => ({
                        ...current,
                        nav_per_token: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Reference ID</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={valuationDraft().reference_id}
                    onInput={event =>
                      setValuationDraft(current => ({
                        ...current,
                        reference_id: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={submitValuationTask.pending()}
                >
                  {submitValuationTask.pending() ? "Submitting..." : "Submit valuation"}
                </button>
              </div>
            </form>

            <Show when={submitValuationError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={submitValuationTask.data()}>
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
                      <span class="pm-asset-market__fact-label">Updated</span>
                      <span class="pm-asset-market__fact-value">
                        {formatDateTime(response().valuation.updated_at)}
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
        open={activeModal() === "sync-pricing"}
        onClose={() => setActiveModal(null)}
        eyebrow="Oracle"
        title="Sync pricing"
        subtitle={`Submit valuation and set pricing for ${props.asset.name}.`}
        size="wide"
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can sync pricing.")}
        >
          <div class="pm-asset-market__modal-stack">
            <form class="pm-market-form" onSubmit={handleSyncPricing}>
              <div class="pm-market-fields">
                <label class="pm-field">
                  <span class="pm-field__label">Asset value</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={syncPricingDraft().asset_value}
                    onInput={event =>
                      setSyncPricingDraft(current => ({
                        ...current,
                        asset_value: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">NAV per token</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={syncPricingDraft().nav_per_token}
                    onInput={event =>
                      setSyncPricingDraft(current => ({
                        ...current,
                        nav_per_token: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Subscription price</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={syncPricingDraft().subscription_price}
                    onInput={event =>
                      setSyncPricingDraft(current => ({
                        ...current,
                        subscription_price: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Redemption price</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={syncPricingDraft().redemption_price}
                    onInput={event =>
                      setSyncPricingDraft(current => ({
                        ...current,
                        redemption_price: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Reference ID</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={syncPricingDraft().reference_id}
                    onInput={event =>
                      setSyncPricingDraft(current => ({
                        ...current,
                        reference_id: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
              </div>
              <p class="pm-asset-market__modal-note">
                Pricing values here are sent as raw on-chain contract values.
              </p>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={syncPricingTask.pending()}
                >
                  {syncPricingTask.pending() ? "Submitting..." : "Sync valuation and pricing"}
                </button>
              </div>
            </form>

            <Show when={syncPricingError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={syncPricingTask.data()}>
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
                      <span class="pm-asset-market__fact-label">Updated</span>
                      <span class="pm-asset-market__fact-value">
                        {formatDateTime(response().valuation.updated_at)}
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
        open={activeModal() === "fetch-document"}
        onClose={() => setActiveModal(null)}
        eyebrow="Oracle"
        title="Fetch document"
        subtitle={`Read an anchored document for ${props.asset.name}.`}
      >
        <div class="pm-asset-market__modal-stack">
          <form
            class="pm-market-form"
            onSubmit={event => {
              event.preventDefault();
              void runDocumentLookup();
            }}
          >
            <div class="pm-market-fields">
              <label class="pm-field pm-field--full">
                <span class="pm-field__label">Document type</span>
                <input
                  class="pm-field__input"
                  type="text"
                  value={documentLookupType()}
                  onInput={event => setDocumentLookupType(event.currentTarget.value)}
                />
              </label>
            </div>
            <div class="pm-market-actions">
              <button
                class="pm-button pm-button--primary"
                type="submit"
                disabled={documentTask.pending()}
              >
                {documentTask.pending() ? "Loading..." : "Fetch document"}
              </button>
            </div>
          </form>

          <Show when={documentError()}>
            {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
          </Show>

          <Show when={currentDocument()}>
            {document => (
              <section class="pm-asset-market__modal-result">
                <div class="pm-asset-market__stat-rows">
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Document type</span>
                    <span class="pm-asset-market__stat-value">
                      {document().document_type_text ?? document().document_type}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Document hash</span>
                    <span class="pm-asset-market__stat-value pm-asset-market__stat-value--mono">
                      {truncateMiddle(document().document_hash)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Reference ID</span>
                    <span class="pm-asset-market__stat-value pm-asset-market__stat-value--mono">
                      {truncateMiddle(document().reference_id_text ?? document().reference_id)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Updated</span>
                    <span class="pm-asset-market__stat-value">
                      {formatDateTime(document().updated_at)}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "anchor-document"}
        onClose={() => setActiveModal(null)}
        eyebrow="Oracle"
        title="Anchor document"
        subtitle={`Anchor a document hash for ${props.asset.name}.`}
        size="wide"
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can anchor documents.")}
        >
          <div class="pm-asset-market__modal-stack">
            <form class="pm-market-form" onSubmit={handleAnchorDocument}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Document type</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={anchorDocumentDraft().document_type}
                    onInput={event =>
                      setAnchorDocumentDraft(current => ({
                        ...current,
                        document_type: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Document hash</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={anchorDocumentDraft().document_hash}
                    onInput={event =>
                      setAnchorDocumentDraft(current => ({
                        ...current,
                        document_hash: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Reference ID</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={anchorDocumentDraft().reference_id}
                    onInput={event =>
                      setAnchorDocumentDraft(current => ({
                        ...current,
                        reference_id: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={anchorDocumentTask.pending()}
                >
                  {anchorDocumentTask.pending() ? "Submitting..." : "Anchor document"}
                </button>
              </div>
            </form>

            <Show when={anchorDocumentError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={anchorDocumentTask.data()}>
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
                      <span class="pm-asset-market__fact-label">Document type</span>
                      <span class="pm-asset-market__fact-value">
                        {response().document.document_type_text ?? response().document.document_type}
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
        open={activeModal() === "fetch-trusted-oracle"}
        onClose={() => setActiveModal(null)}
        eyebrow="Oracle"
        title="Fetch trusted oracle"
        subtitle="Read trust state for an oracle address."
      >
        <div class="pm-asset-market__modal-stack">
          <form
            class="pm-market-form"
            onSubmit={event => {
              event.preventDefault();
              void runTrustedOracleLookup();
            }}
          >
            <div class="pm-market-fields">
              <label class="pm-field pm-field--full">
                <span class="pm-field__label">Oracle address</span>
                <input
                  class="pm-field__input"
                  type="text"
                  value={trustedOracleAddress()}
                  onInput={event => setTrustedOracleAddress(event.currentTarget.value)}
                />
              </label>
            </div>
            <div class="pm-market-actions">
              <button
                class="pm-button pm-button--primary"
                type="submit"
                disabled={trustedOracleTask.pending()}
              >
                {trustedOracleTask.pending() ? "Loading..." : "Fetch trusted oracle"}
              </button>
            </div>
          </form>

          <Show when={trustedOracleError()}>
            {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
          </Show>

          <Show when={currentTrustedOracle()}>
            {oracle => (
              <section class="pm-asset-market__modal-result">
                <div class="pm-asset-market__stat-rows">
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Oracle address</span>
                    <span class="pm-asset-market__stat-value pm-asset-market__stat-value--mono">
                      {truncateMiddle(oracle().oracle_address)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Trust state</span>
                    <span class="pm-asset-market__stat-value">
                      {formatTrustState(oracle().is_trusted)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Updated</span>
                    <span class="pm-asset-market__stat-value">
                      {formatDateTime(oracle().updated_at)}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "set-trusted-oracle"}
        onClose={() => setActiveModal(null)}
        eyebrow="Oracle"
        title="Set trusted oracle"
        subtitle="Update trust state for an oracle address."
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can update trust state.")}
        >
          <div class="pm-asset-market__modal-stack">
            <form class="pm-market-form" onSubmit={handleSetTrustedOracle}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Oracle address</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={trustedOracleAddress()}
                    onInput={event => setTrustedOracleAddress(event.currentTarget.value)}
                  />
                </label>
                <label class="pm-checkbox">
                  <input
                    type="checkbox"
                    checked={trustedOracleFlag()}
                    onChange={event => setTrustedOracleFlag(event.currentTarget.checked)}
                  />
                  <span>Trusted</span>
                </label>
              </div>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={setTrustedOracleTask.pending()}
                >
                  {setTrustedOracleTask.pending() ? "Saving..." : "Set trust state"}
                </button>
              </div>
            </form>

            <Show when={trustedOracleUpdateError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={setTrustedOracleTask.data()}>
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
                      <span class="pm-asset-market__fact-label">Trust state</span>
                      <span class="pm-asset-market__fact-value">
                        {formatTrustState(response().trusted_oracle.is_trusted)}
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
