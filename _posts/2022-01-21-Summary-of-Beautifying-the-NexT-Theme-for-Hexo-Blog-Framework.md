---
title: Hexo博客框架 NexT主题 美化总结
date: 2022-01-21 23:00:00 +0800
categories: [笔记, 博客, Hexo, NexT]
tags: [Hexo, NexT, 博客美化, 博客]
---

在安装部署完博客后,对博客格式与内容进行美化也必不可少,我便来记录一下我的博客的美化过程

注意:本文中所有提到的

hexo配置文件: blog根目录下的_config.yml配置文件

NexT配置文件: blog/themes/next/下的_config.yml配置文件

## hexo配置

### 站点配置

打开blog根目录下_config.yml文件

```yaml
# Site
title: MickeyMiao
subtitle: '欢迎来到米奇淼淼屋'
description: '保持独立思考,不卑不亢不怂'
keywords:
author: MickeyMiao
language: zh-CN
timezone: 'Asia/Shanghai'
```

- title: 标题
- subtitle: 小标题
- description: 个人介绍
- author: 作者
- language: 网站语言
- timezone: 网站时区

### 主页文章数配置

打开blog根目录下_config.yml文件

```yaml
# Home page setting
# path: Root path for your blogs index page. (default = '')
# per_page: Posts displayed per page. (0 = disable pagination)
# order_by: Posts order. (Order by date descending by default)
index_generator:
  path: ''
  per_page: 10
  order_by: -date
```

## NexT配置

### NexT主题安装与启用

在blog根目录下执行shell命令:

```shell
git clone https://github.com/iissnan/hexo-theme-next themes/next
```

在blog根目录_config.yml下配置主题

```yaml
# Extensions
## Themes: https://hexo.io/themes/
theme: next
```

### NexT主题配置

在主题文件夹blog/themes/next/下找到_config.yml在其中添加或修改配置即可

**注意**: 更新后,为便于主题美化,并且后续更新不影响主题配置文件,新版的主题相关配置文件可直接在blog根目录下hexo配置文件_config.yml中添加,相同项优先依据hexo配置文件,其次才是NexT配置文件

具体配置方式为: 在hexo配置文件末尾添加”theme_config:”字样,在tab缩进后输入NexT主题配置文件内容(如下):


```yaml

theme_config:
  xxx:
      xxx: xxx
      xxx: xxx
  xxx:
      xxx: xxx
      xxx: xxx
```

### 修改网站图标

在blog根目录下sourse文件夹,images文件夹内添加图片或ico文件

如:文件夹中头像文件为favicon.ico

则在主题配置文件中修改

```yaml
favicon:
    small: /images/favicon.ico
    medium: /images/favicon.ico
```

### 署名-非商业性使用

主题配置文件中修改:

```yaml
creative_commons:
    license: by-nc-sa
    sidebar: true
    post: true
    language: deed.zh
```

### 添加标签或分类页面

以添加标签页为例:

在blog根目录下执行shell命令:

```shell
hexo new page "tags"
```

打开blog\source\tags\文件夹下的index.md文件,添加内容:

```markdown
type: "tags"
```

要在菜单中显示,则需修改主题配置文件,将以下内容取消注释:

```yaml
menu:
    tags: /tags/ || fa fa-tags
```

### 添加个人头像

将个人头像图片avatar.png放入blog\source\images\文件夹内

修改主题配置文件:

```yaml
avatar:
    url: /images/avatar.png
    rounded: true
    rotated: true
```

### 添加社交链接

修改主题配置文件,将需要项取消注释,并修改为自己的链接:

```yaml
social:
  GitHub: https://github.com/yourname || fab fa-github
  E-Mail: mailto:yourname@gmail.com || fa fa-envelope
  Weibo: https://weibo.com/yourname || fab fa-weibo
  YouTube: https://youtube.com/yourname || fab fa-youtube
```

### 去掉页脚强力驱动

修改主题配置文件:

```yaml
footer:
    powered: false
```

### 添加备案号

修改主题配置文件,将enable修改为true,并添加响应内容:

```yaml
footer:
      # Beian ICP and gongan information for Chinese users. See: https://beian.miit.gov.cn, http://www.beian.gov.cn
  beian:
    enable: false
    icp:
    # The digit in the num of gongan beian.
    gongan_id:
    # The full num of gongan beian.
    gongan_num:
    # The icon for gongan beian. See: http://www.beian.gov.cn/portal/download
    gongan_icon_url:
```

### 开启本地搜索功能

在blog根目录下执行shell命令:

```shell
npm install hexo-generator-searchdb --save
```

修改主题配置文件

```yaml
local_search:
  enable: true
  trigger: auto
  top_n_per_article: 1
  unescape: false
  preload: false
```

### 一键返回页面顶部

修改主题配置文件

```yaml
back2top:
    enable: true
    sidebar: true
    scrollpercent: true
```

### 添加网站运行时间

在blog\source\中新建_data文件夹,在文件夹中添加footer.swig文件,修改相关内容为网址建站日期

```html
<div>
  <span id="sitetime"></span>
  <script language=javascript>
      function siteTime(){
          window.setTimeout("siteTime()", 1000);
          var seconds = 1000;
          var minutes = seconds * 60;
          var hours = minutes * 60;
          var days = hours * 24;
          var years = days * 365;
          var today = new Date();
          var todayYear = today.getFullYear();
          var todayMonth = today.getMonth()+1;
          var todayDate = today.getDate();
          var todayHour = today.getHours();
          var todayMinute = today.getMinutes();
          var todaySecond = today.getSeconds();
          /* 
          Date.UTC() -- 返回date对象距世界标准时间(UTC)1970年1月1日午夜之间的毫秒数(时间戳)
          year - 作为date对象的年份，为4位年份值
          month - 0-11之间的整数，做为date对象的月份
          day - 1-31之间的整数，做为date对象的天数
          hours - 0(午夜24点)-23之间的整数，做为date对象的小时数
          minutes - 0-59之间的整数，做为date对象的分钟数
          seconds - 0-59之间的整数，做为date对象的秒数
          microseconds - 0-999之间的整数，做为date对象的毫秒数
      */
          var t1 = Date.UTC(2021,12,23,11,40,00); //北京时间2018-2-13 00:00:00
          var t2 = Date.UTC(todayYear,todayMonth,todayDate,todayHour,todayMinute,todaySecond);
          var diff = t2-t1;
      var diffYears = Math.floor(diff/years);
      var diffDays = Math.floor((diff/days)-diffYears*365);
      var diffHours = Math.floor((diff-(diffYears*365+diffDays)*days)/hours);
      var diffMinutes = Math.floor((diff-(diffYears*365+diffDays)*days-diffHours*hours)/minutes);
      var diffSeconds = Math.floor((diff-(diffYears*365+diffDays)*days-diffHours*hours-diffMinutes*minutes)/seconds);
      document.getElementById("sitetime").innerHTML=" 已运行"+/*diffYears+" 年 "+*/diffDays+" 天 "+diffHours+" 小时 "+diffMinutes+" 分钟 "+diffSeconds+" 秒";
    }
      siteTime();
  </script>
</div>
```

修改主题配置文件,将以下内容取消注释:

```yaml
custom_file_path:
    footer: source/_data/footer.swig
```

### 页面其他美化

在blog\source\中新建_data文件夹,在文件夹中添加styles.styl文件,可通过css代码修改页面元素样式

1. **修改网站背景图片**

将背景图片background.png放在blog\sourse\images\文件夹内,在styles.sty中添加如下内容

```css
//网页背景图片
body {
    background:url(/images/background.png);
    background-repeat: no-repeat;
    background-attachment:fixed; //不重复
    background-size: cover;      //填充
    background-position:50% 50%;
}
```

2. **修改菜单栏背景图片**

```css
//菜单栏背景
.header-inner {
  background:url(/images/white_background_2.png);
}
```

3. **修改菜单栏内部图片**

```css
//侧边栏内部
.sidebar-inner {
  color: rgba(0,0,0,0);
  background:url(/images/white_background_2.png);
}
```

4. **修改页脚文字颜色**

```css
//页脚文字
.footer {
  color: $black-deep;;
}
```

5. **修改菜单栏选中后背景图片**
```css
//菜单选项选中后背景色
.menu-item-active a {
  //background:url(/images/grey_background.png);
}
```

6. **修改标题背景图片**

```css
//标题背景
.site-brand-container {
  background:url(/images/black_background.png);
}
```

7. **修改文章背景图片**

```css
//文章背景
.post-block {
  background:url(/images/white_background.png);
}
```

8. **修改头像框粗细及颜色**

```css
//头像框
.site-author-image {
  border: 2px solid rgba(34,34,34,0.25);
}
```

9. **修改返回页面顶部按钮**

```css
//返回最高
.back-to-top {  
  background:url(/images/black_background.png);  
  margin: 16px;
  //百分比字体颜色
  span {
  color: rgba(255,255,255,1);
  }
  //启用时
  &.back-to-top-on {
    //未选中时不透明度
    opacity: 1;
    &:hover {
      //鼠标悬停时不透明度
      opacity: 0.75;
    }
  }
}
```

10. **页脚胶囊效果**
将以下代码放在 “博客根目录/source/_data/next/footer.swig” 下就可以:

```html
<div>
    <style>
    .footer-beian{
        box-shadow:2px 2px 2px rgba(0, 0, 0, 0.2);
        display: inline-block;
        border-radius:4px;
        text-shadow:none;
        font-size:12px;
        color: #fff;
        line-height: 15px;
        background-color: #abbac3;
        margin: 5px 10px;
    }
    .badge-subject {
        display: inline-block;
          padding: 4px 4px 4px 6px;
          border-top-left-radius: 4px;
          border-bottom-left-radius: 4px;
    }
    .badge-value {
        display: inline-block;
        padding: 4px 6px 4px 4px;
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;

    }
    </style>

    <div class="footer-beian">
        <a target="_blank" href="http://beian.miit.gov.cn" rel="nofollow" title="蜀ICP备2021032603号">
            <span class="badge-subject">蜀ICP备</span><span class="badge-value">2021032603号</span>
        </a>
    </div>
    <div class="footer-beian">
        <a target="_blank" href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=51012202001157" rel="nofollow" title="川公网安备51012202001157号">
            <span class="badge-subject">川公网安备</span><span class="badge-value">51012202001157号</span>
        </a>
    </div>
    <div class="footer-beian">
        <a target="_blank" href="https://icp.gov.moe/?keyword=20220555" rel="nofollow" title="萌ICP备20220555号">
            <span class="badge-subject">萌ICP备</span><span class="badge-value">20220555号</span>
        </a>
    </div>
    <div class="footer-beian">
        <a target="_blank" rel="nofollow" href="https://hexo.io/" title="由 Hexo 强力驱动">
              <span class="badge-subject">Powered</span><span class="badge-value">Hexo</span>
        </a>
    </div>
    <div class="footer-beian">
        <a rel="nofollow" href="https://github.com/next-theme/hexo-theme-next" target="_blank" title="站点使用 NexT 主题">
            <span class="badge-subject">Theme</span><span class="badge-value">NexT</span>
        </a>
    </div>
</div>

```

11. **黑夜模式切换背景图片及颜色**

在”博客根目录/source/_data/next/styles.styl”中,添加如下代码

```css
/*-----------------以下为Gennuis主题配置---------------*/

body {
  background-color: #fdf9ee;
  background-image: url("/images/food.png");
  background-attachment:fixed;
  background-position:50% 50%;
}
body.darkmode--activated {
  background-color: #282828
  background-image: url("/images/skulls.png");
  background-attachment:fixed;
  background-position:50% 50%;
}
```

## 插件安装及配置

### 添加RSS订阅功能

在blog根目录_config.yml下配置插件

```yaml
# Extensions
## Plugins: https://hexo.io/plugins/
plugins: hexo-generator-feed
```

在blog目录下执行shell命令:

```shell
npm install hexo-generator-feed
```

在hexo配置文件中添加此内容

```yaml
#Feed Atom
feed:
  type: atom
  path: atom.xml
  limit: 20
  hub:
  content:
  content_limit: 140
  content_limit_delim: ' '
  order_by: -date
  icon: #icon.png
```

- type: RSS的类型(atom/rss2)
- path: 文件路径,默认是atom.xml/rss2.xml
- limit: 展示文章的数量,使用0或则false代表展示全部
- content: 在RSS文件中是否包含内容 ,有3个值 true/false默认不填为false
- content_limit: 指定内容的长度作为摘要,仅仅在上面content设置为false和没有自定义的描述出现
- content_limit_delim: 上面截取描述的分隔符,截取内容是以指定的这个分隔符作为截取结束的标志.在达到规定的内容长度之前最后出现的这个分隔符之前的内容,，防止从中间截断.


### 添加站点地图

站点地图可以使你的网站被搜索引擎收录,不同的搜索引擎需要安装不同的站点地图插件:

在blog根目录下执行shell命令:

百度:

```shell
npm install hexo-generator-baidu-sitemap --save
```

谷歌:

```shell
npm install hexo-generator-sitemap --save
```

在网站配置文件下修改如下内容:

```yaml
# URL
## Set your site url here. For example, if you use GitHub Page, set url as 'https://username.github.io/project'
url: http://www.mickeymiao.top

menu:
    sitemap: /sitemap.xml || fa fa-sitemap
```

- 将url:修改为自己网站的网址
- 将menu内取消sitemap的注释

### 添加live2D

为网站右下角添加宠物

在blog根目录下执行shell命令,安装live2d插件:

```shell
npm install --save hexo-helper-live2d
```

执行shell命令下载具体形象文件:

```shell
npm install live2d-widget-model-模型名称
```

修改站点配置文件,在其中添加如下代码:

```yaml
# Live2D
## https://github.com/EYHN/hexo-helper-live2d
live2d:
  enable: true
  # enable: false
  scriptFrom: local # 默认
  pluginRootPath: live2dw/ # 插件在站点上的根目录(相对路径)
  pluginJsPath: lib/ # 脚本文件相对与插件根目录路径
  pluginModelPath: assets/ # 模型文件相对与插件根目录路径
  # scriptFrom: jsdelivr # jsdelivr CDN
  # scriptFrom: unpkg # unpkg CDN
  # scriptFrom: https://cdn.jsdelivr.net/npm/live2d-widget@3.x/lib/L2Dwidget.min.js # 你的自定义 url
  tagMode: false # 标签模式, 是否仅替换 live2d tag标签而非插入到所有页面中
  debug: false # 调试, 是否在控制台输出日志
  model:
    use: live2d-widget-model-hijiki # npm-module package name
    # use: wanko # 博客根目录/live2d_models/ 下的目录名
    # use: ./wives/wanko # 相对于博客根目录的路径
    # use: https://cdn.jsdelivr.net/npm/live2d-widget-model-wanko@1.0.5/assets/wanko.model.json # 你的自定义 url
  display:
    position: right
    width: 150
    height: 300
```

### 为网址内中文内容进行优化

hexo与NexT默认将文章链接格式写为: 网址/日期/文章名/

在分享链接时会出现中文内容无法转化成链接或中文内容乱码的情况,此时可以依赖插件对网址进行优化

在blog根目录下执行shell命令:

```shell
npm install hexo-abbrlink --save
```

在网站配置文件中修改:

```yaml
permalink: posts/:abbrlink/
```

并添加如下内容

```yaml
# abbrlink config
abbrlink:
  alg: crc32      #support crc16(default) and crc32
  rep: hex        #support dec(default) and hex
  drafts: false   #(true)Process draft,(false)Do not process draft. false(default) 
  # Generate categories from directory-tree
  # depth: the max_depth of directory-tree you want to generate, should > 0
  auto_category:
     enable: true  #true(default)
     depth:        #3(default)
     over_write: false 
  auto_title: false #enable auto title, it can auto fill the title by path
  auto_date: false #enable auto date, it can auto fill the date by time today
  force: false #enable force mode,in this mode, the plugin will ignore the cache, and calc the abbrlink for every post even it already had abbrlink. 
```

## 参考链接

[分类:Hexo 小丁的个人博客(tding.top)](https://tding.top/categories/%E5%B7%A5%E5%85%B7%E4%BD%BF%E7%94%A8/Hexo/)

[Hexo-Next 主题博客个性化配置超详细，超全面(两万字)_Z小旋-CSDN博客_hexo next主题配置](https://blog.csdn.net/as480133937/article/details/100138838)

[Nginx限制IP访问只允许特定域名访问_你我翻滚过的榻榻米味道熟悉-CSDN博客_nginx限制域名访问](https://blog.csdn.net/qq_40065776/article/details/116058955)

[为Hexo添加Valine评论系统_xin的博客-CSDN博客_hexo valine](https://blog.csdn.net/weixin_43167980/article/details/113779387?utm_source=app&app_version=4.21.0&code=app_1562916241&uLinkId=usr1mkqgl919blen)

[为你的Hexo加上评论系统-Valine_BlueLzy的个人博客-CSDN博客_hexo valine](https://blog.csdn.net/blue_zy/article/details/79071414?utm_source=app&app_version=4.21.0&code=app_1562916241&uLinkId=usr1mkqgl919blen)

[【主题美化系列】NexT主题样式调色_kris的博客-CSDN博客_next主题美化](https://blog.csdn.net/Louis_li51/article/details/105228168)

[Hexo 创建文章生成的链接因为有中文而访问不到问题解决_蓝小白的博客-CSDN博客](https://blog.csdn.net/lxb_wyf/article/details/109137006)