function scroll_progress_vertical(element, progress) {
    element.style.width = `2px`;
    element.style.height = `${progress}%`;
}
function scroll_progress_horizontal(element, progress) {
    element.style.height = `2px`;
    element.style.width = `${progress}%`;
}
function scroll_visible() {
    return document.documentElement.scrollHeight > window.innerHeight;
}

function dispatch_scroll_progress() {
    const element = document.getElementById("sidebar-progress-bar");
    const progress = (window.scrollY) * 100.0 / (document.documentElement.scrollHeight - window.innerHeight); 
    
    if ( !scroll_visible() ) {
        element.style.display = `none`;
        return;
    }
    element.style.display = `block`;


    if (window.innerWidth >= 900) {
        scroll_progress_vertical(element, progress);
    }
    else {
        scroll_progress_horizontal(element, progress);
    }
}


document.addEventListener("scroll", ()=> {
    dispatch_scroll_progress();
});
document.addEventListener("resize", ()=> {
    dispatch_scroll_progress();
});
document.addEventListener("DOMContentLoaded", ()=> {
    dispatch_scroll_progress();
})