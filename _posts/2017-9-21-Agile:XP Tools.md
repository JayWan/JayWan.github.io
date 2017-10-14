---
layout: post
title:  "Agile/XP Tools"
date:   2017-9-21
excerpt: "A Introduction to Agile program Tools"
project: true
tag:
- Ruby on Rials
- Agile
- SE
comments: true
---	

## Software Engineering
Software Engineering is a relatively new term which was first used as a title for the World's first conference on software engineering, sponsored and facilitated by NATO in 1968. It was designated to solve the troublesome problems in building softwares. The concept is to apply engineering disciplines to software design and construction. It aims to make software product predictable in terms of cost, quality and time. Brooks mentioned "No silver bullet" in his article *The Mythical Man-Month* in 1986, which is to say that there's no specific solutions for the uncertainties, unconsistencies and complexities. But are there any ways to improve this process? Of course.

*The following contents **draw heavily from Armando Fox's slides**.*
{: .notice}

## P & D
Plan & Document is one of the methods in the early stage of SE. It emphasizes the importance of plan and document in advance. Here are some key points:
* Make plan before doing any coding.
* Write detailed documents (e.g.: requirement documents and interface documents) of all phases of the plan you made.
* Members should strictly follow the documents decided in earlier phases.
* Any changes in plan or design should be reflected in documentation.

### Waterfall Model, 1970
1. Requirements Analysis and Specification
2. Architecture design.
3. Implementation and Integration
4. Verification.
5. Maintenance.
It believes that "Earlier catch bug, cheaper it is". But it requires extensive documentations, which may be too heavy and even too “clumsy” sometimes.

### Spiral Model, 1986
As far as I am concerned, spiral model is the former prototype of Agile. It emphasizes the whole process of building a healthy software consists of mutiple iterations, in which every iteration contains almost every phase that waterfall model requires. Here is the illustration:

{% capture images %}
	/assets/img/projects/SpiralModel.png
{% endcapture %}
{% include gallery images=images caption="- Spiral Model" cols=1 %}

### Rational Unified Process, 2003
It is called `Rational` for it is first developed by a compang called Rational Software.
{% capture images %}
	/assets/img/projects/RUP.png
{% endcapture %}
{% include gallery images=images caption="- RUP" cols=1 %}

> The RUP framework is two dimensional, with axes indicating time and content. The time dimension is organized by phases, iterations, and milestones. The content dimension consists of software disciplines containing the workflows, **roles**, **activities**, and **artifacts** as they apply to that discipline.
> -IBM

## Agile Manifesto, 2001
"We are uncovering better ways of developing SW by doing it and helping others do it. Through this work we have come to value: 
* Individuals and interactions over processes & tools
* Working software over comprehensive documentation
* Customer collaboration over contract negotiation
* Responding to change over following a plan
That is, while there is value in the items on the right, we value the items on the left more.”

## Extreme Programming, 1999 - 2003
If one thing is good, then do it whenever you can and make best use of it:
* If short iterations are good, make them as short as possible (weeks vs. years)
* If simplicity is good, always do the simplest thing that could possibly work 
* If testing is good, test all the time. Write the test code before you write the code to test. 
* If code reviews are good, review code continuously, by programming in pairs, taking turns looking over each others’ shoulders.
{% capture images %}
/assets/img/projects/ExtremeProgramming.png
{% endcapture %}
{% include gallery images=images caption="- Agile Process" cols=1 %}

### Tools for Agile/XP in Ruby on Rails
* [Github](https://github.com/) to perform version control.
* [Pivotal Tracker](http://pivotaltracker.com/) for project management. We can use points and veloctiy to track our current progress and to predict our future progress.
* [Heroku](https://heroku.com/) for deploying our app. (This is only for those who don't have the access to a personal server. But it's indeed a perfect way to check your code structure and independency.)
* [Travis CI](http://travis-ci.org/) for automatically running tests, which is called **continuous integration(CI)** by some people.
* [Coveralls](http://coveralls.io/) for detailed test coverage measurements.
* [CodeClimate](http://codeclimate.com/) for reporting on the quality and robustness of our source code. (Static Analysis.)