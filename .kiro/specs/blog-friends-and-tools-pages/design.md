# 设计文档：友情链接与小工具页面

## 概述

本设计为基于 Jekyll Chirpy 主题（v7.2）的博客站点新增两个页面：「友情链接」和「小工具」。两个页面均通过 Chirpy 主题的 `_tabs` 机制注册为侧边栏导航入口，使用 `_data/` 目录下的 YAML 数据文件驱动内容渲染，实现数据与模板分离。页面布局采用响应式卡片网格，兼容 Chirpy 主题的明暗模式。

### 关键设计决策

1. **使用 `_tabs` + `layout: page` 机制**：Chirpy 主题通过 `_tabs` collection 自动生成侧边栏导航，每个 tab 文件的 front matter 中 `icon` 和 `order` 字段控制图标和排序。这是最符合主题约定的方式，无需修改主题源码。
2. **数据驱动渲染**：友链和工具列表存储在 `_data/friends.yml` 和 `_data/tools.yml` 中，页面模板通过 Liquid 遍历数据文件渲染卡片，新增条目无需修改模板。
3. **内联 CSS + Chirpy CSS 变量**：卡片样式通过 `<style>` 标签内联在页面中，复用 Chirpy 主题的 CSS 变量（如 `--card-bg`, `--text-color` 等）实现明暗模式兼容，避免修改主题的 SASS 构建流程。
4. **容错渲染**：模板中对必填字段（name, url）进行 Liquid 条件判断，缺失时跳过该条记录。

## 架构

```mermaid
graph TD
    subgraph 数据层
        A[_data/friends.yml] 
        B[_data/tools.yml]
    end

    subgraph 页面层
        C[_tabs/friends.md]
        D[_tabs/tools.md]
    end

    subgraph 导航层
        E[侧边栏导航]
    end

    subgraph 渲染输出
        F[/friends/ 页面]
        G[/tools/ 页面]
    end

    A -->|Liquid site.data.friends| C
    B -->|Liquid site.data.tools| D
    C -->|Chirpy _tabs collection| E
    D -->|Chirpy _tabs collection| E
    C -->|Jekyll 构建| F
    D -->|Jekyll 构建| G
```

整体架构遵循 Jekyll 的数据驱动模式：
- **数据层**：YAML 文件存储结构化数据
- **页面层**：Markdown + Liquid 模板负责渲染逻辑
- **导航层**：Chirpy 主题自动从 `_tabs` collection 生成侧边栏入口
- **渲染输出**：Jekyll 构建生成静态 HTML 页面


## 组件与接口

### 1. 侧边栏导航入口

#### `_tabs/friends.md`

```yaml
---
icon: fas fa-user-friends
order: 5
---
```

- `icon: fas fa-user-friends`：使用 Font Awesome 的友链图标
- `order: 5`：排在「关于」(order: 4) 之后
- `layout` 默认继承 `page`（由 `_config.yml` 中 `defaults` 配置）
- `permalink` 自动生成为 `/friends/`

#### `_tabs/tools.md`

```yaml
---
icon: fas fa-toolbox
order: 6
---
```

- `icon: fas fa-toolbox`：使用 Font Awesome 的工具箱图标
- `order: 6`：排在友情链接 (order: 5) 之后
- `permalink` 自动生成为 `/tools/`

### 2. 友情链接页面 (`_tabs/friends.md`)

页面主体使用 Liquid 模板遍历 `site.data.friends`，为每条记录渲染一个链接卡片。

**渲染逻辑**：
```liquid
{% for friend in site.data.friends %}
  {% if friend.name and friend.url %}
    <!-- 渲染卡片：图标 + 名称 + 简介 -->
    <!-- 点击在新标签页打开 friend.url -->
    <!-- 若 friend.icon 为空，显示默认占位图标 -->
  {% endif %}
{% endfor %}
```

**卡片结构**：
- 外层 `<a>` 标签，`href` 指向 `friend.url`，`target="_blank"` + `rel="noopener noreferrer"`
- 图标区域：`<img>` 显示 `friend.icon`，缺失时显示 Font Awesome 默认图标 `fas fa-globe`
- 文字区域：名称 `<h3>` + 简介 `<p>`

### 3. 小工具页面 (`_tabs/tools.md`)

页面主体使用 Liquid 模板遍历 `site.data.tools`，为每条记录渲染一个工具卡片。

**渲染逻辑**：
```liquid
{% for tool in site.data.tools %}
  {% if tool.name and tool.url %}
    <!-- 渲染卡片：图标 + 名称 + 描述 -->
    <!-- 点击导航至 tool.url -->
  {% endif %}
{% endfor %}
```

**卡片结构**：
- 外层 `<a>` 标签，`href` 指向 `tool.url`
- 图标区域：Font Awesome 图标 `tool.icon`，缺失时显示默认图标 `fas fa-puzzle-piece`
- 文字区域：名称 `<h3>` + 描述 `<p>`

### 4. 卡片网格布局

两个页面共用相同的 CSS 网格布局策略：

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}
```

- 桌面端：自动填充多列（每列最小 280px）
- 移动端：当视口宽度不足时自然退化为单列
- 使用 Chirpy 主题 CSS 变量实现明暗模式兼容

### 5. 卡片样式

```css
.friend-card, .tool-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border-color);
  border-radius: 0.75rem;
  padding: 1.25rem;
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.friend-card:hover, .tool-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

## 数据模型

### `_data/friends.yml`

```yaml
- name: "示例博客"          # 必填：友链名称
  url: "https://example.com" # 必填：友链地址
  icon: "https://example.com/favicon.ico" # 可选：图标地址
  description: "一个示例博客" # 可选：简介
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 友链名称 |
| url | string | 是 | 友链地址（完整 URL） |
| icon | string | 否 | 图标地址（URL），缺失时显示默认图标 |
| description | string | 否 | 友链简介 |

### `_data/tools.yml`

```yaml
- name: "称骨算命"           # 必填：工具名称
  description: "传统称骨算命小工具" # 可选：工具描述
  url: "/bazi-fortune/"      # 必填：工具链接
  icon: "fas fa-balance-scale" # 可选：Font Awesome 图标类名
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 工具名称 |
| url | string | 是 | 工具链接（相对或绝对路径） |
| description | string | 否 | 工具描述 |
| icon | string | 否 | Font Awesome 图标类名，缺失时显示默认图标 |

**设计说明**：友链的 `icon` 是图片 URL（用于显示网站 favicon），工具的 `icon` 是 Font Awesome 类名（用于显示矢量图标）。这是因为友链通常有自己的 favicon，而内部工具更适合用统一的图标风格。


## 正确性属性

*正确性属性是在系统所有有效执行中都应成立的特征或行为——本质上是对系统应做什么的形式化陈述。属性是人类可读规范与机器可验证正确性保证之间的桥梁。*

### 属性 1：数据驱动渲染正确性

*对于任意*友链或工具数据列表（包含有效和无效记录的混合），页面渲染的卡片数量应恰好等于列表中有效记录（同时具有 `name` 和 `url` 字段）的数量。无效记录（缺少 `name` 或 `url`）应被跳过，不影响其余有效记录的渲染。

**验证需求: 2.3, 2.4, 6.3, 6.4**

### 属性 2：卡片内容完整性

*对于任意*有效的友链或工具记录，渲染生成的卡片 HTML 应包含该记录的名称（name）和链接地址（url）。若记录提供了简介/描述（description），卡片中也应包含该信息。

**验证需求: 3.2, 5.2**

### 属性 3：友链卡片新标签页打开

*对于任意*友链记录渲染的卡片，其外层链接元素应包含 `target="_blank"` 和 `rel="noopener noreferrer"` 属性，确保点击后在新标签页中打开。

**验证需求: 3.3**

### 属性 4：默认图标回退

*对于任意*友链记录，若 `icon` 字段为空或未提供，渲染的卡片应包含默认占位图标（`fas fa-globe`）而非空白或错误状态。

**验证需求: 3.4**

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| `_data/friends.yml` 或 `_data/tools.yml` 文件不存在 | Liquid 的 `site.data.friends` 返回 `nil`，`for` 循环不执行，页面显示为空（无卡片），不报错 |
| 数据文件格式错误（非法 YAML） | Jekyll 构建时报错，由 Jekyll 自身的错误机制处理 |
| 友链记录缺少 `name` 或 `url` | Liquid 条件判断 `{% if friend.name and friend.url %}` 跳过该条记录 |
| 工具记录缺少 `name` 或 `url` | Liquid 条件判断 `{% if tool.name and tool.url %}` 跳过该条记录 |
| 友链 `icon` URL 无法加载（404） | `<img>` 标签使用 `onerror` 事件回退显示默认图标 |
| 友链 `icon` 字段为空 | 模板中使用 Liquid 条件判断，显示默认 Font Awesome 图标 |
| 工具 `icon` 字段为空 | 模板中使用 Liquid 条件判断，显示默认 Font Awesome 图标 |

## 测试策略

### 单元测试

由于本项目是 Jekyll 静态站点，"单元测试"主要通过以下方式进行：

1. **数据文件验证**：编写脚本验证 `_data/friends.yml` 和 `_data/tools.yml` 的 YAML 格式和字段完整性
2. **Front matter 验证**：检查 `_tabs/friends.md` 和 `_tabs/tools.md` 的 front matter 包含正确的 `icon` 和 `order` 字段
3. **HTML 输出验证**：Jekyll 构建后检查生成的 HTML 页面包含预期的结构元素
4. **具体示例测试**：
   - 验证 `_data/tools.yml` 包含「称骨算命」条目，链接为 `/bazi-fortune/`
   - 验证友情链接页面的 `order` 为 5，小工具页面的 `order` 为 6
   - 验证侧边栏包含两个新导航入口

### 属性测试

使用属性测试库验证通用正确性属性。由于本项目主要涉及 Liquid 模板渲染，属性测试将针对数据处理和渲染逻辑的核心行为：

- **测试库**：使用 Python 的 `hypothesis` 库（或 Node.js 的 `fast-check`），通过生成随机 YAML 数据并验证渲染输出
- **最低迭代次数**：每个属性测试至少运行 100 次
- **测试标签格式**：`Feature: blog-friends-and-tools-pages, Property {number}: {property_text}`

**属性测试覆盖**：

| 属性 | 测试方法 |
|------|----------|
| 属性 1：数据驱动渲染正确性 | 生成包含随机有效/无效记录的数据列表，模拟 Liquid 渲染逻辑，验证输出卡片数 = 有效记录数 |
| 属性 2：卡片内容完整性 | 生成随机有效记录，渲染卡片 HTML，验证输出包含 name 和 url |
| 属性 3：友链卡片新标签页打开 | 生成随机友链记录，渲染卡片，验证所有 `<a>` 标签包含 `target="_blank"` |
| 属性 4：默认图标回退 | 生成 icon 字段为空的随机记录，渲染卡片，验证包含默认图标类名 |

### 手动测试

以下需求需要手动验证：
- 响应式布局（移动端单列、桌面端多列）
- 明暗模式视觉一致性
- 侧边栏导航入口的图标和排序
- 点击交互行为（新标签页打开、页面导航）
