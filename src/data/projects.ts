export interface Project {
  label: string;
  repo: string;
  description: string;
  language: string;
  year: string;
}

/**
 * Only public repositories belong here. Add a row when a repo is made public.
 */
export const projects: Project[] = [
  {
    label: "The Missing Semester",
    repo: "missingsemester",
    description:
      "The one-room schoolhouse you're standing in. Astro, CSS, no framework.",
    language: "Astro",
    year: "2026",
  },
  {
    label: "The Desk",
    repo: "missingsemester-blog",
    description:
      "The writing half of the schoolhouse, served at letters.missingsemester.in.",
    language: "Astro",
    year: "2026",
  },
];
