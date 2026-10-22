const relay = async (event) => {
  if (event.source !== window || event.data?.standin !== "request") {
    return;
  }

  const answer = await chrome.runtime.sendMessage({ mode: event.data.mode, type: "request" });
  window.postMessage({ answer, standin: "answer" }, window.location.origin);
};

globalThis.addEventListener("message", (event) => {
  void relay(event);
});
