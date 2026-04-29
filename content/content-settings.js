(function initContentSettings(globalScope) {
  const ContentApp = globalScope.ProfileAutofillContent || (globalScope.ProfileAutofillContent = {});
  const {
    DEFAULT_PROFILE,
    STORAGE_KEY
  } = ContentApp;

  async function loadSettings() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeSettings(stored[STORAGE_KEY]);
  }

  function normalizeSettings(rawSettings) {
    const hasProfilesArray = Array.isArray(rawSettings?.profiles);
    const profiles = Array.isArray(rawSettings?.profiles)
      ? rawSettings.profiles
        .filter(Boolean)
        .map((profile, index) => normalizeProfileRecord(profile, index))
      : [];

    if (!hasProfilesArray && hasLegacyProfileData(rawSettings)) {
      profiles.push(
        normalizeProfileRecord(
          {
            id: rawSettings?.activeProfileId,
            name: rawSettings?.profileName || "기본 프로필",
            profile: rawSettings?.profile || {}
          },
          0
        )
      );
    }

    const activeProfile = profiles.find((profile) => profile.id === rawSettings?.activeProfileId) || profiles[0];

    return {
      enableSuggestions: rawSettings?.enableSuggestions ?? true,
      autoAgreeTerms: rawSettings?.autoAgreeTerms ?? false,
      activeProfileId: activeProfile?.id || "",
      profiles,
      profile: activeProfile?.profile || normalizeProfile({})
    };
  }

  function normalizeProfileRecord(rawProfile, index) {
    const profileSource = rawProfile?.profile && typeof rawProfile.profile === "object"
      ? rawProfile.profile
      : rawProfile || {};

    const safeId = toSafeText(rawProfile?.id).trim() || `profile-${index + 1}`;
    const safeName = toSafeText(rawProfile?.name).trim() || `프로필 ${index + 1}`;

    return {
      id: safeId,
      name: safeName,
      profile: normalizeProfile(profileSource)
    };
  }

  function hasLegacyProfileData(rawSettings) {
    if (!rawSettings || Array.isArray(rawSettings.profiles)) {
      return false;
    }

    if (toSafeText(rawSettings.profileName).trim()) {
      return true;
    }

    return Object.keys(DEFAULT_PROFILE).some((fieldName) => {
      return Boolean(toSafeText(rawSettings?.profile?.[fieldName]).trim());
    });
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
      ...DEFAULT_PROFILE,
      ...(profile || {}),
      phone: normalizePhoneNumber(profile?.phone),
      birthDate: normalizeBirthDate(profile?.birthDate)
    };
  }

  function getProfileValueForField(fieldType, profile) {
    if (!fieldType || !profile) {
      return "";
    }

    if (fieldType === "residentRegistrationDigit") {
      return deriveResidentRegistrationDigit(profile);
    }

    return profile[fieldType] || "";
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

  function normalizeBirthDateValueForElement(element, rawValue) {
    const normalized = normalizeBirthDate(rawValue);
    if (!normalized) {
      return "";
    }

    if (element instanceof HTMLInputElement && element.type === "date") {
      return normalized;
    }

    const digits = normalized.replace(/\D/g, "");
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return normalized;
    }

    const context = [
      element.placeholder,
      element.name,
      element.id,
      element.getAttribute("aria-label"),
      ContentApp.readLabelText(element),
      ContentApp.readNearbyText(element)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const maxLength = ContentApp.getElementMaxLength(element);
    if (
      maxLength > 0 && maxLength <= 6 ||
      /6자리|yymmdd|주민등록번호앞|주민번호앞|생년월일6/.test(context.replace(/\s+/g, ""))
    ) {
      return digits.slice(2);
    }

    if (
      maxLength === 8 ||
      /yyyymmdd|8자리/.test(context.replace(/\s+/g, ""))
    ) {
      return digits;
    }

    return normalized;
  }

  function normalizeResidentRegistrationDigit(rawValue) {
    return toSafeText(rawValue).replace(/\D/g, "").slice(0, 1);
  }

  function deriveResidentRegistrationDigit(profile) {
    const birthDate = normalizeBirthDate(profile?.birthDate);
    if (!birthDate) {
      return "";
    }

    const canonicalGender = ContentApp.getCanonicalFieldValue("gender", profile?.gender);
    if (canonicalGender !== "남성" && canonicalGender !== "여성") {
      return "";
    }

    const year = Number(birthDate.slice(0, 4));
    if (!Number.isInteger(year)) {
      return "";
    }

    if (year >= 2000) {
      return canonicalGender === "남성" ? "3" : "4";
    }

    return canonicalGender === "남성" ? "1" : "2";
  }

  Object.assign(ContentApp, {
    loadSettings,
    normalizeSettings,
    normalizeProfileRecord,
    hasLegacyProfileData,
    toSafeText,
    normalizeProfile,
    getProfileValueForField,
    normalizePhoneNumber,
    normalizeBirthDate,
    normalizeBirthDateValueForElement,
    normalizeResidentRegistrationDigit,
    deriveResidentRegistrationDigit
  });
})(globalThis);
