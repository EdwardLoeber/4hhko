(function () {
    const payload = {};
    const debugging = true;

    window.addEventListener('load', collectStatic);

    function collectStatic() {
        payload.userAgent      = navigator.userAgent;
        payload.cookieEnabled  = navigator.cookieEnabled;
        payload.language       = navigator.language;
        payload.allowsJS       = true;
        payload.allowsImages  = detectImagesEnabled();
        
        
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

    if (debugging === true) {
        console.log(payload);
    } else {
        try {
            sendBeacon(payload);
        } catch (e) {
            console.log("ack");
        }
    }
}) ();