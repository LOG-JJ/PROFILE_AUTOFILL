(function initPopupRepository(globalScope) {
  const PopupApp = globalScope.ProfileAutofillPopup || (globalScope.ProfileAutofillPopup = {});
  const { STORAGE_KEY, ProfileDomainService } = PopupApp;

  class SettingsRepository {
    async load() {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      return ProfileDomainService.normalizeSettings(stored[STORAGE_KEY]);
    }

    async save(settings) {
      await chrome.storage.local.set({
        [STORAGE_KEY]: ProfileDomainService.serializeSettings(settings)
      });
    }
  }

  PopupApp.SettingsRepository = SettingsRepository;
})(globalThis);
