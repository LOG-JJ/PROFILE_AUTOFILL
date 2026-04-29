(function bootstrapContent(globalScope) {
  const ContentApp = globalScope.ProfileAutofillContent || (globalScope.ProfileAutofillContent = {});

  if (shouldSkipBootstrap()) {
    return;
  }

  const controller = new ContentApp.FormAssistantController();

  controller.init();

  function shouldSkipBootstrap() {
    if (globalScope.location?.protocol !== "file:") {
      return false;
    }

    if (document.body?.dataset?.paaPopupRoot === "true") {
      return true;
    }

    const path = (globalScope.location?.pathname || "").toLowerCase();
    if (path.endsWith("/popup.html") || path.endsWith("\\popup.html")) {
      return true;
    }

    return Boolean(
      document.getElementById("profile-form") &&
      document.querySelector("script[src*='popup/']")
    );
  }
})(globalThis);
