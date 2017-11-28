---
layout: post
title:  "ML strategy"
date:   2017-11-20
excerpt: "Tips for structuring ML projects learned from the Coursera course taught by Andrew Ng..."
project: true
tag:
- Machine Learning
comments: true
---

In this post, I covered:

- [How to spend your time](#how-to-spend-your-time)
- [Chains of assumptions in ML](#chains-of-assumptions-in-ml)
- [Data For Machine Learning](#data-for-machine-learning)
- [Metrics for ML algorithm](#metrics-for-ml-algorithm)
- [Setting up Train/Dev/Test distributions](#setting-up-traindevtest-distributions)
- [Comparing Human-Level performance](#comparing-human-level-performance)
- [Error Analysis](#error-analysis)
- [Handling Skewed Classes](#handling-skewed-classes)
- [Tips for Building a new ML system](#tips-for-building-a-new-Ml-system)
- [Mismatched training and dev/test set](#mismatched-training-and-devtest-set)
- [Transfer Learning](transfer=learning)
- [End-to-End Deep Learning](end-to-end-deep-learning)

# How to spend your time

Let's say if you are designing a spam classifier, how could you spend your time to improve the accuracy of this classifier?

- Collect lots of data
- Develop sophisticated features (for example: using email header data in spam emails)
- Develop algorithms to process your input in different ways (recognizing misspellings in spam).

But it is difficult to tell which of the options will be most helpful.

# Chains of assumptions in ML

1. Fit training set well on cost function
  - Bigger Network
  - Better optimization algorithm
  - Different NN architecture/hyperparameters searching

2. Fit dev set well on cost function
  - Regularization
  - Bigger training set

3. Fit test set well on cost function
  - Bigger dev set (Maybe over-tuned on dev set)

4. Performs well in real world
  - Change *dev set* or *cost function*

# Data For Machine Learning

> It's not who has the best algorithm that wins. It's who has the most data.

- Use a learning algorithm with many parameters. (e.g. logistic regression/linear regression with many features; neural network with many hidden units.)

- Use a very large training set. (Unlikely to overfit.)

# Metrics for ML algorithm

**Think outside of the box, don't be constricted to a single specific error metric, define the metric that well captures what you really want to do.**

Apply `orthogonalization` to this problem: 

> Worry separately about how to do well on one metric.

## **Single number evaluation metric**

It's really a trade off between **precision** and **recall**.

There is a metric call "**F1 score**", which is basically the "harmonic mean" of p and r.

\\[ score = \frac{2}{\frac{1}{p} + \frac{1}{r}} \\]

2 Tips to quickly select the better algorithm:

1. Use a well defined Dev set.
2. Use the single real number metric.

## Satisficing and Optimizing metric

Take `accuracy` and `running time` for example, you want to maximize accuracy subject to runningTime ≤ 100 ms.

In this case, `accuracy` becomes the optimizing metric while `running time` becomes the satisficing metric.

# Setting up Train/Dev/Test distributions

## Dev/Test sets

Make sure your `dev set` and `test set` come from the **same distribution**. Choose a dev set and test set to reflect data you expect to get in the future and consider important to do well on.
{: .notice}

Old ways of splitting data:

> `70% train` - `30% test`

> `60% train` - `20% dev` - `20% test`

But as for very large amount of data, the following distribution will become reasonable:

> `98% train` - `1% dev` - `1% test`

Set your test set to be big enough to give high confidence in the overall performance of your system.
{: .notice}

# Comparing Human-Level performance

## Why Human-Level?

As long as ML is worse than humans, you can:

- Get labeled data from humans.
- Gain insight from manual error analysis: why did a person get this right?
- Better analysis of bias/variance.

## Bayes Optimal Error

Nothing can surpass Bayes error.

** But we can think Human-level error as a proxy(estimate) for Bayes error.** Thus we can know what the `avoidable bias` is.

Denote **avoidable bias** as \\( bias \\), **algorithm variance** as \\( variance \\), **human-level error** as \\( h \\), **current training error** as \\( etrain \\), **current dev error** as \\( edev \\):

\\[ bias = etrain - h \\]
\\[ variance = edev - etrain \\]

# Error Analysis

`Error Analysis` help you evaluate whether it worth your effort to focus on a specific source that causes the error of your algorithm.
{: .notice}

Intuition:

- Get ~100 mislabeled dev set examples.
- Count up how many are caused by a specific source.

which can also be applied to evaluating multiple ideas in parallel - ***calculating the percentage that one specific source accounts for among the total error***.

For example, you can analyze the following error sources when developing a cat recognition algorithm:

- Dog
- Great Cat
- Blurry
- Incorrectly labeled data

## Cleaning up incorrectly labeled data

DL algorithms are quite robust to random errors while they are relatively vulnerable to systematic errors(e.g. incorrectly labeled data).
{: .notice}

First step usually is to carry out a `Error Analysis` to determine whether it is worth doing so.

Once decide to correct the incorrect examples, remember to:

- Apply **same process** to your dev and test sets to make sure they continue to come from the same distribution
- Consider examining examples your algorithm got right as well as ones it got wrong.
- Train and dev/test data may now come from slightly different distributions.

# Handling Skewed Classes

Take cancer diagnosis as a example, if we predict y = 1, we predict the patient has cancer:

## Error Metrics for skewed classes

**`Precision`**: Of all patients where we predicted \\( y = 1\\), what fraction actually has cancer.<br>
**`Recall`**: Of all patients that actually have cancer, what fraction did we correctly detect as having cancer?
{: .notice}

## Trading off Precision and Recall

For logistic regression, we can change the decision boundary to make the cancer diagnosis more confident(i.e. we only predict y = 1 when we are very confident.).

In this case, [F1 score](#single-number-evaluation-metric) will become a option.

# Tips for Building a new DL system

Build your first system quickly, then iterate. Don't over-think the problem and build the system too complicated. **Build something that actually works.**
{: .notice}

1. Set up dev/test set and metric.
2. Building initial system quickly.
3. Use Bias/Variance analysis & Error analysis to prioritize next steps. 

# Mismatched training and dev/test set

For example, you are building a cat recognition system for mobile apps, and you have 200,000 images from the web and only 10,000 data from the mobile apps.

Options:

- Bad: Put all the data together and randomly shuffle, then split the data.

- Good: Use those 200,000 web images plus 5,000 mobile images as training set with 2500 mobile images as dev set and another 2500 mobile images as test set.

**Training-dev set**: Same distribution as training set, but not used for training, which can be used to determine whether we should focus on "**Avoidable Bias Problem**" or "**Variance Problem**" or "**Data Mismatch Problem**".

We can use "**artificial data synthesis**" or "**data augmentation**" to generate more data than currently we have to train your algorithm, but be mindful of synthesizing only a tiny subset of the overall possible space, which can cause "overfitting" to the synthesis data.

# Transfer Learning

Transfer learning makes sense when:

- Task A and B have the same input x.
- You have a lot more data for Task A than Task B.
- Low level features from A could be helpful for learning B.

# End-to-End Deep Learning

Instead of going through a pipeline, end-to-end deep learning bypass all the middle details and directly output the results, which requires a large amount of data.

Concise as it is, sometimes it is better to use step-by-step pipeline method, which can make the problem more clear.

Pros:
- Let the data speak.
- Less hand-designing of components needed.

Cons:
- May need large amount of data.
- Excludes potentially useful hand-designed components.

Sometimes the categories or so called steps are just a platonic form, which can somehow largely limit the possibilities of the output.(for the layering reduces your freedom of choice)