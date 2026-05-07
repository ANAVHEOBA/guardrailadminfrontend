import type { AssetResponse } from "../asset/types.ts";
import type { IsoDateTimeString } from "../types.ts";

export interface AssetRequestClientOptions {
  baseUrl?: string;
}

export type AssetRequestStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "deployed";

export interface AdminListAssetRequestsQuery {
  status?: AssetRequestStatus | null;
  limit?: number | null;
  offset?: number | null;
}

export interface AdminUpdateAssetRequestStatusRequest {
  status: AssetRequestStatus;
  review_notes?: string | null;
}

export interface AssetRequestResponse {
  id: string;
  proposal_id: string;
  submitted_by_user_id: string;
  issuer_name: string;
  contact_name: string;
  contact_email: string;
  issuer_website: string | null;
  issuer_country: string | null;
  asset_name: string;
  asset_type_id: string;
  asset_type_id_text: string | null;
  description: string;
  target_raise: string | null;
  currency: string | null;
  maturity_date: string | null;
  expected_yield_bps: number | null;
  redemption_summary: string | null;
  valuation_source: string | null;
  document_urls: string[];
  token_symbol: string;
  max_supply: string;
  subscription_price: string;
  redemption_price: string;
  self_service_purchase_enabled: boolean;
  metadata_hash: string | null;
  metadata_hash_text: string | null;
  slug: string | null;
  image_url: string | null;
  market_segment: string | null;
  suggested_internal_tags: string[];
  source_urls: string[];
  status: AssetRequestStatus;
  review_notes: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: IsoDateTimeString | null;
  deployed_by_user_id: string | null;
  deployed_at: IsoDateTimeString | null;
  deployed_asset_address: string | null;
  deployment_tx_hash: string | null;
  created_at: IsoDateTimeString;
  updated_at: IsoDateTimeString;
}

export interface AssetRequestListResponse {
  asset_requests: AssetRequestResponse[];
  limit: number;
  offset: number;
}

export interface AssetRequestDeployResponse {
  tx_hash: string | null;
  request: AssetRequestResponse;
  asset: AssetResponse;
}
