const ROUTE_AFTER_MS = 1500;
const IDLE_FOR_MS = 8000;

const main = document.querySelector("main");
const params = new URLSearchParams(document.location.search);
const id = params.get("request");

const heading = (text) => {
  const element = document.createElement("h1");
  element.textContent = text;
  return element;
};

const button = (label, { disabled = false, onClick } = {}) => {
  const element = document.createElement("button");
  element.textContent = label;
  element.disabled = disabled;
  if (onClick) {
    element.addEventListener("click", onClick);
  }
  return element;
};

const answer = async (value) => {
  await chrome.runtime.sendMessage({ answer: value, id, type: "answer" });
  window.close();
};

const showRequest = ({ disabled = false } = {}) => {
  window.location.hash = "#/request";
  main.replaceChildren(
    heading("Request"),
    button("Approve", { disabled, onClick: () => answer("approved") }),
    button("Reject", { disabled, onClick: () => answer("rejected") }),
  );
};

/**
 * `late` stays an empty shell before routing, `idle` shows the wallet's home (a button, but no
 * request) before routing, and `respawn` keeps its buttons disabled until the background replaces it.
 */
const mode = params.get("mode");
if (mode === "late") {
  setTimeout(showRequest, ROUTE_AFTER_MS);
} else if (mode === "idle") {
  main.replaceChildren(heading("Home"), button("Send"));
  setTimeout(showRequest, IDLE_FOR_MS);
} else {
  showRequest({ disabled: mode === "respawn" });
}
