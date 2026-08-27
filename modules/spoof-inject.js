(function () {
  'use strict';

  // ============ 0. Bypass Bot Verifications ============
  function isBotVerificationActive() {
    try {
      const href = (window.location.href || '').toLowerCase();
      const pathname = (window.location.pathname || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();

      if (
        href.includes('cloudflare.com') ||
        href.includes('challenges.cloudflare.com') ||
        href.includes('turnstile.cloudflare.com') ||
        href.includes('hcaptcha.com') ||
        href.includes('recaptcha.net') ||
        href.includes('google.com/recaptcha') ||
        href.includes('turnstile') ||
        href.includes('__cf_chl_') ||
        href.includes('cdn-cgi/challenge-platform') ||
        pathname.includes('cdn-cgi/challenge-platform') ||
        pathname.includes('__cf_chl_') ||
        search.includes('cf_chl_') ||
        search.includes('__cf_chl_')
      ) {
        return true;
      }

      if (typeof window._cf_chl_opt !== 'undefined' || typeof window.__cfRLUnblockHandlers !== 'undefined' || typeof window.turnstile !== 'undefined') {
        return true;
      }

      if (
        document.getElementById('challenge-form') ||
        document.getElementById('challenge-running') ||
        document.getElementById('challenge-stage') ||
        document.getElementById('cf-turnstile-response') ||
        document.querySelector('.cf-turnstile-wrapper') ||
        document.querySelector('iframe[src*="challenges.cloudflare.com"]') ||
        document.querySelector('iframe[src*="turnstile"]') ||
        document.querySelector('.ch-title-zone') ||
        document.querySelector('#cf-wrapper')
      ) {
        return true;
      }

      const docTitle = (document.title || '').toLowerCase();
      if (docTitle.includes('just a moment...') || docTitle.includes('attention required! | cloudflare')) {
        return true;
      }
    } catch (e) { }
    return false;
  }

  if (isBotVerificationActive()) {
    console.log('[Privacy Guard] Bypassed spoofing for active bot challenge/verification.');
    return;
  }

  // Vô hiệu hóa Privacy Sandbox (Topics API & Attribution Reporting)
  try {
    if (typeof document.browsingTopics === 'function') {
      document.browsingTopics = () => Promise.resolve([]);
    }
    if (typeof window.attributionReporting === 'object') {
      delete window.attributionReporting;
    }
  } catch (e) {}

  // ============ 1. Cấu hình Two-Tier Seed & Device Profile ============
  let activeNoise = 'DEFAULT_FALLBACK_SEED_186626EB39E9A89A';
  let isNoiseReal = false;
  window.__activeGeoMode = window.__activeGeoMode || 'us';
  window.__activeDeviceProfile = window.__activeDeviceProfile || null;

  // Zero-Latency Synchronous Check from documentElement dataset
  try {
    if (document.documentElement && document.documentElement.dataset) {
      if (document.documentElement.dataset.thanusNoise) {
        activeNoise = document.documentElement.dataset.thanusNoise;
        isNoiseReal = true;
      }
      if (document.documentElement.dataset.thanusGeo) {
        window.__activeGeoMode = document.documentElement.dataset.thanusGeo;
      }
      if (document.documentElement.dataset.thanusProfile) {
        try {
          window.__activeDeviceProfile = JSON.parse(document.documentElement.dataset.thanusProfile);
        } catch (e) {}
      }
    }
  } catch (e) {}

  // Lắng nghe phản hồi từ bridge (fallback & dynamic changes)
  window.addEventListener('message', (e) => {
    // Lưu ý: Không kiểm tra e.origin vì script chạy trong nhiều context (data:, about:blank)
    if (e.source === window && e.data && e.data.type === '__NOISE_RESPONSE__') {
      if (e.data.domainNoise && !isNoiseReal) {
        activeNoise = e.data.domainNoise;
        isNoiseReal = true;
      }
      if (e.data.geoMode) {
        window.__activeGeoMode = e.data.geoMode;
      }
      if (e.data.deviceProfile) {
        window.__activeDeviceProfile = e.data.deviceProfile;
      }
    }
  });

  // Gửi yêu cầu lấy noise tới bridge nếu dataset chưa có
  let _noiseRetryCount = 0;
  function requestNoise() {
    if (isNoiseReal || _noiseRetryCount >= 3) return;
    _noiseRetryCount++;
    window.postMessage({ type: '__REQUEST_NOISE__' }, '*');
    if (!isNoiseReal && _noiseRetryCount < 3) {
      setTimeout(requestNoise, _noiseRetryCount * 50);
    }
  }
  if (!isNoiseReal) {
    requestNoise();
  }

  // ============ 2. Helper: Hàm băm tạo noise ổn định ============
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  // ============ 3. Helper: Tạo Proxy giả lập native ============
  const spoofRegistry = new WeakMap();

  function registerSpoofedFunction(proxyFn, fakeName) {
    spoofRegistry.set(proxyFn, `function ${fakeName}() { [native code] }`);
  }

  function patchGlobalToString() {
    const originalToString = Function.prototype.toString;

    const toStringProxy = new Proxy(originalToString, {
      apply(target, thisArg, args) {
        if (thisArg && (typeof thisArg === 'function' || typeof thisArg === 'object') && spoofRegistry.has(thisArg)) {
          return spoofRegistry.get(thisArg);
        }
        return Reflect.apply(target, thisArg, args);
      }
    });

    spoofRegistry.set(toStringProxy, 'function toString() { [native code] }');

    try {
      Object.defineProperty(Function.prototype, 'toString', {
        value: toStringProxy,
        writable: true,
        configurable: true,
        enumerable: false
      });
    } catch (e) { }
  }

  patchGlobalToString();

  function createNativeProxy(originalFn, handlerTraps, fakeName) {
    const targetName = fakeName || (originalFn ? originalFn.name : '');
    const traps = { ...handlerTraps };
    const originalGet = traps.get;
    traps.get = function (target, prop, receiver) {
      if (prop === 'name' && targetName) return targetName;
      if (originalGet) return originalGet(target, prop, receiver);
      return Reflect.get(target, prop, receiver);
    };
    const proxy = new Proxy(originalFn, traps);
    registerSpoofedFunction(proxy, targetName);
    return proxy;
  }

  // ============ 4. Áp dụng Spoofing cho Canvas ============
  function applyCanvasSpoof() {
    if (window.HTMLCanvasElement && window.HTMLCanvasElement.prototype.getContext) {
      const originalGetContext = window.HTMLCanvasElement.prototype.getContext;
      const spoofedGetContext = createNativeProxy(
        originalGetContext,
        {
          apply(target, thisArg, args) {
            if (args[0] === '2d') {
              if (args.length < 2) args.push({});
              if (typeof args[1] === 'object') {
                args[1].willReadFrequently = true;
              }
            }
            return Reflect.apply(target, thisArg, args);
          }
        },
        'getContext'
      );
      Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
        value: spoofedGetContext,
        writable: true,
        configurable: true
      });
    }

    if (!window.CanvasRenderingContext2D) return;
    const proto = CanvasRenderingContext2D.prototype;

    // Spoof toDataURL to inject noise
    if (window.HTMLCanvasElement && window.HTMLCanvasElement.prototype.toDataURL) {
      const originalToDataURL = window.HTMLCanvasElement.prototype.toDataURL;
      const spoofedToDataURL = createNativeProxy(
        originalToDataURL,
        {
          apply(target, thisArg, args) {
            const ctx = thisArg.getContext('2d');
            if (ctx) {
              const width = thisArg.width;
              const height = thisArg.height;
              if (width > 0 && height > 0) {
                const hash = Math.abs(simpleHash(activeNoise));
                const rShift = hash % 5;
                const gShift = (hash >> 2) % 5;
                const bShift = (hash >> 4) % 5;
                ctx.fillStyle = `rgba(${rShift}, ${gShift}, ${bShift}, 0.01)`;
                ctx.fillRect(0, 0, 1, 1);
              }
            }
            return Reflect.apply(target, thisArg, args);
          }
        },
        'toDataURL'
      );
      Object.defineProperty(window.HTMLCanvasElement.prototype, 'toDataURL', {
        value: spoofedToDataURL,
        writable: true,
        configurable: true
      });
    }
  }

  // ============ 4.5 Áp dụng Spoofing cho AudioContext ============
  function applyAudioSpoof() {
    const audioContexts = [window.AudioContext, window.webkitAudioContext];
    audioContexts.forEach(ctor => {
      if (!ctor) return;
      const proto = ctor.prototype;
      if (!proto.createOscillator) return;

      const originalCreateOscillator = proto.createOscillator;
      const spoofedCreateOscillator = createNativeProxy(originalCreateOscillator, {
        apply(target, thisArg, args) {
          const oscillator = Reflect.apply(target, thisArg, args);
          const originalStart = oscillator.start;
          const spoofedStart = createNativeProxy(originalStart, {
            apply(t, tArg, a) {
              // Apply subtle shift to frequency based on activeNoise
              const hash = Math.abs(simpleHash(activeNoise));
              const shift = (hash % 100) / 1000;
              if (tArg.frequency && tArg.frequency.value) {
                tArg.frequency.value += shift;
              }
              return Reflect.apply(t, tArg, a);
            }
          }, 'start');
          oscillator.start = spoofedStart;
          return oscillator;
        }
      }, 'createOscillator');

      Object.defineProperty(proto, 'createOscillator', {
        value: spoofedCreateOscillator,
        writable: true,
        configurable: true
      });
    });
  }

  // Helper lấy thông số profile hiện tại
  function getActiveProfileData() {
    const prof = window.__activeDeviceProfile;
    if (!prof) return null;
    // Map preset defaults if only id is passed
    if (prof.id === 'macbook-pro-m3') {
      return {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        platform: 'MacIntel',
        deviceMemory: 32,
        hardwareConcurrency: 14,
        maxTouchPoints: 0,
        screen: { width: 2560, height: 1600, availWidth: 2560, availHeight: 1575, colorDepth: 30, devicePixelRatio: 2 },
        webgl: { vendor: 'Apple', renderer: 'Apple M3 Max' }
      };
    }
    if (prof.id === 'win11-gaming-rtx4080') {
      return {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        platform: 'Win32',
        deviceMemory: 32,
        hardwareConcurrency: 16,
        maxTouchPoints: 0,
        screen: { width: 2560, height: 1440, availWidth: 2560, availHeight: 1400, colorDepth: 24, devicePixelRatio: 1 },
        webgl: { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)' }
      };
    }
    if (prof.id === 'iphone-16-pro') {
      return {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        deviceMemory: 8,
        hardwareConcurrency: 6,
        maxTouchPoints: 5,
        screen: { width: 393, height: 852, availWidth: 393, availHeight: 852, colorDepth: 32, devicePixelRatio: 3 },
        webgl: { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
      };
    }
    if (prof.id === 'samsung-s24-ultra') {
      return {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.88 Mobile Safari/537.36',
        platform: 'Linux aarch64',
        deviceMemory: 12,
        hardwareConcurrency: 8,
        maxTouchPoints: 5,
        screen: { width: 412, height: 915, availWidth: 412, availHeight: 915, colorDepth: 24, devicePixelRatio: 3.5 },
        webgl: { vendor: 'ARM', renderer: 'Mali-G715-Immortalis MC11' }
      };
    }
    if (prof.id === 'thinkpad-ubuntu-dev') {
      return {
        userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0',
        platform: 'Linux x86_64',
        deviceMemory: 16,
        hardwareConcurrency: 8,
        maxTouchPoints: 0,
        screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, devicePixelRatio: 1 },
        webgl: { vendor: 'Intel Open Source Technology Center', renderer: 'Mesa Intel(R) Iris(R) Xe Graphics (TGL GT2)' }
      };
    }
    if (prof.id === 'snapdragon-x-elite') {
      return {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; ARM64; Touch) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        platform: 'Win32',
        deviceMemory: 32,
        hardwareConcurrency: 12,
        maxTouchPoints: 10,
        screen: { width: 2880, height: 1920, availWidth: 2880, availHeight: 1880, colorDepth: 30, devicePixelRatio: 2 },
        webgl: { vendor: 'Qualcomm', renderer: 'ANGLE (Qualcomm, Qualcomm(R) Adreno(TM) X1-85 GPU Direct3D11 vs_5_0 ps_5_0, D3D11)' }
      };
    }
    if (prof.id === 'pixel-9-pro') {
      return {
        userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.88 Mobile Safari/537.36',
        platform: 'Linux aarch64',
        deviceMemory: 16,
        hardwareConcurrency: 8,
        maxTouchPoints: 5,
        screen: { width: 412, height: 924, availWidth: 412, availHeight: 924, colorDepth: 32, devicePixelRatio: 3.5 },
        webgl: { vendor: 'ARM', renderer: 'Mali-G715 Immortalis MC10' }
      };
    }
    return prof;
  }

  // ============ 5. Áp dụng Spoofing cho WebGL ============
  function applyWebGLSpoof() {
    const webglContexts = [window.WebGLRenderingContext, window.WebGL2RenderingContext];

    webglContexts.forEach((ctor) => {
      if (!ctor) return;
      const proto = ctor.prototype;
      const originalGetParameter = proto.getParameter;

      const spoofedGetParameter = createNativeProxy(
        originalGetParameter,
        {
          apply(target, thisArg, args) {
            const [param] = args;
            const profile = getActiveProfileData();
            const vendor = profile?.webgl?.vendor || "Google Inc. (Intel)";
            const renderer = profile?.webgl?.renderer || "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)";

            // 37445 = UNMASKED_VENDOR_WEBGL, 37446 = UNMASKED_RENDERER_WEBGL
            if (param === 37445) return vendor;
            if (param === 37446) return renderer;
            return Reflect.apply(target, thisArg, args);
          }
        },
        'getParameter'
      );

      Object.defineProperty(proto, 'getParameter', {
        value: spoofedGetParameter,
        writable: true,
        configurable: true
      });
    });
  }

  // ============ 6. Áp dụng Spoofing cho Navigator ============
  function applyNavigatorSpoof() {
    if (!window.navigator) return;

    // Giả lập User-Agent & Platform theo Profile
    ['userAgent', 'appVersion', 'platform', 'maxTouchPoints'].forEach(prop => {
      const originalProp = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
      if (originalProp && originalProp.get) {
        const spoofedGet = createNativeProxy(originalProp.get, {
          apply() {
            const profile = getActiveProfileData();
            if (profile) {
              if (prop === 'userAgent') return profile.userAgent || navigator.userAgent;
              if (prop === 'appVersion') return (profile.userAgent || '').replace(/^Mozilla\//, '');
              if (prop === 'platform') return profile.platform || navigator.platform;
              if (prop === 'maxTouchPoints') return typeof profile.maxTouchPoints === 'number' ? profile.maxTouchPoints : 0;
            }
            return Reflect.apply(originalProp.get, navigator, []);
          }
        }, `get ${prop}`);
        Object.defineProperty(Navigator.prototype, prop, {
          get: spoofedGet,
          enumerable: true,
          configurable: true
        });
      }
    });

    // Giả lập RAM (deviceMemory)
    if ('deviceMemory' in navigator) {
      const originalDeviceMemory = Object.getOwnPropertyDescriptor(Navigator.prototype, 'deviceMemory');
      if (originalDeviceMemory && originalDeviceMemory.get) {
        const spoofedGet = createNativeProxy(originalDeviceMemory.get, {
          apply() {
            const profile = getActiveProfileData();
            return profile?.deviceMemory || 8;
          }
        }, 'get deviceMemory');
        Object.defineProperty(Navigator.prototype, 'deviceMemory', {
          get: spoofedGet,
          enumerable: true,
          configurable: true
        });
      }
    }

    // Giả lập CPU Cores (hardwareConcurrency)
    if ('hardwareConcurrency' in navigator) {
      const originalHardwareConcurrency = Object.getOwnPropertyDescriptor(Navigator.prototype, 'hardwareConcurrency');
      if (originalHardwareConcurrency && originalHardwareConcurrency.get) {
        const spoofedGet = createNativeProxy(originalHardwareConcurrency.get, {
          apply() {
            const profile = getActiveProfileData();
            return profile?.hardwareConcurrency || 4;
          }
        }, 'get hardwareConcurrency');
        Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
          get: spoofedGet,
          enumerable: true,
          configurable: true
        });
      }
    }

    // Giả lập Ngôn ngữ (Language) thành en-US
    ['language', 'languages'].forEach(prop => {
      if (prop in navigator) {
        const originalProp = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
        if (originalProp && originalProp.get) {
          const spoofedGet = createNativeProxy(originalProp.get, {
            apply() { return prop === 'language' ? 'en-US' : ['en-US', 'en']; }
          }, `get ${prop}`);
          Object.defineProperty(Navigator.prototype, prop, {
            get: spoofedGet,
            enumerable: true,
            configurable: true
          });
        }
      }
    });
  }

  // ============ 6.5 Áp dụng Spoofing cho Screen ============
  function applyScreenSpoof() {
    if (!window.screen) return;
    const screenProps = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth'];

    screenProps.forEach(prop => {
      const originalProp = Object.getOwnPropertyDescriptor(Screen.prototype, prop);
      if (originalProp && originalProp.get) {
        const spoofedGet = createNativeProxy(originalProp.get, {
          apply() {
            const profile = getActiveProfileData();
            if (profile && profile.screen && profile.screen[prop]) {
              return profile.screen[prop];
            }
            return Reflect.apply(originalProp.get, window.screen, []);
          }
        }, `get ${prop}`);
        Object.defineProperty(Screen.prototype, prop, {
          get: spoofedGet,
          enumerable: true,
          configurable: true
        });
      }
    });
  }

  // ============ 7. Áp dụng Spoofing cho Vị trí (Geolocation) ============
  function applyGeolocationSpoof() {
    if (!window.navigator || !window.navigator.geolocation) return;

    function getFakePosition() {
      if (window.__activeGeoMode === 'uk') {
        return { coords: { latitude: 51.5074, longitude: -0.1278, accuracy: 100, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() };
      }
      if (window.__activeGeoMode === 'jp') {
        return { coords: { latitude: 35.6762, longitude: 139.6503, accuracy: 100, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() };
      }
      // Default to US
      return { coords: { latitude: 40.7128, longitude: -74.0060, accuracy: 100, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() };
    }

    const proto = Geolocation.prototype;

    // Spoof getCurrentPosition
    if (proto.getCurrentPosition) {
      const spoofedGetCurrentPosition = createNativeProxy(proto.getCurrentPosition, {
        apply(target, thisArg, args) {
          if (window.__activeGeoMode === 'default') {
            return Reflect.apply(target, thisArg, args);
          }
          const [successCallback, errorCallback] = args;
          if (window.__activeGeoMode === 'block') {
            if (typeof errorCallback === 'function') {
              setTimeout(() => errorCallback({ code: 1, message: "User denied Geolocation" }), 50);
            }
            return;
          }
          if (typeof successCallback === 'function') {
            setTimeout(() => successCallback(getFakePosition()), 50);
          }
        }
      }, 'getCurrentPosition');
      Object.defineProperty(proto, 'getCurrentPosition', {
        value: spoofedGetCurrentPosition,
        writable: true,
        configurable: true
      });
    }

    // Spoof watchPosition
    if (proto.watchPosition) {
      const spoofedWatchPosition = createNativeProxy(proto.watchPosition, {
        apply(target, thisArg, args) {
          if (window.__activeGeoMode === 'default') {
            return Reflect.apply(target, thisArg, args);
          }
          const [successCallback, errorCallback] = args;
          if (window.__activeGeoMode === 'block') {
            if (typeof errorCallback === 'function') {
              setTimeout(() => errorCallback({ code: 1, message: "User denied Geolocation" }), 50);
            }
            return Math.floor(Math.random() * 10000); // Fake watch ID
          }
          if (typeof successCallback === 'function') {
            setTimeout(() => successCallback(getFakePosition()), 50);
          }
          return Math.floor(Math.random() * 10000); // Fake watch ID
        }
      }, 'watchPosition');
      Object.defineProperty(proto, 'watchPosition', {
        value: spoofedWatchPosition,
        writable: true,
        configurable: true
      });
    }

    // Spoof navigator.permissions.query for geolocation
    if (window.navigator && window.navigator.permissions && window.navigator.permissions.query) {
      const originalQuery = window.navigator.permissions.query;
      const spoofedQuery = createNativeProxy(originalQuery, {
        apply(target, thisArg, args) {
          if (args && args[0] && args[0].name === 'geolocation') {
            if (window.__activeGeoMode === 'default') {
              return Reflect.apply(target, thisArg, args);
            }
            const state = window.__activeGeoMode === 'block' ? 'denied' : 'granted';
            return Promise.resolve({ state: state, onchange: null });
          }
          return Reflect.apply(target, thisArg, args);
        }
      }, 'query');
      Object.defineProperty(window.navigator.permissions, 'query', {
        value: spoofedQuery,
        writable: true,
        configurable: true
      });
    }
  }

  // ============ 8. Áp dụng Spoofing cho Múi giờ (Timezone) ============
  function applyTimezoneSpoof() {
    // Spoof Intl.DateTimeFormat().resolvedOptions().timeZone
    if (window.Intl && Intl.DateTimeFormat) {
      const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      const spoofedResolvedOptions = createNativeProxy(originalResolvedOptions, {
        apply(target, thisArg, args) {
          const options = Reflect.apply(target, thisArg, args);
          options.timeZone = 'America/New_York';
          return options;
        }
      }, 'resolvedOptions');
      Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
        value: spoofedResolvedOptions,
        writable: true,
        configurable: true
      });
    }

    // Spoof Date.prototype.getTimezoneOffset
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    const spoofedGetTimezoneOffset = createNativeProxy(originalGetTimezoneOffset, {
      apply(target, thisArg, args) {
        // New York is UTC-5 (300 minutes) or UTC-4 (240 minutes) depending on DST.
        // We'll return 240 as a generic offset for America/New_York summer time.
        return 240;
      }
    }, 'getTimezoneOffset');
    Object.defineProperty(Date.prototype, 'getTimezoneOffset', {
      value: spoofedGetTimezoneOffset,
      writable: true,
      configurable: true
    });
  }

  // ============ 9. Anti-Adblock & Player Bypass ============
  function applyAntiAdblockSpoof() {
    // 1. Spoof common AdBlock detection variables
    const adblockProps = [
      'adblocker', '_adblock', 'isAdBlockActive', 'adblock', 'fuckAdBlock', 'FuckAdBlock', 'sniffAdBlock', '_adb'
    ];
    adblockProps.forEach(prop => {
      try {
        Object.defineProperty(window, prop, {
          get: () => false,
          set: () => { },
          configurable: true
        });
      } catch (e) { }
    });

    // 2. Prevent video player AbortErrors & forced pausing by ads
    if (window.HTMLMediaElement) {
      // Intercept play() to swallow AbortErrors caused by adblockers blocking VAST
      const originalPlay = HTMLMediaElement.prototype.play;
      const spoofedPlay = createNativeProxy(originalPlay, {
        apply(target, thisArg, args) {
          const playPromise = Reflect.apply(target, thisArg, args);
          if (playPromise !== undefined && typeof playPromise.catch === 'function') {
            playPromise.catch(error => {
              if (error.name === 'AbortError') {
                console.log('[Privacy Player] Bypassed AbortError caused by blocked ads (My Machine, My Rules).');
                // Retry playing to force the player to continue without ads
                setTimeout(() => {
                  try { Reflect.apply(target, thisArg, args).catch(() => { }); } catch (e) { }
                }, 500);
              }
            });
          }
          return playPromise;
        }
      }, 'play');

      Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        value: spoofedPlay,
        writable: true,
        configurable: true
      });
    }

    // 3. Mock Google IMA SDK / VAST (để đánh lừa các trình phát video)
    // KHÔNG can thiệp trên các domain của Google để tránh xung đột với Google Search, Google XJS, Maps,...
    try {
      const hostname = window.location.hostname || '';
      const isGoogleSite = hostname === 'google.com' || hostname.endsWith('.google.com') ||
        hostname === 'gstatic.com' || hostname.endsWith('.gstatic.com') ||
        hostname === 'youtube.com' || hostname.endsWith('.youtube.com') ||
        hostname === 'googleapis.com' || hostname.endsWith('.googleapis.com');

      if (!isGoogleSite) {
        if (!window.google) window.google = {};
        if (!window.google.ima) {
          window.google.ima = {
            AdDisplayContainer: function () { this.initialize = () => { }; this.destroy = () => { }; },
            AdsRequest: function () { },
            AdsLoader: function () { this.requestAds = () => { }; this.addEventListener = () => { }; this.contentComplete = () => { }; this.destroy = () => { }; },
            AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: 'adsManagerLoaded' } },
            AdErrorEvent: { Type: { AD_ERROR: 'adError' } },
            ViewMode: { NORMAL: 'normal', FULLSCREEN: 'fullscreen' },
            ImaSdkSettings: function () { this.setLocale = () => { }; this.setVpaidMode = () => { }; }
          };
        }
      }
    } catch (e) { }
  }

  // ============ 10. Áp dụng Spoofing cho Battery API ============
  function applyBatterySpoof() {
    if (window.navigator && typeof window.navigator.getBattery === 'function') {
      const originalGetBattery = window.navigator.getBattery;
      const fakeBatteryManager = {
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1.0,
        addEventListener: function () { },
        removeEventListener: function () { },
        dispatchEvent: function () { return true; },
        onchargingchange: null,
        onchargingtimechange: null,
        ondischargingtimechange: null,
        onlevelchange: null
      };

      const spoofedGetBattery = createNativeProxy(originalGetBattery, {
        apply() {
          return Promise.resolve(fakeBatteryManager);
        }
      }, 'getBattery');

      try {
        Object.defineProperty(Navigator.prototype, 'getBattery', {
          value: spoofedGetBattery,
          writable: true,
          configurable: true
        });
      } catch (e) { }
    }
  }

  // ============ 11. Áp dụng Spoofing chống Font Fingerprinting ============
  function applyFontEnumerationSpoof() {
    // 1. Hook document.fonts.check
    if (document.fonts && typeof document.fonts.check === 'function') {
      const originalFontsCheck = document.fonts.check;
      const standardFonts = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Comic Sans MS', 'Trebuchet MS', 'Impact', 'Segoe UI', 'Roboto', 'sans-serif', 'serif', 'monospace'];

      const spoofedFontsCheck = createNativeProxy(originalFontsCheck, {
        apply(target, thisArg, args) {
          const fontSpec = args[0] || '';
          const hasStandard = standardFonts.some(f => fontSpec.toLowerCase().includes(f.toLowerCase()));
          if (!hasStandard) {
            return false;
          }
          return Reflect.apply(target, thisArg, args);
        }
      }, 'check');

      try {
        Object.defineProperty(FontFaceSet.prototype, 'check', {
          value: spoofedFontsCheck,
          writable: true,
          configurable: true
        });
      } catch (e) { }
    }

    // 2. Micro-noise trên Canvas measureText khi phát hiện font test fingerprinting
    if (window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype.measureText) {
      const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
      const spoofedMeasureText = createNativeProxy(originalMeasureText, {
        apply(target, thisArg, args) {
          const metrics = Reflect.apply(target, thisArg, args);
          const text = args[0] || '';
          if (text.length > 5 && (text.includes('mmm') || text.includes('www') || text.includes('fjord') || text.includes('glyph'))) {
            const hash = Math.abs(simpleHash(activeNoise + text));
            const noise = ((hash % 10) - 5) * 0.0001;
            try {
              return new Proxy(metrics, {
                get(mTarget, prop) {
                  if (prop === 'width') {
                    return mTarget.width + noise;
                  }
                  return Reflect.get(mTarget, prop);
                }
              });
            } catch (e) {
              return metrics;
            }
          }
          return metrics;
        }
      }, 'measureText');

      try {
        Object.defineProperty(CanvasRenderingContext2D.prototype, 'measureText', {
          value: spoofedMeasureText,
          writable: true,
          configurable: true
        });
      } catch (e) { }
    }
  }

  // ============ 12. Áp dụng Spoofing cho UserAgentData & Client Hints API ============
  function applyUserAgentDataSpoof() {
    if (!window.navigator || !window.navigator.userAgentData) return;

    const fakeBrands = [
      { brand: 'Chromium', version: '131' },
      { brand: 'Google Chrome', version: '131' },
      { brand: 'Not_A Brand', version: '24' }
    ];

    const fakeUaData = {
      brands: fakeBrands,
      mobile: false,
      platform: 'Windows',
      getHighEntropyValues: function (hints) {
        const result = {
          brands: fakeBrands,
          mobile: false,
          platform: 'Windows',
          platformVersion: '15.0.0',
          architecture: 'x86',
          bitness: '64',
          model: '',
          uaFullVersion: '131.0.6778.86',
          fullVersionList: [
            { brand: 'Chromium', version: '131.0.6778.86' },
            { brand: 'Google Chrome', version: '131.0.6778.86' },
            { brand: 'Not_A Brand', version: '24.0.0.0' }
          ]
        };
        return Promise.resolve(result);
      },
      toJSON: function () {
        return {
          brands: fakeBrands,
          mobile: false,
          platform: 'Windows'
        };
      }
    };

    try {
      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: createNativeProxy(function () { return fakeUaData; }, {
          apply() { return fakeUaData; }
        }, 'get userAgentData'),
        enumerable: true,
        configurable: true
      });
    } catch (e) { }
  }

  // ============ 13. Áp dụng Bảo Vệ Chống Rò Rỉ WebRTC (WebRTC Leak Shield) ============
  function applyWebRTCSpoof() {
    const originalRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (!originalRTCPeerConnection) return;

    function sanitizeCandidateString(candidateStr) {
      if (!candidateStr || typeof candidateStr !== 'string') return candidateStr;
      return candidateStr.replace(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/gi, (matchedIp) => {
        if (matchedIp.endsWith('.local') || matchedIp === '127.0.0.1' || matchedIp === '0.0.0.0') {
          return matchedIp;
        }
        return '0.0.0.0';
      });
    }

    class WrappedRTCPeerConnection {
      constructor(config, constraints) {
        const pc = new originalRTCPeerConnection(config, constraints);
        const originalAddEventListener = pc.addEventListener;
        pc.addEventListener = function (type, listener, options) {
          if (type === 'icecandidate' && typeof listener === 'function') {
            const wrappedListener = function (event) {
              if (event && event.candidate && event.candidate.candidate) {
                const sanitized = sanitizeCandidateString(event.candidate.candidate);
                try {
                  const proxyCandidate = new Proxy(event.candidate, {
                    get(target, prop) {
                      if (prop === 'candidate') return sanitized;
                      return Reflect.get(target, prop);
                    }
                  });
                  const proxyEvent = new Proxy(event, {
                    get(target, prop) {
                      if (prop === 'candidate') return proxyCandidate;
                      return Reflect.get(target, prop);
                    }
                  });
                  return listener.call(this, proxyEvent);
                } catch (e) {
                  return listener.call(this, event);
                }
              }
              return listener.call(this, event);
            };
            return originalAddEventListener.call(this, type, wrappedListener, options);
          }
          return originalAddEventListener.call(this, type, listener, options);
        };

        return pc;
      }
    }
    WrappedRTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
    try {
      window.RTCPeerConnection = WrappedRTCPeerConnection;
      if (window.RTCPeerConnection) {
        window.RTCPeerConnection = WrappedRTCPeerConnection;
      }
    } catch (e) {
      console.error('WebRTC spoofing failed:', e);
    }
  }

  // ============ Thực thi ngay ============
  try {
    applyCanvasSpoof();
    applyAudioSpoof();
    applyWebGLSpoof();
    applyNavigatorSpoof();
    applyScreenSpoof();
    applyGeolocationSpoof();
    applyTimezoneSpoof();
    applyAntiAdblockSpoof();
    applyBatterySpoof();
    applyFontEnumerationSpoof();
    applyUserAgentDataSpoof();
    applyWebRTCSpoof();
  } catch (e) {}

})();
