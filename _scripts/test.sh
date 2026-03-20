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
  cat_count=$(find "$base/browse/categories" -name "index.html" 2>/dev/null | wc -l)
  if [[ $cat_count -gt 1 ]]; then
    echo "  ✓ category pages ($cat_count found)"
  else
    echo "  ✗ category pages (expected > 1, found $cat_count)"
    failed=1
  fi

  # Check that tag pages exist
  local tag_count
  tag_count=$(find "$base/browse/tags" -name "index.html" 2>/dev/null | wc -l)
  if [[ $tag_count -gt 1 ]]; then
    echo "  ✓ tag pages ($tag_count found)"
  else
    echo "  ✗ tag pages (expected > 1, found $tag_count)"
    failed=1
  fi

  # Verify browse page contains all three tab panels
  local browse_file="$base/browse/index.html"
  for panel_id in "browse-categories" "browse-tags" "browse-archives"; do
    if grep -q "id=\"$panel_id\"" "$browse_file" 2>/dev/null; then
      echo "  ✓ browse panel: $panel_id"
    else
      echo "  ✗ browse panel: $panel_id (MISSING in browse/index.html)"
      failed=1
    fi
  done

  # Verify archives panel has actual post content
  if grep -q "id=\"archives\"" "$browse_file" 2>/dev/null; then
    echo "  ✓ archives timeline present in browse page"
  else
    echo "  ✗ archives timeline missing from browse page"
    failed=1
  fi

  # PJAX: #swup container must exist in key pages
  for pg in "index.html" "browse/index.html" "about/index.html" "gallery/index.html" "friends/index.html"; do
    if grep -q 'id="swup"' "$base/$pg" 2>/dev/null; then
      echo "  ✓ #swup container: $pg"
    else
      echo "  ✗ #swup container missing: $pg"
      failed=1
    fi
  done

  # Giscus: post pages should contain giscus script
  local sample_post
  sample_post=$(find "$base/posts" -name "*.html" 2>/dev/null | head -1)
  if [[ -n "$sample_post" ]]; then
    if grep -q "giscus" "$sample_post" 2>/dev/null; then
      echo "  ✓ Giscus comment script in posts"
    else
      echo "  ✗ Giscus comment script missing from posts"
      failed=1
    fi
  fi

  # Gallery: lightbox structure
  if grep -q 'id="lb"' "$base/gallery/index.html" 2>/dev/null; then
    echo "  ✓ Gallery lightbox structure"
  else
    echo "  ✗ Gallery lightbox structure missing"
    failed=1
  fi

  # Friends: card grid
  if grep -q 'card-grid' "$base/friends/index.html" 2>/dev/null; then
    echo "  ✓ Friends card grid"
  else
    echo "  ✗ Friends card grid missing"
    failed=1
  fi

  # Search index: search.json must exist and contain entries
  local search_json="$base/assets/js/data/search.json"
  if [[ -f "$search_json" ]]; then
    local search_size
    search_size=$(wc -c < "$search_json")
    if [[ $search_size -gt 100 ]]; then
      echo "  ✓ Search index ($search_size bytes)"
    else
      echo "  ✗ Search index too small ($search_size bytes)"
      failed=1
    fi
  else
    echo "  ✗ Search index missing (search.json)"
    failed=1
  fi

  # dayjs loaded for browse page (archives date formatting)
  if grep -q "dayjs" "$browse_file" 2>/dev/null; then
    echo "  ✓ dayjs loaded for browse page"
  else
    echo "  ✗ dayjs not loaded for browse page (archives dates won't format)"
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

  # Browse tab JS is present
  if grep -rq "_browseTabsBound" "$base/browse/index.html" 2>/dev/null; then
    echo "  ✓ Browse tab JS (inline)"
  else
    echo "  ✗ Browse tab JS missing from browse page"
    failed=1
  fi

  # Rollup entry bundles must all exist
  for entry in commons home categories page post misc theme; do
    if [[ -f "$base/assets/js/dist/${entry}.min.js" ]]; then
      echo "  ✓ JS bundle: ${entry}.min.js"
    else
      echo "  ✗ JS bundle missing: ${entry}.min.js"
      failed=1
    fi
  done

  # PWA: service worker and app (Jekyll permalink outputs to site root)
  for pwa_file in sw.min.js app.min.js; do
    if [[ -f "$base/${pwa_file}" ]]; then
      echo "  ✓ PWA: ${pwa_file}"
    else
      echo "  ✗ PWA missing: ${pwa_file}"
      failed=1
    fi
  done

  # PWA: swconf.js
  if [[ -f "$base/assets/js/data/swconf.js" ]]; then
    echo "  ✓ PWA: swconf.js"
  else
    echo "  ✗ PWA missing: swconf.js"
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
