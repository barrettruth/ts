default:
    @just --list

run:
    trunk serve

format:
    cargo fmt --all -- --check

check:
    cargo check --target wasm32-unknown-unknown

lint:
    cargo clippy --target wasm32-unknown-unknown -- -D warnings

build:
    trunk build --release

ci: format check lint build
    @:
