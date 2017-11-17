---
layout: post
title: Design Patterns Overview
date: 2017-11-14
excerpt: ""
note: true
tags:
- SE
- Design Pattern
comments: true
---

## Main Purpose

Separate out the things that change from those that stay the same.
{: .notice}

1. Program to an **Interface**, not Implementation
2. Prefer **composition & delegation** over Inheritance
  * Delegation is about interface sharing
  * Inheritance is about implementation sharing

But in practice, design patterns will usually not used until your code become ugly enough.

## SOLID Principle

1. **Single Responsibility** principle
2. **Open/Closed** principle
3. **Liskov substitution** principle
4. **Injection of Dependencies**
  * Traditionally, Interface Segregation principle
5. Demeter principle

For for informations and examples about `Design Patterns`, go to [this website](https://sourcemaking.com/).

## Single Responsibility Principle
A class should have one and only one reason to change.
{: .notice}

### Symptoms:
  - High LCOM (lack of cohesion of methods) scores
  - Long class with “cliques” of methods

### Patterns/Refactorings:
  - Extract class using **delegations and compositions**. For example, in `Ruby on Rails`, we have keyword `delegate` which can do the job.

## Open/Closed Principle
Classes should be open for extension, but closed for source modification.
{: notice}

### Symptoms:
  - Lack of ability to extend (usually refers to adding new types or methods of doing the same thing) without changing the Base class. (E.G. PDF Exporter, HTML Exporter)
  - `case` statements based on class or other property that doesn’t change after assignment.


### Patterns/Refactorings:
  - Statically typed language: abstract factory pattern, relatively easier in duck typed language like ruby.
  
  - Template Pattern:
    - Set of steps is the same, but implementation of steps different.
    - Using **Inheritance**: subclasses override abstract “step” methods.
  
  - Strategy Pattern:
    - Task is the same, but many ways to do it.
    - Using **composition**: component classes implement whole task.

  - Decorator Pattern:
    - Add behaviors to a base class.
    - Delegations in multiple layers. - Delegation chain.

### In Practice:
Can’t close against all types of changes, we have to choose.

## Liskov Substitution Principle
Subtypes can substitute for base types.<br>
> "A method that works on an instance of type T, should also work on any subtype of T."
{: .notice}

### Symptoms:
  - Change to subclass requires change to superclass. (Rectangle-Square: [Violation](https://gist.github.com/armandofox/3c3b8566b74fe438e559), [Solution](https://gist.github.com/armandofox/e792a2e99ed889af3af2))
  - Long class with “cliques” of methods

### Patterns/Refactorings:
  - **Composition**: rather than inheriting from T, create class that has a T as a component.
  - Explicitly delegate method calls on T to that component. (inheritance ≈ implicit delegation)

## Injection of Dependencies (DIP)
“Inject” an **abstract interface** that a & b depend on.
{: .notice}

### Symptoms:
A depends on B, but B interface & implementation can change, even if functionality stable.

### Patterns/Refactorings:
  - **Adapter**: Rails example: **database “adapters”** for MySQL, Oracle, PostgreSQL ...
  - **Facade**: Unify distinct underlying API’s into a single, simplified API. (like jQuery!)

## Demeter Principle
Only talk to your friends, not strangers.
{: .notice}

### Symptoms:
  - Long chains of method calls.

### Patterns/Refactorings:
  - **Delegation**: Replace method with delegate.
  - **Visitor**: Separate traversal from computation.
  - **Observer**: Be aware of important events without knowing implementation details.
    - In Rails, we have `ActiveRecord::Observer` and keyword `observe`.


