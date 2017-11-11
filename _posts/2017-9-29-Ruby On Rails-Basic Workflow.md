---
layout: post
title: Ruby on Rails: Basic Workflow
date: 2017-9-29
excerpt: "Basic workflow and mechanisms when using RoR..."
note: ture
tag:
- Ruby on Rails
comments: true
---
## RoR Framework
Ruby on Rails is a **open source** software designed for modern **web application**. It has a large community base, which makes this framework very vital. `Github`, `Airbnb`, `Twitch` are all written in Ruby on Rails.

It has two major concepts:

1. Convention Over Configuration
2. DRY (Don't Repeat Yourself)

## Get Started
The following command will automatically generate a RoR framework in the selected directory.

`rails new ${directory_name}`
{: .notice}

Once generated, the framework can be put into deployment. But it is just a "Welcome Page" of Rails.

`rails server` or `rails s`
{: .notice}

## Controllers and Models
To create **a controller called "Welcome"** with an **action called "index"**, do this:

`rails generate controller Welcome index`
{: .notice}

This will generate the following things:

| Category	 | Path / Content |
| --- | --- |
| controller | app/controllers/welcome_controller.rb |
| route | get 'welcome/index' |
| view-dir | app/views/welcome |
| view | app/views/welcome/index.html.erb |
| test-unit | test/controllers/welcome_controller_test.rb |
| helper | app/helpers/welcome_helper.rb |
| coffee | app/assets/javascripts/welcome.coffee |
| scss | app/assets/stylesheets/welcome.scss |

To create **a model called Article** along with two attributes called **title of type string** and **content of type text**, use the following command([Get more info about Active Record here](http://guides.rubyonrails.org/active_record_basics.html)):

`rails generate model Article title:string content:text`
{: .notice}

This will automatically generate the following things:

| Category | Path / Name|
| --- | --- |
| migration | db/migrate/${time-stamp}_create_posts.rb |
| model | app/models/post.rb |
| test-unit | test/models/post_test.rb |
| test-fixtures | test/fixtures/posts.yml |


## DataBase Setup

To run a migration([Get more info about migration here.](http://guides.rubyonrails.org/active_record_migrations.html)):

`rails/rake db:migrate [RAILS_ENV=${production, development}]`
{: .notice}

This command **creates a local development database** (following the specifications in config/database.yml) and **runs the migrations in db/migrate to create the app's schema**. It also **creates/updates the file db/schema.rb** to reflect the latest database schema. Note: **it's important to keep this file under version control**. The default `RAILS_ENV` is development.

After that, if we want to insert some initial data into the database for testing, we can write some code in `db/seeds.rb`, and run the following command:

`rails/rake db:seed`
{: .notice}

To save data to the database:

{% highlight  ruby %}
def create
  @article = Article.new(params[:article])
 
  @article.save
  redirect_to @article
end
{% endhighlight ruby %}

## [Add Validations to Models](http://guides.rubyonrails.org/active_record_validations.html)
{% highlight  ruby %}
class Article < ApplicationRecord
  validates :title, presence: true, length: { minimum: 5 }
end
{% endhighlight ruby %}

## Delete Items
The delete routes is `DELETE /articles/:id(.:format)` => articles#destroy. So lets add a method in the Article model:

{% highlight  ruby %}
def destroy
  @article = Article.find(params[:id])
  @article.destroy
  redirect_to articles_path
end
{% endhighlight ruby %}

In view, the link should look like this:
{% highlight  ruby %}
<%= link_to 'Destroy', 
	article_path(article),
	method: :delete,
	data: { confirm: 'Are you sure?' } %></td>
{% endhighlight ruby %}





