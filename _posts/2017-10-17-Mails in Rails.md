---
layout: post
title: Mailers in Rails
date: 2017-10-17
excerpt: "API reading notes..."
project: ture
tag:
- Ruby on Rails
comments: true
---
Usually, a sophisticated app will send their users all kinds of e-mails including confirmation e-mails, verification e-mails and so on. In Rails, we can use `ActionMailer` or External APIs. Here, I provide a solution using `ActionMailer`. Below is part of the summary of the official tutorial.

## Create A Mailer
You can use a `generator` or create a file in the directory -  `app/mailers`, **just make sure that it inherit from `ActionMailer::Base` and have associated views that appear in `app/views`**.

##Core Concept
**NOTE:** Mailers are very similar to Rails controllers. They also have methods called "actions" and use views to structure the content.
{: .notice}

If we create a mailer called MyMailer like this:

{% highlight  ruby %}
class MyMailer < ActionMailer::Base
  # Set the default sender address
  default from: 'notifications@example.com'
 
  def welcome_email(user)
    @user = user
    @url  = 'http://example.com/login'
    # Pass the :to and :subject headers in
    mail(to: @user.email, subject: 'Welcome to My Awesome Site')
  end
end
{% endhighlight %}

* `default` is a Hash contains all default values for any email you send from this mailer.
* `mail` is the actual email message

This will create a number of routes for each of the articles and comments controller. For Admin::ArticlesController, Rails will create the following 7 routes by default:

The corresponding view - `welcome_emails.html.erb` in `app/views/my_mailer` may look like this:
{% highlight html %}
<!DOCTYPE html>
<html>
  <head>
    <meta content='text/html; charset=UTF-8' http-equiv='Content-Type' />
  </head>
  <body>
    <h1>Welcome to example.com, <%= @user.name %></h1>
    <p>
      You have successfully signed up to example.com,
      your username is: <%= @user.login %>.<br>
    </p>
    <p>
      To login to the site, just follow this link: <%= @url %>.
    </p>
    <p>Thanks for joining and have a great day!</p>
  </body>
</html><!DOCTYPE html>
<html>
  <head>
    <meta content='text/html; charset=UTF-8' http-equiv='Content-Type' />
  </head>
  <body>
    <h1>Welcome to example.com, <%= @user.name %></h1>
    <p>
      You have successfully signed up to example.com,
      your username is: <%= @user.login %>.<br>
    </p>
    <p>
      To login to the site, just follow this link: <%= @url %>.
    </p>
    <p>Thanks for joining and have a great day!</p>
  </body>
</html>
{% endhighlight %}

NOTE: Not all clients prefer HTML emails, so also creating a file called `welcome_email.text.erb` in `app/views/user_mailer/` is the best practice. **In this case, `ActionMailer` will detect these two templates and automatically generate a `multipart/alternative` email.
{: .notice}

{% highlight html %}
Welcome to example.com, <%= @user.name %>
===============================================
 
You have successfully signed up to example.com,
your username is: <%= @user.login %>.
 
To login to the site, just follow this link: <%= @url %>.
 
Thanks for joining and have a great day!
{% endhighlight %}

**There's all kinds of things you can do with Mailers, for more detailed information check: [THIS](http://guides.rubyonrails.org/action_mailer_basics.html) out.**
* Sending multiple emails
* Attach files
* Insert Images
* Integrated with Gmail

##Configurations
Usually, if you are using Gmail, in `config/environments/development.rb`, it may looks like this:

{% highlight ruby %}
Rails.application.configure do
  ...
  config.action_mailer.smtp_settings = {
    address: 		'smtp.gmail.com',
    port:				587,
    domain:       	'my_app.com',
    user_name:		ENV['GMAIL_USERNAME'],
    password:         ENV['GMAIL_PASSWORD'],
    authentication:  'plain',
    enable_starttls_auto: true  }
  ...
  config.action_mailer.delivery_method = :test
end
{% endhighlight %}

But in `config/environments/production.rb`, `action_mailer.delivery_method` will probably be `:smtp` or `:sendmail`. **If it's `:smtp`, we should set `config.action_mailer.perform_deliveries` to `true` as well**.