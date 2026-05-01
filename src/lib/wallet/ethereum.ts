export interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export interface InjectedWallet {
  id: string;
  name: string;
  provider: EthereumProvider;
}

export function getInjectedEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined" || !("ethereum" in window)) {
    return null;
  }

  const ethereum = (window as { ethereum?: unknown }).ethereum;

  if (!ethereum || typeof ethereum !== "object") {
    return null;
  }

  return ethereum as EthereumProvider;
}

export function discoverInjectedWallets(): InjectedWallet[] {
  const provider = getInjectedEthereumProvider();
  
  if (!provider) {
    return [];
  }

  return [
    {
      id: "injected",
      name: "Browser Wallet",
      provider,
    },
  ];
}

export async function requestWalletAccount(
  provider: EthereumProvider | null = getInjectedEthereumProvider(),
): Promise<string> {
  const accounts = await requestEthereumAccounts(provider);
  
  if (accounts.length === 0) {
    throw new Error("No accounts found.");
  }

  return accounts[0];
}

export async function requestEthereumAccounts(
  provider: EthereumProvider | null = getInjectedEthereumProvider(),
): Promise<string[]> {
  if (!provider) {
    throw new Error("No Ethereum provider found.");
  }

  const accounts = await provider.request({
    method: "eth_requestAccounts",
  });

  if (!Array.isArray(accounts)) {
    throw new Error("Invalid accounts response from provider.");
  }

  return accounts.filter((account): account is string => typeof account === "string");
}

export async function signPersonalMessage(
  message: string,
  account: string,
  provider: EthereumProvider | null = getInjectedEthereumProvider(),
): Promise<string> {
  if (!provider) {
    throw new Error("No Ethereum provider found.");
  }

  const signature = await provider.request({
    method: "personal_sign",
    params: [message, account],
  });

  if (typeof signature !== "string") {
    throw new Error("Invalid signature response from provider.");
  }

  return signature;
}

export function shortenWalletAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
