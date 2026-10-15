# YouTube CC Menu — English & Turkish (1.2.0)

Version using YouTube's original CC button:

- Left-click: normal YouTube CC on/off.
- Right-click CC: native subtitle appearance reset, including size to 100%.
- Right-click the Settings cog: open Settings > Subtitles/CC directly. Left-click still opens Settings normally. Middle-click has no extension action.
- Wheel up/down: increase/decrease subtitle size.
- Hover: Size (%) label. No action popups.

In the menu opened by right-click, Off/Kapalı remains first, followed by entries containing English, İngilizce/ingilizce, Turkish or Türkçe (case and accents are normalized). Variants such as auto-generated tracks are included. The remaining languages retain their order. Reordering keeps YouTube's original rows and selection handlers; it does not select a language. Auto-translate lists reached from this menu are also prioritized.

## Load or update

Open chrome://extensions, enable Developer mode and Load unpacked

English and Turkish YouTube menu labels are supported. Videos without subtitles cannot open a subtitle language list. YouTube can change its internal menus; failures are logged to the console without popups. The extension uses no network requests, background worker, polling, or extra permissions. Menu observation runs on the opened menu and ends when it closes or YouTube navigates.
