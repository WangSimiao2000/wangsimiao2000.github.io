---
title: 在GBuffer Visualization中添加新的工具
date: 2022-01-18 22:00:00 +0800
categories: [笔记, 游戏引擎, Unreal Engine]
tags: [游戏引擎, Unreal Engine, GBuffer]
---

在了解Buffer Visualization的各个功能后，我们可以尝试制作一个新的Buffer Visualization工具。以下是具体步骤：

## 创建材质球

1. **搜索Buffer Visualization文件夹**
   - 在Content Browser中，搜索“Buffer Visualization”文件夹。

![搜索Buffer Visualization文件夹](/assets/posts/Add-New-Tools-to-GBuffer-Visualization/01.png)

2. **新建材质球**
   - 右键点击，选择“Create Basic Asset”中的“Material”，命名为`Diffuse Color`。

![新建材质球](/assets/posts/Add-New-Tools-to-GBuffer-Visualization/02.png)

3. **打开材质编辑器**
   - 双击新创建的材质球，打开材质编辑器。

![材质编辑器](/assets/posts/Add-New-Tools-to-GBuffer-Visualization/03.png)

4. **实现期望效果**

期望效果：`DiffuseColor = BaseColor * (1 - Metallic)`。

   - 在材质编辑器中，将`BaseColor`和`Metallic`蓝图复制到`DiffuseColor`的材质编辑器蓝图中。

![材质编辑器蓝图](/assets/posts/Add-New-Tools-to-GBuffer-Visualization/04.png)

   - 使用`Multiply`节点实现乘法，使用`OneMinus`节点实现`1 - x`。

![使用Multiply节点](/assets/posts/Add-New-Tools-to-GBuffer-Visualization/05.png)

   
1. **保存并退出**
   - 保存后退出材质编辑器。

## 编辑引擎文件

1. **搜索引擎源码**
   - 在Visual Studio中，搜索引擎源码文件`BaseEngine.ini`。


2. **找到标识**
   - 找到`[Engine.BufferVisualizationMaterials]`标识。

![搜索引擎源码](/assets/posts/Add-New-Tools-to-GBuffer-Visualization/06.png)

3. **插入新行**
   - 在标识下插入以下行：
     ```
     DiffuseColor=(Material="/Engine/BufferVisualization/DiffuseColor.DiffuseColor", Name=LOCTEXT("BaseDiffuseColorMat", "Diffuse Color"))
     ```

4. **保存并重启引擎**
   - 保存文件并重新启动引擎。

5. **查看新工具**

   - 在ViewMode中找到`BufferVisualization-DiffuseColor`

![找到相应选项](/assets/posts/Add-New-Tools-to-GBuffer-Visualization/07.png)

   - 选中后会出现如下效果，表明工具添加成功。

![查看效果](/assets/posts/Add-New-Tools-to-GBuffer-Visualization/08.png)


## 总结

通过以上步骤，我们成功地在GBuffer Visualization中添加了新的工具。这一过程不仅帮助我们深入理解了Buffer Visualization的机制，也增强了我们在Unreal Engine中创建自定义功能的能力。
