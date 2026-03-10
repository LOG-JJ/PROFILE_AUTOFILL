(function initPopupView(globalScope) {
  const PopupApp = globalScope.ProfileAutofillPopup || (globalScope.ProfileAutofillPopup = {});
  const { DEFAULT_PROFILE, PROFILE_FIELDS, ProfileDomainService } = PopupApp;

  class PopupView {
    constructor(doc) {
      this.doc = doc;
      this.refs = {
        form: doc.getElementById("profile-form"),
        status: doc.getElementById("status"),
        brandStatus: doc.getElementById("brandStatus"),
        brandStatusWrap: doc.getElementById("statusPill"),
        profileMetric: doc.getElementById("profileMetric"),
        profileBadge: doc.getElementById("profileBadge"),
        profileHint: doc.getElementById("profileHint"),
        createProfileButton: doc.getElementById("createProfileButton"),
        deleteProfileButton: doc.getElementById("deleteProfileButton"),
        enableSuggestions: doc.getElementById("enableSuggestions"),
        autoAgreeTerms: doc.getElementById("autoAgreeTerms"),
        profileSelect: doc.getElementById("profileSelect"),
        profileName: doc.getElementById("profileName"),
        fullName: doc.getElementById("fullName"),
        email: doc.getElementById("email"),
        phone: doc.getElementById("phone"),
        carrier: doc.getElementById("carrier"),
        company: doc.getElementById("company"),
        gender: doc.getElementById("gender"),
        postalCode: doc.getElementById("postalCode"),
        addressLine1: doc.getElementById("addressLine1"),
        addressLine2: doc.getElementById("addressLine2"),
        birthYear: doc.getElementById("birthYear"),
        birthMonth: doc.getElementById("birthMonth"),
        birthDay: doc.getElementById("birthDay")
      };

      this.birthDateInputs = [
        { element: this.refs.birthYear, maxLength: 4, pad: false },
        { element: this.refs.birthMonth, maxLength: 2, pad: true },
        { element: this.refs.birthDay, maxLength: 2, pad: true }
      ];

      this.pickerConfigs = {
        profile: {
          key: "profile",
          root: doc.getElementById("profilePicker"),
          trigger: doc.getElementById("profilePickerTrigger"),
          menu: doc.getElementById("profilePickerMenu"),
          valueNode: doc.getElementById("profilePickerValue"),
          metaNode: doc.getElementById("profilePickerMeta")
        },
        carrier: {
          key: "carrier",
          root: doc.getElementById("carrierPicker"),
          trigger: doc.getElementById("carrierPickerTrigger"),
          menu: doc.getElementById("carrierPickerMenu"),
          valueNode: doc.getElementById("carrierPickerValue"),
          metaNode: doc.getElementById("carrierPickerMeta"),
          input: this.refs.carrier,
          emptyLabel: "선택",
          emptyMeta: "통신사를 선택하세요",
          filledMeta: "현재 선택된 통신사"
        },
        gender: {
          key: "gender",
          root: doc.getElementById("genderPicker"),
          trigger: doc.getElementById("genderPickerTrigger"),
          menu: doc.getElementById("genderPickerMenu"),
          valueNode: doc.getElementById("genderPickerValue"),
          metaNode: doc.getElementById("genderPickerMeta"),
          input: this.refs.gender,
          emptyLabel: "선택",
          emptyMeta: "성별을 선택하세요",
          filledMeta: "현재 선택된 성별"
        }
      };
    }

    bind(controller) {
      this.setupPhoneInput();
      this.setupBirthDateInputs();

      this.refs.form.addEventListener("submit", (event) => controller.handleSubmit(event));
      this.refs.createProfileButton.addEventListener("click", () => controller.handleCreateProfile());
      this.refs.deleteProfileButton.addEventListener("click", () => controller.handleDeleteProfile());

      this.pickerConfigs.profile.trigger.addEventListener("click", (event) => controller.handlePickerToggle("profile", event));
      this.pickerConfigs.profile.menu.addEventListener("click", (event) => controller.handleProfilePickerClick(event));
      this.pickerConfigs.carrier.trigger.addEventListener("click", (event) => controller.handlePickerToggle("carrier", event));
      this.pickerConfigs.carrier.menu.addEventListener("click", (event) => controller.handleSelectPickerClick("carrier", event));
      this.pickerConfigs.gender.trigger.addEventListener("click", (event) => controller.handlePickerToggle("gender", event));
      this.pickerConfigs.gender.menu.addEventListener("click", (event) => controller.handleSelectPickerClick("gender", event));

      this.doc.addEventListener("mousedown", (event) => controller.handleDocumentPointerDown(event));
      this.doc.addEventListener("keydown", (event) => controller.handleGlobalKeydown(event));
    }

    render(settings, uiState) {
      const activeProfile = ProfileDomainService.getActiveProfile(settings);

      this.applyGlobalSettings(settings);
      this.applyProfile(activeProfile);
      this.renderProfilePicker(settings.profiles, activeProfile);
      this.renderSelectPicker("carrier");
      this.renderSelectPicker("gender");
      this.renderDashboard(settings, activeProfile);
      this.syncDeleteButton(activeProfile, uiState.deleteArmedProfileId);
    }

    applyGlobalSettings(settings) {
      this.refs.enableSuggestions.checked = Boolean(settings.enableSuggestions);
      this.refs.autoAgreeTerms.checked = Boolean(settings.autoAgreeTerms);
    }

    applyProfile(profileRecord) {
      const profile = profileRecord?.profile || DEFAULT_PROFILE;
      this.refs.profileName.value = profileRecord?.name || "";
      this.refs.fullName.value = profile.fullName || "";
      this.refs.email.value = profile.email || "";
      this.refs.phone.value = ProfileDomainService.normalizePhoneNumber(profile.phone);
      this.refs.carrier.value = profile.carrier || "";
      this.refs.company.value = profile.company || "";
      this.refs.gender.value = profile.gender || "";
      this.refs.postalCode.value = profile.postalCode || "";
      this.refs.addressLine1.value = profile.addressLine1 || "";
      this.refs.addressLine2.value = profile.addressLine2 || "";
      this.populateBirthDateInputs(profile.birthDate);
    }

    renderDashboard(settings, activeProfile) {
      const filledCount = ProfileDomainService.getFilledFieldCount(activeProfile?.profile);
      const totalCount = PROFILE_FIELDS.length;
      const completionRate = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
      const ready = Boolean(activeProfile) && filledCount >= 5;

      this.refs.profileMetric.textContent = `${settings.profiles.length}개`;
      this.refs.profileBadge.textContent = `${completionRate}%`;
      this.refs.profileHint.textContent = activeProfile
        ? `${activeProfile.name} 기준 ${filledCount}/${totalCount}개 입력됨.\n추천 오버레이 ${settings.enableSuggestions ? "ON" : "OFF"} · 전체동의 ${settings.autoAgreeTerms ? "ON" : "OFF"}`
        : "저장된 프로필이 없습니다.\n새 프로필을 추가하거나 현재 입력값을 저장해 시작하세요.";
      this.refs.brandStatus.textContent = activeProfile
        ? (ready ? "즉시 자동완성 가능" : "프로필 입력 대기")
        : "프로필 없음";
      this.refs.brandStatusWrap.dataset.state = ready ? "online" : "idle";
    }

    renderProfilePicker(profiles, activeProfile) {
      const config = this.pickerConfigs.profile;
      this.refs.profileSelect.value = activeProfile?.id || "";

      if (!profiles.length) {
        config.valueNode.textContent = "저장된 프로필 없음";
        config.metaNode.textContent = "프로필을 추가해 시작하세요";
        config.trigger.disabled = true;

        const emptyState = this.doc.createElement("div");
        emptyState.className = "profile-picker__empty";
        emptyState.textContent = "저장된 프로필이 없습니다.";
        config.menu.replaceChildren(emptyState);
        return;
      }

      config.valueNode.textContent = activeProfile?.name || "프로필 선택";
      config.metaNode.textContent = activeProfile
        ? `${ProfileDomainService.getFilledFieldCount(activeProfile.profile)}/${PROFILE_FIELDS.length}개 입력됨`
        : `${profiles.length}개 프로필 저장됨`;
      config.trigger.disabled = false;

      const fragment = this.doc.createDocumentFragment();
      profiles.forEach((profileRecord) => {
        const optionButton = this.doc.createElement("button");
        optionButton.type = "button";
        optionButton.className = "profile-picker__option";
        optionButton.dataset.profileId = profileRecord.id;
        optionButton.setAttribute("role", "option");
        optionButton.setAttribute("aria-selected", profileRecord.id === activeProfile?.id ? "true" : "false");

        if (profileRecord.id === activeProfile?.id) {
          optionButton.classList.add("is-active");
        }

        const title = this.doc.createElement("strong");
        title.className = "profile-picker__option-title";
        title.textContent = profileRecord.name;

        const meta = this.doc.createElement("span");
        meta.className = "profile-picker__option-meta";
        meta.textContent = `${ProfileDomainService.getFilledFieldCount(profileRecord.profile)}/${PROFILE_FIELDS.length}개 입력됨`;

        optionButton.append(title, meta);
        fragment.append(optionButton);
      });

      config.menu.replaceChildren(fragment);
    }

    renderSelectPicker(key) {
      const config = this.pickerConfigs[key];
      if (!config?.input) {
        return;
      }

      const options = Array.from(config.input.options).filter((option) => !option.disabled);
      const selectedOption = options.find((option) => option.value === config.input.value) || options[0] || null;

      config.valueNode.textContent = selectedOption?.textContent?.trim() || config.emptyLabel;
      config.metaNode.textContent = selectedOption?.value ? config.filledMeta : config.emptyMeta;
      config.trigger.disabled = options.length === 0;

      const fragment = this.doc.createDocumentFragment();
      options.forEach((option) => {
        const optionButton = this.doc.createElement("button");
        optionButton.type = "button";
        optionButton.className = "profile-picker__option profile-picker__option--compact";
        optionButton.dataset.value = option.value;
        optionButton.setAttribute("role", "option");
        optionButton.setAttribute("aria-selected", option.value === config.input.value ? "true" : "false");

        if (option.value === config.input.value) {
          optionButton.classList.add("is-active");
        }

        const title = this.doc.createElement("strong");
        title.className = "profile-picker__option-title";
        title.textContent = option.textContent.trim() || config.emptyLabel;

        optionButton.append(title);
        fragment.append(optionButton);
      });

      config.menu.replaceChildren(fragment);
    }

    readGlobalSettings() {
      return {
        enableSuggestions: this.refs.enableSuggestions.checked,
        autoAgreeTerms: this.refs.autoAgreeTerms.checked
      };
    }

    readProfileForm() {
      return {
        profileName: this.refs.profileName.value,
        fullName: this.refs.fullName.value.trim(),
        email: this.refs.email.value.trim(),
        phone: ProfileDomainService.normalizePhoneNumber(this.refs.phone.value),
        carrier: this.refs.carrier.value,
        company: this.refs.company.value.trim(),
        gender: this.refs.gender.value,
        birthDate: this.buildBirthDateValue(),
        postalCode: this.refs.postalCode.value.trim(),
        addressLine1: this.refs.addressLine1.value.trim(),
        addressLine2: this.refs.addressLine2.value.trim()
      };
    }

    populateBirthDateInputs(rawValue) {
      const normalized = ProfileDomainService.normalizeBirthDate(rawValue);
      if (!normalized) {
        this.refs.birthYear.value = "";
        this.refs.birthMonth.value = "";
        this.refs.birthDay.value = "";
        return;
      }

      const [year, month, day] = normalized.split("-");
      this.refs.birthYear.value = year;
      this.refs.birthMonth.value = month;
      this.refs.birthDay.value = day;
    }

    buildBirthDateValue() {
      const year = String(this.refs.birthYear.value || "").replace(/\D/g, "").slice(0, 4);
      const month = String(this.refs.birthMonth.value || "").replace(/\D/g, "").slice(0, 2);
      const day = String(this.refs.birthDay.value || "").replace(/\D/g, "").slice(0, 2);

      return ProfileDomainService.normalizeBirthDate(
        `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
      );
    }

    setStatus(message, tone = "idle") {
      this.refs.status.textContent = message;
      this.refs.status.dataset.state = tone;
    }

    syncDeleteButton(activeProfile, armedProfileId) {
      this.refs.deleteProfileButton.disabled = !activeProfile;
      this.refs.deleteProfileButton.textContent = armedProfileId && activeProfile?.id === armedProfileId
        ? "삭제 확인"
        : "삭제";
    }

    focusProfileName() {
      this.refs.profileName.focus();
      this.refs.profileName.select();
    }

    isPickerDisabled(key) {
      return Boolean(this.pickerConfigs[key]?.trigger.disabled);
    }

    containsPickerTarget(key, target) {
      return Boolean(this.pickerConfigs[key]?.root.contains(target));
    }

    focusPickerTrigger(key) {
      this.pickerConfigs[key]?.trigger.focus();
    }

    setSelectValue(key, value) {
      const input = this.pickerConfigs[key]?.input;
      if (!input) {
        return;
      }

      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    setPickerOpenState(key, isOpen) {
      const config = this.pickerConfigs[key];
      if (!config) {
        return;
      }

      config.root.dataset.open = isOpen ? "true" : "false";
      config.trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");

      const fieldNode = config.root.closest(".field");
      if (fieldNode) {
        fieldNode.classList.toggle("field--picker-open", isOpen);
      }
    }

    updatePickerPlacement(key) {
      const config = this.pickerConfigs[key];
      if (!config?.root || !config?.menu) {
        return;
      }

      const rootRect = config.root.getBoundingClientRect();
      const menuHeight = Math.min(config.menu.scrollHeight || 0, key === "profile" ? 248 : 176);
      const spaceBelow = window.innerHeight - rootRect.bottom;
      const spaceAbove = rootRect.top;
      const shouldOpenUpward = spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow;

      config.root.dataset.placement = shouldOpenUpward ? "top" : "bottom";
    }

    setupPhoneInput() {
      this.refs.phone.addEventListener("input", () => {
        const normalized = ProfileDomainService.normalizePhoneNumber(this.refs.phone.value);
        if (this.refs.phone.value !== normalized) {
          this.refs.phone.value = normalized;
        }
      });
    }

    setupBirthDateInputs() {
      this.birthDateInputs.forEach((field, index) => {
        field.element.addEventListener("input", () => {
          field.element.value = String(field.element.value || "")
            .replace(/\D/g, "")
            .slice(0, field.maxLength);

          if (field.element.value.length === field.maxLength && this.birthDateInputs[index + 1]) {
            this.birthDateInputs[index + 1].element.focus();
          }
        });

        field.element.addEventListener("blur", () => {
          if (field.pad && field.element.value.length === 1) {
            field.element.value = field.element.value.padStart(2, "0");
          }
        });

        field.element.addEventListener("keydown", (event) => {
          if (event.key === "Backspace" && !field.element.value && this.birthDateInputs[index - 1]) {
            this.birthDateInputs[index - 1].element.focus();
          }
        });
      });
    }
  }

  PopupApp.PopupView = PopupView;
})(globalThis);
