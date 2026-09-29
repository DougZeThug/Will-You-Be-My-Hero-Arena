#!/usr/bin/env bash
# Pinned Godot toolchain. Change a pin only in its own commit with the reason.
# Sourced by the other scripts in this folder; safe to source repeatedly.

GODOT_VERSION="4.7.2-stable"
GODOT_ZIP_NAME="Godot_v${GODOT_VERSION}_linux.x86_64.zip"
GODOT_URL="https://github.com/godotengine/godot-builds/releases/download/${GODOT_VERSION}/${GODOT_ZIP_NAME}"
# Official SHA512-SUMS.txt from the same release (checked 2026-09-29).
GODOT_SHA512="9aa00f7a605200940bce3027a567b782f49bd8e940dd06ae9e987bd65aee1b1467edd56ed84fcdcbdd44354bf613bdbb4e5d2913e925850368e150c59ed54c65"

GUT_REPO="https://github.com/bitwes/Gut"
GUT_TAG="v9.7.1"

ARENA_GODOT_TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARENA_GODOT_PROJECT="$(cd "$ARENA_GODOT_TOOLS/.." && pwd)"
ARENA_REPO_ROOT="$(cd "$ARENA_GODOT_PROJECT/.." && pwd)"
ARENA_GODOT_HOME="${ARENA_GODOT_HOME:-$HOME/.cache/arena-godot}"
GODOT_BIN="${GODOT_BIN:-$ARENA_GODOT_HOME/Godot_v${GODOT_VERSION}_linux.x86_64}"
# Disposable evidence lives under the git-ignored work/ folder (AGENTS.md).
ARENA_QA_DIR="${ARENA_QA_DIR:-$ARENA_REPO_ROOT/work/qa/godot}"
