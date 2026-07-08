const levelStorageKey = "type.activeLevel";

const levelWords = [
  "truth",
  "stone",
  "train",
  "notes",
  "calm",
  "hands",
  "clear",
  "steady",
  "practice",
  "layout",
  "baremak",
  "colemak",
  "dvorak",
  "qwerty",
  "focus",
  "signal",
  "rhythm",
  "cursor",
  "letter",
  "quiet",
  "exact",
  "typing",
  "speed",
  "memory",
  "repeat",
  "system",
  "syntax",
  "buffer",
  "window",
  "branch",
  "commit",
  "vector",
  "string",
  "result",
  "module",
  "match",
  "async",
  "struct",
  "public",
  "private",
  "render",
  "scroll",
  "target",
  "symbol",
  "layer",
  "right",
  "index",
];

const levels = [
  ["01", "home"],
  ["02", "top"],
  ["03", "bottom"],
  ["04", "short"],
  ["05", "bigrams"],
  ["06", "trigrams"],
  ["07", "punct"],
  ["08", "symbols"],
  ["09", "prose"],
  ["10", "code"],
].map(([id, name]) => ({ id, name, words: levelWords }));

const layouts = [
  ["qwerty", "QWERTY"],
  ["dvorak", "Dvorak"],
  ["colemak-dh", "Colemak-DH"],
  ["baremak", "Baremak"],
];

const app = document.getElementById("app");
const layoutList = document.getElementById("layouts");
const levelList = document.getElementById("levels");
const typeWindow = document.getElementById("type-window");
const wordStream = document.getElementById("word-stream");
const statsElement = document.getElementById("stats");

let layoutId = "baremak";
let levelId = readLevelId();
let cursor = 0;
let errors = 0;
let lastWrong = null;
let startedAt = null;
let now = performance.now();

function readLevelId() {
  const fallback = levels[0].id;
  const stored = localStorage.getItem(levelStorageKey);
  return levels.some((level) => level.id === stored) ? stored : fallback;
}

function activeWords() {
  return levels.find((level) => level.id === levelId)?.words ?? levels[0].words;
}

function streamTextUntil(minLength) {
  const words = activeWords();
  let text = "";
  let index = 0;

  while (text.length <= minLength) {
    if (text) {
      text += " ";
    }
    text += words[index % words.length];
    index += 1;
  }

  return text;
}

function streamChar(index) {
  return streamTextUntil(index).at(index);
}

function streamWindow() {
  const start = Math.max(cursor - 360, 0);
  const end = cursor + 900;
  return Array.from(streamTextUntil(end).slice(start, end + 1), (char, offset) => [
    start + offset,
    char,
  ]);
}

function printableKey(key) {
  if (key === " " || key === "Spacebar") {
    return " ";
  }
  return Array.from(key).length === 1 ? key : null;
}

function charClass(index, char) {
  const classNames = ["char"];
  if (char === " ") {
    classNames.push("space");
  }
  if (index < cursor) {
    classNames.push("typed");
  } else if (index === cursor) {
    classNames.push("current");
    if (lastWrong !== null) {
      classNames.push("wrong");
    }
  } else {
    classNames.push("future");
  }
  return classNames.join(" ");
}

function elapsedMs() {
  return startedAt === null ? 0 : Math.max(now - startedAt, 0);
}

function calculateWpm() {
  const elapsedMinutes = elapsedMs() / 60000;
  if (elapsedMinutes <= 0) {
    return 0;
  }

  return Math.round(cursor / 5 / elapsedMinutes);
}

function calculateAccuracy() {
  const total = cursor + errors;
  if (total === 0) {
    return 100;
  }

  return Math.round((cursor / total) * 100);
}

function formatElapsed() {
  const totalSeconds = Math.floor(elapsedMs() / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m${seconds}s`;
}

function buttonFor({ active, className, label, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className ?? "";
  button.classList.toggle("selected", active);
  if (active) {
    button.setAttribute("aria-current", "true");
  }
  button.addEventListener("click", onClick);
  return button;
}

function levelButtonFor({ active, id, name, onClick }) {
  const button = buttonFor({ active, className: "level", label: "", onClick });
  const number = document.createElement("span");
  const label = document.createElement("span");

  number.className = "level-number";
  number.textContent = id;
  label.className = "level-name";
  label.textContent = name;
  button.replaceChildren(number, label);

  return button;
}

function renderLayouts() {
  layoutList.replaceChildren(
    ...layouts.map(([id, name]) =>
      buttonFor({
        active: layoutId === id,
        label: name,
        onClick: () => {
          layoutId = id;
          reset();
          requestAnimationFrame(() => app.focus());
        },
      }),
    ),
  );
}

function renderLevels() {
  levelList.replaceChildren(
    ...levels.map((level) =>
      levelButtonFor({
        active: levelId === level.id,
        id: level.id,
        name: level.name,
        onClick: () => {
          levelId = level.id;
          localStorage.setItem(levelStorageKey, levelId);
          reset();
          requestAnimationFrame(() => app.focus());
        },
      }),
    ),
  );
}

function revealCurrent() {
  const current = document.getElementById("current-char");
  if (current === null) {
    return;
  }

  const windowRect = typeWindow.getBoundingClientRect();
  const currentRect = current.getBoundingClientRect();
  const topEdge = windowRect.top + windowRect.height * 0.34;
  const bottomEdge = windowRect.top + windowRect.height * 0.66;

  if (currentRect.top < topEdge || currentRect.bottom > bottomEdge) {
    current.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }
}

function renderStream() {
  const fragment = document.createDocumentFragment();

  for (const [index, char] of streamWindow()) {
    const span = document.createElement("span");
    span.className = charClass(index, char);
    span.textContent = char;
    if (index === cursor) {
      span.id = "current-char";
    }
    fragment.append(span);
  }

  typeWindow.classList.toggle("blocked", lastWrong !== null);
  wordStream.replaceChildren(fragment);
  requestAnimationFrame(revealCurrent);
}

function renderStats() {
  statsElement.textContent = `${calculateWpm()} wpm / ${calculateAccuracy()} % / ${formatElapsed()}`;
}

function render() {
  renderStream();
  renderStats();
}

function reset() {
  cursor = 0;
  errors = 0;
  lastWrong = null;
  startedAt = null;
  now = performance.now();
  renderLayouts();
  renderLevels();
  render();
}

function handleKeydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    cursor = Math.max(cursor - 1, 0);
    lastWrong = null;
    render();
    return;
  }

  const typed = printableKey(event.key);
  if (typed === null) {
    return;
  }

  const expected = streamChar(cursor);
  if (expected === undefined) {
    return;
  }

  event.preventDefault();

  if (typed === expected) {
    if (startedAt === null) {
      startedAt = performance.now();
      now = startedAt;
    }
    cursor += 1;
    lastWrong = null;
  } else {
    errors += 1;
    lastWrong = typed;
  }

  render();
}

app.addEventListener("keydown", handleKeydown);
app.addEventListener("pointerdown", () => app.focus());
setInterval(() => {
  now = performance.now();
  renderStats();
}, 500);
reset();
app.focus();
