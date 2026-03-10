# 实施计划：友情链接与小工具页面

## 概述

基于 Jekyll Chirpy 主题的 `_tabs` 机制和 `_data` 数据驱动模式，依次创建数据文件、页面模板和卡片样式，实现友情链接和小工具两个新页面。每个步骤在前一步基础上递增构建，最终将所有组件串联集成。

## 任务

- [x] 1. 创建友情链接数据文件和页面
  - [x] 1.1 创建 `_data/friends.yml` 数据文件
    - 创建 `_data/friends.yml`，包含至少一条示例友链记录
    - 每条记录包含 `name`、`url`、`icon`、`description` 字段
    - _需求: 2.1, 2.2_

  - [x] 1.2 创建 `_tabs/friends.md` 页面模板
    - 创建 `_tabs/friends.md`，front matter 设置 `icon: fas fa-user-friends`、`order: 5`
    - 编写 Liquid 模板遍历 `site.data.friends`，使用 `{% if friend.name and friend.url %}` 进行容错过滤
    - 渲染链接卡片：外层 `<a>` 标签设置 `target="_blank"` 和 `rel="noopener noreferrer"`
    - 卡片包含图标区域（`<img>` 显示 `friend.icon`，缺失时显示 `fas fa-globe` 默认图标）、名称 `<h3>` 和简介 `<p>`
    - 图标 `<img>` 添加 `onerror` 事件处理，加载失败时回退显示默认图标
    - _需求: 1.1, 1.2, 1.3, 1.4, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 为友情链接页面添加卡片网格样式
    - 在 `_tabs/friends.md` 中通过内联 `<style>` 标签添加 CSS
    - 使用 `display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` 实现响应式网格布局
    - 卡片样式复用 Chirpy 主题 CSS 变量（`--card-bg`、`--card-border-color`、`--text-color`）兼容明暗模式
    - 添加 hover 效果（`translateY(-2px)` + `box-shadow`）
    - _需求: 3.1, 3.5, 3.6_

- [x] 2. 创建小工具数据文件和页面
  - [x] 2.1 创建 `_data/tools.yml` 数据文件
    - 创建 `_data/tools.yml`，包含「称骨算命」条目：`name: "称骨算命"`、`description: "传统称骨算命小工具"`、`url: "/bazi-fortune/"`、`icon: "fas fa-balance-scale"`
    - _需求: 5.3, 6.1, 6.2_

  - [x] 2.2 创建 `_tabs/tools.md` 页面模板
    - 创建 `_tabs/tools.md`，front matter 设置 `icon: fas fa-toolbox`、`order: 6`
    - 编写 Liquid 模板遍历 `site.data.tools`，使用 `{% if tool.name and tool.url %}` 进行容错过滤
    - 渲染工具卡片：外层 `<a>` 标签设置 `href` 指向 `tool.url`
    - 卡片包含图标区域（Font Awesome 图标 `tool.icon`，缺失时显示 `fas fa-puzzle-piece` 默认图标）、名称 `<h3>` 和描述 `<p>`
    - _需求: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.4, 6.3, 6.4_

  - [x] 2.3 为小工具页面添加卡片网格样式
    - 在 `_tabs/tools.md` 中通过内联 `<style>` 标签添加 CSS
    - 复用与友情链接页面相同的网格布局策略和 Chirpy CSS 变量
    - 添加 hover 效果
    - _需求: 5.1, 5.5, 5.6_

- [x] 3. 检查点 - 验证页面结构和数据完整性
  - 确保所有文件已正确创建：`_data/friends.yml`、`_data/tools.yml`、`_tabs/friends.md`、`_tabs/tools.md`
  - 验证 front matter 中 `icon` 和 `order` 字段设置正确
  - 验证 `_data/tools.yml` 包含「称骨算命」条目且链接为 `/bazi-fortune/`
  - 确保所有测试通过，如有疑问请询问用户。

- [ ]* 4. 编写数据文件验证脚本
  - [ ]* 4.1 编写属性测试：数据驱动渲染正确性
    - **属性 1：数据驱动渲染正确性**
    - 使用 Python `hypothesis` 或 Node.js `fast-check` 生成包含随机有效/无效记录的数据列表
    - 模拟 Liquid 的 `{% if item.name and item.url %}` 过滤逻辑，验证输出卡片数 = 有效记录数
    - 最少运行 100 次迭代
    - **验证需求: 2.3, 2.4, 6.3, 6.4**

  - [ ]* 4.2 编写属性测试：卡片内容完整性
    - **属性 2：卡片内容完整性**
    - 生成随机有效记录，模拟渲染逻辑，验证输出包含 `name` 和 `url`
    - 若记录包含 `description`，验证输出也包含该字段
    - 最少运行 100 次迭代
    - **验证需求: 3.2, 5.2**

  - [ ]* 4.3 编写属性测试：友链卡片新标签页打开
    - **属性 3：友链卡片新标签页打开**
    - 生成随机友链记录，模拟渲染卡片 HTML，验证所有 `<a>` 标签包含 `target="_blank"` 和 `rel="noopener noreferrer"`
    - 最少运行 100 次迭代
    - **验证需求: 3.3**

  - [ ]* 4.4 编写属性测试：默认图标回退
    - **属性 4：默认图标回退**
    - 生成 `icon` 字段为空或缺失的随机记录，模拟渲染逻辑，验证输出包含默认图标类名（`fas fa-globe` 或 `fas fa-puzzle-piece`）
    - 最少运行 100 次迭代
    - **验证需求: 3.4**

- [x] 5. 最终检查点 - 确保所有内容完整
  - 确保所有测试通过，如有疑问请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 交付
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点任务用于阶段性验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
