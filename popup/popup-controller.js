(function initPopupController(globalScope) {
  const PopupApp = globalScope.ProfileAutofillPopup || (globalScope.ProfileAutofillPopup = {});
  const {
    DEFAULT_STATUS_MESSAGE,
    ProfileDomainService
  } = PopupApp;

  class PopupController {
    constructor(view, repository) {
      this.view = view;
      this.repository = repository;
      this.state = {
        settings: ProfileDomainService.normalizeSettings(null),
        statusTimer: null,
        deleteConfirmTimer: null,
        deleteArmedProfileId: "",
        openPickerKey: ""
      };
    }

    async init() {
      this.view.bind(this);
      this.state.settings = await this.repository.load();
      this.render();
      this.setStatus(DEFAULT_STATUS_MESSAGE);
    }

    render() {
      this.view.render(this.state.settings, {
        deleteArmedProfileId: this.state.deleteArmedProfileId
      });

      if (this.state.openPickerKey) {
        if (this.view.isPickerDisabled(this.state.openPickerKey)) {
          this.closePicker(this.state.openPickerKey);
        } else {
          this.view.updatePickerPlacement(this.state.openPickerKey);
        }
      }
    }

    async handleSubmit(event) {
      event.preventDefault();

      this.closeAllPickers();
      this.clearDeleteConfirmation();
      this.applyFormStateToSettings({ createIfMissing: true });
      await this.persistSettings();
      this.render();
      this.setStatus("현재 프로필을 저장했고 바로 자동완성에 반영됩니다.", "success");
    }

    async handleCreateProfile() {
      this.closeAllPickers();
      this.clearDeleteConfirmation();
      this.applyFormStateToSettings();

      const newProfile = ProfileDomainService.createEmptyProfileRecord(this.state.settings.profiles);
      this.state.settings.profiles = [newProfile, ...this.state.settings.profiles];
      this.state.settings.activeProfileId = newProfile.id;

      await this.persistSettings();
      this.render();
      this.view.focusProfileName();
      this.setStatus("새 프로필을 만들었습니다. 필요한 정보를 입력한 뒤 저장하세요.");
    }

    async handleDeleteProfile() {
      const activeProfile = ProfileDomainService.getActiveProfile(this.state.settings);
      if (!activeProfile) {
        return;
      }

      this.closeAllPickers();
      if (this.state.deleteArmedProfileId !== activeProfile.id) {
        this.armDeleteConfirmation(activeProfile);
        return;
      }

      this.clearDeleteConfirmation(true);
      this.syncGlobalSettingsFromView();

      const activeProfileIndex = this.state.settings.profiles.findIndex((profile) => profile.id === activeProfile.id);
      const remainingProfiles = this.state.settings.profiles.filter((profile) => profile.id !== activeProfile.id);
      const nextActiveProfile = remainingProfiles.length > 0
        ? remainingProfiles[Math.min(activeProfileIndex, remainingProfiles.length - 1)]
        : null;

      this.state.settings.profiles = remainingProfiles;
      this.state.settings.activeProfileId = nextActiveProfile?.id || "";

      await this.persistSettings();
      this.render();
      this.setStatus(
        nextActiveProfile
          ? "프로필을 삭제했습니다."
          : "프로필을 모두 삭제했습니다. 새 프로필을 추가해 다시 사용할 수 있습니다."
      );
    }

    handlePickerToggle(key, event) {
      event.preventDefault();

      if (this.state.openPickerKey === key) {
        this.closePicker(key);
        return;
      }

      this.openPicker(key);
    }

    async handleProfilePickerClick(event) {
      const targetOption = event.target.closest("button[data-profile-id]");
      if (!targetOption) {
        return;
      }

      const targetProfileId = targetOption.dataset.profileId;
      if (!targetProfileId || targetProfileId === this.state.settings.activeProfileId) {
        this.closePicker("profile");
        return;
      }

      this.closeAllPickers();
      this.clearDeleteConfirmation();
      this.applyFormStateToSettings();
      this.state.settings.activeProfileId = targetProfileId;
      await this.persistSettings();
      this.render();
      this.setStatus("선택한 프로필로 전환했습니다.");
    }

    handleSelectPickerClick(key, event) {
      const targetOption = event.target.closest("button[data-value]");
      if (!targetOption) {
        return;
      }

      this.view.setSelectValue(key, targetOption.dataset.value || "");
      this.view.renderSelectPicker(key);
      this.closePicker(key);
    }

    handleDocumentPointerDown(event) {
      if (!this.state.openPickerKey) {
        return;
      }

      if (this.view.containsPickerTarget(this.state.openPickerKey, event.target)) {
        return;
      }

      this.closeAllPickers();
    }

    handleGlobalKeydown(event) {
      if (event.key !== "Escape" || !this.state.openPickerKey) {
        return;
      }

      const activeKey = this.state.openPickerKey;
      this.closeAllPickers();
      this.view.focusPickerTrigger(activeKey);
    }

    openPicker(key) {
      if (this.view.isPickerDisabled(key)) {
        return;
      }

      this.closeAllPickers(key);
      this.state.openPickerKey = key;
      this.view.setPickerOpenState(key, true);
      this.view.updatePickerPlacement(key);
    }

    closePicker(key) {
      this.view.setPickerOpenState(key, false);
      if (this.state.openPickerKey === key) {
        this.state.openPickerKey = "";
      }
    }

    closeAllPickers(exceptKey = "") {
      Object.keys(this.view.pickerConfigs).forEach((key) => {
        if (key === exceptKey) {
          return;
        }

        this.closePicker(key);
      });
    }

    syncGlobalSettingsFromView() {
      const nextGlobalSettings = this.view.readGlobalSettings();
      this.state.settings.enableSuggestions = nextGlobalSettings.enableSuggestions;
      this.state.settings.autoAgreeTerms = nextGlobalSettings.autoAgreeTerms;
    }

    applyFormStateToSettings({ createIfMissing = false } = {}) {
      this.syncGlobalSettingsFromView();

      let activeProfile = ProfileDomainService.getActiveProfile(this.state.settings);
      if (!activeProfile) {
        if (!createIfMissing) {
          return null;
        }

        const formValues = this.view.readProfileForm();
        activeProfile = ProfileDomainService.createEmptyProfileRecord(
          this.state.settings.profiles,
          ProfileDomainService.sanitizeProfileName(formValues.profileName)
            || ProfileDomainService.getNextProfileName(this.state.settings.profiles)
        );
        this.state.settings.profiles = [...this.state.settings.profiles, activeProfile];
        this.state.settings.activeProfileId = activeProfile.id;
      }

      const formValues = this.view.readProfileForm();
      const nextProfile = {
        ...activeProfile,
        name: ProfileDomainService.sanitizeProfileName(formValues.profileName)
          || activeProfile.name
          || ProfileDomainService.getNextProfileName(this.state.settings.profiles),
        updatedAt: Date.now(),
        profile: ProfileDomainService.normalizeProfile({
          fullName: formValues.fullName,
          email: formValues.email,
          phone: formValues.phone,
          carrier: formValues.carrier,
          company: formValues.company,
          gender: formValues.gender,
          birthDate: formValues.birthDate,
          postalCode: formValues.postalCode,
          addressLine1: formValues.addressLine1,
          addressLine2: formValues.addressLine2
        })
      };

      if (this.state.settings.profiles.some((profile) => profile.id === nextProfile.id)) {
        this.state.settings.profiles = this.state.settings.profiles.map((profile) => {
          return profile.id === nextProfile.id ? nextProfile : profile;
        });
      } else {
        this.state.settings.profiles = [...this.state.settings.profiles, nextProfile];
      }

      this.state.settings.activeProfileId = nextProfile.id;
      return nextProfile;
    }

    async persistSettings() {
      this.state.settings = ProfileDomainService.normalizeSettings(this.state.settings);
      await this.repository.save(this.state.settings);
    }

    setStatus(message, tone = "idle") {
      window.clearTimeout(this.state.statusTimer);
      this.view.setStatus(message, tone);

      if (tone === "success") {
        this.state.statusTimer = window.setTimeout(() => {
          this.view.setStatus(DEFAULT_STATUS_MESSAGE, "idle");
        }, 2200);
      }
    }

    armDeleteConfirmation(activeProfile) {
      window.clearTimeout(this.state.deleteConfirmTimer);
      this.state.deleteArmedProfileId = activeProfile.id;
      this.view.syncDeleteButton(activeProfile, this.state.deleteArmedProfileId);
      this.setStatus(`"${activeProfile.name}" 프로필을 삭제하려면 삭제 버튼을 한 번 더 눌러주세요.`, "warning");

      this.state.deleteConfirmTimer = window.setTimeout(() => {
        this.clearDeleteConfirmation();
      }, 2400);
    }

    clearDeleteConfirmation(preserveStatus = false) {
      window.clearTimeout(this.state.deleteConfirmTimer);
      this.state.deleteConfirmTimer = null;
      this.state.deleteArmedProfileId = "";
      this.view.syncDeleteButton(ProfileDomainService.getActiveProfile(this.state.settings), this.state.deleteArmedProfileId);

      if (!preserveStatus && this.view.refs.status.dataset.state === "warning") {
        this.view.setStatus(DEFAULT_STATUS_MESSAGE, "idle");
      }
    }
  }

  PopupApp.PopupController = PopupController;
})(globalThis);
