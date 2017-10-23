---
layout: post
title:  "How to Implement State Machine in Programming Languages?"
date:   2017-10-17
excerpt: "A brief conversation with professor Lee..."
interview: true
tag:
- embedded system
comments: true
---
After talking about ["How to construct state machines in C efficiently?"](http://jackwan.win/Constructing-State-Machines-Using-C-Rohit/) with Rohit, I attended [professor Lee](http://edwardashfordlee.org/index.html)'s OH, where we talked a little more upon this topic.

This conversation is broader than the former one, but I still learnt a lot.

We talked about the `spaghetti code` issue first, and we reached a consensus on that `switch-case` is not a good practice in terms of software engineering. Actually, as far as I am concerned, maybe there is no `silver bullet` of the issue, just as what the book`The Mythical Man-Month` suggested.

Frankly speaking, many very sophisticated tools are usually very expensive, for they are designed for industrial use. So as students, according to Lee, the best practice will probably become: "**Pick the languages designed to implementing state machines according to what parts you want from the tool. And then you will have the generated C code automatically.**"

This reminds me of a quote from Shimon Peres:

> “If a problem has no solution, it may not be a problem, but a fact – not to be solved, but to be coped with over time.”

When asked about whether we can use `Ptolemy2`(a open source software) in our project, he mentioned:

> "[Ptolemy2](http://ptolemy.eecs.berkeley.edu/ptolemyII/) is very sophisticated in modeling state machines, as I demonstrated at the first time, but relatively immature in specifications checking. You should decide whether to use it based on what part of the tool you are using."

Here's some other advice of his:

* **Choose the language very carefully based on what hardware you are using**. Because this is the major difference between coding in plain softwares and embedded systems.
* If you expect very strict timing, you'd better not use Java.
* Neopixel LED is a good option for your project.

And when writing this post, I remembered a quote from himself:

> "**There's no correct models. There is only useful models.**"