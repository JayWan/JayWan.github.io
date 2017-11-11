---
layout: post
title: Ruby on Rails: Syntax Sugar
date: 2017-10-14
excerpt: "About `Routes` and `Controller Filters` ..."
note: ture
tag:
- Ruby on Rails
comments: true
---
Today I browsed the source code of "Audience1st", during which I found many interesting things. I write them down just for future review. 

## Routes
Speaking of routes in Ruby on Rails, we have to go into the file `config/routes.rb` to see what's going on.

**It's good practice to separate different user groups in RESTful routes**. Most commonly, you might group a number of administrative controllers under an Admin:: namespace. You would place these controllers under the app/controllers/admin directory, and you can group them together in your router: 
{% highlight  ruby %}
namespace :admin do
  resources :articles, :comments
end
{% endhighlight %}

This will create a number of routes for each of the articles and comments controller. For Admin::ArticlesController, Rails will create the following 7 routes by default:

| HTTP Verb | Path | Controller#Action | Named Helper |
| --- | --- | --- | --- |
| GET | /admin/articles | admin/articles#index | admin_articles_path |
| GET | /admin/articles/new | admin/articles#new | new_admin_article_path |
| POST | /admin/articles | admin/articles#create | admin_articles_path |
| GET | /admin/articles/:id | admin/articles#show | admin_article_path(:id) |
| GET | /admin/articles/:id/edit | admin/articles#edit | edit_admin_article_path(:id) |
| PATCH/PUT | /admin/articles/:id | admin/articles#update | admin_article_path(:id) |
| DELETE | /admin/articles/:id | admin/articles#destroy | admin_article_path(:id) |

As for `config/routes`, in Audience1st, we have:

Notice the comment sections
{: .notice}

{% highlight  ruby %}

Rails.application.routes.draw do
  # :format => false means that this app only returns 'html'
  scope :format => false do
    # Root Path
    root :to => 'customers#show'

    resources :bulk_downloads
    resources :account_codes
    
    # :expect indicates that rails should not include the routes in the list
    resources :imports, :except => [:show] do
      # 'member do' enables Rails to create a path 'imports/1/download_invalid'
      member do
        get :download_invalid
      end
      # 'collection do' enables Rails to create a path 'imports/help', contrast with 'member'
      collection do
        get :help
      end
      ...
    end
  end
end

{% endhighlight ruby %}

## Controller
{% highlight ruby %}
class CustomersController < ApplicationController

  # Actions requiring no login, customer login, and staff login respectively
  ACTIONS_WITHOUT_LOGIN = %w(new user_create forgot_password)
  CUSTOMER_ACTIONS = %w(show edit update change_password_for change_secret_question)
  ADMIN_ACTIONS =  %w(create search merge finalize_merge index list_duplicate auto_complete_for_customer_full_name)

  # All these filters redirect to login if trying to trigger an action without correct preconditions.
  before_filter :is_logged_in, :except => ACTIONS_WITHOUT_LOGIN
  before_filter :is_myself_or_staff, :only => CUSTOMER_ACTIONS
  before_filter :is_staff_filter, :only => ADMIN_ACTIONS
  
  # This will skip the before filter - 'verify_authenticity_token' for the action 'auto_complete_for_customer_full_name'
  skip_before_filter :verify_authenticity_token, %w(auto_complete_for_customer_full_name)
  ...
end
{% endhighlight %}

NOTE: `ApplicationController` is practically the class **which every other controller in you application is going to inherit from** (although this is not mandatory in any mean). In this case, :is_logged_in is an instance method in `application_controller.rb`.
{: .notice}
