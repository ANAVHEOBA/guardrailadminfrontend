import { Show, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";

import { useAdminAuth } from "~/lib/admin-auth-context";

import AdminNavbar from "./AdminNavbar";
import AdminWorkspace from "./AdminWorkspace";

export default function AdminConsole() {
  const auth = useAdminAuth();
  const navigate = useNavigate();
  const [adminDrawerOpen, setAdminDrawerOpen] = createSignal(false);

  const openAssetManager = () => {
    navigate("/admin/assets");
  };

  const openRedemptionManager = () => {
    navigate("/admin/redemptions");
  };

  const openContractsManager = () => {
    navigate("/admin/contracts");
  };

  const openComplianceManager = () => {
    navigate("/admin/compliance");
  };

  const openSystemManager = () => {
    navigate("/admin/system");
  };

  return (
    <>
      <AdminNavbar
        profile={auth.profile()}
        adminDrawerOpen={adminDrawerOpen()}
        onToggleAdminDrawer={() => setAdminDrawerOpen(open => !open)}
        onOpenAuth={() => {
          auth.openAuthDialog();
        }}
        onLogout={auth.logout}
      />

      <Show when={auth.profile()}>
        {profile => (
          <AdminWorkspace
            profile={profile()}
            open={adminDrawerOpen()}
            onClose={() => setAdminDrawerOpen(false)}
            onOpenAssetManager={openAssetManager}
            onOpenRedemptionManager={openRedemptionManager}
            onOpenComplianceManager={openComplianceManager}
            onOpenContractsManager={openContractsManager}
            onOpenSystemManager={openSystemManager}
          />
        )}
      </Show>
    </>
  );
}
