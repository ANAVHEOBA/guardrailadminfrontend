import type { IsoDateTimeString } from "../types.ts";

export interface TreasuryClientOptions {
  baseUrl?: string;
}

export interface AdminApproveTreasuryPaymentTokenRequest {
  amount: string;
}

export interface AdminDepositAssetLiquidityRequest {
  asset_address: string;
  amount: string;
}

export interface AdminReleaseCapitalRequest {
  asset_address: string;
  amount: string;
  recipient_wallet: string;
  reference_id: string;
}

export interface AdminDepositYieldRequest {
  asset_address: string;
  amount: string;
  data?: string | null;
}

export interface AdminEmergencyWithdrawRequest {
  token_address: string;
  amount: string;
  recipient_wallet: string;
}

export interface TreasuryStatusResponse {
  treasury_address: string;
  payment_token_address: string;
  access_control_address: string;
  paused: boolean;
  total_tracked_balance: string;
  total_reserved_yield: string;
  last_tx_hash: string | null;
  updated_at: IsoDateTimeString;
}

export interface TreasuryAssetResponse {
  asset_address: string;
  balance: string;
  reserved_yield: string;
  available_liquidity: string;
  last_tx_hash: string | null;
  updated_at: IsoDateTimeString;
}

export interface TreasuryStatusWriteResponse {
  tx_hash: string;
  treasury: TreasuryStatusResponse;
}

export interface TreasuryAssetWriteResponse {
  tx_hash: string;
  treasury: TreasuryStatusResponse;
  asset: TreasuryAssetResponse;
}

export interface TreasuryPaymentTokenApprovalResponse {
  tx_hash: string;
  payment_token_address: string;
  treasury_address: string;
  approved_amount: string;
}
