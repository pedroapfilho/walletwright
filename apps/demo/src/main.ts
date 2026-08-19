import { z } from "zod";

import { toErrorMessage } from "./error-message";
import { connectStandard, findStandardWallet } from "./wallet-standard";
import type { StandardAccount, StandardWallet } from "./wallet-standard";

const jsonSchema = z.json();
const stringSchema = z.string();
const stringArraySchema = z.array(stringSchema);

type JsonValue = z.infer<typeof jsonSchema>;

type Eip1193Provider = {
  request: (args: { method: string; params?: Array<unknown> }) => Promise<JsonValue>;
};

type SolanaProvider = {
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
};

type PhantomWindow = {
  ethereum?: Eip1193Provider;
  solana?: SolanaProvider;
};

type WalletBrowserWindow = {
  ethereum?: Eip1193Provider;
  phantom?: PhantomWindow;
};

const getElement = (selector: string): HTMLElement => {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
};

const getButton = (selector: string): HTMLButtonElement => {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${selector}`);
  }
  return element;
};

const getInput = (selector: string): HTMLInputElement => {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Missing input: ${selector}`);
  }
  return element;
};

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

const getWalletWindow = (): WalletBrowserWindow => {
  return window;
};

const getEthereum = () => waitFor(() => getWalletWindow().ethereum);
let mmAccount = "";

const showError = <Value>(error: Value, target = "#error") => {
  getElement(target).textContent = toErrorMessage(error);
};

type SectionSlots = { account: string; sign: string; signature: string };

const renderAccount = (slots: SectionSlots, account: string) => {
  getElement(slots.account).textContent = account;
  getElement(slots.signature).textContent = "";
  getButton(slots.sign).disabled = account === "";
};

const MM_SLOTS: SectionSlots = {
  account: "#accounts",
  sign: "#signButton",
  signature: "#signature",
};

const handleConnect = async () => {
  getElement("#error").textContent = "";
  try {
    const accounts = stringArraySchema.parse(
      await (await getEthereum()).request({ method: "eth_requestAccounts" }),
    );
    mmAccount = accounts[0] ?? "";
  } catch (error) {
    mmAccount = "";
    showError(error);
  }
  renderAccount(MM_SLOTS, mmAccount);
  getElement("#txHash").textContent = "";
};

const handleSign = async () => {
  getElement("#error").textContent = "";
  getElement("#signature").textContent = "";
  try {
    const signature = stringSchema.parse(
      await (
        await getEthereum()
      ).request({
        method: "personal_sign",
        params: [getInput("#message").value, mmAccount],
      }),
    );
    getElement("#signature").textContent = signature;
  } catch (error) {
    showError(error);
  }
};

const LOCAL_CHAIN = {
  chainId: "0x7a69",
  chainName: "Walletwright Local",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: ["http://127.0.0.1:8545"],
};

const refreshChainId = async () => {
  const chainId = stringSchema.parse(
    await (await getEthereum()).request({ method: "eth_chainId" }),
  );
  getElement("#chainId").textContent = chainId;
};

const handleSwitchChain = async () => {
  getElement("#error").textContent = "";
  try {
    await (
      await getEthereum()
    ).request({ method: "wallet_addEthereumChain", params: [LOCAL_CHAIN] });
    await refreshChainId();
  } catch (error) {
    showError(error);
  }
};

const handleSendTx = async () => {
  getElement("#error").textContent = "";
  getElement("#txHash").textContent = "";
  try {
    const hash = stringSchema.parse(
      await (
        await getEthereum()
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: mmAccount,
            to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            value: "0x38d7ea4c68000",
          },
        ],
      }),
    );
    getElement("#txHash").textContent = hash;
  } catch (error) {
    showError(error);
  }
};

const getPhantomEvm = () => waitFor(() => getWalletWindow().phantom?.ethereum);
let phantomEvmAccount = "";

const PHANTOM_EVM_SLOTS: SectionSlots = {
  account: "#phantomEvmAccount",
  sign: "#phantomEvmSign",
  signature: "#phantomEvmSignature",
};

const handlePhantomEvmConnect = async () => {
  getElement("#phantomEvmError").textContent = "";
  try {
    const accounts = stringArraySchema.parse(
      await (await getPhantomEvm()).request({ method: "eth_requestAccounts" }),
    );
    phantomEvmAccount = accounts[0] ?? "";
  } catch (error) {
    phantomEvmAccount = "";
    showError(error, "#phantomEvmError");
  }
  renderAccount(PHANTOM_EVM_SLOTS, phantomEvmAccount);
};

const handlePhantomEvmSign = async () => {
  getElement("#phantomEvmError").textContent = "";
  getElement("#phantomEvmSignature").textContent = "";
  try {
    const signature = stringSchema.parse(
      await (
        await getPhantomEvm()
      ).request({
        method: "personal_sign",
        params: ["Hello Phantom EVM", phantomEvmAccount],
      }),
    );
    getElement("#phantomEvmSignature").textContent = signature;
  } catch (error) {
    showError(error, "#phantomEvmError");
  }
};

const getPhantomSolana = () => waitFor(() => getWalletWindow().phantom?.solana);

const PHANTOM_SVM_SLOTS: SectionSlots = {
  account: "#phantomSvmAccount",
  sign: "#phantomSvmSign",
  signature: "#phantomSvmSignature",
};
let phantomSvmAccount = "";

const handlePhantomSvmConnect = async () => {
  getElement("#phantomSvmError").textContent = "";
  try {
    const { publicKey } = await (await getPhantomSolana()).connect();
    phantomSvmAccount = publicKey.toString();
  } catch (error) {
    phantomSvmAccount = "";
    showError(error, "#phantomSvmError");
  }
  renderAccount(PHANTOM_SVM_SLOTS, phantomSvmAccount);
};

const handlePhantomSvmSign = async () => {
  getElement("#phantomSvmError").textContent = "";
  getElement("#phantomSvmSignature").textContent = "";
  try {
    const message = new TextEncoder().encode("Hello Phantom Solana");
    const { signature } = await (await getPhantomSolana()).signMessage(message, "utf8");
    getElement("#phantomSvmSignature").textContent = toHex(signature);
  } catch (error) {
    showError(error, "#phantomSvmError");
  }
};

type StandardSection = {
  ids: { account: string; connect: string; error: string; sign: string; signature: string };
  label: string;
  match: (wallet: StandardWallet) => boolean;
  sign: (wallet: StandardWallet, account: StandardAccount) => Promise<string>;
};

const signSolanaMessage = async (
  wallet: StandardWallet,
  account: StandardAccount,
  message: string,
): Promise<string> => {
  // SAFETY: Solana Wallet Standard identifies this feature by name and fixes its method contract.
  const feature = wallet.features["solana:signMessage"] as {
    signMessage: (input: {
      account: StandardAccount;
      message: Uint8Array;
    }) => Promise<ReadonlyArray<{ signature: Uint8Array }>>;
  };
  const [output] = await feature.signMessage({
    account,
    message: new TextEncoder().encode(message),
  });
  if (!output?.signature) {
    throw new Error("solana:signMessage returned no signature");
  }
  return toHex(output.signature);
};

const signSuiMessage = async (
  wallet: StandardWallet,
  account: StandardAccount,
  message: string,
): Promise<string> => {
  // SAFETY: Sui Wallet Standard identifies this feature by name and fixes its method contract.
  const feature = wallet.features["sui:signPersonalMessage"] as {
    signPersonalMessage: (input: {
      account: StandardAccount;
      message: Uint8Array;
    }) => Promise<{ signature: string }>;
  };
  const { signature } = await feature.signPersonalMessage({
    account,
    message: new TextEncoder().encode(message),
  });
  if (typeof signature !== "string" || !signature) {
    throw new Error("sui:signPersonalMessage returned no signature");
  }
  return signature;
};

const wireStandardSection = ({ ids, label, match, sign }: StandardSection): void => {
  const getWallet = () => waitFor(() => findStandardWallet(match));
  let connected: StandardAccount | undefined;

  const handleSectionConnect = async () => {
    getElement(ids.error).textContent = "";
    try {
      connected = await connectStandard(await getWallet());
    } catch (error) {
      connected = undefined;
      showError(error, ids.error);
    }
    renderAccount(ids, connected?.address ?? "");
  };

  const handleSectionSign = async () => {
    getElement(ids.error).textContent = "";
    getElement(ids.signature).textContent = "";
    try {
      const account = connected;
      if (!account) {
        throw new Error(`connect ${label} before signing`);
      }
      getElement(ids.signature).textContent = await sign(await getWallet(), account);
    } catch (error) {
      showError(error, ids.error);
    }
  };

  getElement(ids.connect).addEventListener("click", handleSectionConnect);
  getElement(ids.sign).addEventListener("click", handleSectionSign);
};

getElement("#connectButton").addEventListener("click", handleConnect);
getElement("#signButton").addEventListener("click", handleSign);
getElement("#switchChainButton").addEventListener("click", handleSwitchChain);
getElement("#sendTxButton").addEventListener("click", handleSendTx);
getElement("#phantomEvmConnect").addEventListener("click", handlePhantomEvmConnect);
getElement("#phantomEvmSign").addEventListener("click", handlePhantomEvmSign);
getElement("#phantomSvmConnect").addEventListener("click", handlePhantomSvmConnect);
getElement("#phantomSvmSign").addEventListener("click", handlePhantomSvmSign);

wireStandardSection({
  ids: {
    account: "#mmSvmAccount",
    connect: "#mmSvmConnect",
    error: "#mmSvmError",
    sign: "#mmSvmSign",
    signature: "#mmSvmSignature",
  },
  label: "MetaMask (Solana)",
  match: (wallet) =>
    wallet.name === "MetaMask" && wallet.chains.some((chain) => chain.startsWith("solana:")),
  sign: (wallet, account) => signSolanaMessage(wallet, account, "Hello walletwright Solana"),
});

wireStandardSection({
  ids: {
    account: "#mockSvmAccount",
    connect: "#mockSvmConnect",
    error: "#mockSvmError",
    sign: "#mockSvmSign",
    signature: "#mockSvmSignature",
  },
  label: "Mock (Solana)",
  match: (wallet) =>
    wallet.name !== "MetaMask" && wallet.chains.some((chain) => chain.startsWith("solana:")),
  sign: (wallet, account) => signSolanaMessage(wallet, account, "Hello walletwright Mock Solana"),
});

wireStandardSection({
  ids: {
    account: "#suiAccount",
    connect: "#suiConnect",
    error: "#suiError",
    sign: "#suiSign",
    signature: "#suiSignature",
  },
  label: "Slush (Sui)",
  match: (wallet) => wallet.chains.some((chain) => chain.startsWith("sui:")),
  sign: (wallet, account) => signSuiMessage(wallet, account, "Hello walletwright Sui"),
});
