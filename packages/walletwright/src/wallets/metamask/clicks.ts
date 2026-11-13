import { clicksFor } from "../../internal/click";

const METAMASK = "MetaMask";

const { click, clickIfShown, waitGone, waitShown } = clicksFor(METAMASK);

export { click, clickIfShown, METAMASK, waitGone, waitShown };
