export interface MarketClientOptions {
  baseUrl?: string;
}

export interface PaymentTokenQuoteQuery {
  market_currency?: string | null;
  amount?: string | null;
  subscription_price?: string | null;
  redemption_price?: string | null;
}

export interface MarketAmountQuote {
  market_currency_amount: string;
  payment_token_amount: string;
  payment_token_base_units: string;
}

export interface PaymentTokenQuoteResponse {
  market_currency: string;
  payment_token_coin_id: string;
  payment_token_address: string;
  payment_token_symbol: string;
  payment_token_decimals: number;
  market_currency_per_payment_token: string;
  usd_per_payment_token: string;
  last_updated_at: number | null;
  amount: MarketAmountQuote | null;
  subscription_price: MarketAmountQuote | null;
  redemption_price: MarketAmountQuote | null;
}

export interface SupportedMarketCurrenciesResponse {
  supported_currencies: string[];
}
