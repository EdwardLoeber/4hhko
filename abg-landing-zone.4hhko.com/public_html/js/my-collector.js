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
        try {
            const img = new Image();
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            return img.complete && img.naturalWidth > 0;
        } catch (e) {
            return false;
        }
    }
    
    if (debugging = true) {
        console.log(payload);
    } else {
        try {
            sendBeacon(payload);
        } catch (e) {
            console.log("ack");
        }
    }
}) ();