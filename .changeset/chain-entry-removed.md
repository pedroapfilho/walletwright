---
"@walletwright/core": minor
---

**Breaking.** `@walletwright/core/chain` is gone, and the optional `prool` peer dependency with it. `createLocalChain()` passed its options to prool's `Instance.anvil` and returned the URL, nothing else, and nothing in this repository ran on it: the demo suite and CI start `anvil` themselves.

Migrating: start the node yourself. `anvil` with no arguments serves what `createLocalChain()` defaulted to (`http://127.0.0.1:8545`, chain id 31337, the public test mnemonic). To keep starting it from the suite, call prool directly and keep `prool` in your own `devDependencies`:

```ts
import { Instance } from "prool";

const anvil = Instance.anvil({ chainId: 31_337, port: 8545 });
await anvil.start();
const rpcUrl = `http://${anvil.host}:${anvil.port}`;
// … run tests against it …
await anvil.stop();
```
