---
title: C++ 泛型编程 自动推导类型
date: 2024-12-11 16:25:00 +0800
categories: [笔记, C++]
tags: [C++, 泛型编程, auto]
---

## C语言与C++98

在**C语言**和**C++98**中, `auto`关键字用于修饰变量(自动储存的局部变量), 但是默认的局部变量就是自动储存的, 所以`auto`关键字并**没有实际的作用**:
    
```cpp  
    auto int i = 42; // 等价于 int i = 42;
    auto double d = 3.14; // 等价于 double d = 3.14;
```

## C++11

在**C++11**中, `auto`有了全新的含义, 不再用于修饰变量, 而是作为一个类型指示符, 指示编译器在编译时推导`auto`所声明的变量的数据类型:

```cpp
    auto i = 42; // 根据'='右侧的内容将auto推导为 int
    auto d = 3.14; // 根据'='右侧的内容将auto推导为 double
    auto c = "hello"; // 根据'='右侧的内容将auto推导为 const char*
```

- `auto`声明的变量必须在初始化时赋值, 否则编译器无法推导出变量的数据类型
- 初始化的右值可以是具体的数值, 也可以是表达式和函数的返回值等
- `auto`不能作为函数的形参类型(形参: 函数定义时的参数)
- `auto`不能用于定义数组, 因为数组的大小是数组类型的一部分, 编译器无法推导出数组的大小
- `auto`不能定义类的非静态成员变量(非静态成员变量: 一个类的对象的成员变量)

```cpp
string func() {
    return "hello";
}
int main() {
    auto a = 3 + 1; // 右值为表达式, a的类型为int
    auto b = 3.14 + a; // 右值为表达式, b的类型为double
    auto c = "hello"; // 右值为字符串字面值, c的类型为const char*
    auto s = func(); // 右值为函数返回值, s的类型为string
    return 0;
}
```

实际开发中, 以上例子都是在滥用`auto`, 实际上`auto`常用于:
1. 代替冗长复杂的变量声明(例如下方代码)
2. 在模板中, 用于声明依赖于模板参数的变量
3. 函数模板依赖模板参数的返回值
4. 用于lambda表达式

```cpp
double func(int a, double b, const char* c, float d, short e, long f) {
    cout << "a=" << a << ", b=" << b << ", c=" << c << ", d=" << d << ", e=" << e << ", f=" << f << endl;
    return 0.5;
}
int main() {
    // 声明函数指针指向func函数
    double (*p_func)(int, double, const char*, float, short, long);
    p_func = func;
    p_func(1, 2.0, "hello", 3.0f, 4, 5L);

    // 使用auto声明函数指针指向func函数
    auto auto_p_func = func; // auto 会推导 auto_p_func的类型为double (*)(int, double, const char*, float, short, long)
    auto_p_func(1, 2.0, "hello", 3.0f, 4, 5L);

    return 0;
}
```