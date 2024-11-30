---
title: 基于GithubPages与Jekyll主题Chirpy搭建个人博客
date: 2024-10-30 10:00:00 +0800
categories: [笔记, 博客]
tags: [博客, GithubPages, Jekyll, Chirpy]
---

在本科大二的时候曾经突发奇想, 购买了一个1H2G的阿里云云服务器, 使用Hexo的NexT主题搭建了一个个人博客, 但是由于服务器的性能太差, 且域名备案即将到期, 再加上服务器和域名的费用, 最终还是放弃维护了, 最近秋招接近尾声, 也有了一些时间, 于是又想着搭建一个个人博客, 但是这次不想再使用Hexo, 而是使用GithubPages和Jekyll, 因为GithubPages是免费的, 而且Jekyll是GithubPages默认支持的静态网站生成器, 于是就有了这篇文章.


## 初始化博客仓库

此博客基于Jekyll主题Chirpy, 你可以在[这里](https://github.com/cotes2020/chirpy-starter)找到Chirpy的模板仓库

### 1. 创建仓库

在Chirpy的模板仓库页面点击`Use this template`按钮, 创建一个新的仓库, 仓库名为`username.github.io`, 其中`username`是你的Github用户名, 这样就可以通过`https://username.github.io`访问你的博客了.

### 2. 克隆仓库

使用Git克隆仓库到本地

```bash
git clone https://github.com/username/username.github.io.git
```

克隆后的目录结构如下:

```shell
username.github.io
├── _data
├── _plugins
├── _posts
├── _tabs
├── .devcontainer
├── .github
├── .vscode
├── assets
├── tools
├── _config.yml
├── .gitignore
├── .editorconfig
├── .gitattributes
├── .gitmodules
├── .nojekyll
├── Gemfile
├── index.html
├── LICENSE
├── README.md
```

## 配置博客

### 1. 修改配置

修改`_config.yml`文件, 修改`title`, `description`, `url`, `baseurl`等配置项

```yaml
theme: jekyll-theme-chirpy

lang: zh-CN

timezone: Asia/Shanghai

title: 王思淼的博客 # the main title

tagline: 我的个人博客, 分享技术笔记或生活随笔 # it will display as the subtitle

description: >- # used by seo meta and the atom feed
  A minimal, responsive and feature-rich Jekyll theme for technical writing. 

url: "https://wangsimiao2000.github.io"

github:
  username: WangSimiao2000 # change to your GitHub username

social:
  name: Wang Simiao
  email: mickeymiao2023@163.com # change to your email address
  links:
    - https://github.com/wangsimiao2000 # change to your GitHub homepage
    - https://steamcommunity.com/id/MickeyMiao/ # change to your Steam homepage
    - https://space.bilibili.com/36913332 # change to your Bilibili homepage
```

### 2. 配置网站验证设置

网站验证设置可以帮助你验证你的网站, 以便于搜索引擎更好的收录你的网站, 你可以在`_config.yml`文件中找到`webmaster_verifications`配置项, 填入你的Google和Bing的验证代码

验证代码可以在Google Search Console和Bing Webmaster Tools中找到

```yaml
# Site Verification Settings
webmaster_verifications:
  google: "jDx4WsLTQPjOKEDz18-BywqYTrR3Kd2anexSUvXsB5A" # fill in your Google verification code
  bing: "AED17E5D4F90FD73F2F67459465E4A3C" # fill in your Bing verification code
```

### 3. 配置网站图标

配置网站图标可以参考官方文档[Adding a favicon](https://chirpy.cotes.page/posts/customize-the-favicon/)

先在此网站[real favicon generator](https://realfavicongenerator.net/)生成网站图标

然后将生成的文件放在`assets/img/favicon`目录下, 如果没有这个目录, 可以自己创建

接下来在`_config.yml`文件中找到`favicon`配置项, 填入你的网站图标的路径

```yaml
# the avatar on sidebar, support local or CORS resources
avatar: /assets/img/avatar/avatar.png
```

注意, 生成的图标文件并不能涵盖所有的设备, 所以有些特定设备需要的图片名称可能不一样, 可以自行修改和添加

### 4. 配置评论系统

Chirpy支持Disqus, Utterances和Giscus三种评论系统, 你可以在`_config.yml`文件中找到`comments`配置项, 根据你的需求填入相应的配置

我建议使用Giscus, 因为Giscus是一个开源的评论系统:
1. 首先要在[Giscus app](https://github.com/apps/giscus)处安装Giscus
2. 安装时选择要安装的仓库, 可以选择所有仓库, 也可以单独选择, 我这里选择了我的博客仓库`wangsimiao2000.github.io`
3. 然后在仓库的`Settings`选项卡中找到`General`选项, 勾选`Features`中的`Discussions`选项
4. 最后在`_config.yml`文件中填入在[Giscus](https://giscus.app/zh-CN)中配置的信息

```yaml
comments:
  # Global switch for the post-comment system. Keeping it empty means disabled.
  provider: giscus # [disqus | utterances | giscus]
  # The provider options are as follows:
  disqus:
    shortname: # fill with the Disqus shortname. › https://help.disqus.com/en/articles/1717111-what-s-a-shortname
  # utterances settings › https://utteranc.es/
  utterances:
    repo: # <gh-username>/<repo>
    issue_term: # < url | pathname | title | ...>
  # Giscus options › https://giscus.app
  giscus:
    repo: WangSimiao2000/wangsimiao2000.github.io # <gh-username>/<repo>
    repo_id: R_kgDONIE9DA
    category: General
    category_id: DIC_kwDONIE9DM4Cj2Nu
    mapping: pathname # optional, default to 'pathname'
    strict: 0 # optional, default to '0'
    input_position: bottom # optional, default to 'bottom'
    lang: zh-CN  # optional, default to the value of `site.lang`
    reactions_enabled: 1 # optional, default to the value of `1`
```

Giscus的`repo_id`和`category_id`直接决定了评论储存在哪个仓库, 需要根据[Giscus](https://giscus.app/zh-CN)中配置的仓库信息生成, 如果删除了仓库后重新创建, 需要重新配置

Giscus的评论是基于Github Issue的, 也就是说, 你的博客每篇文章对应一个仓库的Issue

### 5. (可选)配置完整Chirpy主题功能

在Chirpy的完整项目仓库中, 还有一些文件夹是未包含在Chirpy Starter中的, 你可以将这些文件夹复制到你的博客仓库中, 以实现更多的功能(例如:Mathjax数学公式支持等)

[Chirpy的完整项目仓库](https://github.com/cotes2020/jekyll-theme-chirpy)

将`_includes`, `_layouts`, `_sass`, `assets/js`等文件夹复制到你的博客仓库的根目录中

`_config.yml`文件中的`exclude`是用来排除不需要构建的文件, 你可以根据需要添加或删除

## 发布博客

### 1. 本地撰写博客

在`_posts`目录下新建一个Markdown文件, 文件名格式为`yyyy-MM-dd-Title.md`, 其中`yyyy-MM-dd`是文章的发布日期, `Title`是文字网址的最后一部分, 所以建议使用英文, 例如`2024-10-30-Building-a-Personal-Blog-with-GitHubPages.md`

在文件头部添加文章的元信息, 例如:

```md
---
title: 基于GithubPages与 Jekyll 主题 Chirpy搭建个人博客
date: 2024-10-30 10:00:00 +0800
categories: [笔记, 博客]
tags: [博客, GithubPages, Jekyll, Chirpy]
---
```

其中:
- `title`是文章的标题, 显示在文章列表和文章页面的标题
- `date`是文章的发布日期, 后面的`10:00:00`是时间, `+0800`是时区
- `categories`是文章的分类, 第一个是主分类, 第二个是次级分类
- `tags`是文章的标签, 可以有多个

如果文章中需要使用数学公式, 可以在文章头部添加`math: true`, 这样Jekyll会自动渲染数学公式

```md
---
title: ...
date: ...
categories: ...
tags: ...
math: true
---
```

### 2. 本地预览

由于我是Windows用户, 所以难以在本地搭建Jekyll环境, 所以暂时并未实现, 后期如果找到新的方法会, 会更新一篇新的文章

### 3. 提交到Github

将本地修改提交到Github

```bash
git add .
git commit -m "Add a new post"
git push
```

当你提交到Github后, Github会自动构建你的博客, 如果出现报错, 可以在Github的`Actions`选项卡中查看构建日志

构建完成后, 你可以在`https://username.github.io`访问你的博客, 不过由于GithubPages的缓存机制, 你可能需要等待一段时间才能看到你的新文章