(function () {
    function round(n) {
        return Math.round(n * 100) / 100;
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

    function collectUserData() {
        const myNav = navigator;
        return {
            userAgent:     myNav.userAgent,
            cookieEnabled: myNav.cookieEnabled,
            language:      myNav.language,
            cores:         myNav.hardwareConcurrency || 0,
            memory:        myNav.deviceMemory || 0,
            colorScheme:   window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
            timezone:      Intl.DateTimeFormat().resolvedOptions().timeZone,
            allowsJS:      true,
            allowsImages:  detectImagesEnabled(),
            allowsCSS:     detectCSSEnabled(),
            screen:        getScreenInfo(),
            window:        getWindowInfo(),
            network:       getNetworkInfo()
        }
    }

    function collectPerformanceData() {
        const entries = window.performance.getEntriesByType('navigation');
        if (!entries.length) return {};
        const n = entries[0];
        return {
            pageStartTime:  round(n.fetchStart),
            pageEndTime:    round(n.fetchStart),
            pageLoadTime:   round(n.loadEventEnd - n.fetchStart),
            dnsLookup: round(n.domainLookupEnd - n.domainLookupStart),
            tcpConnect: round(n.connectEnd - n.connectStart),
            tlsHandshake: n.secureConnectionStart > 0 ? round(n.connectEnd - n.secureConnectionStart) : 0,
            ttfb: round(n.responseStart - n.requestStart),
            download: round(n.responseEnd - n.responseStart),
            domInteractive: round(n.domInteractive - n.fetchStart),
            domComplete: round(n.domComplete - n.fetchStart),
            loadEvent: round(n.loadEventEnd - n.fetchStart),
            fetchTime: round(n.responseEnd - n.fetchStart),
            transferSize: n.transferSize,
            headerSize: n.transferSize - n.encodedBodySize,
            // The whole timing object
            raw: {
                fetchStart: round(n.fetchStart),
                domainLookupStart: round(n.domainLookupStart),
                domainLookupEnd: round(n.domainLookupEnd),
                connectStart: round(n.connectStart),
                connectEnd: round(n.connectEnd),
                secureConnectionStart: round(n.secureConnectionStart),
                requestStart: round(n.requestStart),
                responseStart: round(n.responseStart),
                responseEnd: round(n.responseEnd),
                domInteractive: round(n.domInteractive),
                domContentLoadedEventStart: round(n.domContentLoadedEventStart),
                domContentLoadedEventEnd: round(n.domContentLoadedEventEnd),
                domComplete: round(n.domComplete),
                loadEventStart: round(n.loadEventStart),
                loadEventEnd: round(n.loadEventEnd),
                type: n.type,
                redirectCount: n.redirectCount
      }
        };
    }

    function collectStatic() {
        const payload = {};
        const debugging = true;
    
        payload['userData'] = collectUserData();
        payload['performanceData'] = collectPerformanceData();
        payload['activity'] = DodecahedronGeometry;
        
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

    let errorCount = 0;

    window.addEventListener('load', collectStatic);
    window.addEventListener('error', (e) => {
        errorCount += 1;
    })
}) ();