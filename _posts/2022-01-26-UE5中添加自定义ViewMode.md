---
title: UE5中添加自定义ViewMode
date: 2022-01-26 22:00:00 +0800
categories: [笔记, 游戏引擎, Unreal Engine]
tags: [游戏引擎, Unreal Engine, View Mode]
---

在UE5中，通过定制ViewMode（如Lighting Only）可以实现不同的渲染调试工具。以下是步骤介绍和代码示例：

## 目标
我们将通过学习并修改UE5的`Lighting Only`工具，从源码入手，实现以下自定义ViewMode：

- Diffuse Only
- Specular Only
- Direct Lighting Only
- Indirect Lighting Only

此外，还可以添加新的ViewPort控件显示调试信息。

## 步骤
### 1. 定义自定义ViewMode
文件：`EngineBaseTypes.h`

在此文件中找到`Lighting Only`定义片段：
```cpp
/** Lit wo/ materials. */
VMI_LightingOnly = 5 UMETA(DisplayName = "Lighting Only"),
```
然后添加自定义ViewMode的定义：
```cpp
// Custom View Mode
/** Diffuse Only */
VMI_DiffuseOnly = 30 UMETA(DisplayName = "Diffuse Only"),
/** Specular Only */
VMI_SpecularOnly = 31 UMETA(DisplayName = "Specular Only"),
/** Direct Lighting Only */
VMI_DirectLightingOnly = 32 UMETA(DisplayName = "Direct Lighting Only"),
/** Indirect Lighting Only */
VMI_IndirectLightingOnly = 33 UMETA(DisplayName = "Indirect Lighting Only"),
```

### 2. 设置显示标志
文件：`ShowFlagsValues.inl`

在ShowFlagsValues.inl文件中,我们可以看到如下代码行:

```cpp
SHOWFLAG_FIXED_IN_SHIPPING(0, LightingOnlyOverride, SFG_Hidden, NSLOCTEXT("UnrealEd", "LightingOnlyOverrideSF", "Lighting Only"))
```

注释写道:

```cpp
needed for VMI_LightingOnly, Whether to override material diffuse with constants, used by the Lighting Only viewmode.
```

译为: VMI_LightingOnly需要，是否使用常量替代材质漫反射，仅照明视图模式使用。

类推, 在后方添加:

```cpp
// Custom View Mode
/** Diffuse Only */
SHOWFLAG_FIXED_IN_SHIPPING(0, DiffuseOnlyOverride, SFG_Hidden, NSLOCTEXT("UnrealEd", "DiffuseOnlyOverrideSF", "Diffuse Lighting Only"))
/** Specular Only */
SHOWFLAG_FIXED_IN_SHIPPING(0, SpecularOnlyOverride, SFG_Hidden, NSLOCTEXT("UnrealEd", "SpecularOnlyOverrideSF", "Specular Lighting Only"))
/** Direct Lighting Only */
SHOWFLAG_FIXED_IN_SHIPPING(0, DirectLightingOnlyOverride, SFG_Hidden, NSLOCTEXT("UnrealEd", "DirectLightingOnlyOverrideSF", "Direct Lighting Only"))
/** Indirect Lighting Only */
SHOWFLAG_FIXED_IN_SHIPPING(0, IndirectLightingOnlyOverride, SFG_Hidden, NSLOCTEXT("UnrealEd", "IndirectLightingOnlyOverrideSF", "Indirect Lighting Only"))
```

注意: ShowFlagsValues.inl 会被ShowFlags.h中的struct FEngineShowFlags类使用。生成一个成员属性。

### 3. 查找并返回自定义ViewMode

文件：`ShowFlags.cpp`

在`FindViewMode`函数中找到以下代码行：

```cpp
else if (EngineShowFlags.LightingOnlyOverride)
{
    return VMI_LightingOnly;
}
```

然后为每个自定义ViewMode添加判断语句：

```cpp
else if (EngineShowFlags.DiffuseOnlyOverride)
{
    return VMI_DiffuseOnly;
}
else if (EngineShowFlags.SpecularOnlyOverride)
{
    return VMI_SpecularOnly;
}
else if (EngineShowFlags.DirectLightingOnlyOverride)
{
    return VMI_DirectLightingOnly;
}
else if (EngineShowFlags.IndirectLightingOnlyOverride)
{
    return VMI_IndirectLightingOnly;
}
```

在EngineShowFlagOverride函数中

```cpp
Some view modes want some features off or on (no state)
某些视图模式需要关闭或打开某些功能（无状态）
```

添加:

注意:此处有问题未解决

```cpp
if (ViewModeIndex == VMI_DiffuseOnly)
{
    EngineShowFlags.SetDiffuse(true);
    EngineShowFlags.SetSpecular(false);
    EngineShowFlags.SetMaterials(true);
}

if (ViewModeIndex == VMI_SpecularOnly)
{
    EngineShowFlags.SetSpecular(true);
    EngineShowFlags.SetDiffuse(false);
    EngineShowFlags.SetMaterials(true);
}

if (ViewModeIndex == VMI_DirectLightingOnly)
{
    EngineShowFlags.SetDirectLighting(true);
    EngineShowFlags.(false);
    EngineShowFlags.SetMaterials(false);
}

if (ViewModeIndex == VMI_lndirectLightingOnly)
{
    EngineShowFlags.(true);
    EngineShowFlags.SetDirectLighting(false);
    EngineShowFlags.SetMaterials(false);
}
```

### 4. 应用视图模式

在`ApplyViewMode`函数中，通过`switch`语句控制自定义模式的后处理效果。添加如下代码：
```cpp
// 开启后处理
case VMI_DiffuseOnly:
    bPostProcessing = true;
    break;
case VMI_SpecularOnly:
    bPostProcessing = true;
    break;
case VMI_DirectLightingOnly:
    bPostProcessing = true;
    break;
case VMI_lndirectLightingOnly:
    bPostProcessing = true;
	break;
```

然后，在`switch`语句末尾添加以下判断：

```cpp
EngineShowFlags.SetDiffuseOnlyOverride(ViewModeIndex == VMI_DiffuseOnly);
EngineShowFlags.SetSpecularOnlyOverride(ViewModeIndex == VMI_SpecularOnly);
EngineShowFlags.SetDirectLightingOnlyOverride(ViewModeIndex == VMI_DirectLightingOnly);
EngineShowFlags.SetIndirectLightingOnlyOverride(ViewModeIndex == VMI_IndirectLightingOnly);
```

### 5. 显示自定义ViewMode名称

文件：`ViewModeNames.cpp`

在`FillViewModeDisplayNames`函数中，添加以下代码：
```cpp
// Custom View Mode
else if (ViewModeIndex == VMI_DiffuseOnly)
{
    ViewModeDisplayNames.Emplace(LOCTEXT("UViewModeUtils_VMI_DiffuseOnly", "Diffuse Only"));
}
else if (ViewModeIndex == VMI_SpecularOnly)
{
    ViewModeDisplayNames.Emplace(LOCTEXT("UViewModeUtils_VMI_SpecularOnly", "Specular Only"));
}
else if (ViewModeIndex == VMI_DirectLightingOnly)
{
    ViewModeDisplayNames.Emplace(LOCTEXT("UViewModeUtils_VMI_DirectLightingOnly", "Direct Lighting Only"));
}
else if (ViewModeIndex == VMI_IndirectLightingOnly)
{
    ViewModeDisplayNames.Emplace(LOCTEXT("UViewModeUtils_VMI_IndirectLightingOnly", "Indirect Lighting Only"));
}
```

### 6. 绑定命令
文件：`EditorViewportCommands.h`

在`FEditorViewportCommands`类中添加如下定义：
```cpp
/** Custom View Mode */
TSharedPtr< FUICommandInfo > DiffuseOnlyMode;
TSharedPtr< FUICommandInfo > SpecularOnlyMode;
TSharedPtr< FUICommandInfo > DirectLightingOnlyMode;
TSharedPtr< FUICommandInfo > IndirectLightingOnlyMode;
```

在`EditorViewportCommands.cpp`中，`RegisterCommands`函数中注册命令：
```cpp
UI_COMMAND(DiffuseOnlyMode, "Diffuse Only View Mode", "Diffuse Only Mode", EUserInterfaceActionType::RadioButton, FInputChord());
UI_COMMAND(SpecularOnlyMode, "Specular Only View Mode", "Specular Only Mode", EUserInterfaceActionType::RadioButton, FInputChord());
UI_COMMAND(DirectLightingOnlyMode, "Direct Lighting Only View Mode", "Direct Lighting Only Mode", EUserInterfaceActionType::RadioButton, FInputChord());
UI_COMMAND(IndirectLightingOnlyMode, "Indirect Lighting Only View Mode", "Indirect Lighting Only Mode", EUserInterfaceActionType::RadioButton, FInputChord());
```

### 7. 绑定Viewport命令
文件：`SEditorViewport.cpp`

在`BindCommands`函数中绑定各ViewMode：
```cpp
MAP_VIEWMODE_ACTION(Commands.DiffuseOnlyMode, VMI_DiffuseOnly);
MAP_VIEWMODE_ACTION(Commands.SpecularOnlyMode, VMI_SpecularOnly);
MAP_VIEWMODE_ACTION(Commands.DirectLightingOnlyMode, VMI_DirectLightingOnly);
MAP_VIEWMODE_ACTION(Commands.IndirectLightingOnlyMode, VMI_IndirectLightingOnly);
```

### 8. 添加ViewPort菜单
文件：`SEditorViewportViewMenu.cpp`

在`FillViewMenu`函数中添加菜单项：
```cpp
Section.AddMenuEntry(BaseViewportActions.DiffuseOnlyMode, UViewModeUtils::GetViewModeDisplayName(VMI_DiffuseOnly));
Section.AddMenuEntry(BaseViewportActions.SpecularOnlyMode, UViewModeUtils::GetViewModeDisplayName(VMI_SpecularOnly));
Section.AddMenuEntry(BaseViewportActions.DirectLightingOnlyMode, UViewModeUtils::GetViewModeDisplayName(VMI_DirectLightingOnly));
Section.AddMenuEntry(BaseViewportActions.IndirectLightingOnlyMode, UViewModeUtils::GetViewModeDisplayName(VMI_IndirectLightingOnly));
```
