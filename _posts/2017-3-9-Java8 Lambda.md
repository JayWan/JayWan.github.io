---
layout: post
title:  "Java 8 Lambda 表达式"
date:   2017-3-9
excerpt: "Java 8 Lambda Expression learning notes..."
note: true
tag:
- Java
comments: true
---

最近又在写大作业，感觉自己根本不会Java，于是赶紧恶补Java 8，以免被组长还有各路大神嫌弃。

### Lambda Expression
A function (or a subroutine) defined, and possibly called, without being bound to an identifier. 
{: .notice}

简单点说就是：一个不用被绑定到一个标识符上，并且可能被调用的函数。也可以理解为是一种快速创建SAM(SingleAbstract Method)接口(即只有一个方法的接口，比如`EventListener`、`Thread`、`java.util.function`等)的方法。
{: .notice}

我的理解是Lambda表达式不是一个方法，它表达的是一个函数，所以最大的用途也就是简化那些需要函数作为参数的语句(函数接口) 这也就是为什么`Lambda Expression`与`java.util.function`结合这么紧的原因
{: .notice}

下面是基本格式：
{% highlight java %}
(Type1 param1, Type2 param2, ..., TypeN paramN) -> {
    statment1;
    statment2;
    //.............
    return statmentM;
}
{% endhighlight %}
1. 参数类型可省略 —— 绝大多数情况，编译器都可以从上下文环境中推断出lambda表达式的参数类型
2. 当lambda表达式的参数个数只有一个，可以省略小括号
3. 当lambda表达式只包含一条语句时，可以省略大括号、return和语句结尾处的分号
4. 使用Method Reference


以下是各种例子：
{% highlight java %}
//添加监听器
listeners.add(c-> System.out.println(c.message()));  

//等价如下 
listeners.add(newEventListener() {  
    @Override
    public void message(MessageContext c) {  
        System.out.println(c.message()));  
    }  
});  
{% endhighlight %}

{% highlight java %}
//创建新线程
public static void main(String[] args) throws Exception {
    new Thread(() -> System.out.println("Hello World!")).start();
    TimeUnit.SECONDS.sleep(1000);
}

//等价如下
public static void main(String[] args) throws Exception {
    new Thread(new Runnable() {
        @Override
        public void run() {
            System.out.println("Hello World!");
        }
    }).start();
    TimeUnit.SECONDS.sleep(1000);
} 
{% endhighlight %}


{% highlight java %}  
//又如此，将字符串按长度排序
public static void main(String[] args) {
    String []datas = new String[] {"peng","zhao","li"};
    Arrays.sort(datas, (v1 , v2) -> Integer.compare(v1.length(), v2.length()));
    Stream.of(datas).forEach(param -> System.out.println(param));
}
{% endhighlight %}

## 再次理解

需要注意的是，函数式接口的名称并不是lambda表达式的一部分。那么问题来了，对于给定的lambda表达式，它的类型是什么？答案是：它的类型是由其上下文推导而来。例如，下面代码中的lambda表达式类型是`ActionListener`：

{% highlight java %} 
ActionListener l = (ActionEvent e) -> ui.dazzle(e.getModifiers());
{% endhighlight %}

这就意味着同样的lambda表达式在不同上下文里可以拥有不同的类型：

{% highlight java %}
Callable<String> c = () -> "done";

PrivilegedAction<String> a = () -> "done";
{% endhighlight %}

第一个lambda表达式`() -> "done"`是`Callable的`实例，而第二个lambda表达式则是`PrivilegedAction`的实例。

编译器负责推导lambda表达式的类型。它利用lambda表达式所在上下文所期待的类型进行推导，这个被期待的类型被称为目标类型。lambda表达式只能出现在目标类型为函数式接口的上下文中。

当然，lambda表达式对目标类型也是有要求的。编译器会检查lambda表达式的类型和目标类型的方法签名（method signature）是否一致。当且仅当下面所有条件均满足时，lambda表达式才可以被赋给目标类型T：

1. `T`是一个函数式接口
2. lambda表达式的参数和T的方法参数在数量和类型上一一对应
3. lambda表达式的返回值和T的方法返回值相兼容（`Compatible`）
4. lambda表达式内所抛出的异常和T的方法throws类型相兼容

由于目标类型（函数式接口）已经“知道”lambda表达式的形式参数（Formal parameter）类型，所以我们没有必要把已知类型再重复一遍。也就是说，lambda表达式的参数类型可以从目标类型中得出：

{% highlight java %}
Comparator<String> c = (s1, s2) -> s1.compareToIgnoreCase(s2);
{% endhighlight %}

在上面的例子里，编译器可以推导出s1和s2的类型是String。此外，当lambda的参数只有一个而且它的类型可以被推导得知时，该参数列表外面的括号可以被省略：

{% highlight java %}
FileFilter java = f -> f.getName().endsWith(".java");

button.addActionListener(e -> ui.dazzle(e.getModifiers()));
{% endhighlight %}
这些改进进一步展示了我们的设计目标：“不要把高度问题转化成宽度问题。”我们希望语法元素能够尽可能的少，以便代码的读者能够直达lambda表达式的核心部分。

lambda表达式并不是第一个拥有上下文相关类型的Java表达式：泛型方法调用和“菱形”构造器调用也通过目标类型来进行类型推导：

{% highlight java %}
List<String> ls = Collections.emptyList();
List<Integer> li = Collections.emptyList();

Map<String, Integer> m1 = new HashMap<>();
Map<Integer, String> m2 = new HashMap<>();
{% endhighlight %}
