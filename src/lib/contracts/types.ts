export interface ContractsClientOptions {
  baseUrl?: string;
}

export interface AdminAccessControlRoleWriteRequest {
  role: string;
  account_address: string;
}

export interface AdminAccessControlRoleSummaryResponse {
  role: string;
  role_hex: string;
  admin_role: string;
  admin_role_hex: string;
}

export interface AdminAccessControlOverviewResponse {
  access_control_address: string;
  roles: AdminAccessControlRoleSummaryResponse[];
}

export interface AdminAccessControlRoleMembershipResponse {
  access_control_address: string;
  account_address: string;
  role: string;
  role_hex: string;
  has_role: boolean;
  admin_role: string;
  admin_role_hex: string;
}

export interface AdminAccessControlRoleWriteResponse {
  tx_hash: string;
  action: string;
  membership: AdminAccessControlRoleMembershipResponse;
}

export interface AdminMultiSigProposalRequest {
  target: string;
  data: string;
  value?: string | null;
}

export interface AdminMultiSigSignerWriteRequest {
  signer_address: string;
}

export interface AdminMultiSigQuorumWriteRequest {
  quorum: string;
}

export interface AdminMultiSigOverviewResponse {
  multisig_address: string;
  signers: string[];
  quorum: string;
  proposal_count: string;
  timelock_duration: string;
  proposal_expiry: string;
  min_timelock: string;
}

export interface AdminMultiSigProposalResponse {
  multisig_address: string;
  proposal_id: string;
  proposal_hash: string;
  target: string;
  data: string;
  value: string;
  signatures_count: string;
  created_at: number;
  expires_at: number;
  timelock_until: number;
  executed: boolean;
  cancelled: boolean;
  proposer: string;
  ready_to_execute: boolean;
}

export interface AdminMultiSigProposalSignatureResponse {
  multisig_address: string;
  proposal_id: string;
  signer_address: string;
  has_signed: boolean;
}

export interface AdminMultiSigProposalWriteResponse {
  tx_hash: string;
  proposal: AdminMultiSigProposalResponse;
}
