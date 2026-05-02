import { normalizeApiBaseUrl, readApiBaseUrlFromEnv, requestJson } from "../api.ts";

import type {
  MarketClientOptions,
  PaymentTokenQuoteQuery,
  PaymentTokenQuoteResponse,
  SupportedMarketCurrenciesResponse,
} from "./types.ts";

export interface MarketClient {
  fetchPaymentTokenQuote(query?: PaymentTokenQuoteQuery): Promise<PaymentTokenQuoteResponse>;
  fetchSupportedCurrencies(): Promise<SupportedMarketCurrenciesResponse>;
}

export function createMarketClient(options: MarketClientOptions = {}): MarketClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);

  return {
    fetchPaymentTokenQuote(query) {
      return requestJson<PaymentTokenQuoteResponse>(baseUrl, "/market/quotes/payment-token", {
        query,
      });
    },

    fetchSupportedCurrencies() {
      return requestJson<SupportedMarketCurrenciesResponse>(
        baseUrl,
        "/market/supported-currencies",
      );
    },
  };
}

export const marketClient = createMarketClient({
  baseUrl: readApiBaseUrlFromEnv(),
});
