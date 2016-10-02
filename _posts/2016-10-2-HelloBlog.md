---
layout: post
title:  "Hello Blog"
date:   2016-10-02
excerpt: "Hello, My coming 2017. Hello, My life."
project: true
tag:
- blog
- about
- life
comments: true
---
{% capture images %}
    /assets/img/projects/1.png
{% endcapture %}

{% include gallery images=images caption="Thanks to this girl - FYQ" cols=1 %}


# 初衷
一开始想有个自己的博客，（准确来说不是自己，而是我们俩，哈哈哈哈）是在今年暑假（就是因为上面这个人），结果感觉做个动态网站要学的东西太多，所以就先搁置。

开心的是，开学小百合的灿海学长给介绍了Jekyll，然后我回去捣鼓了一天，终于把Ruby什么的一堆环境配置好了。就开始改写代码，加自己的功能，然后又过了几天，搞出来了只属于我和上面这个人的网站，然后绑定CNAME(之前早就买好了域名，10年的)，放到GitHub Pages上托管，<b>Everything is done.</b>

所以这是我搞的第二个了，就是想给自己写点东西的动力，给点自己记录生活的激情。别每天看着身边的人一个个的都在成长，都好厉害的样子就盲目去追逐。就像长跑一样，如果你跑步时总想着追着前面那个人，那你自己的节奏就会乱，到了后程就会感觉力不从心。但行好事，莫问前程。河狭水急，人急计生。做自己想做之事，这总不是错的。


# 行动
如果你们也想自己做一个，其实也挺简单，不过没有[Jekyll](http://jekyllrb.com/)官网上说的那么简单，原话是：

> Get up and running <i>in seconds</i>.

下面简单介绍一下这几秒钟内要做的事：

* 配置Jekyll Environment，安装Ruby，什么一大堆，如果是Mac，装个Homebrew（简直神器），一个个安吧，详情见Jekyll官网，祝好运。
* 去Github上找自己喜欢的主题，找的时候一定要注意跨设备性，如果这玩意要自己写的话就很麻烦，不如让别人帮你写好，然后Fork到自己的Github上，到现在为止没用过Github的同学就...
* 简单配置网站的话，直接修改Fork下来的文件夹中的`_config.yml`文件
* 再把 `_posts` 文件夹中的样本删掉，用Markdown写出你自己的.
* 再改改这的代码，改改那的代码，加特技，最后如果想把这个网站弄的彻底的面目全非，请再在主页加上你自己的自拍。
* 在Github上把这个文件夹拷贝到`YourUserName.github.io`里，YourUserName就是Your User Name了，一定要完全一样，不然会失败。
* (optional)在GitHub的Settings里绑定自己的域名，如果你不想每次看自己的网站都要输入<i>Balabalabala.github.io</i>这么一长串的话。
     
That's all. 完全不懂编程的同学可能比较难以完成，或者完成了之后完全没办法修改，只能照搬。这个时候，只需要你完成下面的四个步骤

1. 学！
2. 习！
3. 编！
4. 程！

# 成果

{% capture images %}
	/assets/img/projects/2.png
{% endcapture %}

{% include gallery images=images caption="Screenshots of My Page" cols=1 %}

---

# 尾声
最后如果有人做了，或者已经有了，可以通过各种途径告诉我，以后可以多多交流，刚好我也想加个`FRIENDS`模块，里面列出友情链接，哈哈哈。

