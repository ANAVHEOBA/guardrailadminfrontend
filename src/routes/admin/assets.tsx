import { Title } from "@solidjs/meta";

import AdminConsole from "~/components/AdminConsole";
import AdminAssetManager from "~/components/AdminAssetManager";

export default function AdminAssetsPage() {
  return (
    <div class="pm-page">
      <Title>Asset Management - Guardrail Admin</Title>
      <AdminConsole />

      <main class="pm-admin-home__main">
        <AdminAssetManager />
      </main>
    </div>
  );
}
