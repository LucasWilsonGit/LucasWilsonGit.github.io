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

Recently I tried my hand at implementing a multi-index lookup, and honestly? I did a poor job of it. It's better to try and fail at home than to hit a wall on the job, so I took it as an area to improve in. I found myself digging into a bigger question, on how data structures can be designed for high throughput around hardware limitations. In this post I try to organize what I learned for future reference, skating over data layouts, different datastructures and finally implementing a few different structures.   

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
    <div id="slider-wrapper">
        <div id="trial-size-slider"></div>
        <div id="slider-label"></div>
    </div>
</div>

<script src="https://cdn.plot.ly/plotly-2.24.0.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/nouislider@15.7.0/dist/nouislider.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/nouislider@15.7.0/dist/nouislider.min.css">

<script type="module">
async function loadBenchmarkData() {
  // load JSON
  const response = await fetch('{{ site.baseurl }}/assets/posts/{{ page.name | split: "." | first }}/data/planar_v_inter.json');
  const data = await response.json();

  const trial_sizes = data.trial_sizes;
  const search_counts = data.search_counts;
  let isLog = false;

  function makeTraces(selectedIdxs, collapsed) {
    if (collapsed) {
      const idx = selectedIdxs[0];
      return [
        {
          x: search_counts,
          y: data.planar.map(row => row[idx]),
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: 'blue', width: 3 },
          name: `Planar`
        },
        {
          x: search_counts,
          y: data.interleaved.map(row => row[idx]),
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: 'red', width: 3 },
          name: `Interleaved`
        }
      ];
    } else {
      const planarSurface = {
        z: data.planar.map(row => row.filter((_, i) => selectedIdxs.includes(i))),
        x: selectedIdxs.map(i => trial_sizes[i]),
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
        z: data.interleaved.map(row => row.filter((_, i) => selectedIdxs.includes(i))),
        x: selectedIdxs.map(i => trial_sizes[i]),
        y: search_counts,
        type: 'surface',
        colorscale: 'Reds',
        opacity: 0.6,
        showscale: false,
        hoverinfo: 'x+y+z',
        name: 'Interleaved Surface',
        showlegend: false
      };

      const planarLines = selectedIdxs.map((idx, k) => ({
        x: Array(search_counts.length).fill(trial_sizes[idx]),
        y: search_counts,
        z: data.planar.map(row => row[idx]),
        mode: 'lines',
        type: 'scatter3d',
        line: { color: 'blue', width: 4 },
        name: k === 0 ? 'Planar' : undefined,
        showlegend: k === 0
      }));

      const interleavedLines = selectedIdxs.map((idx, k) => ({
        x: Array(search_counts.length).fill(trial_sizes[idx]),
        y: search_counts,
        z: data.interleaved.map(row => row[idx]),
        mode: 'lines',
        type: 'scatter3d',
        line: { color: 'red', width: 4 },
        name: k === 0 ? 'Interleaved' : undefined,
        showlegend: k === 0
      }));

      return [planarSurface, interleavedSurface, ...planarLines, ...interleavedLines];
    }
  }

  function makeLayout(collapsed) {
    if (collapsed) {
      return {
        xaxis: { title: 'Search Count' },
        yaxis: { title: 'Time (μs)', type: isLog ? 'log' : 'linear' },
        margin: { l: 50, r: 20, b: 40, t: 30 },
        legend: { x: 0.05, y: 0.95 }
      };
    } else {
      return {
        scene: {
          xaxis: { title: 'Trial Size' },
          yaxis: { title: 'Search Count' },
          zaxis: { title: 'Time (μs)', type: isLog ? 'log' : 'linear' }
        },
        margin: { l: 0, r: 0, b: 0, t: 30 },
        legend: { x: 0.05, y: 0.95 }
      };
    }
  }

  // --- Slider setup ---
  const slider = document.getElementById('trial-size-slider');
  noUiSlider.create(slider, {
    start: [0, 0],  // start with both handles together
    connect: true,
    range: { min: 0, max: trial_sizes.length - 1 },
    step: 1,
    tooltips: [true, true],
    format: {
      to: i => trial_sizes[Math.round(i)],
      from: val => trial_sizes.indexOf(Number(val))
    }
  });

  function updatePlot(values, unencoded) {
    const minIdx = Math.round(unencoded[0]);
    const maxIdx = Math.round(unencoded[1]);
    const collapsed = (minIdx === maxIdx);

    const selected = collapsed
      ? [minIdx]
      : Array.from({ length: maxIdx - minIdx + 1 }, (_, k) => k + minIdx);

    // Update trial size label
    document.getElementById('slider-label').innerText =
      collapsed
        ? `Trial size = ${trial_sizes[minIdx]}`
        : `Trial size range: ${trial_sizes[minIdx]} – ${trial_sizes[maxIdx]}`;

    // Redraw
    Plotly.react('plot-container', makeTraces(selected, collapsed), makeLayout(collapsed));
  }

  slider.noUiSlider.on('update', (values, handle, unencoded) => {
    updatePlot(values, unencoded);
  });

  // Initial render
  updatePlot([0, 0], [0, 0]);

  // Toggle log/linear z axis
  document.getElementById('toggle-scale').addEventListener('click', () => {
    isLog = !isLog;
    const [minIdx, maxIdx] = slider.noUiSlider.get(true).map(Math.round);
    const collapsed = (minIdx === maxIdx);
    const selected = collapsed
      ? [minIdx]
      : Array.from({ length: maxIdx - minIdx + 1 }, (_, k) => k + minIdx);
    Plotly.react('plot-container', makeTraces(selected, collapsed), makeLayout(collapsed));
  });
}

loadBenchmarkData();
</script>

For trivial data lengths (500 People, 16 Kilobytes), planar is still significantly faster than interleaved data despite the increased complexity of the Planar solution (wrapping the result into std::optional and comparison for early exit with nullopt). As the number of searches we perform through the dataset increases the time taken increases near-linearly for both and the planar implementation stays about 4x faster. 

As we move to quite large data lengths which still fit into RAM comfortably, but which exceed the cache significantly (32 million People, slightly over a Gigabyte) the baseline difference between planar and interleaved extends to an order of magnitude, and they both continue to scale near linearly with the search count, but planar is generally around 10x faster.

You can play with the slider heads and look at various trial sizes and compare the time taken for different search counts between Planar and Interleaved implementations. I've stuck to using std::find to try to avoid biasing the test with a better or worse custom search implementation for either.

Something extra to look at is the performance profile once we go beyond our RAM and start hitting disk. On servers this would usually just crash, and software dealing with huge data would take care of putting stale memory into some slower large storage e.g. network or disk before a out_of_memory or sigkill(9). Anyway, I configured 64G of swapfile space just to test how this behaves when we have to deal with really slow memory access because parts of our dataset get paged out to a swapfile. It'd probably be better to use a mmapped buffer but I want to be a bit lazy with my implementation and the performance behaviour should be equivalent. I'll do a single trial_size evaluation and add a 2D chart, my system has 64GiB total RAM, ~48GiB currently free and another 64GiB in the swapfile free.

<div class="table-wrapper">
    <img src="{{ site.baseurl }}/assets/posts/{{ page.name | split: '.' | first }}/images/mem.png">
    <img src="{{ site.baseurl }}/assets/posts/{{ page.name | split: '.' | first }}/images/swap.png">
    <span class="caption">
        System memory and swapfile
    </span>
    <br>
    <img src="{{ site.baseurl }}/assets/posts/{{ page.name | split: '.' | first }}/images/hugedata.png">
    <span class="caption">
        Test trial with larger than RAM data
    </span>
</div>

It's not at all rigorous to comment on a single test run without multiple repetitions and various search lengths to establish trends, but as a rather meaningless comment on a baseline of 25 searches through a larger-than-RAM dataset, the difference between planar and interleaved seems to be even larger. This is probably because again, the Planar uses memory more efficiently so we deal with less misses going out to disk which is super costly even compared to missing cache and going to RAM. I have SSD storage so still pretty fast.  

<b>Note:</b>

The previous benchmark only looked at the search time, the worst case for insertion in the planar is that all of the vectors resize at the same time, and the cost of doing four syscalls asking for memory to be allocated could be quite a lot worse than one bigger allocation in the interleaved implementation. 

This may no longer be true for particularly huge allocations though, freeing the old vector buffers may zero the pages so at some point the cost of releasing and acquiring that much memory is larger than the cost of four separate context switches. Staggering the reserved size of the planar vectors may help with this but your amortized insertion is likely worse for the Planar implementation. At this point Planar may become faster than interleaved again - it honestly warrants it's own benchmarking.

TODO: Benchmark insertion

TODO: Benchmark erasure (Planar likely slower at tiny buffers, faster for larger buffers)

TODO: Add benchmark for binary-search to demonstrate how massive the perf improvement is for larger than
memory lengths because so many less reads failing through to disk (very slow)

<div class="blog-section-header"> 
    <h2 style="margin-bottom: 0;"> The B-Tree </h2>
    <h5 style="margin-top: 0;"> An elegant self-balancing workhorse datastructure </h5>
</div>

The power of B-Trees begins with the motivation for their design; working with large datasets it is often the case that the RAM is insufficient and so data
must spill over to either network or disk storage. B-Trees are designed to optimize around this, aiming to avoid shifting particularly large chunks of data whilst maintaining a balanced tree, and having O(log n) complexity for Insertion, Erasure and Search operations. Nodes can be tuned to match page sizes and reduce I/O. They maintain a strong ordering on elements, and self-balance to avoid degenerate worst cases which could be worse than linked list.
