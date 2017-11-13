---
layout: post
title:  "Using Git as a VCS"
date:   2017-10-30
excerpt: "Some notes and tips when using Git..."
project: true
tag:
- SE
- Git
comments: true
---	

## Software Engineering & VCS

Version control is always a very essential part of SE. But in practice, people always keep forgetting the principles and tips given by their college teachers or the reference books, making their repository a piece of mess, which is definitely no good. It is very easy to make things messy but not the other way around. So as professional developers, we must develop a good habit of using VCSs such as `Git`.

Here are some tips when using Git, **thanks to Professor Armando Fox**:

1. Creating a branch is free, and it can largely help you keep your repo clean. So **create a new branch for every single one of your new features**, which is called - ***branch per feature***.
	* Use branch only for changes needed for that feature. No other stuff.

2. **Make sure `Master` is always good for deployment.**
	* Develop from feature branches and deploy from `Master`.

3. **Always use a `Pull Request`** as **code reviews** to push your code to `Master`, don't use `git merge`.
	* At Google, no code gets checked in unless at least 1 person reviews it, even if review is just to say “Looks good to me” (LGTM).

**NOTE**: Some people get confused why `Pull Request` is called so instead of `Push Request`. This is because `Pull Request` is asking `Master` to pull/accept your code - "Please pull my code to origin." And if you use `Push Request`, it should be `Master` asking you to push your code.
{: .notice}

## PostScript

Frankly speaking, I've been using [`Github Desktop`](https://desktop.github.com/), and found it very easy to use. The problem is that there's always someone saying that using a GUI is not very ***programmeric***(yes, I made this up), which makes me kind of awkward.

So, I decide to become a "real programmer" from now on, how about cutting the mouse wire and cracking the touchpad?

So, the following commands are life skills of a real programmer and you can easily get all of them by simply typing `git` in your command line:

{% highlight git %}
git help   	# Help! Help!

git init     	# Create an empty Git repository or reinitialize an existing one
git clone 	# Clone a repository into a new directory

git add 	# Add file contents to the index
git rm  	# Remove files from the working tree and from the index

git diff	# Show changes between commits, commit and working tree, etc
git status 	# Show the working tree status
git commit	# Record changes to the repository. You can also add [-m "commit messages"] to it
git push     	# Update remote refs along with associated objects
git pull       	# Fetch from and integrate with another repository or a local branch

git branch 	# List, create, or delete branches
git checkout	# Switch branches or restore working tree files
git merge      	# Join two or more development histories together
git tag        	# Create, list, delete or verify a tag object signed with GPG
{% endhighlight %}

