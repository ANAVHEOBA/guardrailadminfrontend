import { Show, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";

import { useAdminWalletAuth } from "~/lib/hooks/useAdminWalletAuth";

import AdminNavbar from "./AdminNavbar";
import AdminWorkspace from "./AdminWorkspace";

export default function AdminConsole() {
  const auth = useAdminWalletAuth({ restoreOnMount: true });
  const navigate = useNavigate();
  const [adminDrawerOpen, setAdminDrawerOpen] = createSignal(false);

  const openAssetManager = () => {
    navigate("/admin/assets");
  };

  return (
    <>
      <AdminNavbar
        profile={auth.profile()}
        adminDrawerOpen={adminDrawerOpen()}
        onToggleAdminDrawer={() => setAdminDrawerOpen(open => !open)}
        onOpenAuth={() => {
          // Trigger wallet connection
          void auth.connectWithInjectedWallet();
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
          />
        )}
      </Show>
    </>
  );
}
