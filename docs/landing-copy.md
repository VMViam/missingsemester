# Landing page copy deck

Every word on **missingsemester.in** in reading order. This is the whole page in
one place.

**How to use it:** rewrite anything below — keep the headings — and tell me when
you're done. I'll apply it, rebuild, and show you the page again before deploying.
You can also edit `src/data/landing.ts` directly; that is the file the page
actually reads. Nothing here is locked: cut sections, merge them, change the
voice.

---

## 1. Browser tab and search description

**Title:** The Missing Semester — what we should have been taught in school but weren't

**Description:** A one-room schoolhouse for the education that never made it onto the timetable. My four subjects: reading, writing, building, lifting.

---

## 2. Top rail

**Left:** missingsemester.in

**Centre:** A one-room schoolhouse

**Right:** No. 01 · Est. 2026

---

## 3. Hero

**Eyebrow:** For everything school didn't bother to keep in

**Headline, line 1:** The Missing

**Headline, line 2:** Semester

**Tagline:** what we should have been taught in school but weren't.

**Lede:**
Four subjects, one room, no graduation. A public record of the education that never made it onto the timetable — the books I read, the sentences I write, the things I build, and the weight I keep picking up.

**Primary button:** Enter the library → *(goes to /reading/)*

**Secondary button:** Read the writing *(goes to blog.missingsemester.in)*

**Small print:** {total} books in the library · {outOnLoan} out on loan · school is never out

*(The two numbers are filled from the library at build time. Keep the braces if you want them live.)*

---

## 4. The timetable card

**Card title:** The timetable

**Card note, line 1:** Four periods.

**Card note, line 2:** No bell.

**Card footer:** Pick a seat. Stay as long as you like.

### Period 01

- **Name:** Reading
- **One line:** Mastering what others have already figured out.
- **Place:** The shelf
- **Detail:** {total} books
- **Goes to:** /reading/

### Period 02

- **Name:** Writing
- **One line:** Thinking, with the door left open.
- **Place:** The desk
- **Detail:** Notes & essays
- **Goes to:** https://blog.missingsemester.in/

### Period 03

- **Name:** Building
- **One line:** Make the thing before you feel ready.
- **Place:** The terminal
- **Detail:** Projects
- **Goes to:** https://github.com/vmviam/

### Period 04

- **Name:** Lifting
- **One line:** The body is a subject, too.
- **Place:** The plate tree
- **Detail:** On the chalkboard
- **Goes to:** /lifting/

---

## 5. The blackboard

**Kicker:** The premise

**Headline, first sentence:** School taught us how to pass the test.

**Headline, second sentence:** It never taught us how to live.

### Rule i

- **Title:** Read the original.
- **Body:** Not the thread about the book. Not the summary of the summary. The book itself.

### Rule ii

- **Title:** Write to find out.
- **Body:** You do not know what you think until you have made a sentence of it.

### Rule iii

- **Title:** Build before you're ready.
- **Body:** The first version is a question. Ship it, then listen to the answer.

### Rule iv

- **Title:** I like to move it, move it.
- **Body:** A mind is a tenant. The body is the building it lives in.

**Signature:** — VMV

---

## 8. Footer

**Left:** The Missing Semester

**Middle:** Built by hand. Deployed by push.

**Links:** Top ↑

---

## 9. The Lifting holding page

This is the small chalkboard page at `/lifting/`, so the timetable row does not
dead-end.

**Headline:** Still being written.

**Paragraph:**
I haven’t decided what belongs on this chalkboard yet — the program, the numbers, or the days I didn’t want to show up at all.

**Chalk rules:** Show up. / Add a little weight. / Repeat.

**Note:** — the only three rules that ever stuck

**Link out:** Meanwhile, the library is open →

---

## What is not editable here

- The book counts (`{total}`, `{outOnLoan}`) come from the library data.
- The four material colours and typefaces are part of the room's design system.
- The page URL and deployment stay as they are unless you want to change them too.
