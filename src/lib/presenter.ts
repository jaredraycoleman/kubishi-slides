import type { Slide } from "./parseDeck";

type Settings = {
  front: "paiute" | "english";
  shuffle: boolean;
  imageSide: "front" | "back";
  hideTextOnImage: boolean;
  autoplay: 0 | 3 | 5 | 10;
};

const DEFAULTS: Settings = {
  front: "paiute",
  shuffle: false,
  imageSide: "back",
  hideTextOnImage: false,
  autoplay: 0,
};

const STORAGE_KEY = "kubishi-slides:settings:v1";

function loadSettings(): Settings {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initPresenter(slides: Slide[], imageBase: string) {
  const stage = document.getElementById("stage")!;
  const progress = document.getElementById("progress")!;
  const prevBtn = document.getElementById("prev") as HTMLButtonElement;
  const nextBtn = document.getElementById("next") as HTMLButtonElement;
  const shuffleBtn = document.getElementById("btn-shuffle") as HTMLButtonElement;
  const fullscreenBtn = document.getElementById("btn-fullscreen") as HTMLButtonElement;
  const settingsBtn = document.getElementById("btn-settings") as HTMLButtonElement;
  const settingsPanel = document.getElementById("settings-panel")!;
  const scrim = document.getElementById("scrim")!;

  let settings = loadSettings();
  let order: number[] = [];
  let idx = 0;
  let flipped = false;
  let autoplayTimer: number | null = null;

  function buildOrder() {
    if (!settings.shuffle) {
      order = slides.map((_, i) => i);
    } else {
      // Shuffle only the card slides; reference slides stay pinned to their
      // original positions so grammar tables / intros don't drift around.
      const cardIndices: number[] = [];
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].kind === "card") cardIndices.push(i);
      }
      const shuffled = shuffleArray(cardIndices);
      order = [];
      let cursor = 0;
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].kind === "card") order.push(shuffled[cursor++]);
        else order.push(i);
      }
    }
    if (idx >= order.length) idx = 0;
  }

  function resolveImage(p: string): string {
    if (/^(https?:|\/)/.test(p)) return p;
    return `${imageBase}${p.replace(/^\.?\/?/, "")}`;
  }

  function makeFace(text: string, side: "front" | "back", isPaiute: boolean, bgUrl: string | null, withHint: boolean, hideText: boolean): HTMLDivElement {
    const face = document.createElement("div");
    face.className = `face ${side}` + (isPaiute ? " paiute" : "") + (bgUrl ? " has-bg" : "") + (hideText ? " no-text" : "");
    if (bgUrl) {
      face.style.backgroundImage = `url("${bgUrl}")`;
    }
    if (!hideText) {
      const textEl = document.createElement("div");
      textEl.className = "text";
      textEl.textContent = text;
      face.appendChild(textEl);
    }
    if (withHint) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "Tap or press Space";
      face.appendChild(hint);
    }
    return face;
  }

  function render() {
    stage.innerHTML = "";
    const slide = slides[order[idx]];
    if (!slide) return;

    if (slide.kind === "reference") {
      const div = document.createElement("div");
      div.className = "reference-slide";
      div.innerHTML = slide.html;
      stage.appendChild(div);
      progress.textContent = `${idx + 1} / ${order.length}`;
      return;
    }

    const front = settings.front === "paiute" ? slide.front : slide.back;
    const back = settings.front === "paiute" ? slide.back : slide.front;
    const frontIsPaiute = settings.front === "paiute";

    const container = document.createElement("div");
    container.className = "card-container";

    const card = document.createElement("div");
    card.className = "card" + (flipped ? " flipped" : "");

    const hasImage = !!slide.image;
    const showImageOnFront = hasImage && settings.imageSide === "front";
    const showImageOnBack = hasImage && settings.imageSide === "back";
    const hideFrontText = showImageOnFront && settings.hideTextOnImage;
    const hideBackText = showImageOnBack && settings.hideTextOnImage;

    const frontFace = makeFace(front, "front", frontIsPaiute, showImageOnFront ? resolveImage(slide.image!) : null, true, hideFrontText);
    const backFace = makeFace(back, "back", !frontIsPaiute, showImageOnBack ? resolveImage(slide.image!) : null, false, hideBackText);

    card.appendChild(frontFace);
    card.appendChild(backFace);
    container.appendChild(card);
    container.addEventListener("click", flip);
    stage.appendChild(container);

    progress.textContent = `${idx + 1} / ${order.length}`;
  }

  function flip() {
    flipped = !flipped;
    const card = stage.querySelector(".card");
    if (card) card.classList.toggle("flipped", flipped);
  }

  function go(delta: number) {
    const next = idx + delta;
    if (next < 0 || next >= order.length) return;
    idx = next;
    flipped = false;
    render();
    resetAutoplay();
  }

  function shuffle() {
    settings.shuffle = !settings.shuffle;
    saveSettings(settings);
    idx = 0;
    flipped = false;
    buildOrder();
    render();
    syncSettingsUI();
  }

  function reset() {
    idx = 0;
    flipped = false;
    buildOrder();
    render();
  }

  function resetAutoplay() {
    if (autoplayTimer != null) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
    if (settings.autoplay > 0) {
      autoplayTimer = window.setInterval(() => {
        if (!flipped && slides[order[idx]].kind === "card") {
          flip();
        } else {
          if (idx < order.length - 1) go(1);
          else { idx = 0; flipped = false; render(); }
        }
      }, settings.autoplay * 1000);
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function openSettings(open: boolean) {
    settingsPanel.classList.toggle("open", open);
    scrim.classList.toggle("visible", open);
  }

  function syncSettingsUI() {
    settingsPanel.querySelectorAll("[data-setting]").forEach((el) => {
      const setting = (el as HTMLElement).dataset.setting!;
      const value = (el as HTMLElement).dataset.value!;
      const current = String((settings as any)[setting]);
      el.classList.toggle("active", current === value);
    });
    shuffleBtn.classList.toggle("active", settings.shuffle);
  }

  // Wire toolbar
  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));
  shuffleBtn.addEventListener("click", shuffle);
  fullscreenBtn.addEventListener("click", toggleFullscreen);
  settingsBtn.addEventListener("click", () => openSettings(true));
  scrim.addEventListener("click", () => openSettings(false));

  // Wire settings panel
  settingsPanel.querySelectorAll<HTMLElement>("[data-setting]").forEach((el) => {
    el.addEventListener("click", () => {
      const setting = el.dataset.setting!;
      const value = el.dataset.value!;
      const parsed = value === "true" ? true : value === "false" ? false : isNaN(Number(value)) ? value : Number(value);
      (settings as any)[setting] = parsed;
      saveSettings(settings);
      if (setting === "shuffle") { idx = 0; flipped = false; buildOrder(); }
      syncSettingsUI();
      render();
      resetAutoplay();
    });
  });

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    switch (e.key) {
      case "ArrowLeft": go(-1); break;
      case "ArrowRight": go(1); break;
      case " ": e.preventDefault(); flip(); break;
      case "Enter": flip(); break;
      case "f": case "F": toggleFullscreen(); break;
      case "s": case "S": shuffle(); break;
      case "r": case "R": reset(); break;
      case "Escape":
        if (settingsPanel.classList.contains("open")) openSettings(false);
        break;
      case ",": case "/": openSettings(!settingsPanel.classList.contains("open")); break;
    }
  });

  buildOrder();
  syncSettingsUI();
  render();
  resetAutoplay();
}
