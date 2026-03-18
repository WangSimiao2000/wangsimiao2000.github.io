#!/usr/bin/env bash
#
# Build and test the site content
#
# Requirement: html-proofer, jekyll
#
# Usage: See help information

set -eu

SITE_DIR="_site"

_config="_config.yml"

_baseurl=""

help() {
  echo "Build and test the site content"
  echo
  echo "Usage:"
  echo
  echo "   bash $0 [options]"
  echo
  echo "Options:"
  echo '     -c, --config   "<config_a[,config_b[...]]>"    Specify config file(s)'
  echo "     -h, --help               Print this information."
}

read_baseurl() {
  if [[ $_config == *","* ]]; then
    IFS=","
    read -ra config_array <<<"$_config"

    for ((i = ${#config_array[@]} - 1; i >= 0; i--)); do
      _tmp_baseurl="$(grep '^baseurl:' "${config_array[i]}" | sed "s/.*: *//;s/['\"]//g;s/#.*//")"

      if [[ -n $_tmp_baseurl ]]; then
        _baseurl="$_tmp_baseurl"
        break
      fi
    done

  else
    _baseurl="$(grep '^baseurl:' "$_config" | sed "s/.*: *//;s/['\"]//g;s/#.*//")"
  fi
}

# Verify that all expected pages were generated
check_pages() {
  local base="$SITE_DIR$_baseurl"
  local failed=0

  local pages=(
    "index.html"
    "browse/index.html"
    "archives/index.html"
    "about/index.html"
    "gallery/index.html"
    "friends/index.html"
    "tools/index.html"
    "feed.xml"
    "sitemap.xml"
  )

  echo ""
  echo "=== Checking generated pages ==="

  for page in "${pages[@]}"; do
    if [[ -f "$base/$page" ]]; then
      echo "  ✓ $page"
    else
      echo "  ✗ $page  (MISSING)"
      failed=1
    fi
  done

  # Check that at least one post exists
  local post_count
  post_count=$(find "$base" -path "*/posts/*" -name "*.html" 2>/dev/null | wc -l)
  if [[ $post_count -gt 0 ]]; then
    echo "  ✓ posts ($post_count found)"
  else
    echo "  ✗ posts (none found)"
    failed=1
  fi

  # Check that category pages exist
  local cat_count
  cat_count=$(find "$base/categories" -name "index.html" 2>/dev/null | wc -l)
  if [[ $cat_count -gt 1 ]]; then
    echo "  ✓ category pages ($cat_count found)"
  else
    echo "  ✗ category pages (expected > 1, found $cat_count)"
    failed=1
  fi

  # Check that tag pages exist
  local tag_count
  tag_count=$(find "$base/tags" -name "index.html" 2>/dev/null | wc -l)
  if [[ $tag_count -gt 1 ]]; then
    echo "  ✓ tag pages ($tag_count found)"
  else
    echo "  ✗ tag pages (expected > 1, found $tag_count)"
    failed=1
  fi

  echo ""

  if [[ $failed -eq 1 ]]; then
    echo "Page generation check FAILED"
    exit 1
  fi

  echo "All expected pages present."
}

# Check that key assets were built
check_assets() {
  local base="$SITE_DIR$_baseurl"
  local failed=0

  echo ""
  echo "=== Checking built assets ==="

  # At least one CSS file
  local css_count
  css_count=$(find "$base/assets/css" -name "*.css" 2>/dev/null | wc -l)
  if [[ $css_count -gt 0 ]]; then
    echo "  ✓ CSS ($css_count files)"
  else
    echo "  ✗ CSS (none found in assets/css)"
    failed=1
  fi

  # At least one JS file
  local js_count
  js_count=$(find "$base/assets/js" -name "*.js" 2>/dev/null | wc -l)
  if [[ $js_count -gt 0 ]]; then
    echo "  ✓ JS ($js_count files)"
  else
    echo "  ✗ JS (none found in assets/js)"
    failed=1
  fi

  echo ""

  if [[ $failed -eq 1 ]]; then
    echo "Asset check FAILED"
    exit 1
  fi

  echo "All expected assets present."
}

main() {
  # clean up
  if [[ -d $SITE_DIR ]]; then
    rm -rf "$SITE_DIR"
  fi

  read_baseurl

  # build
  echo "=== Building site ==="
  JEKYLL_ENV=production bundle exec jekyll b \
    -d "$SITE_DIR$_baseurl" -c "$_config"

  # check pages
  check_pages

  # check assets
  check_assets

  # html-proofer
  echo ""
  echo "=== Running HTML-Proofer ==="
  bundle exec htmlproofer "$SITE_DIR" \
    --disable-external \
    --ignore-urls "/^http:\/\/127.0.0.1/,/^http:\/\/0.0.0.0/,/^http:\/\/localhost/"

  echo ""
  echo "=== All tests passed ==="
}

while (($#)); do
  opt="$1"
  case $opt in
  -c | --config)
    _config="$2"
    shift
    shift
    ;;
  -h | --help)
    help
    exit 0
    ;;
  *)
    help
    exit 1
    ;;
  esac
done

main
