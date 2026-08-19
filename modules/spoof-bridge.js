(function () {
  'use strict';

  // ============ 0. Bypass Bot Verifications ============
  try {
      const href = (window.location.href || '').toLowerCase();
      const pathname = (window.location.pathname || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();
      const isBotVerification = 
          href.includes('cloudflare.com') ||
          href.includes('challenges.cloudflare.com') ||
          href.includes('turnstile.cloudflare.com') ||
          href.includes('hcaptcha.com') ||
          href.includes('recaptcha.net') ||
          href.includes('google.com/recaptcha') ||
          href.includes('cdn-cgi/challenge-platform') ||
          pathname.includes('cdn-cgi/challenge-platform') ||
          pathname.includes('__cf_chl_') ||
          search.includes('cf_chl_') ||
          search.includes('__cf_chl_');
          
      if (isBotVerification) {
          return;
      }
  } catch (e) {}

  // Biến lưu trữ cấu hình
  const DEFAULT_SEED = 'DEFAULT_FALLBACK_SEED_186626EB39E9A89A';
  let cachedSeed = null;
  let cachedGeoMode = 'us';
  let cachedDeviceProfile = null;
  let cachedAdblockEnabled = true;

  function syncAdblockToMain(enabled) {
    cachedAdblockEnabled = enabled !== false;
    try {
      if (document.documentElement && document.documentElement.dataset) {
        document.documentElement.dataset.thanusAdblock = cachedAdblockEnabled.toString();
      }
    } catch(e) {}
    window.postMessage({ type: '__THANUS_ADBLOCK_SYNC__', enabled: cachedAdblockEnabled }, '*');
  }

  // Khởi chạy: Lấy installSeed, appSettings và activeDeviceProfile ngay khi script load
  try {
    chrome.storage.local.get(['installSeed', 'privacyPlayerGeoMode', 'activeDeviceProfileId', 'customDeviceProfile', 'appSettings'], (res) => {
      if (chrome.runtime.lastError || !res) {
        cachedSeed = DEFAULT_SEED;
        return;
      }
      if (res.appSettings) {
        syncAdblockToMain(res.appSettings.adblockEnabled);
      }
      if (res.installSeed) {
        cachedSeed = res.installSeed;
      } else {
        const newSeed = (typeof crypto !== 'undefined' && crypto.getRandomValues) 
          ? crypto.getRandomValues(new Uint32Array(4)).join('-') 
          : DEFAULT_SEED;
        cachedSeed = newSeed;
        try {
          chrome.storage.local.set({ installSeed: newSeed });
        } catch(e) {}
      }
      if (res.privacyPlayerGeoMode) {
        cachedGeoMode = res.privacyPlayerGeoMode;
      }
      if (res.customDeviceProfile) {
        cachedDeviceProfile = res.customDeviceProfile;
      } else if (res.activeDeviceProfileId) {
        cachedDeviceProfile = { id: res.activeDeviceProfileId };
      }
    });
  } catch (e) {
    cachedSeed = DEFAULT_SEED;
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.appSettings) {
                const newSettings = changes.appSettings.newValue || {};
                syncAdblockToMain(newSettings.adblockEnabled);
            }
            if (changes.privacyPlayerGeoMode) {
                cachedGeoMode = changes.privacyPlayerGeoMode.newValue;
                window.postMessage({ type: '__NOISE_RESPONSE__', geoMode: cachedGeoMode, deviceProfile: cachedDeviceProfile }, '*');
            }
            if (changes.activeDeviceProfileId || changes.customDeviceProfile) {
                chrome.storage.local.get(['activeDeviceProfileId', 'customDeviceProfile'], (res) => {
                    cachedDeviceProfile = res.customDeviceProfile || (res.activeDeviceProfileId ? { id: res.activeDeviceProfileId } : null);
                    window.postMessage({ type: '__NOISE_RESPONSE__', geoMode: cachedGeoMode, deviceProfile: cachedDeviceProfile }, '*');
                });
            }
        }
    });
  } catch(e) {}

  // Helper: Băm chuỗi (SHA-256 đơn giản hóa hoặc băm 32-bit nhanh)
  // Dùng thuật toán băm đủ tốt để không dễ đoán nhưng phải cực nhanh.
  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
    }
    return hash.toString(16);
  }

  // Helper: Lấy eTLD+1 sử dụng tldts
  function getETLDPlus1(urlOrHostname) {
    if (!urlOrHostname) return '';
    try {
      // tldts được inject trước bridge qua manifest.json
      if (window.tldts && window.tldts.parse) {
        const parsed = window.tldts.parse(urlOrHostname);
        return parsed.domain || parsed.hostname || urlOrHostname;
      }
    } catch (e) {
      // Silent catch
    }
    // Fallback nếu tldts không hoạt động
    return urlOrHostname.replace(/^www\./, '');
  }

  // Lắng nghe yêu cầu từ MAIN world
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.type === '__REQUEST_NOISE__') {
      handleRequestNoise();
    }
  });

  let _waitAttempts = 0;
  function handleRequestNoise() {
    // Nếu chưa load xong seed từ storage thì đợi tối đa 25ms (5 * 5ms), sau đó dùng fallback
    if (!cachedSeed) {
      _waitAttempts++;
      if (_waitAttempts < 5) {
        setTimeout(handleRequestNoise, 5);
        return;
      }
      cachedSeed = DEFAULT_SEED;
    }

    const currentHostname = window.location.hostname || '';

    if (window === window.top) {
      // Nhánh 1: TOP FRAME - Tính toán trực tiếp đồng bộ, cực nhanh
      const domain = getETLDPlus1(currentHostname) || currentHostname || 'top_domain';
      const noise = hashString(cachedSeed + '|' + domain);
      window.postMessage({ type: '__NOISE_RESPONSE__', domainNoise: noise, geoMode: cachedGeoMode, deviceProfile: cachedDeviceProfile }, '*');
    } else {
      // Nhánh 2: IFRAME - Chống cross-site tracking
      try {
        chrome.runtime.sendMessage({ type: 'GET_TOP_LEVEL_DOMAIN' }, (response) => {
          if (chrome.runtime.lastError || !response) {
             const fallbackDomain = getETLDPlus1(currentHostname) || currentHostname || 'iframe_fallback';
             const fallbackNoise = hashString(cachedSeed + '|' + fallbackDomain);
             window.postMessage({ type: '__NOISE_RESPONSE__', domainNoise: fallbackNoise, geoMode: cachedGeoMode }, '*');
             return;
          }

          const targetDomain = response.domain || getETLDPlus1(currentHostname) || currentHostname || 'top_domain';
          const noise = hashString(cachedSeed + '|' + targetDomain);
          window.postMessage({ type: '__NOISE_RESPONSE__', domainNoise: noise, geoMode: cachedGeoMode, deviceProfile: cachedDeviceProfile }, '*');
        });
      } catch (e) {
        const fallbackDomain = getETLDPlus1(currentHostname) || currentHostname || 'iframe_fallback';
        const fallbackNoise = hashString(cachedSeed + '|' + fallbackDomain);
        window.postMessage({ type: '__NOISE_RESPONSE__', domainNoise: fallbackNoise, geoMode: cachedGeoMode }, '*');
      }
    }
  }

})();
