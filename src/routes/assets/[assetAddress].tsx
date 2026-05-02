import { useParams, type RouteDefinition } from "@solidjs/router";

import AssetDetailScreen from "~/components/asset-detail/AssetDetailScreen";
import { primeAssetDetailBundle } from "~/components/asset-detail/data";

export const route = {
  preload: ({ params }) => primeAssetDetailBundle("public", params.assetAddress, "1D"),
} satisfies RouteDefinition;

export default function AssetAddressDetailRoute() {
  const params = useParams<{ assetAddress: string }>();

  return <AssetDetailScreen mode="public" identifier={() => params.assetAddress} />;
}
