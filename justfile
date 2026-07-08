default:
    @just --list

run: build
    python3 -m http.server 8080 --bind 127.0.0.1 --directory dist

format:
    biome format public/main.js public/main.css biome.json

check:
    biome check public/main.js public/main.css biome.json

lint:
    biome lint public/main.js public/main.css biome.json

build:
    install -d dist
    rsync -a --delete public/ dist/

ci: format check lint build
    @:
