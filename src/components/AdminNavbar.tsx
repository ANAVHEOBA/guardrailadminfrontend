import { A, useLocation } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";

import type { AdminMeResponse } from "~/lib/admin";
import { faucetClient } from "~/lib/faucet";
import { readAdminToken } from "~/lib/admin/session";
import { shortenWalletAddress } from "~/lib/wallet/ethereum";
import AdminModal from "./AdminModal";

const featuredLinks = [
  { label: "Assets", href: "/" },
  { label: "About", href: "/about" },
] as const;

function SearchIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M15.75 15.75L11.6386 11.6386"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
      <path
        d="M7.75 13.25C10.7875 13.25 13.25 10.7875 13.25 7.75C13.25 4.7125 10.7875 2.25 7.75 2.25C4.7125 2.25 2.25 4.7125 2.25 7.75C2.25 10.7875 4.7125 13.25 7.75 13.25Z"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M9 1C4.5889 1 1 4.5889 1 9C1 13.4111 4.5889 17 9 17C13.4111 17 17 13.4111 17 9C17 4.5889 13.4111 1 9 1ZM9.75 12.75C9.75 13.1641 9.4141 13.5 9 13.5C8.5859 13.5 8.25 13.1641 8.25 12.75V9.5H7.75C7.3359 9.5 7 9.1641 7 8.75C7 8.3359 7.3359 8 7.75 8H8.5C9.1895 8 9.75 8.5605 9.75 9.25V12.75ZM9 6.75C8.448 6.75 8 6.301 8 5.75C8 5.199 8.448 4.75 9 4.75C9.552 4.75 10 5.199 10 5.75C10 6.301 9.552 6.75 9 6.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <polyline
        fill="none"
        points="1.75 4.25 6 8.5 10.25 4.25"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M15.75,9.75H2.25c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75H15.75c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
        fill="currentColor"
      />
      <path
        d="M15.75,4.5H2.25c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75H15.75c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
        fill="currentColor"
      />
      <path
        d="M15.75,15H2.25c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75H15.75c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getWalletSummary(profile: AdminMeResponse) {
  const walletAddress = profile.user.wallet?.wallet_address;

  if (walletAddress) {
    return shortenWalletAddress(walletAddress);
  }

  return "Admin connected";
}

function isCurrentRoute(currentPath: string, href: string) {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath.startsWith(href);
}

function formatUsdcBaseUnits(rawAmount: string): string {
  const normalized = rawAmount.replace(/^0+/, "") || "0";
  const decimals = 6;

  if (normalized.length <= decimals) {
    const fractional = normalized.padStart(decimals, "0").replace(/0+$/, "");
    return fractional.length > 0 ? `0.${fractional}` : "0";
  }

  const splitIndex = normalized.length - decimals;
  const whole = normalized.slice(0, splitIndex);
  const fractional = normalized.slice(splitIndex).replace(/0+$/, "");
  return fractional.length > 0 ? `${whole}.${fractional}` : whole;
}

function normalizeUsdcAmountInput(value: string): string {
  const normalized = value.trim();

  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error("Enter a valid USDC amount with up to 6 decimals.");
  }

  const [wholeRaw, fractionalRaw = ""] = normalized.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const fractional = fractionalRaw.replace(/0+$/, "");

  if (whole === "0" && fractional.length === 0) {
    throw new Error("Amount must be greater than zero.");
  }

  return fractional.length > 0 ? `${whole}.${fractional}` : whole;
}

interface AdminNavbarProps {
  profile: AdminMeResponse | null;
  adminDrawerOpen?: boolean;
  onToggleAdminDrawer?: () => void;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export default function AdminNavbar(props: AdminNavbarProps) {
  const location = useLocation();
  const [isAccountMenuOpen, setAccountMenuOpen] = createSignal(false);
  const [usdcBalanceLabel, setUsdcBalanceLabel] = createSignal<string | null>(null);
  const [isFaucetModalOpen, setFaucetModalOpen] = createSignal(false);
  const [faucetAmountInput, setFaucetAmountInput] = createSignal("");
  const [faucetPending, setFaucetPending] = createSignal(false);
  const [faucetError, setFaucetError] = createSignal<string | null>(null);
  const [faucetStatus, setFaucetStatus] = createSignal<string | null>(null);
  let accountMenuRef: HTMLDivElement | undefined;
  let usdcBalanceRequestId = 0;

  const refreshUsdcBalance = async () => {
    const walletAddress = props.profile?.user.wallet?.wallet_address?.trim();
    const requestId = ++usdcBalanceRequestId;

    if (!walletAddress) {
      setUsdcBalanceLabel(null);
      return;
    }

    setUsdcBalanceLabel("Loading...");

    try {
      const response = await faucetClient.fetchUsdcBalance(walletAddress);

      if (requestId !== usdcBalanceRequestId) {
        return;
      }

      setUsdcBalanceLabel(`${formatUsdcBaseUnits(response.balance)} USDC`);
    } catch {
      if (requestId !== usdcBalanceRequestId) {
        return;
      }

      setUsdcBalanceLabel("USDC unavailable");
    }
  };

  createEffect(() => {
    if (!isAccountMenuOpen()) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (accountMenuRef?.contains(target)) {
        return;
      }

      setAccountMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  createEffect(() => {
    location.pathname;
    setAccountMenuOpen(false);
  });

  createEffect(() => {
    props.profile?.user.wallet?.wallet_address;
    void refreshUsdcBalance();
  });

  const toggleAdminDrawer = () => {
    setAccountMenuOpen(false);
    props.onToggleAdminDrawer?.();
  };

  const signOut = () => {
    setAccountMenuOpen(false);
    props.onLogout?.();
  };

  const openFaucetModal = () => {
    setAccountMenuOpen(false);
    setFaucetError(null);
    setFaucetStatus(null);
    setFaucetAmountInput("");
    setFaucetModalOpen(true);
  };

  const closeFaucetModal = () => {
    if (faucetPending()) {
      return;
    }
    setFaucetModalOpen(false);
  };

  const submitFaucetRequest = async (event: SubmitEvent) => {
    event.preventDefault();
    setFaucetError(null);
    setFaucetStatus(null);

    const token = readAdminToken();
    if (!token) {
      setFaucetError("Reconnect admin wallet to request USDC.");
      return;
    }

    let amount: string;

    try {
      amount = normalizeUsdcAmountInput(faucetAmountInput());
    } catch (error) {
      setFaucetError(error instanceof Error ? error.message : "Invalid amount.");
      return;
    }

    setFaucetPending(true);
    try {
      const response = await faucetClient.requestUsdc(token, amount);
      setFaucetStatus(
        `Requested ${formatUsdcBaseUnits(response.amount)} USDC. Tx: ${response.tx_hash.slice(0, 10)}...`,
      );
      setFaucetAmountInput("");
      await refreshUsdcBalance();
    } catch (error) {
      setFaucetError(error instanceof Error ? error.message : "Unable to request USDC.");
    } finally {
      setFaucetPending(false);
    }
  };

  return (
    <header class="pm-navbar pm-admin-navbar">
      <nav class="pm-navbar__nav" aria-label="Primary">
        <div class="pm-navbar__border" aria-hidden="true" />

        <div class="pm-navbar__top-row">
          <div class="pm-navbar__brand-wrap">
            <A class="pm-brand" aria-label="Guardrail Admin home" href="/">
              <span class="pm-brand__badge">
                <img src="/favicon.ico" alt="" aria-hidden="true" />
              </span>
              <span class="pm-brand__name">Guardrail Admin</span>
            </A>
          </div>

          <div class="pm-navbar__search-group">
            <form class="pm-search-form" role="search" onSubmit={event => event.preventDefault()}>
              <div class="pm-search-field">
                <span class="pm-search-field__icon">
                  <SearchIcon />
                </span>
                <input
                  class="pm-search-field__input"
                  type="search"
                  aria-label="Search assets"
                  autoComplete="off"
                  placeholder="Search assets..."
                />
                <kbd class="pm-search-field__kbd">/</kbd>
              </div>
            </form>

            <A class="pm-link-action pm-link-action--admin" href="/about">
              <InfoIcon />
              <span>How it works</span>
            </A>
          </div>

          <div class="pm-navbar__account">
            <div class="pm-navbar__auth">
              <Show
                when={props.profile}
                fallback={
                  <>
                    <button class="pm-button pm-button--ghost" type="button" onClick={props.onOpenAuth}>
                      Admin access
                    </button>
                    <button
                      class="pm-button pm-button--primary"
                      type="button"
                      onClick={props.onOpenAuth}
                    >
                      Connect wallet
                    </button>
                  </>
                }
              >
                {currentProfile => (
                  <>
                    <button
                      class={`pm-menu-trigger pm-menu-trigger--admin${
                        props.adminDrawerOpen ? " pm-menu-trigger--open" : ""
                      }`}
                      type="button"
                      aria-label="Toggle admin drawer"
                      aria-expanded={props.adminDrawerOpen ? "true" : "false"}
                      onClick={toggleAdminDrawer}
                    >
                      <MenuIcon />
                    </button>

                    <div class="pm-account-session" ref={accountMenuRef}>
                      <button
                        class={`pm-account-trigger pm-account-trigger--admin${
                          isAccountMenuOpen() ? " pm-account-trigger--open" : ""
                        }`}
                        type="button"
                        aria-label="Open admin account menu"
                        aria-expanded={isAccountMenuOpen()}
                        aria-haspopup="menu"
                        onClick={() => setAccountMenuOpen(open => !open)}
                      >
                        <div class="pm-account-avatar pm-account-avatar--fallback">
                          <span class="pm-account-avatar__initials">A</span>
                        </div>
                        <span class="pm-admin-navbar__session-copy">
                          <span class="pm-admin-navbar__session-value">
                            {getWalletSummary(currentProfile())}
                          </span>
                          <Show when={usdcBalanceLabel()}>
                            {balance => (
                              <span class="pm-admin-navbar__session-subvalue">{balance()}</span>
                            )}
                          </Show>
                        </span>
                        <span class="pm-account-trigger__chevron" aria-hidden="true">
                          <ChevronDownIcon />
                        </span>
                      </button>

                      <Show when={isAccountMenuOpen()}>
                        <div class="pm-account-menu pm-account-menu--admin" role="menu" aria-label="Admin account menu">
                          <div class="pm-account-menu__header">
                            <div class="pm-account-avatar pm-account-avatar--fallback">
                              <span class="pm-account-avatar__initials">A</span>
                            </div>
                            <div class="pm-account-menu__identity">
                              <p class="pm-account-menu__name">Admin</p>
                              <p class="pm-account-menu__meta">{currentProfile().user.wallet?.wallet_address}</p>
                            </div>
                          </div>

                          <div class="pm-admin-navbar__menu-pills">
                            <span class="pm-market-chip">Monad #{currentProfile().monad_chain_id}</span>
                            <span class="pm-market-chip">Admin session</span>
                          </div>

                          <div class="pm-account-menu__divider" aria-hidden="true" />

                          <button
                            class="pm-account-menu__item"
                            type="button"
                            role="menuitem"
                            onClick={openFaucetModal}
                          >
                            Request USDC
                          </button>

                          <button
                            class="pm-account-menu__item pm-account-menu__item--danger"
                            type="button"
                            role="menuitem"
                            onClick={signOut}
                          >
                            Disconnect
                          </button>
                        </div>
                      </Show>
                    </div>
                  </>
                )}
              </Show>
            </div>
          </div>
        </div>

        <div class="pm-navbar__bottom-row">
          <div class="pm-tabs-shell">
            <div class="pm-tabs-fade pm-tabs-fade--left" aria-hidden="true" />

            <div class="pm-tabs-scroll" role="navigation" aria-label="Admin routes">
              <For each={featuredLinks}>
                {link => (
                  <A
                    class={`pm-tab${isCurrentRoute(location.pathname, link.href) ? " pm-tab--active" : ""}`}
                    href={link.href}
                    aria-current={isCurrentRoute(location.pathname, link.href) ? "page" : undefined}
                  >
                    <span>{link.label}</span>
                  </A>
                )}
              </For>
            </div>

            <div class="pm-tabs-fade pm-tabs-fade--right" aria-hidden="true" />
          </div>
        </div>
      </nav>

      <AdminModal
        open={isFaucetModalOpen()}
        onClose={closeFaucetModal}
        title="Request USDC"
        eyebrow="Faucet"
        subtitle="Request faucet USDC to the admin wallet."
      >
        <form class="pm-admin-faucet-form" onSubmit={submitFaucetRequest}>
          <label class="pm-admin-faucet-form__field">
            <span>Amount</span>
            <input
              class="pm-field__input"
              type="text"
              inputMode="decimal"
              placeholder="100.00"
              value={faucetAmountInput()}
              onInput={event => setFaucetAmountInput(event.currentTarget.value)}
            />
          </label>

          <Show when={faucetError()}>
            {message => <p class="pm-admin-inline-error">{message()}</p>}
          </Show>
          <Show when={faucetStatus()}>
            {message => <p class="pm-admin-faucet-form__status">{message()}</p>}
          </Show>

          <div class="pm-admin-faucet-form__actions">
            <button
              class="pm-button pm-button--ghost"
              type="button"
              onClick={closeFaucetModal}
              disabled={faucetPending()}
            >
              Cancel
            </button>
            <button class="pm-button pm-button--primary" type="submit" disabled={faucetPending()}>
              {faucetPending() ? "Requesting..." : "Request USDC"}
            </button>
          </div>
        </form>
      </AdminModal>
    </header>
  );
}
