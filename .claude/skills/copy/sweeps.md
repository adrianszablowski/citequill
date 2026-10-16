# Copy sweeps

Grep-able checks for step 5 of [`SKILL.md`](SKILL.md). Run them from the repo root. Each hit is an accepted exception listed under its sweep, or a line to rewrite with the rule the sweep names.

```sh
COPY=(app features components lib docs/product.md)
SKIP=(--glob '!components/ui/**' --glob '!lib/types/**' --glob '!*.test.ts')
```

## 1. Hype and empty adjectives

Write the mechanism or the reader's action.

```sh
rg -n -i -w "unlock\w*|seamless\w*|effortless\w*|game.changer|revolutionary|supercharge\w*|leverage|utili[sz]e\w*|robust|cutting.edge|magic\w*|stunning|powerful|ultimate|skyrocket\w*|empower\w*|elevate\w*|streamline\w*|journey|level up|boost\w*|blazing|instantly|crush\w*|killer|delve|tapestry|testament|pivotal|underscore\w*|multifaceted|vibrant|groundbreaking|renowned" $COPY $SKIP
```

Accepted: none.

## 2. Negative parallelism and false contrast

State what the subject is.

```sh
rg -n -i "not just|not only|not merely|it's not|it is not about|rather than|no [a-z]+, no [a-z]+, just" $COPY $SKIP
```

Accepted: "do not", "cannot" and "is not" in a plain statement of a limit ("The page does not say a model wrote it") are allowed; the sweep flags only the patterns above.

## 3. Avoided copulas and trailing clauses

Write "is", "has", "reads", "writes".

```sh
rg -n -i "serves as|stands as|boasts|features a|, (ensuring|highlighting|reflecting|showcasing|fostering) " $COPY $SKIP
```

Accepted: none.

## 4. Promises about steps that are not done

Describe what the section is for. The MVP step list in `docs/product.md` says what exists.

```sh
rg -n -i "coming soon|next steps|will (write|publish|arrive|appear|be able)|soon\b|once the site is connected|when the site is connected" app features components $SKIP
```

Accepted: a line in `docs/` describing a planned step.

## 5. Blame and generic labels

Name the thing that failed; name the action on the button.

```sh
rg -n -i -P "invalid|illegal|incorrect|you failed|you must|please\b|get started|submit\b|continue\b(?! with Google)|learn more|click here" app features components $SKIP
```

Accepted: "Continue with Google", and the words as code (`aria-invalid`, `fieldState.invalid`, `type="submit"`, `onSubmit`). Read the hit: only a string a person sees counts.

## 6. Empty states that only say no

Say what the section is for.

```sh
rg -n -i "^\s*No [a-z]+ yet\.?\s*$|>No [a-z]+ yet\.<" app features components $SKIP
```

Accepted: none.

## 7. Punctuation and abbreviations

Write "for example", "and", a full sentence instead of a dash, no exclamation marks, no bold in prose.

```sh
rg -n "—|\be\.g\.|\bi\.e\.|\betc\b|[A-Za-z] & [A-Za-z]|!['\"]|!</|\*\*" app features components docs/product.md $SKIP
```

Accepted: none in UI strings. A `!` in code (`!data`, `!==`) is not a string; read the hit.

## 8. Placeholders

Show a complete, realistic value.

```sh
rg -n -P "placeholder=\"(?!https://)" app features components $SKIP
```

Accepted: a field that is not a URL (a name, a number) with a realistic value.
