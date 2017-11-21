---
layout: post
title:  "Structuring Machine Learning Projects"
date:   2017-11-20
excerpt: "Tips for structuring ML projects learned from the Coursera course taught by Andrew Ng ..."
project: true
tag:
- Machine Learning
comments: true
---

# Chains of assumptions in ML

1. Fit training set well on cost function
  - Bigger Network
  - Better optimization algorithm
2. Fit dev set well on cost function
  - Regularization
  - Bigger training set
3. Fit test set well on cost function
  - Bigger dev set (Maybe over-tuned on dev set)
3. Performs well in real world
  - Change *dev set* or *cost function*

# Orthogonalization

1. Find the right knob.
2. Find the bottleneck of your projects.

# Metrics for ML algorithm

### **Single number evaluation metric**

It's really a trade off between **precision** and **recall**.

There is a metric call "**F1 score**", which is basically the "harmonic mean" of p and r.

\\[ score = \frac{2}{\frac{1}{p} + \frac{1}{r}} \\]

2 Tips to quickly select the better algorithm:

1. Use a well defined Dev set.
2. Use the single real number metric.

### Satisficing and Optimizing metric

Take `accuracy` and `running time` for example, you want to maximize accuracy subject to runningTime ≤ 100 ms.

In this case, `accuracy` becomes the optimizing metric while `running time` becomes the satisficing metric.

# Setting up Train/Dev/Test distributions

### Dev/Test sets

Make sure your `dev set` and `test set` come from the **same distribution**. Choose a dev set and test set to reflect data you expect to get in the future and consider important to do well on.
{: .notice}