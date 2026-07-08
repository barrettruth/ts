default:
    @just --list

run: build
    python3 -m http.server 8080 --bind 127.0.0.1 --directory dist

format:
    biome format public/index.html public/main.js public/main.css biome.json
    shfmt -i 2 -d scripts

check:
    biome check public/index.html public/main.js public/main.css biome.json

lint:
    biome lint public/index.html public/main.js public/main.css biome.json
    shellcheck scripts/*.sh

build:
    scripts/update-corpus.sh public
    install -d dist
    rsync -a --delete public/ dist/

ci: format check lint build
    @:
