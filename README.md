# YouTube CC Menu — English & Turkish (1.2.0)

Brother's version using YouTube's original CC button:

- Left-click: normal YouTube CC on/off.
- Right-click CC: native subtitle appearance reset, including size to 100%.
- Right-click the Settings cog: open Settings > Subtitles/CC directly. Left-click still opens Settings normally. Middle-click has no extension action.
- Wheel up/down: increase/decrease subtitle size.
- Hover: Size (%) label. No action popups.

In the menu opened by right-click, Off/Kapalı remains first, followed by entries containing English, İngilizce/ingilizce, Turkish or Türkçe (case and accents are normalized). Variants such as auto-generated tracks are included. The remaining languages retain their order. Reordering keeps YouTube's original rows and selection handlers; it does not select a language. Auto-translate lists reached from this menu are also prioritized.

## Load or update

Open chrome://extensions, enable Developer mode and Load unpacked:
D:\Chrome-extensions\youtube-cc-reset_right-click\youtube-native-cc

If this folder is already loaded, click Reload on its extension card. Refresh YouTube afterward. Disable other versions of this CC extension while testing this one. Your usual version in D:\Chrome-extensions\youtube-cc-reset\youtube-native-cc is unchanged.

The reset still resets all subtitle appearance options, just as the earlier right-click reset did. It does not change the chosen language or CC on/off state.

English and Turkish YouTube menu labels are supported. Videos without subtitles cannot open a subtitle language list. YouTube can change its internal menus; failures are logged to the console without popups. The extension uses no network requests, background worker, polling, or extra permissions. Menu observation runs on the opened menu and ends when it closes or YouTube navigates.

## Validation

node --test tests/package.test.cjs
node tests/serve.cjs

Open http://127.0.0.1:8765/tests/browser.html for 18 simulated-player browser checks. Three package checks validate manifest, script syntax and icons. Live YouTube verification is still needed after loading in your Chrome profile.
