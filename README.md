# 221Forever

## 安装手册。

### Jekyll

1. 安装Ruby和Gem，在cmd line中运行`gem -v`和`ruby -v`看一下自己的电脑上有没有安装，如果没有报找不到命令的错就说明已经安装了，可以直接进行下一步。如果没有的话就需要按照[Jekyll官方网站](https://jekyllrb.com/docs/installation/)上的Instructions安装。
2. 进入到项目目录，在命令行中运行`gem install bundler`，这个命令安装了打包工具`bundler`（和pipenv类似）。
3. `bundle install`，这个命令会安装所有在项目根目录下`Gemfile`(类似pipenv中的Pipfile)中说明的依赖并更新`Gemfile.lock`(类似pipenv中Pipfile.lock)，和python的`pipenv install`做的事情一样。
3. 再运行`bundle exec jekyll serve`，应该就可以在本地看到网站。

### npm

安装node.js和npm(包管理工具)，这个步骤是为了生成侧边栏文章的小图片，不是必须的。可以参考[Gulp的官方网站来安装](https://gulpjs.com/docs/en/getting-started/quick-start)。

## 写文章

在`_posts`下用markdown就可以写文章，写好之后push到github上会自动触发pipeline发布到我们的网站上。

## License
Open sourced under the [MIT license](LICENSE.md).
- <https://github.com/vincentchan>
- <https://twitter.com/vincentchan>