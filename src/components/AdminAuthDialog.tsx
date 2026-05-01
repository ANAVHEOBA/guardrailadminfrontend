import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type Component,
} from "solid-js";
import { Portal } from "solid-js/web";

import type {
  AdminAuthResponse,
  AdminWalletChallengeResponse,
  AdminWalletConnectRequest,
} from "~/lib/admin";
import { ApiError } from "~/lib/api";
import {
  discoverInjectedWallets,
  requestWalletAccount,
  shortenWalletAddress,
  signWalletMessage,
  type DiscoveredWallet,
  type WalletKind,
} from "~/lib/wallet/ethereum";

interface AdminAuthDialogProps {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  requestChallenge: (walletAddress: string) => Promise<AdminWalletChallengeResponse>;
  completeConnection: (payload: AdminWalletConnectRequest) => Promise<AdminAuthResponse>;
}

interface PendingWalletConnect {
  account: string;
  challengeId: string;
  signature: string;
}

type AuthPhase =
  | "idle"
  | "discovering"
  | "requesting_account"
  | "challenge"
  | "signing"
  | "verifying"
  | "username"
  | "success";

const walletSkeletonTiles = Array.from({ length: 4 });

function MetaMaskIcon() {
  return (
    <svg viewBox="0 0 142 136.878" aria-hidden="true">
      <path
        d="M132.682 132.192l-30.583-9.106-23.063 13.787-16.092-.007-23.077-13.78-30.569 9.106L0 100.801l9.299-34.839L0 36.507 9.299 0l47.766 28.538h27.85L132.682 0l9.299 36.507-9.299 29.455 9.299 34.839-9.299 31.391Z"
        fill="#FF5C16"
      />
      <path
        d="M9.305 0 57.072 28.558l-1.899 19.599L9.305 0Zm30.57 100.814 21.017 16.01-21.017 6.261v-22.271Zm19.337-26.469-4.039-26.174L29.317 65.97v.006l-.014-.007v.013l.08 18.321 10.485-9.951h19.344ZM132.682 0 84.915 28.558l1.893 19.599L132.682 0ZM102.113 100.814l-21.018 16.01 21.018 6.261v-22.271Zm10.565-34.839h.007v-.013l-.013.007L86.815 48.171l-4.039 26.174h19.336l10.492 9.95.074-18.32Z"
        fill="#E34807"
      />
      <path
        d="M0 100.801 9.299 65.962h19.997l.073 18.327 27.584 6.843 8.092 21.039-4.16 4.633-21.017-16.01H0ZM141.981 100.801l-9.299-34.839h-19.998l-.073 18.327-27.582 6.843-8.093 21.039 4.159 4.633 21.018-16.01h39.868Zm-57.066-72.263h-27.85l-1.891 19.599 9.872 64.013h11.891l9.878-64.013-1.9-19.599Z"
        fill="#FF8D5D"
      />
    </svg>
  );
}

function CoinbaseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="#0052FF" />
      <rect width="20" height="20" rx="5.4" fill="#0052FF" />
      <path
        fill="#fff"
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M10.0001 17C13.8661 17 17.0001 13.866 17.0001 10C17.0001 6.13401 13.8661 3 10.0001 3C6.13413 3 3.00012 6.13401 3.00012 10C3.00012 13.866 6.13413 17 10.0001 17ZM8.25012 7.71429C7.95427 7.71429 7.71441 7.95414 7.71441 8.25V11.75C7.71441 12.0459 7.95427 12.2857 8.25012 12.2857H11.7501C12.046 12.2857 12.2858 12.0459 12.2858 11.75V8.25C12.2858 7.95414 12.046 7.71429 11.7501 7.71429H8.25012Z"
      />
    </svg>
  );
}

function BraveIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 3.5 24.5 6.5l2.2 7.4-1.6 8.2L16 28.5 6.9 22.1l-1.6-8.2 2.2-7.4L16 3.5Z"
        fill="#fb542b"
      />
      <path
        d="M11.2 12.1h2.1l1.1-1.4h3.2l1.1 1.4h2.1l-1.6 6.6-3.2 2.3-3.2-2.3-1.6-6.6Zm2.4 1.8.9 3.7 1.5 1.1 1.5-1.1.9-3.7h-1.3l-1.1 1.4h-2l-1.1-1.4h-1.3Z"
        fill="#fff"
      />
    </svg>
  );
}

function PhantomIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#ab9ff2" />
      <path
        fill="#fff"
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M13.724 20.753c-1.181 1.754-3.161 3.974-5.795 3.974-1.245 0-2.443-.496-2.443-2.655 0-5.499 7.74-14.012 14.923-14.012 4.086 0 5.714 2.745 5.714 5.864 0 4.007-2.682 8.588-5.347 8.588-.846 0-1.261-.45-1.261-1.164 0-.186.032-.388.096-.595-.91 1.506-2.667 2.904-4.312 2.904-1.198 0-1.805-.73-1.805-1.755 0-.372.08-.76.23-1.149Zm5.18-8.463c-.65.001-1.093.536-1.091 1.3.001.764.447 1.314 1.098 1.313.635-.001 1.078-.552 1.076-1.316-.001-.764-.447-1.298-1.083-1.297Zm3.453-.004c-.65.001-1.093.536-1.092 1.3.002.764.447 1.314 1.099 1.313.635-.001 1.078-.552 1.076-1.316-.001-.764-.447-1.298-1.083-1.297Z"
      />
    </svg>
  );
}

function BrowserWalletIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2.25" y="3.5" width="15.5" height="13" rx="3" fill="#f97316" />
      <rect x="4.25" y="5.5" width="11.5" height="9" rx="2" fill="#fff7ed" />
      <path
        d="M8.2 12.6V8.1h2.45c1.13 0 1.85.62 1.85 1.62 0 .62-.29 1.1-.8 1.36l1.04 1.52H11.2l-.83-1.27H9.55v1.27H8.2Zm1.35-2.39h.96c.45 0 .74-.2.74-.56 0-.36-.29-.56-.74-.56h-.96v1.12Z"
        fill="#f97316"
      />
    </svg>
  );
}

function getFallbackWalletIcon(kind: WalletKind): Component {
  switch (kind) {
    case "metamask":
      return MetaMaskIcon;
    case "coinbase":
      return CoinbaseIcon;
    case "brave":
      return BraveIcon;
    case "phantom":
      return PhantomIcon;
    default:
      return BrowserWalletIcon;
  }
}

function WalletTileIcon(props: { wallet: DiscoveredWallet }) {
  const [useFallbackIcon, setUseFallbackIcon] = createSignal(false);
  const FallbackIcon = getFallbackWalletIcon(props.wallet.kind);

  return (
    <Show when={props.wallet.icon && !useFallbackIcon()} fallback={<FallbackIcon />}>
      <img
        src={props.wallet.icon}
        alt=""
        loading="lazy"
        referrerpolicy="no-referrer"
        onError={() => setUseFallbackIcon(true)}
      />
    </Show>
  );
}

function isUsernameRequiredError(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    error.message === "username is required for new wallet users"
  );
}

function validateWalletUsername(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue.length === 0) {
    return "Enter a username to continue.";
  }

  if (normalizedValue.length < 3 || normalizedValue.length > 24) {
    return "Username must be between 3 and 24 characters.";
  }

  if (!/^[a-z0-9_]+$/.test(normalizedValue)) {
    return "Username can only use letters, numbers, and underscores.";
  }

  return null;
}

function getAdminWalletErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403 && error.message === "admin access required") {
      return "This wallet is not on the admin allowlist.";
    }

    return error.message;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const errorCode = (error as { code?: unknown }).code;

    if (errorCode === 4001) {
      return "Signature request rejected in your wallet.";
    }

    if (errorCode === -32002) {
      return "Open your wallet to continue the pending request.";
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to complete admin wallet sign-in.";
}

function getPhaseLabel(phase: AuthPhase) {
  switch (phase) {
    case "discovering":
    case "requesting_account":
    case "challenge":
      return "Wallet";
    case "signing":
      return "Signature";
    case "verifying":
      return "Verifying";
    case "username":
      return "Username";
    case "success":
      return "Connected";
    default:
      return null;
  }
}

export default function AdminAuthDialog(props: AdminAuthDialogProps) {
  const [wallets, setWallets] = createSignal<DiscoveredWallet[]>([]);
  const [isDiscoveringWallets, setDiscoveringWallets] = createSignal(false);
  const [activeWalletId, setActiveWalletId] = createSignal<string | null>(null);
  const [walletUsername, setWalletUsername] = createSignal("");
  const [pendingWalletConnect, setPendingWalletConnect] =
    createSignal<PendingWalletConnect | null>(null);
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [phase, setPhase] = createSignal<AuthPhase>("idle");
  let discoveryId = 0;
  let closeTimer: number | undefined;

  createEffect(() => {
    if (!props.open || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !props.pending) {
        props.onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    onCleanup(() => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    });
  });

  createEffect(() => {
    if (!props.open) {
      discoveryId += 1;
      setWallets([]);
      setDiscoveringWallets(false);
      setActiveWalletId(null);
      setWalletUsername("");
      setPendingWalletConnect(null);
      setStatusMessage(null);
      setErrorMessage(null);
      setPhase("idle");

      if (closeTimer !== undefined) {
        window.clearTimeout(closeTimer);
        closeTimer = undefined;
      }

      return;
    }

    const currentDiscoveryId = ++discoveryId;

    setDiscoveringWallets(true);
    setErrorMessage(null);
    setStatusMessage("Choose a wallet to continue.");
    setPhase("discovering");

    void discoverInjectedWallets()
      .then((discoveredWallets: DiscoveredWallet[]) => {
        if (currentDiscoveryId !== discoveryId) {
          return;
        }

        setWallets(discoveredWallets);
        setStatusMessage(
          discoveredWallets.length > 0
            ? "Choose a wallet to continue."
            : "No injected wallet found in this browser.",
        );
      })
      .catch((error: unknown) => {
        if (currentDiscoveryId !== discoveryId) {
          return;
        }

        setErrorMessage(getAdminWalletErrorMessage(error));
        setStatusMessage(null);
        setPhase("idle");
      })
      .finally(() => {
        if (currentDiscoveryId !== discoveryId) {
          return;
        }

        setDiscoveringWallets(false);
      });
  });

  async function attemptConnection(pendingConnect: PendingWalletConnect, username?: string) {
    const normalizedUsername = username?.trim().toLowerCase() || undefined;

    await props.completeConnection({
      challenge_id: pendingConnect.challengeId,
      signature: pendingConnect.signature,
      ...(normalizedUsername ? { username: normalizedUsername } : {}),
    });

    setPendingWalletConnect(null);
    setWalletUsername("");
    setPhase("success");
    setStatusMessage(`Connected ${shortenWalletAddress(pendingConnect.account)}.`);

    closeTimer = window.setTimeout(() => {
      props.onClose();
    }, 650);
  }

  async function handleWalletClick(wallet: DiscoveredWallet) {
    setActiveWalletId(wallet.id);
    setPendingWalletConnect(null);
    setWalletUsername("");
    setErrorMessage(null);

    try {
      setPhase("requesting_account");
      setStatusMessage(`Open ${wallet.name} to continue.`);
      const account = await requestWalletAccount(wallet.provider);

      setPhase("challenge");
      setStatusMessage("Requesting challenge...");
      const challenge = await props.requestChallenge(account);

      setPhase("signing");
      setStatusMessage(`Sign the message in ${wallet.name}.`);
      const signature = await signWalletMessage(wallet.provider, account, challenge.message);
      const pendingConnect = {
        account,
        challengeId: challenge.challenge_id,
        signature,
      };

      setPhase("verifying");
      setStatusMessage("Verifying access...");

      try {
        await attemptConnection(pendingConnect);
      } catch (error) {
        if (isUsernameRequiredError(error)) {
          setPendingWalletConnect(pendingConnect);
          setPhase("username");
          setStatusMessage("Choose a username to finish setup.");
          setErrorMessage(null);
          return;
        }

        throw error;
      }
    } catch (error) {
      setPhase("idle");
      setStatusMessage(null);
      setErrorMessage(getAdminWalletErrorMessage(error));
    } finally {
      setActiveWalletId(null);
    }
  }

  async function handleWalletUsernameSubmit(event: SubmitEvent) {
    event.preventDefault();

    const pendingConnect = pendingWalletConnect();

    if (!pendingConnect) {
      return;
    }

    const normalizedUsername = walletUsername().trim().toLowerCase();
    const validationError = validateWalletUsername(normalizedUsername);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setActiveWalletId(pendingConnect.challengeId);
    setPhase("verifying");
    setStatusMessage("Finishing setup...");

    try {
      await attemptConnection(pendingConnect, normalizedUsername);
    } catch (error) {
      setPhase("username");
      setStatusMessage("Choose a username to finish setup.");
      setErrorMessage(getAdminWalletErrorMessage(error));
    } finally {
      setActiveWalletId(null);
    }
  }

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="pm-connect-modal__overlay"
          onClick={() => {
            if (!props.pending) {
              props.onClose();
            }
          }}
        >
          <section
            class="pm-connect-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-auth-dialog-title"
            onClick={event => event.stopPropagation()}
          >
            <div class="pm-connect-modal__header">
              <div>
                <Show when={getPhaseLabel(phase())}>
                  {label => <p class="pm-connect-modal__eyebrow">{label()}</p>}
                </Show>
                <h2 class="pm-connect-modal__title" id="admin-auth-dialog-title">
                  {pendingWalletConnect() ? "Choose username" : "Connect wallet"}
                </h2>
                <p class="pm-connect-modal__subtitle">
                  {pendingWalletConnect()
                    ? "This wallet needs a username for its first admin session."
                    : "Select an installed wallet."}
                </p>
              </div>

              <button
                class="pm-connect-modal__close"
                type="button"
                aria-label="Close connect wallet dialog"
                disabled={props.pending}
                onClick={props.onClose}
              >
                Close
              </button>
            </div>

            <div class="pm-connect-modal__body">
              <Show
                when={pendingWalletConnect()}
                fallback={
                  <Show
                    when={!isDiscoveringWallets() || wallets().length > 0}
                    fallback={
                      <div class="pm-connect-wallet-grid" aria-hidden="true">
                        <For each={walletSkeletonTiles}>
                          {() => <div class="pm-connect-wallet-skeleton" />}
                        </For>
                      </div>
                    }
                  >
                    <Show
                      when={wallets().length > 0}
                      fallback={
                        <div class="pm-connect-wallet-empty">
                          <p>No wallet found.</p>
                          <p>Install MetaMask, Coinbase Wallet, Brave, Phantom, or Rabby.</p>
                        </div>
                      }
                    >
                      <div class="pm-connect-wallet-grid">
                        <For each={wallets()}>
                          {wallet => (
                            <button
                              class={`pm-connect-wallet-tile${
                                activeWalletId() === wallet.id
                                  ? " pm-connect-wallet-tile--active"
                                  : ""
                              }`}
                              type="button"
                              aria-label={`Connect ${wallet.name}`}
                              disabled={props.pending || activeWalletId() !== null}
                              onClick={() => void handleWalletClick(wallet)}
                            >
                              <span class="pm-connect-wallet-tile__icon">
                                <WalletTileIcon wallet={wallet} />
                              </span>
                              <span class="pm-connect-wallet-tile__name">{wallet.name}</span>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </Show>
                }
              >
                {pendingConnect => (
                  <form class="pm-connect-username" onSubmit={handleWalletUsernameSubmit}>
                    <div class="pm-connect-username__header">
                      <h3 class="pm-connect-username__title">Finish setup</h3>
                      <p class="pm-connect-username__hint">
                        This wallet is approved. Add a username to continue.
                      </p>
                    </div>

                    <div class="pm-connect-username__selected">
                      <span class="pm-connect-username__selected-label">Wallet</span>
                      <span class="pm-connect-username__selected-value">
                        {shortenWalletAddress(pendingConnect().account)}
                      </span>
                    </div>

                    <label class="pm-connect-username__field">
                      <span class="pm-connect-username__label">Username</span>
                      <input
                        class="pm-connect-username__input"
                        type="text"
                        name="username"
                        autocomplete="username"
                        inputMode="text"
                        spellcheck={false}
                        placeholder="guardrail_operator"
                        value={walletUsername()}
                        onInput={event => setWalletUsername(event.currentTarget.value)}
                      />
                    </label>

                    <div class="pm-connect-username__actions">
                      <button class="pm-button pm-button--primary" type="submit" disabled={props.pending}>
                        {activeWalletId() === pendingConnect().challengeId
                          ? "Continuing..."
                          : "Continue"}
                      </button>
                      <button
                        class="pm-button pm-button--ghost"
                        type="button"
                        disabled={props.pending}
                        onClick={() => {
                          setPendingWalletConnect(null);
                          setWalletUsername("");
                          setPhase("idle");
                          setStatusMessage("Choose a wallet to continue.");
                          setErrorMessage(null);
                        }}
                      >
                        Choose another wallet
                      </button>
                    </div>
                  </form>
                )}
              </Show>

              <Show when={statusMessage() || errorMessage()}>
                <p
                  class={`pm-connect-feedback${
                    errorMessage() ? " pm-connect-feedback--error" : ""
                  }`}
                  role={errorMessage() ? "alert" : "status"}
                >
                  {errorMessage() || statusMessage()}
                </p>
              </Show>
            </div>
          </section>
        </div>
      </Portal>
    </Show>
  );
}
