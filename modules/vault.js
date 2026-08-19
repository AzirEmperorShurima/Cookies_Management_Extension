import { elements, settings, notify, state, showConfirm } from '../popup.js';
import { encryptData, decryptData, createElement } from './utils.js';

const translations = window.translations;

export async function getVaultLocal() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['encryptedVaultLocal', 'privacyVault'], async (result) => {
            if (result.encryptedVaultLocal) {
                if (!state.secretCode) {
                    resolve([]);
                    return;
                }
                const decrypted = await decryptData(result.encryptedVaultLocal, state.secretCode);
                resolve(decrypted || []);
            } else if (result.privacyVault) {
                const plaintextVault = result.privacyVault || [];
                if (state.secretCode && plaintextVault.length > 0) {
                    const encrypted = await encryptData(plaintextVault, state.secretCode);
                    if (encrypted) {
                        chrome.storage.local.set({ encryptedVaultLocal: encrypted }, () => {
                            chrome.storage.local.remove(['privacyVault']);
                        });
                    }
                }
                resolve(plaintextVault);
            } else {
                resolve([]);
            }
        });
    });
}

export async function saveVaultLocal(vaultData) {
    return new Promise((resolve) => {
        if (!state.secretCode) {
            resolve(false);
            return;
        }
        encryptData(vaultData, state.secretCode).then((encrypted) => {
            if (encrypted) {
                chrome.storage.local.set({ encryptedVaultLocal: encrypted }, () => {
                    resolve(true);
                });
            } else {
                resolve(false);
            }
        });
    });
}

export async function syncVaultToCloud() {
    if (!settings.vaultSyncEnabled || !settings.masterSyncKey) return;

    const vault = await getVaultLocal();
    if (vault.length === 0) return;

    const masterKey = await decryptData(settings.masterSyncKey, state.secretCode);
    if (!masterKey) return;

    const encrypted = await encryptData(vault, masterKey);
    if (encrypted) {
        chrome.storage.sync.set({ encryptedVault: encrypted }, () => {
            console.log('Vault synced to cloud');
        });
    }
}

export async function pullVaultFromCloud() {
    if (!settings.vaultSyncEnabled || !settings.masterSyncKey) return;

    return new Promise((resolve) => {
        chrome.storage.sync.get(['encryptedVault'], async (result) => {
            if (result.encryptedVault) {
                const masterKey = await decryptData(settings.masterSyncKey, state.secretCode);
                if (!masterKey) return resolve(null);

                const decrypted = await decryptData(result.encryptedVault, masterKey);
                if (decrypted) {
                    const localVault = await getVaultLocal();
                    const mergedVault = [...localVault];

                    decrypted.forEach(remoteItem => {
                        if (!mergedVault.some(localItem => localItem.id === remoteItem.id)) {
                            mergedVault.push(remoteItem);
                        }
                    });

                    await saveVaultLocal(mergedVault);
                    resolve(mergedVault);
                } else {
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        });
    });
}

export function loadVault() {
    const lang = settings.language || 'vi';
    const dict = translations[lang] || translations.vi;

    const proceedLoad = () => {
        state.isVaultUnlocked = true;
        if (elements.vaultLockScreen) elements.vaultLockScreen.classList.remove('show');
        performVaultLoad(dict);
    };

    if (!state.secretCode) {
        if (!settings.alwaysRequirePassword && chrome.storage.session) {
            chrome.storage.session.get(['sessionPassword'], (result) => {
                if (result.sessionPassword) {
                    state.secretCode = result.sessionPassword;
                    proceedLoad();
                } else {
                    if (elements.vaultLockScreen) elements.vaultLockScreen.classList.add('show');
                    import('../popup.js').then(popup => {
                        popup.setupUnifiedLockScreen(elements.vaultLockScreen, elements.vaultPassInput, elements.unlockVault, proceedLoad);
                    });
                }
            });
        } else {
            if (elements.vaultLockScreen) elements.vaultLockScreen.classList.add('show');
            import('../popup.js').then(popup => {
                popup.setupUnifiedLockScreen(elements.vaultLockScreen, elements.vaultPassInput, elements.unlockVault, proceedLoad);
            });
        }
    } else {
        proceedLoad();
    }
}

export function performVaultLoad(dict) {
    if (settings.vaultSyncEnabled && settings.masterSyncKey) {
        pullVaultFromCloud().then(() => {
            renderVaultItems(dict);
        });
    } else {
        renderVaultItems(dict);
    }
}

export async function renderVaultItems(dict) {
    const { vaultList } = elements;
    if (!vaultList) return;

    const vault = await getVaultLocal();
    vaultList.textContent = '';
    if (!vault.length) {
        vaultList.appendChild(createElement('p', { className: 'empty-msg' }, dict.noVault || 'Your vault is empty. Right-click on pages or add notes here.'));
    }

    vault.sort((a, b) => new Date(b.date) - new Date(a.date));

    vault.forEach(item => {
        const div = document.createElement('div');
        div.className = 'vault-item';

        const iconSpan = document.createElement('div');
        iconSpan.className = 'vault-item-icon';
        iconSpan.textContent = item.type === 'link' ? '🔗' : '📝';
        div.appendChild(iconSpan);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'vault-item-info';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'vault-item-title';
        titleSpan.title = item.title;
        titleSpan.textContent = item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title;
        infoDiv.appendChild(titleSpan);

        if (item.url) {
            const urlAnchor = document.createElement('a');
            urlAnchor.href = item.url;
            urlAnchor.className = 'vault-item-url';
            urlAnchor.target = '_blank';
            urlAnchor.textContent = item.url;
            infoDiv.appendChild(urlAnchor);
        }

        const dateSmall = document.createElement('small');
        dateSmall.style.cssText = 'font-size: 0.7rem; color: #999;';
        dateSmall.textContent = new Date(item.date).toLocaleString();
        infoDiv.appendChild(dateSmall);

        div.appendChild(infoDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'vault-item-actions';

        const deleteButton = document.createElement('button');
        deleteButton.className = 'vault-delete-btn';
        deleteButton.title = 'Remove';
        deleteButton.textContent = '🗑️';
        actionsDiv.appendChild(deleteButton);

        div.appendChild(actionsDiv);

        deleteButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (await showConfirm('Remove this item from Vault?')) {
                const newVault = vault.filter(v => v.id !== item.id);
                await saveVaultLocal(newVault);
                renderVaultItems(dict);
                syncVaultToCloud();
            }
        });

        vaultList.appendChild(div);
    });
}

export function init() {
    const { vaultAddBtn, vaultInput } = elements;

    if (vaultAddBtn) {
        vaultAddBtn.addEventListener('click', async () => {
            if (!vaultInput) return;
            const note = vaultInput.value.trim();
            if (note) {
                const item = {
                    id: Date.now(),
                    title: note,
                    url: note.includes('http') ? note : null,
                    type: note.includes('http') ? 'link' : 'note',
                    date: new Date().toISOString()
                };

                const vault = await getVaultLocal();
                vault.unshift(item);
                await saveVaultLocal(vault);

                vaultInput.value = '';
                loadVault();
                syncVaultToCloud();
                const currentLang = settings.language || 'vi';
                const currentDict = window.translations[currentLang] || window.translations.vi;
                notify(currentDict.addedToVault || 'Added to Vault', 'success');
            } else {
                const currentLang = settings.language || 'vi';
                const currentDict = window.translations[currentLang] || window.translations.vi;
                notify(currentDict.enterNoteOrLink || 'Please enter a note or link', 'warning');
            }
        });
    }

    if (vaultInput) {
        vaultInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && vaultAddBtn) vaultAddBtn.click();
        });
    }

    loadVault();
}
