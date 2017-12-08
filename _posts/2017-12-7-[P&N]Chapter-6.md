---
layout: post
title:  "[P&N] Chapter 6: Evolution and Revolution"
date:   2017-12-7
excerpt: "Technology revolutions differ from scientific revolutions in that paradigms appear and disappear much more rapidly; New paradigms do not necessarily replace old ones; The crises that trigger new paradigms do not arises so much from the discovery of anomalies but rather from increasing complexity and technology-driven opportunity..."
reading: true
tag:
- Plato and the Nerd
comments: true
---
Citation: **Edward A. Lee, 2017: Plato and the Nerd - the creative partnership of humans and technology. MIT Press, Cambridge, MA**
{: .notice}

## Normal Engineering

Thomas Kuhn calls the research that is firmly grounded in an established paradigm "normal science". The LIGO gravitational wave detector is a kind of "normal science".

> Without commitment to a paradigm there could be no normal science.<br>
(Kuhn, 1962, p. 100, *Structure of Scientific Revolutions*)

{% capture images %}
/assets/img/posts/ch6-1.jpg
{% endcapture %}
{% include gallery images=images caption="LIGO(Laser Interferometer Gravitational-Wave Observatory)" cols=1 %}

Following Kuhn, Lee similarly defines "normal engineering" to be the process of design and optimization within an established methodology and an established set of rules.

To my understanding, the term "normal engineering" is relative to the term "paradigm shift". That is to say, before any paradigm shift taking place, we engineers are generally conducting so-called "normal engineering", during which most people wouldn't even suspect the authority of the paradigm within which they think. And this may seems to be very funny from the successors' point of view, who have already finished the "paradigm shift". This seems to be a little ironic to me. We live as we are, never suspecting the context within which we spend our whole lives. But a tiny change in mind could make all this as-is things absurd. But this is life, within which we live, so we can't blame it.

> How indeed would LIGO be viewed if it failed to detect any gravitational waves? Would it have undermined Einstein's theory of relativity? Probably not.
<br>
A failure to create an effective or successful interactive web page would discredit the software engineers assigned to the task. It would not undermine the paradigm of the web of the HTML and JavaScript languages.

**But when does "normal engineering" become abnormal?**

## Crisis and Opportunity

According to Lee, paradigm shifts in technology occur for at least three reasons:

1. The complexity of systems being engineered overwhelms our human ability to understand or control these systems.
  - For example, programming languages emerged because writing correct machine or assembly code became impossibly difficult.

2. It becomes possible to do something that nobody imagined was possible before.
  - For example, Google and other search engines enable nearly instantaneous search over everything humans have ever published.

3. Complex social, political, and business forces can drive paradigm shifts in technology.
  - For example, military needs essentially created aviation, nuclear weapons, and many other technologies, and military budgets provided most of the funding for the early development of computing.
 
Apparently, as a nerd, I didn't expect political and military factors appear in this list. But after pondering on this point carefully, I can accept it very well. I'm Chinese, I want to talk about China a little bit. I was born in the middle of the huge wave of information technology, as known as IT, which is really a fashion word in 2000s' China. I witnessed the development of mobile payment and computer science in the 21st century's China, it's really weird to even think about what I was doing 10 years ago, playing with all kinds of cards in the mud till midnight. Now the children are all playing with their own phones or iPads. AI and IoT become really hot concepts these days. According to *China Mobile Internet Development Status and Safety Report(2017)*, China has 2.3 billion active mobile phones in 2017. Note that this is a relatively strong condition - **ACTIVE, MOBILE PHONE**, letting alone all electronic devices. So **I would argue that Lee vastly underestimated the number of connected devices in the Internet today**, which is roughly 6 billion(p. 105). (I wonder if it's because that China is not fully connected or compatible to the Internet in some sense.)

According to Metcalfe's law, we have:

The value of a network if proportional to the square of the number of compatible communicating devices on the network.
{: .notice}

So what is the value of the Internet within China? If a single isolated device is worth $100, which is a relatively conservative estimation to me, the value should approximately be:

\\[ $100 \times (2.3 \times 10^9)^2 \\]

which is:

\\[ $ 5.29 \times 10^{20} \\]

But it makes no sense to us at all, right?

Anyway, with so many components active in a system, the complexity will increase inevitably. So far, it has not reached the point where we can't understand it, but it will sooner or later, until then the first condition of "paradigm shift" will be satisfied. Presumably, the second condition will definitely be satisfied then, too. As for the third condition, I think it has already been satisfied, in the past, we already had Internet+ and all kinds of policy regarding big data and e-business. Now, we have *The strategy of the new generation's AI development*(July, 2017). This raises the object to develop AI to a nation-level strategy, which was really a big news when it was published. In short, the object of this strategy is to bring China to the No.1 of the world in 13 years. Quite ambitious, huh?

When all three conditions are satisfied, there will be a big news. My feeling tells me that we are about to witness something again.

But there are quite a few resistance in this process:

> ... the battles that can emerge over standards development can be prolonged and painful, and the ensuing compromises can sometimes undermine the effectiveness of the resulting standards.<br>
...<br>
Organizations can even be quite sneaky about this(developing standards), concealing their business interests from the standards body until it is too late to change the standard. As a result, standards often do not reflect the best technical solution to a problem.

I found the following paragraphs a little abrupt, the reason is that I had a hard time trying to summarize this chapter, **I really recommend you to read the book yourself if you already come here**.

Anyway, Lee states that the layering of paradigms offers a fundamentally creative way to deal with a crisis of complexity. The key tip he provides is:

Not to fix a broken paradigm, replacing it with a new one, but rather to **build an entirely new paradigm on the scaffolding of the old**.
{: .notice}

## Models in Crisis

Although the technology has vastly developed since the last 50 years. But the methodologies used in modeling or abstracting some problems didn't develop that much in contrast. For example, the methodologies used to construct a aircraft is still prototype and testing, which results in so-called "iron wings". And they forbidden the use of threads and interrupts in designing the software used on an aircraft. In this case, 40 years of computer science makes no sense. How to improve the modeling methodologies then becomes a big problem to be solved. Presumably, the burden falls on the shoulders of our generation.

{% capture images %}
/assets/img/posts/ch6-2.jpg
{% endcapture %}
{% include gallery images=images caption="LIGO(Laser Interferometer Gravitational-Wave Observatory)" cols=1 %}