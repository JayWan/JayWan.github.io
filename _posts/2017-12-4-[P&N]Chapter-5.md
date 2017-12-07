---
layout: post
title:  "[P&N] Chapter 5: Software Endures"
date:   2017-12-4
excerpt: "Layers of paradigms for software are so deep that the physical world largely becomes irrelevant; Software reflects the personalities and idiosyncrasies of its creators..."
reading: true
tag:
- Plato and the Nerd
comments: true
---
Citation: **Edward A. Lee, 2017: Plato and the Nerd - the creative partnership of humans and technology. MIT Press, Cambridge, MA**
{: .notice}

As has already been examined in the previous chapter, designing a modern chip from scratch is impossible for a human, let alone designing Wikipedia from scratch. We need a higher level of abstraction to make us able to utilize the hardwares without digging into the intrinsic circuits within them. Here comes *machine code*, which is meant for the machine to read, not for the human designer to write. For example, adding the registers 1 and 2 and placing the result in register 6 is encoded:

\\[ \mathcal{100011 \ 00011 \  01000 \ 00000 \ 00001 \ 000100} \\]

> A modern computer program will typically consist of hundreds or thousands of **"modules"** or **"packages"**, each of which consists of dozens of hundreds of **"classes"**, each of which has dozens of hundreds of **"methods"**, each of which has dozens or hundreds of **lines of code**. The lines of code are written in a programming language that is translate by a compiler into machine code (often indirectly, first translating into another language, then another language, then to machine code).

The structure of a common modern computer program can be abstracted as the following graph(Drawn by myself):

{% capture images %}
/assets/img/posts/ch5-1.png
{% endcapture %}
{% include gallery images=images caption="The Structure of a Modern Program" cols=1 %}

> I do not know of any other technology covering a ratio of \\( 10^{10} \\) or more: the computer, by virtue of its fantastic speed, seems to be the first
to provide us with an environment where highly hierarchical artifacts are both possible and necessary.(Dijkstra, 1972)

The ratio \\( \mathcal{R} \\) in the graph can easily reach \\( 10^{10} \\)(Dijkstra, 1972). But if we further include the transistors under the machine code, the ratio is at least \\( 10^{24} \\)(Lee, 2017), which even hardly makes sense to a human.

So how exactly does such a huge hierarchical system work? The answer seems obvious to some extent: **more layers of abstraction.**

## ISA - Instruction Set Architecture & Assembly Language

In short, **ISA abstracts the hardware.**
{: .notice}

{% capture images %}
/assets/img/posts/ch5-2.gif
{% endcapture %}
{% include gallery images=images caption="The role of ISA." cols=1 %}

> Engineers who work at these levels are called "computer architects". There is a long and rich history of architectures, most of which have not survived in the marketplace, and some of which operate in very different ways. So-called "dataflow computers", for example, don't even specify programs as sequences of instructions.(Arvind et al., 1991)

**Different ISAs have different assembly languages**, but today, only a small handful of ISA dominate. (x86, ARM, SPARC, MIPS, RISC-V...) For more information regarding the difference between x86 and ARM, please click [here](http://jackwan.win/ARM-vs.-x86/).

## Programming Languages

{% capture images %}
/assets/img/posts/ch5-3.jpg
{% endcapture %}
{% include gallery images=images caption="Popularity of Major Programming Languages in 2017." cols=1 %}

[Fred Brooks](https://en.wikipedia.org/wiki/Fred_Brooks), in his famous paper titled [*No Silver Bullet - Essence and Accidents of Software Engineering*](http://www.itu.dk/people/hesj/BSUP/artikler/no-silver-bullit.pdf), made a distinction between accidental complexity and essential complexity (Brooks, 1987). 

> All software construction involves **essential tasks**, the fashioning of the complex conceptual structures that compose the abstract software entity, and **accidental tasks**, the representation of these abstract entities in programming languages and the mapping of these onto machine languages within space and speed constraints.<br>
From *No-Silver-Bullet*

**The next abstraction layer above ISAs and assembly language is the programming languages**, which has nearly narrowed the accidental complexity in programming down to zero according to Brooks. As a result, the remaining essential complexity, he said, accounted for what has become known as Brooks' law,

> Adding manpower to a late software project makes it later.

According to the concepts introduced in the previous chapters, we can somehow derive that **each program encodes a paradigm, a way of thinking about computation.** So I would argue, if a programmer knows only one programming language well, (s)he could be easily constrained in the frame of the very language (s)he uses without even realizing it. This remains me of a quote from [**Charlie Munger**](https://en.wikipedia.org/wiki/Charlie_Munger):

> To the man with only a hammer, every problem looks like a nail.

In this sense, I would argue, maybe the modern programming languages are far from eliminating all the accidental complexity from programming. For example, timing is hard to specify among nearly all the common programming languages.

## Operating Systems

This word, to most people, means one of the following 5 things: Apple's iOS and OS X, Microsoft's Windows, Linux and Google's Android. For more information about the distribution of these operating systems, please visit [here](https://en.wikipedia.org/wiki/Usage_share_of_operating_systems).

These operating systems each also encodes a different paradigm, but every one of them provides the notion of "file system". The interesting point to me is:

> My key observation is that nothing in the computer hardware provides the notion of a file and the organization of file into directories. The software embodied in the operating system provides this notion.

But here comes the question, as mentioned in Chapter 2, engineers construct object that fits a model as well as possible. The OSs are definitely the productions of engineers, but is the OS itself a object or a model?

## Libraries, Languages, and Dialects

Today, software provides much more complexities than ever before. How to further manage these complexities becomes a big problem. As a result, plenty of libraries, dialects and frameworks have come about for designer to use.

## The Cloud

The last layer will probably be the cloud - distributed cloud computing. The reason is that the most interesting things computers can do are way too big for a single computer to handle.

So many data are gathered every second, but should we worry about this? It's really a philosophical question to some extent, we will leave this question to the next post.