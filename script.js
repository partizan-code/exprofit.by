const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

function getUTMParams(search) {
    const source = new URLSearchParams(search);
    const utm = new URLSearchParams();

    for (const key of UTM_KEYS) {
        if (source.has(key)) utm.set(key, source.get(key));
    }

    return utm;
}

// Analytics is optional: the CTA remains a normal Telegram link.
async function sendUTMToTelegram(buttonType) {
    try {
        const utm = getUTMParams(window.location.search);
        const pageURL = new URL(window.location.href);
        pageURL.search = utm.toString();
        const utmData = {
            button: buttonType,
            url: pageURL.href,
            ...Object.fromEntries(UTM_KEYS.map(key => [key, utm.get(key)]))
        };

        await fetch('https://script.google.com/macros/s/AKfycbyjm87AdhFjsGdiioe3u8xJiuvnQkVl8D_CBH6VSfyfrtR4xNwelbUawNPDey1k73tmlg/exec', {
            method: 'POST',
            body: JSON.stringify(utmData),
            keepalive: true
        });
    } catch {
        // Network or analytics failures must never interrupt contact navigation.
    }
}

function preserveUTM(link) {
    const href = link.getAttribute('href');
    // Native fragment navigation already keeps the current query and moves focus.
    if (!href || href.startsWith('#')) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) return;

    for (const [key, value] of getUTMParams(window.location.search)) {
        if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    link.setAttribute('href', url.href);
}

document.addEventListener('DOMContentLoaded', function () {
    // Prepare hrefs for keyboard activation, middle-click and context-menu opening.
    document.querySelectorAll('a[href]').forEach(preserveUTM);
    document.addEventListener('click', function (event) {
        const link = event.target.closest('a[href]');
        if (link) preserveUTM(link);
    });
});
