---
layout: post
title:  "[ML] Anomaly Detection"
date:   2017-12-3
excerpt: "Some common ways to detect anomalies in machine learning..."
note: true
tag:
- Machine Learning
comments: true
---

# Gaussian Distribution

Using this method means that **we assume** that the data set **obeys gaussian distribution**.<br>
If not, we can apply some function such as \\( log \\) to them to **make them more gaussian** - **plot the histogram of the data.**
{: .notice}

\\[ p(x) = \prod_{j=1}^{n} p(x_j; \mu_j, \sigma_j^2) = \prod_{j=1}^{n} \frac{1}{\sqrt{2 \pi} \sigma_j} exp(- \frac{(x_j - \mu_j)^2}{2\sigma_j^2} )\\]

We think \\( x \\) is an anomalous example if the following inequality holds:
  \\[ p(x) \leq \varepsilon \\]

**NOTE:** The best way to compute **\\( \mu_j \\)** **\\( \sigma_j \\)** is to **use only the normal data without anomaly data**. This requires to take advantage of the labels on the training set.
{: .notice}

# Develop a Anomaly Detection System

First, we shall choose features that might take on unusually large or small values in the event of an anomaly, which pretty much depends on your intuition.

Then, taking advantage of labeled data and train them to a mature system to detect the anomalous examples.

**For algorithm evaluation**:
1. Fit model \\( p(x) \\) on training set \\( \{ x^{(1)}, ..., x^{(m)} \} )

2. On a cross validation/test examples \\( x \\), predict:
  \\[ y = 
  \begin{cases}
    1 & if p(x) \leq \varepsilon \ (anomaly) \newline
    0 & if p(x) \geq \varepsilon \ (normal)
  \end{cases}
  \\]

3. Possible evaluation metrics:
  - True positive, false positive, false negative, true negative
  - Precision / Recall
  - \\( F_1-score \\)

4. We can also use cross validation set to choose parameter \\( \varepsilon \\)

NOTE: Accuracy is not a good metric for this problem for it's highly skewed.
{: .notice}

# Comparing Supervised learning

When we have only a very small number of positive(anomalous) examples, using a anomaly detection would be a better choice.

If we have a large number of positive and negative examples, maybe we should use supervised learning.

In short, We need **enough anomalous examples / enough information** for supervised learning algorithm to get a sense of what anomalous examples are like.
{: .notice}