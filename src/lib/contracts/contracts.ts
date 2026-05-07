import {
  encodePathSegment,
  normalizeApiBaseUrl,
  readApiBaseUrlFromEnv,
  requestJson,
  withBearerToken,
} from "../api.ts";
import type {
  AdminAccessControlOverviewResponse,
  AdminAccessControlRoleMembershipResponse,
  AdminAccessControlRoleWriteRequest,
  AdminAccessControlRoleWriteResponse,
  AdminMultiSigOverviewResponse,
  AdminMultiSigProposalRequest,
  AdminMultiSigProposalResponse,
  AdminMultiSigProposalSignatureResponse,
  AdminMultiSigProposalWriteResponse,
  AdminMultiSigQuorumWriteRequest,
  AdminMultiSigSignerWriteRequest,
  ContractsClientOptions,
} from "./types.ts";

export interface ContractsClient {
  fetchAccessControlOverview(token: string): Promise<AdminAccessControlOverviewResponse>;
  fetchAccessControlRoleMembership(
    token: string,
    role: string,
    account: string,
  ): Promise<AdminAccessControlRoleMembershipResponse>;
  grantAccessControlRole(
    token: string,
    request: AdminAccessControlRoleWriteRequest,
  ): Promise<AdminAccessControlRoleWriteResponse>;
  revokeAccessControlRole(
    token: string,
    request: AdminAccessControlRoleWriteRequest,
  ): Promise<AdminAccessControlRoleWriteResponse>;
  fetchMultisigOverview(token: string): Promise<AdminMultiSigOverviewResponse>;
  fetchMultisigProposal(token: string, proposalId: string): Promise<AdminMultiSigProposalResponse>;
  fetchMultisigProposalSignature(
    token: string,
    proposalId: string,
    signer: string,
  ): Promise<AdminMultiSigProposalSignatureResponse>;
  proposeMultisigTransaction(
    token: string,
    request: AdminMultiSigProposalRequest,
  ): Promise<AdminMultiSigProposalWriteResponse>;
  proposeAddMultisigSigner(
    token: string,
    request: AdminMultiSigSignerWriteRequest,
  ): Promise<AdminMultiSigProposalWriteResponse>;
  proposeRemoveMultisigSigner(
    token: string,
    request: AdminMultiSigSignerWriteRequest,
  ): Promise<AdminMultiSigProposalWriteResponse>;
  proposeUpdateMultisigQuorum(
    token: string,
    request: AdminMultiSigQuorumWriteRequest,
  ): Promise<AdminMultiSigProposalWriteResponse>;
  signMultisigProposal(
    token: string,
    proposalId: string,
  ): Promise<AdminMultiSigProposalWriteResponse>;
  executeMultisigProposal(
    token: string,
    proposalId: string,
  ): Promise<AdminMultiSigProposalWriteResponse>;
  cancelMultisigProposal(
    token: string,
    proposalId: string,
  ): Promise<AdminMultiSigProposalWriteResponse>;
}

export function createContractsClient(options: ContractsClientOptions = {}): ContractsClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    fetchAccessControlOverview(token) {
      return requestJson<AdminAccessControlOverviewResponse>(
        baseUrl,
        "/admin/contracts/access-control",
        {
          headers: withBearerToken(token),
        },
      );
    },

    fetchAccessControlRoleMembership(token, role, account) {
      return requestJson<AdminAccessControlRoleMembershipResponse>(
        baseUrl,
        `/admin/contracts/access-control/roles/${encodePathSegment(role)}/accounts/${encodePathSegment(account)}`,
        {
          headers: withBearerToken(token),
        },
      );
    },

    grantAccessControlRole(token, request) {
      return requestJson<AdminAccessControlRoleWriteResponse>(
        baseUrl,
        "/admin/contracts/access-control/grant",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    revokeAccessControlRole(token, request) {
      return requestJson<AdminAccessControlRoleWriteResponse>(
        baseUrl,
        "/admin/contracts/access-control/revoke",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    fetchMultisigOverview(token) {
      return requestJson<AdminMultiSigOverviewResponse>(baseUrl, "/admin/contracts/multisig", {
        headers: withBearerToken(token),
      });
    },

    fetchMultisigProposal(token, proposalId) {
      return requestJson<AdminMultiSigProposalResponse>(
        baseUrl,
        `/admin/contracts/multisig/proposals/${encodePathSegment(proposalId)}`,
        {
          headers: withBearerToken(token),
        },
      );
    },

    fetchMultisigProposalSignature(token, proposalId, signer) {
      return requestJson<AdminMultiSigProposalSignatureResponse>(
        baseUrl,
        `/admin/contracts/multisig/proposals/${encodePathSegment(proposalId)}/signers/${encodePathSegment(signer)}`,
        {
          headers: withBearerToken(token),
        },
      );
    },

    proposeMultisigTransaction(token, request) {
      return requestJson<AdminMultiSigProposalWriteResponse>(
        baseUrl,
        "/admin/contracts/multisig/proposals",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    proposeAddMultisigSigner(token, request) {
      return requestJson<AdminMultiSigProposalWriteResponse>(
        baseUrl,
        "/admin/contracts/multisig/signers/add",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    proposeRemoveMultisigSigner(token, request) {
      return requestJson<AdminMultiSigProposalWriteResponse>(
        baseUrl,
        "/admin/contracts/multisig/signers/remove",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    proposeUpdateMultisigQuorum(token, request) {
      return requestJson<AdminMultiSigProposalWriteResponse>(
        baseUrl,
        "/admin/contracts/multisig/quorum",
        {
          method: "POST",
          headers: withBearerToken(token),
          json: request,
        },
      );
    },

    signMultisigProposal(token, proposalId) {
      return requestJson<AdminMultiSigProposalWriteResponse>(
        baseUrl,
        `/admin/contracts/multisig/proposals/${encodePathSegment(proposalId)}/sign`,
        {
          method: "POST",
          headers: withBearerToken(token),
        },
      );
    },

    executeMultisigProposal(token, proposalId) {
      return requestJson<AdminMultiSigProposalWriteResponse>(
        baseUrl,
        `/admin/contracts/multisig/proposals/${encodePathSegment(proposalId)}/execute`,
        {
          method: "POST",
          headers: withBearerToken(token),
        },
      );
    },

    cancelMultisigProposal(token, proposalId) {
      return requestJson<AdminMultiSigProposalWriteResponse>(
        baseUrl,
        `/admin/contracts/multisig/proposals/${encodePathSegment(proposalId)}/cancel`,
        {
          method: "POST",
          headers: withBearerToken(token),
        },
      );
    },
  };
}

export const contractsClient = createContractsClient({
  baseUrl: readApiBaseUrlFromEnv(),
});

export { ApiError } from "../api.ts";
