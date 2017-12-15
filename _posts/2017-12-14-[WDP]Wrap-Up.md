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

1. Hardware choosing has to be considered in advance.
    * Is microcontrollers' voltage compatible with the LEDs?
    * Will the wiring of the component become a problem? (The answer is usually yes.) Is wireless available?
2. Memory size, computational resource has to be taken into account. You should have an idea of the size of the binary file of your product.
3. Think about your high level software architecture carefully, make it clear and scalable.
4. Start with something simple that could possibly work and then iterate.
5. Be aware of the bottlenecks of the libraries you are using, at least the basic aspects:
    * File size. (should be < Memory size.)
    * Algorithm complexity.
6. Prototyping in Python before start C coding can save a lot of time.
7. Simulation of the hardwares in software can also be very helpful - to allocate the problem.
8. User feedback can be important - user experience.
    * How can the user know the signals generated on your back?
