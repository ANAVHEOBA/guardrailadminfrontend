import { A } from "@solidjs/router";

export default function AssetDetailPageHeader() {
  return (
    <div class="pm-browser__hero pm-asset-detail-page__hero">
      <div class="pm-asset-detail-page__hero-copy">
        <A class="pm-asset-detail__back-link" href="/">
          All assets
        </A>
        <p class="pm-asset-detail__eyebrow">Public asset detail</p>
      </div>
      <div class="pm-browser__button-row">
        <A class="pm-button pm-button--ghost" href="/">
          Back to catalog
        </A>
      </div>
    </div>
  );
}
