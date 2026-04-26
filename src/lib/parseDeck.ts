import { marked } from "marked";

export type Card = {
  kind: "card";
  front: string;
  back: string;
  image?: string;
};

export type Reference = {
  kind: "reference";
  html: string;
};

export type Slide = Card | Reference;

const CARD_LINE = /^\s*([^|]+?)\s*\|\s*([^|]+?)\s*(?:\|\s*(.+?)\s*)?$/;

function isCardLine(line: string): boolean {
  return CARD_LINE.test(line) && !line.startsWith("#") && !line.startsWith(">");
}

function parseCardLine(line: string): Card | null {
  const m = line.match(CARD_LINE);
  if (!m) return null;
  return {
    kind: "card",
    front: m[1].trim(),
    back: m[2].trim(),
    image: m[3]?.trim() || undefined,
  };
}

/**
 * Body is the markdown after frontmatter. Slides are separated by lines that
 * are exactly `---`. Within a slide, if every non-empty line matches the card
 * pattern `front | back [| image]`, the slide expands to a sequence of cards.
 * Otherwise the whole slide renders as a markdown reference slide.
 */
export function parseDeckBody(body: string): Slide[] {
  const blocks = body.split(/^[ \t]*---[ \t]*$/m);
  const slides: Slide[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    const lines = block.split("\n").map((l) => l.trimEnd());
    const nonEmpty = lines.filter((l) => l.trim() !== "");
    const allCards = nonEmpty.length > 0 && nonEmpty.every(isCardLine);

    if (allCards) {
      for (const line of nonEmpty) {
        const c = parseCardLine(line);
        if (c) slides.push(c);
      }
    } else {
      slides.push({
        kind: "reference",
        html: marked.parse(block, { async: false }) as string,
      });
    }
  }

  return slides;
}

export function countCards(slides: Slide[]): number {
  return slides.filter((s) => s.kind === "card").length;
}
