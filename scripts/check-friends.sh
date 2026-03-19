#!/bin/bash
# 检测友情链接是否存活，生成 data/friends_checked.yml
set -euo pipefail

echo "开始检测友情链接..."

python3 << 'PYEOF'
import yaml, urllib.request, urllib.error, ssl, sys, time

INPUT = "data/friends.yml"
OUTPUT = "data/friends_checked.yml"
TIMEOUT = 15
MAX_RETRIES = 2

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

with open(INPUT, "r", encoding="utf-8") as f:
    friends = yaml.safe_load(f) or []

alive = []
dead = []

for friend in friends:
    url = friend.get("url", "")
    name = friend.get("name", "未知")
    if not url:
        dead.append(friend)
        continue

    ok = False
    last_error = ""

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, method="GET", headers={
                "User-Agent": "Mozilla/5.0 (compatible; FriendLinkChecker/1.0)"
            })
            resp = urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx)
            if resp.status < 400:
                ok = True
                break
            else:
                last_error = f"HTTP {resp.status}"
        except urllib.error.HTTPError as e:
            last_error = f"HTTP {e.code}"
            if 400 <= e.code < 500:
                break
        except urllib.error.URLError as e:
            last_error = str(e.reason)
        except Exception as e:
            last_error = str(e)

        if attempt < MAX_RETRIES - 1:
            time.sleep(2)

    if ok:
        print(f"  ✓ {name}")
        alive.append(friend)
    else:
        print(f"  ✗ {name} ({url}) - {last_error}")
        dead.append(friend)

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write("# 此文件由 scripts/check-friends.sh 自动生成，请勿手动编辑\n\n")
    f.write("alive:\n")
    for fr in alive:
        f.write(f'  - name: "{fr["name"]}"\n')
        f.write(f'    url: "{fr["url"]}"\n')
        if fr.get("icon"):
            f.write(f'    icon: "{fr["icon"]}"\n')
        if fr.get("description"):
            desc = fr["description"].replace('"', '\\"')
            f.write(f'    description: "{desc}"\n')
    f.write("\ndead:\n")
    for fr in dead:
        f.write(f'  - name: "{fr["name"]}"\n')
        f.write(f'    url: "{fr["url"]}"\n')
        if fr.get("icon"):
            f.write(f'    icon: "{fr["icon"]}"\n')
        if fr.get("description"):
            desc = fr["description"].replace('"', '\\"')
            f.write(f'    description: "{desc}"\n')

print(f"\n检测完成: {len(alive)} 存活, {len(dead)} 失效")
PYEOF
