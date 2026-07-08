import {
  acronyms as corpusAcronyms,
  sentences as corpusSentences,
  words as corpusWords,
} from "./corpus.js";

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

const practiceSize = 900;
const codeWords = [
  "const value = items[index];",
  "if (value === null) return;",
  "function render(target) { return target.map(String).join(', '); }",
  "for (const item of items) total += item.count;",
];

const levels = [
  ["01", "home", () => rowDrill(["home"], 0.1)],
  ["02", "top", () => rowDrill(["home", "top"], 0.5)],
  ["03", "bottom", () => rowDrill(["home", "bottom"], 0.5)],
  ["04", "short", shortDrill],
  ["05", "prose", proseDrill],
  ["06", "caps", capsDrill],
  ["07", "punct", punctuationDrill],
  ["08", "numbers", numberDrill],
  ["09", "symbols", symbolDrill],
  ["10", "sentences", sentenceDrill],
  ["11", "code", () => shuffle(codeWords)],
].map(([id, name, words]) => ({ id, name, words }));

const layouts = Object.entries(layoutRows).map(([id, layout]) => [id, layout.name]);

const app = document.getElementById("app");
const layoutList = document.getElementById("layouts");
const levelList = document.getElementById("levels");
const typeWindow = document.getElementById("type-window");
const wordStream = document.getElementById("word-stream");
const statsElement = document.getElementById("stats");
const cursorElement = document.createElement("span");
cursorElement.className = "typing-cursor";

let layoutId = readLayoutId();
let levelId = readLevelId();
let currentWords = [];
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

function altgrSymbols() {
  return charsForLayer("altgr");
}

function unique(chars) {
  return [...new Set(chars)];
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(items) {
  return items[randomInt(0, items.length - 1)];
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function wordBank() {
  return corpusWords.filter((word) => /^[a-z]+$/.test(word));
}

function acronymBank() {
  return corpusAcronyms.filter((word) => /^[A-Z]{2,6}$/.test(word));
}

function wordsFrom(chars, minLength = 1, maxLength = Number.POSITIVE_INFINITY) {
  const allowed = new Set(chars);
  return wordBank().filter(
    (word) =>
      word.length >= minLength &&
      word.length <= maxLength &&
      Array.from(word).every((char) => allowed.has(char)),
  );
}

function generatedWord(chars, minLength = 3, maxLength = 6) {
  return Array.from({ length: randomInt(minLength, maxLength) }, () => pick(chars)).join("");
}

function mixedGeneratedAndReal(chars, realRatio) {
  const realWords = wordsFrom(chars, 3, 6);
  return Array.from({ length: practiceSize }, () => {
    if (realWords.length > 0 && Math.random() < realRatio) {
      return pick(realWords);
    }
    return generatedWord(chars);
  });
}

function rowDrill(rowNames, realRatio) {
  return mixedGeneratedAndReal(rowSet(rowNames), realRatio);
}

function shortDrill() {
  return shuffle(wordBank().filter((word) => word.length < 5));
}

function proseDrill() {
  return shuffle(wordBank()).slice(0, practiceSize);
}

function capsDrill() {
  const words = wordBank();
  const acronyms = acronymBank();
  return Array.from({ length: practiceSize }, () => {
    const roll = Math.random();
    if (roll < 0.125 && acronyms.length > 0) {
      return pick(acronyms);
    }
    if (roll < 0.25) {
      return capitalize(pick(words));
    }
    return pick(words);
  });
}

function proseMarks() {
  return [",", ".", ";", ":", "?", "!", '"'];
}

function punctuationDrill() {
  const marks = proseMarks();
  const words = wordBank();
  return Array.from({ length: 260 }, () => punctuatedRun(words, marks));
}

function punctuatedRun(words, marks) {
  const length = randomInt(4, 12);
  const result = [];
  let capitalizeNext = Math.random() < 0.35;
  let quoted = false;
  const quoteStart = Math.random() < 0.25 ? randomInt(0, length - 2) : -1;
  const quoteEnd = quoteStart >= 0 ? randomInt(quoteStart + 1, length - 1) : -1;

  for (let index = 0; index < length; index += 1) {
    let word = pick(words);
    if (capitalizeNext) {
      word = capitalize(word);
      capitalizeNext = false;
    }
    if (index === quoteStart && marks.includes('"')) {
      word = `"${word}`;
      quoted = true;
    }
    if (quoted && index === quoteEnd) {
      word = `${word}"`;
      quoted = false;
    }
    if (index < length - 1 && Math.random() < 0.22) {
      const mark = pick(marks.filter((item) => item !== '"'));
      word = `${word}${mark}`;
      capitalizeNext = [".", "?", "!"].includes(mark);
    }
    result.push(word);
  }

  if (![".", "?", "!", '"'].some((mark) => result.at(-1).endsWith(mark))) {
    result[result.length - 1] = `${result.at(-1)}${pick([".", "?", "!"])}`;
  }
  return result.join(" ");
}

function numberDrill() {
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const nouns = ["files", "rows", "keys", "lines", "tabs", "words", "items"];
  const units = ["wpm", "px", "rem", "ms", "kb"];
  return Array.from({ length: 320 }, () => {
    const kind = randomInt(1, 8);
    if (kind === 1) return `${pick(months)} ${randomInt(1, 28)}`;
    if (kind === 2) return `${randomInt(1, 12)}:${String(randomInt(0, 59)).padStart(2, "0")}`;
    if (kind === 3) return `${randomInt(2, 99)} ${pick(nouns)}`;
    if (kind === 4) return `v${randomInt(0, 4)}.${randomInt(0, 20)}`;
    if (kind === 5) return `${randomInt(1, 120)} ${pick(units)}`;
    if (kind === 6) return `line ${randomInt(1, 500)}`;
    if (kind === 7) return `port ${pick([3000, 5173, 8080, 9000])}`;
    return `${randomInt(2020, 2030)}`;
  });
}

function symbolSet() {
  const symbols = unique(altgrSymbols());
  if (symbols.length > 0) {
    return symbols;
  }
  return unique([
    "!",
    "@",
    "#",
    "$",
    "%",
    "^",
    "&",
    "*",
    "(",
    ")",
    "-",
    "_",
    "=",
    "+",
    "[",
    "]",
    "{",
    "}",
    "\\",
    "|",
    ";",
    ":",
    "'",
    '"',
    ",",
    ".",
    "<",
    ">",
    "/",
    "?",
    "`",
    "~",
  ]);
}

function symbolDrill() {
  const symbols = symbolSet();
  return Array.from({ length: practiceSize }, () => generatedWord(symbols, 1, 5));
}

function sentenceDrill() {
  return shuffle(corpusSentences).slice(0, 240);
}

function activeWords() {
  return currentWords;
}

function streamTextUntil(minLength) {
  const words = activeWords();
  let text = "";
  let index = 0;

  while (words.length > 0 && text.length <= minLength) {
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
  const topEdge = windowRect.top + windowRect.height * 0.12;
  const bottomEdge = windowRect.top + windowRect.height * 0.42;

  if (currentRect.top < topEdge || currentRect.bottom > bottomEdge) {
    current.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  }
}

function positionCursor() {
  const current = document.getElementById("current-char");
  if (current === null) {
    return;
  }

  const style = getComputedStyle(wordStream);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const x = current.offsetLeft;
  const y = current.offsetTop + lineHeight * 0.78;
  cursorElement.style.transform = `translate(${x}px, ${y}px)`;
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
  wordStream.replaceChildren(fragment, cursorElement);
  requestAnimationFrame(() => {
    positionCursor();
    revealCurrent();
  });
}

function renderStats() {
  statsElement.textContent = `${calculateWpm()} wpm / ${calculateAccuracy()} % / ${formatElapsed()}`;
}

function render() {
  renderStream();
  renderStats();
}

function reset() {
  currentWords = activeLevel().words();
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
