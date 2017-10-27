---
layout: post
title:  "Tensorflow-C++"
date:   2017-10-28
excerpt: "How to use tensorflow in C/C++... [First Than First]"
note: true
tag:
- Machine Learning
- TensorFlow
comments: true
---	
`gcc -I/usr/local/include -L/usr/local/lib hello_tf.c -ltensorflow`

# Graph Construction

## `Scope`

`tensorflow::Scope`: holds the current state of graph construction, store Tensorflow operation properties, the first argument to `operation constructors`. Multiple `Scope`s can refer to the same graph.

Create a new `Scope` object by calling `Scope::NewRootScope`, which **creates some resources such as a graph to which operations are added**, and the `Scope` object returned by `Scope::NewRootScope` is referred to as **the root scope**. It also creates a `tensorflow::Status` object which will be used to **indicate errors encountered when constructing operations**.

"Child" scopes can be constructed from the root scope by calling various **member functions** of the Scope class, thus forming **a hierarchy of scopes**. A child scope inherits all of the properties of the parent scope and typically has one property added or changed.

Here are some of the properties controlled by a Scope object:

* Operation names
* Set of control dependencies for an operation
* Device placement for an operation
* Kernel attribute for an operation

## `Operation Constructors`
It is used to create graph operations, using one C++ class per TensorFlow operation**(class-per-operation)**. C++ uses camel-case to conform to C++ coding style. For instance, the `MatMul` operation has a C++ class with the same name.

{% highlight C++ %}
/*
 * The first parameter for all operation constructors is always a Scope object
 * Tensor inputs and mandatory attributes form the rest of the arguments
 */
auto m = MatMul(scope, a, b);

/*
 * Specify a single optional attribute by constructing an Attrs object using the 
 * static functions provided in the C++ class for the operation.
 */
auto m = MatMul(scope, a, b, MatMul::TransposeA(true));
 
/*
 * Specify multiple optional attributes by chaining together functions.
 */
auto m = MatMul(scope, a, b, MatMul::TransposeA(true).TransposeB(true));
// Or, alternatively
auto m = MatMul(scope, a, b, MatMul::Attrs().TransposeA(true).TransposeB(true));
{% endhighlight %}

## `Constants`
It is used to create a tensor constant, using `tensorflow::ops::Const` function.

{% highlight C++ %}
// Scalars
auto f = Const(scope, 42.0f);
auto s = Const(scope, "hello world!");

// 2x2 matrix
auto c1 = Const(scope, { {1, 2}, {2, 4} });
// 1x3x1 tensor
auto c2 = Const(scope, { { {1}, {2}, {3} } });
// 1x2x0 tensor
auto c3 = ops::Const(scope, { { {}, {} } });

// 2x2 matrix with all elements = 10
// Shapes explicitly specified
auto c1 = Const(scope, 10, {2, 2});
// 1x3x2x1 tensor
// Shapes explicitly specified
auto c2 = Const(scope, {1, 2, 3, 4, 5, 6}, {1, 3, 2, 1});
{% endhighlight %}

# Graph Execution
A `session` will be needed when executing a graph, using `tensorflow::ClientSession` class, which will execute operations created by the `operation constructor`s. Here's an example:

 {% highlight C++ %}
Scope root = Scope::NewRootScope();
auto c = Const(root, { {1, 1} });
auto m = MatMul(root, c, { {42}, {1} });

ClientSession session(root);
std::vector<Tensor> outputs;
session.Run({m}, &outputs);
// outputs[0] == {42}
{% endhighlight %}



