# frozen_string_literal: true

# Gives every letter a `chars` value: how many characters the letter has once markup,
# inline <style>/<script>, Liquid tags and whitespace are taken out. Themes use it to show
# how long a letter is (see _includes/letters-data.html).
#
# Why a plugin and not Liquid: the data island is rendered inside every page, and while Jekyll
# is still rendering the posts, `post.content` is HTML for the posts it has finished and raw
# Markdown for the others. Counting there gives a different number on every page. Here every
# post is still raw, so the number is the same everywhere.
#
# A `chars:` value written in a letter's front matter wins. If this plugin is ever not loaded
# (for example a build in safe mode), the island simply says 0.

module Forever221
  module LetterChars
    module_function

    def count(source)
      text = source.to_s
      text = text.gsub(%r{<(script|style)\b.*?</\1>}mi, "")        # inline code is not text
      text = text.gsub(/\{%.*?%\}|\{\{.*?\}\}/m, "")               # Liquid
      text = text.gsub(/<!--.*?-->/m, "")                          # comments
      text = text.gsub(/<[^>]+>/m, "")                             # tags, attributes included
      text = text.gsub(/!?\[([^\]]*)\]\([^)]*\)/, '\1')            # Markdown links/images: keep the text
      text = text.gsub(/^\s{0,3}(?:>|\#{1,6}|[-*+]|\d+\.)\s/, "")  # quote, heading, list markers
      text = text.gsub(/&[a-z]+;|&#\d+;/i, "")                     # entities (almost always &nbsp;)
      text.gsub(/\s+/, "").length
    end
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  site.posts.docs.each do |doc|
    doc.data["chars"] ||= Forever221::LetterChars.count(doc.content)
  end
end
