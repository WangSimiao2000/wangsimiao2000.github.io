---
title: GAMES101 作业2
date: 2024-12-23 20:40:00 +0800
categories: [笔记, GAMES101]
tags: [GAMES101, 光栅化]
math: true
---

实现一个三角形栅格化算法, 能够在屏幕上绘制实心三角形, 并正确处理深度缓冲, 最终实现输出预期的图像.

我的所有GAMES101作业的仓库地址: [GAMES101-Assignments](https://github.com/WangSimiao2000/GAMES101-Assignments)

## 判别点是否在三角形内

常用的方法: 计算顶点与三角形的顶点连线向量与三角形的边的叉乘, 如果三个叉乘的方向都一致, 则该点在三角形内.

```cpp
static bool insideTriangle(int x, int y, const Vector3f* _v)
{   
    // TODO : Implement this function to check if the point (x, y) is inside the triangle represented by _v[0], _v[1], _v[2]

	// 定义三个点ABC以及像素点P
	Eigen::Vector2f P(x, y);
	Eigen::Vector2f A(_v[0].x(), _v[0].y());
	Eigen::Vector2f B(_v[1].x(), _v[1].y());
	Eigen::Vector2f C(_v[2].x(), _v[2].y());

	float AB_AP = (B.x() - A.x()) * (P.y() - A.y()) - (B.y() - A.y()) * (P.x() - A.x()); // AB × AP
	float BC_BP = (C.x() - B.x()) * (P.y() - B.y()) - (C.y() - B.y()) * (P.x() - B.x()); // BC × BP
	float CA_CP = (A.x() - C.x()) * (P.y() - C.y()) - (A.y() - C.y()) * (P.x() - C.x()); // CA × CP

	return ((AB_AP >= 0 && BC_BP >= 0 && CA_CP >= 0) || (AB_AP <= 0 && BC_BP <= 0 && CA_CP <= 0)); // P在三角形内部时，AB × AP、BC × BP、CA × CP的符号应该一致
}
```

## 光栅化

我们先计算三角形的包围盒

```cpp
float x_min = std::min(v[0].x(), std::min(v[1].x(), v[2].x()));
float x_max = std::max(v[0].x(), std::max(v[1].x(), v[2].x()));
float y_min = std::min(v[0].y(), std::min(v[1].y(), v[2].y()));
float y_max = std::max(v[0].y(), std::max(v[1].y(), v[2].y()));
```

然后根据包围盒的范围, 找到整数索引范围, 用`std::floor`和`std::ceil`取整

```cpp
int x_min_int = std::floor(x_min);
int x_max_int = std::ceil(x_max);
int y_min_int = std::floor(y_min);
int y_max_int = std::ceil(y_max);
```

接着遍历包围盒内的像素点, 找到像素中心点, 判断是否在三角形内部:

```cpp
for (int x = x_min_int; x <= x_max_int; x++) {
	for (int y = y_min_int; y <= y_max_int; y++) {
		// 找到像素中心点
		float x_center = x + 0.5;
		float y_center = y + 0.5;
		// 检查是否在三角形内部
		if (insideTriangle(x_center, y_center, t.v)) {
            // TODO
        }
    }
}
```

根据像素点的位置, 计算像素点的深度值(这段代码是给出的, 不需要自己实现):

```cpp
auto[alpha, beta, gamma] = computeBarycentric2D(x, y, t.v);
float w_reciprocal = 1.0/(alpha / v[0].w() + beta / v[1].w() + gamma / v[2].());
float z_interpolated = alpha * v[0].z() / v[0].w() + beta * v[1].z() / v[1].() + gamma * v[2].z() / v[2].w();
z_interpolated *= w_reciprocal; // 当前像素点的深度值
```

深度测试并更新深度缓冲区:

```cpp
// 深度测试并更新深度缓冲区
int index = get_index(x, y); // 获取像素点的索引
if (z_interpolated < depth_buf[index]) { // 深度测试: 如果当前像素点的深度值小深度缓冲区中的深度值
	depth_buf[index] = z_interpolated; // 更新深度缓冲区
	// 设置像素颜色
	set_pixel(Eigen::Vector3f(x, y, 0), t.getColor());
}
```

完整代码:

```cpp
void rst::rasterizer::rasterize_triangle(const Triangle& t) {
    auto v = t.toVector4();
    
    // TODO : Find out the bounding box of current triangle.
    // iterate through the pixel and find if the current pixel is inside the triangle

	// 计算三角形的包围盒(根据三个顶点的坐标的最大值和最小值)
    float x_min = std::min(v[0].x(), std::min(v[1].x(), v[2].x()));
    float x_max = std::max(v[0].x(), std::max(v[1].x(), v[2].x()));
    float y_min = std::min(v[0].y(), std::min(v[1].y(), v[2].y()));
    float y_max = std::max(v[0].y(), std::max(v[1].y(), v[2].y()));


	// 根据包围盒的范围, 找到整数索引范围, 用std::floor和std::ceil取整
	int x_min_int = std::floor(x_min);
	int x_max_int = std::ceil(x_max);
	int y_min_int = std::floor(y_min);
	int y_max_int = std::ceil(y_max);

    // If so, use the following code to get the interpolated z value.
    //auto[alpha, beta, gamma] = computeBarycentric2D(x, y, t.v);
    //float w_reciprocal = 1.0/(alpha / v[0].w() + beta / v[1].w() + gamma / v[2].w());
    //float z_interpolated = alpha * v[0].z() / v[0].w() + beta * v[1].z() / v[1].w() + gamma * v[2].z() / v[2].w();
    //z_interpolated *= w_reciprocal;

    // TODO : set the current pixel (use the set_pixel function) to the color of the triangle (use getColor function) if it should be painted.

	// 遍历包围盒内的像素点, 判断是否在三角形内部
	for (int x = x_min_int; x <= x_max_int; x++) {
		for (int y = y_min_int; y <= y_max_int; y++) {
			// 找到像素中心点
			float x_center = x + 0.5;
			float y_center = y + 0.5;

			// 检查是否在三角形内部
			if (insideTriangle(x_center, y_center, t.v)) {

				// 如果在三角形内部, 则计算像素点的深度值
                auto[alpha, beta, gamma] = computeBarycentric2D(x, y, t.v);
                float w_reciprocal = 1.0/(alpha / v[0].w() + beta / v[1].w() + gamma / v[2].w());
                float z_interpolated = alpha * v[0].z() / v[0].w() + beta * v[1].z() / v[1].w() + gamma * v[2].z() / v[2].w();
				z_interpolated *= w_reciprocal; // 当前像素点的深度值

				// 深度测试并更新深度缓冲区
				int index = get_index(x, y); // 获取像素点的索引
				if (z_interpolated < depth_buf[index]) { // 深度测试: 如果当前像素点的深度值小于深度缓冲区中的深度值
					depth_buf[index] = z_interpolated; // 更新深度缓冲区

					// 设置像素颜色
					set_pixel(Eigen::Vector3f(x, y, 0), t.getColor());
				}
			}
		}
	}    
}
```

## 渲染结果

渲染结果是两个三角形的叠加, 一个是浅绿色, 一个是浅蓝色:

![GAMES101-Assignment2](/assets/posts/GAMES101-Assignment2/01.png){:width="500px"}

当然, 和上次作业也一样, 需要将"opencv world4100d.dll"文件放到项目的Debug目录下, 或者设置它的环境变量, 否则会报错: `将由于找不到 opencv world4100d.dll，无法继续执行代码。重新安装程序可能会解决此问题`