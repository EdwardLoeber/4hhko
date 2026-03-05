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
        payload.screen           = getScreenInfo();
        payload.window           = getWindowInfo();
        payload.network          = getNetworkInfo();


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
        const style = document.createElement('style');
        const element = document.createElement('div');

        try {
            style.textContent = '._c_detect{visibility:hidden!important};'
            document.head.appendChild(style);
            element.className = '_c_detect';
            document.head.appendChild(element);
            return window.getComputedStyle(element).visibility === 'hidden';
        } catch (e) {
            return false;
        } finally {
            style.parentNode?.removeChild(style);
            element.parentNode?.removeChild(element);
        }
    }

    function getScreenInfo() {
        const myScreen = screen;
        return {
            width:       myScreen.width,
            height:      myScreen.height,
            availWidth:  myScreen.availWidth,
            availHeight: myScreen.availHeight,
            colorDepth:  myScreen.colorDepth
        };
    }

    function getWindowInfo() {
        const myWindow = window;
        return {
            innerWidth:       myWindow.innerWidth,
            innerHeight:      myWindow.innerHeight,
            outerWidth:       myWindow.outerWidth,
            outerHeight:      myWindow.outerHeight,
            devicePixelRatio: myWindow.devicePixelRatio
        };
    }

    function getNetworkInfo() {
        if (!('connection' in navigator)) return {};

        const myConn = navigator.connection;        
        return {
            effectiveType: myConn.effectiveType,
            downlink:      myConn.downlink,
            rtt:           myConn.rtt,
            saveData:      myConn.saveData
        };
    }


}) (