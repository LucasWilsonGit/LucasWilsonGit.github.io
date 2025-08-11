


function scrollToNth(className, index) {
    const elements = document.querySelectorAll(className);
    
    if (elements.length >= index && index > 0) {
      const targetElement = elements[index - 1];
      
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start', // Ensures it's aligned at the top of the viewport
        inline: 'nearest'
      });
  
    } else {
      console.log('Element not found or invalid index');
    }
}

document.addEventListener('DOMContentLoaded', function () { 
    if (window.innerWidth >= 900) {
        document.getElementById("blog-chapters").style = `display: block;`
    }

    const headers = document.querySelectorAll('.blog-section-header');
    const threshold = window.innerHeight * 0.05; 
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

        nav.appendChild(link);
    });
    const links = document.querySelectorAll('#nav-chapters a');


    function checkHeaderVisibility() {
        let lastVisibleIndex = -1;

        headers.forEach((header, index) => {
            const rect = header.getBoundingClientRect();
            
            if (rect.top <= threshold) {
                lastVisibleIndex = index;J
            }
        });

        links.forEach(link => {
            link.classList.remove('show-after');
        });

        if (lastVisibleIndex !== -1) {
            links[lastVisibleIndex].classList.add('show-after');
        }
    }

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

    checkHeaderVisibility();
});