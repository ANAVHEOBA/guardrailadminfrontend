import { createSignal, onMount, type Accessor } from "solid-js";

import { adminClient, type AdminMeResponse, type AdminWalletChallengeResponse, type AdminWalletConnectRequest, type AdminAuthResponse, clearAdminToken, readAdminToken, writeStoredAdminSession } from "~/lib/admin";
import { getErrorMessage, isApiError } from "~/lib/api";
import {
  getInjectedEthereumProvider,
  requestEthereumAccounts,
  signPersonalMessage,
  type EthereumProvider,
} from "~/lib/wallet/ethereum";

interface UseAdminWalletAuthOptions {
  restoreOnMount?: boolean;
}

interface ConnectWithSignatureOptions {
  walletAddress: string;
  signMessage: (message: string) => Promise<string>;
  username?: string;
}

interface ConnectWithInjectedWalletOptions {
  walletAddress?: string;
  provider?: EthereumProvider | null;
  username?: string;
}

interface UseAdminWalletAuthResult {
  challenge: Accessor<AdminWalletChallengeResponse | null>;
  clearError: () => void;
  completeConnection: (payload: AdminWalletConnectRequest) => Promise<AdminAuthResponse>;
  connectWithInjectedWallet: (
    options?: ConnectWithInjectedWalletOptions,
  ) => Promise<AdminAuthResponse>;
  connectWithSignature: (options: ConnectWithSignatureOptions) => Promise<AdminAuthResponse>;
  error: Accessor<string | null>;
  isAuthenticated: () => boolean;
  logout: () => void;
  pending: Accessor<boolean>;
  profile: Accessor<AdminMeResponse | null>;
  refreshProfile: (token?: string | null) => Promise<AdminMeResponse | null>;
  requestChallenge: (walletAddress: string) => Promise<AdminWalletChallengeResponse>;
  restoreSession: () => Promise<AdminMeResponse | null>;
  session: Accessor<AdminAuthResponse | null>;
}

export function useAdminWalletAuth(
  options: UseAdminWalletAuthOptions = {},
): UseAdminWalletAuthResult {
  const [session, setSession] = createSignal<AdminAuthResponse | null>(null);
  const [profile, setProfile] = createSignal<AdminMeResponse | null>(null);
  const [challenge, setChallenge] = createSignal<AdminWalletChallengeResponse | null>(null);
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function requestChallenge(walletAddress: string) {
    setPending(true);
    setError(null);

    try {
      const nextChallenge = await adminClient.createWalletChallenge({
        wallet_address: walletAddress,
      });

      setChallenge(nextChallenge);

      return nextChallenge;
    } catch (authError) {
      setError(getErrorMessage(authError));
      throw authError;
    } finally {
      setPending(false);
    }
  }

  async function completeConnection(payload: AdminWalletConnectRequest) {
    setPending(true);
    setError(null);

    try {
      const nextSession = await adminClient.connectWallet(payload);
      writeStoredAdminSession(nextSession);
      setSession(nextSession);

      try {
        await refreshProfile(nextSession.token);
      } catch (profileError) {
        clearAdminToken();
        setSession(null);
        setProfile(null);
        throw profileError;
      }

      return nextSession;
    } catch (authError) {
      setError(getErrorMessage(authError));
      throw authError;
    } finally {
      setPending(false);
    }
  }

  async function connectWithSignature({
    walletAddress,
    signMessage,
    username,
  }: ConnectWithSignatureOptions) {
    const nextChallenge = await requestChallenge(walletAddress);
    const signature = await signMessage(nextChallenge.message);

    return completeConnection({
      challenge_id: nextChallenge.challenge_id,
      signature,
      username,
    });
  }

  async function connectWithInjectedWallet({
    walletAddress,
    provider = getInjectedEthereumProvider(),
    username,
  }: ConnectWithInjectedWalletOptions = {}) {
    const selectedWalletAddress =
      walletAddress ?? (await requestEthereumAccounts(provider))[0];

    if (!selectedWalletAddress) {
      throw new Error("No wallet account available.");
    }

    return connectWithSignature({
      walletAddress: selectedWalletAddress,
      username,
      signMessage: message => signPersonalMessage(message, selectedWalletAddress, provider),
    });
  }

  async function refreshProfile(token = readAdminToken()) {
    if (!token) {
      setProfile(null);
      return null;
    }

    try {
      const nextProfile = await adminClient.fetchMe(token);
      setProfile(nextProfile);
      setSession(currentSession =>
        currentSession ?? {
          token,
          user: nextProfile.user,
        },
      );

      return nextProfile;
    } catch (profileError) {
      if (isApiError(profileError) && (profileError.status === 401 || profileError.status === 403)) {
        logout();
      }

      throw profileError;
    }
  }

  async function restoreSession() {
    const token = readAdminToken();

    if (!token) {
      setSession(null);
      setProfile(null);
      return null;
    }

    setPending(true);
    setError(null);

    try {
      return await refreshProfile(token);
    } catch (restoreError) {
      setError(getErrorMessage(restoreError));
      throw restoreError;
    } finally {
      setPending(false);
    }
  }

  function clearError() {
    setError(null);
  }

  function logout() {
    clearAdminToken();
    setChallenge(null);
    setSession(null);
    setProfile(null);
    setError(null);
  }

  onMount(() => {
    if (options.restoreOnMount === false) {
      return;
    }

    void restoreSession().catch(() => undefined);
  });

  return {
    challenge,
    clearError,
    completeConnection,
    connectWithInjectedWallet,
    connectWithSignature,
    error,
    isAuthenticated: () => Boolean(readAdminToken()),
    logout,
    pending,
    profile,
    refreshProfile,
    requestChallenge,
    restoreSession,
    session,
  };
}
