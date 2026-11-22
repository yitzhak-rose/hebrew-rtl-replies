# hebrew-rtl

<div dir="rtl">

תוסף ל-Claude Code באפליקציית Claude למחשב (לשונית Code): התשובות של Claude בעברית מוצגות **מימין לשמאל**, מיושרות לימין, עם סימני פיסוק במקום הנכון. קוד, טבלאות ופסקאות באנגלית נשארים משמאל לימין.

בלי התוסף, תשובה בעברית מוצגת משמאל לימין: השורות מיושרות לשמאל, נקודות וסוגריים קופצים לצד הלא נכון, ומילים באנגלית בתוך משפט בעברית מבלבלות את הסדר.

## התקנה

**באפליקציה למחשב:** לחצו על **+** ליד תיבת ההודעה ← **Plugins** ← **Add marketplace**, הקלידו `yitzhak-rose/hebrew-rtl`, ואז **Add plugin** ובחרו ב-hebrew-rtl.

**בטרמינל:**

</div>

```
/plugin install hebrew-rtl --marketplace yitzhak-rose/hebrew-rtl
```

<div dir="rtl">

אחרי ההתקנה סגרו ופתחו מחדש את האפליקציה.

## מה מטופל

- פסקאות שנפתחות באות עברית, או שרובן עברית, מוצגות מימין לשמאל. שאר הפסקאות לא משתנות.
- מילים באנגלית בתוך משפט בעברית נשארות צמודות ובסדר שלהן: `GitHub Actions`, `Node.js + PostgreSQL`, `O(n log n)`, `PEP 701`.
- תחיליות כמו ב-, ו-, ה-, כש- לפני מילה באנגלית: ב-React.
- נקודה, פסיק, נקודתיים וסימן שאלה אחרי מילה באנגלית חוזרים לצד הנכון של המשפט.
- מספרים, תאריכים, שעות, אחוזים ומחירים: `22/11/2026`, `14:30`, `17.5%`, `₪1,250`.
- מודגש, נטוי, מחוק, `קוד בתוך שורה`, קישורים, תמונות (כקישור), כתובות אינטרנט.
- כותרות, רשימות, רשימות מקוננות, תיבות סימון (☑ ☐), ציטוטים וקו מפריד.
- בלוקי קוד וטבלאות נשארים כמו שהאפליקציה מציגה אותם.
- עובד גם בערבית ובשפות אחרות שנכתבות מימין לשמאל.

## מגבלות ידועות

- רק באפליקציה למחשב. בטרמינל אין צורך, כי הוא מסדר עברית בעצמו. VS Code והטלפון לא נבדקו, ולכן התוסף לא פועל שם.
- הגופן בפסקאות בעברית שונה מעט מהגופן הרגיל של האפליקציה, וקוד בתוך שורה מוצג בלי רקע אפור.
- רק התשובות של Claude מושפעות. ההודעות שאתם כותבים נשארות כמו שהן.
- שורה ארוכה של אנגלית בלבד בתוך פסקה בעברית נשברת כמו טקסט באנגלית.

## משוב ודיווח על תקלות

משהו מוצג לא נכון, או שיש לכם רעיון? [פתחו Issue](https://github.com/yitzhak-rose/hebrew-rtl/issues/new). כדי שיהיה אפשר לתקן, צרפו צילום מסך ואת הטקסט שהוצג לא נכון (אפשר להעתיק אותו מהתשובה של Claude).

## הסרת אחריות

**התוסף ניתן בחינם, "כמות שהוא" (AS IS), ללא אחריות מכל סוג.** השימוש בו הוא באחריותכם בלבד. היוצר אינו אחראי לשום נזק, תקלה, אובדן מידע או כל תוצאה אחרת שנובעים מהתוסף, מהשימוש בו או מחוסר היכולת להשתמש בו, ישירות או בעקיפין, גם אם הוא ידע על אפשרות כזו. אין התחייבות לתמיכה, לתיקונים או לעדכונים. התוסף אינו מוצר רשמי של Anthropic ואינו קשור אליה. הנוסח המחייב הוא של רישיון MIT בקובץ [LICENSE](LICENSE).

</div>

---

## English

A plugin for Claude Code in the Claude desktop app (Code tab). It draws Claude's Hebrew replies right to left, aligned right, with punctuation where it belongs. Code blocks, tables and English paragraphs stay left to right. Arabic and other right-to-left scripts work too.

**Install (desktop app):** click **+** next to the prompt box → **Plugins** → **Add marketplace** → `yitzhak-rose/hebrew-rtl` → **Add plugin**. Then restart the app.

**Install (terminal):** `/plugin install hebrew-rtl --marketplace yitzhak-rose/hebrew-rtl`

**How it works.** A `ui.render` hook on `AssistantMessage` (desktop surface only) cuts the reply into blocks. Fences, tables and left-to-right paragraphs go back to the app's own Markdown renderer. A right-to-left paragraph is cut into lines, and each line into items: a right-to-left word, a run of English kept together with the symbols, numbers and brackets inside it, a number, a symbol, or a link. The items are laid out in a `row-reverse` wrapping row, so lines start and wrap at the right edge. Each item's text is wrapped in Unicode embedding marks (RLE/LRE … PDF) so its letters order correctly. The parsing logic is in `hooks/rtl.ts`; drawing is in `hooks/register.tsx`.

**Tests:** `claude plugin test .` (unit tests for the parser in `test/rtl.test.ts`, render tests in `test/render.test.tsx`).

**Limitations:** desktop app only; slightly different font in right-to-left paragraphs; inline code has no background there; only Claude's replies are affected.

## Feedback

Something drawn wrong, or an idea? [Open an issue](https://github.com/yitzhak-rose/hebrew-rtl/issues/new) with a screenshot and the text that was drawn wrong (copy it from Claude's reply).

## Disclaimer

**This plugin is provided free of charge, "AS IS", without warranty of any kind.** You use it entirely at your own risk. The author is not liable for any damage, malfunction, data loss or other consequence arising from the plugin, its use or inability to use it, whether direct or indirect, even if advised of the possibility. No support, fixes or updates are promised. This is not an official Anthropic product and is not affiliated with Anthropic. The binding terms are those of the MIT License in [LICENSE](LICENSE).

License: MIT.
