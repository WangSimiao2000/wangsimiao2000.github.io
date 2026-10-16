---
title: Linux从零搭建Minecraft服务器
date: 2021-12-17 22:00:00 +0800
categories: [游戏, Minecraft]
tags: [Minecraft, Linux, 服务器]
---

搭建一个属于自己的Minecraft服务器是我从初中开始就有的梦想，但奈何高考之前，我都没有被父母允许玩电脑，更别说有机会搭建Minecraft服务器了。终于到了大学，有机会攒钱买了个阿里CentOS系统的服务器，这才开始着手实现儿时的愿望。

### 前期准备

在准备搭建服务器之前，我们先要有以下准备：

- 一台拥有公网IP的电脑/服务器（1.17及其之前至少1C2G，1.18之后要求更高）
- 一套可以连接管理此服务器的设备（如FTP等）
- 一个会使用电脑的人

### 第一步: Java环境搭建

众所周知，Minecraft Java版是由Java语言编写编译的，所以我们在启动服务器之前，需要搭建Java/JDK环境。

#### 下载Java压缩包

在Oracle官网下载适合Linux系统的最新Java压缩包：

[Oracle Java Downloads](https://www.oracle.com/java/technologies/downloads/)

![官网下载界面截图](/assets/posts/Minecraft-Server-Setup-Linux/01.png)

#### 下载Java安装包

可以在Windows系统下载好后通过FTP工具传送到服务器上，也可在服务器上执行如下命令：

```bash
wget https://download.oracle.com/java/17/latest/jdk-17_linux-x64_bin.tar.gz
```

#### 解压并安装

解压已下载的压缩包：

```bash
tar -zxvf jdk-17_linux-x64_bin.tar.gz
```

将解压后的文件移动到系统软件安装路径：

```bash
mv jdk-17.0.1 /usr/local/jdk17
```

#### 配置系统Java环境

修改系统配置文件，以便之后可以运行Java命令：

```bash
vim /etc/profile
```

按 `i` 进入编辑模式，添加如下配置，按 `:wq` 保存并退出编辑（ `:` 也是指令的一部分）：

```bash
export JAVA_HOME=/usr/local/jdk17 
export CLASSPATH=$:CLASSPATH:$JAVA_HOME/lib/ 
export PATH=$PATH:$JAVA_HOME/bin
```

刷新系统配置：

```bash
source /etc/profile
```

输入以下命令，出现Java版本号，则Java安装成功：

```bash
java -version
```

![Java版本号](/assets/posts/Minecraft-Server-Setup-Linux/02.png)

### 第二步: Minecraft服务器搭建

#### 下载服务器核心

如果想要后续装插件，就在如下网站下载服务器核心。

注：插件服务器核心有很多种，性能特性各有不同，这里只用Paper核心做介绍。

[Downloads – PaperMC](https://papermc.io)

如果是纯原版服务器，就在官网下载原版服务器核心：

[Download server for Minecraft](https://www.minecraft.net/en-us/download/server)

由于安装过程两者相同，这里由Paper插件核心（Minecraft 1.17.1版本做演示）：

打开home文件夹：

```bash
cd /home/
```

新建一个mcserver文件夹用于存放Minecraft服务器文件：

```bash
mkdir mcserver
```

打开mcserver文件夹：

```bash
cd mcserver
```

下载服务器核心：

```bash
wget https://papermc.io/api/v2/projects/paper/versions/1.17.1/builds/408/downloads/paper-1.17.1-408.jar
```

#### 启动服务器核心

有两种方法：

1. 直接在命令行输入：

   ```bash
   java -Xmx1024M -Xms1024M -jar paper-1.17.1-408.jar nogui
   ```

   但是此方法每次启动时都需要打这么长一串代码，作为懒狗的我们，可以用第二个方法。

2. 新建一个start.sh文件用于执行上述Java命令，之后需要启动服务器时直接执行此文件即可：

   新建start.sh文件：

   ```bash
   touch start.sh
   ```

   编辑该文件：

   ```bash
   vi start.sh
   ```

   然后键入 `i`，输入如下内容，键入 `esc`，键入 `:wq` 保存退出：

   ```bash
   java -Xmx1024M -Xms1024M -jar paper-1.17.1-408.jar nogui
   ```

   启动服务器核心：

   ```bash
   bash start.sh
   ```

   之后我们需要启动服务器核心时，只需在此文件夹目录下执行 `bash start.sh` 命令即可。

#### 同意协议

第一次运行服务器核心，会提示eula.txt文件加载失败，我们不用担心。

![eula.txt加载失败](/assets/posts/Minecraft-Server-Setup-Linux/03.png)

打开eula.txt文件，键入 `i`，将 `false` 修改为 `true`，然后键入 `esc`，键入 `:wq` 保存退出：

```bash
vi eula.txt
```
![eula.txt修改](/assets/posts/Minecraft-Server-Setup-Linux/04.png)

再次启动服务器核心：

```bash
bash start.sh
```

此时会出现大量提示，大多是关于生成世界一类的，直到出现 `Done!` 提示时，代表服务器已成功开启。

![服务器开启成功](/assets/posts/Minecraft-Server-Setup-Linux/05.png)

注意: 需要在服务器的防火墙中开放25565端口(在配置文件中可以改成别的, 但推荐是25565, 因为此端口号是默认端口, 可以省略)，否则无法连接服务器。

此时玩家已经可以通过输入你的服务器IP地址正常进行游玩了，不过还有一个问题，就是一旦你退出服务器的控制台，Minecraft服务器也会直接停止，怎么解决呢？

### 第三步: screen软件安装

#### 结束当前运行的服务器

输入 `stop` 并回车，当前运行的服务器核心将停止运行：

```bash
stop
```

![服务器停止运行](/assets/posts/Minecraft-Server-Setup-Linux/06.png)

#### 安装screen

Screen相当于是Windows的窗口，每创建一个screen，就相当于新开了一个窗口，而且只要不是通过 `exit` 指令退出screen，则screen里的程序将会一直运行。

```bash
yum -y install screen
```

安装完成后可通过输入查看版本命令检查是否安装成功：

```bash
screen -v
```

![screen版本号](/assets/posts/Minecraft-Server-Setup-Linux/07.png)

#### 新建一个screen

```bash
screen
```

#### 运行服务器核心

```bash
bash start.sh
```

![screen运行服务器核心](/assets/posts/Minecraft-Server-Setup-Linux/08.png)

好啦，现在即使你关闭了服务器控制台，玩家们也可以正常访问你的服务器啦！

### 其他

关于screen指令的其他使用,如打开之前开启的screen,关闭所有后台screen,请自行搜索

关于minecraft服务器的配置及插件的安装,请自行搜索
