import { Title } from "@solidjs/meta";

import AdminAssetRequestManager from "~/components/AdminAssetRequestManager";
import AdminConsole from "~/components/AdminConsole";

export default function AdminAssetRequestsPage() {
  return (
    <div class="pm-page">
      <Title>Asset Requests - Guardrail Admin</Title>
      <AdminConsole />

      <main class="pm-admin-home__main">
        <AdminAssetRequestManager />
      </main>
    </div>
  );
}
