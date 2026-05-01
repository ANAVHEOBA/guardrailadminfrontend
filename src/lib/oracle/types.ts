import type { IsoDateTimeString } from "../types.ts";

export interface OracleClientOptions {
  baseUrl?: string;
}

export interface AdminSetTrustedOracleRequest {
  trusted: boolean;
}

export interface AdminSubmitValuationRequest {
  asset_address: string;
  asset_value: string;
  nav_per_token: string;
  reference_id: string;
}

export interface AdminSubmitValuationAndSyncPricingRequest {
  asset_address: string;
  asset_value: string;
  nav_per_token: string;
  subscription_price: string;
  redemption_price: string;
  reference_id: string;
}

export interface AdminAnchorDocumentRequest {
  document_hash: string;
  reference_id: string;
}

export interface OracleTrustedOracleResponse {
  oracle_address: string;
  is_trusted: boolean;
  last_tx_hash: string | null;
  updated_at: IsoDateTimeString;
}

export interface OracleValuationResponse {
  asset_address: string;
  asset_value: string;
  nav_per_token: string;
  onchain_updated_at: number;
  reference_id: string;
  reference_id_text: string | null;
  last_tx_hash: string | null;
  updated_at: IsoDateTimeString;
}

export interface OracleDocumentResponse {
  asset_address: string;
  document_type: string;
  document_type_text: string | null;
  document_hash: string;
  reference_id: string;
  reference_id_text: string | null;
  last_tx_hash: string | null;
  updated_at: IsoDateTimeString;
}

export interface OracleTrustedOracleWriteResponse {
  tx_hash: string;
  trusted_oracle: OracleTrustedOracleResponse;
}

export interface OracleValuationWriteResponse {
  tx_hash: string;
  valuation: OracleValuationResponse;
}

export interface OracleDocumentWriteResponse {
  tx_hash: string;
  document: OracleDocumentResponse;
}
