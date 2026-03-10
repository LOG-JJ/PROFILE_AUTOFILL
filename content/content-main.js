(function bootstrapContent(globalScope) {
  const ContentApp = globalScope.ProfileAutofillContent || (globalScope.ProfileAutofillContent = {});
  const controller = new ContentApp.FormAssistantController();

  controller.init();
})(globalThis);
