# 需求文档

## 简介

在博客主页侧边栏导航中新增两个页面标签：「友情链接」和「我的小工具」。友情链接页面用于展示友情博客列表（包含图标、链接、介绍），支持通过 Markdown 数据源管理。我的小工具页面用于汇集个人小项目入口，首先放置已有的「称骨算命」(bazi-fortune) 项目，并预留可扩展的项目卡片结构方便未来添加更多小工具。

## 术语表

- **博客系统 (Blog_System)**: 基于 Jekyll Chirpy 主题构建的个人博客站点
- **侧边栏 (Sidebar)**: 博客左侧导航栏，包含各页面标签入口
- **友情链接页面 (Friends_Page)**: 展示友情博客链接列表的独立页面
- **小工具页面 (Tools_Page)**: 汇集个人小项目入口的独立页面
- **链接卡片 (Link_Card)**: 友情链接页面中展示单个友链的 UI 组件，包含图标、名称、链接和介绍
- **工具卡片 (Tool_Card)**: 小工具页面中展示单个项目入口的 UI 组件，包含名称、描述和跳转链接
- **数据文件 (Data_File)**: 位于 `_data/` 目录下的 YAML 数据源文件，用于管理页面内容

## 需求

### 需求 1：友情链接页面导航入口

**用户故事：** 作为博客访客，我希望在侧边栏中看到友情链接的导航入口，以便快速访问友情链接页面。

#### 验收标准

1. THE Blog_System SHALL 在侧边栏导航中显示「友情链接」标签页入口
2. WHEN 用户点击「友情链接」标签时，THE Blog_System SHALL 导航至友情链接页面
3. THE Blog_System SHALL 为友情链接标签显示一个可辨识的图标（如 `fas fa-link` 或类似图标）
4. THE Blog_System SHALL 将友情链接标签的排序值设置为 5，使其显示在「关于」标签之后

### 需求 2：友情链接数据管理

**用户故事：** 作为博客维护者，我希望通过 YAML 数据文件管理友情链接列表，以便方便地增删改友链信息。

#### 验收标准

1. THE Blog_System SHALL 从 `_data/friends.yml` 数据文件中读取友情链接列表
2. THE Data_File SHALL 为每条友链记录包含以下字段：名称 (name)、链接地址 (url)、图标地址 (icon)、简介 (description)
3. WHEN 数据文件中新增一条友链记录时，THE Friends_Page SHALL 自动展示该新增链接卡片，无需修改页面模板
4. IF 数据文件中某条友链记录缺少必填字段（name 或 url），THEN THE Friends_Page SHALL 跳过该条记录并继续渲染其余链接

### 需求 3：友情链接页面展示

**用户故事：** 作为博客访客，我希望在友情链接页面中看到排列整齐的友链卡片，以便浏览和访问友情博客。

#### 验收标准

1. THE Friends_Page SHALL 以卡片网格布局展示所有友情链接
2. THE Link_Card SHALL 展示友链的图标、名称和简介信息
3. WHEN 用户点击某个链接卡片时，THE Link_Card SHALL 在新标签页中打开对应的友链地址
4. IF 某条友链未提供图标地址，THEN THE Link_Card SHALL 显示一个默认占位图标
5. THE Friends_Page SHALL 在移动端设备上以单列布局展示链接卡片，在桌面端以多列网格布局展示
6. THE Friends_Page SHALL 与博客现有 Chirpy 主题的明暗模式保持视觉风格一致

### 需求 4：小工具页面导航入口

**用户故事：** 作为博客访客，我希望在侧边栏中看到小工具的导航入口，以便快速访问小工具集合页面。

#### 验收标准

1. THE Blog_System SHALL 在侧边栏导航中显示「小工具」标签页入口
2. WHEN 用户点击「小工具」标签时，THE Blog_System SHALL 导航至小工具页面
3. THE Blog_System SHALL 为小工具标签显示一个可辨识的图标（如 `fas fa-toolbox` 或类似图标）
4. THE Blog_System SHALL 将小工具标签的排序值设置为 6，使其显示在友情链接标签之后

### 需求 5：小工具页面展示

**用户故事：** 作为博客访客，我希望在小工具页面中看到可用的小工具列表，以便选择并使用感兴趣的工具。

#### 验收标准

1. THE Tools_Page SHALL 以卡片网格布局展示所有小工具项目入口
2. THE Tool_Card SHALL 展示工具的名称、简介描述和跳转入口
3. THE Tools_Page SHALL 包含「称骨算命」(bazi-fortune) 项目作为第一个工具卡片，链接指向 `/bazi-fortune/`
4. WHEN 用户点击某个工具卡片时，THE Tool_Card SHALL 导航至对应工具的页面
5. THE Tools_Page SHALL 与博客现有 Chirpy 主题的明暗模式保持视觉风格一致
6. THE Tools_Page SHALL 在移动端设备上以单列布局展示工具卡片，在桌面端以多列网格布局展示

### 需求 6：小工具数据可扩展性

**用户故事：** 作为博客维护者，我希望通过数据文件管理小工具列表，以便未来方便地添加新的小项目入口。

#### 验收标准

1. THE Blog_System SHALL 从 `_data/tools.yml` 数据文件中读取小工具列表
2. THE Data_File SHALL 为每个工具记录包含以下字段：名称 (name)、描述 (description)、链接地址 (url)、图标 (icon)
3. WHEN 数据文件中新增一条工具记录时，THE Tools_Page SHALL 自动展示该新增工具卡片，无需修改页面模板
4. IF 数据文件中某条工具记录缺少必填字段（name 或 url），THEN THE Tools_Page SHALL 跳过该条记录并继续渲染其余工具
