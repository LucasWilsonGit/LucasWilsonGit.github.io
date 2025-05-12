


function scrollToNth(className, index) {
    const elements = document.querySelectorAll(className);
    
    // Check if index is within range
    if (elements.length >= index && index > 0) {
      const targetElement = elements[index - 1];
      
      // Scroll to the element smoothly
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start', // Ensures it's aligned at the top of the viewport
        inline: 'nearest'
      });
  
      // Optionally update the URL hash to reflect the scrolled-to element
      // window.location.hash = targetElement.id;
    } else {
      console.log('Element not found or invalid index');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (window.innerWidth >= 900) {
        document.getElementById("blog-chapters").style = `display: block;`
    }

    const headers = document.querySelectorAll('.blog-section-header');
    const threshold = window.innerHeight * 0.05; // 15% of viewport height
    const nav = document.getElementById('nav-chapters');

    headers.forEach((header, index) => {
        const chapterTitle = header.querySelector('h2').innerText;
        
        // Create a new link for the chapter
        const link = document.createElement('a');
        link.href = "#";
        link.textContent = chapterTitle;
        link.onclick = function() {
            scrollToNth('.blog-section-header', index + 1);
            return false;
        };

        // Append the link to the nav
        nav.appendChild(link);
    });
    const links = document.querySelectorAll('#nav-chapters a');


    function checkHeaderVisibility() {
        let lastVisibleIndex = -1;

        // Loop through all headers to find the last one that's passed the threshold
        headers.forEach((header, index) => {
            const rect = header.getBoundingClientRect();
            
            if (rect.top <= threshold) {
                lastVisibleIndex = index;  // Track the last header that passed the threshold
            }
        });

        // Remove 'show-after' class from all links
        links.forEach(link => {
            link.classList.remove('show-after');
        });

        // Add 'show-after' class only to the last visible link
        if (lastVisibleIndex !== -1) {
            links[lastVisibleIndex].classList.add('show-after');
        }
    }

    // Run on scroll and resize
    window.addEventListener('scroll', checkHeaderVisibility);
    window.addEventListener('resize', ()=>{
        checkHeaderVisibility();
        if (window.innerWidth >= 900) {
            document.getElementById("blog-chapters").style = `display: block;`
        }
        else {
            document.getElementById("blog-chapters").style = `display: hide;`
        }
    });

    // Initial check to ensure it's accurate when the page first loads
    checkHeaderVisibility();
});