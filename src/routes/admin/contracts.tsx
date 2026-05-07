import { Title } from "@solidjs/meta";

import AdminConsole from "~/components/AdminConsole";
import AdminContractsManager from "~/components/AdminContractsManager";

export default function AdminContractsPage() {
  return (
    <div class="pm-page">
      <Title>Contract Governance - Guardrail Admin</Title>
      <AdminConsole />

      <main class="pm-admin-home__main">
        <AdminContractsManager />
      </main>
    </div>
  );
}
