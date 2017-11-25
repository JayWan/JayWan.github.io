---
layout: post
title:  "[ML] Normalization & Regularization"
date:   2017-11-22
excerpt: "Distinct of these 2 totally different strategies widely used in ML..."
note: true
tag:
- Machine Learning
comments: true
---

Credits should go to [Enzo Tagliazucchi](https://www.quora.com/profile/Enzo-Tagliazucchi) and Andrew Ng.
{: .notice}

## Normalization and standardization

These two terms are pretty much the same thing and both relate to the issue of **`feature scaling`**. 

If training an algorithm using different features and some of them are off the scale in their magnitude, then the results might be dominated by them instead of all the features. **This is a common problem in SVM**, for example. 

One common way to normalize the data is called `Mean Normalization`, where **\\( \mu_i \\)** is the average of all the values for the feature i and **\\( s_i \\)** is the range(max - min) or the standard deviation of the values:

\\[ x_i = \frac{x_i - \mu_i}{s_i}  \\]

## Regularization

This is a technique to avoid overfitting when training machine learning algorithms.

Overfitting is avoided by limiting the absolute value of the parameters in the model. This can be done by **adding a term to the cost function that imposes a penalty based on the magnitude of the model parameters**.

For example, for linear regression, we have the following regularizations:

\\[ \theta_0 := \theta_0 - \alpha\ \frac{1}{m}\ \sum_{i=1}^m (h_\theta(x^{(i)}) - y^{(i)})x_0^{(i)} \\]

\\[ \theta_j := \theta_j - \alpha\ \left[ \left( \frac{1}{m}\ \sum_{i=1}^m (h_\theta(x^{(i)}) - y^{(i)})x_j^{(i)} \right) + \frac{\lambda}{m}\theta_j \right] \\]

For logistic regression, we have the following cost function:

\\[ J(\theta) = - \frac{1}{m} \sum_{i=1}^m \large[ y^{(i)}\ \log (h_\theta (x^{(i)})) + (1 - y^{(i)})\ \log (1 - h_\theta(x^{(i)})) \large] \\]

After conducting regularization, we will have:

\\[ J(\theta) = - \frac{1}{m} \sum_{i=1}^m \large[ y^{(i)}\ \log (h_\theta (x^{(i)})) + (1 - y^{(i)})\ \log (1 - h_\theta(x^{(i)}))\large] + \frac{\lambda}{2m}\sum_{j=1}^n \theta_j^2 \\]