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

### shared_ptr与weak_ptr

#### shared_ptr

与`unique_ptr`不同, 多个`shared_ptr`对象可以共同管理同一个指针, 他们通过共同的一个**引用计数器**来管理所管理对象的生命周期.

`unique_ptr`的常用函数:

- `T* get()`: 获得所管理对象的指针
- `T* operator->()`: 调用了`get()`函数, 返回所管理对象的指针, 这样可以使用`->`操作符来访问所管理对象的成员
- `T& operator*()`: 返回所管理对象的引用, 相当于`*get()`
- `void reset(T* newObject)`: 删除掉原有的对象, 释放内存
- `void swap(shared_ptr<T>& other)`: 与其他`shared_ptr`交换所管理的对象
- `operator bool()`: 判断`shared_ptr`是否为空
- ~~`T* release()`~~: `shared_ptr`没有`release()`函数, 因为`shared_ptr`是共享的, 不能直接释放内存
- `long use_count()`: 返回当前有多少个`shared_ptr`对象共享这个对象
- `bool unique()`: 判断当前是否只有一个`shared_ptr`对象共享这个对象

创建一个`shared_ptr`对象的方法是:

```cpp
shared_ptr<T> make_shared<T>(参数);
```

也可以:

```cpp
shared_ptr<T> ptr1(new T(参数));
```

举例:

```cpp
int main() {
    using std::shared_ptr; // 使用std命名空间中的shared_ptr
    shared_ptr<int> p1(new int(10)); // 创建一个shared_ptr对象, 指向一个int类型的对象
    shared_ptr<int> p2 = p1; // p2和p1共享同一个int类型的对象, p2=p1是赋值操作
    shared_ptr<int> p3(p2); // p3和p2共享同一个int类型的对象, p3(p2)是拷贝构造函数的调用
    cout << p1.use_count() << endl; // 输出3, 有3个shared_ptr对象共享这个int类型的对象
}
```

`shared_ptr`提供了几种辅助函数, 用于对封装指针类型的静态转换, 动态转换以及常量转换:
- `dynamic_pointer_cast`: 用于动态转换
- `static_pointer_cast`: 用于静态转换
- `const_pointer_cast`: 用于常量转换

```cpp
#include <memory>
#include <iostream>
using namespace std;
class Base{ // 多态基类 Base
public:
    virtual ~Base() {}
};
class Derived: public Base{}; // 多态派生类 Derived
int main() {
    shared_ptr<Base> sp1(new Derived()); // sp1是封装的的基类Base的指针, 指向派生类Derived的对象
    shared_ptr<Derived> sp2 = dynamic_pointer_cast<Derived>(sp1); // 将sp1复制转换成了sp2, sp2是封装的派生类Derived的指针
    shared_ptr<Base> sp3 = static_pointer_cast<Base>(sp2); // 将sp2复制转换成了sp3, sp3是封装的基类Base的指针
    cout << sp1.use_count() << endl; // 输出3
}
```

在使用`shared_ptr`时, 有可能出现**循环引用**的问题, 例如:

```cpp
class Person {
public:
    Person(const string& name):_name(name) {cout << _name << " constructed" << endl;} // 构造函数, 输出名字
    ~Person() {cout << _name << " destructed" << endl;} // 析构函数, 输出名字
    void setPartner(const shared_ptr<Person> partner) { _partner = partner; } // 设置伙伴
private:
    string _name; // 名字
    shared_ptr<Person> _partner; // 伙伴
};
int main() {
    vector<shared_ptr<Person>> persons; // 用于存放shared_ptr<Person>对象的vector
    persons.push_back(shared_ptr<Person>(new Person("张三"))); // 创建一个shared_ptr<Person>对象, 指向一个Person对象
    persons.push_back(shared_ptr<Person>(new Person("李四")));
    persons.push_back(shared_ptr<Person>(new Person("王五")));
    persons[0]->setPartner(persons[1]); // 设置伙伴
    persons[1]->setPartner(persons[2]);
    persons[2]->setPartner(persons[0]);
    return 0;
}
```

这种情况下, 三个`shared_ptr`的引用计数器的值都是2, 当`persons`这个vector销毁时, 三个`shared_ptr`对象的引用计数器的值都会减1, 但是由于三个`shared_ptr`对象的引用计数器的值都是1, 所以它们不会被销毁, 从而导致内存泄漏, 输出的结果是:

```bash
张三 constructed
李四 constructed
王五 constructed
```

为了避免出现内存泄漏, 要么在使用`shared_ptr`时避免出现循环引用, 要么使用`weak_ptr`.

#### weak_ptr

同上述的例子, 可以使用`weak_ptr`来解决循环引用的问题:

```cpp
class Person {
public:
    Person(const string& name):_name(name) {cout << _name << " constructed" << endl;}
    ~Person() {cout << _name << " destructed" << endl;}
    void setPartner(const shared_ptr<Person> partner) { _partner = partner; }
private:
    string _name;
    weak_ptr<Person> _partner; // 这里改用weak_ptr来存放伙伴
};
int main() {
    vector<shared_ptr<Person>> persons;
    persons.push_back(shared_ptr<Person>(new Person("张三")));
    persons.push_back(shared_ptr<Person>(new Person("李四")));
    persons.push_back(shared_ptr<Person>(new Person("王五")));
    persons[0]->setPartner(persons[1]);
    persons[1]->setPartner(persons[2]);
    persons[2]->setPartner(persons[0]);
    return 0;
}
```

这样, 当`persons`离开作用域(即`main`函数return 0)时, `persons`被销毁, 它所包含的三个对象也会被自动销毁, 从而避免了内存泄漏.

```bash
张三 constructed
李四 constructed
王五 constructed
张三 destructed
李四 destructed
王五 destructed
```

`weak_ptr`不能单独使用, 而是需要结合`shared_ptr`使用, `weak_ptr`对象可以将`shared_ptr`对象作为构造函数的参数, 也可以定义一个空的`weak_ptr`对象, 之后再将`shared_ptr`对象赋值给它:

```cpp
int main(){
    shared_ptr<A> sp1 = make_shared<A>();
    weak_ptr<A> wp1(sp1); // 将sp1作为构造函数的参数
    weak_ptr<A> wp2; // 定义一个空的weak_ptr对象
    wp2 = sp1; // 将sp1赋值给wp2

    cout << wp2.use_count() << endl; // 输出1
}
```

`weak_ptr`只会对`shared_ptr`所管理的对象进行观测, 不会改变对象的引用计数, 例如:

```cpp
class Rectangle;
int main() {
    weak_ptr<Rectangle> wp; // 定义一个weak_ptr对象
    {
        shared_ptr<Rectangle> sp1(new Rectangle(10, 20)); // 创建一个shared_ptr对象, 指向一个Rectangle对象
        shared_ptr<Rectangle> sp2 = sp1; // sp2和sp1共享同一个Rectangle对象
        wp = sp2; // 将sp2赋值给wp
        cout << "作用域内的引用计数: " << wp.use_count() << endl; // 在作用域内打印出wp的引用计数, 输出2
    }
    cout << "作用域外的引用计数: " << wp.use_count() << endl; // 在作用域外打印出wp的引用计数, 输出0
    cout << "expired: " << wp.expired() << endl; // expired()函数用于判断所观测的shared_ptr对象是否已经被销毋, 输出1, 说明Rectangle对象已经被销毁
}
```

我们可以对`weak_ptr`对象调用`lock()`函数, 从而获得一个`shared_ptr`对象, 用于获得封装对象的控制权:

```cpp
class Rectangle;
int main(void) {
    weak_ptr<Rectangle> wp;
    {
        shared_ptr<Rectangle> sp1(new Rectangle(10, 20));
        shared_ptr<Rectangle> sp2 = sp1;
        wp = sp2;
        shared_ptr<Rectangle> sp3 = wp.lock(); // 获得一个shared_ptr对象
        cout << "作用域内sp3的值:" << sp3 << endl; // 输出sp3的值(作用域内)
    }
    shared_ptr<Rectangle> sp3 = wp.lock(); // 获得一个shared_ptr对象
    cout << "作用域外sp3的值:" << sp3 << endl; // 输出sp3的值(作用域外)
}
```

输出结果:

```bash
作用域内sp3的值:0x7f8f1b402010
作用域外sp3的值:0
```

也可以把`weak_ptr`对象作为参数直接赋值给`shared_ptr`对象, 从而获得封装对象的控制权, 但是要注意, 如果`weak_ptr`对象所观测的`shared_ptr`对象已经被销毁, 那么这个`shared_ptr`对象就是一个空指针, 抛出的是"bad_weak_ptr"异常:

```cpp
int main(void) {
    try {
        weak_ptr<Ractangle> wp;
        {
            shared_ptr<Rectangle> sp1(new Rectangle(10, 20));
            shared_ptr<Rectangle> sp2 = sp1;
            wp = sp2;
            shared_ptr<Rectangle> sp3(wp); // 将wp作为参数直接赋值给sp3
            cout << "作用域内sp3的值:" << sp3 << endl;
        }
        shared_ptr<Rectangle> sp3(wp); // 将wp作为参数直接赋值给sp3
        cout << "作用域外sp3的值:" << sp3 << endl;
    }
    catch (bad_weak_ptr) {
        cout << "对象失效" << endl; // 输出"bad_weak_ptr"
    }
}
```

#### weak_ptr中如何实现的观察机制

在`shared_ptr`类中, 有两个成员变量, 一个是指向所管理的对象的指针, 另一个是指向控制块的指针, 控制块对象是在`shared_ptr`第一次接管对象时动态创建的

控制块类有两个计数器:
- 一个是引用计数器`use_count`: 用于记录有多少个`shared_ptr`对象共享这个对象
- 一个是弱引用计数器`weak_count`: 用于记录有多少个`weak_ptr`对象观测这个对象

在`weak_ptr`类中, 也有两个指针, 一个指向`shared_ptr`对象所管理的对象(也就是要观测的对象), 另一个指向`shared_ptr`的控制块

`shared_ptr`与`weak_ptr`不同之处在于:
- 针对同一个管理对象, 新建一个`shared_ptr`, 只会增加引用计数器`use_count`, 而新建一个`weak_ptr`, 只会增加弱引用计数器`weak_count`
- 销毁一个`shared_ptr`, 会将引用计数器`use_count`减一, 销毁一个`weak_ptr`, 会将弱引用计数器`weak_count`减一

例如, 当创建了一个`shared_ptr`对象时, 引用计数器`use_count`的值为1, 弱引用计数器`weak_count`的值为0, 如图:

![创建一个sp](/assets/posts/Cpp-Smart-Pointer/01.png){"width": 700px}

当使用`weak_ptr`对象观测这个`shared_ptr`对象时, 弱引用计数器`weak_count`的值会增加1, 引用计数器`use_count`的值不变, 如图:

![创建一个wp](/assets/posts/Cpp-Smart-Pointer/02.png){"width": 700px}

如果此时`shared_ptr`对象离开作用域, 被销毁, 引用计数器`use_count`的值会减一, 但是弱引用计数器`weak_count`的值不变, 如图:

![销毁一个sp](/assets/posts/Cpp-Smart-Pointer/03.png){"width": 700px}

当`use_count`为 0 时, 这时, `shared_ptr`的析构函数会删除掉所管理的对象, 但是由于`weak_count`的值不为 0, 所以`shared_ptr`的控制块不会被销毁, 如图:

![销毁一个sp](/assets/posts/Cpp-Smart-Pointer/04.png){"width": 700px}

当`weak_ptr`对象离开作用域, 被销毁, 弱引用计数器`weak_count`的值会减一, 当`weak_count`的值为 0 时, `shared_ptr`的控制块才会被销毁.