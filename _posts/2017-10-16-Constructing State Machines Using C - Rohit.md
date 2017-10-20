---
layout: post
title:  "Constructing State Machines Using C"
date:   2017-10-16
excerpt: "A brief conversation with Rohit..."
interview: true
tag:
- coding
comments: true
---

The motivation of starting this conversation is that I had been having a great pain use all kinds of `variables` and `switch-case block` to deal with those transition guards in extended state machines. So I asked **Rohit Ramesh**, one of my instructors of EECS 149, about this issue. And we discussed upon this topic for nearly an hour, it was a brief conversation, but I found many things very useful.

# What's wrong with switch-case?
Since Miro Samek elaborated on this issue very well, I will just include a large block of quotes from one of his articles - *How to Code a State Machine in C or C++*, in which he explained why the conventional `switch-case` structure is not a good practice and provided us with a simple solution.

> The main challenge in programming reactive (event-driven) systems is to **correctly identify the appropriate piece of code to execute in response to a given event**. In all but the most trivial reactive systems, the response depends both on the nature of the event and, **more importantly, on the history of past events in which the system was involved**.

This is true, most interesting systems are compositions of different kinds of state machines, using **cascade compositions, hierarchical compositions and (a)synchronous compositions as well**. These compositions can become very complicated very easily. The question of how can we efficiently decoupling these compositions with respect to programming languages is the major reason of why I am writing this post right now.

> From the programming perspective, this dependence on context very often leads to deeply nested `if-else` or `switch-case` constructs. Most reactive programs start out fairly simple and well structured, but as features are grafted on, **more and more flags and variables are introduced to capture the relevant event history**. Then `if`s and `else`s must be added to test the increasingly complex logical expressions built out of the various variables and flags (AKA **spaghetti**), until no human being really has a good idea what part of the code gets executed in response to any given event.

{% capture images %}
/assets/img/interviews/spaghetti-code.jpg
{% endcapture %}
{% include gallery images=images caption="" cols=1 %}

From the software engineering's point of view, the maintainability and scalability of **spaghetti code** is weak. It is a product of individualistic heroism instead of a standard product of engineering. These kind of problems have been addressed long time ago. *Goto statement considers harmful.* is a paper written by Dijkstra, arguing that using `goto` statement in C language is not a good practice. A related joke is *Comefrom statement considers harmful*, indicating that one piece of code will suddenly jump to another piece of code for there is a `comfrom` statement at the top of the latter code.

# A possible design pattern

Let's say you want to construct a state machine for a Hill Climb robot, in order to make it able to climb straight towards the top of a slope and avoid the obstacles set on the slope without dropping down the cliff. Now what would you do to just get start with this problem?

According to what is suggested by Rohit, I drew a simple picture to address the idea of his, here's what I have drown:

{% capture images %}
/assets/img/interviews/design-pattern.png
{% endcapture %}
{% include gallery images=images caption="" cols=1 %}

The whole point of the graph is to address the idea of **Break the problem into small parts**. And it's very similar to `Hierarchical Composition`.

* The `strategic level` is designed to make decisions.
* The `middle level` is designed to do something linearly(or in specific sequence). It is trying to have the job designated by the upper level done.
* The `control level` is used to make sure that the machine is actually doing its job precisely. It may contains something like a feedback loop to correct the possible errors. 

In the case of hill climbing, the whole design should be:
* The `strategic level` controls the transition logic, per se, **what is the condition that the robot should go into hill climbing mode or get back to driving mode**.
* The `middle level` controls things like "obstacle avoidance". For example, the robot should turn for a angle, go forward for some distance, then turn back to its original direction and keep climbing. **It controls the sequence**.
* The `control level` controls the very detailed process, like `driving`, `adjusting angle` to keep its alignment on the hill, etc. **To accomplish these goal very well, normally, we would need a feedback loop to keep us on track**.

**NOTE**: This idea can be applied to various fields, not just EECS. Whenever you are stuck at some point, try to relax and think whether this idea can apply to your situation. Another useful thinking method is **"If do one thing directly is difficult, try to do it the other way round"**.
{: .notice}

# Live code examples
In the example code, a `state` is a data structure like this:
{% highlight C %}
struct state_t {
	void (*onStart)(STATE_PARAMS);
	void (*eachRound)(STATE_PARAMS);
    	void * stateData;
	const trigger_t (* const transitions);
};
{% endhighlight %}
It has 4 elements:

* What to do on start? - A function pointer.
* What to do in this state? - A function pointer. (In this case, Kobuki send data back at 50Hz)
* What data stored in this state? - Another datatype pointer.
* When to take transitions? - A data structure.

Here are the definition of `trigger_t` and a typical `state_t`:
{% highlight C %}
typedef struct {
	const int32_t transitionMask;
	const action_t * maneuver; // It can point to a array, which is very convenient.
} trigger_t;

const state_t orientState = {
	&orientStart, /* onStart */
	NULL, /* eachRound */ 
	NULL, /* stateData */
	TRIGGERS(6) {
		{RESET_PRESSED, // Corresponding Mask
			ACTIONS(1){changeState(START)}},
		{PAUSE_PRESSED,
			ACTIONS(1){pause()}},
		...
		{BUMP_LEFT | BUMP_CENTER | CLIFF_LEFT | CLIFF_CENTER,
			ACTIONS(5) {
				reverseFor(REVERSE_LENGTH),
				addToTargetDir(-CORRECTION_ROTATION),
				driveFor(CORRECTION_LENGTH),
				loadOrientDir(),
				drive()}},
		// The other 4 triggers
	}
};

typedef struct {
	command_t command;
	int32_t   param;	
} action_t;
{% endhighlight %}

The whole point is to efficiently use `function pointer`s and `struct`s to decoupling the interdependent codes.