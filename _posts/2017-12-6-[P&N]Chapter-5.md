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

## ISA - Instruction Set Architecture

## Programming Languages

## Operating Systems

## Libraries, Languages, and Dialects

## The Cloud