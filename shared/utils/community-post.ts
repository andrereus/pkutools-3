// Posts are queried by language and time together, which the database can
// only do through one stored field: "de_1792488943674" is a German post
// written at that moment. Times have 13 digits until the year 2286, so the
// keys sort by time as plain text.

/** The sort key of a post written in `language` at `time`, or a query bound. */
export const languageCreatedAtKey = (language: string, time: number): string =>
  `${language}_${Math.max(0, Math.floor(time))}`

/** The bounds that cover every post of a language. */
export const languageBounds = (language: string) => ({
  start: `${language}_`,
  end: `${language}_~`
})
