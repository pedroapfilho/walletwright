import { z } from "zod";

import { LOCAL_CHAIN, LOCAL_CHAIN_HEX, SOLANA_MESSAGE } from "./requests";
import {
  connectStandard,
  findStandardWallet,
  signSolanaMessage,
  signSuiMessage,
  toHex,
} from "./wallet-standard";
import type { StandardAccount, StandardWallet } from "./wallet-standard";

const jsonSchema = z.json();
const stringSchema = z.string();
const stringArraySchema = z.array(stringSchema);

/**
 * Wallets reject with an EIP-1193 error object (`{ code: 4001, message }`), not an `Error`, so
 * `String(error)` renders "[object Object]" for the commonest failure a dapp shows. An `Error` has
 * `.message` too, so reading it first needs no `instanceof` branch.
 */
const errorTextSchema = z
  .object({ message: z.string() })
  .transform(({ message }) => message)
  .or(z.unknown().transform(String));

type JsonValue = z.infer<typeof jsonSchema>;

type Eip1193Provider = {
  request: (args: { method: string; params?: Array<unknown> }) => Promise<JsonValue>;
};

type SolanaProvider = {
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
};

type WalletBrowserWindow = Window & {
  ethereum?: Eip1193Provider;
  phantom?: { ethereum?: Eip1193Provider; solana?: SolanaProvider };
};

/** A connected section: the account it shows, and how it signs as that account. */
type Connection = { address: string; sign: () => Promise<string> };

type SectionIds = {
  account: string;
  connect: string;
  error: string;
  sign: string;
  signature: string;
};

const walletWindow = (): WalletBrowserWindow => window;

const element = <T extends HTMLElement>(selector: string, type: new () => T): T => {
  const found = document.querySelector(selector);

  if (!(found instanceof type)) {
    throw new Error(`Missing element: ${selector}`);
  }

  return found;
};

const show = (selector: string, text: string) => {
  element(selector, HTMLElement).textContent = text;
};

/** Providers inject a moment after the page loads, so a click waits for them briefly. */
const waitFor = async <T>(get: () => T | undefined): Promise<T> => {
  for (let i = 0; i < 50; i++) {
    const value = get();

    if (value !== undefined) {
      return value;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error("Provider not found");
};

const onClick = (selector: string, handler: () => Promise<void>) => {
  element(selector, HTMLButtonElement).addEventListener("click", () => {
    void handler();
  });
};

const wireSection = (
  ids: SectionIds,
  connect: () => Promise<Connection>,
): (() => Connection | undefined) => {
  let connection: Connection | undefined;

  const showAccount = (address: string) => {
    show(ids.account, address);
    show(ids.signature, "");
    element(ids.sign, HTMLButtonElement).disabled = address === "";
  };

  onClick(ids.connect, async () => {
    show(ids.error, "");

    try {
      connection = await connect();
    } catch (error) {
      connection = undefined;
      show(ids.error, errorTextSchema.parse(error));
    }

    showAccount(connection?.address ?? "");
  });

  onClick(ids.sign, async () => {
    show(ids.error, "");
    show(ids.signature, "");

    try {
      if (!connection) {
        throw new Error("connect a wallet before signing");
      }

      show(ids.signature, await connection.sign());
    } catch (error) {
      show(ids.error, errorTextSchema.parse(error));
    }
  });

  return () => connection;
};

const eip1193 =
  (provider: () => Eip1193Provider | undefined, message: () => string) =>
  async (): Promise<Connection> => {
    const ethereum = await waitFor(provider);

    const [address = ""] = stringArraySchema.parse(
      await ethereum.request({ method: "eth_requestAccounts" }),
    );

    return {
      address,
      sign: async () =>
        stringSchema.parse(
          await ethereum.request({ method: "personal_sign", params: [message(), address] }),
        ),
    };
  };

const standard =
  (
    chainPrefix: string,
    sign: (wallet: StandardWallet, account: StandardAccount) => Promise<string>,
  ) =>
  async (): Promise<Connection> => {
    const wallet = await waitFor(() => findStandardWallet(chainPrefix));
    const account = await connectStandard(wallet);

    return { address: account.address, sign: () => sign(wallet, account) };
  };

const evm = wireSection(
  {
    account: "#accounts",
    connect: "#connectButton",
    error: "#error",
    sign: "#signButton",
    signature: "#signature",
  },
  eip1193(
    () => walletWindow().ethereum,
    () => element("#message", HTMLInputElement).value,
  ),
);

/** A request on the `window.ethereum` section's provider, reported in its error slot. */
const onEvmRequest = (selector: string, run: (ethereum: Eip1193Provider) => Promise<void>) => {
  onClick(selector, async () => {
    show("#error", "");

    try {
      await run(await waitFor(() => walletWindow().ethereum));
    } catch (error) {
      show("#error", errorTextSchema.parse(error));
    }
  });
};

onEvmRequest("#switchChainButton", async (ethereum) => {
  await ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: LOCAL_CHAIN_HEX,
        chainName: LOCAL_CHAIN.name,
        nativeCurrency: { decimals: 18, name: "Ether", symbol: LOCAL_CHAIN.symbol },
        rpcUrls: [LOCAL_CHAIN.rpcUrl],
      },
    ],
  });
  show("#chainId", stringSchema.parse(await ethereum.request({ method: "eth_chainId" })));
});

onEvmRequest("#sendTxButton", async (ethereum) => {
  show("#txHash", "");

  const hash = await ethereum.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: evm()?.address ?? "",
        to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        value: "0x38d7ea4c68000",
      },
    ],
  });

  show("#txHash", stringSchema.parse(hash));
});

wireSection(
  {
    account: "#phantomEvmAccount",
    connect: "#phantomEvmConnect",
    error: "#phantomEvmError",
    sign: "#phantomEvmSign",
    signature: "#phantomEvmSignature",
  },
  eip1193(
    () => walletWindow().phantom?.ethereum,
    () => "Hello Phantom EVM",
  ),
);

wireSection(
  {
    account: "#phantomSvmAccount",
    connect: "#phantomSvmConnect",
    error: "#phantomSvmError",
    sign: "#phantomSvmSign",
    signature: "#phantomSvmSignature",
  },
  async () => {
    const solana = await waitFor(() => walletWindow().phantom?.solana);
    const { publicKey } = await solana.connect();

    return {
      address: publicKey.toString(),
      sign: async () => {
        const message = new TextEncoder().encode("Hello Phantom Solana");
        const { signature } = await solana.signMessage(message, "utf8");

        return toHex(signature);
      },
    };
  },
);

wireSection(
  {
    account: "#svmAccount",
    connect: "#svmConnect",
    error: "#svmError",
    sign: "#svmSign",
    signature: "#svmSignature",
  },
  standard("solana:", (wallet, account) => signSolanaMessage(wallet, account, SOLANA_MESSAGE)),
);

wireSection(
  {
    account: "#suiAccount",
    connect: "#suiConnect",
    error: "#suiError",
    sign: "#suiSign",
    signature: "#suiSignature",
  },
  standard("sui:", (wallet, account) => signSuiMessage(wallet, account, "Hello walletwright Sui")),
);
