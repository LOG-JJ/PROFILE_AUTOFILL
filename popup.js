const STORAGE_KEY = "profileAutofillSettings";

const defaultSettings = {
  enableSuggestions: true,
  autoAgreeTerms: false,
  profile: {
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
  }
};

const form = document.getElementById("profile-form");
const statusNode = document.getElementById("status");
const brandStatusNode = document.getElementById("brandStatus");
const brandStatusWrap = document.getElementById("statusPill");
const profileMetricNode = document.getElementById("profileMetric");
const profileBadgeNode = document.getElementById("profileBadge");
const profileHintNode = document.getElementById("profileHint");
const birthYearInput = document.getElementById("birthYear");
const birthMonthInput = document.getElementById("birthMonth");
const birthDayInput = document.getElementById("birthDay");
const birthDateInputs = [
  { element: birthYearInput, maxLength: 4, pad: false },
  { element: birthMonthInput, maxLength: 2, pad: true },
  { element: birthDayInput, maxLength: 2, pad: true }
];

init();

async function init() {
  setupBirthDateInputs();

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const settings = normalizeSettings(stored[STORAGE_KEY]);

  form.fullName.value = settings.profile.fullName;
  form.email.value = settings.profile.email;
  form.phone.value = normalizePhoneNumber(settings.profile.phone);
  form.carrier.value = settings.profile.carrier;
  form.company.value = settings.profile.company;
  form.gender.value = settings.profile.gender;
  populateBirthDateInputs(settings.profile.birthDate);
  form.postalCode.value = settings.profile.postalCode;
  form.addressLine1.value = settings.profile.addressLine1;
  form.addressLine2.value = settings.profile.addressLine2;
  form.enableSuggestions.checked = settings.enableSuggestions;
  form.autoAgreeTerms.checked = settings.autoAgreeTerms;
  updateDashboard(settings);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const settings = {
    enableSuggestions: form.enableSuggestions.checked,
    autoAgreeTerms: form.autoAgreeTerms.checked,
    profile: {
      fullName: form.fullName.value.trim(),
      email: form.email.value.trim(),
      phone: normalizePhoneNumber(form.phone.value),
      carrier: form.carrier.value,
      company: form.company.value.trim(),
      gender: form.gender.value,
      birthDate: buildBirthDateValue(),
      postalCode: form.postalCode.value.trim(),
      addressLine1: form.addressLine1.value.trim(),
      addressLine2: form.addressLine2.value.trim()
    }
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  updateDashboard(settings);
  statusNode.textContent = "저장이 완료되어 현재 열린 탭에 즉시 반영됩니다.";
  statusNode.dataset.state = "success";

  window.setTimeout(() => {
    if (statusNode.dataset.state === "success") {
      statusNode.textContent = "저장하면 현재 열린 탭에 바로 반영됩니다.";
      statusNode.dataset.state = "idle";
    }
  }, 1800);
});

function normalizeSettings(rawSettings) {
  const rawProfile = rawSettings?.profile || {};

  return {
    ...defaultSettings,
    ...(rawSettings || {}),
    profile: {
      ...defaultSettings.profile,
      ...rawProfile,
      phone: normalizePhoneNumber(rawProfile.phone || ""),
      birthDate: normalizeBirthDate(rawProfile.birthDate || "")
    }
  };
}

function normalizeBirthDate(rawValue) {
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

function normalizePhoneNumber(rawValue) {
  return String(rawValue || "").replace(/\D/g, "");
}

function updateDashboard(settings) {
  const profileEntries = Object.values(settings.profile || {});
  const filledCount = profileEntries.filter((value) => Boolean(String(value || "").trim())).length;
  const totalCount = profileEntries.length;
  const completionRate = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
  const online = filledCount >= 5;

  profileMetricNode.textContent = `${filledCount} / ${totalCount}`;
  profileBadgeNode.textContent = `${completionRate}%`;
  profileHintNode.textContent = `${filledCount}개 항목 저장됨.\n추천 오버레이 ${settings.enableSuggestions ? "ON" : "OFF"} · 전체동의 ${settings.autoAgreeTerms ? "ON" : "OFF"}`;
  brandStatusNode.textContent = online ? "온라인 상태" : "프로필 입력 대기";
  brandStatusWrap.dataset.state = online ? "online" : "idle";
}

function setupBirthDateInputs() {
  birthDateInputs.forEach((field, index) => {
    field.element.addEventListener("input", () => {
      field.element.value = String(field.element.value || "")
        .replace(/\D/g, "")
        .slice(0, field.maxLength);

      if (field.element.value.length === field.maxLength && birthDateInputs[index + 1]) {
        birthDateInputs[index + 1].element.focus();
      }
    });

    field.element.addEventListener("blur", () => {
      if (field.pad && field.element.value.length === 1) {
        field.element.value = field.element.value.padStart(2, "0");
      }
    });

    field.element.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !field.element.value && birthDateInputs[index - 1]) {
        birthDateInputs[index - 1].element.focus();
      }
    });
  });
}

function populateBirthDateInputs(rawValue) {
  const normalized = normalizeBirthDate(rawValue);
  if (!normalized) {
    birthYearInput.value = "";
    birthMonthInput.value = "";
    birthDayInput.value = "";
    return;
  }

  const [year, month, day] = normalized.split("-");
  birthYearInput.value = year;
  birthMonthInput.value = month;
  birthDayInput.value = day;
}

function buildBirthDateValue() {
  const year = String(birthYearInput.value || "").replace(/\D/g, "").slice(0, 4);
  const month = String(birthMonthInput.value || "").replace(/\D/g, "").slice(0, 2);
  const day = String(birthDayInput.value || "").replace(/\D/g, "").slice(0, 2);

  return normalizeBirthDate(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
}
