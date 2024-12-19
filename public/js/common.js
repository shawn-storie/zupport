async function includeNavigation() {
    const response = await fetch('/zupport/common-nav.html');
    const html = await response.text();
    document.getElementById('nav-container').innerHTML = html;

    // Get server info
    const serverInfo = await fetch('/zupport/version').then(r => r.json());
    const serverName = document.querySelector('.server-name');
    const envPill = document.querySelector('.env-pill');

    if (serverName && envPill) {
        serverName.textContent = serverInfo.server;
        envPill.textContent = serverInfo.environment;
        envPill.classList.add(serverInfo.environment.toLowerCase());
    }

    // Set active nav link
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-header a').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', includeNavigation); 