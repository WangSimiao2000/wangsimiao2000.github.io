---
title: C++ 泛型编程 类模板(基础内容)
date: 2024-12-11 18:30:00 +0800
categories: [笔记, C++]
tags: [C++, 泛型编程, 类模板]
---

## 基本概念

**函数模板**是通用的函数描述, 使用任意类型(泛型)来描述函数

**类模板**是通用的类描述, 使用任意类型(泛型)来描述类

在程序中, 使用具体的数据类型, 让编译器根据类模板生成具体的类定义

## 实际应用

```cpp
template <class T1, class T2>
class TemplateClass {
public:
    T1 data1; // 通用类型用于定义类成员
    T2 data2; // 通用类型用于定义类成员

    // 默认构造函数
    TemplateClass() {}

    // 通用类型用于成员函数的参数
    TemplateClass(T1 d1, T2 d2) : data1(d1), data2(d2) {}

    // 通用类型用于成员函数的返回值
    T1 getData1() {
        return data1;
    }

    // 通用类型用于成员函数的返回值
    void setData1(T1 d1) {
        data1 = d1;
    }
};
int main(){
    TemplateClass<int,double> obj; // 用模板类TemplateClass创建对象obj
    obj.data1 = 10;
    cout << obj.getData1() << endl;
    obj.setData1(100);
    cout << obj.getData1() << endl;
}
```

## 注意事项

1. 在创建对象的时候, 必须指明具体的数据类型
2. 使用类模板时, 数据类型必须适应类模板中的代码

```cpp
template <class T1, class T2>
class TemplateClass {
public:
    T1 data1;
    T2 data2;
    TemplateClass() {}
    TemplateClass(T1 d1, T2 d2) : data1(d1), data2(d2) {}
    
    T2 func() {
        return data2;
    }
};
int main(){
    TemplateClass<int,string> obj; // 第二个参数改成string
    obj.data2 = "Hello";
    cout << obj.func() << endl; // 输出Hello, 因为data2的数据类型是string
} 
```

3. 类模板可以为通用参数指定缺省的数据类型(C++11中的函数模板也可以)

```cpp
template <class T1 = int, class T2 = double> // 为通用参数指定缺省的数据类型
class TemplateClass {
public:
    T1 data1;
    T2 data2;
    TemplateClass() {}
    TemplateClass(T1 d1, T2 d2) : data1(d1), data2(d2) {}
};
int main(){
    TemplateClass<int> obj; // 这里只指定了一个数据类型, 没有指定第二个数据类型, 如果模板类处没有指定缺省的数据类型, 则会报错
    obj.data1 = 10;
    obj.data2 = 3.14; // 这里使用了缺省的数据类型
}
```

4. 类成员函数可以在类外实现(类外不能指定默认的模板参数, 如: `template <class T1 = int, class T2 = double>`, 这是因为类外实现的时候, 编译器无法知道模板参数的具体类型)

```cpp
template <class T1, class T2>
class TemplateClass {
public:
    T1 data1;
    T2 data2;
    TemplateClass() {}
    TemplateClass(T1 d1, T2 d2) : data1(d1), data2(d2) {}
    T1 getData1();
    void setData1(T1 d1);
};
// 类外实现
template <class T1, class T2>
T1 TemplateClass<T1, T2>::getData1() {
    return data1;
}
// 类外实现
template <class T1, class T2>
void TemplateClass<T1, T2>::setData1(T1 d1) {
    data1 = d1;
}

int main(){
    TemplateClass<int,double> obj;
    obj.data1 = 10;
    cout << obj.getData1() << endl;
    obj.setData1(100);
    cout << obj.getData1() << endl;
}
```

5. 可以用new创建模板对象

```cpp
int main() {
    TemplateClass<int, double> *obj = new TemplateClass<int, double>; // 默认构造函数创建对象
    obj->data1 = 10;
    obj->data2 = 3.14;
    delete obj;
    TemplateClass<int, double> *obj2 = new TemplateClass<int, double>(10, 3.14); // 有参构造函数创建对象
}
```

6. 在程序中, 模板类的成员函数使用了才会创建, 如果没有使用, 则不会创建

```cpp
int main() {
    TemplateClass<int, double> *obj;//这里只是声明了一个指针, 没有创建对象, 所以不会使用构造函数
}