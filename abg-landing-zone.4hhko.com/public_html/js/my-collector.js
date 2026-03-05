(function () {
    const payload = {};
    const debugging = true;

    window.addEventListener('load', collectStatic);

    function collectStatic() {
        payload.userAgent        = navigator.userAgent;
        payload.cookieEnabled    = navigator.cookieEnabled;
        payload.language         = navigator.language;
        payload.allowsJS         = true;
        payload.allowsImages     = detectImagesEnabled();
        payload.allowsCSS        = detectCSSEnabled();
        payload.screen           = screen;
        payload.window           = window;
        payload.network          = navigator.connection ? navigator.connection : false;

        console.log(window.screen);


        
        if (debugging === true) {
            console.log(payload);
        } else {
            try {
                navigator.sendBeacon('https://collector.4hhko.com/collect.php', JSON.stringify(payload));
            } catch (e) {
                console.log("beacon failed:", e);
            }
        }
    }

    function detectImagesEnabled() {
        const flag = document.getElementById('detectImageFlag');
        if (!flag) return null;
        return (flag.complete && flag.naturalWidth > 0);
    }

    function detectCSSEnabled() {
        const elem = document.getElementById('detectCSS');
        if (!elem) return null;
        const fontSize = window.getComputedStyle(elem).fontSize;
        return fontSize == '1px';
    }
}) ();