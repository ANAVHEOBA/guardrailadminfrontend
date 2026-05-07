import type { ComplianceAssetRulesResponse } from "../compliance/types.ts";
import type { OracleValuationResponse } from "../oracle/types.ts";
import type { TreasuryAssetResponse } from "../treasury/types.ts";
import type { IsoDateTimeString } from "../types.ts";

export interface AssetClientOptions {
  baseUrl?: string;
}

export interface ListAssetsQuery {
  asset_type_id?: string | null;
  q?: string | null;
  asset_state?: string | null;
  self_service_purchase_enabled?: boolean | null;
  featured?: boolean | null;
  limit?: number | null;
  offset?: number | null;
}

export interface AssetDetailQuery {
  wallet_address?: string | null;
}

export interface AssetHistoryQuery {
  range?: string | null;
}

export interface AdminRegisterAssetTypeRequest {
  asset_type_id: string;
  asset_type_name: string;
  implementation_address: string;
}

export interface AdminCreateAssetRequest {
  proposal_id: string;
  asset_type_id: string;
  name: string;
  symbol: string;
  max_supply: string;
  subscription_price: string;
  redemption_price: string;
  self_service_purchase_enabled: boolean;
  metadata_hash?: string | null;
  slug?: string | null;
  image_url?: string | null;
  summary?: string | null;
  market_segment?: string | null;
  suggested_internal_tags?: string[];
  sources?: string[];
  featured?: boolean;
  visible?: boolean;
  searchable?: boolean;
}

export interface AdminIssueAssetRequest {
  recipient_wallet: string;
  amount: string;
  data?: string | null;
}

export interface AdminBurnAssetRequest {
  from_wallet: string;
  amount: string;
}

export interface AdminSetAssetStateRequest {
  state: string;
}

export interface AdminSetAssetPriceRequest {
  value: string;
}

export interface AdminSetAssetPricingRequest {
  subscription_price: string;
  redemption_price: string;
}

export interface AdminSetAssetSelfServicePurchaseRequest {
  enabled: boolean;
}

export interface AdminSetAssetMetadataRequest {
  metadata_hash: string;
}

export interface AdminSetAssetCatalogRequest {
  slug: string;
  image_url?: string | null;
  summary?: string | null;
  market_segment?: string | null;
  suggested_internal_tags?: string[];
  sources?: string[];
  featured?: boolean;
  visible?: boolean;
  searchable?: boolean;
}

export interface AdminSetAssetComplianceRegistryRequest {
  compliance_registry_address: string;
}

export interface AdminSetAssetTreasuryRequest {
  treasury_address: string;
}

export interface AdminSetFactoryComplianceRegistryRequest {
  compliance_registry_address: string;
}

export interface AdminSetFactoryTreasuryRequest {
  treasury_address: string;
}

export interface AdminControllerTransferRequest {
  from_wallet: string;
  to_wallet: string;
  amount: string;
  data?: string | null;
  operator_data?: string | null;
}

export interface AdminProcessRedemptionRequest {
  investor_wallet: string;
  amount: string;
  recipient_wallet: string;
  data?: string | null;
}

export interface PendingRedemptionUser {
  user_id: string;
  wallet_address: string;
  email: string | null;
  display_name: string | null;
  pending_amount: string;
  last_redemption_at: IsoDateTimeString | null;
}

export interface PendingRedemptionsResponse {
  asset_address: string;
  asset_name: string;
  asset_symbol: string;
  asset_image_url: string | null;
  total_pending_redemptions: string;
  pending_redemptions: PendingRedemptionUser[];
}

export interface AssetPreviewRequest {
  token_amount: string;
}

export interface AssetCheckTransferRequest {
  from_wallet: string;
  to_wallet: string;
  amount: string;
  data?: string | null;
}

export interface GaslessApprovePaymentTokenRequest {
  amount: string;
}

export interface GaslessPurchaseAssetRequest {
  token_amount: string;
}

export interface GaslessClaimYieldRequest {
  recipient_wallet?: string | null;
}

export interface GaslessRedeemAssetRequest {
  amount: string;
  data?: string | null;
}

export interface GaslessCancelRedemptionRequest {
  amount: string;
}

export interface AssetFactoryStatusResponse {
  factory_address: string;
  access_control_address: string;
  compliance_registry_address: string;
  compliance_diamond_address: string;
  treasury_address: string;
  paused: boolean;
  total_assets_created: string;
}

export interface AssetTypeResponse {
  asset_type_id: string;
  asset_type_id_text: string | null;
  asset_type_name: string;
  implementation_address: string;
  is_registered: boolean;
  last_tx_hash: string | null;
  updated_at: IsoDateTimeString;
}

export interface AssetResponse {
  asset_address: string;
  proposal_id: string;
  asset_type_id: string;
  asset_type_id_text: string | null;
  asset_type_name: string | null;
  slug: string | null;
  name: string;
  symbol: string;
  image_url: string | null;
  summary: string | null;
  market_segment: string | null;
  suggested_internal_tags: string[];
  sources: string[];
  featured: boolean;
  visible: boolean;
  searchable: boolean;
  max_supply: string;
  total_supply: string;
  asset_state: number;
  asset_state_label: string;
  controllable: boolean;
  self_service_purchase_enabled: boolean;
  price_per_token: string;
  redemption_price_per_token: string;
  treasury_address: string;
  compliance_registry_address: string;
  compliance_diamond_address: string;
  payment_token_address: string;
  metadata_hash: string;
  holder_count: string;
  total_pending_redemptions: string;
  last_tx_hash: string | null;
  updated_at: IsoDateTimeString;
}

export interface AssetHolderStateResponse {
  asset_address: string;
  wallet_address: string;
  balance: string;
  claimable_yield: string;
  accumulative_yield: string;
  pending_redemption: string;
  locked_balance: string;
  unlocked_balance: string;
  payment_token_balance: string;
  payment_token_allowance_to_treasury: string;
}

export interface AssetPreviewResponse {
  asset_address: string;
  token_amount: string;
  value: string;
}

export interface AssetTransferCheckResponse {
  status_code: string;
  reason_code: string;
  reason: string;
}

export interface AssetDetailResponse {
  asset: AssetResponse;
  treasury: TreasuryAssetResponse | null;
  compliance_rules: ComplianceAssetRulesResponse | null;
  valuation: OracleValuationResponse | null;
  holder: AssetHolderStateResponse | null;
  unavailable_sections: string[];
}

export interface AssetHistoryCandleResponse {
  timestamp: number;
  value: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface AssetHistoryResponse {
  asset_address: string;
  range: string;
  interval: string;
  last_updated_at: number | null;
  primary_market_price: AssetHistoryCandleResponse[];
  underlying_market_price: AssetHistoryCandleResponse[];
}

export interface AssetTypeListResponse {
  asset_types: AssetTypeResponse[];
}

export interface AssetListResponse {
  assets: AssetResponse[];
  limit: number;
  offset: number;
}

export interface AssetTypeWriteResponse {
  tx_hash: string;
  asset_type: AssetTypeResponse;
}

export interface AssetFactoryWriteResponse {
  tx_hash: string;
  factory: AssetFactoryStatusResponse;
}

export interface AssetWriteResponse {
  tx_hash: string;
  asset: AssetResponse;
}

export interface AssetArchiveWriteResponse {
  state_tx_hash: string | null;
  self_service_purchase_tx_hash: string | null;
  asset: AssetResponse;
}

export interface AssetCatalogWriteResponse {
  asset: AssetResponse;
}

export interface GaslessAssetActionResponse {
  tx_hash: string;
  asset: AssetResponse;
  holder: AssetHolderStateResponse;
}
