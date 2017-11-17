---
layout: post
title:  RoR - Convention Over Configuration
date:   2017-10-9
excerpt: "Summaries of CoC principle when using RoR. Don't be confused about all of these..."
note: true
tag:
- Ruby on Rails
comments: true
---
## Variables

| Category | Example |
| --- | --- |
| Local Variables | `variable_xyz` |
| Instance Variables | `@foo` |
| Class Variables | `@@foo` |
| Constant | `THIS_IS_A_CONSTANT` |
| Global Variables | `$global` |

## Models & Controllers & DB Tables

| Category | Specification | Examples |
| --- | --- | --- |
| Models | MixedCase; Singular | **`class Post`** |
| Controllers | MixedCase; Pluralization | **`class PostsController`** |
| Primary Key | Assumed to be named `id` | **`id`** |
| Foreign Key | Assumed to be named `XXX_id` | **`author_id`** |
| Join Tables | `XXX_YYY` with the table names in alphabetical order | **`items_orders`** |

As for the **normal tables**, we **usually use pluralization of the corresponding model name**:

| Model / Class | Table / Schema |
| --- | --- |
| `Article` | `articles` |
| `LineItem` | `line_items` |
| `Deer` | `deers` |
| `Mouse` | `mice` |
| `Person` | `people` |

## Migrations

When generating a migration in RoR, we can use the commands look like this:

{% highlight  ruby %}
rails generate migration CreatePosts title:string content:text
{% endhighlight ruby %}

And `db/migrate/YYYYMMDDHHMMSS_create_posts.rb` file would be generated:

{% highlight  ruby %}
class CreatePosts < ActiveRecord::Migration[{Version-Number}]
  def change
    create_table :posts do |t|
      t.string :title
      t.text    :content
    end
  end
end
{% endhighlight ruby %}

**Because of the naming convention of RoR**, if you name the migration `Create${Models}`, the table called `${Models}` would be generated automatically, we have more of these conventions in RoR migration:

| Convention | Meaning |
| --- | --- |
| AddXXXToYYY | A migration containing the appropriate `add_column` would be generated |
| RemoveXXXFromYYY | A migration containing the appropriate `remove_column` would be generated |
| CreateJoinTableXXXYYY | A migration containing `create_join_table` of XXX and YYY would be generated |


