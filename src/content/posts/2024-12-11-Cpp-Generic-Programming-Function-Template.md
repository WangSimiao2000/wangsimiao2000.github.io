---
title: C++ 泛型编程 函数模板
date: 2024-12-11 17:20:00 +0800
categories: [笔记, C++]
tags: [C++, 泛型编程, 函数模板]
---

如果要编写一个函数, 用于交换两个变量的值, 传统的方法是使用指针:

```cpp
void funcSwap(int& a, int& b) {
    int temp = a;
    a = b;
    b = temp;
}
void funcSwap(double& a, double& b) {
    double temp = a;
    a = b;
    b = temp;
}
void funcSwap(char& a, char& b) {
    char temp = a;
    a = b;
    b = temp;
}
......
```

这种方法的缺点是, 每次交换不同类型的变量时, 都需要重新编写一个函数, 代码冗余, 且不易维护

函数模板可以解决这个问题, 通过函数模板, 可以编写一个通用的函数, 用于交换任意类型的变量

## 基本概念

**函数模板**就是通用的函数描述, 使用任意类型(泛型)来描述函数

编译的时候, 编译器推导实参的数据类型, 根据实参的数据类型和函数模板, 生成该类型的函数定义

生成函数定义的过程叫做函数模板的**实例化**

## 实际应用

创建交换两个变量的函数模板:

**C++98**添加了关键字`typename`, 用于声明函数模板:

```cpp
template <typename T>
void funcSwap(T &a, T &b) {
    T temp = a;
    a = b;
    b = temp;
}
int main() {
    int a = 10, b = 20;
    funcSwap(a, b); // 根据参数类型生成函数定义: funcSwap(int &a, int &b)
    cout << "a=" << a << ", b=" << b << endl;
}
```

如果声明了函数模板之后, 需要在代码中手动指定模板参数类型, 也可以使用`<>`来指定:

```cpp
int main() {
    double a = 10.5, b = 20.5;
    funcSwap<double>(a, b); // 根据手动指定的参数类型生成函数定义: funcSwap(double &a, double &b)
    cout << "a=" << a << ", b=" << b << endl;
}
```

这里如果传入的参数是不同类型的变量(如`int`类型), 编译器会报错, 因为函数模板的参数类型已经被手动指定了, 无法推导出实参的类型

## 注意事项

1. 定义函数模板时, 必须使用`template`关键字声明, 并在`template`后面使用`<typename T>`声明模板参数, 每次定义函数模板时, 都需要声明模板参数

```cpp
template <typename T>
void funcA(T a) {
    cout << a << endl;
}
template <typename T>
void funcB(T a, T b) {
    cout << a+b << endl;
}
template <typename T>
void funcC(T a, T b, T c) {
    cout << a+b+c << endl;
}
```

2. 可以为类的成员函数创建模板, 但不能是虚函数和析构函数

```cpp
class Test {
public:
    template <typename T>
    void func(T a) {
        cout << a << endl;
    }
    template <typename T>
    virtual void func(T a) { // 错误: 不能为虚函数创建模板
        cout << a << endl;
    }
    template <typename T>
    ~Test() { // 错误: 不能为析构函数创建模板
        cout << "析构函数" << endl;
    }
};
```

3. 使用函数模板时, 必须明确数据类型, 确保实参与模板参数能够匹配(类似函数重载)

```cpp
template <typename T>
void funcSwap(T &a, T &b) {
    T temp = a;
    a = b;
    b = temp;
}
int main() {
    int a = 10;
    double b = 20.5;
    funcSwap(a, b); // 错误: 无法推导出模板参数类型, 模板参数不明确
}
```

4. 使用函数模板时, 推导的数据类型必须适应函数模板中的代码

```cpp
template <typename T>
T funcAdd(T a, T b) {
    return a + b;
}
class Test {};
int main() {
    int a = 10;
    int b = 20;
    cout << funcAdd(a, b) << endl; // 输出: 30

    string c = "hello";
    string d = "world";
    cout << funcAdd(e, f) << endl; // 输出: helloworld

    Test e;
    Test f;
    cout << funcAdd(g, h) << endl; // 错误: 无法推导出模板参数类型, 模板参数不明确

}
```

5. 使用函数模板时, 如果是自动类型推导, 不会发生隐式类型转换, 如果显示指定了函数模板的参数类型, 则会发生隐式类型转换

```cpp
template <typename T>
T funcAdd(T a, T b) {
    return a + b;
}
int main() {
    int a = 10;
    double b = 20.5;
    cout << funcAdd(a, b) << endl; // 错误: 无法推导出模板参数类型, 模板参数不明确
    cout << funcAdd<int>(a, b) << endl; // 输出: 30
}
```

6. 函数模板支持多个通用数据类型的参数

```cpp
template <typename T1, typename T2>
void funcSwap(T1 &a, T2 &b) {
    T1 temp = a;
    a = b;
    b = temp;
}
int main(){
    int a = 10;
    double b = 20.5;
    funcSwap(a, b); // 根据参数类型生成函数定义: funcSwap(int &a, double &b)
    cout << "a=" << a << ", b=" << b << endl;
}
```

7. 函数模板支持重载, 可以有非通用数据类型的参数

```cpp
template <typename T>
void func(T a) {
    cout << a << endl;
}
template <typename T1, typename T2>
void func(T1 a, T2 b) {
    cout << a << " " << b << endl;
}
template <typename T1, typename T2>
void func(T1 a, T2 b, int c) {
    cout << a << " " << b << " " << c << endl;
}
int main() {
    func(10); // 输出: 10
    func(10, 20.5); // 输出: 10 20.5
    func(10, 20.5, 30); // 输出: 10 20.5 30
}
```

## 函数模板的具体化

为了满足特殊需求, 可以提供一个具体化的函数定义, 当编译器找到与函数调用匹配的具体化定义时, 将使用该定义, 不在寻找通用的函数模板

这种方法叫做函数模板的**具体化**, 也叫**特化**或**特例化**

```cpp
class Student {
public:
    string name;
    int id;
    int rank;
};
template <typename T>
void funcSwap(T &a, T &b) {
    T temp = a;
    a = b;
    b = temp;
}
template <> void funcSwap<Student>(Student &a, Student &b) {
// template <> void funcSwap(Student &a, Student &b) { // 也可以省略模板参数
    int temp = a.id;
    a.id = b.id;
    b.id = temp;
}
int main() {
    int a - 10, b = 20;
    funcSwap(a, b); // 根据参数类型生成函数定义: funcSwap(int &a, int &b)
    cout << "a=" << a << ", b=" << b << endl;
    Student s1, s2;
    s1.id = 1;
    s2.id = 2;
    funcSwap(s1, s2); // 根据参数类型生成函数定义: funcSwap(Student &a, Student &b)
    cout << "s1.id=" << s1.id << ", s2.id=" << s2.id << endl;
}
```

## 优先级

1. **具体化**优先级高于**常规模板**, **普通函数**优先于**具体化**和**常规模板**
2. 如果希望使用**常规模板**, 但是传入的参数类型与**具体化**匹配, 可以用空模板参数强制使用**常规模板**(空模板参数: `<>`)
3. 如果函数模板能产生更好的匹配, 则将优先于非模板函数