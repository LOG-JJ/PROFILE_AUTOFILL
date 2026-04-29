(function initContentInference(globalScope) {
  const ContentApp = globalScope.ProfileAutofillContent || (globalScope.ProfileAutofillContent = {});
  const {
    ADDRESS_SEARCH_PROVIDER_HOSTS,
    AUTOCOMPLETE_MAP,
    CREDENTIAL_AUTOCOMPLETE_FIELD_NAMES,
    FIELD_TYPES,
    RULES,
    state
  } = ContentApp;

  function isFillableElement(element) {
    if (!element || !(element instanceof HTMLElement)) {
      return false;
    }

    if (element.matches(":disabled") || element.closest("fieldset:disabled")) {
      return false;
    }

    if (element instanceof HTMLInputElement) {
      const blockedTypes = new Set(["hidden", "password", "file", "submit", "button", "checkbox", "radio", "reset", "image", "range", "color"]);
      return !element.readOnly && !blockedTypes.has(element.type);
    }

    if (element instanceof HTMLTextAreaElement) {
      return !element.readOnly;
    }

    return element instanceof HTMLSelectElement;
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

    if (shouldIgnoreElement(element)) {
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
    if (shouldIgnoreElement(element)) {
      return null;
    }

    const autocompleteFieldType = getAutocompleteProfileFieldType(element);
    if (autocompleteFieldType) {
      const fieldType = autocompleteFieldType;
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
    if (shouldIgnoreElement(element)) {
      return null;
    }

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
    addText(readReferencedText(element, "aria-labelledby"));
    addText(readReferencedText(element, "aria-describedby"));
    addText(element.getAttribute("autocomplete"));
    for (const token of getAutocompleteTokens(element)) {
      addText(token);
    }
    addText(element.title);
    addText(element.dataset?.name);
    addText(element.dataset?.label);
    addText(element.dataset?.field);
    addText(element.dataset?.testid);
    addText(readLabelText(element));
    addText(readNearbyText(element));
    addText(readTableRowText(element));
    addText(readFieldsetLegendText(element));
    addText(readSelectOptionText(element));

    return Array.from(tokenSet);
  }

  function getAutocompleteTokens(element) {
    return ContentApp.toSafeText(element.getAttribute("autocomplete"))
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  function getAutocompleteProfileFieldType(element) {
    const tokens = getAutocompleteTokens(element);
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
      const fieldType = AUTOCOMPLETE_MAP[tokens[index]];
      if (fieldType) {
        return fieldType;
      }
    }

    return null;
  }

  function hasCredentialAutocompleteToken(element) {
    return getAutocompleteTokens(element)
      .some((token) => CREDENTIAL_AUTOCOMPLETE_FIELD_NAMES.has(token));
  }

  function shouldIgnoreElement(element) {
    if (!(element instanceof HTMLElement)) {
      return true;
    }

    if (hasCredentialAutocompleteToken(element)) {
      return true;
    }

    if (isSecurityCodeField(element)) {
      return true;
    }

    return isLoginCredentialContext(element);
  }

  function isSecurityCodeField(element) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return false;
    }

    const context = ContentApp.normalizeLooseToken(getElementContextText(element));
    if (!context) {
      return false;
    }

    if (/(zipcode|postcode|postal|우편번호|주소|주민등록번호|주민번호|생년월일)/.test(context)) {
      return false;
    }

    return /(otp|onetime|verificationcode|authcode|securitycode|captcha|보안문자|인증번호|인증코드|확인코드|일회용)/.test(context);
  }

  function isLoginCredentialContext(element) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return false;
    }

    const scope = findFieldScope(element);
    if (!scope) {
      return false;
    }

    return scoreLoginContext(element, scope) >= 50;
  }

  function scoreLoginContext(element, scope) {
    const scopeText = getScopeContextText(scope);
    const scopeToken = ContentApp.normalizeLooseToken(scopeText);
    const elementToken = ContentApp.normalizeLooseToken(getElementContextText(element));
    let score = 0;

    if (hasVisiblePasswordControl(scope)) {
      score += 35;
    }

    if (hasLoginActionControl(scope)) {
      score += 30;
    }

    if (/(login|signin|logon|auth|로그인)/.test(scopeToken)) {
      score += 22;
    }

    if (/(username|userid|useremail|loginid|memberid|accountid|아이디|계정|회원번호|이메일아이디)/.test(elementToken)) {
      score += 24;
    }

    if (element instanceof HTMLInputElement && element.type === "email") {
      score += 10;
    }

    if (/(signup|register|join|createaccount|회원가입|가입하기|계정만들기)/.test(scopeToken)) {
      score -= 28;
    }

    if (/(checkout|shipping|delivery|order|billing|profile|contact|주소|배송|주문|결제|프로필|연락처)/.test(scopeToken)) {
      score -= 22;
    }

    if (!hasVisiblePasswordControl(scope) && !hasLoginActionControl(scope)) {
      score -= 20;
    }

    return score;
  }

  function findFieldScope(element) {
    if (element.form) {
      return element.form;
    }

    const explicitForm = element.closest("form");
    if (explicitForm) {
      return explicitForm;
    }

    let current = element.parentElement;
    while (current && current !== document.body) {
      const controls = Array.from(current.querySelectorAll("input, textarea, select"))
        .filter((control) => ContentApp.isElementVisible(control));

      if (
        controls.length >= 1 &&
        controls.length <= 8 &&
        (hasVisiblePasswordControl(current) || hasLoginActionControl(current) || /(login|signin|로그인)/.test(ContentApp.normalizeLooseToken(getScopeContextText(current))))
      ) {
        return current;
      }

      current = current.parentElement;
    }

    return element.parentElement;
  }

  function hasVisiblePasswordControl(scope) {
    return Array.from(scope.querySelectorAll("input[type='password']"))
      .some((control) => ContentApp.isElementVisible(control));
  }

  function hasLoginActionControl(scope) {
    return Array.from(scope.querySelectorAll("button, input[type='submit'], input[type='button'], [role='button']"))
      .some((control) => /(login|signin|logon|로그인)/.test(ContentApp.normalizeLooseToken(getControlText(control))));
  }

  function getControlText(control) {
    return [
      control.textContent,
      control.value,
      control.getAttribute?.("aria-label"),
      control.getAttribute?.("title"),
      control.id,
      control.getAttribute?.("name"),
      control.className
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getElementContextText(element) {
    return [
      element.name,
      element.id,
      element.placeholder,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.className,
      readLabelText(element),
      readNearbyText(element),
      readReferencedText(element, "aria-describedby")
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getScopeContextText(scope) {
    return [
      scope.id,
      scope.getAttribute?.("name"),
      scope.getAttribute?.("action"),
      scope.className,
      readContainerText(scope, 420)
    ]
      .filter(Boolean)
      .join(" ");
  }

  function inferSpecialFieldType(element) {
    if (isAddressDetailField(element)) {
      return "addressLine2";
    }

    if (isKnownAddressSearchInput(element)) {
      return "addressLine1";
    }

    if (isResidentRegistrationDigitField(element)) {
      return "residentRegistrationDigit";
    }

    return null;
  }

  function isAddressDetailField(element) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return false;
    }

    const context = getElementContextText(element);
    const normalized = ContentApp.normalizeLooseToken(context);
    if (!normalized) {
      return false;
    }

    const explicitDetailAddress = [
      "addressdetail",
      "detailaddress",
      "addrdetail",
      "addr2",
      "address2",
      "addressline2",
      "상세주소",
      "주소상세",
      "나머지주소",
      "동호수",
      "동호",
      "호수",
      "호실",
      "층호"
    ];
    if (explicitDetailAddress.some((token) => normalized.includes(token))) {
      return true;
    }

    const hasAddressContext = /(address|addr|주소|배송지)/.test(normalized);
    const hasDetailContext = /(detail|suite|apt|unit|room|floor|상세|나머지|동호|호수|호실)/.test(normalized);
    return hasAddressContext && hasDetailContext;
  }

  function isKnownAddressSearchInput(element) {
    if (!isAddressSearchProviderPage()) {
      return false;
    }

    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return false;
    }

    if (element instanceof HTMLInputElement) {
      const allowedTypes = new Set(["", "text", "search", "tel"]);
      if (!allowedTypes.has(element.type)) {
        return false;
      }
    }

    const context = ContentApp.normalizeLooseToken(getElementContextText(element));
    if (/(detail|addrdetail|addressdetail|상세주소|상세입력|나머지주소|동호수)/.test(context)) {
      return false;
    }

    if (/(postcode|postal|zipcode|zonecode|zipno|우편번호)/.test(context) && !/(도로명|지번|건물명|주소|검색)/.test(context)) {
      return false;
    }

    if (/(도로명|도로명주소|지번|건물명|주소검색|주소찾기|주소입력|검색어|통합검색|road|jibun|keyword|query|search)/.test(context)) {
      return true;
    }

    const scope = findFieldScope(element);
    const visibleTextInputs = scope
      ? Array.from(scope.querySelectorAll("input, textarea"))
        .filter((control) => ContentApp.isElementVisible(control) && isFillableElement(control))
      : [];

    return visibleTextInputs.length === 1;
  }

  function isAddressSearchProviderPage() {
    const host = ContentApp.toSafeText(globalScope.location?.hostname).toLowerCase();
    if (!host) {
      return false;
    }

    return ADDRESS_SEARCH_PROVIDER_HOSTS.some((providerHost) => {
      return host === providerHost || host.endsWith(`.${providerHost}`);
    });
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
    const fragments = [];
    const addText = (value) => {
      const text = ContentApp.toSafeText(value).replace(/\s+/g, " ").trim();
      if (text && !fragments.includes(text)) {
        fragments.push(text);
      }
    };

    addText(readReferencedText(element, "aria-labelledby"));

    if (element.labels?.length) {
      addText(Array.from(element.labels)
        .map((label) => label.textContent?.trim() || "")
        .join(" "));
    }

    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) {
        addText(label.textContent?.trim() || "");
      }
    }

    const wrappingLabel = element.closest("label");
    addText(wrappingLabel?.textContent?.trim() || "");

    return fragments.join(" ");
  }

  function readNearbyText(element) {
    const fragments = [];
    for (const container of getFieldContextContainers(element)) {
      const text = readContainerText(container, 140);
      if (text && !fragments.includes(text)) {
        fragments.push(text);
      }

      if (fragments.join(" ").length >= 180) {
        break;
      }
    }

    return fragments.join(" ").replace(/\s+/g, " ").trim().slice(0, 180);
  }

  function getFieldContextContainers(element) {
    const containers = [];
    const addContainer = (container) => {
      if (container && container instanceof Element && !containers.includes(container)) {
        containers.push(container);
      }
    };

    addContainer(element.closest("label"));
    addContainer(element.closest(".field, .form-field, .form-group, .input-group, .input, .row, .form-row, .control, .item, td, th, li"));

    let current = element.parentElement;
    let depth = 0;
    while (current && current !== document.body && depth < 5) {
      const controls = current.querySelectorAll("input, textarea, select, button").length;
      if (controls <= 6 && !current.matches("form")) {
        addContainer(current);
      }

      current = current.parentElement;
      depth += 1;
    }

    addContainer(element.closest("tr"));
    return containers;
  }

  function readContainerText(container, maxLength = 160) {
    if (!(container instanceof Element)) {
      return "";
    }

    const fragments = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        const text = node.textContent?.replace(/\s+/g, " ").trim();

        if (!parent || !text) {
          return NodeFilter.FILTER_REJECT;
        }

        if (["SELECT", "OPTION", "INPUT", "TEXTAREA", "BUTTON"].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (ContentApp.isOverlayElement(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      fragments.push(walker.currentNode.textContent.replace(/\s+/g, " ").trim());
      if (fragments.join(" ").length >= maxLength) {
        break;
      }
    }

    return fragments.join(" ").replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function readReferencedText(element, attributeName) {
    return ContentApp.toSafeText(element.getAttribute(attributeName))
      .split(/\s+/)
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent?.trim() || "")
      .filter(Boolean)
      .join(" ");
  }

  function readTableRowText(element) {
    const row = element.closest("tr");
    return row ? readContainerText(row, 180) : "";
  }

  function readFieldsetLegendText(element) {
    const fieldset = element.closest("fieldset");
    const legend = fieldset?.querySelector("legend");
    return legend?.textContent?.trim() || "";
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
      .filter((element) => isFillableElement(element) && ContentApp.isElementVisible(element) && !hasUserValue(element) && !shouldIgnoreElement(element));

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
    getAutocompleteTokens,
    getAutocompleteProfileFieldType,
    hasCredentialAutocompleteToken,
    shouldIgnoreElement,
    isSecurityCodeField,
    isLoginCredentialContext,
    scoreLoginContext,
    findFieldScope,
    hasVisiblePasswordControl,
    hasLoginActionControl,
    getControlText,
    getElementContextText,
    getScopeContextText,
    inferSpecialFieldType,
    isAddressDetailField,
    isKnownAddressSearchInput,
    isAddressSearchProviderPage,
    isResidentRegistrationDigitField,
    hasBirthDateSiblingControl,
    readLabelText,
    readNearbyText,
    getFieldContextContainers,
    readContainerText,
    readReferencedText,
    readTableRowText,
    readFieldsetLegendText,
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
