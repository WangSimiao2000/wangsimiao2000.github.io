---
title: Buffer Visualization的功能和实现
date: 2022-01-12 22:00:00 +0800
categories: [笔记, 游戏引擎, Unreal Engine]
tags: [游戏引擎, Unreal Engine, Buffer Visualization]
---

在UE5引擎中，通过在Overview选项下打开Buffer Visualization，可以访问显卡中的各个缓冲区，以此诊断场景外观问题。该功能提供多个选项，以下是主要功能和实现细节。

## 功能概述

- **Material Domain（材质域）**: Post Process（后期处理）
- **Shading Model（着色模型）**: Unlit（无光照）
- **Cast Ray Traced Shadows（投影光线检测阴影）**: true
- **Num Customized UVs（自定义UV数）**: 0
- **Shading Rate（着色率）**: 1x1

### Buffer Visualization 选项

1. **Base Color**
   - 仅查看场景中材质的基色。它接收 Vector3 (RGB) 值，并且每个通道都自动限制在 0 与 1 之间。

2. **Custom Depth**
   - 通过 `SceneTexture` 节点获取，用于屏幕后处理。需在指定物体上开启“渲染自定义深度通道”（Render Custom Depth），该物体的 PixelDepth 将渲染到单独的 Buffer 中。与 SceneDepth 类似，但未开启 CustomDepth 的区域填充为极大值（10^8）。

3. **Pixel Depth（像素深度）**
   - 当前被渲染的像素点与摄像机的距离。该节点没有输入接口，只能获取正在处理的像素点的深度。

4. **Custom Stencil**
   - 可视化遮挡对象、绘制对象轮廓，或仅从特定视角可见。通过访问场景中 Actor 的模板实现。

5. **Final Image**
   - 最终呈现的效果。

### 其他关键选项

- **Shading Model**
  - 显示场景中每个材质的着色模型属性值。

- **Material Ambient Occlusion**
  - 显示与材质环境光遮蔽（Ambient Occlusion）输入相连接的纹理处理或材质表达式节点的结果。

- **Metallic**
  - 显示与材质金属色（Metallic）输入相连接的结果。通常为0或1。

- **Opacity**
  - 显示与材质不透明（Opacity）输入相连接的结果，关键在于次表面散射材质。

- **Roughness**
  - 显示与材质粗糙度（Roughness）输入相连接的结果，影响反射变化。

- **Subsurface Color**
  - 显示与材质次表面颜色输入相连接的结果。

### 额外功能

- **World Normal**
  - 显示不透明表面的全局空间法线。
  
- **Ambient Occlusion**
  - 显示场景中发生的任何环境光遮蔽计算的结果，与材质的 AO 纹理无关。

- **Velocity**
  - 显示场景中物体的速度信息。

- **Pre/Post Tonemap HDR Color**
  - 分别用于HDR彩色色调映射之前和之后的颜色信息。

### 总结

Buffer Visualization 功能为开发者提供了强大的工具，帮助其深入理解和调试材质的表现以及场景的渲染效果。通过对各个缓冲区的可视化，开发者能够更轻松地发现并解决场景外观的问题，从而提升整体的游戏表现和画面质量。
