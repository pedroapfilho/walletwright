const main = document.querySelector("main");

const heading = (text) => {
  const element = document.createElement("h1");
  element.textContent = text;
  return element;
};

const showLock = () => {
  const field = document.createElement("input");
  field.type = "password";
  field.setAttribute("aria-label", "Password");

  const submit = document.createElement("button");
  submit.textContent = "Unlock";

  const form = document.createElement("form");
  form.append(field, submit);
  const unlock = async () => {
    const { password } = await chrome.storage.local.get("password");
    if (field.value === password) {
      main.replaceChildren(heading("Unlocked"));
    }
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void unlock();
  });
  main.replaceChildren(form);
};

/** `?settle=reload` renders nothing until the page is reloaded, like a wallet whose worker woke late. */
const reloaded = performance.getEntriesByType("navigation")[0]?.type === "reload";
if (new URLSearchParams(document.location.search).get("settle") !== "reload" || reloaded) {
  showLock();
}
