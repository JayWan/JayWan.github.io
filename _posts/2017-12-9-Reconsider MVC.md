---
layout: post
title:  "Reconsidering MVC Strategy"
date:   2017-12-09
excerpt: "A review about MVC design strategy after practice..."
note: true
tag:
- Design Pattern
comments: true
---

> Model–view–controller (MVC) is a software architectural pattern for implementing user interfaces on computers. It **divides a given application into three interconnected parts**. This is done to **separate internal representations of information from the ways information is presented to, and accepted from, the user**. The MVC design pattern **decouples** these major components allowing for efficient code reuse and parallel development.<br>
- Wikipedia

## Languages and Frameworks using MVC

As far as I know, `Django` and `Ruby on Rails` are all frameworks using MVC. Apple even embeds this concept into its developer's IDE - `Xcode`. For the newest `Swift 4`, we have the following graph illustrating the idea of MVC:

{% capture images %}
/assets/img/posts/MVC.png
{% endcapture %}
{% include gallery images=images caption="Illustration of MVC from Stanford" cols=1 %}

From this graph, with the introduction from professor Paul Hegarty, we can conclude:

1. Model = **What** your application is.
2. Controller = **How** your Model is presented to the user(UI logic).
3. View = Your controllers' minions.

Furthermore, we would have the following constraints or conventions regarding this abstract model:

1. Controller can always talk directly to their Models as well as their views.
2. **The Model and View should never speak to each other**.
3. Controllers interpret/format Model information for the View.
4. Other methodologies or strategies such as delegation can be used for views and models to talk to their controllers.

When is comes to multiple MVCs working together, **one MVC always treat other MVCs connected to it as its Views**, shown below:

{% capture images %}
/assets/img/posts/MultiMVCs.png
{% endcapture %}
{% include gallery images=images caption="MVCs working together" cols=1 %}

## Advantages and Disadvantages

1. Advantages:
  - **High cohesion** - MVC enables logical grouping of related actions on a controller together. The views for a specific model are also grouped together.
  
  - **Low coupling** - which is the nature of MVC design strategy.
  
  - **Ease of modification** - The separation of responsibilities, future development or modification is easier. For example, we can easily develop multiple views for a model or a controller.

2. Disadvantages:
  - **Code navigability** - Navigation in this framework can be complex and requires users to adapt to the decomposition criteria of MVC.

  - **Multi-artifact consistency** - Decomposing a feature into three artifacts causes scattering. Thus, requiring developers to maintain the consistency of multiple representations at once. But most IDEs provide developers the tool - "refactor" or "rename", which can solve this problem pretty well.

  - **Pronounced learning curve** - Efficiently taking advantage of this framework requires the developers skilling in multiple technologies, which is a higher norm.

## My Understanding of MVC

MVC is the same as layering methodology, which is also a platonic model of the code base on which we develop. There is no perfect model, MVC maybe suitable for mobile or web development, but not necessarily all the development. For example, in embedded system, I believe, MVC will introduce unnecessary complexity to the system for that the `View` component is not that important in most embedded systems. **In short, we need to choose whatever model accordingly more like a scientist than a engineer**.

