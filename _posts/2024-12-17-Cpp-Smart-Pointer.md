---
title: C++ 智能指针
date: 2024-12-17 15:10:00 +0800
categories: [笔记, C++]
tags: [C++, 智能指针]
---

## 指针

**普通的指针**: 指向某个内存区域的地址变量

- 如果一个指针指向的内存是动态分配的, 那么即使这个指针离开了所在的作用域, 这块内存也不会被自动释放, 从而导致**内存泄漏**.
- 如果一个指针指向的是一个已经被释放的内存区域, 那么这个指针就是一个**悬空指针**, 使用悬空指针会导致不可预知的错误.
- 如果定义了一个指针却没有初始化, 那么这个指针就是一个**野指针**, 使用野指针访问内存一般会造成`segmentation fault`报错.

```cpp
int *p = new int(10); // 动态分配内存
delete p; // 释放内存
p = nullptr; // 防止成为悬空指针
```

## 智能指针

智能指针是一个封装了动态对象的类对象, 离开作用域后会自动销毁, 销毁过程会调用析构函数来删除所封装的对象.

在标准模板库中, 提供了三种智能指针: `std::unique_ptr`, `std::shared_ptr`, `std::weak_ptr`.

### unique_ptr

```cpp
template <
    class T, // T是所封装的动态分配的对象的类型
    class Deleter = std::default_delete<T> // 释放它所封装的对象时使用的方法
> class unique_ptr;
```

`unique_ptr`还有一个针对动态数组的版本`std::unique_ptr<T[]>`.

```cpp
template <
    class T, 
    class Deleter
> class unique_ptr<T[], Deleter>;
```

`unique_ptr`的常用函数:

- `T* get()`: 获得所管理对象的指针
- `T* operator->()`: 调用了`get()`函数, 返回所管理对象的指针, 这样可以使用`->`操作符来访问所管理对象的成员
- `T& operator*()`: 返回所管理对象的引用, 相当于`*get()`
- `T* release()`: 接触对所封装对象的管理, 返回对象的指针, 之后该指针就脱离了`unique_ptr`的管理, 需要主动释放
- `void reset(T* newObject);`: 删除掉原有的对象, 接管新的对象
- `void swap(unique_ptr<T>& other);`: 与其他`unique_ptr`交换所管理的对象

`unique_ptr`与它所管理的动态对象是一对一的关系, 也就是不能有两个`unique_ptr`对象指向同一个地址

创建一个`unique_ptr`对象的方法是:

```cpp
unique_ptr<A> ptr1(new A(参数));
```

```cpp
unique_ptr<A> ptr1 = make_unique<A>(参数);
```

由于`unique_ptr`的特殊性, 不能被拷贝:

```cpp
unique_ptr<T> p2 = p1; // 编译报错, unique_ptr类中删除了拷贝构造函数
```

但是可以用`move()`函数进行控制权转移:

```cpp
unique_ptr<T> p2 = move(p1); // 此后, p1只包含了一个空指针, p2拥有原来p1的指针的控制权
cout << p1 << endl; // 这里可能出现`segmentation fault`报错, 因为p1是空指针
```

### shared_ptr

### weak_ptr
