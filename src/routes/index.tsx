import { Title } from "@solidjs/meta";
import { Show, createMemo, createSignal, onMount } from "solid-js";

import AdminConsole from "~/components/AdminConsole";
import PublicAssetSections from "~/components/PublicAssetSections";
import { assetClient, type AssetResponse } from "~/lib";
import { getErrorMessage } from "~/lib/api";

type HomeLoadStatus = "loading" | "ready" | "error";

export default function Home() {
  const [status, setStatus] = createSignal<HomeLoadStatus>("loading");
  const [error, setError] = createSignal<string | null>(null);
  const [assets, setAssets] = createSignal<AssetResponse[]>([]);

  const loadAssets = async () => {
    setStatus("loading");
    setError(null);

    try {
      const response = await assetClient.listAssets({
        limit: 50,
      });
      setAssets(response.assets);
      setStatus("ready");
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      setStatus("error");
    }
  };

  onMount(() => {
    void loadAssets();
  });

  return (
    <div class="pm-page">
      <Title>Guardrail Admin</Title>
      <AdminConsole />

      <main class="pm-admin-home__main">
        <section id="all-assets">
          <PublicAssetSections
            assets={assets()}
            loading={status() === "loading"}
            error={status() === "error" ? error() : null}
            onRetry={() => void loadAssets()}
          />
        </section>
      </main>
    </div>
  );
}
