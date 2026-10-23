/**
 * Every word on the landing page.
 *
 * Edit a string here and the page follows. `{total}` and `{outOnLoan}` are
 * filled from the library at build time.
 *
 * There is a plain-language copy of this in docs/landing-copy.md if you would
 * rather rewrite the whole page in one pass and hand it back.
 */
export const landing = {
  meta: {
    title:
      "The Missing Semester — what we should have been taught in school but weren’t",
    description:
      "A one-room schoolhouse for the education that never made it onto the timetable. My four subjects: reading, writing, building, lifting.",
  },

  rail: {
    mark: "missingsemester.in",
    line: "A one-room schoolhouse",
    year: "No. 01 · Est. 2026",
  },

  hero: {
    kicker: "For everything school didn't bother to keep in",
    titleLead: "The Missing",
    titleTail: "Semester",
    tagline: "what we should have been taught in school but weren’t.",
    lede: "Four subjects, one room, no graduation. A public record of the education that never made it onto the timetable — the books I read, the sentences I write, the things I build, and the weight I keep picking up.",
    primaryCta: {
      label: "Enter the library",
      href: "/reading/",
    },
    secondaryCta: {
      label: "Read the writing",
      href: "https://letters.missingsemester.in/",
    },
    smallPrint:
      "{total} books in the library · {outOnLoan} out on loan · school is never out",
  },

  timetable: {
    title: "The timetable",
    noteLines: ["Four periods.", "No bell."],
    footer: "Pick a seat. Stay as long as you like.",
    periods: [
      {
        n: "01",
        name: "Reading",
        line: "Mastering what others have already figured out.",
        place: "The shelf",
        detail: "{total} books",
        href: "/reading/",
        tone: "oak",
        external: false,
      },
      {
        n: "02",
        name: "Writing",
        line: "Thinking, with the door left open.",
        place: "The desk",
        detail: "Notes & essays",
        href: "https://letters.missingsemester.in/",
        tone: "paper",
        external: true,
      },
      {
        n: "03",
        name: "Building",
        line: "Make the thing before you feel ready.",
        place: "The terminal",
        detail: "Projects",
        href: "https://github.com/vmviam/",
        tone: "glass",
        external: true,
      },
      {
        n: "04",
        name: "Lifting",
        line: "The body is a subject, too.",
        place: "The plate tree",
        detail: "On the chalkboard",
        href: "/lifting/",
        tone: "slate",
        external: false,
      },
    ],
  },

  board: {
    kicker: "The premise",
    headlineLead: "School taught us how to pass the test.",
    headlineTail: "It never taught us how to live.",
    rules: [
      {
        n: "i.",
        title: "Read the original.",
        body: "Not the thread about the book. Not the summary of the summary. The book itself.",
      },
      {
        n: "ii.",
        title: "Write to find out.",
        body: "You do not know what you think until you have made a sentence of it.",
      },
      {
        n: "iii.",
        title: "Build before you're ready.",
        body: "The first version is a question. Ship it, then listen to the answer.",
      },
      {
        n: "iv.",
        title: "I like to move it, move it.",
        body: "A mind is a tenant. The body is the building it lives in.",
      },
    ],
    footer: "— the curriculum, as far as I can tell",
    signature: {
      name: "VMV",
    },
  },

  footer: {
    left: "The Missing Semester",
    middle: "Built by hand. Deployed by push.",
    links: [{ label: "Top ↑", href: "#title" }],
  },
};
