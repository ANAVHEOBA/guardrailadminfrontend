import { A } from "@solidjs/router";

interface AssetDetailErrorStateProps {
  error: string | null;
  onRetry: () => void;
}

export default function AssetDetailErrorState(props: AssetDetailErrorStateProps) {
  return (
    <div class="pm-home__state pm-asset-detail__state-card">
      <p class="pm-home__state-title">Unable to load asset detail</p>
      <p class="pm-home__state-copy">{props.error}</p>
      <div class="pm-browser__button-row">
        <button class="pm-button pm-button--primary" type="button" onClick={props.onRetry}>
          Retry
        </button>
        <A class="pm-button pm-button--ghost" href="/">
          Back to assets
        </A>
      </div>
    </div>
  );
}
