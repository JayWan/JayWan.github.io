---
layout: post
title:  "Java 8 Function"
date:   2017-3-8
excerpt: "Java 8 Learning Notes"
project: true
tag:
- Java
comments: true
---

### java.util.function

在Java8中你会发现`java.util.function`包下的`Function`, `Supplier`, `Consumer`, `Predicate`和其他函数式接口广泛用在支持lambda表达式的API中。这些接口有一个抽象方法，会被lambda表达式的定义所覆盖。

这里简单介绍一下`Function`接口：

接口的主要方法：

`R apply(T t)`
将Function对象应用到输入的参数上，然后返回计算结果。

`default ‹V› Function‹T,V›` 
将两个`Function`整合，并返回一个能够执行两个`Function`对象功能的`Function`对象。

如果你想把接受一些输入参数并将对输入参数处理过后的结果返回的功能封装到一个方法内，`Function`接口是一个不错的选择。
{: .notice}

示例如下：

{% highlight java %}
public class FunctionDemo {
    //API which accepts an implementation of Function interface
    //Function接口实现作为参数
    static void modifyTheValue(int valueToBeOperated, Function<Integer, Integer> function){
    int newValue = function.apply(valueToBeOperated);
    
    // Do some operations using the new value.
    System.out.println(newValue);
}
{% endhighlight %}

下面是调用上述方法的例子：

{% highlight java %}
public static void main(String[] args) {
    int incr = 20;  
    int myNumber = 10;
    modifyTheValue(myNumber, val-> val + incr);
    myNumber = 15;  
    modifyTheValue(myNumber, val-> val * 10);
    modifyTheValue(myNumber, val-> val - 100);
    modifyTheValue(myNumber, val-> "somestring".length() + val - 100);
}
{% endhighlight java %}
