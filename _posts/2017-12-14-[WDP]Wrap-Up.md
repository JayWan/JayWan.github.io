---
layout: post
title:  "[WDP] Wrap-Up"
date:   2017-12-14
excerpt: "Some summaries about this project and some lessons learned in the whole process..."
project: true
tag:
- Wearable Dance Party
comments: true
---

Time goes by, the short semester is about to end, so what have I learned from this machine-learning-embedded-system project? Even though it's not perfect, and some thing broke at the last moment, I think I have learned a lot.
{: .notice}

## Design

1. Spike and selection of hardwares has to be considered in advance and tested in advance before it's too late to change.
  - Is microcontrollers' voltage compatible with both the LEDs and the IMUs?
  - Will the wiring of the component become a problem? (The answer is usually yes.) Is wireless available?
  - Memory size, computational resource has to be taken into account. You should have an idea of the size of the binary file of your product.

2. Think about your high level software architecture carefully, make it clear and scalable.

3. Thinking yourself as a user may help a lot, user feedback is something that can be easily ignored. (i.e. How can the user know the signals generated on your back?)

## Modeling

1. Prototyping in Python before start coding in C can save a lot of time.

2. Simulation of the hardwares in software can also be very helpful - to allocate the problem.

3. Start with something simple that could possibly work and then iterate.

In terms of modeling, there are still several techniques that could have been applied to this project.

1. We didn't consider the bike-cyclist system as a non-inertial system. But if we have more time, **we should subtract the acceleration of the torso accelerometers from the arm accelerometers' readings before classifying the gestures**.

2. We didn't consider the possible noise in the data when the cyclists are riding the bikes. Collecting the training data from a real bike can be difficult, but **we could have use `data augmentation` to add noise the the data artificially**.

## Analysis

1. All of the common techniques used when analyzing machine learning project can still be applied here, such as:
  * Plotting the raw data.
  * Plotting the decision boundary of different algorithms.
  * Plotting the learning curves.

2. Doing quick tests about the libraries or tools you are about to use can give you more confidence.

