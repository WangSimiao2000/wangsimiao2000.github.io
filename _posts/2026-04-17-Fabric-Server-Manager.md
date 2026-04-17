---
title: 从手动运维到自动化：我的 Minecraft Fabric 服务器管理框架
date: 2026-04-17 11:00:00 +0800
categories: [游戏, Minecraft]
tags: [Minecraft, Linux, 服务器, Fabric, Bash, 自动化]
---

三年前我写过一篇[Linux从零搭建Minecraft服务器](/posts/Minecraft-Server-Setup-Linux/)，当时用的是原版服务端，手动启停、手动备份、升级靠祈祷。三年下来，服务器从原版换成了 Fabric 模组服，Mod 数量从 0 涨到了 40+，玩家从我一个人变成了一群朋友。手动运维早就撑不住了。

于是我写了一套 Bash 工具集来管理整个服务器生命周期：[Fabric Server Manager](https://github.com/WangSimiao2000/fabric-server-manager)。

## 服务器现状

| 项目 | 详情 |
|------|------|
| 服务器地址 | `mcserver.mickeymiao.cn:61015` |
| MC 版本 | 1.21.11 (Fabric) |
| 模组数量 | 40+ |
| 运行环境 | Linux VPS |
| 管理方式 | tmux 后台 + cron 定时任务 |

主要装了这些类型的 Mod：

- **性能优化**：Lithium、Krypton
- **实用工具**：Fabric Carpet、FallingTree、RightClickHarvest
- **地图**：Xaero's Minimap + World Map
- **跨版本**：ViaVersion + ViaBackwards + ViaFabric（让不同版本的客户端都能连）
- **安全**：EasyAuth（离线模式下的登录认证）、NoChatReports
- **管理**：LuckPerms（权限）、Spark（性能分析）、Chunky（预生成区块）

## 为什么要写管理框架

手动运维 Fabric 模组服的痛点：

1. **升级噩梦** — MC 出新版本后，要逐个检查 40 个 Mod 是否兼容，手动去 Modrinth 下载新版本，漏一个就崩服
2. **备份靠记忆** — 忘了备份就升级，炸了只能哭
3. **半夜崩服没人知道** — 第二天朋友问"服务器怎么连不上"才发现
4. **重启要手动** — 长时间运行内存泄漏，需要定期重启

## Fabric Server Manager

一套纯 Bash 脚本，通过一个入口 `mc.sh` 管理所有事情：

```bash
# 日常操作
./mc.sh start          # 启动（含环境预检查）
./mc.sh stop           # 优雅关闭（倒计时通知玩家）
./mc.sh status         # CPU/内存/运行时间一览

# 版本升级
./mc.sh upgrade        # 自动检测所有 Mod 兼容的最新版本
./mc.sh upgrade 1.21.11  # 一键升级：关服→备份→下载→更新Mod→启动
./mc.sh rollback       # 升级翻车？一键回退

# 备份
./mc.sh backup create  # 冷备份（世界+Mod+配置）
./mc.sh backup restore # 从备份恢复

# 玩家管理
./mc.sh player op Mickey    # 给 OP
./mc.sh player ban Griefer  # 封禁
```

### 自动化能力

- **定时重启 + 冷备份**：cron 每天凌晨自动执行，重启前给在线玩家倒计时警告
- **崩溃监控（Watchdog）**：每分钟检测服务器状态，崩溃后自动重启并发邮件通知；反复崩溃时停止重启，避免死循环
- **升级自动兼容性检查**：调用 Modrinth API 检查每个 Mod 是否有目标版本，不兼容的自动禁用并移到 `mods.disabled/`
- **升级失败自动回滚**：升级前创建快照，过程中任何步骤失败都会自动恢复到升级前的状态

### 技术细节

选择 Bash 而不是 Python/Go 是因为：

- 核心工作就是粘合 tmux、tar、rsync、systemctl 这些系统命令，Bash 调用零摩擦
- 总共不到 2000 行，不需要额外运行时
- `git clone` + `bash deploy.sh` 就能用，部署即复制

项目结构：

```
scripts/
├── mc.sh              # 统一入口
├── common.sh          # 公共函数库
├── lib/
│   ├── server.sh      # 启停、状态、预检查
│   ├── backup.sh      # 备份、恢复、回退
│   ├── player.sh      # 玩家管理
│   ├── mods.sh        # Mod 管理、日志
│   ├── notify.sh      # 通知
│   ├── send_email.py  # SMTP 邮件发送
│   └── sync_motd.py   # MOTD 同步
├── upgrade.sh         # 版本升级
├── watchdog.sh        # 崩溃监控
└── deploy.sh          # 一键部署
```

配有 170+ 个自动化测试（单元测试 + 集成测试），GitHub Actions CI 每次 push 自动运行。

## 一个真实的 Bug 故事

前几天发现每天凌晨的定时重启虽然执行了，但备份一直没有增加。查日志发现：

```
[ERROR] 另一个 mc.sh 实例正在运行，请稍后再试
```

原因是重启脚本先获取了文件锁（flock），然后调用 `mc.sh stop`、`mc.sh backup create` 等子命令——这些是独立子进程，无法继承父进程的锁，全部被拒绝。

修复只改了两行：让 `common.sh` 的锁变量不覆盖环境变量传入的值，重启脚本在获取锁后 export 给子进程。同时补了跨进程锁继承的测试用例，确保不会回退。

这种 bug 就是"每个零件单独测试都通过，但组装起来就出问题"的典型案例，也是后来补充集成测试的动力。

## 开发工具

整个项目全程使用 [Kiro](https://kiro.dev/) + Claude Opus 4.6 进行开发——从脚本编写、Bug 调试到测试用例补充，全部在 AI 辅助下完成。Kiro 作为 AI 开发助手直接在终端中协作，大幅提升了开发效率。

## 开源

项目已开源：[github.com/WangSimiao2000/fabric-server-manager](https://github.com/WangSimiao2000/fabric-server-manager)

如果你也在 Linux 上跑 Fabric 模组服，欢迎试用。
