import {
  normalizeApiBaseUrl,
  readApiBaseUrlFromEnv,
  requestJson,
  withBearerToken,
} from "../api";

import type {
  AdminAuthResponse,
  AdminImageUploadResponse,
  AdminMeResponse,
  AdminWalletChallengeRequest,
  AdminWalletChallengeResponse,
  AdminWalletConnectRequest,
} from "./types";

export interface AdminClientOptions {
  baseUrl?: string;
}

export interface UploadAdminImageRequest {
  file: File | Blob;
  file_name?: string;
  scope?: string;
  folder?: string;
}

export interface AdminClient {
  createWalletChallenge(
    request: AdminWalletChallengeRequest,
  ): Promise<AdminWalletChallengeResponse>;
  connectWallet(request: AdminWalletConnectRequest): Promise<AdminAuthResponse>;
  fetchMe(token: string): Promise<AdminMeResponse>;
  uploadImage(token: string, request: UploadAdminImageRequest): Promise<AdminImageUploadResponse>;
}

function buildImageUploadFormData(request: UploadAdminImageRequest): FormData {
  const formData = new FormData();

  if (request.scope !== undefined) {
    formData.set("scope", request.scope);
  } else if (request.folder !== undefined) {
    formData.set("folder", request.folder);
  }

  if (request.file_name) {
    formData.set("file", request.file, request.file_name);
  } else {
    formData.set("file", request.file);
  }

  return formData;
}

export function createAdminClient(options: AdminClientOptions = {}): AdminClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    createWalletChallenge(request) {
      return requestJson<AdminWalletChallengeResponse>(baseUrl, "/admin/auth/wallet/challenge", {
        method: "POST",
        json: request,
      });
    },

    connectWallet(request) {
      return requestJson<AdminAuthResponse>(baseUrl, "/admin/auth/wallet/connect", {
        method: "POST",
        json: request,
      });
    },

    fetchMe(token) {
      return requestJson<AdminMeResponse>(baseUrl, "/admin/me", {
        headers: withBearerToken(token),
      });
    },

    uploadImage(token, request) {
      return requestJson<AdminImageUploadResponse>(baseUrl, "/admin/uploads/images", {
        method: "POST",
        headers: withBearerToken(token),
        body: buildImageUploadFormData(request),
      });
    },
  };
}

export const adminClient = createAdminClient({
  baseUrl: readApiBaseUrlFromEnv(),
});

export { ApiError } from "../api";
