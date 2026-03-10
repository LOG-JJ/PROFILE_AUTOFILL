(function bootstrapPopup(globalScope) {
  const PopupApp = globalScope.ProfileAutofillPopup || (globalScope.ProfileAutofillPopup = {});
  const app = new PopupApp.PopupController(
    new PopupApp.PopupView(document),
    new PopupApp.SettingsRepository()
  );

  app.init();
})(globalThis);
