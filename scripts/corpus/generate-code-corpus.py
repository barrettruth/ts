import json
import os
import re
import subprocess
import sys
import tempfile
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
    "label",
    "string",
    "number",
    "boolean",
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
    "boolean": "syntax-constant",
    "comment": "syntax-comment",
    "constant": "syntax-constant",
    "constructor": "syntax-type",
    "function": "syntax-function",
    "keyword": "syntax-keyword",
    "label": "syntax-keyword",
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

class_priority = {}
for index, capture in enumerate(capture_priority):
    class_priority.setdefault(capture_class[capture], index)


class HighlightParser(HTMLParser):
    def __init__(self, language):
        super().__init__()
        self.language = language
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
        class_name = strongest_capture(self.stack)
        if self.language == "lua" and class_name == "syntax-function" and data in {"function", "end"}:
            class_name = "syntax-keyword"
        self.text.append(data)
        self.classes.extend([class_name] * len(data))

    def result(self):
        return "".join(self.text), self.classes


def strongest_capture(classes):
    choices = [class_name for class_name in classes if class_name is not None]
    if not choices:
        return None
    return min(choices, key=lambda class_name: class_priority[class_name])


def normalize_capture(classes):
    for capture in capture_priority:
        if capture in classes:
            return capture_class[capture]
    return None


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


line_comment_prefixes = {
    "c": ("//",),
    "cpp": ("//",),
    "javascript": ("//",),
    "lua": ("--",),
    "nix": ("#",),
    "python": ("#",),
    "shell": ("#",),
    "typescript": ("//",),
}

block_comment_languages = {"c", "cpp", "css", "javascript", "nix", "typescript"}


def comment_line(language, line, in_block):
    stripped = line.strip()
    if not stripped:
        return False, in_block
    if in_block:
        return True, "*/" not in stripped
    if language in block_comment_languages and stripped.startswith("/*"):
        return True, "*/" not in stripped
    return stripped.startswith(line_comment_prefixes.get(language, ())), False


def validate_comments(path, language, code):
    if language == "python" and re.search(r"(?m)^\s*(?:[rRuUbBfF]{0,3})?('''|\"\"\")", code):
        fail(f"{path}: snippets must not include Python docstrings")
    if language == "lua" and re.search(r"(?m)^\s*---", code):
        fail(f"{path}: snippets must not include Lua documentation comments")
    if language in {"c", "cpp", "javascript", "typescript"} and re.search(r"(?m)^\s*/\*\*", code):
        fail(f"{path}: snippets must not include documentation comment blocks")
    if language in {"c", "cpp", "javascript", "typescript"} and re.search(r"(?m)^\s*///", code):
        fail(f"{path}: snippets must not include documentation comments")

    run = 0
    in_block = False
    for line in code.splitlines():
        is_comment, in_block = comment_line(language, line, in_block)
        if is_comment:
            run += 1
            if run > 8:
                fail(f"{path}: snippet has more than 8 consecutive comment lines")
        elif line.strip():
            run = 0


def trim_leading_indent(code):
    first_line = code.split("\n", 1)[0]
    indent_width = len(first_line) - len(first_line.lstrip(" "))
    if indent_width == 0:
        return code

    lines = code.split("\n")
    return "\n".join(line[min(len(line) - len(line.lstrip(" ")), indent_width) :] for line in lines)


def validate(path, language, code, check_length=True):
    if check_length and (len(code) < 800 or len(code) > 3800):
        fail(f"{path}: snippet length outside 800-3800 characters")
    if "\r" in code or "\t" in code:
        fail(f"{path}: snippets must use Unix newlines and spaces")
    if any(char != "\n" and not (" " <= char <= "~") for char in code):
        fail(f"{path}: snippets must only use printable ASCII characters")
    if any(len(line) > 160 for line in code.splitlines()):
        fail(f"{path}: snippet line exceeds 160 characters")
    if re.search(r"password|secret|token|api[_-]?key", code, re.IGNORECASE):
        fail(f"{path}: snippet contains sensitive-looking text")
    validate_comments(path, language, code)


def highlighted(config_path, path, code, language):
    env = os.environ.copy()
    env.setdefault("XDG_CACHE_HOME", str(Path(config_path).parent / "cache"))
    with tempfile.NamedTemporaryFile("w", suffix=path.suffix, delete=False) as source:
        source.write(code)
        source_path = Path(source.name)
    try:
        result = subprocess.run(
            [
                "tree-sitter",
                "highlight",
                "--html",
                "--css-classes",
                "--config-path",
                str(config_path),
                str(source_path),
            ],
            check=False,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    finally:
        source_path.unlink(missing_ok=True)
    if result.returncode != 0:
        fail(f"{path}: tree-sitter highlight failed\n{result.stderr}")
    parser = HighlightParser(language)
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
        source_code = path.read_text().rstrip("\n")
        validate(path, language, source_code)
        code = trim_leading_indent(source_code)
        validate(path, language, code, check_length=False)
        if code in seen:
            fail(f"{path}: duplicate snippet")
        seen.add(code)
        classes = highlighted(config_path, path, code, language)
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
