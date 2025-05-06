---
layout: blog_post
author: Lucas Wilson
title: Static site generation with Jekyll and Docker
excerpt: Why I chose Jekyll as a small static site generator, and how I set up my environment for rapid iteration.
series: JekyllBlogWebui
tags: 
    - webui
    - docker
    - jekyll
---

Recently I've decided to make a development blog so that I can detail projects I've worked on and the solutions and outcomes I've arrived at. The motivation was to avoid having a bloated "Projects" section in my C.V. which many people would not read anyway. This would also give me somewhere to write down my reasoning on my projects so that in the future I could have a resource to return to if-and-when I pick up older projects after a pause.  

<div class="blog-section-header"> 
    <h2 style="margin-bottom: 0;"> Choosing a generator </h2>
    <h5 style="margin-top: 0;"> Jekyll vs Hugo </h5>
</div>

I knew I wanted to use a static site generator so that I could host on github pages. The github recommended static generator is Jekyll, although many users in online discussion recommend Hugo instead of Jekyll claiming "Compile times for extremely large sites are quick."

My intention was to make a very small and lightweight site, so I was looking for the simplest static generator I could find. I wanted something with few dependencies and a very simple and quick to learn templating syntax. Jekyll with Liquid offered this, and the speed of static compilation was not going to be a major concern for me so I discarded the argument. Another downside I found to picking Hugo was the limited documentation, community and support. 

<div class="table-wrapper">
    <table>
        <thead>
            <tr>
                <th>Feature</th>
                <th>Jekyll</th>
                <th>Hugo</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Fast compile times</td>
                <td><i class="fa-solid fa-xmark" style="color: #d33;"></i></td>
                <td><i class="fa-solid fa-check" style="color: #3c3;"></i></td>
            </tr>
            <tr>
                <td>Well documented</td>
                <td><i class="fa-solid fa-check" style="color: #3c3;"></i></td>
                <td><i class="fa-solid fa-xmark" style="color: #d33;"></i></td>
            </tr>
            <tr>
                <td>Simple template system</td>
                <td><i class="fa-solid fa-check" style="color: #3c3;"></i></td>
                <td><i class="fa-solid fa-xmark" style="color: #d33;"></i></td>
            </tr>
            <tr>
                <td>Few requirements</td>
                <td><i class="fa-solid fa-check" style="color: #3c3;"></i></td>
                <td><i class="fa-solid fa-check" style="color: #3c3;"></i></td>
            </tr>
        </tbody>
    </table>
</div>

Admittedly I did not spend a particularly long time weighing up the pros & cons of the two, and this is merely what I scraped together after ten minutes on the internet. I wish I could pretend that some deeper analysis went on, but it really came down to asking "What is the lowest effort to use?" and initially the answer seemed to be Jekyll. *subtle foreshadowing*

<div class="blog-section-header"> 
    <h2 style="margin-bottom: 0;"> Initial Experience </h2>
    <h5 style="margin-top: 0;"> The first problems emerge </h5>
</div>

Getting started was incredibly simple, I just followed the instructions in the github tutorial, and I had a new repo set up and cloned, with a basic set of conventient driven directories. The core concept was simple enough, /_layouts/ would provide a place where I could put reusable html layouts, /assets/ would let me store some stylesheets and at the root level I could have an index.md which would be transformed into an html page by the jekyll page compiler.

This was great until I tried to actually write some content and do some styling iteratively and I discovered a fairly big problem: 

*The github actions for compiling the page on push were incredibly slow for iterative development.*

Trying to tweak a page and add different styles, slightly moving aboutt elements, or even just testing structural changes like adding tagging, was incredibly slow. Each change I wanted to test, I would have to commit and push. Quickly I started flooding my git history with increasingly meaningless commit names and waiting a few minutes to see a one-liner tweak is not productive. 

I needed to be able to locally build my site using jekyll, and then I could test my static site just by visiting it with a local browser.

<div class="blog-section-header"> 
    <h2 style="margin-bottom: 0;"> Building The Site Locally </h2>
    <h5 style="margin-top: 0;"> The first problems emerge </h5>
</div>

<div class="table-wrapper">
    <img src="{{ site.baseurl }}/assets/posts/2025-05-03-DockerJekyll/images/ruby.png">
    <span class="caption">
        A frustrated developer does not want to install Ruby to use Jekyll (Literally me)
    </span>
</div>

Echoing the sentiment of Nick Santos from his blog post: [How I built a Simple Static Jekyll Site Without Installing Ruby: A Rant](https://medium.com/windmill-engineering/how-i-built-a-simple-static-jekyll-site-without-installing-ruby-a-rant-b7e87fb123d0) 

Ruby is fine. I just don't want it on my system. *It's not you it's me.*

Following his approach, I decided I would use docker to put ruby into a container. Once it works there, I don't need to faff about worrying whether it will build in the future. I can just send "jekyll build" through to the container to get it to build my source tree.

Of course, Docker requires WSL to run on Windows, which I also didn't want... 
Cue one install of rEFInd and Arch Linux later, and I can dual boot my dev system. *(I use Arch btw)*

The actual setup of the docker container was very simple:
- Install docker: `sudo pacman -S docker`
- Enable the docker daemon and start the service: `sudo systemctl enable docker && systemctl start docker`
- Create a directory for the container: `mkdir -p ~/Development/docker/containers/jekyll`
- Enter the directory: `cd ~/Development/docker/containers/jekyll`
- Write a Dockerfile to pull Debian and install ruby, bundler and jekyll. Optionally start serving the site from the container. 
- Create the docker container named jekyll-debian: `sudo docker build -t jekyll-debian .`

My Dockerfile can be found here:
<a href="{{ site.baseurl }}/assets/posts/2025-05-03-DockerJekyll/other/Dockerfile" download>Download</a>

Once it was set up, it was a one-liner to use the container to build my site:
```
sudo docker run --rm -v "$PWD":/srv/jekyll jekyll-debian jekyll build
```
By mapping my current working directory into the container at /srv/jekyll and setting the container working dir as /srv/jekyll it means that I can run the build command from any repo where I am making a jekyll site, and the output will be written from the container into my host fs. 

I ended up writing a simple function into my bash.bashrc to make this *even easier and more convenient*
```Bash   
# jekyll builder
jekyll_build() {
    local site_path="$1"

    if [ -z "$site_path" ]; then
        echo "Usage: jekyll-build /path/to/jekyll/site_root_folder"
        return -1;
    fi

    sudo docker run --rm \
        -v "$site_path":/srv/jekyll \
        jekyll-debian \
        jekyll build
}
```

Now I can build any dir at will by running `jekyll_build {path}` e.g. `jekyll_build .` and I get my built site written to the /_site/ folder

<div class="table-wrapper">
    <img src="{{ site.baseurl }}/assets/posts/2025-05-03-DockerJekyll/images/build.png">
    <span class="caption">
        Building my site in a oneshot one-liner command
    </span>
</div>

I can also serve the site (if I am use localstorage etc and need domain to be consistent)
```
sudo docker run -p 4000:4000 -rm -v $(pwd):/srv/jekyll jekyll-debian
```
Saving any changes will even dynamically reload the served content!

Overall I have found the experience using Jekyll from a Docker container to be very pleasant. My site is pushed to git whenever I have it at a stable point I'm satisfied with, and I can remake the Docker container for jekyll building very easily if my dev machine hard drive were to fail. If I need to work on it on a different machine, so long as I have access to docker, I can do so. 

I might make another post on actually designing the tagging system for my blog, but Jekyll made it so simple that it may not warrant it.