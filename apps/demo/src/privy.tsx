import { PrivyProvider, useLogin, usePrivy, useWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { createRoot } from "react-dom/client";

const appId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

const Dapp = () => {
  const { authenticated, ready, user } = usePrivy();
  const { login } = useLogin();
  const { wallets } = useWallets();
  const [signature, setSignature] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSign = async () => {
    const wallet = wallets[0];
    if (!wallet) {
      setErrorMessage("No connected wallet");
      return;
    }
    try {
      const provider = await wallet.getEthereumProvider();
      const result = await provider.request({
        method: "personal_sign",
        params: ["Hello Privy", wallet.address],
      });
      setSignature(result as string);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  if (!ready) {
    return <p>Loading Privy…</p>;
  }

  return (
    <section>
      <h2>Privy — external wallets (EVM)</h2>
      {authenticated ? (
        <>
          <p>
            Account: <span data-testid="privy-account">{user?.wallet?.address}</span>
          </p>
          <button data-testid="privy-sign" onClick={handleSign} type="button">
            Sign Message
          </button>
          <p>
            Signature: <span data-testid="privy-signature">{signature}</span>
          </p>
        </>
      ) : (
        <button data-testid="privy-login" onClick={() => login()} type="button">
          Log in with Privy
        </button>
      )}
      <p data-testid="privy-error">{errorMessage}</p>
    </section>
  );
};

const App = () => {
  if (!appId) {
    return <p data-testid="privy-missing">Set VITE_PRIVY_APP_ID to enable the Privy section.</p>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // External wallets only: no embedded wallet, no email/social login.
        appearance: { walletList: ["detected_ethereum_wallets"] },
        embeddedWallets: { ethereum: { createOnLogin: "off" } },
        loginMethods: ["wallet"],
      }}
    >
      <Dapp />
    </PrivyProvider>
  );
};

createRoot(document.querySelector("#root")!).render(<App />);
