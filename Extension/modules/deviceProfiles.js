/**
 * modules/deviceProfiles.js
 * Smart User-Agent & Device Profile Generator
 * Provides realistic, consistent device profiles for advanced Anti-Fingerprinting.
 */

export const DEVICE_PROFILES = [
    {
        id: 'macbook-pro-m3',
        name: '🍎 MacBook Pro M3 Max (macOS Sonoma)',
        category: 'desktop',
        os: 'macOS',
        browser: 'Chrome 128',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        platform: 'MacIntel',
        deviceMemory: 32,
        hardwareConcurrency: 14,
        maxTouchPoints: 0,
        screen: {
            width: 2560,
            height: 1600,
            availWidth: 2560,
            availHeight: 1575,
            colorDepth: 30,
            pixelDepth: 30,
            devicePixelRatio: 2
        },
        webgl: {
            vendor: 'Apple',
            renderer: 'Apple M3 Max'
        },
        clientHints: {
            platform: 'macOS',
            platformVersion: '14.6.1',
            architecture: 'arm',
            model: '',
            mobile: false
        }
    },
    {
        id: 'win11-gaming-rtx4080',
        name: '💻 Windows 11 Gaming PC (RTX 4080)',
        category: 'desktop',
        os: 'Windows 11',
        browser: 'Chrome 128',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        platform: 'Win32',
        deviceMemory: 32,
        hardwareConcurrency: 16,
        maxTouchPoints: 0,
        screen: {
            width: 2560,
            height: 1440,
            availWidth: 2560,
            availHeight: 1400,
            colorDepth: 24,
            pixelDepth: 24,
            devicePixelRatio: 1
        },
        webgl: {
            vendor: 'Google Inc. (NVIDIA)',
            renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)'
        },
        clientHints: {
            platform: 'Windows',
            platformVersion: '15.0.0',
            architecture: 'x86',
            model: '',
            mobile: false
        }
    },
    {
        id: 'iphone-16-pro',
        name: '📱 iPhone 16 Pro (iOS 18 Safari)',
        category: 'mobile',
        os: 'iOS 18',
        browser: 'Mobile Safari 18',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        deviceMemory: 8,
        hardwareConcurrency: 6,
        maxTouchPoints: 5,
        screen: {
            width: 393,
            height: 852,
            availWidth: 393,
            availHeight: 852,
            colorDepth: 32,
            pixelDepth: 32,
            devicePixelRatio: 3
        },
        webgl: {
            vendor: 'Apple Inc.',
            renderer: 'Apple GPU'
        },
        clientHints: {
            platform: 'iOS',
            platformVersion: '18.0',
            architecture: 'arm',
            model: 'iPhone 16 Pro',
            mobile: true
        }
    },
    {
        id: 'samsung-s24-ultra',
        name: '📱 Samsung Galaxy S24 Ultra (Android 14)',
        category: 'mobile',
        os: 'Android 14',
        browser: 'Chrome 128 Mobile',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.88 Mobile Safari/537.36',
        platform: 'Linux aarch64',
        deviceMemory: 12,
        hardwareConcurrency: 8,
        maxTouchPoints: 5,
        screen: {
            width: 412,
            height: 915,
            availWidth: 412,
            availHeight: 915,
            colorDepth: 24,
            pixelDepth: 24,
            devicePixelRatio: 3.5
        },
        webgl: {
            vendor: 'ARM',
            renderer: 'Mali-G715-Immortalis MC11'
        },
        clientHints: {
            platform: 'Android',
            platformVersion: '14.0.0',
            architecture: 'arm64',
            model: 'SM-S928B',
            mobile: true
        }
    },
    {
        id: 'thinkpad-ubuntu-dev',
        name: '🐧 ThinkPad Ubuntu Linux (Dev Rig)',
        category: 'desktop',
        os: 'Ubuntu Linux 24.04',
        browser: 'Firefox 129',
        userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0',
        platform: 'Linux x86_64',
        deviceMemory: 16,
        hardwareConcurrency: 8,
        maxTouchPoints: 0,
        screen: {
            width: 1920,
            height: 1080,
            availWidth: 1920,
            availHeight: 1040,
            colorDepth: 24,
            pixelDepth: 24,
            devicePixelRatio: 1
        },
        webgl: {
            vendor: 'Intel Open Source Technology Center',
            renderer: 'Mesa Intel(R) Iris(R) Xe Graphics (TGL GT2)'
        },
        clientHints: {
            platform: 'Linux',
            platformVersion: '6.8.0',
            architecture: 'x86_64',
            model: '',
            mobile: false
        }
    },
    {
        id: 'snapdragon-x-elite',
        name: '⚡ Surface Laptop 7 (Snapdragon X Elite ARM64)',
        category: 'desktop',
        os: 'Windows 11 ARM64',
        browser: 'Chrome 128 ARM64',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; ARM64; Touch) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        platform: 'Win32',
        deviceMemory: 32,
        hardwareConcurrency: 12,
        maxTouchPoints: 10,
        screen: {
            width: 2880,
            height: 1920,
            availWidth: 2880,
            availHeight: 1880,
            colorDepth: 30,
            pixelDepth: 30,
            devicePixelRatio: 2
        },
        webgl: {
            vendor: 'Qualcomm',
            renderer: 'ANGLE (Qualcomm, Qualcomm(R) Adreno(TM) X1-85 GPU Direct3D11 vs_5_0 ps_5_0, D3D11)'
        },
        clientHints: {
            platform: 'Windows',
            platformVersion: '15.0.0',
            architecture: 'arm',
            model: 'Surface Laptop 7th Edition',
            mobile: false
        }
    },
    {
        id: 'pixel-9-pro',
        name: '📱 Google Pixel 9 Pro (Tensor G4 - Android 15)',
        category: 'mobile',
        os: 'Android 15',
        browser: 'Chrome 128 Mobile',
        userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.88 Mobile Safari/537.36',
        platform: 'Linux aarch64',
        deviceMemory: 16,
        hardwareConcurrency: 8,
        maxTouchPoints: 5,
        screen: {
            width: 412,
            height: 924,
            availWidth: 412,
            availHeight: 924,
            colorDepth: 32,
            pixelDepth: 32,
            devicePixelRatio: 3.5
        },
        webgl: {
            vendor: 'ARM',
            renderer: 'Mali-G715 Immortalis MC10'
        },
        clientHints: {
            platform: 'Android',
            platformVersion: '15.0.0',
            architecture: 'arm64',
            model: 'Pixel 9 Pro',
            mobile: true
        }
    }
];

/**
 * Get active device profile from storage
 */
export async function getActiveDeviceProfile() {
    const res = await chrome.storage.local.get(['activeDeviceProfileId', 'customDeviceProfile']);
    if (res.customDeviceProfile) return res.customDeviceProfile;
    const profileId = res.activeDeviceProfileId;
    return DEVICE_PROFILES.find(p => p.id === profileId) || null;
}

/**
 * Set active device profile
 */
export async function setActiveDeviceProfile(profileId) {
    if (profileId === 'default' || !profileId) {
        await chrome.storage.local.remove(['activeDeviceProfileId', 'customDeviceProfile']);
        return null;
    }

    const found = DEVICE_PROFILES.find(p => p.id === profileId);
    if (found) {
        await chrome.storage.local.set({
            activeDeviceProfileId: profileId,
            customDeviceProfile: null
        });
        return found;
    }
    return null;
}

/**
 * Generate a random, mathematically consistent device profile
 */
export function generateRandomDeviceProfile() {
    const archetypes = [
        {
            os: 'Windows 11',
            platform: 'Win32',
            mobile: false,
            memories: [16, 32],
            concurrencies: [8, 12, 16],
            screens: [{ w: 1920, h: 1080 }, { w: 2560, h: 1440 }],
            gpus: [
                { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
                { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' }
            ]
        },
        {
            os: 'macOS',
            platform: 'MacIntel',
            mobile: false,
            memories: [16, 24, 32],
            concurrencies: [8, 10, 12],
            screens: [{ w: 2560, h: 1600 }, { w: 3024, h: 1964 }],
            gpus: [
                { vendor: 'Apple', renderer: 'Apple M2 Pro' },
                { vendor: 'Apple', renderer: 'Apple M3' }
            ]
        }
    ];

    const arch = archetypes[Math.floor(Math.random() * archetypes.length)];
    const screen = arch.screens[Math.floor(Math.random() * arch.screens.length)];
    const gpu = arch.gpus[Math.floor(Math.random() * arch.gpus.length)];
    const memory = arch.memories[Math.floor(Math.random() * arch.memories.length)];
    const concurrency = arch.concurrencies[Math.floor(Math.random() * arch.concurrencies.length)];

    const ua = arch.os === 'macOS'
        ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

    return {
        id: 'custom_random_' + Date.now(),
        name: `🎲 Random ${arch.os} (${gpu.renderer.split(' ')[1] || 'GPU'})`,
        category: 'desktop',
        os: arch.os,
        userAgent: ua,
        platform: arch.platform,
        deviceMemory: memory,
        hardwareConcurrency: concurrency,
        maxTouchPoints: 0,
        screen: {
            width: screen.w,
            height: screen.h,
            availWidth: screen.w,
            availHeight: screen.h - 40,
            colorDepth: 24,
            pixelDepth: 24,
            devicePixelRatio: arch.os === 'macOS' ? 2 : 1
        },
        webgl: gpu,
        clientHints: {
            platform: arch.os,
            platformVersion: '14.0.0',
            architecture: arch.os === 'macOS' ? 'arm' : 'x86',
            model: '',
            mobile: false
        }
    };
}
