---
title: 游戏开发框架 单例模式
date: 2025-01-22 20:15:00 +0800
categories: [笔记, 游戏开发]
tags: [游戏开发, 设计模式]
---

本笔记源自学习[唐老师 Unity程序基础框架(重置版)](https://www.yxtown.com/goods/show/32)时的总结.

## 单例模式

单例模式是一种设计模式, 确保一个类在应用程序中只有一个实例, 并提供全局访问点.

特点:
- 唯一实例: 确保某些全局管理类只有一个实例存在, 避免资源冲突. 
- 方便访问: 提供全局访问点, 其他地方可以方便地访问它. 
- 节省资源: 避免重复创建和销毁同一类实例. 

## 单例模式基类

通过定义一个单例基类, 可以避免每个类都重复实现单例逻辑, 从而: 
- 减少代码冗余. 
- 保持代码风格一致, 方便维护. 

## 单例模式基类用途

在游戏开发中, 一些管理类需要贯穿整个游戏生命周期, 比如: 

- 游戏管理器(GameManager)
- 音频管理器(AudioManager)
- 场景管理器(SceneManager)
- 配置管理器(ConfigManager)

这些管理类通常需要是全局唯一的实例, 单例模式基类可以帮助这些类快速实现单例功能. 

## 单例模式基类实现(C#)

一般使用泛型来实现单例模式基类, 这样可以适用于所有需要单例的类. 
- 泛型T必须是类, 且必须有一个无参构造函数, 以便在Instance属性中实例化. 

### 不继承MonoBehaviour的单例基类

```csharp
using System;
using System.Reflection;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

// 用泛型来实现所有Manager的基类

#region 作用
// 1. 主要避免代码冗余
// 2. 泛型为可变的, 所以可以用来实现所有Manager的基类
#endregion

#region 注意
// 限制泛型T必须是类, 且必须有一个无参构造函数, 以便在Instance属性中实例化
# endregion

#region 潜在问题
// 1. 可能会有出现在别的地方 new() 一个单例类的情况, 但是这样会破坏单例的原则
// 2. 多个线程同时访问同一个单例类的情况时, 可能会出现共享资源的安全问题
#endregion

#region 解决方案
// 1. 将父类变为抽象类, 抽象类是不能被new的
// 2. 规定, 继承单例模式基类的类, 必须显式地实现私有的无参构造函数
// 3. 在基类中通过反射来调用私有的无参构造函数, 以此实例化对象 (使用Type类的GetConstructor()方法)
// ConstructorInfo constructor = typeof(T).GetConstructor(
// BindingFlags.Instance | BindingFlags.NonPublic,  // 表示成员私有方法(Instance)和非公共方法(NonPublic): 因为无参构造函数是私有的
// null,                                            // 表示不需要绑定对象
// Type.EmptyTypes,                                 // 表示没有参数
// null);                                           // 表示没有参数修饰符(如out, ref)
#endregion

public abstract class BaseManager<T> where T: class // , new()
{
    private static T instance;

    // 用于加锁的对象
    protected static readonly object lockObj = new object();

    // 通过属性获取实例 任选其一
    public static T Instance
    {
        get
        {
            if (instance == null)
            {
                lock (lockObj)
                {
                    if (instance == null)
                    {
                        // instance = new T();

                        // 利用反射得到私有的无参构造函数, 以此实例化对象
                        Type type = typeof(T);
                        ConstructorInfo info = type.GetConstructor(BindingFlags.Instance | BindingFlags.NonPublic,
                                                                    null,
                                                                    Type.EmptyTypes,
                                                                    null);
                        if (info != null)
                        {
                            instance = info.Invoke(null) as T;
                        }
                        else
                        {
                            Debug.LogError("The constructor is not found!");
                        }
                    }
                }
            }
            return instance;
        }
    }

    // 通过方法获取实例 任选其一
    //public static T GetInstance()
    //{
    //    if (instance == null)
    //    {
    //        instance = new T();
    //    }
    //    return instance;
    //}
}
```

### 继承MonoBehaviour的单例基类

不需要考虑多线程问题, 因为Unity的主线程中的Object是线程安全的. 

#### 需要手动挂载的单例基类

1. 不能使用new()来实例化, 因为MonoBehaviour的实例化是通过Unity引擎来实现的
2. 一定得挂载在GameObject上, 通过GameObject来实例化

```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

// 继承MonoBehaviour的单例基类(手动挂载在场景中的GameObject上)

#region 注意: 挂载式的单例基类
// 1. 不能使用new()来实例化, 因为MonoBehaviour的实例化是通过Unity引擎来实现的
// 2. 一定得挂载在GameObject上, 通过GameObject来实例化
#endregion

#region 潜在问题: 挂载式的单例基类
// 挂载式的单例基类: 会破坏单例模式的唯一性
// 1. 在一个GameObject上挂载多个继承自SingletonMono的类, 会导致后面的类覆盖前面的类
// 2. 切换场景时, 由于场景放置了挂载了SingletonMono的GameObject, 再切换回来时, 会导致单例类的重新实例化
// 3. 用脚本动态添加多个该脚本, 也会破坏单例的唯一性
#endregion

#region 解决方案
// 1. 同一个GameObject上挂载多个: 为脚本添加特性[DisallowMultipleComponent]
// 2. 多个GameObject上挂载: 判断如果存在对象, 则移除脚本
#endregion

// 不允许在同一个GameObject上挂载多个该脚本
[DisallowMultipleComponent]
public class SingletonMono<T> : MonoBehaviour where T : MonoBehaviour
{
    private static T instance;

    public static T Instance
    {
        get
        {
            return instance;
        }
    }

    protected virtual void Awake()
    {
        // 如果已经存在单例模式对象实例, 则销毁当前实例
        if (instance != null)
        {
            Destroy(this); // 不用Destroy(this.gameObject), 因为只需要移除脚本即可
            return;
        }
        instance = this as T;
        // 挂载继承此单例基类脚本时, 依附的对象在切换场景时不会被销毁
        // 可以保证在游戏整个生命周期中, 单例类的唯一性
        DontDestroyOnLoad(this.gameObject);
    }
}
```

#### 自动挂载的单例基类

1. 无需手动挂载(**请勿手动挂载**)
2. 无需动态添加
3. 无需关心切换场景带来的问题

```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// 自动挂载式的继承MonoBehaviour的单例模式基类
/// 1. 无需手动挂载(请勿手动挂载)
/// 2. 无需动态添加
/// 3. 无需关心切换场景带来的问题
/// </summary>
/// <typeparam name="T"></typeparam>

public class SingletonAutoMono<T> : MonoBehaviour where T : MonoBehaviour
{
    private static T instance;

    public static T Instance
    {
        get
        {
            if (instance == null)
            {
                #region 动态创建 动态挂载
                // 在场景上创建一个空的GameObject
                GameObject obj = new GameObject();
                // 设置该GameObject的名字(类名)
                obj.name = typeof(T).ToString();
                // 动态挂载对应的单例模式脚本
                instance = obj.AddComponent<T>();
                // 过场景切换时不销毁, 保证在整个游戏生命周期中都存在
                DontDestroyOnLoad(obj);
                #endregion
            }
            return instance;
        }
    }
}
```

## 单例模式衍生类的实现

### 不继承MonoBehaviour的单例模式

在类的开始处继承单例基类, 然后就可以通过Instance属性来获取单例实例.

```csharp
public class ChildManager : BaseManager<ChildManager>
{
    // 私有构造函数
    private ChildManager()
    {
        Debug.Log("ChildManager is created!");
    }

    public void Func()
    {
        Debug.Log("ChildManager Func");
    }
}
```

### 继承MonoBehaviour的单例模式

```csharp
public class TestMgr : SingletonAutoMono<Test2Mgr>
{
    // 如果是继承MonoBehaviour的单例基类, 则不需要私有构造函数

    private void Start()
    {
        Debug.Log("TestMgr Start");
    }

    public void Func()
    {
        Debug.Log("TestMgr Func");
    }
}
```

## 单例模式基类的使用

在其他类中, 通过Instance属性来获取单例实例, 然后就可以调用单例类的方法了.

```csharp
public class Main : MonoBehaviour
{
    // Start is called before the first frame update
    void Start()
    {
        #region 不继承MonoBehaviour的单例模式
        ChildManager.Instance.Func();
        // 注意: 由于可以自己去new一个单例模式类对象, 以下两个操作破坏了单例模式的唯一性(不推荐)
        // ChildManager t = new ChildManager(); 
        // BaseManager<ChildManager> t2 = new BaseManager<ChildManager>(); 
        #endregion

        #region 继承MonoBehaviour的单例模式
        TestMgr.Instance.Func();
        #endregion
    }
}
```