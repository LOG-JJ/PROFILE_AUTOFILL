(function initContentConstants(globalScope) {
  const ContentApp = globalScope.ProfileAutofillContent || (globalScope.ProfileAutofillContent = {});

  ContentApp.STORAGE_KEY = "profileAutofillSettings";
  ContentApp.FIELD_TYPES = [
    "fullName",
    "email",
    "phone",
    "carrier",
    "birthDate",
    "residentRegistrationDigit",
    "company",
    "gender",
    "postalCode",
    "addressLine1",
    "addressLine2"
  ];

  ContentApp.LABELS = {
    fullName: "이름",
    email: "이메일",
    phone: "전화번호",
    birthDate: "생년월일",
    residentRegistrationDigit: "주민등록번호 뒷자리 첫 숫자",
    company: "회사명",
    postalCode: "우편번호",
    addressLine1: "주소",
    addressLine2: "상세 주소",
    carrier: "통신사",
    gender: "성별"
  };

  ContentApp.RULES = {
    fullName: ["name", "full name", "fullname", "realname", "성명", "이름", "받는분", "받는 사람", "수령인"],
    email: ["email", "e-mail", "mail", "이메일"],
    phone: ["phone", "mobile", "tel", "contact", "휴대폰", "전화", "연락처", "핸드폰"],
    birthDate: ["birth", "birthday", "birthdate", "date of birth", "dob", "생년월일", "생일", "출생"],
    company: ["company", "organization", "office", "employer", "직장", "회사", "기관", "상호"],
    postalCode: ["postal", "postcode", "post code", "zip", "zipcode", "우편번호"],
    addressLine1: ["address", "addr", "street", "shipping", "delivery", "road", "주소", "배송지", "도로명"],
    addressLine2: [
      "address2",
      "address line 2",
      "address detail",
      "detail address",
      "addr2",
      "addr detail",
      "detail",
      "suite",
      "apt",
      "unit",
      "room",
      "floor",
      "상세주소",
      "주소상세",
      "상세 주소",
      "나머지주소",
      "나머지 주소",
      "동호수",
      "동 호수",
      "동/호수",
      "호수",
      "호실",
      "층호"
    ],
    carrier: [
      "carrier",
      "telecom",
      "telecommunications",
      "provider",
      "mobile carrier",
      "mobile provider",
      "network",
      "통신사",
      "이동통신",
      "가입통신사",
      "skt",
      "kt",
      "lgu+"
    ],
    gender: [
      "gender",
      "sex",
      "male",
      "female",
      "성별",
      "남성",
      "여성",
      "남자",
      "여자"
    ],
    residentRegistrationDigit: [
      "주민등록번호",
      "주민번호",
      "민번",
      "rrn",
      "등록번호",
      "뒷자리",
      "뒤1자리",
      "첫번째자리",
      "first digit"
    ]
  };

  ContentApp.AUTOCOMPLETE_MAP = {
    name: "fullName",
    "given-name": "fullName",
    "family-name": "fullName",
    email: "email",
    tel: "phone",
    bday: "birthDate",
    birthday: "birthDate",
    organization: "company",
    "postal-code": "postalCode",
    "street-address": "addressLine1",
    "address-line1": "addressLine1",
    "address-line2": "addressLine2",
    sex: "gender",
    gender: "gender"
  };

  ContentApp.CREDENTIAL_AUTOCOMPLETE_FIELD_NAMES = new Set([
    "username",
    "current-password",
    "new-password",
    "one-time-code",
    "webauthn"
  ]);

  ContentApp.ADDRESS_SEARCH_PROVIDER_HOSTS = [
    "postcode.map.kakao.com",
    "postcode.map.daum.net",
    "spi.maps.daum.net",
    "business.juso.go.kr",
    "www.juso.go.kr",
    "juso.go.kr"
  ];

  ContentApp.SELECT_VALUE_ALIASES = {
    carrier: {
      SKT: ["skt", "sktelecom", "sk telecom", "에스케이티", "sk7", "tworld", "t world"],
      KT: ["kt", "케이티", "ktm"],
      "LGU+": ["lgu+", "lg u+", "lg유플러스", "유플러스", "u+", "uplus", "lg u plus", "lguplus", "lgt"],
      "SKT 알뜰폰": ["skt알뜰폰", "skt 알뜰폰", "sktmvno", "skt mvno", "sk알뜰폰", "알뜰폰skt"],
      "KT 알뜰폰": ["kt알뜰폰", "kt 알뜰폰", "ktmvno", "kt mvno", "케이티알뜰폰", "알뜰폰kt"],
      "LGU+ 알뜰폰": ["lgu+알뜰폰", "lgu+ 알뜰폰", "lguplus알뜰폰", "lg유플러스알뜰폰", "lg u+ 알뜰폰", "u+알뜰폰", "유플러스알뜰폰", "알뜰폰lgu+"]
    },
    gender: {
      "남성": ["남성", "남자", "남", "male", "man", "m"],
      "여성": ["여성", "여자", "여", "female", "woman", "f"]
    }
  };

  ContentApp.KNOWN_PHONE_PREFIXES = new Set(["010", "011", "016", "017", "018", "019", "070"]);
  ContentApp.DEFAULT_PROFILE = {
    fullName: "",
    email: "",
    phone: "",
    carrier: "",
    birthDate: "",
    company: "",
    gender: "",
    postalCode: "",
    addressLine1: "",
    addressLine2: ""
  };

  ContentApp.state = {
    settings: null,
    activeElement: null,
    activeSuggestion: null,
    overlayRoot: null,
    overlay: null,
    overlayTrackFrame: null,
    overlayCurrentX: null,
    overlayCurrentY: null,
    overlayTargetX: null,
    overlayTargetY: null,
    highlightedElement: null,
    mutationObserver: null,
    autoAgreeTimer: null
  };
})(globalThis);
