// Mobile nav toggle.
(function () {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", function () {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
})();

// Tell screen-reader users when a link opens in a new tab.
(function () {
  document.querySelectorAll('a[target="_blank"]').forEach(function (a) {
    if (a.querySelector(".sr-only")) return;
    const note = document.createElement("span");
    note.className = "sr-only";
    note.textContent = " (opens in new tab)";
    a.append(note);
  });
})();

// Thank-you modal: shown when a page that includes the modal partial is loaded
// with ?thanks=1 (or #thanks) — the URL Formspree sends volunteers to post-signup.
(function () {
  const overlay = document.getElementById("thanks-overlay");
  if (!overlay) return;

  const params = new URLSearchParams(window.location.search);
  const requested = params.has("thanks") || window.location.hash === "#thanks";
  if (!requested) return;

  // Greet the volunteer by name if one was passed along (?name=Ada).
  const name = (params.get("name") || "").trim();
  if (name) {
    const slot = overlay.querySelector("[data-thanks-name]");
    if (slot) slot.textContent = ", " + name + ",";
  }

  // Withdrawals (?mode=withdraw) get their own heading and body copy.
  if (params.get("mode") === "withdraw") {
    const tail = overlay.querySelector("[data-thanks-tail]");
    if (tail) tail.textContent = "— your interest has been withdrawn.";
    const emoji = overlay.querySelector("[data-thanks-emoji]");
    if (emoji) emoji.textContent = "👋";
    const volunteerBody = overlay.querySelector("[data-thanks-body-volunteer]");
    if (volunteerBody) volunteerBody.hidden = true;
    const withdrawBody = overlay.querySelector("[data-thanks-body-withdraw]");
    if (withdrawBody) withdrawBody.hidden = false;
  }

  const closeEls = overlay.querySelectorAll("#thanks-close, #thanks-dismiss");
  let lastFocused = null;

  function open() {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("modal-open");
    const focusTarget = overlay.querySelector("#thanks-close");
    if (focusTarget) focusTarget.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", onKeydown);
    // Scrub the thank-you params from the URL so a refresh/back doesn't re-pop it.
    const url = new URL(window.location.href);
    url.searchParams.delete("thanks");
    url.searchParams.delete("name");
    url.searchParams.delete("mode");
    url.hash = "";
    window.history.replaceState({}, "", url.pathname + url.search);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      close();
      return;
    }
    // Keep Tab focus inside the dialog while it is open.
    if (e.key !== "Tab") return;
    const focusables = Array.from(
      overlay.querySelectorAll("a[href], button:not([disabled])")
    ).filter((el) => !el.closest("[hidden]"));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  closeEls.forEach((el) => el.addEventListener("click", close));
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) close(); // click on the backdrop, not the dialog
  });

  open();
})();
