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

# Prototype addons (anim_compare / camera_spike only; see godot/ADDONS.md). Pinned by tag; the
# commit is recorded so a moved tag is detected. Both are MIT (checked 2026-09-29).
PCAM_REPO="https://github.com/ramokz/phantom-camera"
PCAM_TAG="v0.11.0.3"
PCAM_COMMIT="cb6e0966ac305202c47f1d1a81c105966e29da96"
SVS_REPO="https://github.com/Teaching-myself-Godot/ez-curved-lines-2d"
SVS_TAG="2.35.1"
SVS_COMMIT="d477ee3a8f47101fbcc5fbf3a915574589f38d2c"

ARENA_GODOT_TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARENA_GODOT_PROJECT="$(cd "$ARENA_GODOT_TOOLS/.." && pwd)"
ARENA_REPO_ROOT="$(cd "$ARENA_GODOT_PROJECT/.." && pwd)"
ARENA_GODOT_HOME="${ARENA_GODOT_HOME:-$HOME/.cache/arena-godot}"
GODOT_BIN="${GODOT_BIN:-$ARENA_GODOT_HOME/Godot_v${GODOT_VERSION}_linux.x86_64}"
# Disposable evidence lives under the git-ignored work/ folder (AGENTS.md).
ARENA_QA_DIR="${ARENA_QA_DIR:-$ARENA_REPO_ROOT/work/qa/godot}"

# arena_qa_subdir <relative path>: print the absolute directory under ARENA_QA_DIR for a
# capture/QA run, or fail (status 2). Rejects absolute paths, "..", and anything outside
# [A-Za-z0-9._/-], then checks the resolved path stays strictly beneath ARENA_QA_DIR. Every
# script that clears an output folder goes through this before `rm -rf`.
arena_qa_subdir() {
  local rel="${1:-}" base resolved
  case "$rel" in
    ''|/*|*..*|*[!A-Za-z0-9._/-]*)
      echo "unsafe QA path '$rel' (use letters, digits, '.', '_', '-', '/'; no '..', no absolute paths)" >&2
      return 2 ;;
  esac
  base="$(realpath -m "$ARENA_QA_DIR")"
  resolved="$(realpath -m "$base/$rel")"
  case "$resolved" in
    "$base"/?*) printf '%s\n' "$resolved" ;;
    *) echo "QA path '$rel' resolves outside $base" >&2; return 2 ;;
  esac
}
