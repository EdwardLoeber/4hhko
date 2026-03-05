(function () {
    const payload = {};
    const debugging = true;

    window.addEventListener('load', collectStatic);

    function collectStatic() {
        payload.userAgent      = navigator.userAgent;
        payload.cookieEnabled  = navigator.cookieEnabled;
        payload.language       = navigator.language;
        payload.allowsJS       = true;
        payload.allowsImages1  = detectImagesEnabled1();
        payload.allowsImages2  = detectImagesEnabled2();

        const flag = document.getElementById('detectImageFlag');
        console.log('flag element:', flag);
        console.log('offsetWidth:', flag ? flag.offsetWidth : 'no element');
        console.log('readyState:', flag ? flag.readyState : 'no element');
        console.log('naturalWidth:', flag ? flag.naturalWidth : 'no element');
        console.log('complete:', flag ? flag.complete : 'no element');
        
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

    function detectImagesEnabled1() {
        const flag = document.getElementById('detectImageFlag');
        if (!flag) return null;
        return (flag.complete && flag.naturalWidth > 0);
    }

    function detectImagesEnabled2() {
        try {
            const img = new Image();
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            return img.complete && img.naturalWidth > 0;
        } catch (e) {
            return false;
        }
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