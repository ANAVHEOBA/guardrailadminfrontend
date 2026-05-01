import { normalizeApiBaseUrl, readApiBaseUrlFromEnv, requestJson, withBearerToken } from "../api.ts";
import type {
  FaucetClientOptions,
  FaucetUsdcBalanceResponse,
  FaucetUsdcResponse,
} from "./types.ts";

export interface FaucetClient {
  fetchUsdcBalance(address: string): Promise<FaucetUsdcBalanceResponse>;
  requestUsdc(token: string): Promise<FaucetUsdcResponse>;
}

export function createFaucetClient(options: FaucetClientOptions = {}): FaucetClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    fetchUsdcBalance(address) {
      return requestJson<FaucetUsdcBalanceResponse>(baseUrl, "/faucet/usdc/balance", {
        query: { address },
      });
    },

    requestUsdc(token) {
      return requestJson<FaucetUsdcResponse>(baseUrl, "/faucet/usdc", {
        method: "POST",
        headers: withBearerToken(token),
      });
    },
  };
}

export const faucetClient = createFaucetClient({
  baseUrl: readApiBaseUrlFromEnv(),
});

export { ApiError } from "../api.ts";
