# Profile Autofill Assistant

Chrome extension MVP that infers the meaning of a focused form field and suggests a saved profile value.

## Features

- Save a basic profile in the extension popup
- Save a birth date along with the profile
- Infer fields from `name`, `id`, `placeholder`, `label`, `autocomplete`, and nearby text
- Show an overlay suggestion for the focused field
- Fill the current field or fill multiple empty fields in the same form

## Install

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select this folder
5. Open `demo-form.html` in Chrome to test the extension quickly

## Notes

- The extension skips password and hidden fields
- It only suggests values for empty inputs
- Field inference is rule-based and intended for an MVP
