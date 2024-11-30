---
title: RenderDoc的安装与使用
date: 2022-01-19 22:00:00 +0800
categories: [笔记, 游戏引擎, 其它]
tags: [游戏引擎, Render Doc, 游戏调试, 渲染管线]
---

RenderDoc是一个截帧工具，通过截取一帧画面，可以深入了解GPU在生成该画面时，渲染管线各阶段的详细情况。这里主要介绍RenderDoc的安装与使用方法。

## RenderDoc的安装

### 方法一：官网下载
1. 进入RenderDoc官网，下载最新的安装包。
2. 下载后双击`RenderDoc_1.17_64.msi`进行安装。
   - **注意**：安装时无法选择安装目录。

### 方法二：通过UE5内置插件直接使用
- 打开UE5，在上方菜单栏点击`Edit` -> `Plugins`。
   
![点击Edit-Plugins](/assets/posts/Installation-and-Usage-of-RenderDoc/01.png)

- 搜索`RenderDoc`，点击`Enabled`启用插件。

![RenderDoc按钮](/assets/posts/Installation-and-Usage-of-RenderDoc/02.png)

1. 点击右下角的`Restart Now`重启引擎。
2. 重启后，场景视图右侧会出现RenderDoc按钮。

![RenderDoc按钮](/assets/posts/Installation-and-Usage-of-RenderDoc/03.png)

## RenderDoc的使用及基本介绍

- **截取当前帧**：调整相机位置，点击RenderDoc按钮，即可截取当前帧，查看渲染管线详情。

![开始截取当前帧](/assets/posts/Installation-and-Usage-of-RenderDoc/04.png)

**Event Browser**：显示每一个渲染Pass的输入输出。主要关注的Pass有：
   - **BasePass**：渲染每个物体的基本信息。
   - **LightingPass**：获取`BasePass`输出的GBuffer信息，并进行着色处理。
   - **PostProcessing**：将颜色调整为人眼视觉适应效果。

![Event Browser](/assets/posts/Installation-and-Usage-of-RenderDoc/05.png)

### UE5新特性
在分析RenderDoc的渲染管线过程中，可以观察到UE5的一些新特性：
   - **Nanite**：虚拟化几何图形，提升大量细节渲染。
   - **Lumen**：实时全局光照。

## 常见Pass说明

1. **BasePass**：对场景每个物体或组合进行单独渲染。
2. **Lights**：
   - **DirectLighting**：处理直接光照。
   - **NonShadowedLights**、**ShadowedLights**：处理无阴影和有阴影的光照。
3. **PostProcessing**：
   - **ComposeSeparateTranslucency**：分离透明和半透明物体处理。
   - **TemporalSuperResolution**：抗锯齿，类似于TAA的升级版。
   - **Downsample.HalfResolutionSceneColor**：半分辨率下采样。
   - **Histogram**：亮度分布的图像直方图。
   - **EnqueueCopy(EyeAdaptation)**：眼部自适应功能。
   - **HistogramEyeAdaptation**：类似曝光的眼部适应效果。
   - **SceneDownsample**：场景下采样。
   - **Bloom**：光晕效果。
   - **CombineLUTS**：色调映射。
   - **Tonemap**：后期色彩映射。
   - **Upscale**：输出放大处理。