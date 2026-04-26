# Kubishi Slides — guide for Claude

Static Astro site for teaching Owens Valley Paiute (OVP). Replaces a set of
Google Slides decks the user (Jared) was maintaining manually for teaching
his cousins. Deployed to **slides.kubishi.com** via Cloudflare Pages
(project: `kubishi-slides`, account: `jaredraycoleman@gmail.com`).

GitHub: [`jaredraycoleman/kubishi-slides`](https://github.com/jaredraycoleman/kubishi-slides).

## What's in here

- [src/content/decks/](src/content/decks/) — one markdown file per deck. **This is where new lessons go.**
- [src/pages/index.astro](src/pages/index.astro) — home page that lists decks grouped by `group`.
- [src/pages/decks/[slug].astro](src/pages/decks/%5Bslug%5D.astro) — presenter page per deck.
- [src/lib/parseDeck.ts](src/lib/parseDeck.ts) — turns the deck markdown into `Slide[]` (cards or references).
- [src/lib/presenter.ts](src/lib/presenter.ts) — client-side flip / shuffle / settings / swipe logic.
- [src/styles/](src/styles/) — `global.css` for the home page, `present.css` for the presenter.
- [public/images/decks/<slug>/](public/images/decks/) — flashcard background images, named `slide-NN.webp`.
- [scripts/extract-pdf-images.sh](scripts/extract-pdf-images.sh) — pipeline used to extract images from Google-Slides-exported PDFs.
- [scripts/extract-pptx-images.py](scripts/extract-pptx-images.py) — alt path for small decks (PPTX export, < 10 MB cap).

## Deck markdown format

Each deck is one `.md` file. Slides are separated by lines that are exactly `---`.

A slide is **auto-classified** by content — no per-slide type marker:

- **Flashcard slide**: every non-empty line matches `front | back [| image]`. Renders as a sequence of flip cards (one card per line). Image is optional and resolves relative to `public/images/decks/<deck-slug>/`.
- **Reference slide**: anything else (headings, lists, tables, paragraphs). Renders as a static markdown page. Use these for grammar tables, suffix charts, intros, section dividers.

Frontmatter:

```yaml
---
title: "Lesson 5 — Objects"        # required
paiuteTitle: "Tei-hiimü"            # optional, shown on home card
description: "..."                   # optional
group: vocab                         # vocab | grammar | phrases | other
order: 5                             # sort within group
tags: [grammar, lesson]              # optional
---
```

Schema is enforced by [src/content.config.ts](src/content.config.ts).

## Local dev / build / deploy

```bash
npm run dev        # http://localhost:4321
npm run build      # static output → ./dist
npm run deploy     # build + wrangler pages deploy ./dist --project-name=kubishi-slides
```

Wrangler is already authenticated locally. `slides.kubishi.com` is the production custom domain (configured in Cloudflare dashboard).

## Authoring conventions (important)

These are non-obvious rules baked into how this project works:

1. **Shuffle is section-scoped.** Reference slides stay pinned, AND cards shuffle only within their section (the run of consecutive cards between two reference slides) — so a "Superbowl Edition" sentence never drifts under a "Simple Verbs" header. Implemented in [`buildOrder()`](src/lib/presenter.ts). Preserve both invariants if you change shuffle logic.

2. **Don't fabricate Paiute translations.** Always verify against the Kubishi Dictionary MCP (see below). If a word can't be found, mark it as `TODO` in the markdown rather than inventing a gloss. Two existing TODO words: `Eingwü` (Vocab 1) and `'Azabana` (Vocab 2).

3. **Mechanical suffix attachment may be wrong.** When generating new tense/possessive/object forms by appending suffixes, surface forms might involve morphophonemic changes (vowel harmony, stress, stem alternation) that I don't model. Flag this to Jared when you do bulk generation so he can sanity-check — he speaks the language.

4. **Reuse vocab across lessons.** When building a new grammar lesson, prefer reusing words/sentences from earlier lessons (Lessons 2/5/6/7) so students aren't learning new vocab and new grammar at once.

5. **Image-as-background, not embedded.** Vocab cards display the image as the full card background with a dark scrim and overlaid text — not as an inline `<img>`. The "Hide text on image side" setting lets the user use the image alone as the answer.

## Lesson / deck creation workflow

When Jared asks for a new deck or asks to fill out an existing one:

1. **Look at neighboring decks first.** Read the existing files in [src/content/decks/](src/content/decks/) to match style. Lessons use reference slides for grammar tables + flashcard groups for example sentences.
2. **Use the Kubishi Dictionary MCP** for any Paiute → English translation work. Tools: `search_paiute` (fuzzy by Paiute form, handles k/g, t/d, s/z, ü/u variants), `search_english` (semantic by meaning), `lookup_word` (by ID), `random_word`, `random_sentence`, `word_of_the_day`. Always batch-search words in parallel — it's much faster.
3. **Build before claiming done.** `npm run build` catches frontmatter schema errors and bad markdown.
4. **Image-bearing decks**: drop WebPs into `public/images/decks/<slug>/` named `slide-NN.webp` (one per card, ordered) and reference them as the third pipe field on each card line. WebP at quality ~82 gives ~40% smaller files than JPEG at the same visual quality.

### Migrating decks from Google Slides

1. Find the file ID via the `Google_Drive` MCP (`search_files`).
2. Download as PDF: `download_file_content` with `exportMimeType: application/pdf` (PPTX export is capped at 10 MB and most decks exceed it).
3. The download often exceeds the response size limit but is auto-saved to disk; decode the `embeddedResource.contents.blob` (base64) with `jq -r ... | base64 -d > out.pdf`.
4. Run [`scripts/extract-pdf-images.sh`](scripts/extract-pdf-images.sh) — it picks the largest image per page, re-encodes as WebP q82 max-1024, and emits a manifest.
5. Card index N in the markdown corresponds to PDF page N+1 (page 1 is the title slide).

## User context

- Jared is a fluent-enough OVP teacher and engineer. He'll catch wrong translations, so don't bluff.
- He runs the broader `kubishi.com` ecosystem — dictionary, sentences, research portal. Slides is one piece.
- Conversations are auto-mode-friendly: prefer making a reasonable choice and shipping over asking. Two questions max before acting.
- He uses [TODO.txt](TODO.txt) as a personal scratchpad — it's gitignored, don't write there unless asked.

## Things you might want to add later

- A "study mode" with self-grading (Anki-style spaced repetition).
- Audio recordings on cards (currently text + image only).
- An "image on front, text on back" mode where the photo prompts recall (currently the side toggle exists, but UX could be tuned).
- Image generation pipeline for new vocab decks where Google Slides originals don't exist.
