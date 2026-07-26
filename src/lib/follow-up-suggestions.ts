// Refinement chips offered after the agent delivers a view — they teach the
// DSL's vocabulary (filters, chart types, layout verbs) without the user
// having to read docs. Kept generic on purpose: each works against any view.
export const followUpSuggestions = [
  "Add a filter by priority",
  "Add a table of the underlying tasks",
  "Show the completion trend as an area chart",
  "Make the main chart full width",
] as const;
