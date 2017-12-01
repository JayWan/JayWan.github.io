---
layout: post
title:  "[ML] Dimensionality Reduction"
date:   2017-12-1
excerpt: "Common dimensionality reduction methods such as PCA and LDA in ML..."
note: true
tag:
- Machine Learning
comments: true
---

# PCA - Principal Component Analysis

**Problem formulation**:<br> Reduce from **n**-dimension to **k**-dimension: Find \\( k \\) vectors \\( u^{(1)}, u^{(2)}, ..., u^{(k)} \\) onto which to project the data, so as to minimize the **projection error**.
{: .notice}

Usually the data should be ***preprocessed*** by **Feature Scaling / Mean Normalization**.

1. Compute "covariance matrix":

\\[ {\tiny \sum} = \frac{1}{m} \sum_{i = 1}^{n} (x^{(i)}) (x^{(i)})^{T} \\]

2. Compute "eigenvectors" of matrix \\(\tiny \sum \\)

3. Project the raw data onto the k-dimensional space.

# LDA - Linear Discriminant Analysis