---
layout: post
title:  "The use of .gitignore"
date:   2016-10-28
excerpt: "用.gitignore忽略文件"
project: true
tag:
- coding
comments: true
---



# 大作业的痛苦
最近在写大作业，用Github做版本控制，小组里就我一个人用的Mac，而且系统老是自动生成`.DS_Store`文件，在网上查了怎么取消掉的命令行，输入<b>Terminal</b>，无果。更痛苦的是，每次一修改源代码，就会有一堆`.class`文件的changes，随之而来的，还有一堆conflicts，简直迷醉啊有木有。于是乎，我找到了<b>Solution</b>。

# Solution
可以使用修改根目录中 .gitignore 文件的方法（如无，则需自己手工建立此文件) 建立方法

{% highlight git %}
touch .gitignore
vim .gitignore
{% endhighlight %}

这个文件忽略的规则：

{% highlight git %}
*.a       # 忽略所有 .a 结尾的文件
!lib.a    # 但 lib.a 除外
/TODO     # 仅仅忽略项目根目录下的 TODO 文件，不包括 subdir/TODO
build/    # 忽略 build/ 目录下的所有文件
{% endhighlight %}
---
但是我添加后，按照上述方法定义后发现并未生效，原因是.gitignore只能忽略那些原来没有被track的文件，如果某些文件已经被纳入了版本管理中，则修改.gitignore是无效的。那么解决方法就是先把本地缓存删除（改变成未track状态），然后再提交：
{% highlight git %}
git rm -r --cached .
git add .
git commit -m 'update .gitignore'
{% endhighlight %}

之后，就再也不用忍受一堆.class文件啦！
