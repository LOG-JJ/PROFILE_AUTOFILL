const STORAGE_KEY = "profileAutofillSettings";
const FIELD_TYPES = [
  "fullName",
  "email",
  "phone",
  "carrier",
  "birthDate",
  "company",
  "gender",
  "postalCode",
  "addressLine1",
  "addressLine2"
];

const LABELS = {
  fullName: "이름",
  email: "이메일",
  phone: "전화번호",
  birthDate: "생년월일",
  company: "회사명",
  postalCode: "우편번호",
  addressLine1: "주소",
  addressLine2: "상세 주소"
};

const RULES = {
  fullName: ["name", "full name", "fullname", "realname", "성명", "이름", "받는분", "받는 사람", "수령인"],
  email: ["email", "e-mail", "mail", "이메일"],
  phone: ["phone", "mobile", "tel", "contact", "휴대폰", "전화", "연락처", "핸드폰"],
  birthDate: ["birth", "birthday", "birthdate", "date of birth", "dob", "생년월일", "생일", "출생"],
  company: ["company", "organization", "office", "employer", "직장", "회사", "기관", "상호"],
  postalCode: ["postal", "postcode", "post code", "zip", "zipcode", "우편번호"],
  addressLine1: ["address", "addr", "street", "shipping", "delivery", "road", "주소", "배송지", "도로명"],
  addressLine2: ["address2", "address line 2", "detail", "suite", "apt", "unit", "상세주소", "나머지주소", "동호수"]
};

const AUTOCOMPLETE_MAP = {
  name: "fullName",
  "given-name": "fullName",
  "family-name": "fullName",
  email: "email",
  tel: "phone",
  bday: "birthDate",
  birthday: "birthDate",
  organization: "company",
  "postal-code": "postalCode",
  "street-address": "addressLine1",
  "address-line1": "addressLine1",
  "address-line2": "addressLine2"
};

LABELS.carrier = "통신사";
LABELS.gender = "성별";

RULES.carrier = [
  "carrier",
  "telecom",
  "telecommunications",
  "provider",
  "mobile carrier",
  "mobile provider",
  "network",
  "통신사",
  "이동통신",
  "가입통신사",
  "skt",
  "kt",
  "lgu+"
];

RULES.gender = [
  "gender",
  "sex",
  "male",
  "female",
  "성별",
  "남성",
  "여성",
  "남자",
  "여자"
];

AUTOCOMPLETE_MAP.sex = "gender";
AUTOCOMPLETE_MAP.gender = "gender";

const SELECT_VALUE_ALIASES = {
  carrier: {
    SKT: ["skt", "sktelecom", "sk telecom", "에스케이티", "skt알뜰폰", "sk7", "tworld", "t world"],
    KT: ["kt", "케이티", "ktm", "kt알뜰폰"],
    "LGU+": ["lgu+", "lg u+", "lg유플러스", "유플러스", "u+", "uplus", "lg u plus", "lguplus", "lgt"]
  },
  gender: {
    "남성": ["남성", "남자", "남", "male", "man", "m"],
    "여성": ["여성", "여자", "여", "female", "woman", "f"]
  }
};

const KNOWN_PHONE_PREFIXES = new Set(["010", "011", "016", "017", "018", "019", "070"]);

const state = {
  settings: null,
  activeElement: null,
  activeSuggestion: null,
  overlayRoot: null,
  overlay: null,
  overlayTrackFrame: null,
  overlayCurrentX: null,
  overlayCurrentY: null,
  overlayTargetX: null,
  overlayTargetY: null,
  highlightedElement: null,
  mutationObserver: null,
  autoAgreeTimer: null
};

init();

async function init() {
  state.settings = await loadSettings();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) {
      return;
    }

    state.settings = normalizeSettings(changes[STORAGE_KEY].newValue);
    if (state.activeElement) {
      refreshSuggestion(state.activeElement);
    }

    queueAutoAgree();
  });

  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener("input", handleInput, true);
  document.addEventListener("scroll", handleViewportChange, true);
  window.addEventListener("resize", handleViewportChange);
  document.addEventListener("change", handleDocumentChange, true);

  observeDomChanges();
  queueAutoAgree();
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeSettings(stored[STORAGE_KEY]);
}

function normalizeSettings(rawSettings) {
  return {
    enableSuggestions: rawSettings?.enableSuggestions ?? true,
    autoAgreeTerms: rawSettings?.autoAgreeTerms ?? false,
    profile: normalizeProfile({
      fullName: rawSettings?.profile?.fullName ?? "",
      email: rawSettings?.profile?.email ?? "",
      phone: rawSettings?.profile?.phone ?? "",
      carrier: rawSettings?.profile?.carrier ?? "",
      birthDate: rawSettings?.profile?.birthDate ?? "",
      company: rawSettings?.profile?.company ?? "",
      gender: rawSettings?.profile?.gender ?? "",
      postalCode: rawSettings?.profile?.postalCode ?? "",
      addressLine1: rawSettings?.profile?.addressLine1 ?? "",
      addressLine2: rawSettings?.profile?.addressLine2 ?? ""
    })
  };
}

function toSafeText(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return `${value}`;
  }

  if (typeof value === "symbol" || typeof value === "function") {
    return "";
  }

  if (value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement || value instanceof HTMLSelectElement) {
    return typeof value.value === "string" ? value.value : "";
  }

  if (value instanceof Node) {
    return typeof value.textContent === "string" ? value.textContent : "";
  }

  if (typeof value === "object") {
    if (typeof value.value === "string" || typeof value.value === "number") {
      return `${value.value}`;
    }

    if (typeof value.textContent === "string") {
      return value.textContent;
    }

    return "";
  }

  try {
    return `${value}`;
  } catch {
    return "";
  }
}

function normalizeProfile(profile) {
  return {
    ...profile,
    phone: normalizePhoneNumber(profile.phone),
    birthDate: normalizeBirthDate(profile.birthDate)
  };
}

function normalizePhoneNumber(rawValue) {
  return toSafeText(rawValue).replace(/\D/g, "");
}

function normalizeBirthDate(rawValue) {
  if (!rawValue) {
    return "";
  }

  const digits = toSafeText(rawValue).replace(/\D/g, "");
  if (digits.length < 8) {
    return "";
  }

  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const monthNumber = Number(month);
  const dayNumber = Number(day);

  if (
    year.length !== 4 ||
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(dayNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function handleFocusIn(event) {
  const target = event.target;
  if (isOverlayElement(target)) {
    return;
  }

  if (!isFillableElement(target)) {
    state.activeElement = null;
    hideOverlay();
    return;
  }

  state.activeElement = target;
  refreshSuggestion(target);
}

function handleInput(event) {
  if (event.target !== state.activeElement) {
    return;
  }

  refreshSuggestion(event.target);
}

function handleDocumentChange(event) {
  if (isOverlayElement(event.target)) {
    return;
  }

  queueAutoAgree();
}

function handleViewportChange() {
  syncOverlayTargetPosition();
}

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
    hideOverlay();
    return;
  }

  if (hasUserValue(element)) {
    hideOverlay();
    return;
  }

  const suggestion = inferSuggestion(element, state.settings.profile);
  if (!suggestion) {
    hideOverlay();
    return;
  }

  if (shouldSuppressOverlayForSuggestion(element, suggestion)) {
    hideOverlay();
    return;
  }

  state.activeSuggestion = suggestion;

  renderOverlay(suggestion, element);
}

function shouldSuppressOverlayForSuggestion(element, suggestion) {
  if (!(element instanceof HTMLSelectElement)) {
    return false;
  }

  return suggestion.fieldType === "carrier" || suggestion.fieldType === "gender";
}

function hasUserValue(element) {
  if (element instanceof HTMLSelectElement) {
    return hasMeaningfulSelectValue(element);
  }

  return typeof element.value === "string" && element.value.trim().length > 0;
}

function inferSuggestion(element, profile) {
  const autocomplete = (element.getAttribute("autocomplete") || "").toLowerCase().trim();
  if (AUTOCOMPLETE_MAP[autocomplete]) {
    const fieldType = AUTOCOMPLETE_MAP[autocomplete];
    const value = profile[fieldType];
    if (value) {
      const relatedFields = inferRelatedFields(element.form || element.closest("form"), profile);
      return buildSuggestion(element, fieldType, value, relatedFields);
    }
  }

  const fieldType = inferFieldType(element);
  if (!fieldType) {
    return null;
  }

  const value = profile[fieldType];
  if (!value) {
    return null;
  }

  const relatedFields = inferRelatedFields(element.form || element.closest("form"), profile);
  return buildSuggestion(element, fieldType, value, relatedFields);
}

function inferFieldType(element) {
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

    const normalized = toSafeText(value)
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
    if (containsAlias(optionText, SELECT_VALUE_ALIASES.carrier)) {
      scores.carrier += 20;
    }

    if (containsAlias(optionText, SELECT_VALUE_ALIASES.gender)) {
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

  const maxLength = getElementMaxLength(element);
  const placeholderDigits = normalizePhoneNumber(element.placeholder || "");
  return Boolean(
    (maxLength > 0 && maxLength <= 8) ||
    (placeholderDigits.length >= 7 && placeholderDigits.length <= 8)
  );
}

function hasPhonePrefixSibling(element) {
  const scope = findPhoneGroupScope(element);
  if (!scope) {
    return false;
  }

  return Array.from(scope.querySelectorAll("input, select"))
    .some((control) => control !== element && isElementVisible(control) && isPhonePrefixControl(control));
}

function inferRelatedFields(form, profile) {
  if (!form) {
    return [];
  }

  const elements = Array.from(form.querySelectorAll("input, textarea, select"))
    .filter((element) => isFillableElement(element) && isElementVisible(element) && !hasUserValue(element));

  const bestMatches = new Map();

  for (const element of elements) {
    const fieldType = inferFieldType(element);
    if (!fieldType || !profile[fieldType]) {
      continue;
    }

    if (fieldType === "phone" && isPhonePrefixControl(element)) {
      continue;
    }

    const candidate = {
      element,
      fieldType,
      value: profile[fieldType]
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
    value: normalizeValueForField(fieldType, value),
    relatedFields
  };
}

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

    const normalized = toSafeText(value).toLowerCase().replace(/\s+/g, " ").trim();
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

function normalizeValueForField(fieldType, value) {
  if (fieldType === "phone") {
    return normalizePhoneValueForElement(state.activeElement, value);
  }

  if (fieldType === "birthDate") {
    return normalizeBirthDate(value);
  }

  if (fieldType === "carrier" || fieldType === "gender") {
    return getCanonicalFieldValue(fieldType, value);
  }

  return value;
}

function normalizePhoneValueForElement(element, rawValue) {
  const digits = normalizePhoneNumber(rawValue);
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
  const placeholderDigits = normalizePhoneNumber(element.placeholder || "");

  if (textInputs.length >= 2) {
    return true;
  }

  if (!hasPhonePrefixSibling(element)) {
    return false;
  }

  if (maxLength > 0) {
    return maxLength <= 8;
  }

  if (placeholderDigits.length > 0) {
    return placeholderDigits.length <= 8;
  }

  const currentDigits = normalizePhoneNumber(element.value || "");
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
    .filter((control) => isElementVisible(control) && isPhoneRelatedControl(control));

  if (!controls.includes(element)) {
    return null;
  }

  return controls;
}

function findPhoneGroupScope(element) {
  let current = element.parentElement;

  while (current && current !== document.body) {
    const controls = Array.from(current.querySelectorAll("input, select"))
      .filter((control) => isElementVisible(control));
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

  return inferFieldType(control) === "phone" || isPhonePrefixControl(control);
}

function isPhonePrefixControl(control) {
  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
    return false;
  }

  const directValue = control instanceof HTMLSelectElement
    ? control.value
    : control.value || control.placeholder || "";
  const digits = normalizePhoneNumber(directValue);
  if (isKnownPhonePrefixDigits(digits)) {
    return true;
  }

  if (control instanceof HTMLSelectElement) {
    return Array.from(control.options).some((option) => {
      const optionDigits = normalizePhoneNumber(option.value || option.textContent || "");
      return isKnownPhonePrefixDigits(optionDigits);
    });
  }

  const maxLength = getElementMaxLength(control);
  return Boolean(maxLength && maxLength <= 4 && inferFieldType(control) === "phone");
}

function estimatePhoneSegmentLength(control, index, group) {
  if (control instanceof HTMLSelectElement) {
    const valueDigits = normalizePhoneNumber(control.value);
    if (isKnownPhonePrefixDigits(valueDigits)) {
      return valueDigits.length;
    }

    const optionDigits = Array.from(control.options)
      .map((option) => normalizePhoneNumber(option.value || option.textContent || ""))
      .find((digits) => isKnownPhonePrefixDigits(digits));
    return optionDigits?.length || 0;
  }

  const maxLength = getElementMaxLength(control);
  if (maxLength > 0) {
    return maxLength;
  }

  const placeholderDigits = normalizePhoneNumber(control.placeholder || "");
  if (placeholderDigits.length > 0 && placeholderDigits.length <= 8) {
    return placeholderDigits.length;
  }

  if (index === 0 && group.length > 1 && inferFieldType(control) === "phone") {
    return 3;
  }

  return 0;
}

function isKnownPhonePrefixDigits(digits) {
  return KNOWN_PHONE_PREFIXES.has(toSafeText(digits));
}

function getElementMaxLength(element) {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return 0;
  }

  return Number.isInteger(element.maxLength) && element.maxLength > 0
    ? element.maxLength
    : 0;
}

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
  queueAutoAgree();
  hideOverlay();
}

function fillRelatedFields() {
  if (!state.activeSuggestion?.relatedFields.length) {
    return;
  }

  for (const field of state.activeSuggestion.relatedFields) {
    assignValue(field.element, field.value, field.fieldType);
  }

  queueAutoAgree();
  hideOverlay();
}

function assignValue(element, value, fieldType = null) {
  const normalizedValue = normalizeElementValue(element, value, fieldType);
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

function normalizeElementValue(element, value, explicitFieldType = null) {
  const fieldType = explicitFieldType || inferFieldType(element);

  if (fieldType === "phone") {
    return normalizePhoneValueForElement(element, value);
  }

  if (element instanceof HTMLInputElement && element.type === "date") {
    return normalizeBirthDate(value);
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
  const groups = SELECT_VALUE_ALIASES[fieldType];
  const raw = toSafeText(value).trim();
  const normalized = normalizeLooseToken(raw);

  if (!groups || !normalized) {
    return raw;
  }

  for (const [canonical, aliases] of Object.entries(groups)) {
    const aliasTokens = [canonical, ...aliases].map(normalizeLooseToken);
    if (aliasTokens.includes(normalized)) {
      return canonical;
    }
  }

  return raw;
}

function getOptionTokens(option, fieldType) {
  return expandAliasTokens(
    fieldType,
    getCanonicalFieldValue(fieldType, `${option.value || ""} ${option.textContent || ""}`),
    `${option.value || ""} ${option.textContent || ""}`
  );
}

function expandAliasTokens(fieldType, canonicalValue, rawValue = "") {
  const groups = SELECT_VALUE_ALIASES[fieldType];
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
  return toSafeText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9가-힣+]/g, "");
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

function getCanonicalFieldValue(fieldType, value) {
  const groups = SELECT_VALUE_ALIASES[fieldType];
  const raw = toSafeText(value).trim();
  const normalized = normalizeLooseToken(raw);

  if (!groups || !normalized) {
    return raw;
  }

  for (const [canonical, aliases] of Object.entries(groups)) {
    const aliasTokens = [canonical, ...aliases].map(normalizeLooseToken);
    if (aliasTokens.some((alias) => normalized === alias || (alias.length >= 2 && normalized.includes(alias)))) {
      return canonical;
    }
  }

  return raw;
}

function getOptionTokens(option, fieldType) {
  const tokens = new Set();
  const candidates = [option.value, option.textContent];

  for (const candidate of candidates) {
    for (const token of expandAliasTokens(fieldType, getCanonicalFieldValue(fieldType, candidate), candidate)) {
      tokens.add(token);
    }
  }

  return Array.from(tokens);
}

function normalizeLooseToken(value) {
  return toSafeText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9\u3131-\u318e\uac00-\ud7a3+]/g, "");
}
