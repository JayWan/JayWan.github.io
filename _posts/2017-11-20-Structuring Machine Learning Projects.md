---
layout: post
title:  "ML strategy"
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

# Metrics for ML algorithm

**Think outside of the box, don't be constricted to a single specific error metric, define the metric that well captures what you really want to do.**

Apply orthogonalization to this problem: 

> Worry separately about how to do well on one metric.

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

Old ways of splitting data:

> `70% train` - `30% test`

> `60% train` - `20% dev` - `20% test`

But as for very large amount of data, the following distribution will become reasonable:

> `98% train` - `1% dev` - `1% test`

Set your test set to be big enough to give high confidence in the overall performance of your system.
{: .notice

# Comparing Human-level performance

### Bayes Optimal Error

### Why?

As long as ML is worse than humans, you can:

- Get labeled data from humans.
- Gain insight from manual error analysis: why did a person get this right?
- Better analysis of bias/variance.