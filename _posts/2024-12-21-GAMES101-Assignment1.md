---
title: GAMES101 作业1
date: 2024-12-21 16:40:00 +0800
categories: [笔记, GAMES101]
tags: [GAMES101]
math: true
---

这是GAMES101的正式作业的作业1, 要求实现两个矩阵计算, 包括模型变换(只有旋转)矩阵和透视投影矩阵

我的所有GAMES101作业的仓库地址: [GAMES101-Assignments](https://github.com/WangSimiao2000/GAMES101-Assignments)

## 模型变换矩阵

参数只有旋转角度`rotate_angle`, 要求实现绕Z轴旋转`rotate_angle`角度的矩阵

```cpp
Eigen::Matrix4f get_model_matrix(float rotation_angle)
{
    Eigen::Matrix4f model = Eigen::Matrix4f::Identity();

    // TODO: Implement this function
    // Create the model matrix for rotating the triangle around the Z axis.
    // Then return it.
    
    // 将角度从度转为弧度（如果传入的是度的话）
    float angle_in_radians = rotation_angle * MY_PI / 180.0f;

    // 创建绕Z轴的旋转矩阵
	Eigen::Matrix4f rotation_matrix = Eigen::Matrix4f::Identity(); // 初始化为单位矩阵
    rotation_matrix(0, 0) = cos(angle_in_radians);  // cos(θ)
    rotation_matrix(0, 1) = -sin(angle_in_radians); // -sin(θ)
    rotation_matrix(1, 0) = sin(angle_in_radians);  // sin(θ)
    rotation_matrix(1, 1) = cos(angle_in_radians);  // cos(θ)

	model = rotation_matrix * model;

    return model;
}
```

原理很简单, 就是绕Z轴旋转, 旋转矩阵如下:

$$
\begin{bmatrix}
\cos(\theta) & -\sin(\theta) & 0 & 0 \\
\sin(\theta) & \cos(\theta) & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
$$

我们只需要先将角度转为弧度, 然后使用`Eigen::Matrix4f::Identity()`初始化一个单位矩阵, 然后根据上述公式填入对应的值即可

## 透视投影矩阵

参数分别是`eye_fov`, `aspect_ratio`, `zNear`, `zFar`, 分别是视野角, 长宽比, 近裁剪面, 远裁剪面, 要求实现透视投影矩阵

这里的透视投影矩阵不是直接用以下公式计算的:

$$
\begin{bmatrix}
\frac{1}{\tan(\frac{\text{fov}}{2})} & 0 & 0 & 0 \\
0 & \frac{1}{\tan(\frac{\text{fov}}{2})} & 0 & 0 \\
0 & 0 & \frac{z_{\text{far}} + z_{\text{near}}}{z_{\text{near}} - z_{\text{far}}} & \frac{2 \cdot z_{\text{far}} \cdot z_{\text{near}}}{z_{\text{near}} - z_{\text{far}}} \\
0 & 0 & -1 & 0
\end{bmatrix}
$$

而是根据GAME101课程中给出的方法, 先计算正交投影矩阵, 然后通过一个将透视空间(锥体)变换成正交空间(长方体)的矩阵, 将这个矩阵与正交投影矩阵相乘得到透视投影矩阵, 原理见[这里](https://wangsimiao2000.github.io/posts/GAMES101-Lecture04-02)

```cpp
Eigen::Matrix4f get_projection_matrix(float eye_fov, float aspect_ratio,
                                      float zNear, float zFar)
{
    // Students will implement this function

    Eigen::Matrix4f projection = Eigen::Matrix4f::Identity();

    // TODO: Implement this function
    // Create the projection matrix for the given parameters.
    // Then return it.

    float top, bottom, left, right;
	top = zNear * tan(eye_fov / 2.0f);
	bottom = -top;
	right = top * aspect_ratio;
	left = -right;

	// 透视投影矩阵
	// 正交投影矩阵=缩放矩阵dot平移矩阵
	// 透视投影矩阵=正交投影矩阵dot挤压操作矩阵
	Eigen::Matrix4f S_ortho = Eigen::Matrix4f::Identity(); // 缩放矩阵
	S_ortho(0, 0) = 2.0f / (right - left);
	S_ortho(1, 1) = 2.0f / (top - bottom);
	S_ortho(2, 2) = 2.0f / (zNear - zFar);

	Eigen::Matrix4f T_ortho = Eigen::Matrix4f::Identity(); // 平移矩阵
	T_ortho(0, 3) = -(right + left) / 2.0f;
	T_ortho(1, 3) = -(top + bottom) / 2.0f;
	T_ortho(2, 3) = -(zNear + zFar) / 2.0f;

	Eigen::Matrix4f orthoMatrix = Eigen::Matrix4f::Identity(); // 正交投影矩阵
	orthoMatrix = S_ortho * T_ortho;

	Eigen::Matrix4f persp2ortho = Eigen::Matrix4f::Zero(); // 将透视空间转换为正交空间的矩阵
	persp2ortho(0, 0) = zNear;
	persp2ortho(1, 1) = zNear;
	persp2ortho(2, 2) = zNear + zFar;
	persp2ortho(2, 3) = -zNear * zFar;
	persp2ortho(3, 2) = -1;

	// 透视投影矩阵
	projection = orthoMatrix * persp2ortho;

    return projection;
}
```

最后, 运行测试代码, 生成的图片如下:

![GAMES101-Assignment1](/assets/posts/GAMES101-Assignment1/image.png){:width="400px"}

