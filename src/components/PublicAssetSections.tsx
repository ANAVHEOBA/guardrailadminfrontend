import { For, Show } from "solid-js";
import type { AssetResponse } from "~/lib";

interface PublicAssetSectionsProps {
  assets: AssetResponse[];
  title?: string;
  onRetry?: () => void;
  loading?: boolean;
  error?: string | null;
}

function AssetCard(props: { asset: AssetResponse }) {
  const asset = () => props.asset;
  const fallbackLetter = () => asset().symbol.charAt(0).toUpperCase() || "A";

  return (
    <div class="pm-compact-card-shell">
      <article class="pm-compact-card">
        <div class="pm-compact-card__header">
          <div class="pm-compact-card__art">
            <Show
              when={asset().image_url}
              fallback={<span class="pm-compact-card__art-fallback">{fallbackLetter()}</span>}
            >
              <img
                src={asset().image_url ?? ""}
                alt={`${asset().name} card icon`}
                loading="lazy"
                decoding="async"
                fetchpriority="auto"
              />
            </Show>
          </div>
          <div class="pm-compact-card__title-wrap">
            <div class="pm-compact-card__title-box">
              <h2 class="pm-compact-card__title">{asset().name}</h2>
            </div>
          </div>
        </div>

        <div class="pm-compact-card__body">
          <div class="pm-compact-card__rows">
            <div class="pm-compact-card__row">
              <div class="pm-compact-card__row-copy">
                <p class="pm-compact-card__row-label">{asset().symbol}</p>
              </div>
              <div class="pm-compact-card__row-actions">
                <p class="pm-compact-card__metric">{asset().asset_state_label}</p>
              </div>
            </div>

            <div class="pm-compact-card__row">
              <div class="pm-compact-card__row-copy">
                <p class="pm-compact-card__row-label">Subscription</p>
              </div>
              <div class="pm-compact-card__row-actions">
                <p class="pm-compact-card__metric">${asset().price_per_token}</p>
              </div>
            </div>

            <div class="pm-compact-card__row">
              <div class="pm-compact-card__row-copy">
                <p class="pm-compact-card__row-label">Redemption</p>
              </div>
              <div class="pm-compact-card__row-actions">
                <p class="pm-compact-card__metric">${asset().redemption_price_per_token}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="pm-compact-card__footer">
          <div class="pm-compact-card__footer-badges">
            <Show when={asset().featured}>
              <span class="pm-compact-card__badge">Featured</span>
            </Show>
            <Show when={asset().self_service_purchase_enabled}>
              <span class="pm-compact-card__badge">Self-Service</span>
            </Show>
            <Show when={!asset().visible}>
              <span class="pm-compact-card__badge">Hidden</span>
            </Show>
          </div>
          <p class="pm-compact-card__footer-text">{asset().holder_count} holders</p>
        </div>
      </article>
    </div>
  );
}

function CompactCardSkeleton() {
  return (
    <div class="pm-compact-card-shell">
      <article class="pm-compact-card pm-compact-card--skeleton" aria-hidden="true">
        <div class="pm-compact-card__header">
          <div class="pm-compact-card__art pm-compact-card__placeholder" />
          <div class="pm-compact-card__title-wrap">
            <div class="pm-compact-card__title-box">
              <div class="pm-compact-card__line pm-compact-card__line--title" />
            </div>
          </div>
        </div>

        <div class="pm-compact-card__body">
          <div class="pm-compact-card__rows">
            <For each={Array.from({ length: 3 })}>
              {() => (
                <div class="pm-compact-card__row">
                  <div class="pm-compact-card__row-copy">
                    <div class="pm-compact-card__line pm-compact-card__line--row" />
                  </div>
                  <div class="pm-compact-card__row-actions">
                    <div class="pm-compact-card__line pm-compact-card__line--metric" />
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class="pm-compact-card__footer">
          <div class="pm-compact-card__line pm-compact-card__line--footer" />
        </div>
      </article>
    </div>
  );
}

export default function PublicAssetSections(props: PublicAssetSectionsProps) {
  return (
    <section class="pm-all-markets">
      <section class="pm-all-markets__section">
        <div class="pm-all-markets__head">
          <h1 class="pm-all-markets__title">{props.title ?? "All assets"}</h1>
        </div>

        <Show
          when={!props.loading}
          fallback={
            <div class="pm-all-markets__grid">
              <For each={Array.from({ length: 12 })}>{() => <CompactCardSkeleton />}</For>
            </div>
          }
        >
          <Show
            when={!props.error}
            fallback={
              <div class="pm-home__state">
                <p class="pm-home__state-title">Unable to load assets</p>
                <p class="pm-home__state-copy">{props.error}</p>
                <Show when={props.onRetry}>
                  <button class="pm-button pm-button--primary" onClick={() => props.onRetry?.()}>
                    Retry
                  </button>
                </Show>
              </div>
            }
          >
            <Show
              when={props.assets.length > 0}
              fallback={
                <div class="pm-home__state">
                  <p class="pm-home__state-title">No assets found</p>
                  <p class="pm-home__state-copy">Assets will appear here once created.</p>
                </div>
              }
            >
              <div class="pm-all-markets__grid">
                <For each={props.assets}>
                  {asset => <AssetCard asset={asset} />}
                </For>
              </div>
            </Show>
          </Show>
        </Show>
      </section>
    </section>
  );
}
