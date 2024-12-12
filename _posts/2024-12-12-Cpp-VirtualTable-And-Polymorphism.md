---
title: C++ 虚函数表与多态
date: 2024-12-12 13:20:00 +0800
categories: [笔记, C++]
tags: [C++, 虚函数, 虚函数表, 多态]
---

## 虚函数表指针

虚函数引入后类的变化

```cpp
class A {};
A a;
cout << sizeof(a) << endl; // 输出对象的大小是1
```

一个空类, 只要对象占用内存空间, 那么这个类的大小至少是1;

```cpp
class A {
    void func1() {}
    void func2() {}
};
A a;
cout << sizeof(a) << endl; // 输出对象的大小仍然是1
```

类A的普通成员函数并不会占用类对象的内存空间, 所以类A的大小仍然是1;

```cpp
class A {
    virtual void func1() {}
};
A a;
cout << sizeof(a) << endl; // 输出对象的大小是4 (Visual Studio解决方案中的×86平台, Linux平台GCC编译的结果可能是8)
```

当一个或多个虚函数加入到类中后, 编译器会向类中插入一个看不见的成员变量, 这个成员变量类似下方的伪代码形式:

```cpp
class A {
    void* vptr; // 虚函数表指针(Virtual Table Pointer)
    virtual void func1() {}
};
```

也就是说, 编译器给类中加入的**虚函数表指针(Virtual Table Pointer)**, 它的大小正好是4个字节(32位系统), 这4个字节是占用类对象的内存空间的;

## 虚函数表

```cpp
class A {
    void func1() {}
    void func2() {}
    virtual void vfunc() {}
};
```

当类A中存在至少一个虚函数时, 编译器就会给类A生成一个**虚函数表(Virtual Table)**, 这个虚函数表会一直伴随着类A的对象存在;

通过编译链接后生成一个可执行文件之后, 类A和伴随类A的虚函数表会被保存到可执行文件中, 在这个可执行文件执行时, 伴随类A的虚函数表也会被加载到内存中;

## 虚函数表指针被赋值的时机

- **虚函数表指针(vptr)**: 类中有虚函数的时候, 编译器会在类中插入一个虚函数表指针;
- **虚函数表(vtbl)**: 类中有虚函数的时候, 编译器会生成一个虚函数表;

```cpp
class A {
    virtual void vfunc() {}
};
```

对于有虚函数的类A, 在编译时, 编译器会向类A的构造函数中(如果没有构造函数, 编译器则会创建一个构造函数), 安插为`vptr`赋值的代码, 伪代码如下:

```cpp
class A {
    void* vptr; // 虚函数表指针
    virtual void vfunc() {}
    A() { // 类A的构造函数
        vptr = &A::vtable; // 为vptr赋值, 使得vptr指向类A的虚函数表vtbl
    }
};
```

创建类A的对象时, 会调用类A的构造函数, 在构造函数中会为`vptr`赋值, 使得`vptr`指向类A的虚函数表;

## 类对象在内存中的布局

```cpp
class A {
public:
    void func1() {} // 普通成员函数1
    void func2() {} // 普通成员函数2
    virtual void vfunc1() {} // 虚函数1
    virtual void vfunc2() {} // 虚函数2
    virtual ~A() {} // 虚析构函数
private:
    int a; // 成员变量
    int b;
};
```

此时生成了类A对象后, 类A对象在内存中的布局如下:

![类A对象在内存中的布局](/assets/posts/Cpp-VirtualTable-And-Polymorphism/01.png){:width="700px"}

函数的普通成员函数`func1`和`func2`不会占用类对象的内存空间;

所以, 这个类A的对象占用的内存空间大小是`4(虚函数指针) + 4(int a;) + 4(int b;) = 12`字节

## 虚函数的工作原理及多态性的体现

### 多态性(动态多态)

- **静态多态**: 函数重载: 同一个类中, 函数名相同, 参数列表不同, 有种说法是**函数重载不算多态**
- **动态多态**: 虚函数: 父类指针指向子类对象, 调用虚函数时, 会调用子类的虚函数

通过**父类指针new一个子类对象**或通过**父类引用绑定一个子类对象**的时候

如果用父类指针来调用虚函数, 那么会调用子类的虚函数

#### 代码实现上的多态

```cpp
class A {
public:
    virtual void vfunc() {}
    A() { 
        vptr = &A::vtbl;
    }
};
```

如果是通过`vptr`来找到虚函数表指针`vtbl`, 再通过查询虚函数表指针`vtbl`找到虚函数表的入口地址, 并去执行虚函数`vfunc`, 这就被称之为**多态**

例子:

```cpp
class Base {
public:
    virtual void vfunc() {}
};
Base* pa = new Base();
pa->vfunc(); // 是多态

Base base;
base.vfunc(); // 不是多态

Base* ybase = &base;
ybase->vfunc(); // 是多态
```

#### 表现形式上的多态

1. 程序中既要存在父类也要存在子类, 父类中必须要有虚函数, 子类中必须要重写父类的虚函数
2. 父类指针要指向子类对象或者父类引用要绑定(指向)子类对象
3. 通过父类指针或引用, 调用子类中重写的虚函数

```cpp
class Derive : public Base {
public:
    virtual void vfunc() {} // Derive类重写了Base类的虚函数vfunc
};
Derive derive;
Base* pbase = &derive; // 父类指针指向子类对象
pbase->vfunc(); // 是多态：通过父类指针调用虚函数，实际调用的是子类的vfunc

Base& pbase2 = *new Derive(); // 父类引用绑定子类对象, 注意自行delete释放内存
pbase2.vfunc(); // 是多态：通过父类引用调用虚函数，实际调用的是子类的vfunc

Derive derive2;
Base& yinbase = derive2; // 父类引用绑定子类对象
yinbase.vfunc(); // 是多态：通过父类引用调用虚函数，实际调用的是子类的vfunc

```