import { Title } from "@solidjs/meta";
import type { RouteDefinition } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";

import AdminConsole from "~/components/AdminConsole";
import PublicAssetSections from "~/components/PublicAssetSections";
import { assetClient, type AssetResponse } from "~/lib";
import { getErrorMessage } from "~/lib/api";

type HomeLoadStatus = "loading" | "ready" | "error";
const ASSET_FEED_PAGE_SIZE = 12;
const ASSET_FEED_STORAGE_KEY = "guardrail-asset-feed/v2";
const LEGACY_ASSET_FEED_STORAGE_KEY = "guardrail-asset-feed/v1";

interface AssetFeedState {
  assets: AssetResponse[];
  nextOffset: number;
  hasMore: boolean;
}

let cachedFeed: AssetFeedState | null = null;
let inflightInitialFeedRequest: Promise<AssetFeedState> | null = null;
let inflightFeedDrain: Promise<AssetFeedState> | null = null;

function isAssetFeedState(value: unknown): value is AssetFeedState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AssetFeedState>;

  return (
    Array.isArray(candidate.assets) &&
    typeof candidate.nextOffset === "number" &&
    typeof candidate.hasMore === "boolean"
  );
}

function readFeedFromStorage(): AssetFeedState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(ASSET_FEED_STORAGE_KEY);

    if (!raw) {
      window.sessionStorage.removeItem(LEGACY_ASSET_FEED_STORAGE_KEY);
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (isAssetFeedState(parsed)) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

function writeFeedToStorage(feed: AssetFeedState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(ASSET_FEED_STORAGE_KEY, JSON.stringify(feed));
  } catch {
    // Ignore storage write failures and keep the in-memory cache.
  }
}

function resetFeedCache() {
  cachedFeed = null;
  inflightInitialFeedRequest = null;
  inflightFeedDrain = null;

  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(ASSET_FEED_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_ASSET_FEED_STORAGE_KEY);
  }
}

async function fetchAssetPage(offset: number): Promise<AssetFeedState> {
  const response = await assetClient.listAssets({
    limit: ASSET_FEED_PAGE_SIZE,
    offset,
  });

  return {
    assets: response.assets,
    nextOffset: offset + response.assets.length,
    hasMore: response.assets.length === ASSET_FEED_PAGE_SIZE,
  };
}

async function loadInitialFeed(): Promise<AssetFeedState> {
  if (inflightInitialFeedRequest) {
    return inflightInitialFeedRequest;
  }

  inflightInitialFeedRequest = fetchAssetPage(0)
    .finally(() => {
      inflightInitialFeedRequest = null;
    });

  return inflightInitialFeedRequest;
}

export const route = {
  preload: () => loadInitialFeed(),
} satisfies RouteDefinition;

function mergeFeedPage(currentFeed: AssetFeedState, nextPage: AssetFeedState): AssetFeedState {
  const seenAssetAddresses = new Set(currentFeed.assets.map(asset => asset.asset_address));
  const mergedAssets = [...currentFeed.assets];

  for (const asset of nextPage.assets) {
    if (seenAssetAddresses.has(asset.asset_address)) {
      continue;
    }

    seenAssetAddresses.add(asset.asset_address);
    mergedAssets.push(asset);
  }

  return {
    assets: mergedAssets,
    nextOffset: nextPage.nextOffset,
    hasMore: nextPage.hasMore,
  };
}

function mergeFreshWithCachedFeed(
  cachedSnapshot: AssetFeedState,
  freshFeed: AssetFeedState,
): AssetFeedState {
  if (cachedSnapshot.nextOffset <= freshFeed.nextOffset) {
    return freshFeed;
  }

  const freshAssetAddresses = new Set(freshFeed.assets.map(asset => asset.asset_address));

  return {
    assets: [
      ...freshFeed.assets,
      ...cachedSnapshot.assets.filter(asset => !freshAssetAddresses.has(asset.asset_address)),
    ],
    nextOffset: cachedSnapshot.nextOffset,
    hasMore: true,
  };
}

async function drainRemainingFeedPages(
  initialFeed: AssetFeedState,
  onUpdate?: (feed: AssetFeedState) => void,
): Promise<AssetFeedState> {
  if (inflightFeedDrain) {
    return inflightFeedDrain;
  }

  inflightFeedDrain = (async () => {
    let currentFeed = initialFeed;

    while (currentFeed.hasMore) {
      const nextPage = await fetchAssetPage(currentFeed.nextOffset);
      currentFeed = mergeFeedPage(currentFeed, nextPage);
      onUpdate?.(currentFeed);
    }

    return currentFeed;
  })().finally(() => {
    inflightFeedDrain = null;
  });

  return inflightFeedDrain;
}

export default function Home() {
  const [status, setStatus] = createSignal<HomeLoadStatus>("loading");
  const [error, setError] = createSignal<string | null>(null);
  const [assets, setAssets] = createSignal<AssetResponse[]>([]);
  const [nextOffset, setNextOffset] = createSignal(0);
  const [hasMore, setHasMore] = createSignal(true);

  const applyFeed = (feed: AssetFeedState) => {
    cachedFeed = feed;
    writeFeedToStorage(feed);
    setAssets(feed.assets);
    setNextOffset(feed.nextOffset);
    setHasMore(feed.hasMore);
  };

  const loadAssets = async (background = false) => {
    if (!background) {
      setStatus("loading");
    }

    setError(null);

    try {
      const currentFeed = {
        assets: assets(),
        nextOffset: nextOffset(),
        hasMore: hasMore(),
      };
      const initialFeed = await loadInitialFeed();
      const displayedFeed =
        background && currentFeed.assets.length > 0
          ? mergeFreshWithCachedFeed(currentFeed, initialFeed)
          : initialFeed;

      applyFeed(displayedFeed);
      setStatus("ready");

      void drainRemainingFeedPages(initialFeed, feed => {
        applyFeed(background ? mergeFreshWithCachedFeed(currentFeed, feed) : feed);
      }).then(feed => {
        applyFeed(feed);
      });
    } catch (caughtError) {
      if (background && assets().length > 0) {
        return;
      }

      const message = getErrorMessage(caughtError);
      setError(message);
      setStatus("error");
    }
  };

  onMount(() => {
    // Try to load from cache first for instant display
    const warmFeed = readFeedFromStorage() ?? cachedFeed;

    if (warmFeed) {
      applyFeed(warmFeed);
      setStatus("ready");
      setError(null);
      // Refresh in background
      void loadAssets(true);
      return;
    }

    void loadAssets();
  });

  return (
    <div class="pm-page">
      <Title>Guardrail Admin</Title>
      <AdminConsole />

      <main class="pm-admin-home__main">
        <section id="all-assets">
          <PublicAssetSections
            assets={assets()}
            loading={status() === "loading"}
            error={status() === "error" ? error() : null}
            onRetry={() => {
              resetFeedCache();
              void loadAssets();
            }}
          />
        </section>
      </main>
    </div>
  );
}
