---
title: GAMES101 作业3
date: 2024-12-26 20:40:00 +0800
categories: [笔记, GAMES101]
tags: [GAMES101, 着色]
---

本次作业要求实现一个简单的光栅化渲染器, 实现法向量、颜色、纹理颜色的插值, 实现 Blinn-Phong 模型, 实现高度图以及置换映射

我的所有GAMES101作业的仓库地址: [GAMES101-Assignments](https://github.com/WangSimiao2000/GAMES101-Assignments)

## 实现法向量、颜色、纹理颜色的插值

修改rasterizer.cpp中的函数rasterize_triangle(const Triangle& t) : 在此处实现与作业2类似的插值算法, 实现法向量、颜色、纹理颜色的插值

```cpp
//屏幕空间光栅化
void rst::rasterizer::rasterize_triangle(const Triangle& t, const std::array<Eigen::Vector3f, 3>& view_pos)
{
    // TODO: 从你的HW3中获取三角形光栅化代码。
    auto v = t.v;

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

    // 遍历包围盒内的像素点, 判断是否在三角形内部
    for (int x = x_min_int; x <= x_max_int; x++) {
        for (int y = y_min_int; y <= y_max_int; y++) {
            // 找到像素中心点
            float x_center = x + 0.5;
            float y_center = y + 0.5;

            // 检查是否在三角形内部
            if (!insideTriangle(x_center, y_center, t.v)) {
                continue;                
            }
            // 计算重心坐标
            auto [alpha, beta, gamma] = computeBarycentric2D(x_center, y_center, t.v);

            // TODO: 在光栅化循环中:
            //    * v[i].w() 是顶点视图空间中的深度值 z。
            //    * Z 是当前像素的插值后视图空间深度。
            //    * zp 是位于 zNear 和 zFar 之间的深度，用于 z 缓冲。

            // float Z = 1.0 / (alpha / v[0].w() + beta / v[1].w() + gamma / v[2].w());
            // float zp = alpha * v[0].z() / v[0].w() + beta * v[1].z() / v[1].w() + gamma * v[2].z() / v[2].w();
            // zp *= Z;

            // 计算深度值
            float Z = 1.0 / (alpha / v[0].w() + beta / v[1].w() + gamma / v[2].w());
            float zp = alpha * v[0].z() / v[0].w() + beta * v[1].z() / v[1].w() + gamma * v[2].z() / v[2].w();
            zp *= Z;

            // 深度测试
            int index = get_index(x, y); // 获取像素点的索引
            if (zp >= depth_buf[index]) { // 深度测试: 如果当前像素点的深度值小于深度缓冲区中的深度值
                continue;
            }

            // 更新深度缓冲区
            depth_buf[index] = zp;

            // TODO: 插值属性：
            // auto interpolated_color
            // auto interpolated_normal
            // auto interpolated_texcoords
            // auto interpolated_shadingcoords

            auto interpolated_color = interpolate(alpha, beta, gamma, t.color[0], t.color[1], t.color[2], 1); // 插值颜色
            auto interpolated_normal = interpolate(alpha, beta, gamma, t.normal[0], t.normal[1], t.normal[2], 1); // 插值法线
            auto interpolated_texcoords = interpolate(alpha, beta, gamma, t.tex_coords[0], t.tex_coords[1], t.tex_coords[2], 1); // 插值纹理坐标
            auto interpolated_shadingcoords = interpolate(alpha, beta, gamma, view_pos[0], view_pos[1], view_pos[2], 1); // 插值视图空间坐标

            // 使用: fragment_shader_payload payload( interpolated_color, interpolated_normal.normalized(), interpolated_texcoords, texture ? &*texture : nullptr);
            // 使用: payload.view_pos = interpolated_shadingcoords;
            // 使用: 不要直接将三角形的颜色传递给帧缓冲区，而是先将颜色传递给着色器以获取最终颜色；
            // 使用: auto pixel_color = fragment_shader(payload);

            // // 构造片段着色器所需的 payload(片段着色器的输入)
            fragment_shader_payload payload(
                interpolated_color,
                interpolated_normal.normalized(), // 法线需要归一化
                interpolated_texcoords,
                texture ? &*texture : nullptr // 如果有纹理则需要传递, 没有则是 nullptr
            );
            payload.view_pos = interpolated_shadingcoords; // 视图空间坐标

            // 调用片段着色器
            auto pixel_color = fragment_shader(payload);

            // 将像素颜色存储到帧缓冲区
            set_pixel(Eigen::Vector2i(x, y), pixel_color);
        }
    }
}
```

