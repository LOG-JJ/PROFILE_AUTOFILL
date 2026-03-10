(function initContentController(globalScope) {
  const ContentApp = globalScope.ProfileAutofillContent || (globalScope.ProfileAutofillContent = {});
  const { state } = ContentApp;

  class FormAssistantController {
    async init() {
      state.settings = await ContentApp.loadSettings();

      chrome.storage.onChanged.addListener((changes, areaName) => {
        this.handleStorageChange(changes, areaName);
      });

      document.addEventListener("focusin", (event) => this.handleFocusIn(event), true);
      document.addEventListener("input", (event) => this.handleInput(event), true);
      document.addEventListener("scroll", () => this.handleViewportChange(), true);
      window.addEventListener("resize", () => this.handleViewportChange());
      document.addEventListener("change", (event) => this.handleDocumentChange(event), true);

      ContentApp.observeDomChanges();
      ContentApp.queueAutoAgree();
    }

    handleStorageChange(changes, areaName) {
      if (areaName !== "local" || !changes[ContentApp.STORAGE_KEY]) {
        return;
      }

      state.settings = ContentApp.normalizeSettings(changes[ContentApp.STORAGE_KEY].newValue);
      if (state.activeElement) {
        ContentApp.refreshSuggestion(state.activeElement);
      }

      ContentApp.queueAutoAgree();
    }

    handleFocusIn(event) {
      const target = event.target;
      if (ContentApp.isOverlayElement(target)) {
        return;
      }

      if (!ContentApp.isFillableElement(target)) {
        state.activeElement = null;
        ContentApp.hideOverlay();
        return;
      }

      state.activeElement = target;
      ContentApp.refreshSuggestion(target);
    }

    handleInput(event) {
      if (event.target !== state.activeElement) {
        return;
      }

      ContentApp.refreshSuggestion(event.target);
    }

    handleDocumentChange(event) {
      if (ContentApp.isOverlayElement(event.target)) {
        return;
      }

      ContentApp.queueAutoAgree();
    }

    handleViewportChange() {
      ContentApp.syncOverlayTargetPosition();
    }
  }

  ContentApp.FormAssistantController = FormAssistantController;
})(globalThis);
