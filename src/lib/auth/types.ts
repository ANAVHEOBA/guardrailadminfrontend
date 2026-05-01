import type { IsoDateTimeString, Uuid } from "../types.ts";

export interface AuthClientOptions {
  baseUrl?: string;
}

export interface GoogleSignInRequest {
  credential: string;
  g_csrf_token?: string | null;
  client_id?: string | null;
}

export interface WalletChallengeRequest {
  wallet_address: string;
}

export interface WalletChallengeResponse {
  challenge_id: Uuid;
  message: string;
  expires_at: IsoDateTimeString;
}

export interface WalletConnectRequest {
  challenge_id: Uuid;
  signature: string;
  username?: string;
}

export interface WalletResponse {
  wallet_address: string;
  chain_id: number;
  account_kind: string;
  owner_address: string | null;
  owner_provider: string | null;
  factory_address: string | null;
  entry_point_address: string | null;
  created_at: IsoDateTimeString;
}

export interface UserResponse {
  id: Uuid;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  wallet: WalletResponse | null;
  created_at: IsoDateTimeString;
  updated_at: IsoDateTimeString;
}

export interface AuthResponse {
  token: string;
  user: UserResponse;
}

export interface MeResponse {
  user: UserResponse;
}
