const layoutStorageKey = "type.activeLayout";
const levelStorageKey = "type.activeLevel";

const layoutRows = {
  qwerty: {
    name: "QWERTY",
    rows: {
      top: row("qwertyuiop"),
      home: row("asdfghjkl;'", 'ASDFGHJKL:"'),
      bottom: row("zxcvbnm,./", "ZXCVBNM<>?"),
    },
  },
  dvorak: {
    name: "Dvorak",
    rows: {
      top: row("',.pyfgcrl", '"<>PYFGCRL'),
      home: row("aoeuidhtns-", "AOEUIDHTNS_"),
      bottom: row(";qjkxbmwvz", ":QJKXBMWVZ"),
    },
  },
  "colemak-dh": {
    name: "Colemak-DH",
    rows: {
      top: row("qwfpbjluy;", "QWFPBJLUY:"),
      home: row("arstgmneio'", 'ARSTGMNEIO"'),
      bottom: row("zxcdvkh,./", "ZXCDVKH<>?"),
    },
  },
  baremak: {
    name: "Baremak",
    rows: {
      top: row("qwfpbjluy;", "QWFPBJLUY:", "!@#</\\>&$|"),
      home: row("arstgmneio'", 'ARSTGMNEIO"', "[{=(+-)~}]`"),
      bottom: row("zxcdvkh,./", "ZXCDVKH<>?", "%^*_?:;'\""),
    },
  },
};

const shortWords = [
  "a",
  "i",
  "as",
  "at",
  "in",
  "it",
  "no",
  "on",
  "or",
  "to",
  "we",
  "if",
  "run",
  "set",
  "map",
  "row",
  "key",
  "code",
  "type",
  "word",
];
const proseWords = [
  "truth",
  "stone",
  "train",
  "notes",
  "calm",
  "hands",
  "clear",
  "steady",
  "focus",
  "signal",
];
const capsWords = proseWords.map(capitalize);
const numberWords = ["line 42", "port 8080", "5 keys", "12 rows", "80 wpm", "v2", "0.12", "2026"];
const sentenceWords = [
  "The hands return home.",
  "Clear notes keep focus.",
  "Steady practice builds rhythm.",
];
const codeWords = [
  "const value = 1;",
  "return result;",
  "if (match) { render(); }",
  "target[key] = value;",
];

const levels = [
  ["01", "home", () => rowDrill(["home"])],
  ["02", "top", () => rowDrill(["home", "top"])],
  ["03", "bottom", () => rowDrill(["home", "top", "bottom"])],
  ["04", "short", () => shortWords],
  ["05", "ngrams", ngramDrill],
  ["06", "prose", () => proseWords],
  ["07", "caps", () => capsWords],
  ["08", "punct", punctuationDrill],
  ["09", "numbers", () => numberWords],
  ["10", "symbols", symbolDrill],
  ["11", "sentences", () => sentenceWords],
  ["12", "code", () => codeWords],
].map(([id, name, words]) => ({ id, name, words }));

const layouts = Object.entries(layoutRows).map(([id, layout]) => [id, layout.name]);

const app = document.getElementById("app");
const layoutList = document.getElementById("layouts");
const levelList = document.getElementById("levels");
const typeWindow = document.getElementById("type-window");
const wordStream = document.getElementById("word-stream");
const statsElement = document.getElementById("stats");

let layoutId = readLayoutId();
let levelId = readLevelId();
let cursor = 0;
let errors = 0;
let lastWrong = null;
let startedAt = null;
let now = performance.now();

function row(base, shift = base.toUpperCase(), altgr = "") {
  const shifts = Array.from(shift);
  const altgrs = Array.from(altgr);
  return Array.from(base, (char, index) => ({
    altgr: altgrs[index] ?? null,
    base: char,
    shift: shifts[index] ?? char,
  }));
}

function activeLayout() {
  return layoutRows[layoutId] ?? layoutRows.baremak;
}

function activeLevel() {
  return levels.find((level) => level.id === levelId) ?? levels[0];
}

function readLayoutId() {
  const fallback = "baremak";
  const stored = localStorage.getItem(layoutStorageKey);
  return layouts.some(([id]) => id === stored) ? stored : fallback;
}

function readLevelId() {
  const fallback = levels[0].id;
  const stored = localStorage.getItem(levelStorageKey);
  return levels.some((level) => level.id === stored) ? stored : fallback;
}

function charsForLayer(layer) {
  return Object.values(activeLayout().rows).flatMap((keys) =>
    keys.map((key) => key[layer]).filter(Boolean),
  );
}

function letter(char) {
  return /^[a-z]$/.test(char);
}

function capitalize(word) {
  return `${word[0].toUpperCase()}${word.slice(1)}`;
}

function rowLetters(rowName) {
  return activeLayout()
    .rows[rowName].map((key) => key.base)
    .filter(letter);
}

function rowSet(rowNames) {
  return unique(rowNames.flatMap(rowLetters));
}

function baseLetters() {
  return charsForLayer("base").filter(letter);
}

function basePunctuation() {
  return charsForLayer("base").filter((char) => !letter(char));
}

function shiftPunctuation() {
  return charsForLayer("shift").filter((char) => !/^[A-Z]$/.test(char));
}

function altgrSymbols() {
  return charsForLayer("altgr");
}

function unique(chars) {
  return [...new Set(chars)];
}

function chunks(chars, size) {
  const words = [];
  for (let index = 0; index < chars.length; index += size) {
    words.push(chars.slice(index, index + size).join(""));
  }
  return words;
}

function ngrams(chars, size) {
  const words = [];
  for (let index = 0; index <= chars.length - size; index += 1) {
    words.push(chars.slice(index, index + size).join(""));
  }
  return words;
}

function drillChars(chars) {
  return [...chunks(chars, 5), ...ngrams(chars, 2), chars.join("")].filter(Boolean);
}

function rowDrill(rowNames) {
  return drillChars(rowSet(rowNames));
}

function ngramDrill() {
  const letters = baseLetters();
  return [...ngrams(letters, 2), ...ngrams(letters, 3)];
}

function punctuationDrill() {
  const marks = unique([...basePunctuation(), ...shiftPunctuation()]);
  return proseWords.map((word, index) => `${word}${marks[index % marks.length]}`);
}

function symbolDrill() {
  const symbols = unique(altgrSymbols());
  const chars =
    symbols.length > 0 ? symbols : unique([...basePunctuation(), ...shiftPunctuation()]);
  return [...chunks(chars, 5), ...ngrams(chars, 2), ...ngrams(chars, 3)].filter(Boolean);
}

function activeWords() {
  return activeLevel().words();
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
          localStorage.setItem(layoutStorageKey, layoutId);
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
  if (event.metaKey || ((event.ctrlKey || event.altKey) && !event.getModifierState("AltGraph"))) {
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
