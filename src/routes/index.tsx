import { Title } from "@solidjs/meta";
import { createSignal, onMount } from "solid-js";

import AdminConsole from "~/components/AdminConsole";
import PublicAssetSections from "~/components/PublicAssetSections";
import { assetClient, type AssetResponse } from "~/lib";
import { getErrorMessage } from "~/lib/api";

type HomeLoadStatus = "loading" | "ready" | "error";
const ASSET_FEED_STORAGE_KEY = "guardrail-asset-feed/v1";

interface AssetFeedState {
  assets: AssetResponse[];
  timestamp: number;
}

let cachedFeed: AssetFeedState | null = null;
let inflightFeedRequest: Promise<AssetFeedState> | null = null;

function isAssetFeedState(value: unknown): value is AssetFeedState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AssetFeedState>;

  return (
    Array.isArray(candidate.assets) &&
    typeof candidate.timestamp === "number"
  );
}

function readFeedFromStorage(): AssetFeedState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(ASSET_FEED_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (isAssetFeedState(parsed)) {
      // Cache for 30 seconds
      const isStale = Date.now() - parsed.timestamp > 30000;
      if (isStale) {
        window.sessionStorage.removeItem(ASSET_FEED_STORAGE_KEY);
        return null;
      }
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
  inflightFeedRequest = null;

  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(ASSET_FEED_STORAGE_KEY);
  }
}

async function fetchAssets(): Promise<AssetFeedState> {
  const response = await assetClient.listAssets({
    limit: 50,
  });

  return {
    assets: response.assets,
    timestamp: Date.now(),
  };
}

async function loadInitialFeed(): Promise<AssetFeedState> {
  if (cachedFeed) {
    return cachedFeed;
  }

  if (inflightFeedRequest) {
    return inflightFeedRequest;
  }

  inflightFeedRequest = fetchAssets()
    .then(feed => {
      cachedFeed = feed;
      writeFeedToStorage(feed);
      return feed;
    })
    .finally(() => {
      inflightFeedRequest = null;
    });

  return inflightFeedRequest;
}

export default function Home() {
  const [status, setStatus] = createSignal<HomeLoadStatus>("loading");
  const [error, setError] = createSignal<string | null>(null);
  const [assets, setAssets] = createSignal<AssetResponse[]>([]);

  const applyFeed = (feed: AssetFeedState) => {
    cachedFeed = feed;
    writeFeedToStorage(feed);
    setAssets(feed.assets);
  };

  const loadAssets = async (background = false) => {
    if (!background) {
      setStatus("loading");
    }

    setError(null);

    try {
      const feed = await loadInitialFeed();
      applyFeed(feed);
      setStatus("ready");
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
    const warmFeed = cachedFeed ?? readFeedFromStorage();

    if (warmFeed) {
      applyFeed(warmFeed);
      setStatus("ready");
      setError(null);
      cachedFeed = null;
      inflightFeedRequest = null;
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
