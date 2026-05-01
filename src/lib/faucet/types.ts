import type { IsoDateTimeString } from "../types.ts";

export interface FaucetClientOptions {
  baseUrl?: string;
}

export interface FaucetUsdcResponse {
  token_address: string;
  recipient: string;
  wallet_account_kind: string;
  amount: string;
  balance: string;
  tx_hash: string;
  requested_at: IsoDateTimeString;
  next_available_at: IsoDateTimeString;
  cooldown_seconds: number;
}

export interface FaucetUsdcBalanceResponse {
  token_address: string;
  address: string;
  balance: string;
  queried_at: IsoDateTimeString;
}
