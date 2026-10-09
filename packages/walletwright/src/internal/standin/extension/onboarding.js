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
const save = async () => {
  await chrome.storage.local.set({ password: password.value, seedPhrase: seedPhrase.value });
  const ready = document.createElement("h1");
  ready.textContent = "Wallet ready";
  main.replaceChildren(ready);
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void save();
});

main.replaceChildren(form);
