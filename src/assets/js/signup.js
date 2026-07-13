// Signup form: pre-check a committee from ?committee=<id>, build a human-readable
// committee list on submit, and submit to Formspree via fetch for inline feedback.
(function () {
  const form = document.getElementById("signup-form");
  if (!form) return;

  const successEl = document.getElementById("form-success");
  const errorEl = document.getElementById("form-error");
  const namesField = document.getElementById("committee_names");
  const checkboxes = Array.from(form.querySelectorAll('input[name="committees"]'));
  const withdrawBox = document.getElementById("withdraw");

  // Withdrawing replaces committee selection: clear and lock the committee
  // checkboxes while the withdraw box is checked (disabled inputs don't submit).
  if (withdrawBox) {
    withdrawBox.addEventListener("change", function () {
      checkboxes.forEach((c) => {
        if (withdrawBox.checked) c.checked = false;
        c.disabled = withdrawBox.checked;
      });
      if (errorEl) errorEl.hidden = true;
    });
  }

  // Pre-check the committee passed in the query string and scroll it into view.
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get("committee");
  if (wanted) {
    const match = checkboxes.find((c) => c.value === wanted);
    if (match) {
      match.checked = true;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      match.closest(".check")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }
  }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  form.addEventListener("submit", async function (e) {
    // Require at least one committee selection — unless the volunteer is
    // withdrawing their earlier interest, which needs no committees.
    const withdrawing = Boolean(withdrawBox && withdrawBox.checked);
    const selected = checkboxes.filter((c) => c.checked);
    if (selected.length === 0 && !withdrawing) {
      e.preventDefault();
      showError("Please select at least one committee, or check the withdraw box to remove your earlier sign-up.");
      return;
    }
    if (errorEl) errorEl.hidden = true;

    // Mirror selected committee names into a readable hidden field for the dashboard.
    if (namesField) {
      namesField.value = withdrawing
        ? "None — withdrawing earlier interest"
        : selected.map((c) => c.dataset.name || c.value).join(", ");
    }

    // Progressive enhancement: if fetch is available, submit via AJAX.
    if (!window.fetch) return; // fall back to a normal POST
    e.preventDefault();

    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = "Submitting…";
    }

    try {
      const res = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        // Redirect to the thank-you landing page (same target as the form's _next
        // fallback) so JS and non-JS submitters get one consistent experience.
        // Pass the first name along so the modal can greet them personally.
        const next = form.querySelector('input[name="_next"]')?.value;
        if (next) {
          const firstName = (form.querySelector("#name")?.value || "").trim().split(/\s+/)[0];
          const url = new URL(next, window.location.origin);
          if (firstName) url.searchParams.set("name", firstName);
          if (withdrawing) url.searchParams.set("mode", "withdraw");
          window.location.assign(url.toString());
          return;
        }
        // No _next configured — fall back to the inline success message.
        form.hidden = true;
        if (successEl) {
          successEl.hidden = false;
          const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          successEl.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        const msg =
          data && data.errors && data.errors.length
            ? data.errors.map((x) => x.message).join(", ")
            : "Something went wrong submitting the form. Please try again or email us.";
        showError(msg);
        if (button) {
          button.disabled = false;
          button.textContent = "Submit volunteer form";
        }
      }
    } catch (err) {
      showError("Network error — please check your connection and try again.");
      if (button) {
        button.disabled = false;
        button.textContent = "Submit volunteer form";
      }
    }
  });
})();
