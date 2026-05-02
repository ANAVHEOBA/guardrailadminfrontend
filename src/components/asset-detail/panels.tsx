import { For, Show } from "solid-js";

import type { StatRow } from "./types";

export function SummaryCard(props: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <article class="pm-asset-market__summary-card">
      <p class="pm-asset-market__summary-label">{props.label}</p>
      <h3 class="pm-asset-market__summary-value">{props.value}</h3>
      <p class="pm-asset-market__summary-meta">{props.meta}</p>
    </article>
  );
}

export function StatPanel(props: {
  title: string;
  subtitle?: string;
  rows: StatRow[];
}) {
  return (
    <section class="pm-detail__card pm-asset-market__stat-panel">
      <h2 class="pm-detail__card-title">{props.title}</h2>
      <Show when={props.subtitle}>
        <p class="pm-detail__card-copy pm-asset-market__panel-copy">{props.subtitle}</p>
      </Show>
      <div class="pm-asset-market__stat-rows">
        <For each={props.rows}>
          {row => (
            <div class="pm-asset-market__stat-row">
              <span class="pm-asset-market__stat-label">{row.label}</span>
              <span
                class={`pm-asset-market__stat-value${
                  row.mono ? " pm-asset-market__stat-value--mono" : ""
                }`}
              >
                {row.value}
              </span>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}

export function LoadingState() {
  return (
    <section class="pm-asset-market">
      <section class="pm-asset-market__hero-card">
        <div class="pm-asset-market__hero-top">
          <div class="pm-asset-market__identity">
            <div class="pm-asset-market__avatar pm-compact-card__placeholder" />
            <div class="pm-asset-market__identity-copy">
              <div class="pm-compact-card__line pm-asset-detail__line--medium" />
              <div class="pm-compact-card__line pm-asset-detail__line--small" />
            </div>
          </div>
        </div>

        <div class="pm-asset-market__hero-grid">
          <div class="pm-asset-market__price-surface">
            <div class="pm-asset-market__price-header">
              <div class="pm-asset-market__price-head">
                <div class="pm-compact-card__line pm-compact-card__line--title" />
                <div class="pm-compact-card__line pm-asset-detail__line--medium" />
              </div>
              <div class="pm-asset-market__price-actions">
                <div class="pm-asset-market__toggle">
                  <div class="pm-compact-card__line pm-asset-detail__line--small" />
                </div>
              </div>
            </div>
            <div class="pm-asset-market__chart-frame pm-compact-card__placeholder" />
          </div>

          <aside class="pm-asset-market__about-panel">
            <div class="pm-compact-card__line pm-asset-detail__line--small" />
            <div class="pm-compact-card__line pm-asset-detail__line--long" />
            <div class="pm-compact-card__line pm-asset-detail__line--medium" />
            <div class="pm-compact-card__line pm-asset-detail__line--long" />
          </aside>
        </div>
      </section>

      <div class="pm-asset-market__summary-grid">
        <For each={Array.from({ length: 4 })}>
          {() => (
            <article class="pm-asset-market__summary-card">
              <div class="pm-compact-card__line pm-asset-detail__line--small" />
              <div class="pm-compact-card__line pm-asset-detail__line--medium" />
              <div class="pm-compact-card__line pm-asset-detail__line--long" />
            </article>
          )}
        </For>
      </div>
    </section>
  );
}
