---
layout: post
title:  "Basic Knowledge of Compilers"
date:   2017-4-28
excerpt: "Notes when learning something about compilers..."
note: true
tag:
- C/C++
comments: true
---

This topic is rather complicated which can easily fill several books, here is something very basic designated for future review. [CONTINUOUSLY UPDATED]
{: .notice}

* `STATIC` libraries are archives of object files for use when linking other targets. 
* `SHARED`libraries are **linked dynamically and loaded at runtime**. 
* `MODULE` libraries are plugins that are **not linked into other targets** but may be loaded dynamically at **runtime** using dlopen-like functionality.