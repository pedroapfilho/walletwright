const POPUP = { height: 592, type: "popup", width: 360 };
const LATE_NAVIGATION_MS = 1000;
const RESPAWN_AFTER_MS = 1500;

/** Pending requests by id, each holding the reply to the dapp that made it. */
const pending = new Map();

const popupUrl = (id, mode) =>
  chrome.runtime.getURL(`notification.html?request=${id}&mode=${mode}`);

/**
 * `late` opens on `about:blank` and navigates afterwards, like MetaMask's popup. `respawn` is
 * replaced by a fresh window for the same request while its buttons are still disabled.
 */
const openPopup = async (id, mode) => {
  if (mode === "late") {
    const window = await chrome.windows.create({ ...POPUP, url: "about:blank" });
    setTimeout(() => {
      void chrome.tabs.update(window.tabs[0].id, { url: popupUrl(id, mode) });
    }, LATE_NAVIGATION_MS);
    return;
  }
  const window = await chrome.windows.create({ ...POPUP, url: popupUrl(id, mode) });
  if (mode === "respawn") {
    setTimeout(async () => {
      await chrome.windows.remove(window.id);
      await openPopup(id, "ready");
    }, RESPAWN_AFTER_MS);
  }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "request") {
    const id = crypto.randomUUID();
    pending.set(id, sendResponse);
    void openPopup(id, message.mode);
    return true;
  }
  if (message.type === "answer") {
    pending.get(message.id)?.(message.answer);
    pending.delete(message.id);
    sendResponse(true);
  }
  return false;
});
