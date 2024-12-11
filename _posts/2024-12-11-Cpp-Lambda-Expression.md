---
title: C++ Lambda表达式
date: 2024-12-11 22:30:00 +0800
categories: [笔记, C++]
tags: [C++, Lambda表达式]
---

## Lambda表达式

Lambda表达式是C++11引入的新特性，用于创建匿名函数

## 排序中使用Lambda表达式

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v = {0, 11, 3, 19, 22, 7, 1, 5};
    auto f = [](int a, int b) { 
        return a < b; // 按照升序排序
    };
    sort(v.begin(), v.end(), f); // 第三个参数就是匿名函数
    return 0;
}
```

## Lambda表达式的语法

```cpp
[OuterVar](int x, int y) -> int {
    return x + y + OuterVar;
}
```
- **OuterVar**: 捕获变量或者为空
- **(int x, int y)**: 参数列表
- **-> int**: 返回值类型
- **{...}**: 函数体

```cpp
auto f = [](int x, int y) -> int {
    return x + y;
};
```

以上代码中的返回值类型可以省略，编译器会自动推断, 等价于:

```cpp
auto f = [](int x, int y) {
    return x + y;
};
```

## 捕获变量

Lambda表达式的方括号内的部分称为捕获列表，用于捕获外部变量

```cpp
int N = 100, M = 10;
auto g = [N, &M](int x) {
    M = 20; // M是引用传递，可以修改
    return x * N;
};
cout << g(10) << endl; // 输出:1000
cout << M << endl; // 输出:20
```

- N: 传入的是外部变量的值，不可修改
- &M: 传入的是外部变量的引用，可以修改
- x: 传入的是匿名函数的参数

如果在捕获列表中只使用引用符号`&`，则表示捕获所有外部变量的引用

```cpp
int N = 100, M = 10;
auto g = [&]() {
    M = 20; // M是引用传递，可以修改
    N = 200; // N是引用传递，可以修改
};
g();
cout << M << endl; // 输出:20
cout << N << endl; // 输出:200
```

如果在捕获列表中只使用等号`=`，则表示捕获所有外部变量的值

```cpp
int N = 100, M = 10;
auto g = [=]() {
    // M = 20; // 错误，M是值传递，不可修改
    // N = 200; // 错误，N是值传递，不可修改
};
g();
```

如果写成`[=, &M]`，则表示捕获所有外部变量的值，但是M是引用传递

如果写成`[&, =N]`，则表示捕获所有外部变量的引用，但是N是值传递

如果在某个class中使用Lambda表达式，可以使用`this`指针捕获当前实例的指针

```cpp
class A {
public:
    void f() {
        auto g = [this]() {
            cout << x << endl;
        };
        g();
    }
private:
    int x = 10;
};
```

在C++17之后, 可以用`[*this]`捕获当前实例的值

在C++14之后, 可以在捕获语句中定义变量, 例如`[x = 10]`

## 参数列表

C++14之后, 参数列表支持`auto`关键字

```cpp
auto f = [](auto x, auto y) {
    return x + y;
};
cout << f(1, 2) << endl; // 输出:3
cout << f(1.1, 2.2) << endl; // 输出:3.3
```
