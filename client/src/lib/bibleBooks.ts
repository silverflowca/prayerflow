// ── Bible book list with chapter counts ──────────────────────
// WEB (World English Bible) — used by bible-api.com

export interface BibleBook {
  id:       string   // slug used in API: "Genesis", "John", etc.
  name:     string   // display name
  abbr:     string   // short abbreviation
  chapters: number   // total chapters
  testament: 'OT' | 'NT'
}

export const BIBLE_BOOKS: BibleBook[] = [
  // ── Old Testament ──────────────────────────────────────────
  { id:'Genesis',       name:'Genesis',          abbr:'Gen',   chapters:50,  testament:'OT' },
  { id:'Exodus',        name:'Exodus',           abbr:'Exo',   chapters:40,  testament:'OT' },
  { id:'Leviticus',     name:'Leviticus',        abbr:'Lev',   chapters:27,  testament:'OT' },
  { id:'Numbers',       name:'Numbers',          abbr:'Num',   chapters:36,  testament:'OT' },
  { id:'Deuteronomy',   name:'Deuteronomy',      abbr:'Deu',   chapters:34,  testament:'OT' },
  { id:'Joshua',        name:'Joshua',           abbr:'Jos',   chapters:24,  testament:'OT' },
  { id:'Judges',        name:'Judges',           abbr:'Jdg',   chapters:21,  testament:'OT' },
  { id:'Ruth',          name:'Ruth',             abbr:'Rut',   chapters:4,   testament:'OT' },
  { id:'1 Samuel',      name:'1 Samuel',         abbr:'1Sa',   chapters:31,  testament:'OT' },
  { id:'2 Samuel',      name:'2 Samuel',         abbr:'2Sa',   chapters:24,  testament:'OT' },
  { id:'1 Kings',       name:'1 Kings',          abbr:'1Ki',   chapters:22,  testament:'OT' },
  { id:'2 Kings',       name:'2 Kings',          abbr:'2Ki',   chapters:25,  testament:'OT' },
  { id:'1 Chronicles',  name:'1 Chronicles',     abbr:'1Ch',   chapters:29,  testament:'OT' },
  { id:'2 Chronicles',  name:'2 Chronicles',     abbr:'2Ch',   chapters:36,  testament:'OT' },
  { id:'Ezra',          name:'Ezra',             abbr:'Ezr',   chapters:10,  testament:'OT' },
  { id:'Nehemiah',      name:'Nehemiah',         abbr:'Neh',   chapters:13,  testament:'OT' },
  { id:'Esther',        name:'Esther',           abbr:'Est',   chapters:10,  testament:'OT' },
  { id:'Job',           name:'Job',              abbr:'Job',   chapters:42,  testament:'OT' },
  { id:'Psalms',        name:'Psalms',           abbr:'Psa',   chapters:150, testament:'OT' },
  { id:'Proverbs',      name:'Proverbs',         abbr:'Pro',   chapters:31,  testament:'OT' },
  { id:'Ecclesiastes',  name:'Ecclesiastes',     abbr:'Ecc',   chapters:12,  testament:'OT' },
  { id:'Song of Solomon',name:'Song of Solomon', abbr:'Son',   chapters:8,   testament:'OT' },
  { id:'Isaiah',        name:'Isaiah',           abbr:'Isa',   chapters:66,  testament:'OT' },
  { id:'Jeremiah',      name:'Jeremiah',         abbr:'Jer',   chapters:52,  testament:'OT' },
  { id:'Lamentations',  name:'Lamentations',     abbr:'Lam',   chapters:5,   testament:'OT' },
  { id:'Ezekiel',       name:'Ezekiel',          abbr:'Eze',   chapters:48,  testament:'OT' },
  { id:'Daniel',        name:'Daniel',           abbr:'Dan',   chapters:12,  testament:'OT' },
  { id:'Hosea',         name:'Hosea',            abbr:'Hos',   chapters:14,  testament:'OT' },
  { id:'Joel',          name:'Joel',             abbr:'Joe',   chapters:3,   testament:'OT' },
  { id:'Amos',          name:'Amos',             abbr:'Amo',   chapters:9,   testament:'OT' },
  { id:'Obadiah',       name:'Obadiah',          abbr:'Oba',   chapters:1,   testament:'OT' },
  { id:'Jonah',         name:'Jonah',            abbr:'Jon',   chapters:4,   testament:'OT' },
  { id:'Micah',         name:'Micah',            abbr:'Mic',   chapters:7,   testament:'OT' },
  { id:'Nahum',         name:'Nahum',            abbr:'Nah',   chapters:3,   testament:'OT' },
  { id:'Habakkuk',      name:'Habakkuk',         abbr:'Hab',   chapters:3,   testament:'OT' },
  { id:'Zephaniah',     name:'Zephaniah',        abbr:'Zep',   chapters:3,   testament:'OT' },
  { id:'Haggai',        name:'Haggai',           abbr:'Hag',   chapters:2,   testament:'OT' },
  { id:'Zechariah',     name:'Zechariah',        abbr:'Zec',   chapters:14,  testament:'OT' },
  { id:'Malachi',       name:'Malachi',          abbr:'Mal',   chapters:4,   testament:'OT' },
  // ── New Testament ──────────────────────────────────────────
  { id:'Matthew',       name:'Matthew',          abbr:'Mat',   chapters:28,  testament:'NT' },
  { id:'Mark',          name:'Mark',             abbr:'Mar',   chapters:16,  testament:'NT' },
  { id:'Luke',          name:'Luke',             abbr:'Luk',   chapters:24,  testament:'NT' },
  { id:'John',          name:'John',             abbr:'Joh',   chapters:21,  testament:'NT' },
  { id:'Acts',          name:'Acts',             abbr:'Act',   chapters:28,  testament:'NT' },
  { id:'Romans',        name:'Romans',           abbr:'Rom',   chapters:16,  testament:'NT' },
  { id:'1 Corinthians', name:'1 Corinthians',    abbr:'1Co',   chapters:16,  testament:'NT' },
  { id:'2 Corinthians', name:'2 Corinthians',    abbr:'2Co',   chapters:13,  testament:'NT' },
  { id:'Galatians',     name:'Galatians',        abbr:'Gal',   chapters:6,   testament:'NT' },
  { id:'Ephesians',     name:'Ephesians',        abbr:'Eph',   chapters:6,   testament:'NT' },
  { id:'Philippians',   name:'Philippians',      abbr:'Phi',   chapters:4,   testament:'NT' },
  { id:'Colossians',    name:'Colossians',       abbr:'Col',   chapters:4,   testament:'NT' },
  { id:'1 Thessalonians',name:'1 Thessalonians', abbr:'1Th',   chapters:5,   testament:'NT' },
  { id:'2 Thessalonians',name:'2 Thessalonians', abbr:'2Th',   chapters:3,   testament:'NT' },
  { id:'1 Timothy',     name:'1 Timothy',        abbr:'1Ti',   chapters:6,   testament:'NT' },
  { id:'2 Timothy',     name:'2 Timothy',        abbr:'2Ti',   chapters:4,   testament:'NT' },
  { id:'Titus',         name:'Titus',            abbr:'Tit',   chapters:3,   testament:'NT' },
  { id:'Philemon',      name:'Philemon',         abbr:'Phm',   chapters:1,   testament:'NT' },
  { id:'Hebrews',       name:'Hebrews',          abbr:'Heb',   chapters:13,  testament:'NT' },
  { id:'James',         name:'James',            abbr:'Jam',   chapters:5,   testament:'NT' },
  { id:'1 Peter',       name:'1 Peter',          abbr:'1Pe',   chapters:5,   testament:'NT' },
  { id:'2 Peter',       name:'2 Peter',          abbr:'2Pe',   chapters:3,   testament:'NT' },
  { id:'1 John',        name:'1 John',           abbr:'1Jo',   chapters:5,   testament:'NT' },
  { id:'2 John',        name:'2 John',           abbr:'2Jo',   chapters:1,   testament:'NT' },
  { id:'3 John',        name:'3 John',           abbr:'3Jo',   chapters:1,   testament:'NT' },
  { id:'Jude',          name:'Jude',             abbr:'Jud',   chapters:1,   testament:'NT' },
  { id:'Revelation',    name:'Revelation',       abbr:'Rev',   chapters:22,  testament:'NT' },
]

// Verse counts per chapter (approximations for WEB).
// Used to build the verse-number picker without an API call.
// Keys: "Book Chapter" → verse count
const VERSE_COUNTS: Record<string, number[]> = {
  'Genesis':       [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26],
  'Exodus':        [22,25,22,31,23,30,29,28,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38],
  'Psalms':        [6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,13,25,11,22,23,28,13,40,23,14,18,14,12,5,27,18,12,10,15,21,23,21,11,7,9,24,13,12,12,18,14,9,13,15,21,16,11,1,17,18,6,22,13,14,14,16,20,28,13,28,39,40,29,25],
  'Proverbs':      [33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,62,44,33,22,44,31,33,44,38,31,50,66,62,34],
  'John':          [51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25],
  'Romans':        [32,29,31,25,21,23,25,39,33,21,36,21,14,26,33,24],
  'Revelation':    [20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21],
}

/** Get verse count for a book+chapter (falls back to 40 if unknown) */
export function getVerseCount(book: string, chapter: number): number {
  const counts = VERSE_COUNTS[book]
  if (counts && chapter >= 1 && chapter <= counts.length) return counts[chapter - 1]
  return 40 // safe fallback
}

/** Build reference string like "John 3:16" or "John 3:16-17" */
export function fmtRef(book: string, chapter: number, verse: number, endVerse?: number): string {
  const range = endVerse && endVerse !== verse ? `-${endVerse}` : ''
  return `${book} ${chapter}:${verse}${range}`
}

/** Build the verse key used in filenames */
export function verseKey(book: string, chapter: number, verse: number, endVerse?: number): string {
  const end = endVerse && endVerse !== verse ? `-${endVerse}` : ''
  return `${book.replace(/ /g, '_')}_${chapter}_${verse}${end}`
}
