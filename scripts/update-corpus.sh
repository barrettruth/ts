#!/bin/sh
set -eu

out_dir=${1:-public}
words_url=${TYPE_SCOWL_WORDS_URL:-https://raw.githubusercontent.com/rdeits/SCOWL-mirror/master/final/english-words.35}
abbrev_url=${TYPE_SCOWL_ABBREV_URL:-https://raw.githubusercontent.com/rdeits/SCOWL-mirror/master/final/english-abbreviations.35}
gutenberg_urls=${TYPE_GUTENBERG_URLS:-"https://www.gutenberg.org/files/1342/1342-0.txt https://www.gutenberg.org/files/84/84-0.txt https://www.gutenberg.org/files/1661/1661-0.txt"}

mkdir -p "$out_dir"
tmp=${TMPDIR:-/tmp}/type-corpus-$$
mkdir -p "$tmp"
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

curl -fsSL "$words_url" |
  tr ' ' '\n' |
  tr '[:upper:]' '[:lower:]' |
  awk '/^[a-z]+$/ { if (!seen[$0]++) print $0 }' >"$tmp/words"

curl -fsSL "$abbrev_url" |
  tr ' ' '\n' |
  awk '/^[A-Z][A-Z][A-Z][A-Z]?[A-Z]?[A-Z]?$/ { if (!seen[$0]++) print $0 }' >"$tmp/acronyms"

: >"$tmp/books"
for url in $gutenberg_urls; do
  curl -fsSL "$url" >>"$tmp/books"
  printf '\n' >>"$tmp/books"
done

double_quotes=$(printf '\342\200\234\342\200\235')
single_quotes=$(printf '\342\200\230\342\200\231')

awk '
  BEGIN { active = 0 }
  /^\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK/ { active = 1; next }
  /^\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK/ { active = 0 }
  active { print }
' "$tmp/books" |
  tr '\r' '\n' |
  awk -v double_quotes="$double_quotes" -v single_quotes="$single_quotes" '
    { gsub("[" double_quotes "]", "\""); gsub("[" single_quotes "]", "\047"); gsub(/--+/, " "); gsub(/[_*]/, " "); print }
  ' |
  awk '
    BEGIN { RS = "[.!?]" }
    {
      text = $0
      gsub(/[\n\t ]+/, " ", text)
      sub(/^ /, "", text)
      sub(/ $/, "", text)
      if (length(text) >= 30 && length(text) <= 140 && text !~ /[^A-Za-z0-9 ,;:\047"-]/ && text !~ /^[A-Z0-9 ,;:\047"-]+$/) {
        print text "."
      }
    }
  ' |
  awk '!seen[$0]++ { print }' |
  sed 300q >"$tmp/sentences"

json_array() {
  awk '
    BEGIN { print "["; first = 1 }
    {
      gsub(/\\/, "\\\\")
      gsub(/"/, "\\\"")
      if (!first) printf ",\n"
      printf "  \"%s\"", $0
      first = 0
    }
    END { print "\n]" }
  ' "$1"
}

{
  printf 'export const words = '
  json_array "$tmp/words"
  printf ';\n\nexport const acronyms = '
  json_array "$tmp/acronyms"
  printf ';\n\nexport const sentences = '
  json_array "$tmp/sentences"
  printf ';\n'
} >"$out_dir/corpus.js"
