import { createMemo, createSignal } from "solid-js";

import type { AdminUpsertComplianceInvestorRequest } from "~/lib";

interface InvestorAdministrationPanelProps {
  error?: string | null;
  onSubmit: (
    wallet: string,
    payload: AdminUpsertComplianceInvestorRequest,
  ) => Promise<void>;
  pending?: boolean;
}

function parseDateTimeLocalToUnix(value: string): number | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Approval expiry must be a valid date and time.");
  }

  return Math.floor(parsed.getTime() / 1000);
}

export default function InvestorAdministrationPanel(props: InvestorAdministrationPanelProps) {
  const [wallet, setWallet] = createSignal("");
  const [jurisdiction, setJurisdiction] = createSignal("");
  const [validUntil, setValidUntil] = createSignal("");
  const [externalRef, setExternalRef] = createSignal("");
  const [isVerified, setIsVerified] = createSignal(false);
  const [isAccredited, setIsAccredited] = createSignal(false);
  const [isFrozen, setIsFrozen] = createSignal(false);
  const [localError, setLocalError] = createSignal<string | null>(null);

  const workflowLabel = createMemo(() => {
    if (isFrozen()) {
      return "Blocked";
    }

    if (isVerified()) {
      return isAccredited() ? "Accredited access" : "Standard access";
    }

    return "Pending approval";
  });
  const expiryLabel = createMemo(() => {
    const normalized = validUntil().trim();

    if (!normalized) {
      return "No expiry";
    }

    const parsed = new Date(normalized);

    if (Number.isNaN(parsed.getTime())) {
      return "Invalid expiry";
    }

    return parsed.toLocaleString();
  });
  const workflowCopy = createMemo(() => {
    if (isFrozen()) {
      return "This wallet is frozen. Compliance checks should block activity until the freeze is removed.";
    }

    if (isVerified() && isAccredited()) {
      return "This wallet is approved and marked accredited. It can pass both standard and accredited-only asset checks if the asset policy also allows it.";
    }

    if (isVerified()) {
      return "This wallet is approved for standard purchases. It will still be blocked by assets that require accredited investors.";
    }

    if (isAccredited()) {
      return "Accreditation is marked, but verification is still off. The wallet should remain blocked until verification is enabled.";
    }

    return "This wallet is not yet approved. Compliance checks should reject purchases until verification is enabled.";
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setLocalError(null);

    const normalizedWallet = wallet().trim();
    const normalizedJurisdiction = jurisdiction().trim();
    const normalizedValidUntil = validUntil().trim();

    if (!normalizedWallet) {
      setLocalError("Wallet is required.");
      return;
    }

    if (!normalizedJurisdiction) {
      setLocalError("Jurisdiction is required.");
      return;
    }

    await props.onSubmit(normalizedWallet, {
      is_verified: isVerified(),
      is_accredited: isAccredited(),
      is_frozen: isFrozen(),
      valid_until: parseDateTimeLocalToUnix(normalizedValidUntil),
      jurisdiction: normalizedJurisdiction,
      external_ref: externalRef().trim() || null,
    });
  }

  return (
    <section class="pm-market-card">
      <div class="pm-market-card__header">
        <div>
          <p class="pm-market-card__eyebrow">PUT /admin/compliance/investors/{'{wallet}'}</p>
          <h3 class="pm-market-card__title">Investor access profile</h3>
        </div>
        <span class="pm-market-card__hint">Admin only</span>
      </div>
      <p class="pm-market-card__copy">
        Set the compliance profile the platform reads when it decides whether this wallet can buy.
      </p>

      <form class="pm-market-form" onSubmit={handleSubmit}>
        <div class="pm-contract-workflow__summary">
          <p class="pm-contract-workflow__summary-title">{workflowLabel()}</p>
          <p class="pm-contract-workflow__summary-copy">{workflowCopy()}</p>
        </div>

        <div class="pm-market-fields">
          <label class="pm-field pm-field--full">
            <span class="pm-field__label">Wallet address</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="0x..."
              value={wallet()}
              onInput={event => setWallet(event.currentTarget.value)}
            />
          </label>
          <label class="pm-field">
            <span class="pm-field__label">Jurisdiction code</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="GLOBAL, NG, US, or 0x..."
              value={jurisdiction()}
              onInput={event => setJurisdiction(event.currentTarget.value)}
            />
          </label>
          <label class="pm-field">
            <span class="pm-field__label">Approval expires (optional)</span>
            <input
              class="pm-field__input"
              type="datetime-local"
              step="60"
              value={validUntil()}
              onInput={event => setValidUntil(event.currentTarget.value)}
            />
          </label>
          <label class="pm-field pm-field--full">
            <span class="pm-field__label">Case or reference</span>
            <input
              class="pm-field__input"
              type="text"
              placeholder="KYC_CASE_123"
              value={externalRef()}
              onInput={event => setExternalRef(event.currentTarget.value)}
            />
          </label>
          <label class="pm-checkbox">
            <input
              type="checkbox"
              checked={isVerified()}
              onChange={event => setIsVerified(event.currentTarget.checked)}
            />
            <span>Verified for trading</span>
          </label>
          <label class="pm-checkbox">
            <input
              type="checkbox"
              checked={isAccredited()}
              onChange={event => setIsAccredited(event.currentTarget.checked)}
            />
            <span>Accredited investor</span>
          </label>
          <label class="pm-checkbox">
            <input
              type="checkbox"
              checked={isFrozen()}
              onChange={event => setIsFrozen(event.currentTarget.checked)}
            />
            <span>Freeze wallet</span>
          </label>
        </div>

        <div class="pm-contract-workflow__meta">
          <span class="pm-market-chip">{workflowLabel()}</span>
          <span class="pm-market-chip">{jurisdiction().trim() || "Jurisdiction not set"}</span>
          <span class="pm-market-chip">{expiryLabel()}</span>
        </div>

        <p class="pm-contract-workflow__hint">
          Leave expiry blank for an open-ended approval window. Jurisdiction accepts short text
          codes like `GLOBAL`, `NG`, or `US`, or a raw bytes32 value if needed.
        </p>

        <div class="pm-market-actions">
          <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
            {props.pending ? "Saving..." : "Save investor profile"}
          </button>
        </div>
      </form>

      {(localError() ?? props.error) && (
        <p class="pm-market-feedback pm-market-feedback--error">{localError() ?? props.error}</p>
      )}
    </section>
  );
}
