// Скрипт для плавной прокрутки с учетом фиксированного хедера
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerHeight = document.querySelector('header').offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Скрипт для отправки UTM параметров в ТГ
async function sendUTMToTelegram(buttonType) {
    const urlParams = new URLSearchParams(window.location.search);
    const utmData = {
        button: buttonType,
        url: window.location.href,
        utm_source: urlParams.get('utm_source'),
        utm_medium: urlParams.get('utm_medium'),
        utm_campaign: urlParams.get('utm_campaign'),
        utm_term: urlParams.get('utm_term'),
        utm_content: urlParams.get('utm_content')
    };

    try {
        // Используйте вашу ссылку из Google Apps Script
        await fetch('https://script.google.com/macros/s/AKfycbyjm87AdhFjsGdiioe3u8xJiuvnQkVl8D_CBH6VSfyfrtR4xNwelbUawNPDey1k73tmlg/exec', {
            method: 'POST',
            body: JSON.stringify(utmData)
        });
    } catch (error) {
        console.log('Ошибка отправки UTM:', error);
    }

    return true;
}

// Скрипт для сохранения UTM параметров
function handleInternalLinks() {
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');

        // Обрабатываем только внутренние ссылки
        if (href && (href.startsWith('/') || href.startsWith('#'))) {
            e.preventDefault();

            const urlParams = new URLSearchParams(window.location.search);
            const utmParams = urlParams.toString();

            let newUrl = href;

            // Для якорных ссылок
            if (href.startsWith('#')) {
                const target = document.querySelector(href);
                if (target) {
                    const headerHeight = document.querySelector('header').offsetHeight;
                    const targetPosition = target.offsetTop - headerHeight;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });

                    newUrl = window.location.pathname + (utmParams ? '?' + utmParams : '') + href;
                    window.history.replaceState(null, null, newUrl);
                }
            }
            // Для ссылок на главную и другие страницы
            else if (href.startsWith('/')) {
                newUrl = href + (utmParams ? '?' + utmParams : '');
                window.location.href = newUrl;
            }
        }
    });
}

// Инициализация всех скриптов
document.addEventListener('DOMContentLoaded', function() {
    initSmoothScroll();
    handleInternalLinks();
});