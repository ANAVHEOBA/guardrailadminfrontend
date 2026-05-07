import { Show, createMemo, createSignal, type JSX } from "solid-js";

import {
  complianceClient,
  readAdminToken,
  type AdminComplianceAssetRulesUpsertResponse,
  type AdminComplianceInvestorUpsertResponse,
  type AdminSetComplianceAssetRulesRequest,
  type AdminUpsertComplianceInvestorRequest,
  type ComplianceAssetRulesResponse,
  type ComplianceCheckResponse,
  type ComplianceCheckSubscribeRequest,
  type ComplianceInvestorResponse,
} from "~/lib";
import { useAdminAuth } from "~/lib/admin-auth-context";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";
import { shortenWalletAddress } from "~/lib/wallet/ethereum";

import {
  formatBooleanValue,
  formatDateTime,
  formatNumericString,
  formatUnixTimestamp,
  truncateMiddle,
} from "./asset-detail/format";
import AdminModal from "./AdminModal";
import {
  AssetRulesAdministrationPanel,
  AssetRulesLookupPanel,
  InvestorAdministrationPanel,
  InvestorLookupPanel,
  SubscribeCheckPanel,
  WhitelistActionPanel,
  type WhitelistAction,
} from "./compliance";

type ComplianceModalView =
  | "investor-directory"
  | "policy-desk"
  | "investor-administration"
  | "whitelist-operations"
  | "asset-policy";

interface ActionCardProps {
  actionLabel: string;
  endpoint: string;
  title: string;
  copy: string;
  detail: string;
  onOpen: () => void;
  tone?: "default" | "admin";
}

interface EligibilitySnapshot {
  request: ComplianceCheckSubscribeRequest;
  response: ComplianceCheckResponse;
}

function formatWalletLabel(walletAddress: string | null | undefined) {
  if (!walletAddress) {
    return "Admin wallet";
  }

  return shortenWalletAddress(walletAddress);
}

function formatAffirmation(value: boolean) {
  return value ? "Yes" : "No";
}

function readInvestorStatusLabel(investor: ComplianceInvestorResponse | null | undefined) {
  if (!investor) {
    return "-";
  }

  if (investor.is_frozen) {
    return "Frozen";
  }

  if (investor.is_whitelisted) {
    return "Whitelisted";
  }

  if (investor.is_verified) {
    return "Verified";
  }

  return "Unverified";
}

function readRulesStatusLabel(rules: ComplianceAssetRulesResponse | null | undefined) {
  if (!rules) {
    return "-";
  }

  if (!rules.subscriptions_enabled) {
    return "Closed";
  }

  return rules.requires_accreditation ? "Restricted" : "Open";
}

function readEligibilityStatusLabel(snapshot: EligibilitySnapshot | null | undefined) {
  if (!snapshot) {
    return "-";
  }

  return snapshot.response.is_valid ? "Pass" : "Blocked";
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
        {shouldShorten() ? truncateMiddle(props.value) : props.value}
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
              Investor mutations, whitelist operations, and asset policy writes stay protected until
              an admin wallet challenge is completed.
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

function InvestorResult(props: {
  badge: string;
  eyebrow: string;
  investor: ComplianceInvestorResponse;
  title: string;
  txHash?: string | null;
}) {
  return (
    <div class="pm-market-result">
      <div class="pm-market-result__header">
        <div>
          <p class="pm-market-result__eyebrow">{props.eyebrow}</p>
          <h3 class="pm-market-result__title">{props.title}</h3>
        </div>
        <span class="pm-market-result__badge">{props.badge}</span>
      </div>

      <div class="pm-market-result__grid">
        <div>
          <span class="pm-market-result__label">Wallet</span>
          <span class="pm-market-result__value">{props.investor.wallet_address}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Jurisdiction</span>
          <span class="pm-market-result__value">
            {props.investor.jurisdiction_text ?? props.investor.jurisdiction}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Verified</span>
          <span class="pm-market-result__value">{formatAffirmation(props.investor.is_verified)}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Whitelisted</span>
          <span class="pm-market-result__value">
            {formatAffirmation(props.investor.is_whitelisted)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Accredited</span>
          <span class="pm-market-result__value">
            {formatAffirmation(props.investor.is_accredited)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Frozen</span>
          <span class="pm-market-result__value">{formatAffirmation(props.investor.is_frozen)}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Valid until</span>
          <span class="pm-market-result__value">{formatUnixTimestamp(props.investor.valid_until)}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Updated</span>
          <span class="pm-market-result__value">{formatDateTime(props.investor.updated_at)}</span>
        </div>
        <Show when={props.investor.external_ref_text ?? props.investor.external_ref}>
          {externalRef => (
            <div>
              <span class="pm-market-result__label">External ref</span>
              <span class="pm-market-result__value">{externalRef()}</span>
            </div>
          )}
        </Show>
        <Show when={props.txHash ?? props.investor.last_tx_hash}>
          {txHash => (
            <div>
              <span class="pm-market-result__label">Transaction</span>
              <span class="pm-market-result__value">{txHash()}</span>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

function RulesResult(props: {
  badge: string;
  eyebrow: string;
  rules: ComplianceAssetRulesResponse;
  title: string;
  txHash?: string | null;
}) {
  return (
    <div class="pm-market-result">
      <div class="pm-market-result__header">
        <div>
          <p class="pm-market-result__eyebrow">{props.eyebrow}</p>
          <h3 class="pm-market-result__title">{props.title}</h3>
        </div>
        <span class="pm-market-result__badge">{props.badge}</span>
      </div>

      <div class="pm-market-result__grid">
        <div>
          <span class="pm-market-result__label">Asset</span>
          <span class="pm-market-result__value">{props.rules.asset_address}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Min investment</span>
          <span class="pm-market-result__value">{formatNumericString(props.rules.min_investment)}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Max investor balance</span>
          <span class="pm-market-result__value">
            {formatNumericString(props.rules.max_investor_balance)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Transfers</span>
          <span class="pm-market-result__value">
            {formatBooleanValue(props.rules.transfers_enabled)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Subscriptions</span>
          <span class="pm-market-result__value">
            {formatBooleanValue(props.rules.subscriptions_enabled)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Redemptions</span>
          <span class="pm-market-result__value">
            {formatBooleanValue(props.rules.redemptions_enabled)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Accreditation required</span>
          <span class="pm-market-result__value">
            {formatAffirmation(props.rules.requires_accreditation)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Updated</span>
          <span class="pm-market-result__value">{formatDateTime(props.rules.updated_at)}</span>
        </div>
        <Show when={props.txHash ?? props.rules.last_tx_hash}>
          {txHash => (
            <div>
              <span class="pm-market-result__label">Transaction</span>
              <span class="pm-market-result__value">{txHash()}</span>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

function SubscribeCheckResult(props: {
  snapshot: EligibilitySnapshot;
}) {
  return (
    <div class="pm-market-result">
      <div class="pm-market-result__header">
        <div>
          <p class="pm-market-result__eyebrow">Eligibility check</p>
          <h3 class="pm-market-result__title">Subscription decision</h3>
        </div>
        <span class="pm-market-result__badge">
          {props.snapshot.response.is_valid ? "Eligible" : "Blocked"}
        </span>
      </div>

      <div class="pm-market-result__grid">
        <div>
          <span class="pm-market-result__label">Asset</span>
          <span class="pm-market-result__value">{props.snapshot.request.asset_address}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Investor</span>
          <span class="pm-market-result__value">{props.snapshot.request.investor_wallet}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Amount</span>
          <span class="pm-market-result__value">{formatNumericString(props.snapshot.request.amount)}</span>
        </div>
        <div>
          <span class="pm-market-result__label">Resulting balance</span>
          <span class="pm-market-result__value">
            {formatNumericString(props.snapshot.request.resulting_balance)}
          </span>
        </div>
        <div>
          <span class="pm-market-result__label">Reason</span>
          <span class="pm-market-result__value">{props.snapshot.response.reason}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminComplianceManager() {
  const auth = useAdminAuth();
  const investorTask = useAsyncTask((wallet: string) => complianceClient.fetchInvestor(wallet));
  const rulesTask = useAsyncTask((assetAddress: string) =>
    complianceClient.fetchAssetRules(assetAddress),
  );
  const subscribeCheckTask = useAsyncTask((request: ComplianceCheckSubscribeRequest) =>
    complianceClient.checkSubscribe(request),
  );
  const upsertInvestorTask = useAsyncTask(
    (token: string, wallet: string, payload: AdminUpsertComplianceInvestorRequest) =>
      complianceClient.upsertInvestor(token, wallet, payload),
  );
  const addToWhitelistTask = useAsyncTask((token: string, wallet: string) =>
    complianceClient.addInvestorToWhitelist(token, wallet),
  );
  const removeFromWhitelistTask = useAsyncTask((token: string, wallet: string) =>
    complianceClient.removeInvestorFromWhitelist(token, wallet),
  );
  const setRulesTask = useAsyncTask(
    (token: string, assetAddress: string, payload: AdminSetComplianceAssetRulesRequest) =>
      complianceClient.setAssetRules(token, assetAddress, payload),
  );

  const [activeModal, setActiveModal] = createSignal<ComplianceModalView | null>(null);
  const [investorLookupError, setInvestorLookupError] = createSignal<string | null>(null);
  const [rulesLookupError, setRulesLookupError] = createSignal<string | null>(null);
  const [subscribeCheckError, setSubscribeCheckError] = createSignal<string | null>(null);
  const [investorWriteError, setInvestorWriteError] = createSignal<string | null>(null);
  const [whitelistWriteError, setWhitelistWriteError] = createSignal<string | null>(null);
  const [rulesWriteError, setRulesWriteError] = createSignal<string | null>(null);
  const [currentInvestor, setCurrentInvestor] = createSignal<ComplianceInvestorResponse | null>(null);
  const [currentInvestorTxHash, setCurrentInvestorTxHash] = createSignal<string | null>(null);
  const [currentRules, setCurrentRules] = createSignal<ComplianceAssetRulesResponse | null>(null);
  const [currentRulesTxHash, setCurrentRulesTxHash] = createSignal<string | null>(null);
  const [latestEligibility, setLatestEligibility] = createSignal<EligibilitySnapshot | null>(null);

  const adminToken = () => readAdminToken();
  const isAdminConnected = () => Boolean(adminToken());
  const adminWalletLabel = () => formatWalletLabel(auth.profile()?.user.wallet?.wallet_address);
  const investorSummaryMeta = createMemo(() => {
    const investor = currentInvestor();

    if (!investor) {
      return "Load an investor snapshot to inspect live profile state";
    }

    return investor.jurisdiction_text ?? investor.jurisdiction;
  });
  const rulesSummaryMeta = createMemo(() => {
    const rules = currentRules();

    if (!rules) {
      return "Load an asset policy snapshot to inspect current rules";
    }

    return rules.requires_accreditation
      ? "Subscriptions are gated by accreditation"
      : "Subscriptions do not require accreditation";
  });
  const eligibilityMeta = createMemo(() => {
    const snapshot = latestEligibility();

    if (!snapshot) {
      return "Run a public subscription check before escalating to admin tools";
    }

    return snapshot.response.reason;
  });

  async function handleInvestorLookup(wallet: string) {
    setInvestorLookupError(null);

    try {
      const response = await investorTask.run(wallet);
      setCurrentInvestor(response);
      setCurrentInvestorTxHash(response.last_tx_hash ?? null);
    } catch (error) {
      setInvestorLookupError(getErrorMessage(error));
    }
  }

  async function handleRulesLookup(assetAddress: string) {
    setRulesLookupError(null);

    try {
      const response = await rulesTask.run(assetAddress);
      setCurrentRules(response);
      setCurrentRulesTxHash(response.last_tx_hash ?? null);
    } catch (error) {
      setRulesLookupError(getErrorMessage(error));
    }
  }

  async function handleSubscribeCheck(request: ComplianceCheckSubscribeRequest) {
    setSubscribeCheckError(null);

    try {
      const response = await subscribeCheckTask.run(request);
      setLatestEligibility({
        request,
        response,
      });
    } catch (error) {
      setSubscribeCheckError(getErrorMessage(error));
    }
  }

  async function handleInvestorWrite(
    wallet: string,
    payload: AdminUpsertComplianceInvestorRequest,
  ) {
    const token = adminToken();

    if (!token) {
      setInvestorWriteError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    setInvestorWriteError(null);

    try {
      const response = await upsertInvestorTask.run(token, wallet, payload);
      setCurrentInvestor(response.investor);
      setCurrentInvestorTxHash(response.tx_hash);
    } catch (error) {
      setInvestorWriteError(getErrorMessage(error));
    }
  }

  async function handleWhitelistWrite(action: WhitelistAction, wallet: string) {
    const token = adminToken();

    if (!token) {
      setWhitelistWriteError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    setWhitelistWriteError(null);

    try {
      let response: AdminComplianceInvestorUpsertResponse;

      if (action === "add") {
        response = await addToWhitelistTask.run(token, wallet);
        removeFromWhitelistTask.reset();
      } else {
        response = await removeFromWhitelistTask.run(token, wallet);
        addToWhitelistTask.reset();
      }

      setCurrentInvestor(response.investor);
      setCurrentInvestorTxHash(response.tx_hash);
    } catch (error) {
      setWhitelistWriteError(getErrorMessage(error));
    }
  }

  async function handleRulesWrite(
    assetAddress: string,
    payload: AdminSetComplianceAssetRulesRequest,
  ) {
    const token = adminToken();

    if (!token) {
      setRulesWriteError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    setRulesWriteError(null);

    try {
      const response: AdminComplianceAssetRulesUpsertResponse = await setRulesTask.run(
        token,
        assetAddress,
        payload,
      );
      setCurrentRules(response.asset_rules);
      setCurrentRulesTxHash(response.tx_hash);
    } catch (error) {
      setRulesWriteError(getErrorMessage(error));
    }
  }

  return (
    <>
      <div class="pm-asset-admin">
        <section class="pm-asset-admin__hero">
          <div class="pm-asset-admin__hero-copy">
            <div class="pm-asset-admin__masthead">
              <div class="pm-asset-admin__masthead-copy">
                <p class="pm-admin-section-header__eyebrow">Compliance control plane</p>
                <h1 class="pm-asset-admin__title">
                  Run investor eligibility and asset policy from one clean workspace.
                </h1>
                <p class="pm-asset-admin__copy">
                  Inspect investor state, simulate subscription eligibility, and launch guarded
                  policy changes without managing a stack of raw endpoint forms in the page body.
                </p>
              </div>

              <div class="pm-asset-admin__actions">
                <button
                  class="pm-button pm-button--primary"
                  type="button"
                  onClick={() => setActiveModal("investor-directory")}
                >
                  Investor directory
                </button>
                <button
                  class="pm-button pm-button--ghost"
                  type="button"
                  onClick={() => setActiveModal("policy-desk")}
                >
                  Policy desk
                </button>
              </div>
            </div>

            <div class="pm-asset-admin__stats">
              <DashboardStat
                label="Investor state"
                value={readInvestorStatusLabel(currentInvestor())}
                meta={investorSummaryMeta()}
              />
              <DashboardStat
                label="Policy posture"
                value={readRulesStatusLabel(currentRules())}
                meta={rulesSummaryMeta()}
              />
              <DashboardStat
                label="Eligibility check"
                value={readEligibilityStatusLabel(latestEligibility())}
                meta={eligibilityMeta()}
              />
              <DashboardStat
                label="Write access"
                value={isAdminConnected() ? "Ready" : "Locked"}
                meta="Admin wallet challenge gates all mutations"
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
                    Public reads remain available, but investor mutations, whitelist operations, and
                    asset policy changes require an allowlisted admin wallet session.
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
                Write access enabled
              </span>
              <h2 class="pm-asset-admin__session-title">Authenticated and ready</h2>
              <p class="pm-asset-admin__session-copy">
                Investor updates, whitelist actions, and asset rule changes are available from the
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
              <h2 class="pm-tool-section__title">Read first, then intervene</h2>
            </div>
            <p class="pm-admin-section-note">
              Public compliance reads and guarded mutations are grouped by operator task so it is
              obvious where to inspect live state versus where to take action.
            </p>
          </div>

          <div class="pm-asset-admin__lane-grid">
            <section class="pm-asset-admin__lane">
              <div class="pm-asset-admin__lane-head">
                <div>
                  <p class="pm-asset-admin__lane-kicker">Observe</p>
                  <h3 class="pm-asset-admin__lane-title">Validate investor eligibility</h3>
                </div>
                <span class="pm-market-chip">Public</span>
              </div>
              <p class="pm-asset-admin__lane-copy">
                Inspect investor state, review per-asset rules, and simulate subscription decisions
                before you move into manual admin intervention.
              </p>
              <div class="pm-asset-action-stack">
                <ActionCard
                  actionLabel="Read"
                  endpoint="GET /compliance/investors/{wallet}"
                  title="Investor directory"
                  copy="Inspect verification, freeze, validity, and derived whitelist state for any wallet."
                  detail="Best first stop when a user cannot buy"
                  onOpen={() => setActiveModal("investor-directory")}
                />
                <ActionCard
                  actionLabel="Read"
                  endpoint="GET /compliance/assets/{asset}/rules · POST /compliance/check/subscribe"
                  title="Policy desk"
                  copy="Review live asset rules and run a public subscription check against the current compliance engine."
                  detail="Use before applying any investor or rule mutation"
                  onOpen={() => setActiveModal("policy-desk")}
                />
              </div>
            </section>

            <section class="pm-asset-admin__lane pm-asset-admin__lane--admin">
              <div class="pm-asset-admin__lane-head">
                <div>
                  <p class="pm-asset-admin__lane-kicker">Operate</p>
                  <h3 class="pm-asset-admin__lane-title">Run guarded compliance workflows</h3>
                </div>
                <span class="pm-market-chip">Admin</span>
              </div>
              <p class="pm-asset-admin__lane-copy">
                Open focused write flows for investor profile updates, explicit whitelist actions,
                and asset policy changes instead of editing a long inline form stack.
              </p>
              <div class="pm-asset-action-stack">
                <ActionCard
                  actionLabel="Write"
                  endpoint="PUT /admin/compliance/investors/{wallet}"
                  title="Investor administration"
                  copy="Verify, accredit, freeze, or update jurisdiction without leaving the operator workspace."
                  detail="Maintains the canonical investor profile"
                  onOpen={() => setActiveModal("investor-administration")}
                  tone="admin"
                />
                <ActionCard
                  actionLabel="Write"
                  endpoint="POST|DELETE /admin/compliance/investors/{wallet}/whitelist"
                  title="Whitelist operations"
                  copy="Apply or remove direct whitelist access when you need an explicit wallet-level intervention."
                  detail="Dedicated add/remove flow for the whitelist path"
                  onOpen={() => setActiveModal("whitelist-operations")}
                  tone="admin"
                />
                <ActionCard
                  actionLabel="Write"
                  endpoint="PUT /admin/compliance/assets/{asset}/rules"
                  title="Asset policy"
                  copy="Set transfer, subscription, redemption, accreditation, and balance constraints in one focused workflow."
                  detail="Writes the policy tuple the contract evaluates at buy time"
                  onOpen={() => setActiveModal("asset-policy")}
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
                <p class="pm-market-card__eyebrow">Investor pulse</p>
                <h3 class="pm-market-card__title">Current investor state</h3>
              </div>
              <button
                class="pm-button pm-button--ghost"
                type="button"
                onClick={() => setActiveModal("investor-directory")}
              >
                Open directory
              </button>
            </div>

            <Show
              when={currentInvestor()}
              fallback={
                <div class="pm-asset-admin__empty">
                  <p class="pm-asset-admin__empty-title">No investor snapshot loaded</p>
                  <p class="pm-asset-admin__empty-copy">
                    Fetch an investor profile first, then use the admin tools only if the public
                    state confirms an intervention is needed.
                  </p>
                  <div class="pm-asset-admin__empty-actions">
                    <button
                      class="pm-button pm-button--ghost"
                      type="button"
                      onClick={() => setActiveModal("investor-directory")}
                    >
                      Fetch investor
                    </button>
                    <Show when={isAdminConnected()}>
                      <button
                        class="pm-button pm-button--primary"
                        type="button"
                        onClick={() => setActiveModal("investor-administration")}
                      >
                        Update investor
                      </button>
                    </Show>
                  </div>
                </div>
              }
            >
              {investor => (
                <>
                  <div class="pm-asset-admin__facts-grid">
                    <ControlFact label="Wallet" value={investor().wallet_address} />
                    <ControlFact
                      label="Jurisdiction"
                      value={investor().jurisdiction_text ?? investor().jurisdiction}
                      shorten={false}
                    />
                    <ControlFact
                      label="Valid until"
                      value={formatUnixTimestamp(investor().valid_until)}
                      meta="Zero means no expiry window"
                      shorten={false}
                    />
                    <ControlFact
                      label="Updated"
                      value={formatDateTime(investor().updated_at)}
                      meta="Latest synced compliance state"
                      shorten={false}
                    />
                    <ControlFact
                      label="Verified"
                      value={formatAffirmation(investor().is_verified)}
                      meta="Investor verification flag"
                      shorten={false}
                    />
                    <ControlFact
                      label="Whitelisted"
                      value={formatAffirmation(investor().is_whitelisted)}
                      meta="Derived effective buy eligibility"
                      shorten={false}
                    />
                  </div>

                  <Show when={currentInvestorTxHash()}>
                    {txHash => (
                      <div class="pm-asset-modal__summary">
                        <span class="pm-market-chip">TX {truncateMiddle(txHash())}</span>
                      </div>
                    )}
                  </Show>
                </>
              )}
            </Show>
          </article>

          <article class="pm-asset-snapshot-card">
            <div class="pm-asset-snapshot-card__header">
              <div>
                <p class="pm-market-card__eyebrow">Policy pulse</p>
                <h3 class="pm-market-card__title">Asset rules and latest eligibility check</h3>
              </div>
              <button
                class="pm-button pm-button--ghost"
                type="button"
                onClick={() => setActiveModal("policy-desk")}
              >
                Open policy desk
              </button>
            </div>

            <Show
              when={currentRules() || latestEligibility()}
              fallback={
                <div class="pm-asset-admin__empty">
                  <p class="pm-asset-admin__empty-title">No policy snapshot loaded</p>
                  <p class="pm-asset-admin__empty-copy">
                    Pull an asset rule set or run a subscription check to establish whether the
                    issue is policy-level or investor-level.
                  </p>
                  <div class="pm-asset-admin__empty-actions">
                    <button
                      class="pm-button pm-button--ghost"
                      type="button"
                      onClick={() => setActiveModal("policy-desk")}
                    >
                      Review policy
                    </button>
                    <Show when={isAdminConnected()}>
                      <button
                        class="pm-button pm-button--primary"
                        type="button"
                        onClick={() => setActiveModal("asset-policy")}
                      >
                        Update policy
                      </button>
                    </Show>
                  </div>
                </div>
              }
            >
              <>
                <Show when={currentRules()}>
                  {rules => (
                    <>
                      <div class="pm-asset-admin__facts-grid">
                        <ControlFact label="Asset" value={rules().asset_address} />
                        <ControlFact
                          label="Subscriptions"
                          value={formatBooleanValue(rules().subscriptions_enabled)}
                          meta="Public buy path switch"
                          shorten={false}
                        />
                        <ControlFact
                          label="Transfers"
                          value={formatBooleanValue(rules().transfers_enabled)}
                          meta="Peer transfer switch"
                          shorten={false}
                        />
                        <ControlFact
                          label="Redemptions"
                          value={formatBooleanValue(rules().redemptions_enabled)}
                          meta="Redeem path switch"
                          shorten={false}
                        />
                        <ControlFact
                          label="Accreditation"
                          value={formatAffirmation(rules().requires_accreditation)}
                          meta="Investor accreditation requirement"
                          shorten={false}
                        />
                        <ControlFact
                          label="Min investment"
                          value={formatNumericString(rules().min_investment)}
                          meta="Raw rule units"
                          shorten={false}
                        />
                        <ControlFact
                          label="Max balance"
                          value={formatNumericString(rules().max_investor_balance)}
                          meta="Raw rule units"
                          shorten={false}
                        />
                        <ControlFact
                          label="Updated"
                          value={formatDateTime(rules().updated_at)}
                          meta="Latest synced rule state"
                          shorten={false}
                        />
                      </div>

                      <Show when={currentRulesTxHash()}>
                        {txHash => (
                          <div class="pm-asset-modal__summary">
                            <span class="pm-market-chip">TX {truncateMiddle(txHash())}</span>
                          </div>
                        )}
                      </Show>
                    </>
                  )}
                </Show>

                <Show when={latestEligibility()}>
                  {snapshot => <SubscribeCheckResult snapshot={snapshot()} />}
                </Show>
              </>
            </Show>
          </article>
        </section>
      </div>

      <AdminModal
        open={activeModal() === "investor-directory"}
        onClose={() => setActiveModal(null)}
        eyebrow="Public read"
        title="Investor directory"
        subtitle="Lookup public investor state for any wallet and keep a clean snapshot in the workspace."
      >
        <div class="pm-asset-modal-stack">
          <InvestorLookupPanel
            pending={investorTask.pending()}
            error={investorLookupError()}
            onSubmit={handleInvestorLookup}
          />

          <Show when={currentInvestor()}>
            {investor => (
              <InvestorResult
                eyebrow="Directory snapshot"
                title={truncateMiddle(investor().wallet_address)}
                badge={readInvestorStatusLabel(investor())}
                investor={investor()}
                txHash={currentInvestorTxHash()}
              />
            )}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "policy-desk"}
        onClose={() => setActiveModal(null)}
        eyebrow="Public read"
        title="Policy desk"
        subtitle="Inspect live asset rules and run a public subscription check before you reach for admin intervention."
        size="wide"
      >
        <div class="pm-asset-modal-stack">
          <div class="pm-tool-section__grid">
            <AssetRulesLookupPanel
              pending={rulesTask.pending()}
              error={rulesLookupError()}
              onSubmit={handleRulesLookup}
            />
            <SubscribeCheckPanel
              pending={subscribeCheckTask.pending()}
              error={subscribeCheckError()}
              onSubmit={handleSubscribeCheck}
            />
          </div>

          <Show when={currentRules()}>
            {rules => (
              <RulesResult
                eyebrow="Policy snapshot"
                title={truncateMiddle(rules().asset_address)}
                badge={readRulesStatusLabel(rules())}
                rules={rules()}
                txHash={currentRulesTxHash()}
              />
            )}
          </Show>

          <Show when={latestEligibility()}>
            {snapshot => <SubscribeCheckResult snapshot={snapshot()} />}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "investor-administration"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin write"
        title="Investor administration"
        subtitle="Update verification, accreditation, freeze status, validity, and jurisdiction through a focused admin workflow."
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
            <InvestorAdministrationPanel
              pending={upsertInvestorTask.pending()}
              error={investorWriteError()}
              onSubmit={handleInvestorWrite}
            />
          </AdminGate>

          <Show when={upsertInvestorTask.data()}>
            {response => (
              <InvestorResult
                eyebrow="Investor profile updated"
                title={truncateMiddle(response().investor.wallet_address)}
                badge={readInvestorStatusLabel(response().investor)}
                investor={response().investor}
                txHash={response().tx_hash}
              />
            )}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "whitelist-operations"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin write"
        title="Whitelist operations"
        subtitle="Apply or remove direct whitelist access through the dedicated wallet-level endpoints."
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
            <WhitelistActionPanel
              pending={addToWhitelistTask.pending() || removeFromWhitelistTask.pending()}
              error={whitelistWriteError()}
              onSubmit={handleWhitelistWrite}
            />
          </AdminGate>

          <Show when={addToWhitelistTask.data()}>
            {response => (
              <InvestorResult
                eyebrow="Whitelist updated"
                title={truncateMiddle(response().investor.wallet_address)}
                badge="Whitelisted"
                investor={response().investor}
                txHash={response().tx_hash}
              />
            )}
          </Show>

          <Show when={removeFromWhitelistTask.data()}>
            {response => (
              <InvestorResult
                eyebrow="Whitelist updated"
                title={truncateMiddle(response().investor.wallet_address)}
                badge="Removed"
                investor={response().investor}
                txHash={response().tx_hash}
              />
            )}
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "asset-policy"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin write"
        title="Asset policy"
        subtitle="Update the asset rule tuple the contract evaluates for subscriptions, transfers, and redemptions."
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
            <AssetRulesAdministrationPanel
              pending={setRulesTask.pending()}
              error={rulesWriteError()}
              onSubmit={handleRulesWrite}
            />
          </AdminGate>

          <Show when={setRulesTask.data()}>
            {response => (
              <RulesResult
                eyebrow="Policy updated"
                title={truncateMiddle(response().asset_rules.asset_address)}
                badge={readRulesStatusLabel(response().asset_rules)}
                rules={response().asset_rules}
                txHash={response().tx_hash}
              />
            )}
          </Show>
        </div>
      </AdminModal>
    </>
  );
}
