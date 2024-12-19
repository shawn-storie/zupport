async function includeNavigation() {
    const response = await fetch('/zupport/common-nav.html');
    const html = await response.text();
    document.getElementById('nav-container').innerHTML = html;

    // Set active nav link
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-header a').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', includeNavigation); 