---
layout: default
title: Home
---

# Title1!

Body message.

# Tags

{% capture tags %}
  {% for tag in site.tags %}
    {{ tag[0] }}
  {% endfor %}
{% endcapture %}
{% assign sortedtags = tags | split:',' | sort %}
{% for tag in sortedtags %}
    <a href="/tags/{{ tag }}/">{{ tag }}</a><br>
{% endfor %}