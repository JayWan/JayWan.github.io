---
layout: post
title:  "Learning to use CMakeLists.txt"
date:   2017-4-28
excerpt: "Notes when learning to use this powerful tool..."
note: true
tag:
- C/C++
comments: true
---
## ORIGIN
CMake was created in response to the need for a powerful, cross-platform build environment for the Insight **Segmentation and Registration Toolkit** (ITK) funded by NLM as part of the Visible Human Project.

CMake is used to control the software compilation process using simple **platform and compiler independent configuration files**.

***I believe that this is to implement independency of the configs from the code, for that configs vary a lot across platforms and deployment while code doesn't.***
{: .notice}

I think the purpose is very much the same as `gemfile` in `Ruby` and `package.json` in `Node.js`, although they are two completely different languages.

## INTRODUCTION
The build process is controlled by **creating one or more CMakeLists.txt files** in each directory (including subdirectories) that make up a project. 

Each CMakeLists.txt consists of **one or more commands**. Each command has the form `COMMAND (args…)` where `COMMAND` is the name of the command, and args is a white-space separated list of arguments. `CMake` provides many pre-defined commands, but if you need to, you can add your own commands.

So this is basically how `CMake` works.

## BUILD-SYSTEM
A CMake-based buildsystem is organized as **a set of high-level logical targets**. **Each target corresponds to an executable or library,** or is a custom target containing custom commands. **Dependencies between the targets are expressed in the buildsystem to determine the build order and the rules for regeneration in response to change**.

`Executables` and `libraries` are defined using the `add_executable()` and `add_library()`commands. Dependencies between binary targets are expressed using the `target_link_libraries()` command:

{% highlight  CMake%}
add_library(archive archive.cpp zip.cpp lzma.cpp)
add_executable(zipapp zipapp.cpp)
target_link_libraries(zipapp archive)
{% endhighlight %}

> `archive` is defined as a static library – an archive containing objects compiled from `archive.cpp`, `zip.cpp`, and `lzma.cpp`. `zipapp` is defined as an executable formed by compiling and linking `zipapp.cpp`. When linking the `zipapp` executable, the `archive` static library is linked in.

## EXAMPLES
### Built executable from source code files

{% highlight  CMake%}
cmake_minimum_required (VERSION 2.6) 	# Version
project (Tutorial) 			# Project Name
add_executable(Tutorial tutorial.cxx) 	# Project SourceCode
{% endhighlight %}

This example uses lower case commands in the CMakeLists.txt file. **Upper, lower, and mixed case commands are supported by CMake.**
{: .notice}

### Adding a version number and configured header file

{% highlight  CMake%}
...
set (Tutorial_VERSION_MAJOR 1) # Set variables
set (Tutorial_VERSION_MINOR 0) # Version Numbers

# configure a header file to pass some of the CMake settings to the source code
configure_file (
  "${PROJECT_SOURCE_DIR}/TutorialConfig.h.in"
  "${PROJECT_BINARY_DIR}/TutorialConfig.h"
)

# Add the binary tree to the search path for include files, so that we will find TutorialConfig.h
include_directories("${PROJECT_BINARY_DIR}")
...
{% endhighlight %}

Since **the configured file will be written into the binary tree** we must add that directory to the list of paths to search for include files. We then create a TutorialConfig.h.in file in the source tree with the following contents:

{% highlight  C++ %}
// the configured options and settings for Tutorial
#define Tutorial_VERSION_MAJOR @Tutorial_VERSION_MAJOR@
#define Tutorial_VERSION_MINOR @Tutorial_VERSION_MINOR@
{% endhighlight %}

## CRITICAL THINKINGS
1. It is cross-platform, which is good in terms of **maintainability**.
2. When compared with `make`, its syntax makes more sense to human beings, which is good in terms of **readability**.
3. It is more like a `config` file than `makefile` because it can easily pass some parameters to the binary tree, which is good in terms of **changeability**.