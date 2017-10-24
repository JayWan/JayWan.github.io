---
layout: post
title:  "[WDP] Preparation Stage"
date:   2017-10-23
excerpt: "Plans and Preparations for the Project - Wearable Dance Party..."
project: true
tag:
- Wearable Dance Party
comments: true
---	

## INNOVATIONS
> Hand signals are given by cyclists and some motorists to indicate their intentions to other traffic. Under the terms of the Vienna Convention on Traffic, bicycles are considered to be vehicles and cyclists are considered to be drivers. The traffic codes of most countries reflect this.<br>
In some countries (such as in the Czech Republic, Canada, and the United States), hand signals are designated not only for cyclists, but for every vehicle that does not have signal lights or has damaged signal lights. For example, drivers of older cars and mopeds may be required to make hand signals.<br>
Similar to automobile signaling, there are three primary signals: Left turn/overtaking, Right turn, and Stopping/braking.<br>
- [Wiki Page Hand Signals](https://en.wikipedia.org/wiki/Hand_signals)

Although these hand signals will probably work fine during daytime, they may be very hard to be recognized by car drivers during night, which is our innovation to create a LEDs system that can effectively protect cyclists' night safety. In addition, the LED matrix can also react to the music playing in its vicinity, from which "Wearable Dance Party" derives.

## HARDWARES
There are hell lots of stuff to consider about when designing a embedded system, for anything is not easy when it messes up with the physical world.
{: .notice}

For Example:
1. What microcontroller is suitable for our purpose?
2. What kind of LEDs do we need, satisfying all the conditions? How complicated it will become if we don't have library support to control the LEDs?
3. How many IMUs do we need, how to mount them?
4. What microphone do we need?(According to )
5. What algorithms should we use to classify those inputs(Presumably Machine Learning)? If we use Machine Learning, how to learn, how to test? How much resource does it require? Can the algorithm run on a microcontroller?
6. How do we test/debug our product?
7. Where do we mount those LEDs, on a Velcro? How should the wires be organized?

After a short discussion upon these questions, we managed to draw the following conclusions:
1. We will probably use [Arduino Nano](https://store.arduino.cc/usa/arduino-nano) as the microcontroller, for it has nice library support and it's open source.
2. The LEDs have to be sewable and addressable for we won't have enough pins to control those LEDs separately. [Neopixel](https://www.adafruit.com/product/1460) might be a good choice, which also has a reasonable price.
3. 3-4 IMUs might be enough, for a IMU has every thing we need - 3-axes accelerometers, a gyroscope and even a magnetometer.
4. Our sample rate must be twice the maximum frequency of interest, according to [Nyquist–Shannon sampling theorem](https://en.wikipedia.org/wiki/Nyquist%E2%80%93Shannon_sampling_theorem). So in this case, maybe 7000Hz is enough, for telephone networks work up to about 3400Hz(Although human can hear sounds up to 20kHz).
5. One way to handle transferring the high dimensional signal into simple categories is Machine Learning. `[PCA](https://en.wikipedia.org/wiki/Principal_component_analysis)` plus `[Gaussian naive Bayes](https://en.wikipedia.org/wiki/Naive_Bayes_classifier)` will probably work for us. Alternatively, raw data window plus `[KNN](https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm)` using either a [`dynamic time warping](https://en.wikipedia.org/wiki/Dynamic_time_warping)` or the `[skorokhod metric](https://www.encyclopediaofmath.org/index.php/Skorokhod_topology)`should work.
6. The ability to take inputs from a serial port connected to a laptop will really help us to test/debug without really riding a bike. Also, if we wish to send back state/sensor information over the serial port, [protobufs](koti.kapsi.fi/jpa/nanopb/) is recommended by Marcell, one of our GSIs.
7. Yes, we will probably mount those LEDs on a velcro.

## ALGORITHMS
 

## SCHEDULES
1. Requirements Analysis and Specification
2. Architecture design.
3. Implementation and Integration
4. Verification.
5. Maintenance.
It believes that "Earlier catch bug, cheaper it is". But it requires extensive documentations, which may be too heavy and even too “clumsy” sometimes.

## TOOLS
* [Github](https://github.com/) to perform version control.
* [Pivotal Tracker](http://pivotaltracker.com/) for project management. We can use points and velocity to track our current progress and to predict our future progress.
* [Heroku](https://heroku.com/) for deploying our app. (This is only for those who don't have the access to a personal server. But it's indeed a perfect way to check your code structure and independency.)
* [Travis CI](http://travis-ci.org/) for automatically running tests, which is called **continuous integration(CI)** by some people.
* [Coveralls](http://coveralls.io/) for detailed test coverage measurements.
* [CodeClimate](http://codeclimate.com/) for reporting on the quality and robustness of our source code. (Static Analysis.)
