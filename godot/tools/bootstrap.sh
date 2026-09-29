#!/usr/bin/env bash
# Idempotent toolchain bootstrap for a fresh (ephemeral) container:
#   pinned Godot editor binary (SHA-512 verified), pinned GUT, Pillow/numpy/scipy, project import.
# Uses the environment's HTTPS proxy as configured. If a host answers 403/407,
# stop and report the host; do not route around the proxy and do not use apt.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"

mkdir -p "$ARENA_GODOT_HOME"

if [ ! -x "$GODOT_BIN" ]; then
  zip="$ARENA_GODOT_HOME/$GODOT_ZIP_NAME"
  echo "bootstrap: downloading $GODOT_ZIP_NAME"
  if ! curl -sSL --fail -o "$zip" "$GODOT_URL"; then
    echo "bootstrap: download failed for $GODOT_URL (403/407 means the proxy blocks the host; report it)" >&2
    exit 2
  fi
  actual="$(sha512sum "$zip" | cut -d' ' -f1)"
  if [ "$actual" != "$GODOT_SHA512" ]; then
    echo "bootstrap: SHA-512 mismatch for $GODOT_ZIP_NAME" >&2
    echo "  expected $GODOT_SHA512" >&2
    echo "  actual   $actual" >&2
    rm -f "$zip"
    exit 3
  fi
  unzip -qo "$zip" -d "$ARENA_GODOT_HOME"
  chmod +x "$GODOT_BIN"
  rm -f "$zip"
fi

gut_dir="$ARENA_GODOT_PROJECT/addons/gut"
if ! grep -q "version=\"${GUT_TAG#v}\"" "$gut_dir/plugin.cfg" 2>/dev/null; then
  echo "bootstrap: installing GUT $GUT_TAG"
  tmp="$(mktemp -d)"
  git clone -q --depth 1 --branch "$GUT_TAG" "$GUT_REPO" "$tmp/gut"
  mkdir -p "$ARENA_GODOT_PROJECT/addons"
  rm -rf "$gut_dir"
  cp -r "$tmp/gut/addons/gut" "$gut_dir"
  rm -rf "$tmp"
fi

# install_addon <name> <repo> <tag> <commit> <path-in-repo>: idempotent, refuses a moved tag.
install_addon() {
  local name="$1" repo="$2" tag="$3" commit="$4" src="$5"
  local dest="$ARENA_GODOT_PROJECT/addons/$name"
  if [ "$(cat "$dest/.pinned_commit" 2>/dev/null)" = "$commit" ]; then return 0; fi
  echo "bootstrap: installing $name $tag"
  local tmp; tmp="$(mktemp -d)"
  git clone -q --depth 1 --branch "$tag" "$repo" "$tmp/src"
  if [ "$(git -C "$tmp/src" rev-parse HEAD)" != "$commit" ]; then
    echo "bootstrap: $name $tag no longer points at $commit" >&2
    rm -rf "$tmp"; exit 4
  fi
  mkdir -p "$ARENA_GODOT_PROJECT/addons"
  rm -rf "$dest"
  cp -r "$tmp/src/$src" "$dest"
  printf '%s\n' "$commit" > "$dest/.pinned_commit"
  rm -rf "$tmp"
}
install_addon phantom_camera "$PCAM_REPO" "$PCAM_TAG" "$PCAM_COMMIT" addons/phantom_camera
install_addon curved_lines_2d "$SVS_REPO" "$SVS_TAG" "$SVS_COMMIT" addons/curved_lines_2d

python3 -c "import PIL, numpy, scipy" 2>/dev/null || python3 -m pip install --quiet -r "$ARENA_GODOT_TOOLS/requirements-qa.txt"

# Registers class_names (GUT needs them) and creates the git-ignored .godot cache.
"$GODOT_BIN" --headless --path "$ARENA_GODOT_PROJECT" --import >/dev/null 2>&1 || true

echo "bootstrap: $("$GODOT_BIN" --version)"
echo "bootstrap: GUT $(sed -n 's/^version="\(.*\)"/\1/p' "$gut_dir/plugin.cfg")"
