---
layout: post
title:  "[WDP] Combining Machine Learning & Embedded Systems"
date:   2017-10-28
excerpt: "Viewpoint: 7 steps of ML and their relationships with embedded systems..."
project: true
tag:
- Machine Learning
- Wearable Dance Party
comments: true
---

## Collecting Data

Collect the data **from the device you are about to use in your final product as well as the environment in which your final product will be** to make sure the data consistency. This is the first step, but may also be the most important step, good data leads to a strong classifier while bad data can lead to the failure of the whole project.

After which, **you should explore your data set by plotting the data or print out the shape, therefore get a good sense of the shape, number and quality of your data set**.

## Pre-processes of the Raw Data

Besides feature scaling and mean normalization, we can also consider applying the following techniques to the raw data:

  - PCA / LDA to conduct dimensionality reduction in order to improve the performance.
  - Sliding window if dealing with time-series data.
  - Low/High Pass Filters to filter the noise in the data.

## Choosing/Constructing a Model

**Start with the simplest model that could possibly work and then iterate**. Quickly prototyping and see their performance in practice.
{: .notice}

## Training

You can use hell a lot of different algorithms to train your data and see their performance and comparing their algorithm complexity, computational price as well as the complexity of algorithm's implementation, which is concerned with the binary file size that will be ultimately put into a microprocessor.

In this process, you always have many many options to choose. Take `deep neural network` for example, you can choose to use `batch gradient descent`, `mini-batch gradient descent` or `random gradient descent`, and you can also choose how many hidden layers you would like to have and the number of neurons in each layer. These all improves the complexity of this process, and **sometimes it is more of an art than science**.

## Evaluation

Plotting the decision boundaries and the learning curves of different classifiers can help you better understand what they are doing and help you conduct error analysis as well.
{: .notice}

Print or list out the mislabeled examples and then categorize their characteristics to get a sense of the possible reasons of failure.

## Parameter Tuning

Regularization and variance-bias analysis can help to avoid overfitting.

## Prediction