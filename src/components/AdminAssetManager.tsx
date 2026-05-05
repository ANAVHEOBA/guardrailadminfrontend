import { For, Show, createSignal, onCleanup, onMount, type JSX } from "solid-js";

import {
  adminClient,
  assetClient,
  DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
  formatBaseUnitsLabel,
  formatPaymentTokenAmountFromBaseUnits,
  marketClient,
  readAdminToken,
  type AdminCreateAssetRequest,
  type AdminImageUploadResponse,
  type AssetTypeResponse,
  type AdminRegisterAssetTypeRequest,
  type AdminSetAssetPricingRequest,
  type AssetResponse,
  type ListAssetsQuery,
  type PaymentTokenQuoteQuery,
} from "~/lib";
import { useAdminAuth } from "~/lib/admin-auth-context";
import { getErrorMessage } from "~/lib/api";
import { useAsyncTask } from "~/lib/hooks/useAsyncTask";
import { shortenWalletAddress } from "~/lib/wallet/ethereum";

import AdminModal from "./AdminModal";
import {
  readOptionalBoolean,
  readOptionalInteger,
  readOptionalText,
  readRequiredText,
  readStringList,
} from "./admin-form-utils";

type AssetModalView = "factory" | "catalog" | "register-type" | "create-asset" | "pricing";
type PricingInputMode = "market" | "raw";

interface PricingDraft {
  asset_address: string;
  subscription_price: string;
  redemption_price: string;
}

interface ActionCardProps {
  actionLabel: string;
  endpoint: string;
  title: string;
  copy: string;
  detail: string;
  onOpen: () => void;
  tone?: "default" | "admin";
}

const DEFAULT_LIST_QUERY: ListAssetsQuery = {
  limit: 12,
  offset: 0,
};

const EMPTY_PRICING_DRAFT: PricingDraft = {
  asset_address: "",
  subscription_price: "",
  redemption_price: "",
};

const MAX_ADMIN_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const FALLBACK_MARKET_CURRENCIES = ["ngn", "usd", "eur", "gbp"];
const ASSET_TOKEN_DECIMALS = 18;
const ASSET_TYPE_CURRENCY_MAP: Record<string, string> = {
  AE: "aed",
  AU: "aud",
  BR: "brl",
  CA: "cad",
  CH: "chf",
  CN: "cny",
  EG: "egp",
  EU: "eur",
  GB: "gbp",
  GH: "ghs",
  IN: "inr",
  JP: "jpy",
  KE: "kes",
  MX: "mxn",
  NG: "ngn",
  SA: "sar",
  SG: "sgd",
  UK: "gbp",
  US: "usd",
  ZA: "zar",
};

function parseAssetTokenAmountInput(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    throw new Error("Max supply is required.");
  }

  const normalized = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;

  if (!/^\d+(?:\.\d{0,18})?$/.test(normalized)) {
    throw new Error("Max supply must be a valid asset amount with up to 18 decimals.");
  }

  const [wholeRaw, fractionalRaw = ""] = normalized.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const fractional = fractionalRaw.padEnd(ASSET_TOKEN_DECIMALS, "0");
  const baseUnits = `${whole}${fractional}`.replace(/^0+/, "") || "0";

  if (baseUnits === "0") {
    throw new Error("Max supply must be greater than zero.");
  }

  return baseUnits;
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatWalletLabel(walletAddress: string | null | undefined) {
  if (!walletAddress) {
    return "Admin wallet";
  }

  return shortenWalletAddress(walletAddress);
}

function buildPricingDraft(asset?: AssetResponse | null): PricingDraft {
  if (!asset) {
    return { ...EMPTY_PRICING_DRAFT };
  }

  return {
    asset_address: asset.asset_address,
    subscription_price: asset.price_per_token,
    redemption_price: asset.redemption_price_per_token,
  };
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUnixTimestamp(value: number | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value * 1000);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString();
}

function getAssetTypeLabel(assetType: AssetTypeResponse) {
  const displayId = assetType.asset_type_id_text?.trim() || assetType.asset_type_id;

  if (assetType.asset_type_name === displayId) {
    return assetType.asset_type_name;
  }

  return `${assetType.asset_type_name} (${displayId})`;
}

function inferMarketCurrencyFromAssetType(assetType?: AssetTypeResponse) {
  if (!assetType) {
    return null;
  }

  const explicitPrefix = [assetType.asset_type_id_text, assetType.asset_type_id]
    .map(value => value?.trim())
    .filter(Boolean)
    .map(value => value!.match(/\b([A-Z]{2})(?=[_-])/))
    .find(Boolean)?.[1];

  if (explicitPrefix && ASSET_TYPE_CURRENCY_MAP[explicitPrefix]) {
    return ASSET_TYPE_CURRENCY_MAP[explicitPrefix];
  }

  const descriptor = `${assetType.asset_type_name} ${assetType.asset_type_id_text ?? ""} ${assetType.asset_type_id}`.toLowerCase();

  if (descriptor.includes("nigeria")) {
    return "ngn";
  }

  if (descriptor.includes("u.s.") || descriptor.includes("united states")) {
    return "usd";
  }

  if (descriptor.includes("euro")) {
    return "eur";
  }

  if (descriptor.includes("british") || descriptor.includes("united kingdom")) {
    return "gbp";
  }

  return null;
}

function ActionCard(props: ActionCardProps) {
  return (
    <button
      class={`pm-asset-action-card${
        props.tone === "admin" ? " pm-asset-action-card--admin" : ""
      }`}
      type="button"
      onClick={props.onOpen}
    >
      <div class="pm-asset-action-card__header">
        <p class="pm-asset-action-card__eyebrow">{props.endpoint}</p>
        <span class="pm-asset-action-card__pill">{props.actionLabel}</span>
      </div>

      <div class="pm-asset-action-card__body">
        <h3 class="pm-asset-action-card__title">{props.title}</h3>
        <p class="pm-asset-action-card__copy">{props.copy}</p>
      </div>

      <div class="pm-asset-action-card__footer">
        <span class="pm-asset-action-card__detail">{props.detail}</span>
        <span class="pm-asset-action-card__cta">Open modal</span>
      </div>
    </button>
  );
}

function AssetCard(props: {
  asset: AssetResponse;
  onManagePricing?: (asset: AssetResponse) => void;
}) {
  const asset = () => props.asset;
  const fallbackLetter = () => asset().symbol.charAt(0).toUpperCase() || "A";

  return (
    <article class="pm-compact-card">
      <div class="pm-compact-card__header">
        <div class="pm-compact-card__art">
          <Show
            when={asset().image_url}
            fallback={<span class="pm-compact-card__art-fallback">{fallbackLetter()}</span>}
          >
            <img src={asset().image_url ?? ""} alt={`${asset().name} card icon`} loading="lazy" />
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
                <p class="pm-compact-card__row-label">Subscription</p>
              </div>
              <div class="pm-compact-card__row-actions">
                <div class="pm-compact-card__metric-stack">
                  <p class="pm-compact-card__metric">
                    {formatPaymentTokenAmountFromBaseUnits(
                      asset().price_per_token,
                      DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
                    )}
                  </p>
                  <p class="pm-compact-card__metric-meta">
                    {formatBaseUnitsLabel(asset().price_per_token)}
                  </p>
                </div>
              </div>
            </div>

            <div class="pm-compact-card__row">
              <div class="pm-compact-card__row-copy">
                <p class="pm-compact-card__row-label">Redemption</p>
              </div>
              <div class="pm-compact-card__row-actions">
                <div class="pm-compact-card__metric-stack">
                  <p class="pm-compact-card__metric">
                    {formatPaymentTokenAmountFromBaseUnits(
                      asset().redemption_price_per_token,
                      DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
                    )}
                  </p>
                  <p class="pm-compact-card__metric-meta">
                    {formatBaseUnitsLabel(asset().redemption_price_per_token)}
                  </p>
                </div>
              </div>
            </div>
        </div>
      </div>

      <div class="pm-compact-card__footer pm-compact-card__footer--stack">
        <div class="pm-compact-card__footer-badges">
          <Show when={asset().featured}>
            <span class="pm-compact-card__badge">Featured</span>
          </Show>
          <Show when={asset().self_service_purchase_enabled}>
            <span class="pm-compact-card__badge">Self-service</span>
          </Show>
          <Show when={!asset().visible}>
            <span class="pm-compact-card__badge">Hidden</span>
          </Show>
        </div>

        <div class="pm-asset-preview-card__meta">
          <p class="pm-compact-card__footer-text">{asset().holder_count} holders</p>
          <Show when={props.onManagePricing}>
            <button
              class="pm-button pm-button--ghost"
              type="button"
              onClick={() => props.onManagePricing?.(asset())}
            >
              Update pricing
            </button>
          </Show>
        </div>
      </div>
    </article>
  );
}

function AdminGate(props: {
  connected: boolean;
  walletLabel: string;
  onConnect: () => void;
  children: JSX.Element;
}) {
  return (
    <Show
      when={props.connected}
      fallback={
        <section class="pm-admin-gate">
          <div>
            <p class="pm-admin-gate__eyebrow">Admin authentication required</p>
            <h3 class="pm-admin-gate__title">Connect an allowlisted wallet</h3>
            <p class="pm-admin-gate__copy">
              This workflow signs a wallet challenge before the backend accepts the request.
            </p>
          </div>

          <div class="pm-admin-gate__actions">
            <button class="pm-button pm-button--primary" type="button" onClick={props.onConnect}>
              Connect admin wallet
            </button>
          </div>
        </section>
      }
    >
      <div class="pm-admin-gate__session">
        <span class="pm-market-chip">Authenticated</span>
        <span class="pm-market-chip">{props.walletLabel}</span>
      </div>
      {props.children}
    </Show>
  );
}

export default function AdminAssetManager() {
  const auth = useAdminAuth();
  const factoryTask = useAsyncTask(() => assetClient.fetchFactoryStatus());
  const assetTypesTask = useAsyncTask(() => assetClient.listAssetTypes());
  const supportedCurrenciesTask = useAsyncTask(() => marketClient.fetchSupportedCurrencies());
  const listTask = useAsyncTask((query?: ListAssetsQuery) => assetClient.listAssets(query));
  const registerTypeTask = useAsyncTask((token: string, payload: AdminRegisterAssetTypeRequest) =>
    assetClient.registerAssetType(token, payload),
  );
  const createAssetTask = useAsyncTask((token: string, payload: AdminCreateAssetRequest) =>
    assetClient.createAsset(token, payload),
  );
  const createPricingQuoteTask = useAsyncTask((query: PaymentTokenQuoteQuery) =>
    marketClient.fetchPaymentTokenQuote(query),
  );
  const createAssetImageUploadTask = useAsyncTask((token: string, file: File, scope?: string) =>
    adminClient.uploadImage(token, { file, scope }),
  );
  const setPricingTask = useAsyncTask(
    (token: string, assetAddress: string, payload: AdminSetAssetPricingRequest) =>
      assetClient.setPricing(token, assetAddress, payload),
  );
  const [activeModal, setActiveModal] = createSignal<AssetModalView | null>(null);
  const [listError, setListError] = createSignal<string | null>(null);
  const [registerError, setRegisterError] = createSignal<string | null>(null);
  const [createError, setCreateError] = createSignal<string | null>(null);
  const [createImageUploadError, setCreateImageUploadError] = createSignal<string | null>(null);
  const [createPricingQuoteError, setCreatePricingQuoteError] = createSignal<string | null>(null);
  const [pricingError, setPricingError] = createSignal<string | null>(null);
  const [createImageFile, setCreateImageFile] = createSignal<File | null>(null);
  const [createImagePreviewUrl, setCreateImagePreviewUrl] = createSignal<string | null>(null);
  const [uploadedCreateImage, setUploadedCreateImage] =
    createSignal<AdminImageUploadResponse["asset"] | null>(null);
  const [createSelectedAssetTypeId, setCreateSelectedAssetTypeId] = createSignal("");
  const [createPricingMode, setCreatePricingMode] = createSignal<PricingInputMode>("market");
  const [createMarketCurrency, setCreateMarketCurrency] = createSignal("ngn");
  const [createMarketSubscriptionPrice, setCreateMarketSubscriptionPrice] = createSignal("");
  const [createMarketRedemptionPrice, setCreateMarketRedemptionPrice] = createSignal("");
  const [createRawSubscriptionPrice, setCreateRawSubscriptionPrice] = createSignal("");
  const [createRawRedemptionPrice, setCreateRawRedemptionPrice] = createSignal("");
  const [pricingDraft, setPricingDraft] = createSignal<PricingDraft>({
    ...EMPTY_PRICING_DRAFT,
  });
  const [lastListQuery, setLastListQuery] = createSignal<ListAssetsQuery>({
    ...DEFAULT_LIST_QUERY,
  });
  let createAssetFormRef: HTMLFormElement | undefined;

  const adminToken = () => auth.session()?.token ?? readAdminToken();
  const isAdminConnected = () => Boolean(auth.profile() && adminToken());
  const adminWalletLabel = () => formatWalletLabel(auth.profile()?.user.wallet?.wallet_address);
  const assetTypes = () => assetTypesTask.data()?.asset_types ?? [];
  const selectedCreateAssetType = () =>
    assetTypes().find(assetType => assetType.asset_type_id === createSelectedAssetTypeId());
  const previewAssets = () => listTask.data()?.assets ?? [];
  const supportedMarketCurrencies = () => {
    const currencies = supportedCurrenciesTask.data()?.supported_currencies ?? [];

    return currencies.length > 0 ? currencies : FALLBACK_MARKET_CURRENCIES;
  };
  const createMarketCurrencyOptions = () => {
    const options = new Set(supportedMarketCurrencies());
    const currentValue = createMarketCurrency().trim().toLowerCase();

    if (currentValue) {
      options.add(currentValue);
    }

    return Array.from(options).sort((left, right) => left.localeCompare(right));
  };

  function revokeCreateImagePreviewUrl() {
    const previewUrl = createImagePreviewUrl();

    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
  }

  function resetCreateAssetImageState() {
    revokeCreateImagePreviewUrl();
    setCreateImageFile(null);
    setCreateImagePreviewUrl(null);
    setUploadedCreateImage(null);
    setCreateImageUploadError(null);
    createAssetImageUploadTask.reset();
  }

  function resetCreatePricingState() {
    setCreateSelectedAssetTypeId("");
    setCreatePricingMode("market");
    setCreateMarketCurrency("ngn");
    setCreateMarketSubscriptionPrice("");
    setCreateMarketRedemptionPrice("");
    setCreateRawSubscriptionPrice("");
    setCreateRawRedemptionPrice("");
    setCreatePricingQuoteError(null);
    createPricingQuoteTask.reset();
  }

  function resetCreateAssetFormState() {
    setCreateError(null);
    resetCreateAssetImageState();
    resetCreatePricingState();
  }

  function clearCreatePricingPreview() {
    setCreatePricingQuoteError(null);
    createPricingQuoteTask.reset();
  }

  function applySuggestedMarketCurrency(assetTypeId: string) {
    const assetType = assetTypes().find(entry => entry.asset_type_id === assetTypeId);
    const suggestedCurrency = inferMarketCurrencyFromAssetType(assetType);

    if (suggestedCurrency) {
      setCreateMarketCurrency(suggestedCurrency);
    }
  }

  async function refreshSupportedCurrencies() {
    try {
      await supportedCurrenciesTask.run();
    } catch {
      // The create flow still works with manual market currency entry.
    }
  }

  async function previewCreatePricingQuote() {
    if (createPricingMode() !== "market") {
      return null;
    }

    const marketCurrency = createMarketCurrency().trim().toLowerCase();

    if (!marketCurrency) {
      setCreatePricingQuoteError("Market currency is required.");
      return null;
    }

    if (!createMarketSubscriptionPrice().trim() && !createMarketRedemptionPrice().trim()) {
      setCreatePricingQuoteError("Enter at least one market price to preview.");
      return null;
    }

    setCreatePricingQuoteError(null);

    try {
      return await createPricingQuoteTask.run({
        market_currency: marketCurrency,
        subscription_price: createMarketSubscriptionPrice().trim() || undefined,
        redemption_price: createMarketRedemptionPrice().trim() || undefined,
      });
    } catch (error) {
      setCreatePricingQuoteError(getErrorMessage(error));
      return null;
    }
  }

  async function refreshFactoryStatus() {
    try {
      await factoryTask.run();
    } catch {
      // Keep the last successful snapshot visible.
    }
  }

  async function refreshAssetTypes() {
    try {
      await assetTypesTask.run();
    } catch {
      // The create flow falls back to manual input when this request fails.
    }
  }

  async function runAssetList(query: ListAssetsQuery = lastListQuery()) {
    setListError(null);
    setLastListQuery({
      ...query,
    });

    try {
      await listTask.run(query);
    } catch (error) {
      setListError(getErrorMessage(error));
    }
  }

  function openModal(view: AssetModalView) {
    if (view === "pricing") {
      setPricingDraft({ ...EMPTY_PRICING_DRAFT });
      setPricingError(null);
      setPricingTask.reset();
    }

    if (view === "register-type") {
      setRegisterError(null);
      registerTypeTask.reset();
    }

    if (view === "create-asset") {
      resetCreateAssetFormState();
      createAssetTask.reset();
    }

    if (view === "catalog") {
      void runAssetList(lastListQuery());
    }

    setActiveModal(view);
  }

  function openPricingModal(asset?: AssetResponse) {
    setPricingDraft(buildPricingDraft(asset));
    setPricingError(null);
    setPricingTask.reset();
    setActiveModal("pricing");
  }

  onMount(() => {
    void refreshFactoryStatus();
    void refreshAssetTypes();
    void refreshSupportedCurrencies();
    void runAssetList(DEFAULT_LIST_QUERY);
  });

  onCleanup(() => {
    revokeCreateImagePreviewUrl();
  });

  async function handleListSubmit(event: SubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);

    await runAssetList({
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
  }

  async function handleRegisterTypeSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setRegisterError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
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
      form.reset();
      void refreshAssetTypes();
    } catch (error) {
      setRegisterError(getErrorMessage(error));
      void refreshAssetTypes();
    }
  }

  async function handleCreateAssetSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setCreateError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    setCreateError(null);
    setCreateImageUploadError(null);
    setCreatePricingQuoteError(null);

    try {
      const externalImageUrl = readOptionalText(formData, "external_image_url") ?? null;
      let imageUrl = externalImageUrl;
      const selectedImageFile = createImageFile();
      let subscriptionPrice = "";
      let redemptionPrice = "";

      if (selectedImageFile) {
        const existingUpload = uploadedCreateImage();

        if (existingUpload) {
          imageUrl = existingUpload.gateway_url;
        } else {
          const uploadResponse = await createAssetImageUploadTask.run(
            token,
            selectedImageFile,
            "assets",
          );

          setUploadedCreateImage(uploadResponse.asset);
          imageUrl = uploadResponse.asset.gateway_url;
        }
      }

      if (createPricingMode() === "market") {
        const quote = await previewCreatePricingQuote();

        if (!quote?.subscription_price || !quote.redemption_price) {
          throw new Error(
            "Both subscription and redemption prices must resolve to payment-token base units.",
          );
        }

        subscriptionPrice = quote.subscription_price.payment_token_base_units;
        redemptionPrice = quote.redemption_price.payment_token_base_units;
      } else {
        subscriptionPrice = readRequiredText(
          formData,
          "subscription_price_raw",
          "Subscription price base units",
        );
        redemptionPrice = readRequiredText(
          formData,
          "redemption_price_raw",
          "Redemption price base units",
        );
      }

      await createAssetTask.run(token, {
        proposal_id: readRequiredText(formData, "proposal_id", "Proposal ID"),
        asset_type_id: readRequiredText(formData, "asset_type_id", "Asset type ID"),
        name: readRequiredText(formData, "name", "Name"),
        symbol: readRequiredText(formData, "symbol", "Symbol"),
        max_supply: parseAssetTokenAmountInput(
          readRequiredText(formData, "max_supply", "Max supply"),
        ),
        subscription_price: subscriptionPrice,
        redemption_price: redemptionPrice,
        self_service_purchase_enabled: Boolean(formData.get("self_service_purchase_enabled")),
        metadata_hash: readOptionalText(formData, "metadata_hash") ?? null,
        slug: readOptionalText(formData, "slug") ?? null,
        image_url: imageUrl,
        summary: readOptionalText(formData, "summary") ?? null,
        market_segment: readOptionalText(formData, "market_segment") ?? null,
        suggested_internal_tags: readStringList(formData, "suggested_internal_tags") ?? [],
        sources: readStringList(formData, "sources") ?? [],
        featured: Boolean(formData.get("featured")),
        visible: Boolean(formData.get("visible")),
        searchable: Boolean(formData.get("searchable")),
      });
      form.reset();
      resetCreateAssetFormState();
      void refreshFactoryStatus();
      void runAssetList(lastListQuery());
    } catch (error) {
      const message = getErrorMessage(error);

      if (createAssetImageUploadTask.error() === error) {
        setCreateImageUploadError(message);
      } else if (createPricingQuoteTask.error() === error) {
        setCreatePricingQuoteError(message);
      } else {
        setCreateError(message);
      }
    }
  }

  function handleCreateImageSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const selectedFile = input.files?.[0] ?? null;

    revokeCreateImagePreviewUrl();
    setUploadedCreateImage(null);
    createAssetImageUploadTask.reset();
    setCreateImageUploadError(null);

    if (!selectedFile) {
      setCreateImageFile(null);
      setCreateImagePreviewUrl(null);
      return;
    }

    if (selectedFile.size > MAX_ADMIN_IMAGE_SIZE_BYTES) {
      input.value = "";
      setCreateImageFile(null);
      setCreateImagePreviewUrl(null);
      setCreateImageUploadError("Image must be 10 MB or smaller.");
      return;
    }

    setCreateImageFile(selectedFile);
    setCreateImagePreviewUrl(URL.createObjectURL(selectedFile));
  }

  function handleCreateAssetTypeChange(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement | HTMLInputElement).value;
    setCreateSelectedAssetTypeId(value);
    applySuggestedMarketCurrency(value);
    clearCreatePricingPreview();
  }

  async function handlePricingSubmit(event: SubmitEvent) {
    event.preventDefault();
    const token = adminToken();

    if (!token) {
      setPricingError("Connect an admin wallet first.");
      auth.openAuthDialog();
      return;
    }

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setPricingError(null);

    try {
      const assetAddress = readRequiredText(formData, "asset_address", "Asset address");
      await setPricingTask.run(token, assetAddress, {
        subscription_price: readRequiredText(
          formData,
          "subscription_price",
          "Subscription price",
        ),
        redemption_price: readRequiredText(formData, "redemption_price", "Redemption price"),
      });
      void runAssetList(lastListQuery());
    } catch (error) {
      setPricingError(getErrorMessage(error));
    }
  }

  return (
    <>
      <div class="pm-asset-admin">
        <section class="pm-asset-admin__hero">
          <div class="pm-asset-admin__hero-copy">
            <p class="pm-admin-section-header__eyebrow">Asset operations</p>
            <h1 class="pm-asset-admin__title">Manage the full asset catalog without losing the flow.</h1>
            <p class="pm-asset-admin__copy">
              Public reads stay visible in the workspace, while write operations now open in dedicated
              modals with admin wallet checks before any registry or pricing call is sent.
            </p>

            <div class="pm-asset-admin__chips">
              <span class="pm-market-chip">
                {factoryTask.data()?.total_assets_created ?? "0"} total assets
              </span>
              <span class="pm-market-chip">{assetTypes().length} registered types</span>
              <span class="pm-market-chip">
                {factoryTask.data()?.paused ? "Factory paused" : "Factory live"}
              </span>
            </div>

            <div class="pm-asset-admin__actions">
              <button class="pm-button pm-button--primary" type="button" onClick={() => openModal("create-asset")}>
                Create asset
              </button>
              <button class="pm-button pm-button--ghost" type="button" onClick={() => openModal("catalog")}>
                Browse catalog
              </button>
            </div>
          </div>

          <aside class="pm-asset-admin__session">
            <p class="pm-asset-admin__session-eyebrow">Admin auth</p>
            <Show
              when={isAdminConnected()}
              fallback={
                <>
                  <h2 class="pm-asset-admin__session-title">Authentication required for write calls</h2>
                  <p class="pm-asset-admin__session-copy">
                    Asset reads are public. Registry setup, creation, and pricing updates require an
                    allowlisted admin wallet session.
                  </p>
                  <button class="pm-button pm-button--primary" type="button" onClick={auth.openAuthDialog}>
                    Connect admin wallet
                  </button>
                </>
              }
            >
              <h2 class="pm-asset-admin__session-title">Authenticated and ready</h2>
              <p class="pm-asset-admin__session-copy">
                Wallet session is active for admin-only endpoint flows and modal confirmations.
              </p>
              <div class="pm-asset-admin__session-chips">
                <span class="pm-market-chip">{adminWalletLabel()}</span>
                <span class="pm-market-chip">Monad #{auth.profile()?.monad_chain_id ?? "-"}</span>
              </div>
            </Show>
          </aside>
        </section>

        <section class="pm-asset-admin__section">
          <div class="pm-tool-section__header">
            <div>
              <p class="pm-admin-section-header__eyebrow">Public endpoints</p>
              <h2 class="pm-tool-section__title">Read the live catalog before you write</h2>
            </div>
            <p class="pm-admin-section-note">
              These calls stay unauthenticated. Use them to validate factory wiring, search the catalog,
              and pick the correct asset before pricing changes.
            </p>
          </div>

          <div class="pm-asset-action-grid">
            <ActionCard
              actionLabel="Public"
              endpoint="GET /assets/factory"
              title="Factory status"
              copy="Inspect registry wiring, access control addresses, treasury wiring, and the global pause flag."
              detail="Quick sanity check before any admin write"
              onOpen={() => openModal("factory")}
            />
            <ActionCard
              actionLabel="Public"
              endpoint="GET /assets"
              title="Catalog explorer"
              copy="Search by query, type, state, featured status, and self-service availability in one place."
              detail="Use results to launch pricing updates directly"
              onOpen={() => openModal("catalog")}
            />
          </div>
        </section>

        <section class="pm-asset-admin__section">
          <div class="pm-tool-section__header">
            <div>
              <p class="pm-admin-section-header__eyebrow">Admin endpoints</p>
              <h2 class="pm-tool-section__title">Run guarded write workflows</h2>
            </div>
            <p class="pm-admin-section-note">
              Each write operation opens in a dedicated modal and prompts for admin wallet auth when the
              session is missing.
            </p>
          </div>

          <div class="pm-asset-action-grid pm-asset-action-grid--admin">
            <ActionCard
              actionLabel="Admin"
              endpoint="POST /admin/assets/types"
              title="Register asset type"
              copy="Add a new asset implementation mapping before assets can be created against it."
              detail="Validates against the current registered type list"
              onOpen={() => openModal("register-type")}
              tone="admin"
            />
            <ActionCard
              actionLabel="Admin"
              endpoint="POST /admin/assets"
              title="Create asset"
              copy="Create a new asset with catalog metadata, supply controls, visibility, and initial prices."
              detail="Uses backend asset types where available"
              onOpen={() => openModal("create-asset")}
              tone="admin"
            />
            <ActionCard
              actionLabel="Admin"
              endpoint="PUT /admin/assets/{asset_address}/pricing"
              title="Update pricing"
              copy="Change subscription and redemption pricing without digging through inline forms."
              detail="Can be launched blank or prefilled from catalog results"
              onOpen={() => openPricingModal()}
              tone="admin"
            />
          </div>
        </section>

        <section class="pm-asset-admin__preview-grid">
          <article class="pm-asset-snapshot-card">
            <div class="pm-asset-snapshot-card__header">
              <div>
                <p class="pm-market-card__eyebrow">Factory snapshot</p>
                <h3 class="pm-market-card__title">Current on-chain wiring</h3>
              </div>
              <button
                class="pm-button pm-button--ghost"
                type="button"
                disabled={factoryTask.pending()}
                onClick={() => void refreshFactoryStatus()}
              >
                {factoryTask.pending() ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <Show
              when={factoryTask.data()}
              fallback={
                <p class="pm-market-feedback">
                  {factoryTask.error()
                    ? getErrorMessage(factoryTask.error())
                    : "Factory status will appear here after the initial fetch completes."}
                </p>
              }
            >
              <div class="pm-market-result__grid">
                <div>
                  <span class="pm-market-result__label">Factory</span>
                  <span class="pm-market-result__value">
                    {factoryTask.data()!.factory_address}
                  </span>
                </div>
                <div>
                  <span class="pm-market-result__label">Access control</span>
                  <span class="pm-market-result__value">
                    {factoryTask.data()!.access_control_address}
                  </span>
                </div>
                <div>
                  <span class="pm-market-result__label">Treasury</span>
                  <span class="pm-market-result__value">
                    {factoryTask.data()!.treasury_address}
                  </span>
                </div>
                <div>
                  <span class="pm-market-result__label">Compliance registry</span>
                  <span class="pm-market-result__value">
                    {factoryTask.data()!.compliance_registry_address}
                  </span>
                </div>
              </div>
            </Show>
          </article>

          <article class="pm-asset-snapshot-card">
            <div class="pm-asset-snapshot-card__header">
              <div>
                <p class="pm-market-card__eyebrow">Catalog snapshot</p>
                <h3 class="pm-market-card__title">Recent assets</h3>
              </div>
              <button class="pm-button pm-button--ghost" type="button" onClick={() => openModal("catalog")}>
                Open explorer
              </button>
            </div>

            <Show when={listError()}>
              <p class="pm-market-feedback pm-market-feedback--error">{listError()}</p>
            </Show>

            <Show
              when={previewAssets().length > 0}
              fallback={
                <p class="pm-market-feedback">
                  {listTask.pending() ? "Loading recent assets..." : "No assets found yet."}
                </p>
              }
            >
              <div class="pm-asset-preview-grid">
                <For each={previewAssets().slice(0, 4)}>
                  {asset => (
                    <AssetCard
                      asset={asset}
                      onManagePricing={isAdminConnected() ? openPricingModal : undefined}
                    />
                  )}
                </For>
              </div>
            </Show>
          </article>
        </section>
      </div>

      <AdminModal
        open={activeModal() === "factory"}
        onClose={() => setActiveModal(null)}
        eyebrow="Public endpoint"
        title="Factory status"
        subtitle="Fetch the current factory, registry, treasury, and pause-state snapshot."
      >
        <div class="pm-asset-modal-stack">
          <div class="pm-market-actions pm-market-actions--split">
            <div class="pm-asset-modal__chips">
              <Show when={factoryTask.data()}>
                <span class="pm-market-chip">
                  {factoryTask.data()!.paused ? "Paused" : "Unpaused"}
                </span>
              </Show>
              <Show when={factoryTask.data()}>
                <span class="pm-market-chip">
                  {factoryTask.data()!.total_assets_created} assets created
                </span>
              </Show>
            </div>
            <button
              class="pm-button pm-button--primary"
              type="button"
              disabled={factoryTask.pending()}
              onClick={() => void refreshFactoryStatus()}
            >
              {factoryTask.pending() ? "Fetching..." : "Fetch factory"}
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
                  <span class="pm-market-result__label">Access control</span>
                  <span class="pm-market-result__value">
                    {factoryTask.data()!.access_control_address}
                  </span>
                </div>
                <div>
                  <span class="pm-market-result__label">Treasury</span>
                  <span class="pm-market-result__value">{factoryTask.data()!.treasury_address}</span>
                </div>
                <div>
                  <span class="pm-market-result__label">Compliance registry</span>
                  <span class="pm-market-result__value">
                    {factoryTask.data()!.compliance_registry_address}
                  </span>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "catalog"}
        onClose={() => setActiveModal(null)}
        eyebrow="Public endpoint"
        title="Catalog explorer"
        subtitle="Search and inspect assets, then jump straight into pricing updates from the results."
        size="wide"
      >
        <div class="pm-asset-modal-stack">
          <form class="pm-market-form" onSubmit={handleListSubmit}>
            <div class="pm-market-fields">
              <label class="pm-field">
                <span class="pm-field__label">Search</span>
                <input
                  class="pm-field__input"
                  name="q"
                  type="text"
                  placeholder="treasury"
                  value={lastListQuery().q ?? ""}
                />
              </label>

              <label class="pm-field">
                <span class="pm-field__label">Asset type ID</span>
                <input
                  class="pm-field__input"
                  name="asset_type_id"
                  type="text"
                  placeholder="treasury_fund"
                  value={lastListQuery().asset_type_id ?? ""}
                />
              </label>

              <label class="pm-field">
                <span class="pm-field__label">Asset state</span>
                <input
                  class="pm-field__input"
                  name="asset_state"
                  type="text"
                  placeholder="active"
                  value={lastListQuery().asset_state ?? ""}
                />
              </label>

              <label class="pm-field">
                <span class="pm-field__label">Featured</span>
                <select class="pm-field__input" name="featured" value={String(lastListQuery().featured ?? "")}>
                  <option value="">Any</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </label>

              <label class="pm-field">
                <span class="pm-field__label">Self service</span>
                <select
                  class="pm-field__input"
                  name="self_service_purchase_enabled"
                  value={String(lastListQuery().self_service_purchase_enabled ?? "")}
                >
                  <option value="">Any</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </label>

              <label class="pm-field">
                <span class="pm-field__label">Limit</span>
                <input
                  class="pm-field__input"
                  name="limit"
                  type="number"
                  min="1"
                  value={String(lastListQuery().limit ?? DEFAULT_LIST_QUERY.limit ?? 12)}
                />
              </label>

              <label class="pm-field">
                <span class="pm-field__label">Offset</span>
                <input
                  class="pm-field__input"
                  name="offset"
                  type="number"
                  min="0"
                  value={String(lastListQuery().offset ?? 0)}
                />
              </label>
            </div>

            <div class="pm-market-actions pm-market-actions--group">
              <button class="pm-button pm-button--primary" type="submit" disabled={listTask.pending()}>
                {listTask.pending() ? "Searching..." : "List assets"}
              </button>
              <button
                class="pm-button pm-button--ghost"
                type="button"
                onClick={() => void runAssetList(DEFAULT_LIST_QUERY)}
              >
                Reset filters
              </button>
            </div>
          </form>

          <Show when={listError()}>
            <p class="pm-market-feedback pm-market-feedback--error">{listError()}</p>
          </Show>

          <div class="pm-asset-modal__summary">
            <span class="pm-market-chip">{listTask.data()?.assets.length ?? 0} results</span>
            <span class="pm-market-chip">
              limit {listTask.data()?.limit ?? lastListQuery().limit ?? DEFAULT_LIST_QUERY.limit}
            </span>
            <span class="pm-market-chip">
              offset {listTask.data()?.offset ?? lastListQuery().offset ?? 0}
            </span>
          </div>

          <Show
            when={listTask.data()?.assets.length}
            fallback={
              <p class="pm-market-feedback">
                {listTask.pending() ? "Loading assets..." : "No assets matched the current filters."}
              </p>
            }
          >
            <div class="pm-asset-modal-grid">
              <For each={listTask.data()!.assets}>
                {asset => (
                  <AssetCard
                    asset={asset}
                    onManagePricing={isAdminConnected() ? openPricingModal : undefined}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "register-type"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin endpoint"
        title="Register asset type"
        subtitle="Map a human-readable asset type ID to the deployed implementation address."
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
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
                  disabled={registerTypeTask.pending()}
                >
                  {registerTypeTask.pending() ? "Registering..." : "Register type"}
                </button>
              </div>
            </form>
          </AdminGate>

          <Show when={registerError()}>
            <p class="pm-market-feedback pm-market-feedback--error">{registerError()}</p>
          </Show>

          <Show when={registerTypeTask.data()}>
            <div class="pm-market-result">
              <div class="pm-market-result__header">
                <div>
                  <p class="pm-market-result__eyebrow">Registered</p>
                  <h3 class="pm-market-result__title">
                    {registerTypeTask.data()!.asset_type.asset_type_name}
                  </h3>
                </div>
              </div>

              <div class="pm-market-result__grid">
                <div>
                  <span class="pm-market-result__label">Type ID</span>
                  <span class="pm-market-result__value">
                    {registerTypeTask.data()!.asset_type.asset_type_id}
                  </span>
                </div>
                <div>
                  <span class="pm-market-result__label">Implementation</span>
                  <span class="pm-market-result__value">
                    {registerTypeTask.data()!.asset_type.implementation_address}
                  </span>
                </div>
                <div class="pm-market-result__detail--full">
                  <span class="pm-market-result__label">Transaction</span>
                  <span class="pm-market-result__value">{registerTypeTask.data()!.tx_hash}</span>
                </div>
              </div>
            </div>
          </Show>

          <Show when={assetTypes().length > 0}>
            <div class="pm-asset-type-list">
              <div class="pm-asset-type-list__header">
                <p class="pm-market-card__eyebrow">Registered types</p>
                <span class="pm-market-chip">{assetTypes().length} loaded</span>
              </div>

              <div class="pm-asset-type-list__grid">
                <For each={assetTypes()}>
                  {assetType => (
                    <div class="pm-asset-type-list__item">
                      <p class="pm-asset-type-list__title">{assetType.asset_type_name}</p>
                      <p class="pm-asset-type-list__meta">{assetType.asset_type_id}</p>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "create-asset"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin endpoint"
        title="Create asset"
        subtitle="Create the asset, wire catalog metadata, and set initial subscription and redemption pricing."
        size="wide"
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
            <form
              class="pm-market-form"
              ref={createAssetFormRef}
              onSubmit={handleCreateAssetSubmit}
            >
              <div class="pm-market-fields">
                <label class="pm-field">
                  <span class="pm-field__label">Proposal ID</span>
                  <input class="pm-field__input" name="proposal_id" type="text" required />
                </label>

                <label class="pm-field">
                  <span class="pm-field__label">Asset type ID</span>
                  <Show
                    when={assetTypes().length > 0}
                    fallback={
                      <input
                        class="pm-field__input"
                        name="asset_type_id"
                        type="text"
                        placeholder="treasury_fund"
                        value={createSelectedAssetTypeId()}
                        onInput={handleCreateAssetTypeChange}
                        required
                      />
                    }
                  >
                    <select
                      class="pm-field__input"
                      name="asset_type_id"
                      value={createSelectedAssetTypeId()}
                      onChange={handleCreateAssetTypeChange}
                      required
                    >
                      <option value="">Select a registered type</option>
                      <For each={assetTypes()}>
                        {assetType => (
                          <option value={assetType.asset_type_id}>
                            {getAssetTypeLabel(assetType)}
                          </option>
                        )}
                      </For>
                    </select>
                  </Show>
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
                  <span class="pm-field__hint">
                    Input is display asset units. It is converted to 18-decimal base units on
                    submit.
                  </span>
                </label>

                <label class="pm-field">
                  <span class="pm-field__label">Slug</span>
                  <input class="pm-field__input" name="slug" type="text" placeholder="monad-income-fund" />
                </label>

                <label class="pm-field">
                  <span class="pm-field__label">Metadata hash</span>
                  <input class="pm-field__input" name="metadata_hash" type="text" />
                </label>

                <div class="pm-asset-pricing-builder">
                  <div class="pm-asset-pricing-builder__header">
                    <div>
                      <span class="pm-field__label">Pricing input</span>
                      <p class="pm-asset-pricing-builder__copy">
                        Enter asset prices in the market currency for the instrument and let the
                        backend convert them into payment-token base units.
                      </p>
                    </div>

                    <div class="pm-input-mode-toggle" role="group" aria-label="Pricing input mode">
                      <button
                        class={`pm-input-mode-toggle__button${
                          createPricingMode() === "market" ? " pm-input-mode-toggle__button--active" : ""
                        }`}
                        type="button"
                        onClick={() => {
                          setCreatePricingMode("market");
                          clearCreatePricingPreview();
                        }}
                      >
                        Market currency
                      </button>
                      <button
                        class={`pm-input-mode-toggle__button${
                          createPricingMode() === "raw" ? " pm-input-mode-toggle__button--active" : ""
                        }`}
                        type="button"
                        onClick={() => {
                          setCreatePricingMode("raw");
                          clearCreatePricingPreview();
                        }}
                      >
                        Raw base units
                      </button>
                    </div>
                  </div>

                  <Show
                    when={createPricingMode() === "market"}
                    fallback={
                      <div class="pm-market-fields">
                        <label class="pm-field">
                          <span class="pm-field__label">Subscription price base units</span>
                          <input
                            class="pm-field__input"
                            name="subscription_price_raw"
                            type="text"
                            value={createRawSubscriptionPrice()}
                            onInput={event => setCreateRawSubscriptionPrice(event.currentTarget.value)}
                            required
                          />
                        </label>

                        <label class="pm-field">
                          <span class="pm-field__label">Redemption price base units</span>
                          <input
                            class="pm-field__input"
                            name="redemption_price_raw"
                            type="text"
                            value={createRawRedemptionPrice()}
                            onInput={event => setCreateRawRedemptionPrice(event.currentTarget.value)}
                            required
                          />
                        </label>
                      </div>
                    }
                  >
                    <div class="pm-asset-pricing-builder__market">
                      <div class="pm-market-fields">
                        <label class="pm-field">
                          <span class="pm-field__label">Market currency</span>
                          <select
                            class="pm-field__input"
                            name="market_currency"
                            value={createMarketCurrency()}
                            onChange={event => {
                              setCreateMarketCurrency(event.currentTarget.value.toLowerCase());
                              clearCreatePricingPreview();
                            }}
                            required
                          >
                            <For each={createMarketCurrencyOptions()}>
                              {currency => (
                                <option value={currency}>{currency.toUpperCase()}</option>
                              )}
                            </For>
                          </select>
                        </label>

                        <label class="pm-field">
                          <span class="pm-field__label">Subscription price ({createMarketCurrency().toUpperCase() || "MARKET"})</span>
                          <input
                            class="pm-field__input"
                            name="subscription_price_market"
                            type="text"
                            inputMode="decimal"
                            value={createMarketSubscriptionPrice()}
                            onInput={event => {
                              setCreateMarketSubscriptionPrice(event.currentTarget.value);
                              clearCreatePricingPreview();
                            }}
                            required
                          />
                        </label>

                        <label class="pm-field">
                          <span class="pm-field__label">Redemption price ({createMarketCurrency().toUpperCase() || "MARKET"})</span>
                          <input
                            class="pm-field__input"
                            name="redemption_price_market"
                            type="text"
                            inputMode="decimal"
                            value={createMarketRedemptionPrice()}
                            onInput={event => {
                              setCreateMarketRedemptionPrice(event.currentTarget.value);
                              clearCreatePricingPreview();
                            }}
                            required
                          />
                        </label>
                      </div>

                      <div class="pm-market-actions pm-market-actions--group">
                        <button
                          class="pm-button pm-button--ghost"
                          type="button"
                          disabled={createPricingQuoteTask.pending()}
                          onClick={() => void previewCreatePricingQuote()}
                        >
                          {createPricingQuoteTask.pending() ? "Quoting..." : "Preview conversion"}
                        </button>
                        <button
                          class="pm-button pm-button--ghost"
                          type="button"
                          disabled={supportedCurrenciesTask.pending()}
                          onClick={() => void refreshSupportedCurrencies()}
                        >
                          {supportedCurrenciesTask.pending() ? "Loading currencies..." : "Refresh currencies"}
                        </button>
                        <Show when={selectedCreateAssetType()}>
                          {assetType => (
                            <span class="pm-market-chip">
                              Suggested currency{" "}
                              {(inferMarketCurrencyFromAssetType(assetType()) ?? createMarketCurrency()).toUpperCase()}
                            </span>
                          )}
                        </Show>
                      </div>

                      <Show when={createPricingQuoteTask.data()}>
                        {quote => (
                          <div class="pm-asset-pricing-quote">
                            <div class="pm-asset-pricing-quote__header">
                              <div>
                                <p class="pm-market-card__eyebrow">Market quote</p>
                                <h3 class="pm-market-card__title">
                                  1 {quote().payment_token_symbol} = {quote().market_currency_per_payment_token} {quote().market_currency.toUpperCase()}
                                </h3>
                              </div>
                              <div class="pm-asset-modal__chips">
                                <span class="pm-market-chip">{quote().payment_token_symbol}</span>
                                <Show when={formatUnixTimestamp(quote().last_updated_at)}>
                                  {timestamp => <span class="pm-market-chip">Updated {timestamp()}</span>}
                                </Show>
                              </div>
                            </div>

                            <div class="pm-market-result__grid">
                              <Show when={quote().subscription_price}>
                                {amountQuote => (
                                  <div>
                                    <span class="pm-market-result__label">Subscription base units</span>
                                    <span class="pm-market-result__value">
                                      {amountQuote().payment_token_base_units}
                                    </span>
                                  </div>
                                )}
                              </Show>

                              <Show when={quote().subscription_price}>
                                {amountQuote => (
                                  <div>
                                    <span class="pm-market-result__label">Subscription payment token amount</span>
                                    <span class="pm-market-result__value">
                                      {amountQuote().payment_token_amount} {quote().payment_token_symbol}
                                    </span>
                                  </div>
                                )}
                              </Show>

                              <Show when={quote().redemption_price}>
                                {amountQuote => (
                                  <div>
                                    <span class="pm-market-result__label">Redemption base units</span>
                                    <span class="pm-market-result__value">
                                      {amountQuote().payment_token_base_units}
                                    </span>
                                  </div>
                                )}
                              </Show>

                              <Show when={quote().redemption_price}>
                                {amountQuote => (
                                  <div>
                                    <span class="pm-market-result__label">Redemption payment token amount</span>
                                    <span class="pm-market-result__value">
                                      {amountQuote().payment_token_amount} {quote().payment_token_symbol}
                                    </span>
                                  </div>
                                )}
                              </Show>
                            </div>
                          </div>
                        )}
                      </Show>
                    </div>
                  </Show>
                </div>

                <div class="pm-asset-image-upload">
                  <label class="pm-field">
                    <span class="pm-field__label">Asset image</span>
                    <input
                      class="pm-field__input"
                      name="image_file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
                      onChange={handleCreateImageSelection}
                    />
                  </label>

                  <p class="pm-market-feedback">
                    The file uploads to `POST /admin/uploads/images` with the `assets` scope when
                    you submit this form. Allowed types match the backend and the size limit is 10 MB.
                  </p>

                  <Show when={createImageFile()}>
                    {file => (
                      <div class="pm-asset-image-upload__panel">
                        <div class="pm-asset-image-upload__copy">
                          <p class="pm-asset-image-upload__title">{file().name}</p>
                          <p class="pm-asset-image-upload__meta">
                            {formatFileSize(file().size)}
                            {uploadedCreateImage()
                              ? " • uploaded to asset storage"
                              : " • uploads automatically on create"}
                          </p>

                          <Show when={uploadedCreateImage()}>
                            {asset => (
                              <div class="pm-asset-image-upload__links">
                                <a
                                  class="pm-market-result__link"
                                  href={asset().gateway_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Gateway URL
                                </a>
                                <a
                                  class="pm-market-result__link"
                                  href={asset().ipfs_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  IPFS URL
                                </a>
                              </div>
                            )}
                          </Show>
                        </div>

                        <Show when={createImagePreviewUrl()}>
                          {previewUrl => (
                            <div class="pm-asset-image-upload__preview">
                              <img src={previewUrl()} alt="Selected asset preview" />
                            </div>
                          )}
                        </Show>
                      </div>
                    )}
                  </Show>

                  <label class="pm-field">
                    <span class="pm-field__label">External image URL</span>
                    <input
                      class="pm-field__input"
                      name="external_image_url"
                      type="url"
                      placeholder="Optional fallback if you already host the image"
                    />
                  </label>
                </div>

                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Summary</span>
                  <textarea class="pm-field__textarea" name="summary" rows="4" />
                </label>

                <label class="pm-field">
                  <span class="pm-field__label">Market segment</span>
                  <input
                    class="pm-field__input"
                    name="market_segment"
                    type="text"
                    placeholder="Sovereign money market"
                  />
                </label>

                <label class="pm-field">
                  <span class="pm-field__label">Suggested internal tags</span>
                  <textarea
                    class="pm-field__textarea"
                    name="suggested_internal_tags"
                    rows="3"
                    placeholder="sovereign, money-market, ngn, short-duration"
                  />
                </label>

                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Sources</span>
                  <textarea
                    class="pm-field__textarea"
                    name="sources"
                    rows="4"
                    placeholder={"https://example.com/source-one\nhttps://example.com/source-two"}
                  />
                </label>

                <div class="pm-asset-flags">
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
              </div>

              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={createAssetTask.pending() || createAssetImageUploadTask.pending()}
                >
                  {createAssetImageUploadTask.pending()
                    ? "Uploading image..."
                    : createAssetTask.pending()
                      ? "Creating..."
                      : "Create asset"}
                </button>
              </div>
            </form>
          </AdminGate>

          <Show when={createPricingQuoteError()}>
            <p class="pm-market-feedback pm-market-feedback--error">{createPricingQuoteError()}</p>
          </Show>

          <Show when={createImageUploadError()}>
            <p class="pm-market-feedback pm-market-feedback--error">{createImageUploadError()}</p>
          </Show>

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
                <span class="pm-market-result__badge">
                  {createAssetTask.data()!.asset.asset_state_label}
                </span>
              </div>

              <div class="pm-market-result__grid">
                <div>
                  <span class="pm-market-result__label">Asset address</span>
                  <span class="pm-market-result__value">
                    {createAssetTask.data()!.asset.asset_address}
                  </span>
                </div>
                <div>
                  <span class="pm-market-result__label">Symbol</span>
                  <span class="pm-market-result__value">{createAssetTask.data()!.asset.symbol}</span>
                </div>
                <div>
                  <span class="pm-market-result__label">Market segment</span>
                  <span class="pm-market-result__value">
                    {createAssetTask.data()!.asset.market_segment ?? "Not set"}
                  </span>
                </div>
                <div>
                  <span class="pm-market-result__label">Subscription price</span>
                  <span class="pm-market-result__value">
                    {formatPaymentTokenAmountFromBaseUnits(
                      createAssetTask.data()!.asset.price_per_token,
                      DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
                    )}
                  </span>
                  <span class="pm-market-result__subvalue">
                    {formatBaseUnitsLabel(createAssetTask.data()!.asset.price_per_token)}
                  </span>
                </div>
                <div>
                  <span class="pm-market-result__label">Redemption price</span>
                  <span class="pm-market-result__value">
                    {formatPaymentTokenAmountFromBaseUnits(
                      createAssetTask.data()!.asset.redemption_price_per_token,
                      DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
                    )}
                  </span>
                  <span class="pm-market-result__subvalue">
                    {formatBaseUnitsLabel(createAssetTask.data()!.asset.redemption_price_per_token)}
                  </span>
                </div>
                <div>
                  <span class="pm-market-result__label">Transaction</span>
                  <span class="pm-market-result__value">{createAssetTask.data()!.tx_hash}</span>
                </div>
                <div>
                  <span class="pm-market-result__label">Last updated</span>
                  <span class="pm-market-result__value">
                    {formatTimestamp(createAssetTask.data()!.asset.updated_at)}
                  </span>
                </div>
                <div class="pm-market-result__detail--full">
                  <span class="pm-market-result__label">Suggested internal tags</span>
                  <span class="pm-market-result__value">
                    {createAssetTask.data()!.asset.suggested_internal_tags.length > 0
                      ? createAssetTask.data()!.asset.suggested_internal_tags.join(", ")
                      : "None"}
                  </span>
                </div>
                <div class="pm-market-result__detail--full">
                  <span class="pm-market-result__label">Sources</span>
                  <span class="pm-market-result__value">
                    {createAssetTask.data()!.asset.sources.length > 0
                      ? createAssetTask.data()!.asset.sources.join(", ")
                      : "None"}
                  </span>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </AdminModal>

      <AdminModal
        open={activeModal() === "pricing"}
        onClose={() => setActiveModal(null)}
        eyebrow="Admin endpoint"
        title="Update pricing"
        subtitle="Set new subscription and redemption pricing for an existing asset."
      >
        <div class="pm-asset-modal-stack">
          <AdminGate
            connected={isAdminConnected()}
            walletLabel={adminWalletLabel()}
            onConnect={auth.openAuthDialog}
          >
            <form class="pm-market-form" onSubmit={handlePricingSubmit}>
              <div class="pm-market-fields">
                <label class="pm-field pm-field--full">
                  <span class="pm-field__label">Asset address</span>
                  <input
                    class="pm-field__input"
                    name="asset_address"
                    type="text"
                    value={pricingDraft().asset_address}
                    required
                  />
                </label>

                <label class="pm-field">
                  <span class="pm-field__label">Subscription price</span>
                  <input
                    class="pm-field__input"
                    name="subscription_price"
                    type="text"
                    value={pricingDraft().subscription_price}
                    required
                  />
                </label>

                <label class="pm-field">
                  <span class="pm-field__label">Redemption price</span>
                  <input
                    class="pm-field__input"
                    name="redemption_price"
                    type="text"
                    value={pricingDraft().redemption_price}
                    required
                  />
                </label>
              </div>

              <div class="pm-market-actions">
                <button
                  class="pm-button pm-button--primary"
                  type="submit"
                  disabled={setPricingTask.pending()}
                >
                  {setPricingTask.pending() ? "Saving..." : "Set pricing"}
                </button>
              </div>
            </form>
          </AdminGate>

          <Show when={pricingError()}>
            <p class="pm-market-feedback pm-market-feedback--error">{pricingError()}</p>
          </Show>

          <Show when={setPricingTask.data()}>
            <div class="pm-market-result">
              <div class="pm-market-result__header">
                <div>
                  <p class="pm-market-result__eyebrow">Updated</p>
                  <h3 class="pm-market-result__title">
                    {setPricingTask.data()!.asset.name}
                  </h3>
                </div>
                <span class="pm-market-result__badge">
                  {setPricingTask.data()!.asset.asset_state_label}
                </span>
              </div>

              <div class="pm-market-result__grid">
                <div>
                  <span class="pm-market-result__label">Subscription price</span>
                  <span class="pm-market-result__value">
                    {formatPaymentTokenAmountFromBaseUnits(
                      setPricingTask.data()!.asset.price_per_token,
                      DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
                    )}
                  </span>
                  <span class="pm-market-result__subvalue">
                    {formatBaseUnitsLabel(setPricingTask.data()!.asset.price_per_token)}
                  </span>
                </div>
                <div>
                  <span class="pm-market-result__label">Redemption price</span>
                  <span class="pm-market-result__value">
                    {formatPaymentTokenAmountFromBaseUnits(
                      setPricingTask.data()!.asset.redemption_price_per_token,
                      DEFAULT_PAYMENT_TOKEN_DISPLAY_META,
                    )}
                  </span>
                  <span class="pm-market-result__subvalue">
                    {formatBaseUnitsLabel(setPricingTask.data()!.asset.redemption_price_per_token)}
                  </span>
                </div>
                <div class="pm-market-result__detail--full">
                  <span class="pm-market-result__label">Transaction</span>
                  <span class="pm-market-result__value">{setPricingTask.data()!.tx_hash}</span>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </AdminModal>
    </>
  );
}
