/** Longer than the engine's quiet window, so a build that took silence for durability would lose it. */
const PERSIST_LATE_MS = 3000;

const main = document.querySelector("main");

const seedPhrase = document.createElement("textarea");

seedPhrase.setAttribute("aria-label", "Secret recovery phrase");

const password = document.createElement("input");

password.type = "password";

password.setAttribute("aria-label", "Password");

const submit = document.createElement("button");

submit.textContent = "Import";

const form = document.createElement("form");

form.append(seedPhrase, password, submit);

const showReady = () => {
  const ready = document.createElement("h1");
  ready.textContent = "Wallet ready";
  main.replaceChildren(ready);
};

/** `?persist=late` shows its last screen at once and writes the wallet later, like a debounced store. */
const save = async () => {
  const wallet = { password: password.value, seedPhrase: seedPhrase.value };

  if (new URLSearchParams(document.location.search).get("persist") === "late") {
    showReady();
    setTimeout(() => {
      void chrome.storage.local.set(wallet);
    }, PERSIST_LATE_MS);

    return;
  }

  await chrome.storage.local.set(wallet);
  showReady();
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void save();
});

main.replaceChildren(form);
