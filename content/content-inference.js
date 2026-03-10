(function initContentInference(globalScope) {
  const ContentApp = globalScope.ProfileAutofillContent || (globalScope.ProfileAutofillContent = {});
  const {
    AUTOCOMPLETE_MAP,
    FIELD_TYPES,
    RULES,
    state
  } = ContentApp;

  function isFillableElement(element) {
    if (!element || !(element instanceof HTMLElement)) {
      return false;
    }

    if (element instanceof HTMLInputElement) {
      const blockedTypes = new Set(["hidden", "password", "file", "submit", "button", "checkbox", "radio"]);
      return !blockedTypes.has(element.type);
    }

    return element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
  }

  function isOverlayElement(element) {
    return Boolean(
      state.overlayRoot &&
      element instanceof Node &&
      state.overlayRoot.contains(element)
    );
  }

  function refreshSuggestion(element) {
    if (!state.settings?.enableSuggestions) {
      ContentApp.hideOverlay();
      return;
    }

    if (hasUserValue(element)) {
      ContentApp.hideOverlay();
      return;
    }

    const suggestion = inferSuggestion(element, state.settings.profile);
    if (!suggestion) {
      ContentApp.hideOverlay();
      return;
    }

    if (shouldSuppressOverlayForSuggestion(element, suggestion)) {
      ContentApp.hideOverlay();
      return;
    }

    state.activeSuggestion = suggestion;
    ContentApp.renderOverlay(suggestion, element);
  }

  function shouldSuppressOverlayForSuggestion(element, suggestion) {
    if (!(element instanceof HTMLSelectElement)) {
      return false;
    }

    return suggestion.fieldType === "carrier" || suggestion.fieldType === "gender";
  }

  function hasUserValue(element) {
    if (element instanceof HTMLSelectElement) {
      return ContentApp.hasMeaningfulSelectValue(element);
    }

    return typeof element.value === "string" && element.value.trim().length > 0;
  }

  function inferSuggestion(element, profile) {
    const autocomplete = (element.getAttribute("autocomplete") || "").toLowerCase().trim();
    if (AUTOCOMPLETE_MAP[autocomplete]) {
      const fieldType = AUTOCOMPLETE_MAP[autocomplete];
      const value = ContentApp.getProfileValueForField(fieldType, profile);
      if (value) {
        const relatedFields = inferRelatedFields(element.form || element.closest("form"), profile);
        return buildSuggestion(element, fieldType, value, relatedFields);
      }
    }

    const fieldType = inferFieldType(element);
    if (!fieldType) {
      return null;
    }

    const value = ContentApp.getProfileValueForField(fieldType, profile);
    if (!value) {
      return null;
    }

    const relatedFields = inferRelatedFields(element.form || element.closest("form"), profile);
    return buildSuggestion(element, fieldType, value, relatedFields);
  }

  function inferFieldType(element) {
    const explicitFieldType = inferSpecialFieldType(element);
    if (explicitFieldType) {
      return explicitFieldType;
    }

    const tokens = collectTokens(element);
    const scores = {};
    for (const fieldType of FIELD_TYPES) {
      scores[fieldType] = 0;
    }

    for (const token of tokens) {
      for (const fieldType of FIELD_TYPES) {
        for (const rule of RULES[fieldType]) {
          if (token.includes(rule)) {
            scores[fieldType] += scoreForMatch(token, rule);
          }
        }
      }
    }

    applyTypeWeights(element, scores);

    const best = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort((left, right) => right[1] - left[1])[0];

    if (!best) {
      return null;
    }

    const [fieldType, score] = best;
    if (score < 10) {
      return null;
    }

    return fieldType;
  }

  function collectTokens(element) {
    const tokenSet = new Set();
    const addText = (value) => {
      if (!value) {
        return;
      }

      const normalized = ContentApp.toSafeText(value)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      if (normalized) {
        tokenSet.add(normalized);
      }
    };

    addText(element.name);
    addText(element.id);
    addText(element.placeholder);
    addText(element.getAttribute("aria-label"));
    addText(element.getAttribute("aria-labelledby"));
    addText(element.getAttribute("autocomplete"));
    addText(element.dataset?.name);
    addText(element.dataset?.label);
    addText(readLabelText(element));
    addText(readNearbyText(element));
    addText(readSelectOptionText(element));

    return Array.from(tokenSet);
  }

  function inferSpecialFieldType(element) {
    if (isResidentRegistrationDigitField(element)) {
      return "residentRegistrationDigit";
    }

    return null;
  }

  function isResidentRegistrationDigitField(element) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return false;
    }

    const maxLength = ContentApp.getElementMaxLength(element);
    if (maxLength > 0 && maxLength > 2) {
      return false;
    }

    const context = [
      element.name,
      element.id,
      element.placeholder,
      element.getAttribute("aria-label"),
      readLabelText(element),
      readNearbyText(element)
    ]
      .filter(Boolean)
      .join(" ");
    const normalized = ContentApp.normalizeLooseToken(context);

    if (!normalized) {
      return false;
    }

    if (/(주민등록번호|주민번호|민번|rrn|등록번호)/.test(context) && /(뒷|뒤|back|first|첫)/i.test(context)) {
      return true;
    }

    if ((maxLength === 1 || maxLength === 2) && (normalized.includes("주민등록번호") || normalized.includes("주민번호") || normalized.includes("생년월일6자리"))) {
      return true;
    }

    if ((maxLength === 1 || maxLength === 2) && hasBirthDateSiblingControl(element)) {
      return true;
    }

    return false;
  }

  function hasBirthDateSiblingControl(element) {
    let current = element.parentElement;

    while (current && current !== document.body) {
      const controls = Array.from(current.querySelectorAll("input, textarea"))
        .filter((control) => control !== element && ContentApp.isElementVisible(control));
      if (controls.length > 0 && controls.length <= 4) {
        const hasBirthDateLikeControl = controls.some((control) => {
          const text = [
            control.name,
            control.id,
            control.placeholder,
            control.getAttribute("aria-label"),
            readLabelText(control)
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          const normalized = ContentApp.normalizeLooseToken(text);
          const maxLength = ContentApp.getElementMaxLength(control);

          return /생년월일|birth|birthday|dob/.test(text) || normalized.includes("생년월일6자리") || maxLength === 6;
        });

        if (hasBirthDateLikeControl) {
          return true;
        }
      }

      current = current.parentElement;
    }

    return false;
  }

  function readLabelText(element) {
    if (element.labels?.length) {
      return Array.from(element.labels)
        .map((label) => label.textContent?.trim() || "")
        .join(" ");
    }

    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) {
        return label.textContent?.trim() || "";
      }
    }

    const wrappingLabel = element.closest("label");
    return wrappingLabel?.textContent?.trim() || "";
  }

  function readNearbyText(element) {
    const container = element.closest("label, .field, .form-group, .input, .row, td, th, li, div");
    if (!container) {
      return "";
    }

    const clone = container.cloneNode(true);
    clone.querySelectorAll("select, option, input, textarea, button").forEach((node) => node.remove());
    return clone.textContent?.trim().slice(0, 120) || "";
  }

  function readSelectOptionText(element) {
    if (!(element instanceof HTMLSelectElement)) {
      return "";
    }

    return Array.from(element.options)
      .slice(0, 8)
      .map((option) => `${option.value || ""} ${option.textContent || ""}`.trim())
      .join(" ");
  }

  function scoreForMatch(token, rule) {
    if (token === rule) {
      return 14;
    }

    if (token.startsWith(rule) || token.endsWith(rule)) {
      return 10;
    }

    return 6;
  }

  function applyTypeWeights(element, scores) {
    if (element instanceof HTMLSelectElement) {
      const optionText = readSelectOptionText(element);
      if (ContentApp.containsAlias(optionText, ContentApp.SELECT_VALUE_ALIASES.carrier)) {
        scores.carrier += 20;
      }

      if (ContentApp.containsAlias(optionText, ContentApp.SELECT_VALUE_ALIASES.gender)) {
        scores.gender += 20;
      }

      return;
    }

    if (!(element instanceof HTMLInputElement)) {
      return;
    }

    if (element.type === "email") {
      scores.email += 20;
    }

    if (element.type === "tel") {
      scores.phone += 20;
    }

    if (element.type === "date") {
      scores.birthDate += 20;
    }

    if (looksLikePhoneInput(element)) {
      scores.phone += 18;
      scores.carrier = Math.max(0, scores.carrier - 12);
    }
  }

  function looksLikePhoneInput(element) {
    if (!(element instanceof HTMLInputElement)) {
      return false;
    }

    const context = [
      element.name,
      element.id,
      element.placeholder,
      element.getAttribute("aria-label"),
      readLabelText(element),
      readNearbyText(element)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/phone|mobile|tel|contact/.test(context)) {
      return true;
    }

    if (hasPhonePrefixSibling(element)) {
      return true;
    }

    const maxLength = ContentApp.getElementMaxLength(element);
    const placeholderDigits = ContentApp.normalizePhoneNumber(element.placeholder || "");
    return Boolean(
      (maxLength > 0 && maxLength <= 8) ||
      (placeholderDigits.length >= 7 && placeholderDigits.length <= 8)
    );
  }

  function hasPhonePrefixSibling(element) {
    const scope = ContentApp.findPhoneGroupScope(element);
    if (!scope) {
      return false;
    }

    return Array.from(scope.querySelectorAll("input, select"))
      .some((control) => control !== element && ContentApp.isElementVisible(control) && ContentApp.isPhonePrefixControl(control));
  }

  function inferRelatedFields(form, profile) {
    if (!form) {
      return [];
    }

    const elements = Array.from(form.querySelectorAll("input, textarea, select"))
      .filter((element) => isFillableElement(element) && ContentApp.isElementVisible(element) && !hasUserValue(element));

    const bestMatches = new Map();

    for (const element of elements) {
      const fieldType = inferFieldType(element);
      const fieldValue = ContentApp.getProfileValueForField(fieldType, profile);
      if (!fieldType || !fieldValue) {
        continue;
      }

      if (fieldType === "phone" && ContentApp.isPhonePrefixControl(element)) {
        continue;
      }

      const candidate = {
        element,
        fieldType,
        value: fieldValue
      };
      const current = bestMatches.get(fieldType);

      if (!current || rankFieldCandidate(candidate) > rankFieldCandidate(current)) {
        bestMatches.set(fieldType, candidate);
      }
    }

    return Array.from(bestMatches.values());
  }

  function rankFieldCandidate(candidate) {
    const { element, fieldType } = candidate;
    let score = 0;

    if (fieldType === "phone") {
      if (element instanceof HTMLInputElement) {
        score += 30;
      }

      if (element instanceof HTMLInputElement && element.type === "tel") {
        score += 12;
      }

      if (looksLikePhoneInput(element)) {
        score += 10;
      }
    }

    if ((fieldType === "carrier" || fieldType === "gender") && element instanceof HTMLSelectElement) {
      score += 20;
    }

    if (fieldType === "birthDate" && element instanceof HTMLInputElement && element.type === "date") {
      score += 16;
    }

    if (fieldType === "residentRegistrationDigit") {
      score += 22;
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      score += 4;
    }

    return score;
  }

  function buildSuggestion(element, fieldType, value, relatedFields = []) {
    return {
      element,
      fieldType,
      rawValue: value,
      value: ContentApp.normalizeValueForField(fieldType, value, element),
      relatedFields
    };
  }

  Object.assign(ContentApp, {
    isFillableElement,
    isOverlayElement,
    refreshSuggestion,
    shouldSuppressOverlayForSuggestion,
    hasUserValue,
    inferSuggestion,
    inferFieldType,
    collectTokens,
    inferSpecialFieldType,
    isResidentRegistrationDigitField,
    hasBirthDateSiblingControl,
    readLabelText,
    readNearbyText,
    readSelectOptionText,
    scoreForMatch,
    applyTypeWeights,
    looksLikePhoneInput,
    hasPhonePrefixSibling,
    inferRelatedFields,
    rankFieldCandidate,
    buildSuggestion
  });
})(globalThis);
