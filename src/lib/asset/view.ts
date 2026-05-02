import { encodePathSegment } from "../api.ts";
import type { AssetResponse } from "./types.ts";

export function buildAssetAddressPageHref(assetAddress: string): string {
  return `/assets/${encodePathSegment(assetAddress)}`;
}

export function buildAssetSlugPageHref(slug: string): string {
  return `/assets/slug/${encodePathSegment(slug)}`;
}

export function buildAssetProposalPageHref(proposalId: string): string {
  return `/assets/proposals/${encodePathSegment(proposalId)}`;
}

export function buildPreferredAssetPageHref(
  asset: Pick<AssetResponse, "asset_address" | "slug">,
): string {
  if (asset.slug) {
    return buildAssetSlugPageHref(asset.slug);
  }

  return buildAssetAddressPageHref(asset.asset_address);
}
