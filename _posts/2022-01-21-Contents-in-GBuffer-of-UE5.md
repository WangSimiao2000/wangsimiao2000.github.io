---
title: UE5中的GBuffer包含的内容
date: 2022-01-21 22:00:00 +0800
categories: [笔记, 游戏引擎, Unreal Engine]
tags: [游戏引擎, Unreal Engine, GBuffer]
---

在渲染过程中，GBuffer用于BasePass阶段，将场景中的所有不透明物体渲染到GBuffer中。GBuffer包含了环境光遮蔽（AO）、法线、漫反射、金属性、高光、粗糙度、深度等信息，并通过这些数据直接生成Shading结果。以下是GBuffer的各个组成部分：

## 各通道内容

### SceneColorDeferred 场景颜色
- **格式**：`RGBAHalf`（移动平台默认使用`R11G11B10`）。
- **用途**：
  - 自发光（Emissive）数据直接写入此通道。
  - 非自发光（非Emissive）数据写入BaseColor。
- **A通道**：一般用于储存Alpha值，通常无特殊用途，但可以配置为：
  - `r.SceneColorFormat=2`（R11G11B10）：去掉A通道。
  - `r.SceneColorFormat=1`（A2R10G10B10）：保留2bit的A通道供其他用途。

### GBufferA 法线
- **内容**：`RGBA`
  - **R/G/B**：储存法线信息。
  - **A**：`PerObjectGBufferData`，用于记录其他状态信息。
    - `bit1`：`CastContactShadow`（是否投射接触阴影）。
    - `bit2`：`HasDynamicIndirectShadowCasterRepresentation`（是否具有动态间接阴影）。

### GBufferB 金属性、高光、粗糙度
- **内容**：`RGBA`
  - **R**：金属性（Metallic）。
  - **G**：高光（Specular）。
  - **B**：粗糙度（Roughness）。
  - **A**：`ShadingModelID` + `SelectiveOutputMask`（各占4bit）。
    - **Shading Model最大值为16**，用于标识不同的着色模式。

### GBufferC 基础颜色（BaseColor）
- **内容**：`RGBA`
  - **R/G/B**：储存已照亮物体的基础颜色（BaseColor）。
  - **A**：间接照明强度（Indirect Irradiance）和Material AO。
    - 有静态光照时储存随机抖动后的间接照明与AO的乘积。
    - 无静态光照时直接储存Material AO。

### GBufferD 自定义数据
- **内容**：`RGBA`
  - 用于存储自定义的材质数据，可根据需求自定义。

### GBufferE 静态阴影
- **内容**：`RGBA`
  - 储存重新计算后的阴影因素（Recomputed Shadow Factors），增强静态阴影的细节。

### GBufferF 切线（Tangent）
- **内容**：`RGBA`
  - **RGB**：WorldTangent（世界空间切线）。
  - **A**：各向异性强度（Anisotropic Strength），用于控制表面反射的方向性。

### GBufferVelocity 速度
- **内容**：记录物体的移动速度，用于运动模糊（Motion Blur）等后处理效果。

