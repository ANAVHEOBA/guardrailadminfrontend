export type Uuid = string;
export type IsoDateString = string;

export interface WalletChallengeRequest {
  wallet_address: string;
}

export interface WalletChallengeResponse {
  challenge_id: Uuid;
  message: string;
  expires_at: IsoDateString;
}

export interface WalletConnectRequest {
  challenge_id: Uuid;
  signature: string;
  username?: string;
}

export interface WalletResponse {
  wallet_address: string;
  chain_id: number;
  created_at: IsoDateString;
}

export interface UserResponse {
  id: Uuid;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  wallet: WalletResponse | null;
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

export interface AuthResponse {
  token: string;
  user: UserResponse;
}

export interface AdminMeResponse {
  user: UserResponse;
  monad_chain_id: number;
}

export interface AdminImageAssetResponse {
  id: Uuid;
  storage_provider: string;
  bucket_name: string;
  scope: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  cid: string;
  ipfs_url: string;
  gateway_url: string;
  created_at: IsoDateString;
}

export interface AdminImageUploadResponse {
  asset: AdminImageAssetResponse;
}

export interface AdminWalletChallengeRequest {
  wallet_address: string;
}

export interface AdminWalletChallengeResponse {
  challenge_id: Uuid;
  message: string;
  expires_at: IsoDateString;
}

export interface AdminWalletConnectRequest {
  challenge_id: Uuid;
  signature: string;
  username?: string;
}

export interface AdminAuthResponse {
  token: string;
  user: UserResponse;
}
