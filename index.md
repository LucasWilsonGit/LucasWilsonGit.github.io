---
layout: default
title: Home
---

# Title1!

Body message.

# Tags

{% capture tags %}
  {% for tag in site.tags %}
    <p>Debug tag: {{ tag }}</p>
    {{ tag[0] }}
  {% endfor %}
{% endcapture %}
{% assign sortedtags = tags | split:'|' | sort %}

{% for tag in sortedtags %}
    <h3 id="tag_{{ tag }}">{{ tag }}</h3>
    <ul>
    {% for post in site.tags[tag] %}
        <li><a href="{{ post.url }}/">{{ post.title }}</a></li>
    {% endfor %}
    </ul>
{% endfor %}