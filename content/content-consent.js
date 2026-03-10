(function initContentConsent(globalScope) {
  const ContentApp = globalScope.ProfileAutofillContent || (globalScope.ProfileAutofillContent = {});
  const { state } = ContentApp;

  function observeDomChanges() {
    if (state.mutationObserver) {
      return;
    }

    state.mutationObserver = new MutationObserver(() => {
      queueAutoAgree();
    });

    state.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-checked", "checked", "disabled", "hidden"]
    });
  }

  function queueAutoAgree() {
    window.clearTimeout(state.autoAgreeTimer);
    state.autoAgreeTimer = window.setTimeout(() => {
      attemptAutoAgree();
    }, 150);
  }

  function attemptAutoAgree() {
    if (!state.settings?.autoAgreeTerms) {
      return;
    }

    const masterControl = findMasterAgreeControl();
    if (masterControl) {
      activateAgreeControl(masterControl);
      return;
    }

    const consentControls = findIndividualConsentControls();
    for (const control of consentControls) {
      activateAgreeControl(control);
    }
  }

  function findMasterAgreeControl() {
    const masterKeywords = [
      "전체동의",
      "전체 동의",
      "모두동의",
      "모두 동의",
      "all agree",
      "agree all"
    ];

    const controls = getCheckableControls();
    return controls.find((control) => {
      if (isControlChecked(control) || !isAgreeControlVisible(control)) {
        return false;
      }

      const text = getControlText(control);
      return masterKeywords.some((keyword) => text.includes(keyword));
    }) || null;
  }

  function findIndividualConsentControls() {
    const consentKeywords = [
      "동의",
      "약관",
      "개인정보",
      "제3자",
      "고유식별",
      "서비스 이용",
      "본인확인",
      "수집",
      "제공",
      "처리"
    ];
    const denyKeywords = ["미동의", "동의안함", "동의 안함", "거부", "비동의"];

    return getCheckableControls().filter((control) => {
      if (isControlChecked(control) || !isAgreeControlVisible(control)) {
        return false;
      }

      const text = getControlText(control);
      if (!text) {
        return false;
      }

      if (denyKeywords.some((keyword) => text.includes(keyword))) {
        return false;
      }

      return consentKeywords.some((keyword) => text.includes(keyword));
    });
  }

  function getCheckableControls() {
    return Array.from(
      document.querySelectorAll(
        [
          "input[type='checkbox']",
          "[role='checkbox']",
          "[aria-checked]",
          "input[type='radio']"
        ].join(", ")
      )
    );
  }

  function getControlText(control) {
    const fragments = new Set();
    const addText = (value) => {
      if (!value) {
        return;
      }

      const normalized = ContentApp.toSafeText(value).toLowerCase().replace(/\s+/g, " ").trim();
      if (normalized) {
        fragments.add(normalized);
      }
    };

    if (control instanceof HTMLElement) {
      addText(control.innerText || control.textContent);
      addText(control.getAttribute("aria-label"));
      addText(control.getAttribute("title"));
      addText(control.getAttribute("name"));
      addText(control.getAttribute("id"));
    }

    if (control instanceof HTMLInputElement && control.labels?.length) {
      for (const label of control.labels) {
        addText(label.innerText || label.textContent);
      }
    }

    if (control instanceof HTMLInputElement && control.id) {
      const label = document.querySelector(`label[for="${CSS.escape(control.id)}"]`);
      if (label) {
        addText(label.innerText || label.textContent);
      }
    }

    const container = control.parentElement?.closest("label, li, td, tr, button, [role='checkbox']");
    if (container) {
      addText(container.innerText || container.textContent);
    }

    return Array.from(fragments).join(" ");
  }

  function isControlChecked(control) {
    if (control instanceof HTMLInputElement) {
      return control.checked;
    }

    const ariaChecked = control.getAttribute?.("aria-checked");
    return ariaChecked === "true";
  }

  function activateAgreeControl(control) {
    if (isControlChecked(control)) {
      return false;
    }

    const target = getClickableTarget(control);
    if (!target || !isElementVisible(target)) {
      return false;
    }

    target.click();
    return true;
  }

  function getClickableTarget(control) {
    if (control instanceof HTMLInputElement) {
      if (control.labels?.length) {
        return control.labels[0];
      }

      return control;
    }

    const label = control.closest("label");
    return label || control;
  }

  function isAgreeControlVisible(control) {
    const target = getClickableTarget(control);
    return Boolean(target && isElementVisible(target));
  }

  function isElementVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  Object.assign(ContentApp, {
    observeDomChanges,
    queueAutoAgree,
    attemptAutoAgree,
    findMasterAgreeControl,
    findIndividualConsentControls,
    getCheckableControls,
    getControlText,
    isControlChecked,
    activateAgreeControl,
    getClickableTarget,
    isAgreeControlVisible,
    isElementVisible
  });
})(globalThis);
