#!/usr/bin/env bash
set -euo pipefail

build_list_file="build/build_files.list"
output_file="hardcover.user.js"

if [[ ! -f "$build_list_file" ]]; then
  echo "Build list file $build_list_file not found." >&2
  exit 1
fi

mapfile -t files < "$build_list_file"

# Normalize file endings to exactly two newlines
for f in "${files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Error: Source file $f is missing." >&2
    exit 1
  fi

  # Remove all trailing newlines and append exactly two
  tmp=$(mktemp)
  # Strip all trailing newlines
  awk 'BEGIN{RS="";ORS="\n\n"} {gsub(/\n+$/, ""); print}' "$f" > "$tmp"
  mv "$tmp" "$f"
done



# Concatenate in order
cat "${files[@]}" > "$output_file"

echo "Build successful: $output_file"
