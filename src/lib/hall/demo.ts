/**
 * Prototype fixtures for the hall, used only when the real library is too
 * small to judge the shelves. Enable with ?demo=1.
 *
 * These are NOT part of the library. Remove once the Readwise sync is live.
 */
import type { Book } from "../books";

const TITLES: Array<[string, string, number]> = [
  ["The Man Who Mistook His Wife for a Hat", "Oliver Sacks", 1985],
  ["Thinking, Fast and Slow", "Daniel Kahneman", 2011],
  ["Sapiens", "Yuval Noah Harari", 2011],
  ["Atomic Habits", "James Clear", 2018],
  ["Meditations", "Marcus Aurelius", 180],
  ["The Overstory", "Richard Powers", 2018],
  ["Being Mortal", "Atul Gawande", 2014],
  ["Piranesi", "Susanna Clarke", 2020],
  ["A Swim in a Pond in the Rain", "George Saunders", 2021],
  ["Zen and the Art of Motorcycle Maintenance", "Robert Pirsig", 1974],
  ["Gödel, Escher, Bach", "Douglas Hofstadter", 1979],
  ["The Art of Memory", "Frances Yates", 1966],
  ["Range", "David Epstein", 2019],
  ["The Wager", "David Grann", 2023],
  ["A Pattern Language", "Christopher Alexander", 1977],
  ["How We Learn", "Barbara Oakley", 2014],
  ["The Body Keeps the Score", "Bessel van der Kolk", 2014],
  ["Antifragile", "Nassim Taleb", 2012],
  ["Norwegian Wood", "Haruki Murakami", 1987],
  ["The Remains of the Day", "Kazuo Ishiguro", 1989],
  ["On Writing Well", "William Zinsser", 1976],
  ["The Book of Disquiet", "Fernando Pessoa", 1982],
  ["Beloved", "Toni Morrison", 1987],
  ["The Emperor of All Maladies", "Siddhartha Mukherjee", 2010],
  ["The Sixth Extinction", "Elizabeth Kolbert", 2014],
  ["Why We Sleep", "Matthew Walker", 2017],
  ["The Information", "James Gleick", 2011],
  ["Thinking in Systems", "Donella Meadows", 2008],
  ["The Denial of Death", "Ernest Becker", 1973],
  ["Man's Search for Meaning", "Viktor Frankl", 1946],
  ["The Unbearable Lightness of Being", "Milan Kundera", 1984],
  ["Invisible Cities", "Italo Calvino", 1972],
  ["The Master and Margarita", "Mikhail Bulgakov", 1967],
  ["Crime and Punishment", "Fyodor Dostoevsky", 1866],
  ["Anna Karenina", "Leo Tolstoy", 1878],
  ["Middlemarch", "George Eliot", 1871],
  ["Moby-Dick", "Herman Melville", 1851],
  ["Walden", "Henry David Thoreau", 1854],
  ["The Souls of Black Folk", "W. E. B. Du Bois", 1903],
  ["Silent Spring", "Rachel Carson", 1962],
  ["The Structure of Scientific Revolutions", "Thomas Kuhn", 1962],
  ["The Selfish Gene", "Richard Dawkins", 1976],
  ["The Blind Watchmaker", "Richard Dawkins", 1986],
  ["Cosmos", "Carl Sagan", 1980],
  ["The Demon-Haunted World", "Carl Sagan", 1995],
  ["Guns, Germs, and Steel", "Jared Diamond", 1997],
  ["The Better Angels of Our Nature", "Steven Pinker", 2011],
  ["Enlightenment Now", "Steven Pinker", 2018],
  ["Justice", "Michael Sandel", 2009],
  ["The Righteous Mind", "Jonathan Haidt", 2012],
  ["Predictably Irrational", "Dan Ariely", 2008],
  ["Nudge", "Richard Thaler", 2008],
  ["The Black Swan", "Nassim Taleb", 2007],
  ["Fooled by Randomness", "Nassim Taleb", 2001],
  ["The Signal and the Noise", "Nate Silver", 2012],
  ["Superforecasting", "Philip Tetlock", 2015],
  ["The Scout Mindset", "Julia Galef", 2021],
  ["Thinking in Bets", "Annie Duke", 2018],
  ["Deep Work", "Cal Newport", 2016],
  ["So Good They Can't Ignore You", "Cal Newport", 2012],
  ["The Shallows", "Nicholas Carr", 2010],
  ["Amusing Ourselves to Death", "Neil Postman", 1985],
  ["Technopoly", "Neil Postman", 1992],
  ["The Medium Is the Massage", "Marshall McLuhan", 1967],
  ["Understanding Media", "Marshall McLuhan", 1964],
  ["Here Comes Everybody", "Clay Shirky", 2008],
  ["The Cathedral and the Bazaar", "Eric Raymond", 1999],
  ["The Mythical Man-Month", "Fred Brooks", 1975],
  ["Peopleware", "Tom DeMarco", 1987],
  ["Code Complete", "Steve McConnell", 1993],
  ["The Pragmatic Programmer", "Andrew Hunt", 1999],
  ["Designing Data-Intensive Applications", "Martin Kleppmann", 2017],
  ["Working in Public", "Nadia Eghbal", 2020],
  ["The Art of Doing Science and Engineering", "Richard Hamming", 1997],
  ["Surely You're Joking, Mr. Feynman!", "Richard Feynman", 1985],
  ["The Character of Physical Law", "Richard Feynman", 1965],
  ["QED", "Richard Feynman", 1985],
  ["A Brief History of Time", "Stephen Hawking", 1988],
  ["The Fabric of the Cosmos", "Brian Greene", 2004],
  ["Reality Is Not What It Seems", "Carlo Rovelli", 2014],
  ["The Order of Time", "Carlo Rovelli", 2017],
  ["Seven Brief Lessons on Physics", "Carlo Rovelli", 2014],
];

/** 120 books spread across the three states. */
export function demoBooks(): Book[] {
  const out: Book[] = [];
  for (let i = 0; i < 120; i++) {
    const [title, author, year] = TITLES[i % TITLES.length];
    const status = i < 64 ? "to-read" : i < 88 ? "reading" : "read";
    out.push({
      id: `demo-${i}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title,
      author,
      status,
      category: "misc",
      year,
      pages: 180 + ((i * 37) % 340),
      rating: status === "read" ? 4 : undefined,
    });
  }
  return out;
}
