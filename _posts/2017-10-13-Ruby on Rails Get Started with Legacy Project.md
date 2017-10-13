---
layout: post
title:  "Legacy Projects in Ruby on Rails"
date:   2017-10-13
excerpt: "Ruby Rails Audience1st"
project: true
tag:
- Ruby on Rials
- Audience1st
- Notes
comments: true
---	

# Audience1st
I am working on Ruby on Rails this semester, which is very suitable for Agile/XP. [Audience1st](https://github.com/WanNJ/audience1st) is an open source project designated to offer ticketing system to local theaters, in which case they will be able to have their own customer resources in stead of just a list of names provided by the third party ticketing system. Our professor, [Armando Fox](http://www.armandofox.com/), is an excellent versatile EECS educator, who is also the creator of this repo for his love in play and music. He did this not for money but for his interests in this area, so he only charge the local theaters the money for maintaining the website.

Although the look of the website is not perfect, sometimes you may think ugly, but this is for that we have no professional front programmer in hand. But we are considering to make some improvements later.

# Migration of the project
The first thing we need to do for developing this app is to migrate it to our own development environment.

### Config
We can hardly imagine writing a useful app without using external APIs, which require tokens or passwords. **Checking these passwords or secrets in to public repos is a very bad practice.**

In [12-Factor App](https://12factor.net) methodology, it emphasizes the importance to keep configurations in the environment to implement **independency**(**strict separation of config from code**). This is because "Config varies substantially across deploys, code does not." It says:

*A litmus test for whether an app has all config correctly factored out of the code is whether the codebase **could be made open source at any moment**, without compromising any credentials.*
{: .notice}

Good practice is to ignore these config files in version control. In audience1st, `.gitignore` looks like:
{% highlight  .gitignore%}
coverage/               # Test coverage log folder
config/database.yml     # Database configuration file
db/*.sqlite3	        # Local database file
config/application.yml  # Secrets storage
log/                    # Log folder for development environment
.*                      # All system files

# Others
.bundle/
TAGS
brakeman.*
rerun.txt
public/stylesheets/venue
tmp/
{% endhighlight %}

In Ruby, we store the secrets in `config/application.yml` and we store database configurations in `config/database.yml`. As you can see, these two files are ignored by `.gitignore`. Others are explained in the comments section.

One typical `config/application.yml` may look like this:
{% highlight yaml %}
test:
session_secret: "30 or more random characters string"
stripe_key: "stripe public (publishable) key"
stripe_secret: "stripe private API key"
# include at most one of the following two lines - not both:
email_integration: "MailChimp"  # if you use MailChimp, include this line verbatim, else omit
email_integration: "ConstantContact" # if you use CC, include this line verbatime, else omit
# if you included one of the two Email Integration choices:
mailchimp_key: "optional: if you use Mailchimp, API key; otherwise omit this entry"
constant_contact_username: "Username for CC login, if using CC"
constant_contact_password: "password for CC login, if using CC"
constant_contact_key: "CC publishable part of API key"
constant_contact_secret: "CC secret part of API key
{% endhighlight %}

One typical `config/database.yml` may look like this:
{% highlight yaml %}
test:
  adapter: sqlite3
  database: db/test.sqlite3

development:
  adapter: sqlite3
  database: db/development.sqlite3
{% endhighlight %}

### Setup Database
Now we can directly run `rake db:setup`, which runs `db:migrate` followed by `db:seed` to create necessary seed data.

### To Be Continued...

