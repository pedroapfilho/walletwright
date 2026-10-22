const ROUTE_AFTER_MS = 1500;
const IDLE_FOR_MS = 8000;

/** Longer than the engine's pass interval, so a control clicked twice gets caught. */
const SIGN_BUSY_MS = 1000;
const CONFIRM_ENABLES_AFTER_MS = 500;

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

const rejectButton = () => button("Reject", { onClick: () => answer("rejected") });

const showRequest = ({ disabled = false } = {}) => {
  window.location.hash = "#/request";
  main.replaceChildren(
    heading("Request"),
    button("Approve", { disabled, onClick: () => answer("approved") }),
    button("Reject", { disabled, onClick: () => answer("rejected") }),
  );
};

/**
 * Sign stays on screen for a moment after its click, then gives way to Confirm, which starts
 * disabled. A second click on Sign re-issues the request, like Rabby's, and answers "re-issued".
 */
const showSteps = () => {
  let signed = false;

  const showConfirm = () => {
    const confirm = button("Confirm", { disabled: true, onClick: () => answer("approved") });
    main.replaceChildren(heading("Confirm"), confirm, rejectButton());
    setTimeout(() => {
      confirm.disabled = false;
    }, CONFIRM_ENABLES_AFTER_MS);
  };

  const sign = () => {
    if (signed) {
      void answer("re-issued");

      return;
    }

    signed = true;
    setTimeout(showConfirm, SIGN_BUSY_MS);
  };

  main.replaceChildren(heading("Review"), button("Sign", { onClick: sign }), rejectButton());
};

/** Approve asks for the password again; `accepts: false` keeps asking whatever is typed. */
const showReauth = ({ accepts }) => {
  const askPassword = () => {
    const field = document.createElement("input");
    field.type = "password";
    field.setAttribute("aria-label", "Password");
    const form = document.createElement("form");
    form.append(field, button("Unlock"));

    const submit = async () => {
      const { password } = await chrome.storage.local.get("password");

      if (accepts && field.value === password) {
        await answer("approved");
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void submit();
    });
    main.replaceChildren(heading("Password"), form);
  };

  main.replaceChildren(
    heading("Request"),
    button("Approve", { onClick: askPassword }),
    rejectButton(),
  );
};

/** A notice covers the request and takes every click until it is accepted. */
const showNotice = () => {
  showRequest();
  const notice = document.createElement("section");
  notice.style.cssText = "position: fixed; inset: 0; background: white;";
  notice.append(heading("Notice"), button("Accept", { onClick: () => notice.remove() }));
  main.append(notice);
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
} else if (mode === "steps") {
  showSteps();
} else if (mode === "reauth" || mode === "refuse") {
  showReauth({ accepts: mode === "reauth" });
} else if (mode === "notice") {
  showNotice();
} else {
  showRequest({ disabled: mode === "respawn" });
}
