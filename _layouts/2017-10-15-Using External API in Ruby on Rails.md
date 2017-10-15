---
layout: post
title:  "Using External APIs in Rails"
date:   2017-10-15
excerpt: "Explain basic logic of online payment using the example of Figaro and Stripe..."
project: true
tag:
- Tools
- Ruby on Rails
- Audience1st
comments: true
---	
Audience1st uses [`figaro`] to manage secrets. As mentioned in the [Get Started with Legacy Project](http://jackwan.win/Get-Started-with-Legacy-Project/). And it uses [`Stripe`](https://stripe.com/docs/api/ruby#intro) to deal with online payments.

## [Figaro](https://github.com/laserlemon/figaro)
`figaro` will generate a git-ignored file `config/application.yml` for secrets management.
In `Audience1st`, it looks like this:
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

You can use `ENV['stripe_key']` or `Figaro.env.stripe_key`, which totally depends on personal preference, to access the secrets you set in `config/application.yml`. Using a tool to manage secrets is a very good practice in terms of separating dependencies.

## [Stripe](https://stripe.com/docs/api/ruby#intro)
*You should **never include your API keys in plaintext** as is showed in the API documentations of `Stripe`, because they do this for readability.*
{: .notice}

Here's a typical charge action using `stripe`, it will return a `JSON` object:
{% highlight ruby %}
require "stripe"
Stripe.api_key = "wublubdabuda"

Stripe::Charge.create({
  # 2000 means $20.00, the unit is *cent*
  :amount => 2000,
  :currency => "usd",
  :source => "tok_mastercard", # obtained with Stripe.js
  :description => "Charge for jackwan@example.com"
}, {
  :idempotency_key => "O64FLjrM6fK1giod"
})
{% endhighlight %}

NOTE: **Credit card information is sent directly to Stripe, ensuring sensitive data never hits your servers, all you get is a token.**
{: .notice} 

NOTE FURTHER: **Genuine card information cannot be used in test mode.** Instead, use any of the following test card numbers, a valid expiration date in the future, and any **random** CVC number, to create a successful payment.
{: .notice}

| Number | Brand |
| --- | --- |
| 4242<span></span>4242<span></span>4242<span></span>4242 | Visa |
| 4000<span></span>0566<span></span>5566<span></span>5556 | Visa (debit) |
| 5555<span></span>5555<span></span>5555<span></span>4444 | Mastercard |
| 5200<span></span>8282<span></span>8282<span></span>8210 | Mastercard (debit) |
| 5105<span></span>1051<span></span>0510<span></span>5100 | Mastercard (prepaid) |
| 3782<span></span>822463<span></span>10005 | American Express |
| 3714<span></span>496353<span></span>98431 | American Express |
| 6011<span></span>1111<span></span>1111<span></span>1117 | Discover |
| 6011<span></span>0009<span></span>9013<span></span>9424 | Discover |
| 3056<span></span>9309<span></span>0259<span></span>04 | Diners Club |
| 3852<span></span>0000<span></span>0232<span></span>37 | Diners Club |
| 3530<span></span>1113<span></span>3330<span></span>0000 | JCB |

To better understand `Stripe`, check this out:
{% capture images %}
	/assets/img/projects/Audience1st/Stripe.jpeg
{% endcapture %}
{% include gallery images=images caption="- From Anonymous" cols=1 %}


