const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');

function link(href) {
    return {
        href,
        getAttribute() { return this.href; },
        setAttribute(name, value) { assert.equal(name, 'href'); this.href = value; }
    };
}

function setup(search = '', fetch = async () => ({}), links = []) {
    const listeners = {};
    const context = vm.createContext({
        URL, URLSearchParams, fetch,
        window: { location: new URL(`https://exprofit.test/${search}`) },
        document: {
            addEventListener(name, handler) { listeners[name] = handler; },
            querySelectorAll() { return links; }
        }
    });
    vm.runInContext(source, context);
    return { context, listeners };
}

test('only five UTM keys are retained; Unicode, empty values and duplicates are handled', () => {
    const { context } = setup();
    const params = context.getUTMParams('?utm_source=telegram&utm_source=other&utm_medium=&utm_campaign=Привет&utm_term=a%26b&utm_content=hero&token=private&gclid=123');
    assert.deepEqual([...params], [
        ['utm_source', 'telegram'], ['utm_medium', ''], ['utm_campaign', 'Привет'],
        ['utm_term', 'a&b'], ['utm_content', 'hero']
    ]);
});

test('internal navigation keeps destination query/hash and copies only UTM', () => {
    const { context } = setup('?utm_source=telegram&utm_campaign=новое&token=private');
    const target = link('/?view=cases&utm_source=own#portfolio');
    context.preserveUTM(target);
    const result = new URL(target.href);
    assert.equal(result.hash, '#portfolio');
    assert.equal(result.searchParams.get('view'), 'cases');
    assert.equal(result.searchParams.get('utm_source'), 'own');
    assert.equal(result.searchParams.get('utm_campaign'), 'новое');
    assert.equal(result.searchParams.has('token'), false);
    context.preserveUTM(target);
    assert.equal(new URL(target.href).searchParams.getAll('utm_campaign').length, 1);
});

test('relative, query-only and absolute same-origin links preserve UTM', () => {
    const { context } = setup('?utm_source=telegram');
    for (const href of ['index.html#portfolio', '?view=cases#portfolio', 'https://exprofit.test/#portfolio']) {
        const target = link(href);
        context.preserveUTM(target);
        assert.equal(new URL(target.href).searchParams.get('utm_source'), 'telegram');
    }
});

test('fragments and external links are left to native browser navigation', () => {
    const { context } = setup('?utm_source=telegram&token=private');
    for (const href of ['#portfolio', '#', '', '//other.test/', 'https://t.me/korobey', 'mailto:example@example.test', 'tel:+123']) {
        const target = link(href);
        context.preserveUTM(target);
        assert.equal(target.href, href);
    }
});

test('hrefs are prepared before activation and clicks are never cancelled', () => {
    const home = link('/');
    const anchor = link('#portfolio');
    const { listeners } = setup('?utm_source=telegram&secret=private', undefined, [home, anchor]);
    listeners.DOMContentLoaded();
    assert.equal(home.href, 'https://exprofit.test/?utm_source=telegram');
    const event = {
        target: { closest() { return anchor; } },
        preventDefault() { assert.fail('native navigation must not be cancelled'); }
    };
    listeners.click(event);
    assert.equal(anchor.href, '#portfolio');
    listeners.click({ target: { closest() { return null; } } });
});

test('analytics preserves payload fields but strips unrelated query data from url', async () => {
    const requests = [];
    const { context } = setup('?utm_source=telegram&utm_campaign=Привет&secret=private#portfolio', async (...args) => { requests.push(args); });
    await context.sendUTMToTelegram('Обсудить проект');
    assert.equal(requests.length, 1);
    const [endpoint, options] = requests[0];
    assert.equal(new URL(endpoint).origin, 'https://script.google.com');
    assert.equal(options.method, 'POST');
    assert.equal(options.keepalive, true);
    assert.deepEqual(JSON.parse(options.body), {
        button: 'Обсудить проект',
        url: 'https://exprofit.test/?utm_source=telegram&utm_campaign=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82#portfolio',
        utm_source: 'telegram', utm_medium: null, utm_campaign: 'Привет', utm_term: null, utm_content: null
    });
});

test('analytics failures and unavailable fetch never escape the handler', async () => {
    for (const fetch of [async () => { throw new Error('offline'); }, () => { throw new Error('blocked'); }, null]) {
        const { context } = setup('', fetch);
        await assert.doesNotReject(context.sendUTMToTelegram('Написать в Телеграмм'));
    }
});
