#!/usr/bin/env bash
set -euo pipefail

build_list_file="build/build_files.list"
src_dir="src"

if [[ ! -f "$build_list_file" ]]; then
  echo "Build list file $build_list_file not found." >&2
  exit 1
fi

# Remove empty lines immediately to always clean file
sed -i '/^\s*$/d' "$build_list_file"

mapfile -t build_list < "$build_list_file"

# Get all .js files in src/ recursively, sorted
mapfile -t src_files < <(find "$src_dir" -type f -name '*.js' | sort)

# Collect missing files (present in src_files but NOT in build_list)
missing_files=()
for f in "${src_files[@]}"; do
  found=false
  for b in "${build_list[@]}"; do
    if [[ "$f" == "$b" ]]; then
      found=true
      break
    fi
  done
  if ! $found; then
    missing_files+=("$f")
  fi
done

if [[ ${#missing_files[@]} -eq 0 ]]; then
  echo "true"
  exit 0
fi

echo "false"
echo "Missing files detected: ${missing_files[*]}"

# Find index of src/core/main.js
main_idx=-1
for i in "${!build_list[@]}"; do
  if [[ "${build_list[$i]}" == "src/core/main.js" ]]; then
    main_idx=$i
    break
  fi
done

if (( main_idx == -1 )); then
  echo "Error: src/core/main.js not found in $build_list_file" >&2
  exit 1
fi

# Insert missing files above src/core/main.js (second to last line)
new_build_list=()
for ((i=0; i<main_idx; i++)); do
  new_build_list+=("${build_list[i]}")
done

# Append missing files here
for mf in "${missing_files[@]}"; do
  new_build_list+=("$mf")
done

# Append src/core/main.js and any lines after (if any)
for ((i=main_idx; i<${#build_list[@]}; i++)); do
  new_build_list+=("${build_list[i]}")
done

# Write back cleaned and updated build_files.list
printf "%s\n" "${new_build_list[@]}" > "$build_list_file"
echo "Updated $build_list_file with missing files and ensured no empty lines."
