---
layout: default
title: Home
---

# Title1!

Body message.

### Posts:

{% for post in site.posts %}
<a href="{{ post.url }}/">{{ post.title }}</a>
{% endfor %}

# Tags

{% capture tags %}
  {% for tag in site.tags %}
    {{ tag[0] }}
  {% endfor %}
{% endcapture %}
{% assign sortedtags = tags | split:'|' | sort %}

{% for tagname in sortedtags %}
    <h3 id="tag_header">{{ tagname }}</h3>
    <ul>
    {% for post in site.tags[tagname] %}
        <li><a href="{{ post.url }}/">{{ post.title }}</a></li>
    {% endfor %}
    </ul>
{% endfor %}