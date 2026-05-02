import { For, Show } from "solid-js";

import type { AssetResponse } from "~/lib";

import { readSourceLabel } from "./format";

interface AssetDetailSourcesSectionProps {
  asset: AssetResponse;
}

export default function AssetDetailSourcesSection(props: AssetDetailSourcesSectionProps) {
  return (
    <section class="pm-asset-market__section">
      <div class="pm-asset-market__section-head">
        <div>
          <p class="pm-asset-market__section-kicker">Documents</p>
          <h2 class="pm-asset-market__section-title">Sources</h2>
        </div>
      </div>

      <div class="pm-asset-market__documents">
        <Show
          when={props.asset.sources.length > 0}
          fallback={
            <p class="pm-detail__card-copy">No source links have been attached to this asset yet.</p>
          }
        >
          <For each={props.asset.sources}>
            {(source, index) => (
              <a
                class="pm-asset-market__document-link"
                href={source}
                target="_blank"
                rel="noreferrer"
              >
                <div class="pm-asset-market__document-copy">
                  <p class="pm-asset-market__document-title">Source {index() + 1}</p>
                  <p class="pm-asset-market__document-meta">{readSourceLabel(source)}</p>
                </div>
                <span class="pm-asset-market__document-action">Open</span>
              </a>
            )}
          </For>
        </Show>

        <Show when={props.asset.image_url}>
          <a
            class="pm-asset-market__document-link"
            href={props.asset.image_url ?? "#"}
            target="_blank"
            rel="noreferrer"
          >
            <div class="pm-asset-market__document-copy">
              <p class="pm-asset-market__document-title">Asset image</p>
              <p class="pm-asset-market__document-meta">Catalog media reference</p>
            </div>
            <span class="pm-asset-market__document-action">Open</span>
          </a>
        </Show>
      </div>
    </section>
  );
}
