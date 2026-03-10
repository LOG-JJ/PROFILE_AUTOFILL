# Profile Autofill Assistant ✨🧩📝

크롬 확장 프로그램으로 폼 필드 의미를 추론하고, 저장한 프로필 값을 빠르게 추천/자동 입력하는 프로젝트입니다.  
현재 구조는 `extension-load` 없이 **루트 폴더 하나만 그대로 로드**하는 방식입니다. 🚀📦

## 한눈에 보기 👀💡

- 🧠 `name`, `id`, `placeholder`, `label`, 주변 문맥을 보고 필드 의미를 추론합니다.
- 💾 팝업에서 프로필 정보를 저장하고 수정할 수 있습니다.
- 🪄 현재 포커스된 입력칸에 추천 값을 오버레이로 보여줍니다.
- ✍️ 현재 필드만 채우거나, 같은 폼의 빈 필드를 한 번에 채울 수 있습니다.
- 🔒 비밀번호/숨김 필드는 건너뜁니다.
- 🌐 `manifest.json` 기준으로 모든 사이트에서 동작할 수 있게 설정되어 있습니다.

## 현재 파일 구조 🗂️📚

```text
PROFILE_AUTOFILL/
├─ README.md
├─ manifest.json
├─ popup.html
├─ popup.css
├─ content.css
├─ demo-form.html
├─ content/
│  ├─ content-constants.js
│  ├─ content-settings.js
│  ├─ content-inference.js
│  ├─ content-normalizers.js
│  ├─ content-consent.js
│  ├─ content-overlay.js
│  ├─ content-controller.js
│  └─ content-main.js
├─ popup/
│  ├─ popup-constants.js
│  ├─ popup-domain.js
│  ├─ popup-repository.js
│  ├─ popup-view.js
│  ├─ popup-controller.js
│  └─ popup-main.js
├─ icons/
│  ├─ brand-mark.svg
│  ├─ icon-16.png
│  ├─ icon-32.png
│  ├─ icon-48.png
│  └─ icon-128.png
└─ fonts/
   └─ PretendardVariable.woff2
```

## 폴더/파일 역할 설명 🧭🛠️

### 루트 파일 🌟

- `manifest.json` 📄
  Chrome Extension Manifest V3 설정 파일입니다. 팝업, 아이콘, 권한, content script 등록 정보가 들어 있습니다.
- `popup.html` / `popup.css` 🎛️🎨
  확장 프로그램 팝업의 마크업과 스타일입니다.
- `content.css` 🖌️
  페이지 위에 뜨는 추천 오버레이 UI 스타일입니다.
- `demo-form.html` 🧪
  확장 기능을 빠르게 테스트할 수 있는 샘플 폼 페이지입니다.

### `content/` 폴더 🔍⌨️

웹페이지에 직접 주입되는 content script 모듈들입니다.

- `content-constants.js` 📌
  공통 상수 모음입니다.
- `content-settings.js` ⚙️
  저장된 설정/프로필을 불러오는 로직입니다.
- `content-inference.js` 🧠
  입력 필드 의미를 추론하는 핵심 규칙 로직입니다.
- `content-normalizers.js` 🧹
  텍스트 정규화 관련 유틸입니다.
- `content-consent.js` ✅
  자동 입력 전 사용자 의도/동의 흐름을 다룹니다.
- `content-overlay.js` 💬
  추천 오버레이를 렌더링하고 위치를 동기화합니다.
- `content-controller.js` 🎮
  포커스 변화, 입력 이벤트, 오버레이 동작을 조정합니다.
- `content-main.js` 🚀
  content script 시작점입니다.

### `popup/` 폴더 🪟🧾

확장 프로그램 팝업 내부 동작을 담당하는 모듈들입니다.

- `popup-constants.js` 📌
  팝업 전용 상수 정의입니다.
- `popup-domain.js` 🧠
  프로필 데이터 해석/가공 로직입니다.
- `popup-repository.js` 💾
  Chrome storage 저장/불러오기 로직입니다.
- `popup-view.js` 🎨
  팝업 UI 렌더링 및 DOM 반영 로직입니다.
- `popup-controller.js` 🎛️
  버튼 클릭, 저장, 삭제, 프로필 전환 같은 사용자 액션을 제어합니다.
- `popup-main.js` ▶️
  팝업 시작점입니다.

### 정적 리소스 🎁🖼️

- `icons/` 🟦
  확장 아이콘 및 브랜드 이미지입니다.
- `fonts/` 🔤
  팝업/오버레이에 사용하는 폰트 파일입니다.

## 설치 방법 🧷🚀

1. `chrome://extensions` 를 엽니다. 🌐
2. 오른쪽 위에서 **개발자 모드**를 켭니다. 🛠️
3. **압축해제된 확장 프로그램을 로드합니다** 를 누릅니다. 📂
4. **이 루트 폴더 (`PROFILE_AUTOFILL`) 자체를 선택**합니다. ✅
5. 확장 프로그램이 로드되면 팝업을 열어 프로필 정보를 저장합니다. 💾
6. 필요하면 `demo-form.html` 을 브라우저에서 열어 바로 테스트합니다. 🧪

## 동작 흐름 요약 🔄⚡

1. 🪟 팝업에서 사용자 프로필을 저장합니다.
2. 🌍 사용자가 웹페이지의 입력창에 포커스합니다.
3. 🧠 content script가 필드 의미를 추론합니다.
4. 💬 적절한 값이 있으면 오버레이로 추천합니다.
5. ✍️ 사용자는 현재 필드만 입력하거나 여러 필드를 한 번에 채울 수 있습니다.

## 개발 시 참고사항 🧑‍💻📎

- 📦 현재는 빌드 산출물 폴더를 따로 두지 않고 **루트 파일을 직접 로드**하는 구조입니다.
- 🧱 `manifest.json` 에 등록된 content script 순서는 실제 실행 순서와 연결되므로 함부로 바꾸지 않는 편이 안전합니다.
- 🧪 UI를 빠르게 확인할 때는 `demo-form.html` 이 가장 편합니다.
- 🔐 `storage` 권한만 사용하고 있으며, 프로필 데이터는 브라우저 저장소에 보관됩니다.
- 🚫 `extension-load` 폴더는 제거되었으므로, 앞으로는 루트 기준으로만 관리하면 됩니다.

## 추천 작업 순서 ✅✨

- 1. `manifest.json` 확인하기 📄
- 2. `popup/` 로 저장 로직 이해하기 💾
- 3. `content/` 로 추론/오버레이 흐름 보기 🧠💬
- 4. `demo-form.html` 로 직접 테스트하기 🧪

## 메모 📝🌈

이 프로젝트는 MVP 성격이 강해서 구조가 비교적 단순합니다.  
대신 `popup/` 과 `content/` 역할이 명확히 나뉘어 있어서, 기능 확장이나 리팩터링도 비교적 수월한 편입니다. 🙌✨
# Account-Management
