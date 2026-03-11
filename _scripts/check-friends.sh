#!/bin/bash
# 检测友情链接是否存活，生成 _data/friends_checked.yml
# 在 GitHub Actions 中 Jekyll 构建前运行

set -euo pipefail

echo "开始检测友情链接..."

python3 << 'PYEOF'
import yaml, urllib.request, urllib.error, ssl, sys, time

INPUT = "_data/friends.yml"
OUTPUT = "_data/friends_checked.yml"
TIMEOUT = 15
MAX_RETRIES = 2

# 忽略 SSL 证书错误 (有些博客证书过期也算半死不活)
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
            status = resp.status
            if status < 400:
                ok = True
                break
            else:
                last_error = f"HTTP {status}"
        except urllib.error.HTTPError as e:
            # 4xx/5xx 响应 (包括 nginx 404、403 等)
            last_error = f"HTTP {e.code}"
            # 不重试 4xx, 服务器明确拒绝了
            if 400 <= e.code < 500:
                break
        except urllib.error.URLError as e:
            # DNS 解析失败、连接拒绝、SSL 错误等
            last_error = str(e.reason)
        except Exception as e:
            # 超时、连接重置等其他异常
            last_error = str(e)

        if attempt < MAX_RETRIES - 1:
            time.sleep(2)

    if ok:
        print(f"  ✓ {name}")
        alive.append(friend)
    else:
        print(f"  ✗ {name} ({url}) - {last_error}")
        dead.append(friend)

# 写出带分区标记的 YAML
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
