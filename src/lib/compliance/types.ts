import type { IsoDateTimeString } from "../types.ts";

export interface ComplianceClientOptions {
  baseUrl?: string;
}

export interface AdminUpsertComplianceInvestorRequest {
  is_verified: boolean;
  is_accredited: boolean;
  is_frozen: boolean;
  valid_until?: number | null;
  jurisdiction: string;
  external_ref?: string | null;
}

export interface AdminBatchUpsertComplianceInvestorItem {
  wallet_address: string;
  is_verified: boolean;
  is_accredited: boolean;
  is_frozen: boolean;
  valid_until?: number | null;
  jurisdiction: string;
  external_ref?: string | null;
}

export interface AdminBatchUpsertComplianceInvestorsRequest {
  investors: AdminBatchUpsertComplianceInvestorItem[];
}

export interface AdminSetComplianceAssetRulesRequest {
  transfers_enabled: boolean;
  subscriptions_enabled: boolean;
  redemptions_enabled: boolean;
  requires_accreditation: boolean;
  min_investment: string;
  max_investor_balance: string;
}

export interface AdminSetComplianceJurisdictionRestrictionRequest {
  restricted: boolean;
}

export interface ComplianceCheckSubscribeRequest {
  asset_address: string;
  investor_wallet: string;
  amount: string;
  resulting_balance: string;
}

export interface ComplianceCheckTransferRequest {
  asset_address: string;
  from_wallet: string;
  to_wallet: string;
  amount: string;
  receiving_balance: string;
}

export interface ComplianceCheckRedeemRequest {
  asset_address: string;
  investor_wallet: string;
  amount: string;
}

export interface ComplianceInvestorResponse {
  wallet_address: string;
  is_verified: boolean;
  is_accredited: boolean;
  is_frozen: boolean;
  is_whitelisted: boolean;
  valid_until: number | null;
  jurisdiction: string;
  jurisdiction_text: string | null;
  external_ref: string;
  external_ref_text: string | null;
  last_tx_hash: string | null;
  updated_at: IsoDateTimeString;
}

export interface ComplianceAssetRulesResponse {
  asset_address: string;
  transfers_enabled: boolean;
  subscriptions_enabled: boolean;
  redemptions_enabled: boolean;
  requires_accreditation: boolean;
  min_investment: string;
  max_investor_balance: string;
  last_tx_hash: string | null;
  updated_at: IsoDateTimeString;
}

export interface ComplianceJurisdictionRestrictionResponse {
  asset_address: string;
  jurisdiction: string;
  jurisdiction_text: string | null;
  restricted: boolean;
  last_tx_hash: string | null;
  updated_at: IsoDateTimeString;
}

export interface AdminComplianceInvestorUpsertResponse {
  tx_hash: string;
  investor: ComplianceInvestorResponse;
}

export interface AdminComplianceInvestorBatchUpsertResponse {
  tx_hash: string;
  investors: ComplianceInvestorResponse[];
}

export interface AdminComplianceAssetRulesUpsertResponse {
  tx_hash: string;
  asset_rules: ComplianceAssetRulesResponse;
}

export interface AdminComplianceJurisdictionRestrictionUpsertResponse {
  tx_hash: string;
  restriction: ComplianceJurisdictionRestrictionResponse;
}

export interface ComplianceCheckResponse {
  is_valid: boolean;
  reason: string;
}
