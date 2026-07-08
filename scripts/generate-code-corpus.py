import json
import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path


languages = {
    ".bash": "bash",
    ".c": "c",
    ".cpp": "cpp",
    ".css": "css",
    ".html": "html",
    ".js": "javascript",
    ".lua": "lua",
    ".nix": "nix",
    ".py": "python",
    ".sh": "shell",
    ".ts": "typescript",
}

capture_priority = [
    "comment",
    "keyword",
    "string",
    "number",
    "function",
    "type",
    "constructor",
    "constant",
    "operator",
    "punctuation",
    "property",
    "variable",
    "module",
    "attribute",
    "tag",
]

capture_class = {
    "attribute": "syntax-attribute",
    "comment": "syntax-comment",
    "constant": "syntax-constant",
    "constructor": "syntax-type",
    "function": "syntax-function",
    "keyword": "syntax-keyword",
    "module": "syntax-module",
    "number": "syntax-number",
    "operator": "syntax-operator",
    "property": "syntax-property",
    "punctuation": "syntax-punctuation",
    "string": "syntax-string",
    "tag": "syntax-tag",
    "type": "syntax-type",
    "variable": "syntax-variable",
}


class HighlightParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_line = False
        self.stack = []
        self.text = []
        self.classes = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        if tag == "td" and "line" in classes:
            self.in_line = True
            return
        if self.in_line and tag == "span":
            self.stack.append(normalize_capture(classes))

    def handle_endtag(self, tag):
        if self.in_line and tag == "span" and self.stack:
            self.stack.pop()
            return
        if self.in_line and tag == "td":
            self.in_line = False

    def handle_data(self, data):
        if not self.in_line:
            return
        class_name = self.stack[-1] if self.stack else None
        self.text.append(data)
        self.classes.extend([class_name] * len(data))

    def result(self):
        return "".join(self.text), self.classes


def normalize_capture(classes):
    for capture in capture_priority:
        if capture in classes:
            return capture_class[capture]
    return None


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


def validate(path, language, code):
    if len(code) < 40 or len(code) > 700:
        fail(f"{path}: snippet length outside 40-700 characters")
    if "\r" in code or "\t" in code:
        fail(f"{path}: snippets must use Unix newlines and spaces")
    if any(len(line) > 88 for line in code.splitlines()):
        fail(f"{path}: snippet line exceeds 88 characters")
    if re.search(r"password|secret|token|api[_-]?key", code, re.IGNORECASE):
        fail(f"{path}: snippet contains sensitive-looking text")
    markers = {
        "bash": ("#",),
        "c": ("//", "/*"),
        "cpp": ("//", "/*"),
        "css": ("/*",),
        "html": ("<!--",),
        "javascript": ("//", "/*"),
        "lua": ("--",),
        "nix": ("#", "/*"),
        "python": ("#",),
        "shell": ("#",),
        "typescript": ("//", "/*"),
    }
    if any(marker in code for marker in markers.get(language, ())):
        fail(f"{path}: snippets must not contain comments")


def highlighted(config_path, path, code):
    env = os.environ.copy()
    env.setdefault("XDG_CACHE_HOME", str(Path(config_path).parent / "cache"))
    result = subprocess.run(
        [
            "tree-sitter",
            "highlight",
            "--html",
            "--css-classes",
            "--config-path",
            str(config_path),
            str(path),
        ],
        check=False,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        fail(f"{path}: tree-sitter highlight failed\n{result.stderr}")
    parser = HighlightParser()
    parser.feed(result.stdout)
    text, classes = parser.result()
    if text != code:
        suffix = text[len(code) :] if text.startswith(code) else None
        if suffix is not None and suffix.strip("\n") == "":
            text = code
            classes = classes[: len(code)]
        else:
            fail(f"{path}: highlighted text did not match source")
    return classes


def spans_from(classes):
    spans = []
    start = None
    class_name = None
    for index, next_class in enumerate(classes + [None]):
        if next_class == class_name:
            continue
        if class_name is not None:
            spans.append({"start": start, "end": index, "className": class_name})
        start = index if next_class is not None else None
        class_name = next_class
    return spans


def main():
    if len(sys.argv) != 4:
        fail("usage: generate-code-corpus.py SNIPPET_DIR OUT_FILE TREE_SITTER_CONFIG")
    snippet_dir = Path(sys.argv[1])
    out_file = Path(sys.argv[2])
    config_path = Path(sys.argv[3])
    snippets = []
    seen = set()
    paths = sorted(path for path in snippet_dir.rglob("*") if path.suffix in languages)
    if not paths:
        fail(f"{snippet_dir}: no code snippets found")
    for path in paths:
        language = languages[path.suffix]
        code = path.read_text().rstrip("\n")
        validate(path, language, code)
        if code in seen:
            fail(f"{path}: duplicate snippet")
        seen.add(code)
        classes = highlighted(config_path, path, code)
        snippets.append(
            {
                "language": language,
                "name": str(path.relative_to(snippet_dir)),
                "code": code,
                "spans": spans_from(classes),
            }
        )
    out_file.write_text(f"export const codeSnippets = {json.dumps(snippets, indent=2)};\n")


main()
