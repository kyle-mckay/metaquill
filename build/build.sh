#!/usr/bin/env bash
set -euo pipefail

# Usage: ./build.sh [LOG_LEVEL]
# Example: ./build.sh DEBUG
LOG_LEVEL="${1:-INFO}"  # Default to INFO if no argument is provided

build_list_file="build/build_files.list"
output_file="hardcover.user.js"
header_file="src/core/headers.js"
version_file="build/release.txt"

if [[ ! -f "$build_list_file" ]]; then
  echo "Build list file $build_list_file not found." >&2
  exit 1
fi

if [[ ! -f "$version_file" ]]; then
  echo "Version file $version_file not found." >&2
  exit 1
fi

if [[ ! -f "$header_file" ]]; then
  echo "Header file $header_file not found." >&2
  exit 1
fi

# Read version from build/release.txt
version=$(<"$version_file")
version="${version//[$'\r\n']}"

# Replace log level to INFO in public release
sed -i.bak -E "s|(let currentLogLevel = LogLevel\.)[A-Z]+;|\1${LOG_LEVEL};|" "$header_file"

# Replace version in @version line in header file with release draft version number
sed -i.bak -E "s|^(\\s*//\\s*@version\\s+)[^ ]+|\1$version|" "$header_file"

# Clean up backup
rm -f "${header_file}.bak"

mapfile -t files < "$build_list_file"

# Normalize file endings to exactly two newlines
for f in "${files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Error: Source file $f is missing." >&2
    exit 1
  fi

  tmp=$(mktemp)
  awk 'BEGIN{RS="";ORS="\n\n"} {gsub(/\n+$/, ""); print}' "$f" > "$tmp"
  mv "$tmp" "$f"
done

# Concatenate in order
cat "${files[@]}" > "$output_file"

echo "Build successful: $output_file"
