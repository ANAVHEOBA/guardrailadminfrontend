import { Title } from "@solidjs/meta";

import AdminComplianceManager from "~/components/AdminComplianceManager";
import AdminConsole from "~/components/AdminConsole";

export default function AdminCompliancePage() {
  return (
    <div class="pm-page">
      <Title>Compliance Operations - Guardrail Admin</Title>
      <AdminConsole />

      <main class="pm-admin-home__main">
        <AdminComplianceManager />
      </main>
    </div>
  );
}
