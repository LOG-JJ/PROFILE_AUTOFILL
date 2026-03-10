(function initContentNormalizers(globalScope) {
  const ContentApp = globalScope.ProfileAutofillContent || (globalScope.ProfileAutofillContent = {});
  const { KNOWN_PHONE_PREFIXES } = ContentApp;

  function normalizeValueForField(fieldType, value, element = ContentApp.state.activeElement) {
    if (fieldType === "phone") {
      return normalizePhoneValueForElement(element, value);
    }

    if (fieldType === "birthDate") {
      return ContentApp.normalizeBirthDateValueForElement(element, value);
    }

    if (fieldType === "residentRegistrationDigit") {
      return ContentApp.normalizeResidentRegistrationDigit(value);
    }

    if (fieldType === "carrier" || fieldType === "gender") {
      return getCanonicalFieldValue(fieldType, value);
    }

    return value;
  }

  function normalizePhoneValueForElement(element, rawValue) {
    const digits = ContentApp.normalizePhoneNumber(rawValue);
    if (!digits) {
      return "";
    }

    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return digits;
    }

    const group = getPhoneControlGroup(element);
    if (!group || group.length <= 1) {
      return digits;
    }

    if (!shouldUseSegmentedPhoneValue(element, group, digits)) {
      return digits;
    }

    const targetIndex = group.indexOf(element);
    if (targetIndex === -1) {
      return digits;
    }

    const segmentLengths = group.map((control, index) => estimatePhoneSegmentLength(control, index, group));
    const consumedPrefix = segmentLengths
      .slice(0, targetIndex)
      .reduce((total, length) => total + Math.max(length, 0), 0);
    const reservedSuffix = segmentLengths
      .slice(targetIndex + 1)
      .reduce((total, length) => total + Math.max(length, 0), 0);
    const sliceEnd = reservedSuffix > 0
      ? Math.max(consumedPrefix, digits.length - reservedSuffix)
      : digits.length;

    let segment = digits.slice(consumedPrefix, sliceEnd);
    const targetLength = segmentLengths[targetIndex];

    if (targetLength > 0) {
      segment = segment.slice(0, targetLength);
    }

    return segment || digits;
  }

  function shouldUseSegmentedPhoneValue(element, group, digits) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return false;
    }

    const textInputs = group.filter((control) => control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement);
    const maxLength = getElementMaxLength(element);
    const placeholderDigits = ContentApp.normalizePhoneNumber(element.placeholder || "");

    if (textInputs.length >= 2) {
      return true;
    }

    if (!ContentApp.hasPhonePrefixSibling(element)) {
      return false;
    }

    if (maxLength > 0) {
      return maxLength <= 8;
    }

    if (placeholderDigits.length > 0) {
      return placeholderDigits.length <= 8;
    }

    const currentDigits = ContentApp.normalizePhoneNumber(element.value || "");
    if (currentDigits.length > 0 && currentDigits.length <= 8) {
      return true;
    }

    const hintText = [
      element.name,
      element.id,
      element.placeholder,
      element.getAttribute("aria-label")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/tail|last|middle|suffix|뒤|뒷|국번|번호2|번호3/.test(hintText)) {
      return true;
    }

    return false;
  }

  function getPhoneControlGroup(element) {
    const scope = findPhoneGroupScope(element);
    if (!scope) {
      return null;
    }

    const controls = Array.from(scope.querySelectorAll("input, select"))
      .filter((control) => ContentApp.isElementVisible(control) && isPhoneRelatedControl(control));

    if (!controls.includes(element)) {
      return null;
    }

    return controls;
  }

  function findPhoneGroupScope(element) {
    let current = element.parentElement;

    while (current && current !== document.body) {
      const controls = Array.from(current.querySelectorAll("input, select"))
        .filter((control) => ContentApp.isElementVisible(control));
      const text = (current.innerText || current.textContent || "").toLowerCase();
      const looksPhoneContainer = /phone|mobile|tel|휴대폰|전화|연락처|핸드폰/.test(text);

      if (controls.length >= 2 && controls.length <= 5 && looksPhoneContainer) {
        return current;
      }

      current = current.parentElement;
    }

    return element.form || element.parentElement;
  }

  function isPhoneRelatedControl(control) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
      return false;
    }

    if (control instanceof HTMLInputElement) {
      const blockedTypes = new Set(["hidden", "password", "file", "submit", "button", "checkbox", "radio"]);
      if (blockedTypes.has(control.type)) {
        return false;
      }
    }

    return ContentApp.inferFieldType(control) === "phone" || isPhonePrefixControl(control);
  }

  function isPhonePrefixControl(control) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
      return false;
    }

    const directValue = control instanceof HTMLSelectElement
      ? control.value
      : control.value || control.placeholder || "";
    const digits = ContentApp.normalizePhoneNumber(directValue);
    if (isKnownPhonePrefixDigits(digits)) {
      return true;
    }

    if (control instanceof HTMLSelectElement) {
      return Array.from(control.options).some((option) => {
        const optionDigits = ContentApp.normalizePhoneNumber(option.value || option.textContent || "");
        return isKnownPhonePrefixDigits(optionDigits);
      });
    }

    const maxLength = getElementMaxLength(control);
    return Boolean(maxLength && maxLength <= 4 && ContentApp.inferFieldType(control) === "phone");
  }

  function estimatePhoneSegmentLength(control, index, group) {
    if (control instanceof HTMLSelectElement) {
      const valueDigits = ContentApp.normalizePhoneNumber(control.value);
      if (isKnownPhonePrefixDigits(valueDigits)) {
        return valueDigits.length;
      }

      const optionDigits = Array.from(control.options)
        .map((option) => ContentApp.normalizePhoneNumber(option.value || option.textContent || ""))
        .find((digits) => isKnownPhonePrefixDigits(digits));
      return optionDigits?.length || 0;
    }

    const maxLength = getElementMaxLength(control);
    if (maxLength > 0) {
      return maxLength;
    }

    const placeholderDigits = ContentApp.normalizePhoneNumber(control.placeholder || "");
    if (placeholderDigits.length > 0 && placeholderDigits.length <= 8) {
      return placeholderDigits.length;
    }

    if (index === 0 && group.length > 1 && ContentApp.inferFieldType(control) === "phone") {
      return 3;
    }

    return 0;
  }

  function isKnownPhonePrefixDigits(digits) {
    return KNOWN_PHONE_PREFIXES.has(ContentApp.toSafeText(digits));
  }

  function getElementMaxLength(element) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return 0;
    }

    return Number.isInteger(element.maxLength) && element.maxLength > 0
      ? element.maxLength
      : 0;
  }

  function normalizeElementValue(element, value, explicitFieldType = null) {
    const fieldType = explicitFieldType || ContentApp.inferFieldType(element);

    if (fieldType === "phone") {
      return normalizePhoneValueForElement(element, value);
    }

    if (fieldType === "birthDate") {
      return ContentApp.normalizeBirthDateValueForElement(element, value);
    }

    if (fieldType === "residentRegistrationDigit") {
      return ContentApp.normalizeResidentRegistrationDigit(value);
    }

    if (element instanceof HTMLSelectElement) {
      return normalizeSelectValue(element, fieldType, value);
    }

    return value;
  }

  function hasMeaningfulSelectValue(element) {
    if (!(element instanceof HTMLSelectElement)) {
      return false;
    }

    const selectedOption = element.options[element.selectedIndex];
    if (!selectedOption || selectedOption.disabled) {
      return false;
    }

    const normalized = normalizeLooseToken(`${element.value || ""} ${selectedOption.textContent || ""}`);
    if (!normalized) {
      return false;
    }

    const placeholderTokens = ["select", "선택", "통신사", "성별", "carrier", "gender"];
    return !placeholderTokens.some((token) => normalized === normalizeLooseToken(token));
  }

  function normalizeSelectValue(element, fieldType, value) {
    const matchedValue = findMatchingSelectValue(element, fieldType, value);
    return matchedValue || element.value;
  }

  function findMatchingSelectValue(element, fieldType, value) {
    if (!(element instanceof HTMLSelectElement)) {
      return "";
    }

    const targetTokens = new Set(expandAliasTokens(fieldType, getCanonicalFieldValue(fieldType, value), value));
    if (targetTokens.size === 0) {
      return "";
    }

    for (const option of Array.from(element.options)) {
      const optionTokens = getOptionTokens(option, fieldType);
      if (optionTokens.some((token) => targetTokens.has(token))) {
        return option.value;
      }
    }

    return "";
  }

  function getCanonicalFieldValue(fieldType, value) {
    const groups = ContentApp.SELECT_VALUE_ALIASES[fieldType];
    const raw = ContentApp.toSafeText(value).trim();
    const normalized = normalizeLooseToken(raw);

    if (!groups || !normalized) {
      return raw;
    }

    let bestMatch = raw;
    let bestScore = 0;

    for (const [canonical, aliases] of Object.entries(groups)) {
      for (const alias of [canonical, ...aliases]) {
        const normalizedAlias = normalizeLooseToken(alias);
        if (!normalizedAlias) {
          continue;
        }

        if (normalized === normalizedAlias) {
          const score = 1000 + normalizedAlias.length;
          if (score > bestScore) {
            bestMatch = canonical;
            bestScore = score;
          }
          continue;
        }

        if (normalizedAlias.length >= 2 && normalized.includes(normalizedAlias)) {
          const score = normalizedAlias.length;
          if (score > bestScore) {
            bestMatch = canonical;
            bestScore = score;
          }
        }
      }
    }

    return bestMatch;
  }

  function getOptionTokens(option, fieldType) {
    return expandAliasTokens(
      fieldType,
      getCanonicalFieldValue(fieldType, `${option.value || ""} ${option.textContent || ""}`),
      `${option.value || ""} ${option.textContent || ""}`
    );
  }

  function expandAliasTokens(fieldType, canonicalValue, rawValue = "") {
    const groups = ContentApp.SELECT_VALUE_ALIASES[fieldType];
    const tokens = new Set();

    const addToken = (candidate) => {
      const normalized = normalizeLooseToken(candidate);
      if (normalized) {
        tokens.add(normalized);
      }
    };

    addToken(canonicalValue);
    addToken(rawValue);

    if (groups && groups[canonicalValue]) {
      for (const alias of groups[canonicalValue]) {
        addToken(alias);
      }
    }

    return Array.from(tokens);
  }

  function containsAlias(text, groups) {
    const normalizedText = normalizeLooseToken(text);
    if (!normalizedText) {
      return false;
    }

    return Object.entries(groups).some(([canonical, aliases]) => {
      return [canonical, ...aliases].some((alias) => normalizedText.includes(normalizeLooseToken(alias)));
    });
  }

  function normalizeLooseToken(value) {
    return ContentApp.toSafeText(value)
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9\u3131-\u318e\uac00-\ud7a3+]/g, "");
  }

  Object.assign(ContentApp, {
    normalizeValueForField,
    normalizePhoneValueForElement,
    shouldUseSegmentedPhoneValue,
    getPhoneControlGroup,
    findPhoneGroupScope,
    isPhoneRelatedControl,
    isPhonePrefixControl,
    estimatePhoneSegmentLength,
    isKnownPhonePrefixDigits,
    getElementMaxLength,
    normalizeElementValue,
    hasMeaningfulSelectValue,
    normalizeSelectValue,
    findMatchingSelectValue,
    getCanonicalFieldValue,
    getOptionTokens,
    expandAliasTokens,
    containsAlias,
    normalizeLooseToken
  });
})(globalThis);
