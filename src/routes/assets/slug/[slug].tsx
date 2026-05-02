import { useParams } from "@solidjs/router";

import AssetDetailScreen from "~/components/asset-detail/AssetDetailScreen";

export default function AssetSlugDetailRoute() {
  const params = useParams<{ slug: string }>();

  return <AssetDetailScreen mode="slug" identifier={() => params.slug} />;
}
