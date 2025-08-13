---
layout: blog_post
author: Lucas Wilson
title: Throughput optimized Datastructures
excerpt: Implementing B-Trees in C++ 
series: Datastructures
tags: 
    - Datastructures
    - C++
custom_styles:
    - "other/custom.css"
---

Recently I tried my hand at implementing a multi-index lookup, and honestly? I did a poor job of it. It's better to try and fail at home than to hit a wall on the job, so I took it as a signal to dig deeper. I found myself digging into a bigger question, on how data structures can be designed for high throughput around hardware limitations. In this post I try to organize what I learned for future reference, skating over data layouts, different datastructures and finally implementing a few.   

<div class="blog-section-header"> 
    <h2 style="margin-bottom: 0;"> Sorted Arrays </h2>
    <h5 style="margin-top: 0;"> Exploring simpler solutions for in-memory storage </h5>
</div>

Solutions should be appropriate to the problem you are solving. There are many simple datastructures which maintain a strong ordering of data, and they can often be adapted to provide extra features or invariants. We will start with a Sorted Array and look at some of the strengths and weaknesses of this datastructure and how it behaves in memory.

<div class="table-wrapper">
    <img src="{{ site.baseurl }}/assets/posts/{{ page.name | split: '.' | first }}/images/SortedArrayArch.png">
    <span class="caption">
        A simple design with partial coverage for <i>SequenceContainer</i> (no Allocator support)
    </span>
</div>

Sorted Arrays are great at what they do:
- Elements are contiguous in memory which makes linear iteration fast. 
- The simplicity of the datatsructure is a strong point in it's favour, fixed-size allocation, predictable layouts and a clear mental model make implementing maintaining Sorted Arrays trivial.
- The linear contiguous layout is easy to vectorise access

There are a few downsides though:
- The fixed length allocation means that you can end up either running out of space, or over-allocating and wasting memory. Memory is now cheap, especially with the huge addressable range, but if the utilization varies significantly then a more dynamic datastructure may be preferable.
- Insertion and Erasure can be expensive as other elements have to be shifted about to avoid gaps which can be O(n) and become expensive as the dataset becomes larger.

Once the dataset no longer fits in the CPU cache then performance of the linear iteration will decline significantly, but for smaller data-sets these still hugely outperform non-contiguous structures.

<b>Note:</b>
The extra time taken by comparisons and pipeline-dependencies in the binary search may not beat out a SIMD optimized linear search for throughput, nor even latency. [**Here is a brilliant article which demonstrates this**](http://archive.today/iipPV), comparing optimized linear and binary search through contiguous numbers. This cannot be extrapolated to conclusions on searching strings, but shows the principle that there is a trade-off between time saved avoiding cache misses vs the pure brute force throughput of an optimized linear search. The cost of cache misses scales signficantly with the amount of data you are dealing with. 

<div class="blog-section-header"> 
    <h2 style="margin-bottom: 0;"> Using multiple Sorted Arrays for Planar Data </h2>
    <h5 style="margin-top: 0;"> Adding some complexity for improved performance, and measuring results.     </h5>
</div>
The benefits of being contiguous are largely in the linear iteration speed, there will not be any unnecessary cache misses, this is often very desirable for datasets you will sweep through to update each element. This is often taken advantage of in ECS implementations, which go even further and prefer planar data and iterating components for optimum cache usage. Memory is loaded into the cache in fixed size blocks called cache lines, often multiple cache lines are pulled into cache assuming that nearby memory will be used consecutively.

This means that if we want to do a linear-search through some field to find a matching person, e.g. by name, then we have to traverse the bytes for all the other fields as well, which reduces the density of the data we actually care about, and wastes cache space. Consider our 32 byte `struct Person`, when we are searching for a match on `Person.A` we only care about 8 of those 32 bytes, a simplified model of CPUs will read in cache lines of 64 bytes, some real CPUs fetch multiple cache lines but let's work with 64 bytes for now. This preloads the next `Person` along with the current one we want, but we only care about comparisons on the `Person.A` so the other 48 bytes of the total 64 bytes are wasted. Scaled up to a 36mb cache that my CPU has, we could theoretically be wasting roughly ~27mb of fast cache memory.

<div class="table-wrapper">
    <img src="{{ site.baseurl }}/assets/posts/{{ page.name | split: '.' | first }}/images/Interleaved.png">
    <span class="caption">
        Interleaved data on the left wastes memory in cache lines with unrelated data. Planar data is tightly packed and optimized.
    </span>
</div>

Testing this general knowledge, I made a simple test. A `Person` struct with fields `A`, `B`, `C`, `D` all of int64_t type, and doing a std::find search over `A` with a volatile cast to avoid optimization. 

I compared this against searching through a struct with four vectors 'As' 'Bs' 'Cs' 'Ds' which holds the planar equivalent, and finds a person by getting the matching iterators in the other vectors with `A` as the index.

<div class="table-wrapper">


    <img src="{{ site.baseurl }}/assets/posts/{{ page.name | split: '.' | first }}/images/cmpstructs.png">
    <span class="caption">
        Data structures for interleaved vs planar Persons
    </span>
    <br>

{% highlight c++ %}

struct Person {
    int64_t A;
    int64_t B;
    int64_t C;
    int64_t D;

    [[nodiscard]] bool operator==(int64_t otherA) const noexcept { return A == otherA; }
};

auto find_person_interleaved(int64_t A, std::vector<Person> &interleaved) {
    return std::find(interleaved.cbegin(), interleaved.cend(), A);
}
{% endhighlight %}
    <span class="caption">
        Finding a Person in interleaved data is simple by overloading the equality operator on `Person` to compare A
    </span>
    <br>

{% highlight c++ %}
struct PlanarPeople {
    std::vector<int64_t> As;
    std::vector<int64_t> Bs;
    std::vector<int64_t> Cs;
    std::vector<int64_t> Ds;

    //moves Person p
    void add_person(Person&& p) {
        As.push_back(p.A);
        Bs.push_back(p.B);
        Cs.push_back(p.C);
        Ds.push_back(p.D);
    }

    std::optional<Person> find_person(int64_t A) const;
};

//...

std::optional<Person> PlanarPeople::find_person(int64_t A) {
    auto it = std::find(As.cbegin(), As.cend(), A);
    if (it == As.cend())
        return std::nullopt;

    auto idx = it - As.cbegin();
    return Person{*it, Bs[idx], Cs[idx], Ds[idx]};
}
{% endhighlight %}
    <span class="caption">
        Quick and unsafe implementation of finding a person in our PlanarPeople struct
    </span>
</div>

I wrote a project "benchmark_planar" which uses these structures and takes in command line options for cache size, trial lengths (length of dataset) and trial repetitions to collect average times for randomly searching for entries in planar vs interleaved datasets. To avoid the cache being "pre-warmed" between test repetitions by the prior execution I clear the cache by touching bytes in cache lines from /dev/urandom.

We will compare the average for various trial lengths, a Person is a 32byte struct, trial_size is the number of Persons in the dataset, trial_repetitions is how many times to repeat the trials and search_count is how many random Persons in the dataset to search for per trial.

<div class="table-wrapper">
    <img src="{{ site.baseurl }}/assets/posts/{{ page.name | split: '.' | first }}/images/cmdlinebenchmark1.png">
    <span class="caption">
        Benchmark Planar vs Interleaved command line interface usage
    </span>
</div>

The design of the benchmark cli means that a python script can easily call it, and collect the results to draw charts. In this case I've used python to collect the results and write some json data which I've embedded into a renderer in this page. Charts visualizing the results with N trial_size x M search_count are below, and you can see the time taken in microseconds for each: 

<div class="table-wrapper">
    <div id="benchmark3d">
    <button id="toggle-scale">Toggle Log Scale</button>
    <div id="plot-container"></div>
    </div>
    <div class="slider-wrapper">
    <input type="range" id="trial-size-slider" min="0" max="6" value="0" step="1">
    <div id="slider-label">Trial size: </div>
  </div>
</div>

<script src="https://cdn.plot.ly/plotly-2.24.0.min.js"></script>
<script type="module">
  async function loadBenchmarkData() {
    const response = await fetch('{{ site.baseurl }}/assets/posts/{{ page.name | split: "." | first }}/data/planar_v_inter.json');
    const data = await response.json();

    const trial_sizes = data.trial_sizes;
    const search_counts = data.search_counts;

    const planarSurface = {
      z: data.planar,
      x: trial_sizes,
      y: search_counts,
      type: 'surface',
      colorscale: 'Blues',
      opacity: 0.6,
      showscale: false,
      hoverinfo: 'x+y+z',
      name: 'Planar Surface',
      showlegend: false
    };

    const interleavedSurface = {
      z: data.interleaved,
      x: trial_sizes,
      y: search_counts,
      type: 'surface',
      colorscale: 'Reds',
      opacity: 0.6,
      showscale: false,
      hoverinfo: 'x+y+z',
      name: 'Interleaved Surface',
      showlegend: false
    };

    const planarLines = trial_sizes.map((ts, i) => ({
      x: Array(search_counts.length).fill(ts),
      y: search_counts,
      z: data.planar.map(row => row[i]),
      mode: 'lines',
      type: 'scatter3d',
      line: { color: 'blue', width: 4 },
      name: i === 0 ? 'Planar' : undefined,
      showlegend: i === 0
    }));

    const interleavedLines = trial_sizes.map((ts, i) => ({
      x: Array(search_counts.length).fill(ts),
      y: search_counts,
      z: data.interleaved.map(row => row[i]),
      mode: 'lines',
      type: 'scatter3d',
      line: { color: 'red', width: 4 },
      name: i === 0 ? 'Interleaved' : undefined,
      showlegend: i === 0
    }));

    const layout = {
      scene: {
        xaxis: { title: 'Trial Size' },
        yaxis: { title: 'Search Count' },
        zaxis: { title: 'Time (\u03BCs)', type: 'linear' }
      },
      margin: { l: 0, r: 0, b: 0, t: 30 },
      legend: { x: 0.05, y: 0.95 }
    };

    Plotly.newPlot(
      'plot-container',
      [planarSurface, interleavedSurface, ...planarLines, ...interleavedLines],
      layout
    );

    let isLog = false;
    document.getElementById('toggle-scale').addEventListener('click', () => {
      isLog = !isLog;
      Plotly.relayout('plot-container', {
        'scene.zaxis.type': isLog ? 'log' : 'linear'
      });
    });
  }

  loadBenchmarkData();
</script>

The huge trial sizes totally dwarf the axes scales 

<div class="blog-section-header"> 
    <h2 style="margin-bottom: 0;"> The B-Tree </h2>
    <h5 style="margin-top: 0;"> An elegant self-balancing workhorse datastructure </h5>
</div>

The power of B-Trees begins with the motivation for their design; working with large datasets it is often the case that the RAM is insufficient and so data
must spill over to either network or disk storage. B-Trees are designed to optimize around this, aiming to avoid shifting particularly large chunks of data whilst maintaining a balanced tree, and having O(log n) complexity for Insertion, Erasure and Search operations. Nodes can be tuned to match page sizes and reduce I/O. They maintain a strong ordering on elements, and self-balance to avoid degenerate worst cases which could be worse than linked list.
