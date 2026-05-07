import { Title } from "@solidjs/meta";

import AdminConsole from "~/components/AdminConsole";
import AdminRedemptionManager from "~/components/AdminRedemptionManager";

export default function AdminRedemptionsPage() {
  return (
    <div class="pm-page">
      <Title>Pending Redemptions - Guardrail Admin</Title>
      <AdminConsole />

      <main class="pm-admin-home__main">
        <AdminRedemptionManager />
      </main>
    </div>
  );
}
