#!/bin/bash
# 检测友情链接是否存活，生成 _data/friends_checked.yml
# 在 GitHub Actions 中 Jekyll 构建前运行

set -euo pipefail

echo "开始检测友情链接..."

python3 << 'PYEOF'
import json, ssl, time, urllib.error, urllib.parse, urllib.request
import yaml

INPUT = "_data/friends.yml"
OUTPUT = "_data/friends_checked.yml"
TIMEOUT = 15
MAX_RETRIES = 3

# 伪装成普通浏览器: CI runner 的机房 IP + 机器人 UA 容易被 Cloudflare / WAF 拦截
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    # 故意不发 Accept-Encoding: urllib 不会自动解压
    "Upgrade-Insecure-Requests": "1",
    "Connection": "close",
}

# 这些状态码说明「域名解析正常 + 服务器在线」，只是拒绝了机器人访问，
# 属于反爬 / 限流 / 鉴权，不能算站点死亡
# (不含 503: Cloudflare 回源失败等真实故障也是 503)
PROTECTED_CODES = {401, 402, 403, 405, 406, 409, 418, 429, 451}

# 忽略 SSL 证书错误 (有些博客证书过期也算半死不活)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def candidate_urls(url):
    """原始地址 -> 备用地址 (切换 www / 降级 http)，用于兜底重试"""
    urls = [url]
    parts = urllib.parse.urlsplit(url)
    host = parts.netloc
    alt_host = host[4:] if host.startswith("www.") else "www." + host
    urls.append(urllib.parse.urlunsplit(parts._replace(netloc=alt_host)))
    if parts.scheme == "https":
        urls.append(urllib.parse.urlunsplit(parts._replace(scheme="http")))
    return urls


def probe(url):
    """返回 (状态: alive/protected/dead, 说明)"""
    last_error = ""
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, method="GET", headers=HEADERS)
            resp = urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx)
            with resp:
                if resp.status < 400:
                    return "alive", f"HTTP {resp.status}"
                if resp.status in PROTECTED_CODES:
                    return "protected", f"HTTP {resp.status}"
                last_error = f"HTTP {resp.status}"
        except urllib.error.HTTPError as e:
            last_error = f"HTTP {e.code}"
            if e.code in PROTECTED_CODES:
                # 服务器活着，只是不欢迎爬虫，无需再重试
                return "protected", last_error
            if 400 <= e.code < 500:
                # 404 / 410 等明确的「页面没了」，不必重试
                return "dead", last_error
        except urllib.error.URLError as e:
            # DNS 解析失败、连接拒绝、SSL 握手失败等
            last_error = str(e.reason)
        except Exception as e:
            # 超时、连接重置等
            last_error = str(e)

        if attempt < MAX_RETRIES - 1:
            time.sleep(2)

    return "dead", last_error


def check(friend):
    url = friend.get("url", "")
    if not url:
        return False, "缺少 url"

    # friends.yml 中可用 check: false 跳过检测 (例如已知会拦截 CI 的站点)
    if friend.get("check") is False:
        return True, "跳过检测"

    results = []
    for candidate in candidate_urls(url):
        state, detail = probe(candidate)
        suffix = "" if candidate == url else f" via {candidate}"
        if state == "alive":
            return True, detail + suffix
        if state == "protected":
            return True, f"{detail} 反爬拦截，视为存活{suffix}"
        results.append(detail)
    return False, results[0]


with open(INPUT, "r", encoding="utf-8") as f:
    friends = yaml.safe_load(f) or []

alive, dead = [], []

for friend in friends:
    ok, detail = check(friend)
    name = friend.get("name", "未知")
    if ok:
        print(f"  ✓ {name} - {detail}")
        alive.append(friend)
    else:
        print(f"  ✗ {name} ({friend.get('url', '')}) - {detail}")
        dead.append(friend)

# 写出带分区标记的 YAML (JSON 字符串是合法的 YAML 双引号标量，天然完成转义)
with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write("# 此文件由 _scripts/check-friends.sh 自动生成，请勿手动编辑\n\n")
    for section, items in (("alive", alive), ("dead", dead)):
        f.write(f"{section}:\n")
        for fr in items:
            f.write(f'  - name: {json.dumps(fr["name"], ensure_ascii=False)}\n')
            f.write(f'    url: {json.dumps(fr["url"], ensure_ascii=False)}\n')
            for key in ("icon", "description"):
                if fr.get(key):
                    f.write(f"    {key}: {json.dumps(fr[key], ensure_ascii=False)}\n")
        f.write("\n")

print(f"\n检测完成: {len(alive)} 存活, {len(dead)} 失效")
PYEOF
