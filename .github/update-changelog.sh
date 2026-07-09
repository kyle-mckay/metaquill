#!/bin/bash

# --- functions ---

get_tag_line_number() {
    local tag="$1"
    local file="$2"
    local line_num=$(grep -n "^## .*$tag" "$file" | head -n 1 | cut -d: -f1)
    echo "${line_num:-0}"
}

find_header_in_range() {
    local start=2
    local end="$1"
    local file="$2"

    if [ "$end" -le "$start" ]; then
        echo "$end"
        return
    fi

    local relative_found=$(sed -n "${start},${end}p" "$file" | grep -n "^## " | head -n 1 | cut -d: -f1)

    if [ -n "$relative_found" ]; then
        echo "$((start + relative_found - 1))"
    else
        echo "0"
    fi
}

# export from line to end of file
export_from_line() {
    local start_line="$1"
    local src_file="$2"
    local dest_file="$3"
    tail -n +"$start_line" "$src_file" > "$dest_file"
}

# export specific line range
export_range() {
    local start="$1"
    local end="$2"
    local src_file="$3"
    local dest_file="$4"

    # sed -n 'X,Yp' prints lines X to Y
    sed -n "${start},${end}p" "$src_file" > "$dest_file"
}

reassemble_header() {
    local src_header="$1"
    local dest_file="$2"
    local new_tag="$3"
    local date="$4"
    local header_updated=false

    # clear/create destination file
    > "$dest_file"

    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^##\  ]] && [ "$header_updated" = false ]; then
            # extract version from line (e.g., 'v0.4.0' from '## v0.4.0 - 2026...')
            local current_version=$(echo "$line" | cut -d' ' -f2)
            
            # use highest version
            local higher_version=$(echo -e "$current_version\n$new_tag" | sort -V | tail -n 1)

            echo "## $higher_version - $date" >> "$dest_file"
            header_updated=true
            
            if [ "$higher_version" != "$new_tag" ]; then
                echo "Kept existing higher version $higher_version instead of $new_tag"
            fi
        else
            echo "$line" >> "$dest_file"
        fi
    done < "$src_header"

    if [ "$header_updated" = false ]; then
        echo "# Changelog" > "$dest_file"
        echo "" >> "$dest_file"
        echo "## $new_tag - $date" >> "$dest_file"
    fi
    
    # Ensure no trailing blank lines at the end of header file
    sed -i '${/^$/d;}' "$dest_file"
}

inject_changes() {
    local dest_file="$1"
    local category="$2"
    local commit_msg="$3"
    local tmp_file="inject.tmp"
    
    # If no message, don't even try to inject a category header
    [ -z "$commit_msg" ] && return

    local bullets
    bullets=$(printf '%s\n' "$commit_msg" | sed '/^$/d; s/^/- /')

    # Find boundaries of the current (first) version section
    local section_start next_section section_end
    section_start=$(grep -n "^## " "$dest_file" | head -n 1 | cut -d: -f1)
    next_section=$(grep -n "^## " "$dest_file" | sed -n '2p' | cut -d: -f1)
    if [ -n "$next_section" ]; then
        section_end=$((next_section - 1))
    else
        section_end=$(wc -l < "$dest_file")
    fi

    # Check if category header exists within current section only
    local cat_offset
    cat_offset=$(sed -n "${section_start},${section_end}p" "$dest_file" \
        | grep -n "^### $category" | head -n 1 | cut -d: -f1)

    if [ -n "$cat_offset" ]; then
        local cat_line=$((section_start + cat_offset - 1))
        local insert_at=$((cat_line + 1))
        head -n "$insert_at" "$dest_file" > "$tmp_file"
        printf '%s\n' "$bullets" >> "$tmp_file"
        tail -n +"$((insert_at + 1))" "$dest_file" >> "$tmp_file"
        mv "$tmp_file" "$dest_file"
        return
    fi

    # Category not in current section - determine insert position by hierarchy
    local final_target=$section_start

    if [ "$category" == "Breaking" ]; then
        final_target=$section_start
    elif [ "$category" == "Enhancements" ]; then
        local break_offset
        break_offset=$(sed -n "${section_start},${section_end}p" "$dest_file" \
            | grep -n "^### Breaking" | head -n 1 | cut -d: -f1)
        if [ -n "$break_offset" ]; then
            local break_line=$((section_start + break_offset - 1))
            local rel_last
            rel_last=$(sed -n "${break_line},${section_end}p" "$dest_file" \
                | grep -n "^-" | tail -n 1 | cut -d: -f1)
            [ -n "$rel_last" ] && final_target=$((break_line + rel_last - 1))
        fi
    elif [ "$category" == "Fixes" ]; then
        local enh_offset break_offset
        enh_offset=$(sed -n "${section_start},${section_end}p" "$dest_file" \
            | grep -n "^### Enhancements" | head -n 1 | cut -d: -f1)
        break_offset=$(sed -n "${section_start},${section_end}p" "$dest_file" \
            | grep -n "^### Breaking" | head -n 1 | cut -d: -f1)
        if [ -n "$enh_offset" ]; then
            local enh_line=$((section_start + enh_offset - 1))
            local rel_last
            rel_last=$(sed -n "${enh_line},${section_end}p" "$dest_file" \
                | grep -n "^-" | tail -n 1 | cut -d: -f1)
            [ -n "$rel_last" ] && final_target=$((enh_line + rel_last - 1))
        elif [ -n "$break_offset" ]; then
            local break_line=$((section_start + break_offset - 1))
            local rel_last
            rel_last=$(sed -n "${break_line},${section_end}p" "$dest_file" \
                | grep -n "^-" | tail -n 1 | cut -d: -f1)
            [ -n "$rel_last" ] && final_target=$((break_line + rel_last - 1))
        fi
    elif [ "$category" == "Maintenance" ]; then
        local last_non_blank
        last_non_blank=$(sed -n "${section_start},${section_end}p" "$dest_file" \
            | grep -n "." | tail -n 1 | cut -d: -f1)
        [ -n "$last_non_blank" ] && final_target=$((section_start + last_non_blank - 1))
    fi

    # sandwich method
    head -n "$final_target" "$dest_file" > "$tmp_file"
    echo "" >> "$tmp_file"
    echo "### $category" >> "$tmp_file"
    printf '%s\n' "$bullets" >> "$tmp_file"
    tail -n +"$((final_target + 1))" "$dest_file" >> "$tmp_file"
    mv "$tmp_file" "$dest_file"
}

extract_latest_changelog() {
    local changelog_file="CHANGELOG.md"
    local header_count=0
    local content_count=0

    # Read line by line
    while IFS= read -r line || [ -n "$line" ]; do
        # Check if line starts with '## '
        if [[ "$line" =~ ^##[[:space:]] ]]; then
            ((header_count++))
            
            # If this is the second header, we are done
            if [ "$header_count" -eq 2 ]; then
                break
            fi
            continue
        fi

        # Start echoing lines on the first category
        if [ "$header_count" -eq 1 ]; then
            if [[ "$line" =~ ^###[[:space:]] || $content_count -gt 0 ]]; then
                ((content_count++))
            fi
            echo "$line"
        fi
    done < "$changelog_file"
}

# --- main script ---

if [ "$1" != "changelog" ] && [ "$#" -ne 4 ]; then
    echo "Usage: $0 <OLD_TAG> <NEW_TAG> <CATEGORY> <COMMIT_MSG>"
    exit 1
fi

OLD_TAG="$1"

if [[ "$OLD_TAG" == "changelog" ]]; then
    extract_latest_changelog
    exit 0
fi

NEW_TAG="$2"
CATEGORY="$3"
COMMIT_MSG="$4"
FILE="CHANGELOG.md"
DATE=$(date +%Y-%m-%d)

TEMP_HEADER="header.tmp"
TEMP_BODY="body.tmp"

# If a draft for NEW_TAG already exists, inject directly without restructuring
NEW_LINE_NUM=$(get_tag_line_number "$NEW_TAG" "$FILE")
if [ "$NEW_LINE_NUM" -gt 0 ]; then
    # Overwrite the existing header line with the current date
    sed -i "${NEW_LINE_NUM}s/.*/## ${NEW_TAG} - ${DATE}/" "$FILE"

    inject_changes "$FILE" "$CATEGORY" "$COMMIT_MSG"
    [ -n "$(tail -n 1 "$FILE")" ] && echo "" >> "$FILE"
    echo "Injected into existing draft section $NEW_TAG in $FILE and updated header date to $DATE."
    exit 0
fi

# Find split point: prefer OLD_TAG, fall back to first version header
SPLIT_LINE=$(get_tag_line_number "$OLD_TAG" "$FILE")

if [ "$SPLIT_LINE" -eq 0 ]; then
    SPLIT_LINE=$(grep -n "^## " "$FILE" | head -n 1 | cut -d: -f1)
fi

# Split file into header (before split) and body (from split onwards)
if [ "${SPLIT_LINE:-0}" -gt 1 ]; then
    export_range 1 $((SPLIT_LINE - 1)) "$FILE" "$TEMP_HEADER"
else
    > "$TEMP_HEADER"
fi

if [ "${SPLIT_LINE:-0}" -gt 0 ]; then
    export_from_line "$SPLIT_LINE" "$FILE" "$TEMP_BODY"
else
    > "$TEMP_BODY"
fi

# reassemble header with new version
reassemble_header "$TEMP_HEADER" "$FILE" "$NEW_TAG" "$DATE"

# inject category and commit message
if [[ "$COMMIT_MSG" = "" ]]; then
    echo "No commit message provided, skipping category injection."
else
    inject_changes "$FILE" "$CATEGORY" "$COMMIT_MSG"
fi

# add ONE spacing newline before the body
echo "" >> "$FILE"

# strip header for release body
cp "$FILE" "$TEMP_HEADER"
sed -i '1,4d' "$TEMP_HEADER"

# append old versions
cat "$TEMP_BODY" >> "$FILE"

# FINAL CLEANUP: 
# 1. Clear lines that contain only whitespace
sed -i 's/^[[:space:]]*$//' "$FILE"
# 2. Collapse triple newlines (or more) into a single blank line
sed -i 'N;/^\n\n$/D;P;D' "$FILE"

echo "Header processed. $FILE updated successfully."