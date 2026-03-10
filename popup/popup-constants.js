(function initPopupConstants(globalScope) {
  const PopupApp = globalScope.ProfileAutofillPopup || (globalScope.ProfileAutofillPopup = {});

  PopupApp.STORAGE_KEY = "profileAutofillSettings";
  PopupApp.DEFAULT_STATUS_MESSAGE = "현재 입력값을 저장하면 현재 열린 탭에 바로 반영됩니다.";
  PopupApp.PROFILE_FIELDS = [
    "fullName",
    "email",
    "phone",
    "carrier",
    "company",
    "gender",
    "birthDate",
    "postalCode",
    "addressLine1",
    "addressLine2"
  ];

  PopupApp.DEFAULT_PROFILE = Object.freeze({
    fullName: "",
    email: "",
    phone: "",
    carrier: "",
    company: "",
    gender: "",
    birthDate: "",
    postalCode: "",
    addressLine1: "",
    addressLine2: ""
  });

  PopupApp.DEFAULT_SETTINGS = Object.freeze({
    enableSuggestions: true,
    autoAgreeTerms: false,
    activeProfileId: "",
    profiles: []
  });
})(globalThis);
