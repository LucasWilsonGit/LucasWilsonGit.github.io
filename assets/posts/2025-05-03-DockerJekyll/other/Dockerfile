FROM debian:bullseye

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    DEBIAN_FRONTEND=noninteractive \
    LANGUAGE=en_US.UTF-8

RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    build-essential \
    ruby-full \
    nodejs \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN gem install bundler jekyll

WORKDIR /srv/jekyll 

EXPOSE 4000

#Serve site
CMD ["jekyll", "serve", "--host", "0.0.0.0"]
