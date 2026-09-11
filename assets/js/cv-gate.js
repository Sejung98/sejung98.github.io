/**
 * CV Download Security Gate
 * Validates requester email and reason before in-memory AES-GCM decryption and download.
 * Prevents HTML bypass and logs download access.
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

  // Reconstruct secure decryption key
  function getCipherKey() {
    const seed = [
      234, 219, 137, 52, 47, 158, 248, 203, 186, 175, 142, 153, 232, 251, 202,
      223, 46, 57, 168, 187, 138, 159, 238, 249, 200, 219, 42, 63, 174, 185,
      136, 155,
    ];
    const mask = 0xa5;
    return new Uint8Array(seed.map((b) => b ^ mask));
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

    // 2. Set UI loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.origHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = `
        <svg class="cv-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="0.9"/></svg>
        <span>Preparing download...</span>
      `;
    }

    try {
      // 3. Send email notification to sjlee98@yuhs.ac (asynchronous / non-blocking)
      try {
        fetch("https://formsubmit.co/ajax/sjlee98@yuhs.ac", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            _subject: `[CV Download Alert] ${email}`,
            Requester_Email: email,
            Download_Reason: reason,
            Timestamp: new Date().toLocaleString(),
            Page_URL: window.location.href,
          }),
        }).catch((netErr) => {
          console.warn("Notification dispatch info:", netErr);
        });
      } catch (mailErr) {
        console.warn("Mail dispatch notice:", mailErr);
      }

      // 4. Fetch encrypted CV payload
      const basePath = window.location.pathname.includes("/contact") ? "../" : "./";
      const encUrl = `${basePath}assets/data/cv.enc`;
      const response = await fetch(encUrl);
      if (!response.ok) {
        throw new Error(`Unable to fetch file (Status: ${response.status})`);
      }

      const rawBuffer = await response.arrayBuffer();
      if (rawBuffer.byteLength < 28) {
        throw new Error("Invalid protected file format.");
      }

      // 5. Extract IV (first 12 bytes) and ciphertext
      const iv = new Uint8Array(rawBuffer.slice(0, 12));
      const ciphertext = rawBuffer.slice(12);

      // 6. In-memory AES-GCM Decryption
      const keyBytes = getCipherKey();
      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        "AES-GCM",
        false,
        ["decrypt"]
      );

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        cryptoKey,
        ciphertext
      );

      // 7. Log download request to localStorage
      const logEntry = {
        email: email,
        reason: reason,
        timestamp: new Date().toISOString(),
        formattedDate: new Date().toLocaleString(),
        userAgent: navigator.userAgent,
      };

      try {
        const existingLogs = JSON.parse(
          localStorage.getItem("cv_download_logs") || "[]"
        );
        existingLogs.push(logEntry);
        localStorage.setItem("cv_download_logs", JSON.stringify(existingLogs));
      } catch (logErr) {
        console.warn("Local access log write error:", logErr);
      }

      // 8. Trigger dynamic Blob download
      const docBlob = new Blob([decryptedBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const downloadUrl = URL.createObjectURL(docBlob);
      const tempLink = document.createElement("a");
      tempLink.href = downloadUrl;
      tempLink.download = "CV_SejungLee.docx";
      tempLink.style.display = "none";
      document.body.appendChild(tempLink);
      tempLink.click();
      tempLink.remove();
      URL.revokeObjectURL(downloadUrl);

      // 9. Success feedback
      showSuccess(
        "✓ Your CV download has started. Feel free to contact sjlee98@yuhs.ac for any academic inquiries."
      );

      if (submitBtn) {
        submitBtn.innerHTML = `<span>Download Complete ✓</span>`;
      }

      // Auto close after 2.8 seconds
      setTimeout(() => {
        closeModal();
        cvForm.reset();
        if (submitBtn) {
          submitBtn.disabled = false;
          if (submitBtn.dataset.origHtml) {
            submitBtn.innerHTML = submitBtn.dataset.origHtml;
          }
        }
      }, 2800);
    } catch (err) {
      console.error("CV download gate error:", err);
      showError(
        "An error occurred during download. Please try again shortly or contact sjlee98@yuhs.ac directly."
      );
      if (submitBtn) {
        submitBtn.disabled = false;
        if (submitBtn.dataset.origHtml) {
          submitBtn.innerHTML = submitBtn.dataset.origHtml;
        }
      }
    }
  });
})();
