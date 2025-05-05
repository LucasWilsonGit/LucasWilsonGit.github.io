---
layout: default
title: Home
---
{::options parse_block_html="true" /}

<h1>Index</h1>

Here you may find some of my latest posts, and a complete tag list.

<div class="posts-feed">
  <h2>Recent Posts</h2>
  {% for post in site.posts limit:5 %}

<div class="post-item">
<a href="{{ site.baseurl }}{{ post.url }}">{{ post.title }}</a><br>
<span class="post-meta">
    {{ post.date | date: "%B %d, %Y" }}
    {%- for tag in post.tags  -%}
&nbsp;| <span class="post-tag"><a href="{{ site.baseurl }}/tags/{{ tag }}.html">{{ tag }}</a></span>
    {%- endfor -%}
</span>
</div>

  {% endfor %}
</div>

<h2>Tags</h2>

{%- assign sortedtags = site.tags | sort -%}
{%- for tag in sortedtags -%}
<h3 id="tag_header">{{ tag[0] }}</h3>
<ul>
{%- for post in tag[1] -%}
<li><a href="{{ post.url }}">
{{ post.date | date: "%b %d, %Y" }} - {{ post.title }}
</a></li>
{%- endfor -%}
</ul>
{%- endfor -%}