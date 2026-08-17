import { toErrorMessage } from "./error-message";
import { connectStandard, findStandardWallet } from "./wallet-standard";
import type { StandardAccount, StandardWallet } from "./wallet-standard";

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

const getEthereum = () => waitFor(() => (window as { ethereum?: Eip1193Provider }).ethereum);
let mmAccount = "";

const showError = (error: unknown, target = "#error") => {
  $(target).textContent = toErrorMessage(error);
};

type SectionSlots = { account: string; sign: string; signature: string };

/**
 * Render a section from its account, on success and on failure alike. Writing these slots only on
 * success left the previous address on screen, and the sign button enabled, beside a fresh rejection;
 * `metamask-solana.spec.ts` and `slush.spec.ts` already assert the opposite and pass only because
 * every test starts from a fresh page load.
 */
const renderAccount = (slots: SectionSlots, account: string) => {
  $(slots.account).textContent = account;
  $(slots.signature).textContent = "";
  $<HTMLButtonElement>(slots.sign).disabled = account === "";
};

const MM_SLOTS: SectionSlots = {
  account: "#accounts",
  sign: "#signButton",
  signature: "#signature",
};

const handleConnect = async () => {
  $("#error").textContent = "";
  try {
    const accounts = (await (
      await getEthereum()
    ).request({ method: "eth_requestAccounts" })) as Array<string>;
    mmAccount = accounts[0] ?? "";
  } catch (error) {
    mmAccount = "";
    showError(error);
  }
  renderAccount(MM_SLOTS, mmAccount);
  $("#txHash").textContent = "";
};

const handleSign = async () => {
  $("#error").textContent = "";
  $("#signature").textContent = "";
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

const handleSendTx = async () => {
  $("#error").textContent = "";
  $("#txHash").textContent = "";
  try {
    const hash = (await (
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
    })) as string;
    $("#txHash").textContent = hash;
  } catch (error) {
    showError(error);
  }
};

const getPhantomEvm = () =>
  waitFor(() => (window as { phantom?: PhantomWindow }).phantom?.ethereum);
let phantomEvmAccount = "";

const PHANTOM_EVM_SLOTS: SectionSlots = {
  account: "#phantomEvmAccount",
  sign: "#phantomEvmSign",
  signature: "#phantomEvmSignature",
};

const handlePhantomEvmConnect = async () => {
  $("#phantomEvmError").textContent = "";
  try {
    const accounts = (await (
      await getPhantomEvm()
    ).request({ method: "eth_requestAccounts" })) as Array<string>;
    phantomEvmAccount = accounts[0] ?? "";
  } catch (error) {
    phantomEvmAccount = "";
    showError(error, "#phantomEvmError");
  }
  renderAccount(PHANTOM_EVM_SLOTS, phantomEvmAccount);
};

const handlePhantomEvmSign = async () => {
  $("#phantomEvmError").textContent = "";
  $("#phantomEvmSignature").textContent = "";
  try {
    const signature = (await (
      await getPhantomEvm()
    ).request({
      method: "personal_sign",
      params: ["Hello Phantom EVM", phantomEvmAccount],
    })) as string;
    $("#phantomEvmSignature").textContent = signature;
  } catch (error) {
    showError(error, "#phantomEvmError");
  }
};

const getPhantomSolana = () =>
  waitFor(() => (window as { phantom?: PhantomWindow }).phantom?.solana);

const PHANTOM_SVM_SLOTS: SectionSlots = {
  account: "#phantomSvmAccount",
  sign: "#phantomSvmSign",
  signature: "#phantomSvmSignature",
};
let phantomSvmAccount = "";

const handlePhantomSvmConnect = async () => {
  $("#phantomSvmError").textContent = "";
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
  $("#phantomSvmError").textContent = "";
  $("#phantomSvmSignature").textContent = "";
  try {
    const message = new TextEncoder().encode("Hello Phantom Solana");
    const { signature } = await (await getPhantomSolana()).signMessage(message, "utf8");
    $("#phantomSvmSignature").textContent = toHex(signature);
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
    $(ids.error).textContent = "";
    try {
      connected = await connectStandard(await getWallet());
    } catch (error) {
      connected = undefined;
      showError(error, ids.error);
    }
    renderAccount(ids, connected?.address ?? "");
  };

  const handleSectionSign = async () => {
    $(ids.error).textContent = "";
    $(ids.signature).textContent = "";
    try {
      const account = connected;
      if (!account) {
        throw new Error(`connect ${label} before signing`);
      }
      $(ids.signature).textContent = await sign(await getWallet(), account);
    } catch (error) {
      showError(error, ids.error);
    }
  };

  $(ids.connect).addEventListener("click", handleSectionConnect);
  $(ids.sign).addEventListener("click", handleSectionSign);
};

$("#connectButton").addEventListener("click", handleConnect);
$("#signButton").addEventListener("click", handleSign);
$("#switchChainButton").addEventListener("click", handleSwitchChain);
$("#sendTxButton").addEventListener("click", handleSendTx);
$("#phantomEvmConnect").addEventListener("click", handlePhantomEvmConnect);
$("#phantomEvmSign").addEventListener("click", handlePhantomEvmSign);
$("#phantomSvmConnect").addEventListener("click", handlePhantomSvmConnect);
$("#phantomSvmSign").addEventListener("click", handlePhantomSvmSign);

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
