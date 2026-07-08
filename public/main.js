const words = [
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
  "line",
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

const layouts = [
  ["qwerty", "QWERTY"],
  ["dvorak", "Dvorak"],
  ["colemak-dh", "Colemak-DH"],
  ["baremak", "Baremak"],
];

const app = document.getElementById("app");
const layoutList = document.getElementById("layouts");
const typeWindow = document.getElementById("type-window");
const wordStream = document.getElementById("word-stream");
const wpmElement = document.getElementById("wpm");

let layoutId = "baremak";
let cursor = 0;
let lastWrong = null;
let startedAt = null;
let now = performance.now();

function streamTextUntil(minLength) {
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

function calculateWpm() {
  if (startedAt === null) {
    return 0;
  }

  const elapsedMinutes = (now - startedAt) / 60000;
  if (elapsedMinutes <= 0) {
    return 0;
  }

  return Math.round(cursor / 5 / elapsedMinutes);
}

function renderLayouts() {
  layoutList.replaceChildren(
    ...layouts.map(([id, name]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.classList.toggle("selected", layoutId === id);
      button.addEventListener("click", () => {
        layoutId = id;
        reset();
        requestAnimationFrame(() => app.focus());
      });
      return button;
    }),
  );
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
  document.getElementById("current-char")?.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });
}

function renderWpm() {
  wpmElement.textContent = String(calculateWpm());
}

function render() {
  renderLayouts();
  renderStream();
  renderWpm();
}

function reset() {
  cursor = 0;
  lastWrong = null;
  startedAt = null;
  now = performance.now();
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
    lastWrong = typed;
  }

  render();
}

app.addEventListener("keydown", handleKeydown);
app.addEventListener("pointerdown", () => app.focus());
setInterval(() => {
  now = performance.now();
  renderWpm();
}, 500);
render();
app.focus();
