---
title: Minecraft 模组服运维踩坑记录：从 EasyAuth 拦包到 systemd 的 stdin
date: 2026-10-14 10:35:00 +0800
categories: [游戏, Minecraft]
tags: [Minecraft, Fabric, EasyAuth, Carpet, RCON, systemd, frp, 安全, 踩坑]
---

这是 [mc-ops](/posts/MC-Ops-Platform/) 系列的第二篇，记录过去一周给 Minecraft 模组服做运维平台时踩过的坑。有些是 Mod 之间的相互影响，有些是原版机制，有些是 Linux 和网络的问题。每个都写了现象、原因和最后的处理方式。

服务器背景：Minecraft 1.21.11 Fabric，40 多个 Mod，离线模式 + EasyAuth 登录，家里的主机经 frp 映射到腾讯云。下文提到的玩家名都做了处理。

## 一、EasyAuth：登录前的数据包会被丢掉

这一节是这周收获最大的，同一个机制导致了三个看起来毫不相关的问题。

### 现象

- 有玩家反馈 Jade 看不到箱子里的东西，但有的人又能看到；
- 有玩家反馈 Servux（MiniHUD、Litematica 的服务端配套）完全不起作用；
- mc-ops 里一条靠 Carpet 客户端握手判断账号是否被冒用的规则，从某天起再也没触发过。

### 原因

EasyAuth 在玩家输入 `/login` 之前，会丢弃所有自定义数据包（custom payload），只有配置里 `allowed-custom-packets` 列出的才放行。

问题在于，很多客户端 Mod 是**一进服就发握手包**的：

- Jade 发 `jade:client_handshake`，服务端收到后才会开始提供箱子内容等数据；
- MiniHUD / Litematica 发 `servux:structures` 等注册包，Servux 只给注册过的玩家发数据；
- Carpet 客户端发 `carpet:hello`。

握手包在登录前发出，被 EasyAuth 丢掉，服务端就认为这个玩家没装对应的 Mod，**这一整局**都不会再发数据。至于"有人能看到、有人看不到"，是因为免重复登录有效期内重进服是自动登录的，握手包不会被丢。

这个结论是对照 Jade、Servux、Carpet 和 EasyAuth 的源码确认的。后来我打开 EasyAuth 的调试日志统计了一天，被拦的包一共只有 4 种：`carpet:hello`、一个服务端没装的 Mod 的包，以及 `minecraft:register` / `unregister`。

### 处理

**Jade**：只放行握手包，风险很小。真正查看箱子内容的请求仍然要等登录后才会被处理。

**Servux**：麻烦一些。它的注册包和数据请求走的是同一组通道，放行注册就等于放行了查询。如果有人冒名进服，在 60 秒的登录时限内，可以查看这个账号下线位置附近的箱子和实体。所以我同时打开了 `hide-player-coords=true`：未登录的玩家会被临时移到出生点，登录后再回到原位。

```hocon
# config/EasyAuth/extended.conf
allowed-custom-packets=["jade:client_handshake", "servux:structures", "servux:entity_data", "servux:hud_metadata", "servux:litematics", "servux:tweaks"]

# config/EasyAuth/main.conf
hide-player-coords=true
```

注意：EasyAuth 比对包名要求**完全一致**，不支持 `servux:*` 这种通配写法，必须从 Servux 源码里把用到的通道逐个找出来。改完用 `auth reload` 在线生效，不用重启。

**Carpet**：**不能放行**。`carpet:hello` 所在的通道还承载着 `clientCommand` 功能，能以这个玩家的身份执行命令。放行就等于允许还没登录的人先执行命令，EasyAuth 的保护就被绕过了。

代价是 Carpet 客户端的功能失效，而 mc-ops 那条依赖 Carpet 握手的"客户端指纹"规则也就没法工作了。我最后让 mc-ops 在启动时读取 EasyAuth 的配置：如果 `carpet:hello` 被拦，就自动停用这条规则，并在面板上写明原因。**一条看起来在工作、其实永远不会触发的规则，比没有规则更危险。**

## 二、`moved too quickly`：大多数是鞘翅

日志里经常出现 `<玩家> moved too quickly!`，安全规则一开始把它当外挂特征，结果几乎全是误报。

原版服务端每 tick 检查玩家的位移，鞘翅飞行时阈值放宽到约 √300 ≈ 17 格，平时是 10 格。鞘翅加烟花本来就快，再赶上服务器卡顿或网络抖动，客户端几个 tick 的位移被当成一次算，就会超过阈值。服务端只是把玩家拉回去、记一条 WARN，不会踢人。

最后的规则是：

1. 每出现一次 `moved too quickly`，用 RCON 查这个玩家当时是否在滑翔：`data get entity <玩家> FallFlying`。这个状态是服务端维护的，客户端改不了。
2. **在滑翔**：5 分钟内达到 15 次才告警。这个门槛是按生产日志定的，正常飞行最多也就 8 次左右。
3. **不在滑翔**：出现一次就告警，凌晨或者短时间内反复出现就升为严重。
4. **向下且水平位移不超过 4 格**：当作下落，直接忽略。疾跑跳跃每 tick 大约 0.6 格，这个范围里不可能是加速挂。

剩下的误报来源有三叉戟激流、TNT 弹射、落地瞬间等，所以"不在滑翔"单次只报警告。

## 三、RCON 的两个细节

**原版 RCON 每次读取只处理一个包。** 响应超过一个包时，常见做法是在命令后面再发一个"哨兵"包，收到哨兵的响应就说明前面的响应收完了。但如果命令和哨兵一起发出去，原版服务端可能先处理哨兵，顺序就乱了。正确做法是**收到第一个响应之后再发哨兵**。

**RCON 执行的命令不会写进 `latest.log`。** 比如用 RCON 执行 `ban`，日志里没有任何记录。如果你的系统靠解析日志来记录事件（mc-ops 就是），通过 RCON 做的操作需要自己补发事件。

## 四、systemd 的几个坑

### stdin 不能是 `/dev/null`

把 MC 放进 systemd 单元后，服务器启动几秒就自己 stop 了。原因是 systemd 默认的 stdin 是 `/dev/null`，某个 Mod 会读控制台输入，读到 EOF 就当成控制台关闭，执行了 stop。

解决办法是给它一个永远不会结束的 stdin：

```ini
ExecStart=/bin/bash -c "exec java -Xms8G -Xmx8G -jar fabric-server-launch.jar nogui < <(exec sleep infinity)"
```

### 用户级单元慎用 `PrivateTmp`

mc-ops 的 observe 模式要通过 `/proc/<pid>/cwd` 找到正在运行的 MC 进程。给 agent 的用户级单元加了 `PrivateTmp=yes` 做加固之后，就再也找不到了。

原因是在 `systemd --user` 下，`PrivateTmp`、`ProtectKernelTunables`、`ProtectKernelModules`、`ProtectControlGroups` 这几项会隐式开启 `PrivateUsers`，给进程创建一个独立的 user namespace，这样它就读不到其他进程的 `/proc` 信息了。

需要读其他进程信息的用户级单元，改用不创建命名空间的加固项：

```ini
NoNewPrivileges=yes
RestrictSUIDSGID=yes
LockPersonality=yes
RestrictRealtime=yes
RestrictNamespaces=yes
SystemCallArchitectures=native
UMask=0077
```

### 单元文件里写死了 jar 名

最初的 `mc-server.service` 是切换时用脚本一次性生成的，jar 文件名、Java 路径、内存参数都写死在 `ExecStart` 里。升级游戏版本时 jar 名一变，systemd 就会去找已经不存在的旧 jar。现在改成每次开服前由 mc-ops 按配置重新生成单元文件，内容有变化才写入并 `daemon-reload`。

## 五、网络：别忘了上行带宽是共用的

有一次我用 `scp` 往服务器传了一个几百 MB 的文件，几分钟后玩家陆续掉线。

原因是家里的服务器经 frp 映射出去，**所有流量都要过云主机**，玩家的游戏流量也在里面。不限速的 `scp` 一下子占满了云主机的带宽，游戏数据包就排不上队了。

之后的规矩：

- 部署统一用限速的 `rsync --bwlimit`；
- 面板上的备份下载默认限速 512 KiB/s，同一时间只能下载一个；
- 往局域网 NAS 复制备份时也限速，避免和玩家抢家里的上行。

另外两个国内网络的小坑：Adoptium 的 Java 下载走 GitHub，在国内云主机上只有几十 KB/s，换成清华镜像就快得多；Mojang 和 Fabric 的官方源速度还可以。

## 六、扫描器和安全

### 服务器列表会泄露在线玩家名

有一天凌晨，一个早已被封禁的扫描器 IP 用一个**当时正在线的玩家名**尝试进服，被 EasyAuth 以"已在线"拒绝。它能拿到这个名字，是因为服务器列表会把在线玩家名发给任何来查询的人。

处理方式：

- `server.properties` 里设 `hide-online-players=true`，服务器列表只显示人数；
- mc-ops 加了一条"冒用玩家名进服"规则：进服被拒的连接用了进过服的玩家名，并且来自已封禁的 IP 或这个账号从没用过的网段，就告警。

用最近几天的日志回放这条规则时，还发现了一次之前没人注意到的尝试：某个 IP 先用一个随便起的名字被白名单拒掉，37 秒后又换成了当时在线的玩家名再试。

### SSH 爆破：sshd 看到的全是 127.0.0.1

SSH 也是通过 frp 映射的。某天晚上，一个 /24 网段的扫描器一晚上连了将近 3000 次，换着用户名猜密码。

服务器很早就只允许公钥登录了，爆破进不来，但有两个值得注意的地方：

1. **sshd 的配置是"先出现的生效"**。`sshd_config` 主文件里写着 `PasswordAuthentication yes`，但它在开头 `Include` 了 `sshd_config.d/*.conf`，我放的 `00-hardening.conf` 先被读取，里面的 `no` 才是最终生效的值。要确认实际效果，最可靠的方法是从外面用 `ssh -o PubkeyAuthentication=no ...` 试一下，看返回的是不是只有 `Permission denied (publickey)`。
2. **在服务器上封不了 IP**。流量经 frp 转发，sshd 看到的来源全是 `127.0.0.1`，所以在家里的服务器上装 fail2ban、加 ufw 规则都没用，只能在云主机那一侧拦。我在轻量应用服务器的防火墙里给这两个网段加了拒绝规则，注意拒绝规则要排在放行规则上面。

一个个封 IP 不是长久之计，扫描器换 IP 很快。更彻底的方法是让 SSH 只走 WireGuard，不暴露在公网上。

## 七、各种 Mod 和原版机制的小坑

**Carpet 假人召唤失败。** 玩家反馈"某个假人登录过一次之后就召唤不出来了"。真正的原因是那个名字被加进了白名单：Carpet 规定，开着白名单时，白名单里的名字**只有 OP 才能召唤**。而且大小写不同的名字在离线模式下 UUID 也不同，召唤出来的其实是另一个角色，背包也不一样。

**假人在服务器列表里显示成 Anonymous Player。** Carpet 召唤假人时默认关闭了"允许在服务器列表中显示"。要区分真人和假人，可以看登录日志：假人是以 `[local]` 方式登录的。

**FallingTree 的上限是原木数量，不是高度。** 配置里 `maxSize: 100` 我一直以为是高度。用原版的世界生成数据算了一下：最高的巨型丛林木 2×2 树干、31 格高，加上侧枝大约 160 块原木，所以 100 砍不完。改成 200 后覆盖了所有原版的树，同时保留 `maxSizeAction: ABORT`，避免一斧头砍掉玩家用原木盖的大型建筑。

**Vanilla Tweaks 数据包升级后部分失效。** 升级到 1.21.11 后，两个数据包每次开服都报函数加载失败。对比新旧包发现，函数、配方等内容完全一样，只有 `pack.mcmeta` 不同：旧包在 overlay 里用的是旧版的版本声明格式，新版本不认，overlay 里适配新版的写法就没有加载。换成官网标注支持 1.21.11 的版本就好了。其他 8 个包虽然没报错，但有同样的问题，也一起换了。

**EasyAuth 注册日志的格式。** mc-ops 的"新账号注册"告警一直没触发过。查下来是 EasyAuth 的注册日志在玩家名后面紧跟着 `{uuid}`，原来的正则没考虑到。另外要注意，这一行里还有密码哈希，解析时千万别把整行存下来。

## 八、QQ 官方机器人：主动消息很受限

迁移到 QQ 官方机器人后，我以为每天的维护通知和告警推送都在正常工作。直到排查别的问题时翻日志才发现，从上线起每天的推送都被拒了，错误码 `40034105`（主动消息失败，无权限）。

QQ 官方机器人基本只能在用户 @ 它之后回复，主动发消息的额度和权限很受限，不同的群还可能不一样：我的两个群里，一个能发，另一个不行。

教训是：**推送失败一定要有地方能看到**。只写进日志等于没有。

## 小结

回头看这些坑，有几条经验是共通的：

- **先读源码再下结论**。EasyAuth 拦包、Carpet 假人、FallingTree 上限，都是读了源码才知道真正的原因，凭直觉的猜测好几次都是错的。
- **安全措施要验证实际效果**，而不是看配置文件里写了什么。sshd 配置的覆盖顺序、被 EasyAuth 弄失效的指纹规则，都是"看起来在工作"。
- **告警规则要用真实数据校准**。用生产日志回放，比想象中的场景更能暴露误报和漏报。
