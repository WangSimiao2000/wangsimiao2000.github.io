---
title: 基于Hexo与云服务器搭建个人博客
date: 2022-01-21 23:00:00 +0800
categories: [笔记, 博客, Hexo]
tags: [Hexo, 博客, 云服务器]
---

我曾试过使用wordpress作为博客框架进行部署,但由于本人是计算机专业学生,纯傻瓜式安装反而会让我失去成就感,再加上wordpress虽然主题丰富,但可以定制内容较少,于是经过我尝试自己写博客前后端与使用其他各个博客框架后,我选择了hexo做为我的博客框架

hexo与wordpress相比,没有后端用于储存评论及用户信息,缺少后端文章书写页面,但通过生成纯静态网页,使得博客网站性能更加高效,适用于低性能云服务器或没有个人服务器的用户

### 本地部署

博客主体基于hexo框架，本地需要安装git环境(具体可百度)、以及nodejs。

#### nodejs的安装

打开nodejs官网, 下载安装一路下一步即可。

[nodejs官网](https://nodejs.org/)

![nodejs官网](/assets/posts/Building-Personal-Blog-Based-on-Hexo-and-Cloud-Server/01.png)

win+R输入cmd, 打开命令行, 输入node -v 返回版本号即安装成功, 输入npm -v 返回版本号即安装成功

![nodejs安装成功](/assets/posts/Building-Personal-Blog-Based-on-Hexo-and-Cloud-Server/02.png)

### hexo的安装

按win+r弹出的框输入cmd回车弹出命令提示符,打开自定义的一个位置(我这里以在F:盘根目录blog文件夹安装为例):

```shell
F:
cd blog
```

输入以下指令回车。

```shell
npm install -g hexo-cli
```

初始化hexo:

```shell
hexo init
```

完成提示:
    
```shell
INFO  Start blogging with Hexo!
```

### 云服务器配置

在云服务器上安装nginx需要相关的依赖库，我们先进行库的安装。

#### 安装gcc gcc-c++

```shell
yum install -y gcc gcc-c++
```

#### 安装PCRE库

打开linux文件安装目录

```shell
cd /usr/local/
```

下载PCRE压缩包

```shell
wget http://downloads.sourceforge.net/project/pcre/pcre/8.37/pcre-8.37.tar.gz
```

解压压缩包

```shell
tar -xvf pcre-8.37.tar.gz
```

打开解压后的文件夹

```shell
cd pcre-8.37
```

编译安装

```shell
./configure

make && make install
```

检查是否安装成功

```shell
pcre-config --version
```

#### 安装 openssl 、zlib 、 gcc 依赖

```shell
yum -y install make zlib zlib-devel gcc-c++ libtool openssl openssl-devel
```

#### 安装Nginx

下载nginx安装包并解压：

```shell
cd /usr/local

wget http://nginx.org/download/nginx-1.18.0.tar.gz

tar -zxvf nginx-1.18.0.tar.gz
```

配置和安装

```shell
cd nginx-1.18.0

./configure --prefix=/usr/local/nginx

make && make install
```

启动nginx：

```shell
cd ../nginx/sbin

./nginx
```

查看nginx:

```shell
ps -ef | grep nginx
```

注: 停止和重启nginx的常用命令:

```shell
./nginx -s reload   #重启
./nginx -s stop     #关闭
```

配置环境变量

```shell
vim /etc/profile 
```

在打开的文件中添加如下代码

```shell
PATH=$PATH:/usr/local/nginx/sbin
export PATH
```

刷新配置

```shell
source /etc/profile
```

#### 安装Node.js

```shell
curl -sL https://rpm.nodesource.com/setup_10.x | bash -

yum install -y nodejs
```

查看是否成功

```shell
node -v

npm -v
```

#### 安装Git及配置仓库

安装git及新建git用户

```shell
yum install git

adduser git

chmod 740 /etc/sudoers

vi /etc/sudoers
```

在如下位置添加

```shell
git ALL=(ALL) ALL
```

vi 指令执行之后按 i 进入输入模式, 编辑完成之后按一下esc, 然后输入:wq即可退出

![vi编辑](/assets/posts/Building-Personal-Blog-Based-on-Hexo-and-Cloud-Server/03.png)

执行以下指令更改文件夹权限

```shell
chmod 400 /etc/sudoers

sudo passwd git
```

切换git用户并且建立密钥

```shell
su git

cd ~

mkdir .ssh

cd .ssh

vi authorized_keys

chmod 600 ~/.ssh/authorized_keys

chmod 700 ~/.ssh
```

创建git仓库

```shell
cd ~

git init --bare blog.git

vi ~/blog.git/hooks/post-receive
```

输入

```shell
git --work-tree=/home/www/website --git-dir=/home/git/blog.git checkout -f
```

保存退出

```shell
chmod +x ~/blog.git/hooks/post-receive
```

以上指令都需要在su git 之后执行 如果中途断开重新连接过，需要重新执行 su git指令 进入git账户。

新建/home/www/website文件夹

(在root用户下执行，所限先su root切换为root账户)

```shell
su root

输入密码

cd /home

mkdir www

cd www

mkdir website
```

修改文件夹权限

```shell
chmod 777 /home/www/website

chmod 777 /home/www
```

在本地电脑输入

```shell
ssh -v git@服务器的公网ip
```

返回如下则成功。

![ssh连接成功](/assets/posts/Building-Personal-Blog-Based-on-Hexo-and-Cloud-Server/04.png)

修改本地blog目录下的_config.yml文件

![修改_config.yml](/assets/posts/Building-Personal-Blog-Based-on-Hexo-and-Cloud-Server/05.png)

```yaml
repo: git@这里改为服务器公网IP:/home/git/blog.git
```

### 写文章及推送到云端

#### 创建新一篇文章

```shell
hexo new "你的文章名字"
```

#### 清理

建议每次生成静态文件前先清理一次

```shell
hexo clean
```

#### 生成静态文件

生成后可以先在本地预览,也可直接推送到云端

```shell
hexo g
```

#### 向云服务器推送

```shell
hexo d
```

#### 生成本地页面

```shell
hexo s
```

### 美化相关

具体请参考我的这一篇文章: [Hexo博客框架NexT主题美化总结](https://wangsimiao2000.github.io/posts/Hexo%E5%8D%9A%E5%AE%A2%E6%A1%86%E6%9E%B6NexT%E4%B8%BB%E9%A2%98%E7%BE%8E%E5%8C%96%E6%80%BB%E7%BB%93/)

### 参考链接

[如何将博客部署到云服务器 Never的个人博客(gitee.io)](https://lneverl.gitee.io/posts/2092ec56)

[从0开始拥有你自己的博客（windows10） Never的个人博客(gitee.io)](https://lneverl.gitee.io/posts/5a40952.html)

[教你如何将hexo博客部署到阿里云服务器_哔哩哔哩_bilibili](https://www.bilibili.com/video/av98268129)

