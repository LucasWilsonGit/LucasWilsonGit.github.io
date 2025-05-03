---
layout: default
title: Home
---

<h1>Title1!</h1>

Body message.

<h2>Posts:</h2>>

{% for post in site.posts %}
<a href="{{ post.url }}/">{{ post.title }}</a>
{% endfor %}

<h2>Tags</h2>

{% assign sortedtags = site.tags | sort %}
{% for tag in sortedtags %}

    <h3 id="tag_header">{{ tag[0] }}</h3>
    <ul>

    {% for post in tag[1] %}

        <li><a href="{{ post.url }}">{{ post.title }}</a></li>

    {% endfor %}

    </ul>
    
{% endfor %}