import { Show, createEffect, createMemo, createSignal } from "solid-js";

import AdminModal from "~/components/AdminModal";
import { useAdminAuth } from "~/lib/admin-auth-context";
import {
  complianceClient,
  DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
  formatPaymentTokenAmountFromBaseUnits,
  readAdminToken,
  type AdminSetComplianceAssetRulesRequest,
  type AdminUpsertComplianceInvestorRequest,
  type AssetResponse,
  type ComplianceAssetRulesResponse,
  type ComplianceInvestorResponse,
  type PaymentTokenDisplayMeta,
} from "~/lib";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";

import {
  formatAssetTokenValue,
  formatBooleanValue,
  formatDateTime,
  formatPaymentTokenBaseUnitsForInput,
  formatNumericString,
  formatUnixTimestamp,
  parseDisplayPaymentTokenAmountToBaseUnits,
  truncateMiddle,
} from "./format";

type ComplianceModalView =
  | "fetch-investor"
  | "upsert-investor"
  | "fetch-rules"
  | "set-rules";

interface AssetDetailComplianceSectionProps {
  asset: AssetResponse;
  rules: ComplianceAssetRulesResponse | null;
  paymentTokenMeta?: PaymentTokenDisplayMeta | null;
  onRulesUpdated?: (rules: ComplianceAssetRulesResponse) => void;
}

interface InvestorDraftState {
  wallet: string;
  jurisdiction: string;
  valid_until: string;
  external_ref: string;
  is_verified: boolean;
  is_accredited: boolean;
  is_frozen: boolean;
}

function buildInvestorDraft(
  investor: ComplianceInvestorResponse | null | undefined,
): InvestorDraftState {
  return {
    wallet: investor?.wallet_address ?? "",
    jurisdiction: investor?.jurisdiction ?? "",
    valid_until: investor?.valid_until ? String(investor.valid_until) : "",
    external_ref: investor?.external_ref_text ?? investor?.external_ref ?? "",
    is_verified: investor?.is_verified ?? false,
    is_accredited: investor?.is_accredited ?? false,
    is_frozen: investor?.is_frozen ?? false,
  };
}

interface RulesDraftState {
  transfers_enabled: boolean;
  subscriptions_enabled: boolean;
  redemptions_enabled: boolean;
  requires_accreditation: boolean;
  min_investment: string;
  max_investor_balance: string;
}

const ASSET_TOKEN_BASE_UNITS = BigInt("1000000000000000000");

function normalizeIntegerString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return normalized.replace(/^0+(?=\d)/, "") || "0";
}

function ceilDivide(dividend: bigint, divisor: bigint): bigint {
  if (divisor <= BigInt(0)) {
    throw new Error("Asset subscription price must be greater than zero.");
  }

  return (dividend + divisor - BigInt(1)) / divisor;
}

function convertSettlementDisplayToRuleUnits(
  value: string,
  pricePerToken: string,
  meta: PaymentTokenDisplayMeta | null | undefined,
): string {
  const paymentTokenBaseUnits = BigInt(parseDisplayPaymentTokenAmountToBaseUnits(value, meta));
  const pricePerTokenUnits = BigInt(
    normalizeIntegerString(pricePerToken) ?? "0",
  );

  return ceilDivide(paymentTokenBaseUnits * ASSET_TOKEN_BASE_UNITS, pricePerTokenUnits).toString();
}

function convertRuleUnitsToSettlementBaseUnits(
  value: string | null | undefined,
  pricePerToken: string | null | undefined,
): string | null {
  const normalizedValue = normalizeIntegerString(value);
  const normalizedPrice = normalizeIntegerString(pricePerToken);

  if (!normalizedValue || !normalizedPrice) {
    return null;
  }

  return (
    (BigInt(normalizedValue) * BigInt(normalizedPrice)) / ASSET_TOKEN_BASE_UNITS
  ).toString();
}

function formatRuleUnitsAsSettlement(
  value: string | null | undefined,
  pricePerToken: string,
  meta: PaymentTokenDisplayMeta | null | undefined,
): string {
  const settlementBaseUnits = convertRuleUnitsToSettlementBaseUnits(value, pricePerToken);

  if (!settlementBaseUnits) {
    return "Not available";
  }

  return formatPaymentTokenAmountFromBaseUnits(settlementBaseUnits, meta);
}

function formatRuleValueForDisplay(
  value: string | null | undefined,
  pricePerToken: string,
  meta: PaymentTokenDisplayMeta | null | undefined,
): string {
  const settlementLabel = formatRuleUnitsAsSettlement(value, pricePerToken, meta);
  const rawUnits = normalizeIntegerString(value);

  if (!rawUnits) {
    return settlementLabel;
  }

  return `${settlementLabel} · ${formatAssetTokenValue(rawUnits)} tokens`;
}

function buildRulesDraft(
  rules: ComplianceAssetRulesResponse | null | undefined,
  asset: AssetResponse,
  paymentTokenMeta: PaymentTokenDisplayMeta | null | undefined,
): RulesDraftState {
  const minInvestmentSettlement = convertRuleUnitsToSettlementBaseUnits(
    rules?.min_investment ?? "0",
    asset.price_per_token,
  );
  const maxInvestorBalanceSettlement = convertRuleUnitsToSettlementBaseUnits(
    rules?.max_investor_balance ?? "0",
    asset.price_per_token,
  );

  return {
    transfers_enabled: rules?.transfers_enabled ?? false,
    subscriptions_enabled: rules?.subscriptions_enabled ?? false,
    redemptions_enabled: rules?.redemptions_enabled ?? false,
    requires_accreditation: rules?.requires_accreditation ?? false,
    min_investment:
      formatPaymentTokenBaseUnitsForInput(minInvestmentSettlement, paymentTokenMeta) || "0",
    max_investor_balance:
      formatPaymentTokenBaseUnitsForInput(maxInvestorBalanceSettlement, paymentTokenMeta) || "0",
  };
}

function requireTextValue(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function formatAffirmation(value: boolean) {
  return value ? "Yes" : "No";
}

export default function AssetDetailComplianceSection(
  props: AssetDetailComplianceSectionProps,
) {
  let previousAssetAddress: string | null = null;
  const auth = useAdminAuth();
  const rulesTask = useAsyncTask(() => complianceClient.fetchAssetRules(props.asset.asset_address));
  const investorTask = useAsyncTask((wallet: string) => complianceClient.fetchInvestor(wallet));
  const upsertInvestorTask = useAsyncTask(
    (token: string, wallet: string, payload: AdminUpsertComplianceInvestorRequest) =>
      complianceClient.upsertInvestor(token, wallet, payload),
  );
  const setRulesTask = useAsyncTask(
    (token: string, payload: AdminSetComplianceAssetRulesRequest) =>
      complianceClient.setAssetRules(token, props.asset.asset_address, payload),
  );
  const [activeModal, setActiveModal] = createSignal<ComplianceModalView | null>(null);
  const [rulesError, setRulesError] = createSignal<string | null>(null);
  const [investorError, setInvestorError] = createSignal<string | null>(null);
  const [upsertError, setUpsertError] = createSignal<string | null>(null);
  const [rulesUpdateError, setRulesUpdateError] = createSignal<string | null>(null);
  const [lookupWallet, setLookupWallet] = createSignal("");
  const [investorDraft, setInvestorDraft] = createSignal<InvestorDraftState>(
    buildInvestorDraft(null),
  );
  const [rulesDraft, setRulesDraft] = createSignal<RulesDraftState>(
    buildRulesDraft(props.rules, props.asset, props.paymentTokenMeta),
  );
  const paymentTokenMeta = () => props.paymentTokenMeta ?? DEFAULT_PAYMENT_TOKEN_DISPLAY_META;
  const subscriptionSettlementLabel = createMemo(() =>
    formatPaymentTokenAmountFromBaseUnits(props.asset.price_per_token, paymentTokenMeta()),
  );
  const previewMinInvestmentRuleUnits = createMemo(() => {
    try {
      return convertSettlementDisplayToRuleUnits(
        rulesDraft().min_investment,
        props.asset.price_per_token,
        paymentTokenMeta(),
      );
    } catch {
      return null;
    }
  });
  const previewMaxInvestorBalanceRuleUnits = createMemo(() => {
    try {
      return convertSettlementDisplayToRuleUnits(
        rulesDraft().max_investor_balance,
        props.asset.price_per_token,
        paymentTokenMeta(),
      );
    } catch {
      return null;
    }
  });

  const adminToken = () => auth.session()?.token ?? readAdminToken();
  const isAdminConnected = () => Boolean(auth.profile() && adminToken());
  const currentRules = createMemo(
    () => setRulesTask.data()?.asset_rules ?? rulesTask.data() ?? props.rules ?? null,
  );
  const currentInvestor = createMemo(
    () => upsertInvestorTask.data()?.investor ?? investorTask.data() ?? null,
  );

  createEffect(() => {
    const assetAddress = props.asset.asset_address;

    if (assetAddress === previousAssetAddress) {
      return;
    }

    previousAssetAddress = assetAddress;
    setActiveModal(null);
    setRulesError(null);
    setInvestorError(null);
    setUpsertError(null);
    setRulesUpdateError(null);
    setLookupWallet("");
    setInvestorDraft(buildInvestorDraft(null));
    setRulesDraft(buildRulesDraft(props.rules, props.asset, props.paymentTokenMeta));
    rulesTask.reset();
    investorTask.reset();
    upsertInvestorTask.reset();
    setRulesTask.reset();
  });

  async function runRulesLookup() {
    setRulesError(null);

    try {
      const response = await rulesTask.run();
      props.onRulesUpdated?.(response);
      return response;
    } catch (error) {
      setRulesError(getErrorMessage(error));
      return null;
    }
  }

  function openModal(view: ComplianceModalView) {
    setRulesError(null);
    setInvestorError(null);
    setUpsertError(null);
    setRulesUpdateError(null);

    if (view === "fetch-rules") {
      void runRulesLookup();
    }

    if (view === "fetch-investor") {
      setLookupWallet(
        currentInvestor()?.wallet_address ?? investorDraft().wallet ?? "",
      );
    }

    if (view === "upsert-investor") {
      setInvestorDraft(buildInvestorDraft(currentInvestor()));
    }

    if (view === "set-rules") {
      setRulesDraft(buildRulesDraft(currentRules(), props.asset, props.paymentTokenMeta));
    }

    setActiveModal(view);
  }

  async function handleInvestorLookupSubmit(event: SubmitEvent) {
    event.preventDefault();
    setInvestorError(null);

    try {
      const wallet = requireTextValue(lookupWallet(), "Wallet");
      const response = await investorTask.run(wallet);
      setLookupWallet(response.wallet_address);
      setInvestorDraft(buildInvestorDraft(response));
    } catch (error) {
      setInvestorError(getErrorMessage(error));
    }
  }

  async function handleInvestorUpsertSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setUpsertError("Connect an admin wallet first.");
      return;
    }

    setUpsertError(null);

    try {
      const draft = investorDraft();
      const wallet = requireTextValue(draft.wallet, "Wallet");
      const jurisdiction = requireTextValue(draft.jurisdiction, "Jurisdiction");
      const validUntilText = draft.valid_until.trim();
      const validUntil = validUntilText ? Number.parseInt(validUntilText, 10) : null;

      if (validUntilText && !Number.isFinite(validUntil)) {
        throw new Error("Valid until must be a whole unix timestamp.");
      }

      const response = await upsertInvestorTask.run(token, wallet, {
        is_verified: draft.is_verified,
        is_accredited: draft.is_accredited,
        is_frozen: draft.is_frozen,
        valid_until: validUntil,
        jurisdiction,
        external_ref: draft.external_ref.trim() || null,
      });

      setLookupWallet(response.investor.wallet_address);
      setInvestorDraft(buildInvestorDraft(response.investor));
    } catch (error) {
      setUpsertError(getErrorMessage(error));
    }
  }

  async function handleSetRulesSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setRulesUpdateError("Connect an admin wallet first.");
      return;
    }

    setRulesUpdateError(null);

    try {
      const draft = rulesDraft();
      const payload: AdminSetComplianceAssetRulesRequest = {
        transfers_enabled: draft.transfers_enabled,
        subscriptions_enabled: draft.subscriptions_enabled,
        redemptions_enabled: draft.redemptions_enabled,
        requires_accreditation: draft.requires_accreditation,
        min_investment: convertSettlementDisplayToRuleUnits(
          requireTextValue(draft.min_investment, "Min investment"),
          props.asset.price_per_token,
          paymentTokenMeta(),
        ),
        max_investor_balance: convertSettlementDisplayToRuleUnits(
          requireTextValue(draft.max_investor_balance, "Max investor balance"),
          props.asset.price_per_token,
          paymentTokenMeta(),
        ),
      };
      console.info("[asset-compliance] setAssetRules:start", {
        assetAddress: props.asset.asset_address,
        assetPricePerToken: props.asset.price_per_token,
        paymentTokenMeta: paymentTokenMeta(),
        input: draft,
        payload,
      });

      const response = await setRulesTask.run(token, payload);
      console.info("[asset-compliance] setAssetRules:success", response);
      props.onRulesUpdated?.(response.asset_rules);
      setRulesDraft(
        buildRulesDraft(response.asset_rules, props.asset, props.paymentTokenMeta),
      );
    } catch (error) {
      console.error("[asset-compliance] setAssetRules:error", error);
      setRulesUpdateError(getErrorMessage(error));
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
          <p class="pm-asset-market__panel-kicker">Compliance</p>
          <h2 class="pm-detail__card-title">Investor checks and asset policy</h2>
          <p class="pm-detail__card-copy pm-asset-market__panel-copy">
            Keep the compliance flow attached to the asset. Read the live policy, inspect any
            investor wallet, and update registry rules only when needed.
          </p>

          <Show
            when={currentRules()}
            fallback={
              <p class="pm-asset-market__panel-subcopy">
                No compliance rules are currently cached for this asset.
              </p>
            }
          >
            {rules => (
              <div class="pm-asset-market__stat-rows">
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Transfers</span>
                  <span class="pm-asset-market__stat-value">
                    {formatBooleanValue(rules().transfers_enabled)}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Subscriptions</span>
                  <span class="pm-asset-market__stat-value">
                    {formatBooleanValue(rules().subscriptions_enabled)}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Redemptions</span>
                  <span class="pm-asset-market__stat-value">
                    {formatBooleanValue(rules().redemptions_enabled)}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Accreditation</span>
                  <span class="pm-asset-market__stat-value">
                    {formatBooleanValue(rules().requires_accreditation)}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Min investment</span>
                  <span class="pm-asset-market__stat-value">
                    {formatRuleValueForDisplay(
                      rules().min_investment,
                      props.asset.price_per_token,
                      paymentTokenMeta(),
                    )}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Max investor balance</span>
                  <span class="pm-asset-market__stat-value">
                    {formatRuleValueForDisplay(
                      rules().max_investor_balance,
                      props.asset.price_per_token,
                      paymentTokenMeta(),
                    )}
                  </span>
                </div>
              </div>
            )}
          </Show>
        </section>

        <section class="pm-detail__card pm-asset-market__panel">
          <p class="pm-asset-market__panel-kicker">Compliance tools</p>
          <h2 class="pm-detail__card-title">Minimal control flow</h2>
          <div class="pm-asset-market__control-grid">
            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("fetch-investor")}
            >
              <span class="pm-asset-market__control-button-title">Fetch investor</span>
              <span class="pm-asset-market__control-button-copy">
                Read public investor state for any wallet.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("upsert-investor")}
            >
              <span class="pm-asset-market__control-button-title">Upsert investor</span>
              <span class="pm-asset-market__control-button-copy">
                Verify, accredit, freeze, or set jurisdiction.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("fetch-rules")}
            >
              <span class="pm-asset-market__control-button-title">Fetch asset rules</span>
              <span class="pm-asset-market__control-button-copy">
                Pull the live policy for this asset.
              </span>
            </button>

            <button
              class="pm-asset-market__control-button"
              type="button"
              onClick={() => openModal("set-rules")}
            >
              <span class="pm-asset-market__control-button-title">Set asset rules</span>
              <span class="pm-asset-market__control-button-copy">
                Update subscription, transfer, and redemption policy.
              </span>
            </button>
          </div>
        </section>
      </div>

      <AdminModal
        open={activeModal() === "fetch-investor"}
        onClose={() => setActiveModal(null)}
        eyebrow="Compliance"
        title="Fetch investor"
        subtitle="Lookup public compliance state for any wallet."
      >
        <div class="pm-asset-market__modal-stack">
          <form class="pm-market-form" onSubmit={handleInvestorLookupSubmit}>
            <div class="pm-market-fields">
              <label class="pm-field pm-field--full">
                <span class="pm-field__label">Wallet</span>
                <input
                  class="pm-field__input"
                  name="wallet"
                  type="text"
                  value={lookupWallet()}
                  onInput={event => setLookupWallet(event.currentTarget.value)}
                />
              </label>
            </div>
            <div class="pm-market-actions">
              <button class="pm-button pm-button--primary" type="submit" disabled={investorTask.pending()}>
                {investorTask.pending() ? "Loading..." : "Fetch investor"}
              </button>
            </div>
          </form>

          <Show when={investorError()}>
            {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
          </Show>

          <Show when={currentInvestor()}>
            {investor => (
              <section class="pm-asset-market__modal-result">
                <div class="pm-asset-market__fact-grid">
                  <div class="pm-asset-market__fact">
                    <span class="pm-asset-market__fact-label">Wallet</span>
                    <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                      {truncateMiddle(investor().wallet_address)}
                    </span>
                  </div>
                  <div class="pm-asset-market__fact">
                    <span class="pm-asset-market__fact-label">Jurisdiction</span>
                    <span class="pm-asset-market__fact-value">
                      {investor().jurisdiction_text ?? investor().jurisdiction}
                    </span>
                  </div>
                </div>

                <div class="pm-asset-market__stat-rows">
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Verified</span>
                    <span class="pm-asset-market__stat-value">
                      {formatAffirmation(investor().is_verified)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Accredited</span>
                    <span class="pm-asset-market__stat-value">
                      {formatAffirmation(investor().is_accredited)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Frozen</span>
                    <span class="pm-asset-market__stat-value">
                      {formatAffirmation(investor().is_frozen)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Whitelisted</span>
                    <span class="pm-asset-market__stat-value">
                      {formatAffirmation(investor().is_whitelisted)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Valid until</span>
                    <span class="pm-asset-market__stat-value">
                      {formatUnixTimestamp(investor().valid_until)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Updated</span>
                    <span class="pm-asset-market__stat-value">
                      {formatDateTime(investor().updated_at)}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "upsert-investor"}
        onClose={() => setActiveModal(null)}
        eyebrow="Compliance"
        title="Upsert investor"
        subtitle="Update verification, accreditation, freeze status, and jurisdiction."
        size="wide"
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can update investor state.")}
        >
          <div class="pm-asset-market__modal-stack">
            <form class="pm-market-form" onSubmit={handleInvestorUpsertSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Wallet</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={investorDraft().wallet}
                    onInput={event =>
                      setInvestorDraft(current => ({
                        ...current,
                        wallet: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Jurisdiction</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={investorDraft().jurisdiction}
                    onInput={event =>
                      setInvestorDraft(current => ({
                        ...current,
                        jurisdiction: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Valid until (unix)</span>
                  <input
                    class="pm-field__input"
                    type="number"
                    value={investorDraft().valid_until}
                    onInput={event =>
                      setInvestorDraft(current => ({
                        ...current,
                        valid_until: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">External ref</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={investorDraft().external_ref}
                    onInput={event =>
                      setInvestorDraft(current => ({
                        ...current,
                        external_ref: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-checkbox">
                  <input
                    type="checkbox"
                    checked={investorDraft().is_verified}
                    onChange={event =>
                      setInvestorDraft(current => ({
                        ...current,
                        is_verified: event.currentTarget.checked,
                      }))
                    }
                  />
                  <span>Verified</span>
                </label>
                <label class="pm-checkbox">
                  <input
                    type="checkbox"
                    checked={investorDraft().is_accredited}
                    onChange={event =>
                      setInvestorDraft(current => ({
                        ...current,
                        is_accredited: event.currentTarget.checked,
                      }))
                    }
                  />
                  <span>Accredited</span>
                </label>
                <label class="pm-checkbox">
                  <input
                    type="checkbox"
                    checked={investorDraft().is_frozen}
                    onChange={event =>
                      setInvestorDraft(current => ({
                        ...current,
                        is_frozen: event.currentTarget.checked,
                      }))
                    }
                  />
                  <span>Frozen</span>
                </label>
              </div>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={upsertInvestorTask.pending()}
                >
                  {upsertInvestorTask.pending() ? "Saving..." : "Upsert investor"}
                </button>
              </div>
            </form>

            <Show when={upsertError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={upsertInvestorTask.data()}>
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
                      <span class="pm-asset-market__fact-label">Wallet</span>
                      <span class="pm-asset-market__fact-value pm-asset-market__fact-value--mono">
                        {truncateMiddle(response().investor.wallet_address)}
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
        open={activeModal() === "fetch-rules"}
        onClose={() => setActiveModal(null)}
        eyebrow="Compliance"
        title="Fetch asset rules"
        subtitle={`Read the live policy for ${props.asset.name}.`}
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
            <button class="pm-button pm-button--primary" type="button" disabled={rulesTask.pending()} onClick={() => void runRulesLookup()}>
              {rulesTask.pending() ? "Loading..." : "Refresh rules"}
            </button>
          </div>

          <Show when={rulesError()}>
            {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
          </Show>

          <Show when={currentRules()}>
            {rules => (
              <section class="pm-asset-market__modal-result">
                <div class="pm-asset-market__stat-rows">
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Transfers</span>
                    <span class="pm-asset-market__stat-value">
                      {formatBooleanValue(rules().transfers_enabled)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Subscriptions</span>
                    <span class="pm-asset-market__stat-value">
                      {formatBooleanValue(rules().subscriptions_enabled)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Redemptions</span>
                    <span class="pm-asset-market__stat-value">
                      {formatBooleanValue(rules().redemptions_enabled)}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Accreditation</span>
                    <span class="pm-asset-market__stat-value">
                      {formatBooleanValue(rules().requires_accreditation)}
                    </span>
                  </div>
                <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Min investment</span>
                    <span class="pm-asset-market__stat-value">
                      {formatRuleValueForDisplay(
                        rules().min_investment,
                        props.asset.price_per_token,
                        paymentTokenMeta(),
                      )}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Max investor balance</span>
                    <span class="pm-asset-market__stat-value">
                      {formatRuleValueForDisplay(
                        rules().max_investor_balance,
                        props.asset.price_per_token,
                        paymentTokenMeta(),
                      )}
                    </span>
                  </div>
                  <div class="pm-asset-market__stat-row">
                    <span class="pm-asset-market__stat-label">Updated</span>
                    <span class="pm-asset-market__stat-value">
                      {formatDateTime(rules().updated_at)}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "set-rules"}
        onClose={() => setActiveModal(null)}
        eyebrow="Compliance"
        title="Set asset rules"
        subtitle={`Update the live policy for ${props.asset.name}.`}
        size="wide"
      >
        <Show
          when={isAdminConnected()}
          fallback={renderAdminGate("Admin auth is required before you can update asset rules.")}
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

            <form class="pm-market-form" onSubmit={handleSetRulesSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field">
                  <span class="pm-field__label">Min investment (USDC)</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={rulesDraft().min_investment}
                    onInput={event =>
                      setRulesDraft(current => ({
                        ...current,
                        min_investment: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Max investor balance (USDC)</span>
                  <input
                    class="pm-field__input"
                    type="text"
                    value={rulesDraft().max_investor_balance}
                    onInput={event =>
                      setRulesDraft(current => ({
                        ...current,
                        max_investor_balance: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label class="pm-checkbox">
                  <input
                    type="checkbox"
                    checked={rulesDraft().transfers_enabled}
                    onChange={event =>
                      setRulesDraft(current => ({
                        ...current,
                        transfers_enabled: event.currentTarget.checked,
                      }))
                    }
                  />
                  <span>Transfers enabled</span>
                </label>
                <label class="pm-checkbox">
                  <input
                    type="checkbox"
                    checked={rulesDraft().subscriptions_enabled}
                    onChange={event =>
                      setRulesDraft(current => ({
                        ...current,
                        subscriptions_enabled: event.currentTarget.checked,
                      }))
                    }
                  />
                  <span>Subscriptions enabled</span>
                </label>
                <label class="pm-checkbox">
                  <input
                    type="checkbox"
                    checked={rulesDraft().redemptions_enabled}
                    onChange={event =>
                      setRulesDraft(current => ({
                        ...current,
                        redemptions_enabled: event.currentTarget.checked,
                      }))
                    }
                  />
                  <span>Redemptions enabled</span>
                </label>
                <label class="pm-checkbox">
                  <input
                    type="checkbox"
                    checked={rulesDraft().requires_accreditation}
                    onChange={event =>
                      setRulesDraft(current => ({
                        ...current,
                        requires_accreditation: event.currentTarget.checked,
                      }))
                    }
                  />
                  <span>Accreditation required</span>
                </label>
              </div>
              <p class="pm-asset-market__panel-subcopy">
                Enter display {paymentTokenMeta().symbol} values like <code>1</code> or{" "}
                <code>10,000</code>. They are converted into 18-decimal asset-token limits
                using the current subscription settlement price of {subscriptionSettlementLabel()}.
              </p>
              <div class="pm-asset-market__stat-rows">
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Min investment preview</span>
                  <span class="pm-asset-market__stat-value">
                    {previewMinInvestmentRuleUnits()
                      ? `${formatAssetTokenValue(previewMinInvestmentRuleUnits())} tokens · ${formatNumericString(previewMinInvestmentRuleUnits())} base units`
                      : "Enter a valid amount"}
                  </span>
                </div>
                <div class="pm-asset-market__stat-row">
                  <span class="pm-asset-market__stat-label">Max balance preview</span>
                  <span class="pm-asset-market__stat-value">
                    {previewMaxInvestorBalanceRuleUnits()
                      ? `${formatAssetTokenValue(previewMaxInvestorBalanceRuleUnits())} tokens · ${formatNumericString(previewMaxInvestorBalanceRuleUnits())} base units`
                      : "Enter a valid amount"}
                  </span>
                </div>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={setRulesTask.pending()}>
                  {setRulesTask.pending() ? "Saving..." : "Set asset rules"}
                </button>
              </div>
            </form>

            <Show when={rulesUpdateError()}>
              {message => <p class="pm-market-feedback pm-market-feedback--error">{message()}</p>}
            </Show>

            <Show when={setRulesTask.data()}>
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
                        {formatDateTime(response().asset_rules.updated_at)}
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
