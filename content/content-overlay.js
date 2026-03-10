(function initContentOverlay(globalScope) {
  const ContentApp = globalScope.ProfileAutofillContent || (globalScope.ProfileAutofillContent = {});
  const { LABELS, state } = ContentApp;

  function renderOverlay(suggestion, element) {
    ensureOverlay();
    state.overlay.innerHTML = "";
    setTargetHighlight(element);

    const eyebrow = document.createElement("p");
    eyebrow.className = "paa-card__eyebrow";
    eyebrow.textContent = "추천 입력";

    const title = document.createElement("p");
    title.className = "paa-card__title";
    title.textContent = LABELS[suggestion.fieldType];

    const meta = document.createElement("p");
    meta.className = "paa-card__meta";
    meta.textContent = suggestion.relatedFields.length > 1
      ? `같은 폼 ${suggestion.relatedFields.length}개 필드도 함께 준비되었습니다.`
      : "현재 칸에 가장 적합한 값을 바로 채울 수 있습니다.";

    const previewShell = document.createElement("div");
    previewShell.className = "paa-card__preview-shell";

    const previewLabel = document.createElement("p");
    previewLabel.className = "paa-card__preview-label";
    previewLabel.textContent = "추천 값";

    const preview = document.createElement("div");
    preview.className = "paa-card__preview";
    preview.textContent = suggestion.value;

    previewShell.append(previewLabel, preview);

    const actions = document.createElement("div");
    actions.className = "paa-card__actions";
    actions.dataset.layout = suggestion.relatedFields.length > 1 ? "triple" : "double";

    const fillButton = document.createElement("button");
    fillButton.type = "button";
    fillButton.className = "paa-card__button paa-card__button--primary";
    fillButton.textContent = "현재 칸 채우기";
    fillButton.addEventListener("click", fillSuggestedValue);
    actions.appendChild(fillButton);

    if (suggestion.relatedFields.length > 1) {
      const fillAllButton = document.createElement("button");
      fillAllButton.type = "button";
      fillAllButton.className = "paa-card__button paa-card__button--secondary";
      fillAllButton.textContent = "전체 채우기";
      fillAllButton.addEventListener("click", fillRelatedFields);
      actions.appendChild(fillAllButton);
    }

    const dismissButton = document.createElement("button");
    dismissButton.type = "button";
    dismissButton.className = "paa-card__button paa-card__button--ghost";
    dismissButton.textContent = "닫기";
    dismissButton.addEventListener("click", hideOverlay);
    actions.appendChild(dismissButton);

    state.overlay.append(eyebrow, title, meta, previewShell, actions);
    state.overlay.hidden = false;
    syncOverlayTargetPosition(element, true);
    startOverlayTracking();
  }

  function ensureOverlay() {
    if (state.overlayRoot && state.overlay) {
      return;
    }

    state.overlayRoot = document.createElement("div");
    state.overlayRoot.id = "profile-autofill-assistant-root";
    document.documentElement.appendChild(state.overlayRoot);

    state.overlay = document.createElement("div");
    state.overlay.className = "paa-card";
    state.overlay.hidden = true;
    state.overlay.addEventListener("mousedown", preserveInputFocus, true);
    state.overlayRoot.appendChild(state.overlay);
  }

  function preserveInputFocus(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest("button")) {
      event.preventDefault();
    }
  }

  function calculateOverlayPosition(target = state.activeElement) {
    if (!state.overlay || !target || state.overlay.hidden) {
      return null;
    }

    if (!(target instanceof Element) || !target.isConnected) {
      hideOverlay();
      return null;
    }

    const rect = target.getBoundingClientRect();
    const overlayWidth = state.overlay.offsetWidth || 320;
    const overlayHeight = state.overlay.offsetHeight || 0;
    const preferredTop = rect.bottom + 8;
    const maxTop = window.innerHeight - overlayHeight - 12;
    const top = Math.max(12, Math.min(preferredTop, maxTop));
    const preferredLeft = rect.left;
    const maxLeft = window.innerWidth - overlayWidth - 12;
    const left = Math.max(12, Math.min(preferredLeft, maxLeft));

    return { x: left, y: top };
  }

  function syncOverlayTargetPosition(target = state.activeElement, immediate = false) {
    const position = calculateOverlayPosition(target);
    if (!position) {
      return false;
    }

    state.overlayTargetX = position.x;
    state.overlayTargetY = position.y;

    if (immediate || !Number.isFinite(state.overlayCurrentX) || !Number.isFinite(state.overlayCurrentY)) {
      state.overlayCurrentX = position.x;
      state.overlayCurrentY = position.y;
      applyOverlayPosition(position.x, position.y);
    }

    return true;
  }

  function applyOverlayPosition(x, y) {
    if (!state.overlay) {
      return;
    }

    state.overlay.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function startOverlayTracking() {
    stopOverlayTracking();

    const track = () => {
      if (!state.overlay || state.overlay.hidden || !state.activeElement) {
        state.overlayTrackFrame = null;
        return;
      }

      if (!syncOverlayTargetPosition(state.activeElement)) {
        state.overlayTrackFrame = null;
        return;
      }

      state.overlayCurrentX = smoothFollow(state.overlayCurrentX, state.overlayTargetX);
      state.overlayCurrentY = smoothFollow(state.overlayCurrentY, state.overlayTargetY);
      applyOverlayPosition(state.overlayCurrentX, state.overlayCurrentY);
      state.overlayTrackFrame = window.requestAnimationFrame(track);
    };

    state.overlayTrackFrame = window.requestAnimationFrame(track);
  }

  function smoothFollow(current, target) {
    if (!Number.isFinite(current)) {
      return target;
    }

    const delta = target - current;
    if (Math.abs(delta) < 0.4) {
      return target;
    }

    return current + (delta * 0.24);
  }

  function stopOverlayTracking() {
    if (state.overlayTrackFrame !== null) {
      window.cancelAnimationFrame(state.overlayTrackFrame);
      state.overlayTrackFrame = null;
    }
  }

  function fillSuggestedValue() {
    if (!state.activeSuggestion) {
      return;
    }

    assignValue(
      state.activeSuggestion.element,
      state.activeSuggestion.rawValue ?? state.activeSuggestion.value,
      state.activeSuggestion.fieldType
    );
    ContentApp.queueAutoAgree();
    hideOverlay();
  }

  function fillRelatedFields() {
    if (!state.activeSuggestion?.relatedFields.length) {
      return;
    }

    for (const field of state.activeSuggestion.relatedFields) {
      assignValue(field.element, field.value, field.fieldType);
    }

    ContentApp.queueAutoAgree();
    hideOverlay();
  }

  function assignValue(element, value, fieldType = null) {
    const normalizedValue = ContentApp.normalizeElementValue(element, value, fieldType);
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (valueSetter) {
      valueSetter.call(element, normalizedValue);
    } else {
      element.value = normalizedValue;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    flashFilledState(element);
  }

  function hideOverlay() {
    state.activeSuggestion = null;
    stopOverlayTracking();
    state.overlayCurrentX = null;
    state.overlayCurrentY = null;
    state.overlayTargetX = null;
    state.overlayTargetY = null;
    clearTargetHighlight();
    if (state.overlay) {
      state.overlay.hidden = true;
    }
  }

  function setTargetHighlight(element) {
    if (state.highlightedElement === element) {
      return;
    }

    clearTargetHighlight();
    state.highlightedElement = element;
    element.setAttribute("data-paa-active", "true");
  }

  function clearTargetHighlight() {
    if (!state.highlightedElement) {
      return;
    }

    state.highlightedElement.removeAttribute("data-paa-active");
    state.highlightedElement = null;
  }

  function flashFilledState(element) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    element.setAttribute("data-paa-filled", "true");
    window.setTimeout(() => {
      element.removeAttribute("data-paa-filled");
    }, 900);
  }

  Object.assign(ContentApp, {
    renderOverlay,
    ensureOverlay,
    preserveInputFocus,
    calculateOverlayPosition,
    syncOverlayTargetPosition,
    applyOverlayPosition,
    startOverlayTracking,
    smoothFollow,
    stopOverlayTracking,
    fillSuggestedValue,
    fillRelatedFields,
    assignValue,
    hideOverlay,
    setTargetHighlight,
    clearTargetHighlight,
    flashFilledState
  });
})(globalThis);
