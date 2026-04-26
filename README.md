# Kubishi Slides

Static flashcard / lesson site for teaching Owens Valley Paiute. Deployed to Cloudflare Pages at **slides.kubishi.com**.

## How it works

Each deck is a single markdown file in [`src/content/decks/`](src/content/decks/). Slides are separated by a `---` line.

A slide can be one of two types — auto-detected from its content:

### Flashcard slides

Any slide where every line matches `front | back [| optional/image.jpg]` becomes a sequence of flashcards (one card per line):

```markdown
Padühidda | elk
Kamü | jackrabbit
Padaka'i | raccoon | raccoon.jpg
```

Images are optional. If provided, they're resolved relative to `public/images/decks/<deck-slug>/`.

### Reference slides

Anything else — headings, paragraphs, tables, lists — renders as a static markdown slide. Use these for grammar tables, suffix charts, intros, etc.

```markdown
# Object Suffixes

`-oka/-noka` — far away
`-eika/-neika` — nearby
```

### Frontmatter

```yaml
---
title: Four-legged Animals          # required
paiuteTitle: Watsügwiggu huggagaiddu # optional
group: vocab                         # vocab | grammar | phrases | other
order: 1                             # sort order within group
tags: [vocab, animals]               # optional
description: ...                     # optional
---
```

## Presenter controls

- `←` / `→` — previous / next slide
- `Space` / click — flip card
- `S` — toggle shuffle
- `R` — reset to first card
- `F` — fullscreen
- `,` — toggle settings panel

Settings (persisted to localStorage):
- **Front of card**: Paiute or English
- **Show image**: always / on flip / never
- **Shuffle**: on / off
- **Auto-advance**: off / 3s / 5s / 10s

## Develop

```bash
npm install
npm run dev
```

## Deploy

First time only — create the Cloudflare Pages project and add `slides.kubishi.com` as a custom domain in the Cloudflare dashboard.

```bash
npm run deploy
```

This runs `astro build` and uploads `./dist` to Cloudflare Pages.

## Add a new deck

1. Create `src/content/decks/<slug>.md`.
2. Add frontmatter + slides as above.
3. (Optional) drop images in `public/images/decks/<slug>/` and reference them in card lines.
4. `npm run dev` — the home page picks it up automatically.
