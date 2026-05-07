import { Title } from "@solidjs/meta";

import AdminConsole from "~/components/AdminConsole";
import AdminSystemManager from "~/components/AdminSystemManager";

export default function AdminSystemPage() {
  return (
    <div class="pm-page">
      <Title>System Operations - Guardrail Admin</Title>
      <AdminConsole />

      <main class="pm-admin-home__main">
        <AdminSystemManager />
      </main>
    </div>
  );
}
