import { clicksFor } from "../../internal/click";

const METAMASK = "MetaMask";

const { click, clickIfShown, waitShown } = clicksFor(METAMASK);

export { click, clickIfShown, METAMASK, waitShown };
