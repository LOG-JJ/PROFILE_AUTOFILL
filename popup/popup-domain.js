(function initPopupDomain(globalScope) {
  const PopupApp = globalScope.ProfileAutofillPopup || (globalScope.ProfileAutofillPopup = {});
  const {
    DEFAULT_PROFILE,
    DEFAULT_SETTINGS,
    PROFILE_FIELDS
  } = PopupApp;

  class ProfileDomainService {
    static normalizeSettings(rawSettings) {
      const hasProfilesArray = Array.isArray(rawSettings?.profiles);
      const profiles = hasProfilesArray
        ? rawSettings.profiles
          .filter(Boolean)
          .map((profile, index) => ProfileDomainService.normalizeProfileRecord(profile, index))
        : [];

      if (!hasProfilesArray && ProfileDomainService.hasLegacyProfileData(rawSettings)) {
        profiles.push(
          ProfileDomainService.normalizeProfileRecord(
            {
              id: rawSettings?.activeProfileId,
              name: rawSettings?.profileName || "기본 프로필",
              profile: rawSettings?.profile || {}
            },
            0,
            "기본 프로필"
          )
        );
      }

      const preferredId = typeof rawSettings?.activeProfileId === "string" ? rawSettings.activeProfileId : "";
      const activeProfile = ProfileDomainService.getProfileById(profiles, preferredId) || profiles[0] || null;

      return {
        ...DEFAULT_SETTINGS,
        enableSuggestions: rawSettings?.enableSuggestions ?? DEFAULT_SETTINGS.enableSuggestions,
        autoAgreeTerms: rawSettings?.autoAgreeTerms ?? DEFAULT_SETTINGS.autoAgreeTerms,
        activeProfileId: activeProfile?.id || "",
        profiles
      };
    }

    static serializeSettings(settings) {
      const normalized = ProfileDomainService.normalizeSettings(settings);
      const activeProfile = ProfileDomainService.getActiveProfile(normalized);

      return {
        enableSuggestions: normalized.enableSuggestions,
        autoAgreeTerms: normalized.autoAgreeTerms,
        activeProfileId: activeProfile?.id || "",
        profiles: normalized.profiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
          updatedAt: profile.updatedAt,
          profile: { ...profile.profile }
        })),
        profileName: activeProfile?.name || "",
        profile: { ...(activeProfile?.profile || DEFAULT_PROFILE) }
      };
    }

    static normalizeProfileRecord(rawProfile, index, fallbackName = "") {
      const profileSource = rawProfile?.profile && typeof rawProfile.profile === "object"
        ? rawProfile.profile
        : rawProfile || {};
      const safeId = typeof rawProfile?.id === "string" && rawProfile.id.trim()
        ? rawProfile.id.trim()
        : ProfileDomainService.generateProfileId();
      const safeName = ProfileDomainService.sanitizeProfileName(rawProfile?.name)
        || fallbackName
        || `프로필 ${index + 1}`;

      return {
        id: safeId,
        name: safeName,
        updatedAt: Number.isFinite(rawProfile?.updatedAt) ? rawProfile.updatedAt : Date.now(),
        profile: ProfileDomainService.normalizeProfile(profileSource)
      };
    }

    static normalizeProfile(rawProfile) {
      return {
        ...DEFAULT_PROFILE,
        ...(rawProfile || {}),
        phone: ProfileDomainService.normalizePhoneNumber(rawProfile?.phone || ""),
        birthDate: ProfileDomainService.normalizeBirthDate(rawProfile?.birthDate || "")
      };
    }

    static hasLegacyProfileData(rawSettings) {
      if (!rawSettings || Array.isArray(rawSettings.profiles)) {
        return false;
      }

      if (ProfileDomainService.sanitizeProfileName(rawSettings.profileName)) {
        return true;
      }

      return PROFILE_FIELDS.some((fieldName) => {
        return Boolean(String(rawSettings?.profile?.[fieldName] || "").trim());
      });
    }

    static getActiveProfile(settings) {
      return ProfileDomainService.getProfileById(settings?.profiles, settings?.activeProfileId)
        || settings?.profiles?.[0]
        || null;
    }

    static getProfileById(profiles, profileId) {
      return (profiles || []).find((profile) => profile.id === profileId) || null;
    }

    static getFilledFieldCount(profile) {
      return PROFILE_FIELDS.filter((fieldName) => Boolean(String(profile?.[fieldName] || "").trim())).length;
    }

    static createEmptyProfileRecord(existingProfiles, preferredName = "") {
      return {
        id: ProfileDomainService.generateProfileId(),
        name: preferredName || ProfileDomainService.getNextProfileName(existingProfiles),
        updatedAt: Date.now(),
        profile: { ...DEFAULT_PROFILE }
      };
    }

    static getNextProfileName(existingProfiles) {
      const nameSet = new Set((existingProfiles || []).map((profile) => ProfileDomainService.sanitizeProfileName(profile.name)));
      let index = 1;

      while (nameSet.has(`프로필 ${index}`)) {
        index += 1;
      }

      return `프로필 ${index}`;
    }

    static sanitizeProfileName(rawValue) {
      return String(rawValue || "").replace(/\s+/g, " ").trim();
    }

    static normalizeBirthDate(rawValue) {
      if (!rawValue) {
        return "";
      }

      const digits = String(rawValue).replace(/\D/g, "");
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

    static normalizePhoneNumber(rawValue) {
      return String(rawValue || "").replace(/\D/g, "").slice(0, 11);
    }

    static generateProfileId() {
      return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  PopupApp.ProfileDomainService = ProfileDomainService;
})(globalThis);
