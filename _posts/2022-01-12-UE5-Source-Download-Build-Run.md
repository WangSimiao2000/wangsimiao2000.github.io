---
title: UE5源码下载编译并运行
date: 2022-01-12 22:00:00 +0800
categories: [笔记, 游戏引擎, Unreal Engine]
tags: [游戏引擎, Unreal Engine, 编译]
---

学习游戏图形渲染, 游戏引擎是避不开的一个东西，开源引擎Unreal便是一个很好的选择，如今UE5已经开始逐渐投入市场，源码也在GitHub上发布，用UE5源码来研究游戏图形渲染是一个很不错的选择。

## Epicstore绑定Github账号

在Epic Store中点击管理账户，绑定账户后才有资格从GitHub上下载项目文件。

## 将Github上UE5项目拉取到本地

1. 创建存储文件的文件夹。
2. 打开文件夹，右键选择 `Git Bash Here`。
3. 运行以下命令将项目克隆到本地：

```bash
git clone -b ue5-early-access https://github.com/EpicGames/UnrealEnginegit
```

> **注意**: 此步耗时较久。

## 将下载下来的文件生成UE5方式

1. 点击 `start.bat` 执行下载配置文件（此步耗时较久）。
2. 点击 `GenerateProjectFiles.bat` 创建项目文件。

> 创建完成后，出现 `UE5.sln` 文件。

## 编译项目

1. 在解决方案资源管理器下，右键点击 `Engine-UE5`，设置为启动项目。
2. 点击启动开始编译（此步耗时约5.5个小时）。

> **注意**: 如果编译失败，检查后需要将VS2022更改为VS2019版本再进行编译。

3. 编译成功后，在UE5引擎窗口内，点击窗口，选择内容浏览器 - 内容浏览器1，以调整布局适应后续学习。

## 调整引擎设置

1. 在内容浏览器窗口选择设置 - 显示引擎内容，开启后可在内容浏览器中看到引擎资源。
2. (可选) 在编辑 - 编辑器偏好设置中将语言设置为English，以便后续在源代码中方便的查找字段。

## 参考链接

- [UE4.27官网文档页面](https://docs.unrealengine.com/4.27/zh-CN/)
