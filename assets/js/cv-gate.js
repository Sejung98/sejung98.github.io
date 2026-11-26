/**
 * CV Download Security Gate
 * Collects requester email and purpose and sends them to Sejung, who replies with the CV.
 * The CV itself is never hosted on this site.
 */
(function () {
  const triggerBtn = document.getElementById("cv-card-btn");
  const modalBackdrop = document.getElementById("cv-modal-backdrop");
  const modalCloseBtn = document.getElementById("cv-modal-close");
  const cancelBtn = document.getElementById("cv-btn-cancel");
  const cvForm = document.getElementById("cv-request-form");
  const emailInput = document.getElementById("cv-email");
  const reasonInput = document.getElementById("cv-reason");
  const submitBtn = document.getElementById("cv-btn-submit");
  const statusBox = document.getElementById("cv-status-box");

  if (!triggerBtn || !modalBackdrop || !cvForm) {
    return;
  }

  // Open modal
  function openModal() {
    modalBackdrop.classList.add("is-open");
    clearStatus();
    if (emailInput) {
      emailInput.focus();
    }
  }

  // Close modal
  function closeModal() {
    modalBackdrop.classList.remove("is-open");
    clearStatus();
  }

  triggerBtn.addEventListener("click", openModal);
  triggerBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal();
    }
  });

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeModal);
  }

  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalBackdrop.classList.contains("is-open")) {
      closeModal();
    }
  });

  function clearStatus() {
    if (!statusBox) return;
    statusBox.className = "cv-status-box";
    statusBox.textContent = "";
  }

  function showError(msg) {
    if (!statusBox) return;
    statusBox.className = "cv-status-box is-error";
    statusBox.textContent = msg;
  }

  function showSuccess(msg) {
    if (!statusBox) return;
    statusBox.className = "cv-status-box is-success";
    statusBox.textContent = msg;
  }

  // RFC 5322 compliant regex check
  function isValidEmail(email) {
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return re.test(String(email).trim());
  }


  // Handle form submission
  cvForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();

    const email = (emailInput ? emailInput.value : "").trim();
    const reason = (reasonInput ? reasonInput.value : "").trim();

    // 1. Strict Validation
    if (!email) {
      showError("Please enter your email address.");
      if (emailInput) emailInput.focus();
      return;
    }

    if (!isValidEmail(email)) {
      showError("Please enter a valid email address (e.g. name@domain.com).");
      if (emailInput) emailInput.focus();
      return;
    }

    if (!reason || reason.length < 5) {
      showError(
        "Please provide a reason for download (at least 5 characters, e.g. research collaboration, graduate inquiry, hiring review)."
      );
      if (reasonInput) reasonInput.focus();
      return;
    }

    // 2. Send the request; Sejung replies with the CV by email (no file is hosted on this site)
    const restore = () => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.dataset.origHtml || submitBtn.innerHTML;
      }
    };
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.origHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = "<span>Sending request...</span>";
    }

    try {
      const res = await fetch("https://formsubmit.co/ajax/sjlee98@yuhs.ac", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `[CV Request] ${email}`,
          _replyto: email,
          _template: "table",
          Requester_Email: email,
          Purpose: reason,
          Page_URL: window.location.href,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || String(data.success) !== "true") {
        throw new Error(data.message || `Status ${res.status}`);
      }
      showSuccess("✓ Request sent. Sejung will email the CV to you shortly.");
      if (submitBtn) submitBtn.innerHTML = "<span>Request sent ✓</span>";
      setTimeout(() => {
        closeModal();
        cvForm.reset();
        restore();
      }, 3200);
    } catch (err) {
      console.error("CV request error:", err);
      showError("Could not send the request. Please email sjlee98@yuhs.ac directly.");
      restore();
    }
  });
})();
