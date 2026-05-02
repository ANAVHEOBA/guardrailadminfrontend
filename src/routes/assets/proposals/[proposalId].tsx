import { useParams } from "@solidjs/router";

import AssetDetailScreen from "~/components/asset-detail/AssetDetailScreen";

export default function AssetProposalDetailRoute() {
  const params = useParams<{ proposalId: string }>();

  return <AssetDetailScreen mode="proposal" identifier={() => params.proposalId} />;
}
