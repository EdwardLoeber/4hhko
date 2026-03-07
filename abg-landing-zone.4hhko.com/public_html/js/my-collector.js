(function () {

    const resourceSummary = {
        script:         { count: 0, totalSize: 0, totalDuration: 0 },
        link:           { count: 0, totalSize: 0, totalDuration: 0 },
        img:            { count: 0, totalSize: 0, totalDuration: 0 },
        font:           { count: 0, totalSize: 0, totalDuration: 0 },
        fetch:          { count: 0, totalSize: 0, totalDuration: 0 },
        xmlhttprequest: { count: 0, totalSize: 0, totalDuration: 0 },
        other:          { count: 0, totalSize: 0, totalDuration: 0 }
    };

    let errorCount = 0;
    const payload = {};
    const debugging = true;

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

    async function collectPerformanceData() {
        return new Promise((resolve) => {
            const observer = new PerformanceObserver((list) => {
                const n = list.getEntries()[0];
                observer.disconnect();
                resolve({
                    pageStartTime:  n.fetchStart,
                    pageEndTime:    n.loadEventEnd,
                    pageLoadTime:   n.loadEventEnd - n.fetchStart,
                    dnsLookup:      n.domainLookupEnd - n.domainLookupStart,
                    tcpConnect:     n.connectEnd - n.connectStart,
                    tlsHandshake:   n.secureConnectionStart > 0 ? n.connectEnd - n.secureConnectionStart : 0,
                    ttfb:           n.responseStart - n.requestStart,
                    download:       n.responseEnd - n.responseStart,
                    domInteractive: n.domInteractive - n.fetchStart,
                    domComplete:    n.domComplete - n.fetchStart,
                    loadEvent:      n.loadEventEnd - n.fetchStart,
                    fetchTime:      n.responseEnd - n.fetchStart,
                    transferSize:   n.transferSize,
                    headerSize:     n.transferSize - n.encodedBodySize,
                    raw:            JSON.parse(JSON.stringify(n))
                });
            });
            observer.observe({ type: 'navigation', buffered: true });
        });
    }

    const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((r) => {
            const type = resourceSummary[r.initiatorType] ? r.initiatorType : 'other';
            resourceSummary[type].count++;
            resourceSummary[type].totalSize += r.transferSize || 0;
            resourceSummary[type].totalDuration += r.duration || 0;
        });
    });
    
    async function collectStatic() {    
        payload['userData'] = collectUserData();
        payload['performanceData'] = await collectPerformanceData();
    }

    function collectBehavioral() {
        payload['resourceSummary'] = resourceSummary;
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

    resourceObserver.observe({ type: 'resource', buffered: true });
    window.addEventListener('load', collectStatic);
    window.addEventListener('visibilitychange', collectBehavioral);
    window.addEventListener('error', (e) => {
        errorCount += 1;
    })
}) ();