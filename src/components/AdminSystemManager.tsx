import { createSignal } from "solid-js";

import AdminJsonResult from "./AdminJsonResult";
import { adminClient, readAdminToken } from "~/lib/admin";
import { healthClient } from "~/lib/health";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";

export default function AdminSystemManager() {
  const healthTask = useAsyncTask(() => healthClient.fetchHealth());
  const profileTask = useAsyncTask((token: string) => adminClient.fetchMe(token));
  const uploadTask = useAsyncTask((token: string, file: File, scope?: string) =>
    adminClient.uploadImage(token, { file, scope }),
  );
  const [uploadError, setUploadError] = createSignal<string | null>(null);

  const adminToken = () => readAdminToken();

  async function handleUploadSubmit(event: SubmitEvent) {
    event.preventDefault();

    const token = adminToken();

    if (!token) {
      setUploadError("Connect an admin wallet first.");
      return;
    }

    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const file = formData.get("file");
    const scope = String(formData.get("scope") ?? "").trim() || undefined;

    if (!(file instanceof File) || file.size === 0) {
      setUploadError("Choose an image file first.");
      return;
    }

    setUploadError(null);

    try {
      await uploadTask.run(token, file, scope);
      form.reset();
    } catch (error) {
      setUploadError(getErrorMessage(error));
    }
  }

  return (
    <div class="pm-tool-stack">
      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">System</p>
            <h2 class="pm-tool-section__title">Health and admin bootstrap</h2>
          </div>
          <p class="pm-admin-section-note">
            Start here to verify the backend is reachable and the admin token can hydrate the
            operator profile.
          </p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">GET /health</p>
                <h3 class="pm-market-card__title">Service health</h3>
              </div>
            </div>
            <p class="pm-market-card__copy">
              Quick smoke test for the Rust backend before running admin mutations.
            </p>
            <div class="pm-market-actions">
              <button
                class="pm-button pm-button--primary"
                type="button"
                disabled={healthTask.pending()}
                onClick={() => void healthTask.run()}
              >
                {healthTask.pending() ? "Checking..." : "Check health"}
              </button>
            </div>
            {healthTask.error() && (
              <p class="pm-market-feedback pm-market-feedback--error">
                {getErrorMessage(healthTask.error())}
              </p>
            )}
            {healthTask.data() && <AdminJsonResult value={healthTask.data()} />}
          </section>

          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">GET /admin/me</p>
                <h3 class="pm-market-card__title">Current admin profile</h3>
              </div>
            </div>
            <p class="pm-market-card__copy">
              Re-fetch the connected admin profile from the protected endpoint.
            </p>
            <div class="pm-market-actions">
              <button
                class="pm-button pm-button--primary"
                type="button"
                disabled={profileTask.pending() || !adminToken()}
                onClick={() => {
                  const token = adminToken();

                  if (token) {
                    void profileTask.run(token);
                  }
                }}
              >
                {profileTask.pending() ? "Loading..." : "Fetch profile"}
              </button>
            </div>
            {profileTask.error() && (
              <p class="pm-market-feedback pm-market-feedback--error">
                {getErrorMessage(profileTask.error())}
              </p>
            )}
            {profileTask.data() && <AdminJsonResult value={profileTask.data()} />}
          </section>
        </div>
      </div>

      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">Uploads</p>
            <h2 class="pm-tool-section__title">Image uploads</h2>
          </div>
          <p class="pm-admin-section-note">Use the upload endpoint to produce asset image URLs.</p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card pm-market-card--wide">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">POST /admin/uploads/images</p>
                <h3 class="pm-market-card__title">Upload admin image</h3>
              </div>
            </div>

            <form class="pm-market-form" onSubmit={handleUploadSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field">
                  <span class="pm-field__label">Scope</span>
                  <input class="pm-field__input" name="scope" type="text" placeholder="assets" />
                </label>

                <label class="pm-field">
                  <span class="pm-field__label">File</span>
                  <input class="pm-field__input" name="file" type="file" accept="image/*" />
                </label>
              </div>

              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={uploadTask.pending() || !adminToken()}
                >
                  {uploadTask.pending() ? "Uploading..." : "Upload image"}
                </button>
              </div>
            </form>

            {uploadError() && <p class="pm-market-feedback pm-market-feedback--error">{uploadError()}</p>}
            {uploadTask.data() && <AdminJsonResult value={uploadTask.data()} />}
          </section>
        </div>
      </div>
    </div>
  );
}
