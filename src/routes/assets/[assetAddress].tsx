import { useParams } from "@solidjs/router";

import AssetDetailScreen from "~/components/asset-detail/AssetDetailScreen";

export default function AssetAddressDetailRoute() {
  const params = useParams<{ assetAddress: string }>();

  return <AssetDetailScreen mode="asset_address" identifier={() => params.assetAddress} />;
}
