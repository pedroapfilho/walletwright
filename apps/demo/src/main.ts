import { getWallets } from "@wallet-standard/app";

type Eip1193Provider = {
  request: (args: { method: string; params?: Array<unknown> }) => Promise<unknown>;
};

type SolanaProvider = {
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
};

type PhantomWindow = {
  ethereum?: Eip1193Provider;
  solana?: SolanaProvider;
};

const $ = <T extends HTMLElement>(id: string): T => document.querySelector<T>(id)!;

// Injected providers appear asynchronously (the wallet's content script injects them after load),
// so poll briefly before giving up.
const waitFor = async <T>(get: () => T | undefined): Promise<T> => {
  for (let i = 0; i < 50; i++) {
    const value = get();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Provider not found");
};

const toHex = (bytes: Uint8Array): string =>
  `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

// --- MetaMask (EVM, window.ethereum) ---
const getEthereum = () => waitFor(() => (window as { ethereum?: Eip1193Provider }).ethereum);
let mmAccount = "";

// A rejected request rejects the provider promise, so surface it: a test asserting on a rejection
// needs something to read, and an unhandled rejection would look like nothing happened.
// Wallets reject with an EIP-1193 error object ({ code: 4001, message }) rather than an Error, so
// `String(error)` would render "[object Object]".
const showError = (error: unknown, target = "#error") => {
  const { message } = (error ?? {}) as { message?: string };
  $(target).textContent = error instanceof Error ? error.message : (message ?? String(error));
};

const handleConnect = async () => {
  $("#error").textContent = "";
  try {
    const accounts = (await (
      await getEthereum()
    ).request({ method: "eth_requestAccounts" })) as Array<string>;
    mmAccount = accounts[0] ?? "";
    $("#accounts").textContent = mmAccount;
    $<HTMLButtonElement>("#signButton").disabled = mmAccount === "";
  } catch (error) {
    showError(error);
  }
};

const handleSign = async () => {
  $("#error").textContent = "";
  try {
    const signature = (await (
      await getEthereum()
    ).request({
      method: "personal_sign",
      params: [$<HTMLInputElement>("#message").value, mmAccount],
    })) as string;
    $("#signature").textContent = signature;
  } catch (error) {
    showError(error);
  }
};

// A local dev chain (anvil/hardhat defaults), for the network and transaction recipes.
const LOCAL_CHAIN = {
  chainId: "0x7a69",
  chainName: "Walletwright Local",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: ["http://127.0.0.1:8545"],
};

const refreshChainId = async () => {
  const chainId = (await (await getEthereum()).request({ method: "eth_chainId" })) as string;
  $("#chainId").textContent = chainId;
};

// `wallet_addEthereumChain` rather than EIP-3326 `wallet_switchEthereumChain`: it is idempotent
// (adds when missing, switches when present), and in MetaMask 13.x a bare switch request to a
// wallet-added custom chain hangs with no popup and no error.
const handleSwitchChain = async () => {
  $("#error").textContent = "";
  try {
    await (
      await getEthereum()
    ).request({ method: "wallet_addEthereumChain", params: [LOCAL_CHAIN] });
    await refreshChainId();
  } catch (error) {
    showError(error);
  }
};

// --- Phantom EVM (window.phantom.ethereum) ---
const getPhantomEvm = () =>
  waitFor(() => (window as { phantom?: PhantomWindow }).phantom?.ethereum);
let phantomEvmAccount = "";

const handlePhantomEvmConnect = async () => {
  $("#phantomEvmError").textContent = "";
  try {
    const accounts = (await (
      await getPhantomEvm()
    ).request({ method: "eth_requestAccounts" })) as Array<string>;
    phantomEvmAccount = accounts[0] ?? "";
    $("#phantomEvmAccount").textContent = phantomEvmAccount;
    $<HTMLButtonElement>("#phantomEvmSign").disabled = phantomEvmAccount === "";
  } catch (error) {
    showError(error, "#phantomEvmError");
  }
};

const handlePhantomEvmSign = async () => {
  const signature = (await (
    await getPhantomEvm()
  ).request({
    method: "personal_sign",
    params: ["Hello Phantom EVM", phantomEvmAccount],
  })) as string;
  $("#phantomEvmSignature").textContent = signature;
};

// --- Phantom Solana / SVM (window.phantom.solana) ---
const getPhantomSolana = () =>
  waitFor(() => (window as { phantom?: PhantomWindow }).phantom?.solana);

const handlePhantomSvmConnect = async () => {
  const { publicKey } = await (await getPhantomSolana()).connect();
  $("#phantomSvmAccount").textContent = publicKey.toString();
  $<HTMLButtonElement>("#phantomSvmSign").disabled = false;
};

const handlePhantomSvmSign = async () => {
  const message = new TextEncoder().encode("Hello Phantom Solana");
  const { signature } = await (await getPhantomSolana()).signMessage(message, "utf8");
  $("#phantomSvmSignature").textContent = toHex(signature);
};

// --- MetaMask Solana (Wallet Standard, solana:* features) ---
type SolanaStandardAccount = { address: string; publicKey: Uint8Array };
type SolanaStandardWallet = {
  accounts: ReadonlyArray<SolanaStandardAccount>;
  chains: ReadonlyArray<string>;
  features: Record<string, unknown>;
  name: string;
};

const getMetamaskSolana = () =>
  waitFor(
    () =>
      getWallets()
        .get()
        .find(
          (wallet) =>
            wallet.name === "MetaMask" &&
            (wallet as SolanaStandardWallet).chains.some((chain) => chain.startsWith("solana:")),
        ) as SolanaStandardWallet | undefined,
  );

let mmSvmAccount: SolanaStandardAccount | undefined;

const handleMmSvmConnect = async () => {
  const wallet = await getMetamaskSolana();
  const feature = wallet.features["standard:connect"] as {
    connect: () => Promise<{ accounts: ReadonlyArray<SolanaStandardAccount> }>;
  };
  const { accounts } = await feature.connect();
  mmSvmAccount = accounts[0];
  $("#mmSvmAccount").textContent = mmSvmAccount?.address ?? "";
  $<HTMLButtonElement>("#mmSvmSign").disabled = !mmSvmAccount;
};

const handleMmSvmSign = async () => {
  const wallet = await getMetamaskSolana();
  const feature = wallet.features["solana:signMessage"] as {
    signMessage: (input: {
      account: SolanaStandardAccount;
      message: Uint8Array;
    }) => Promise<ReadonlyArray<{ signature: Uint8Array }>>;
  };
  const [output] = await feature.signMessage({
    account: mmSvmAccount as SolanaStandardAccount,
    message: new TextEncoder().encode("Hello walletwright Solana"),
  });
  $("#mmSvmSignature").textContent = toHex(output?.signature ?? new Uint8Array());
};

// --- Slush / Sui (Wallet Standard, sui:* features) ---
type SuiAccount = { address: string };
type StandardWallet = {
  accounts: ReadonlyArray<SuiAccount>;
  chains: ReadonlyArray<string>;
  features: Record<string, unknown>;
  name: string;
};

const getSuiWallet = () =>
  waitFor(
    () =>
      getWallets()
        .get()
        .find((wallet) =>
          (wallet as StandardWallet).chains.some((chain) => chain.startsWith("sui:")),
        ) as StandardWallet | undefined,
  );

let suiAccount: SuiAccount | undefined;

const handleSuiConnect = async () => {
  const wallet = await getSuiWallet();
  const feature = wallet.features["standard:connect"] as {
    connect: () => Promise<{ accounts: ReadonlyArray<SuiAccount> }>;
  };
  const { accounts } = await feature.connect();
  suiAccount = accounts[0];
  $("#suiAccount").textContent = suiAccount?.address ?? "";
  $<HTMLButtonElement>("#suiSign").disabled = !suiAccount;
};

const handleSuiSign = async () => {
  const wallet = await getSuiWallet();
  const feature = wallet.features["sui:signPersonalMessage"] as {
    signPersonalMessage: (input: {
      account: SuiAccount;
      message: Uint8Array;
    }) => Promise<{ signature: string }>;
  };
  const { signature } = await feature.signPersonalMessage({
    account: suiAccount as SuiAccount,
    message: new TextEncoder().encode("Hello walletwright Sui"),
  });
  $("#suiSignature").textContent = signature;
};

$("#connectButton").addEventListener("click", handleConnect);
$("#signButton").addEventListener("click", handleSign);
const handleSendTx = async () => {
  $("#error").textContent = "";
  try {
    const hash = (await (
      await getEthereum()
    ).request({
      method: "eth_sendTransaction",
      params: [
        {
          from: mmAccount,
          // 0.001 ETH to the second anvil test account.
          to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          value: "0x38d7ea4c68000",
        },
      ],
    })) as string;
    $("#txHash").textContent = hash;
  } catch (error) {
    showError(error);
  }
};

$("#switchChainButton").addEventListener("click", handleSwitchChain);
$("#sendTxButton").addEventListener("click", handleSendTx);
$("#phantomEvmConnect").addEventListener("click", handlePhantomEvmConnect);
$("#phantomEvmSign").addEventListener("click", handlePhantomEvmSign);
$("#phantomSvmConnect").addEventListener("click", handlePhantomSvmConnect);
$("#phantomSvmSign").addEventListener("click", handlePhantomSvmSign);
$("#mmSvmConnect").addEventListener("click", handleMmSvmConnect);
$("#mmSvmSign").addEventListener("click", handleMmSvmSign);
$("#suiConnect").addEventListener("click", handleSuiConnect);
$("#suiSign").addEventListener("click", handleSuiSign);
