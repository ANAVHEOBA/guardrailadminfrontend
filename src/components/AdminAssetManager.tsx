import { createSignal, For, Show } from "solid-js";

import {
  assetClient,
  readAdminToken,
  type AdminCreateAssetRequest,
  type AdminRegisterAssetTypeRequest,
  type AdminSetAssetPricingRequest,
  type AssetResponse,
  type ListAssetsQuery,
} from "~/lib";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";
import {
  readOptionalBoolean,
  readOptionalInteger,
  readOptionalText,
  readRequiredText,
} from "./admin-form-utils";

function formatTimestamp(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
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
                alt={`${asset().name} icon`}
                loading="lazy"
              />
            </Show>
          </div>
          <div class="pm-compact-card__title-wrap">
            <div class="pm-compact-card__title-box">
              <h3 class="pm-compact-card__title">{asset().name}</h3>
              <p class="pm-compact-card__subtitle">{asset().symbol}</p>
            </div>
          </div>
        </div>

        <div class="pm-compact-card__body">
          <div class="pm-compact-card__rows">
            <div class="pm-compact-card__row">
              <div class="pm-compact-card__row-copy">
                <p class="pm-compact-card__row-label">State</p>
              </div>
              <div class="pm-compact-card__row-actions">
                <p class="pm-compact-card__metric">{asset().asset_state_label}</p>
              </div>
            </div>

            <div class="pm-compact-card__row">
              <div class="pm-compact-card__row-copy">
                <p class="pm-compact-card__row-label">Price</p>
              </div>
              <div class="pm-compact-card__row-actions">
                <p class="pm-compact-card__metric">${asset().price_per_token}</p>
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
          </div>
        </div>
      </article>
    </div>
  );
}

export default function AdminAssetManager() {
  const factoryTask = useAsyncTask(() => assetClient.fetchFactoryStatus());
  const listTask = useAsyncTask((query?: ListAssetsQuery) => assetClient.listAssets(query));
  const registerTypeTask = useAsyncTask((token: string, payload: AdminRegisterAssetTypeRequest) =>
    assetClient.registerAssetType(token, payload),
  );
  const createAssetTask = useAsyncTask((token: string, payload: AdminCreateAssetRequest) =>
    assetClient.createAsset(token, payload),
  );
  const setPricingTask = useAsyncTask(
    (token: string, assetAddress: string, payload: AdminSetAssetPricingRequest) =>
      assetClient.setPricing(token, assetAddress, payload),
  );
  const [listError, setListError] = createSignal<string | null>(null);
  const [registerError, setRegisterError] = createSignal<string | null>(null);
  const [createError, setCreateError] = createSignal<string | null>(null);
  const [pricingError, setPricingError] = createSignal<string | null>(null);

  const adminToken = () => readAdminToken();

  async function handleListSubmit(event: SubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setListError(null);

    try {
      await listTask.run({
        asset_type_id: readOptionalText(formData, "asset_type_id"),
        q: readOptionalText(formData, "q"),
        asset_state: readOptionalText(formData, "asset_state"),
        featured: readOptionalBoolean(formData, "featured"),
        self_service_purchase_enabled: readOptionalBoolean(
          formData,
          "self_service_purchase_enabled",
        ),
        limit: readOptionalInteger(formData, "limit", "Limit"),
        offset: readOptionalInteger(formData, "offset", "Offset"),
      });
    } catch (error) {
      setListError(getErrorMessage(error));
    }
  }

  async function handleRegisterTypeSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setRegisterError("Connect an admin wallet first.");
      return;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setRegisterError(null);

    try {
      await registerTypeTask.run(token, {
        asset_type_id: readRequiredText(formData, "asset_type_id", "Asset type ID"),
        asset_type_name: readRequiredText(formData, "asset_type_name", "Asset type name"),
        implementation_address: readRequiredText(
          formData,
          "implementation_address",
          "Implementation address",
        ),
      });
      (event.currentTarget as HTMLFormElement).reset();
    } catch (error) {
      setRegisterError(getErrorMessage(error));
    }
  }

  async function handleCreateAssetSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setCreateError("Connect an admin wallet first.");
      return;
    }

    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    setCreateError(null);

    try {
      await createAssetTask.run(token, {
        proposal_id: readRequiredText(formData, "proposal_id", "Proposal ID"),
        asset_type_id: readRequiredText(formData, "asset_type_id", "Asset type ID"),
        name: readRequiredText(formData, "name", "Name"),
        symbol: readRequiredText(formData, "symbol", "Symbol"),
        max_supply: readRequiredText(formData, "max_supply", "Max supply"),
        subscription_price: readRequiredText(
          formData,
          "subscription_price",
          "Subscription price",
        ),
        redemption_price: readRequiredText(
          formData,
          "redemption_price",
          "Redemption price",
        ),
        self_service_purchase_enabled: Boolean(formData.get("self_service_purchase_enabled")),
        metadata_hash: readOptionalText(formData, "metadata_hash") ?? null,
        slug: readOptionalText(formData, "slug") ?? null,
        image_url: readOptionalText(formData, "image_url") ?? null,
        summary: readOptionalText(formData, "summary") ?? null,
        featured: Boolean(formData.get("featured")),
        visible: Boolean(formData.get("visible")),
        searchable: Boolean(formData.get("searchable")),
      });
      form.reset();
    } catch (error) {
      setCreateError(getErrorMessage(error));
    }
  }

  async function handlePricingSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setPricingError("Connect an admin wallet first.");
      return;
    }

    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    setPricingError(null);

    try {
      const assetAddress = readRequiredText(formData, "asset_address", "Asset address");
      await setPricingTask.run(token, assetAddress, {
        subscription_price: readRequiredText(
          formData,
          "subscription_price",
          "Subscription price",
        ),
        redemption_price: readRequiredText(
          formData,
          "redemption_price",
          "Redemption price",
        ),
      });
    } catch (error) {
      setPricingError(getErrorMessage(error));
    }
  }

  return (
    <div class="pm-tool-stack">
      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">Public endpoints</p>
            <h2 class="pm-tool-section__title">Asset catalog</h2>
          </div>
          <p class="pm-admin-section-note">
            Browse all registered assets. Public asset endpoints for factory status and catalog reads.
          </p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">GET /assets/factory</p>
                <h3 class="pm-market-card__title">Factory status</h3>
              </div>
            </div>
            <p class="pm-market-card__copy">
              Fetch on-chain factory wiring, registry addresses, and pause state.
            </p>
            <div class="pm-market-actions">
              <button
                class="pm-button pm-button--primary"
                type="button"
                disabled={factoryTask.pending()}
                onClick={() => void factoryTask.run()}
              >
                {factoryTask.pending() ? "Loading..." : "Fetch factory"}
              </button>
            </div>
            <Show when={factoryTask.error()}>
              <p class="pm-market-feedback pm-market-feedback--error">
                {getErrorMessage(factoryTask.error())}
              </p>
            </Show>
            <Show when={factoryTask.data()}>
              <div class="pm-market-result">
                <div class="pm-market-result__grid">
                  <div>
                    <span class="pm-market-result__label">Factory</span>
                    <span class="pm-market-result__value">{factoryTask.data()!.factory_address}</span>
                  </div>
                  <div>
                    <span class="pm-market-result__label">Paused</span>
                    <span class="pm-market-result__value">{factoryTask.data()!.paused ? "Yes" : "No"}</span>
                  </div>
                  <div>
                    <span class="pm-market-result__label">Total Assets</span>
                    <span class="pm-market-result__value">{factoryTask.data()!.total_assets_created}</span>
                  </div>
                </div>
              </div>
            </Show>
          </section>

          <section class="pm-market-card pm-market-card--wide">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">GET /assets</p>
                <h3 class="pm-market-card__title">List assets</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleListSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field">
                  <span class="pm-field__label">Search</span>
                  <input class="pm-field__input" name="q" type="text" placeholder="treasury" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Asset type ID</span>
                  <input class="pm-field__input" name="asset_type_id" type="text" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Asset state</span>
                  <input class="pm-field__input" name="asset_state" type="text" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Featured</span>
                  <select class="pm-field__input" name="featured">
                    <option value="">Any</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Self service</span>
                  <select class="pm-field__input" name="self_service_purchase_enabled">
                    <option value="">Any</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Limit</span>
                  <input class="pm-field__input" name="limit" type="number" min="1" value="50" />
                </label>
              </div>
              <div class="pm-market-actions">
                <button class="pm-button pm-button--primary" type="submit" disabled={listTask.pending()}>
                  {listTask.pending() ? "Loading..." : "List assets"}
                </button>
              </div>
            </form>
            <Show when={listError()}>
              <p class="pm-market-feedback pm-market-feedback--error">{listError()}</p>
            </Show>
            <Show when={listTask.data()}>
              <div class="pm-all-markets__grid">
                <For each={listTask.data()!.assets}>
                  {asset => <AssetCard asset={asset} />}
                </For>
              </div>
            </Show>
          </section>
        </div>
      </div>

      <div class="pm-tool-section">
        <div class="pm-tool-section__header">
          <div>
            <p class="pm-admin-section-header__eyebrow">Admin endpoints</p>
            <h2 class="pm-tool-section__title">Asset writes</h2>
          </div>
          <p class="pm-admin-section-note">
            Wallet-authenticated endpoints for registry setup, asset creation, and price control.
          </p>
        </div>

        <div class="pm-tool-section__grid">
          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">POST /admin/assets/types</p>
                <h3 class="pm-market-card__title">Register asset type</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleRegisterTypeSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field">
                  <span class="pm-field__label">Asset type ID</span>
                  <input class="pm-field__input" name="asset_type_id" type="text" required />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Asset type name</span>
                  <input class="pm-field__input" name="asset_type_name" type="text" required />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Implementation address</span>
                  <input class="pm-field__input" name="implementation_address" type="text" required />
                </label>
              </div>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={registerTypeTask.pending() || !adminToken()}
                >
                  {registerTypeTask.pending() ? "Submitting..." : "Register type"}
                </button>
              </div>
            </form>
            <Show when={registerError()}>
              <p class="pm-market-feedback pm-market-feedback--error">{registerError()}</p>
            </Show>
            <Show when={registerTypeTask.data()}>
              <div class="pm-market-result">
                <div class="pm-market-result__header">
                  <div>
                    <p class="pm-market-result__eyebrow">Registered</p>
                    <h3 class="pm-market-result__title">{registerTypeTask.data()!.asset_type.asset_type_name}</h3>
                  </div>
                </div>
                <div class="pm-market-result__grid">
                  <div>
                    <span class="pm-market-result__label">Type ID</span>
                    <span class="pm-market-result__value">{registerTypeTask.data()!.asset_type.asset_type_id}</span>
                  </div>
                  <div>
                    <span class="pm-market-result__label">TX Hash</span>
                    <span class="pm-market-result__value">{registerTypeTask.data()!.tx_hash}</span>
                  </div>
                </div>
              </div>
            </Show>
          </section>

          <section class="pm-market-card pm-market-card--wide">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">POST /admin/assets</p>
                <h3 class="pm-market-card__title">Create asset</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handleCreateAssetSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field">
                  <span class="pm-field__label">Proposal ID</span>
                  <input class="pm-field__input" name="proposal_id" type="text" required />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Asset type ID</span>
                  <input class="pm-field__input" name="asset_type_id" type="text" required />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Name</span>
                  <input class="pm-field__input" name="name" type="text" required />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Symbol</span>
                  <input class="pm-field__input" name="symbol" type="text" required />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Max supply</span>
                  <input class="pm-field__input" name="max_supply" type="text" required />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Slug</span>
                  <input class="pm-field__input" name="slug" type="text" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Subscription price</span>
                  <input class="pm-field__input" name="subscription_price" type="text" required />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Redemption price</span>
                  <input class="pm-field__input" name="redemption_price" type="text" required />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Metadata hash</span>
                  <input class="pm-field__input" name="metadata_hash" type="text" />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Image URL</span>
                  <input class="pm-field__input" name="image_url" type="url" />
                </label>
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Summary</span>
                  <textarea class="pm-field__textarea" name="summary" rows="3" />
                </label>
                <label class="pm-checkbox">
                  <input name="self_service_purchase_enabled" type="checkbox" />
                  <span>Self-service purchase enabled</span>
                </label>
                <label class="pm-checkbox">
                  <input name="featured" type="checkbox" />
                  <span>Featured</span>
                </label>
                <label class="pm-checkbox">
                  <input name="visible" type="checkbox" checked />
                  <span>Visible</span>
                </label>
                <label class="pm-checkbox">
                  <input name="searchable" type="checkbox" checked />
                  <span>Searchable</span>
                </label>
              </div>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={createAssetTask.pending() || !adminToken()}
                >
                  {createAssetTask.pending() ? "Creating..." : "Create asset"}
                </button>
              </div>
            </form>
            <Show when={createError()}>
              <p class="pm-market-feedback pm-market-feedback--error">{createError()}</p>
            </Show>
            <Show when={createAssetTask.data()}>
              <div class="pm-market-result">
                <div class="pm-market-result__header">
                  <div>
                    <p class="pm-market-result__eyebrow">Created</p>
                    <h3 class="pm-market-result__title">{createAssetTask.data()!.asset.name}</h3>
                  </div>
                  <span class="pm-market-result__badge">{createAssetTask.data()!.asset.asset_state_label}</span>
                </div>
                <div class="pm-market-result__grid">
                  <div>
                    <span class="pm-market-result__label">Asset Address</span>
                    <span class="pm-market-result__value">{createAssetTask.data()!.asset.asset_address}</span>
                  </div>
                  <div>
                    <span class="pm-market-result__label">Symbol</span>
                    <span class="pm-market-result__value">{createAssetTask.data()!.asset.symbol}</span>
                  </div>
                  <div>
                    <span class="pm-market-result__label">TX Hash</span>
                    <span class="pm-market-result__value">{createAssetTask.data()!.tx_hash}</span>
                  </div>
                  <div class="pm-market-result__detail--full">
                    <span class="pm-market-result__label">Created</span>
                    <span class="pm-market-result__value">{formatTimestamp(createAssetTask.data()!.asset.updated_at)}</span>
                  </div>
                </div>
              </div>
            </Show>
          </section>

          <section class="pm-market-card">
            <div class="pm-market-card__header">
              <div>
                <p class="pm-market-card__eyebrow">PUT /admin/assets/{'{asset_address}'}/pricing</p>
                <h3 class="pm-market-card__title">Update pricing</h3>
              </div>
            </div>
            <form class="pm-market-form" onSubmit={handlePricingSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Asset address</span>
                  <input class="pm-field__input" name="asset_address" type="text" required />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Subscription price</span>
                  <input class="pm-field__input" name="subscription_price" type="text" required />
                </label>
                <label class="pm-field">
                  <span class="pm-field__label">Redemption price</span>
                  <input class="pm-field__input" name="redemption_price" type="text" required />
                </label>
              </div>
              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={setPricingTask.pending() || !adminToken()}
                >
                  {setPricingTask.pending() ? "Saving..." : "Set pricing"}
                </button>
              </div>
            </form>
            <Show when={pricingError()}>
              <p class="pm-market-feedback pm-market-feedback--error">{pricingError()}</p>
            </Show>
            <Show when={setPricingTask.data()}>
              <div class="pm-market-result">
                <div class="pm-market-result__header">
                  <div>
                    <p class="pm-market-result__eyebrow">Updated</p>
                    <h3 class="pm-market-result__title">Pricing updated</h3>
                  </div>
                </div>
                <div class="pm-market-result__grid">
                  <div>
                    <span class="pm-market-result__label">TX Hash</span>
                    <span class="pm-market-result__value">{setPricingTask.data()!.tx_hash}</span>
                  </div>
                </div>
              </div>
            </Show>
          </section>
        </div>
      </div>
    </div>
  );
}
