import { useNavigate, useParams, type RouteDefinition } from "@solidjs/router";
import { createEffect } from "solid-js";

import AssetDetailScreen from "~/components/asset-detail/AssetDetailScreen";
import { primeAssetDetailBundle } from "~/components/asset-detail/data";
import { buildAssetSlugPageHref } from "~/lib";

export const route = {
  preload: ({ params }) => primeAssetDetailBundle("public", params.slug, "1D"),
} satisfies RouteDefinition;

export default function AssetSlugDetailRoute() {
  const params = useParams<{ slug: string }>();
  const navigate = useNavigate();

  createEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const slug = params.slug?.trim();

    if (!slug) {
      return;
    }

    void navigate(buildAssetSlugPageHref(slug), {
      replace: true,
    });
  });

  return <AssetDetailScreen mode="public" identifier={() => params.slug} />;
}
