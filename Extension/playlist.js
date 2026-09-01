// Removed YouTube DNR rules as YouTube support is removed from Zen Mode

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, match => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[match]);
}
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const scIframe = document.getElementById('sc-widget');
    const html5Container = document.getElementById('html5-audio-container');
    const html5Audio = document.getElementById('html5-audio');
    
    const playPauseBtn = document.getElementById('playPauseBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const statusText = document.getElementById('statusText');
    
    const customPlaylistsContainer = document.getElementById('customPlaylistsContainer');
    const createNewPlaylistBtn = document.getElementById('createNewPlaylistBtn');
    const newPlaylistForm = document.getElementById('newPlaylistForm');
    const newPlaylistNameInput = document.getElementById('newPlaylistName');
    const cancelNewPlaylistBtn = document.getElementById('cancelNewPlaylistBtn');
    const saveNewPlaylistBtn = document.getElementById('saveNewPlaylistBtn');

    // Player instances
    let scWidget = null;
    
    // State
    let isPlaying = false;
    let currentPlaylist = [];
    let currentIndex = -1;
    let customPlaylists = [];
    let activeSourceType = null; // 'sc', 'html5'

    // Load custom playlists from storage
    chrome.storage.local.get(['zenCustomPlaylists', 'zenCustomMusic'], (res) => {
        if (res.zenCustomPlaylists) {
            customPlaylists = res.zenCustomPlaylists;
        } else if (res.zenCustomMusic && Array.isArray(res.zenCustomMusic) && res.zenCustomMusic.length > 0) {
            // Migrate old flat list
            customPlaylists = [{
                id: 'legacy_' + Date.now(),
                name: 'Imported Tracks',
                type: 'custom',
                tracks: res.zenCustomMusic
            }];
            chrome.storage.local.set({ zenCustomPlaylists: customPlaylists });
        }
        renderCustomPlaylists();
    });

    const defaultCards = document.querySelectorAll('.playlist-card');

    // Source parsing
    function parseSource(url) {
        if (!url) return null;
        if (url.includes('soundcloud.com')) {
            return { type: 'sc', raw: url };
        }
        // Assume direct audio for anything else (mp3, wav, etc)
        return { type: 'html5', raw: url };
    }

    function hideAllPlayers() {
        scIframe.style.display = 'none';
        html5Audio.pause();
        try { if (scWidget) scWidget.pause(); } catch(e) {}
    }

    const playerStatusBadge = document.getElementById('playerStatusBadge');

    function updatePlayPauseUI(playing) {
        isPlaying = playing;
        playPauseBtn.textContent = playing ? '⏸' : '▶';
        if (playing) {
            playPauseBtn.classList.add('paused-state');
            if (playerStatusBadge) {
                playerStatusBadge.classList.add('playing');
                playerStatusBadge.textContent = 'Playing';
            }
        } else {
            playPauseBtn.classList.remove('paused-state');
            if (playerStatusBadge) {
                playerStatusBadge.classList.remove('playing');
                playerStatusBadge.textContent = 'Paused';
            }
        }
    }

    // YouTube player removed.

    function initSoundCloudPlayer(url, title) {
        activeSourceType = 'sc';
        scIframe.style.display = 'block';
        statusText.textContent = `Playing: ${title || 'SoundCloud Track'}`;

        if (!scWidget) {
            scWidget = SC.Widget(scIframe);
            scWidget.bind(SC.Widget.Events.READY, () => {
                scWidget.setVolume(volumeSlider.value);
                
                scWidget.bind(SC.Widget.Events.PLAY, () => updatePlayPauseUI(true));
                scWidget.bind(SC.Widget.Events.PAUSE, () => updatePlayPauseUI(false));
                scWidget.bind(SC.Widget.Events.FINISH, () => playNext());
            });
        }
        
        const urlOptions = {
            auto_play: true,
            hide_related: true,
            show_comments: false,
            show_user: false,
            show_reposts: false,
            show_teaser: false,
            visual: true
        };
        
        scWidget.load(url, {
            ...urlOptions,
            callback: () => {
                scWidget.setVolume(volumeSlider.value);
                scWidget.play();
            }
        });
    }

    function initHtml5Player(url, title) {
        activeSourceType = 'html5';
        html5Container.style.display = 'flex';
        statusText.textContent = `Playing: ${title || 'Local/Direct Audio'}`;
        
        html5Audio.src = url;
        html5Audio.volume = volumeSlider.value / 100;
        
        html5Audio.play().then(() => {
            updatePlayPauseUI(true);
        }).catch(err => {
            console.error("Audio playback error:", err);
            statusText.textContent = `Error playing audio.`;
        });

        html5Audio.onplay = () => updatePlayPauseUI(true);
        html5Audio.onpause = () => updatePlayPauseUI(false);
        html5Audio.onended = () => playNext();
    }

    function playTrack(index, list) {
        if (index < 0 || index >= list.length) return;
        currentIndex = index;
        currentPlaylist = list;
        
        const track = list[index];
        const parsed = parseSource(track.url);
        
        if (!parsed) {
            statusText.textContent = `Invalid URL`;
            return;
        }

        hideAllPlayers();
        updateActiveUI(track.url);

        if (parsed.type === 'sc') {
            initSoundCloudPlayer(parsed.raw, track.title);
        } else if (parsed.type === 'html5') {
            initHtml5Player(parsed.raw, track.title);
        }
    }

    function playNext() {
        if (currentPlaylist.length === 0) return;
        let nextIndex = currentIndex + 1;
        if (nextIndex >= currentPlaylist.length) {
            nextIndex = 0; // Loop back
        }
        playTrack(nextIndex, currentPlaylist);
    }

    function playPrev() {
        if (currentPlaylist.length === 0) return;
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = currentPlaylist.length - 1;
        }
        playTrack(prevIndex, currentPlaylist);
    }

    function updateActiveUI(url) {
        defaultCards.forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.custom-item').forEach(c => c.classList.remove('active'));
        
        const matchDefault = Array.from(defaultCards).find(c => {
            const cardUrl = c.getAttribute('data-url');
            return cardUrl && cardUrl.includes(encodeURIComponent(url));
        });
        if (matchDefault) matchDefault.classList.add('active');
        
        const matchCustom = Array.from(document.querySelectorAll('.custom-item')).find(c => c.getAttribute('data-url') === url);
        if (matchCustom) matchCustom.classList.add('active');
    }

    // Default Playlists Click
    defaultCards.forEach((card, index) => {
        card.addEventListener('click', () => {
            const list = Array.from(defaultCards).map(c => {
                let fullUrl = c.getAttribute('data-url');
                let rawUrlMatch = fullUrl.match(/url=([^&]+)/);
                let rawUrl = rawUrlMatch ? decodeURIComponent(rawUrlMatch[1]) : fullUrl;
                return {
                    url: rawUrl,
                    title: c.querySelector('.card-title').textContent
                };
            });
            playTrack(index, list);
        });
    });

    // Custom Playlists Logic
    function saveCustomPlaylists() {
        chrome.storage.local.set({ zenCustomPlaylists: customPlaylists });
    }

    function renderCustomPlaylists() {
        if (!customPlaylistsContainer) return;
        customPlaylistsContainer.innerHTML = '';
        
        customPlaylists.forEach((pl, plIndex) => {
            const card = document.createElement('div');
            card.className = 'user-playlist-card';
            
            // Header
            const header = document.createElement('div');
            header.className = 'user-playlist-header';
            
            const titleWrap = document.createElement('div');
            titleWrap.className = 'user-playlist-title';
            const iconSpan = document.createElement('span');
            iconSpan.textContent = pl.type === 'soundcloud_set' ? '💽' : '📂';
            titleWrap.appendChild(iconSpan);
            const nameText = document.createTextNode(' ' + pl.name);
            titleWrap.appendChild(nameText);
            
            const actionsWrap = document.createElement('div');
            actionsWrap.className = 'user-playlist-actions';
            
            const playBtn = document.createElement('button');
            playBtn.className = 'play-pl-btn';
            playBtn.textContent = '▶ Play';
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (pl.type === 'soundcloud_set') {
                    playTrack(0, [{ url: pl.url, title: pl.name }]);
                } else if (pl.tracks && pl.tracks.length > 0) {
                    playTrack(0, pl.tracks);
                } else {
                    alert('Playlist is empty');
                }
            });
            
            const delPlBtn = document.createElement('button');
            delPlBtn.className = 'del-pl-btn';
            delPlBtn.textContent = '🗑';
            delPlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(confirm('Delete this playlist?')) {
                    customPlaylists.splice(plIndex, 1);
                    saveCustomPlaylists();
                    renderCustomPlaylists();
                }
            });
            
            actionsWrap.appendChild(playBtn);
            actionsWrap.appendChild(delPlBtn);
            
            header.appendChild(titleWrap);
            header.appendChild(actionsWrap);
            
            // Body (Tracks)
            const body = document.createElement('div');
            body.className = 'user-playlist-body';
            
            if (pl.type === 'custom') {
                const addTrackForm = document.createElement('div');
                addTrackForm.className = 'add-track-form';
                
                const trackInput = document.createElement('input');
                trackInput.type = 'text';
                trackInput.placeholder = 'Paste SoundCloud URL...';
                
                const addBtn = document.createElement('button');
                addBtn.textContent = 'Add';
                
                addBtn.addEventListener('click', () => {
                    const url = trackInput.value.trim();
                    if (url) {
                        if (!pl.tracks) pl.tracks = [];
                        pl.tracks.push({ url: url, title: 'Track ' + (pl.tracks.length + 1) });
                        saveCustomPlaylists();
                        renderCustomPlaylists();
                        setTimeout(() => {
                            const newCard = customPlaylistsContainer.children[plIndex];
                            if (newCard) newCard.classList.add('expanded');
                        }, 50);
                    }
                });
                
                addTrackForm.appendChild(trackInput);
                addTrackForm.appendChild(addBtn);
                body.appendChild(addTrackForm);
                
                const trackList = document.createElement('ul');
                trackList.className = 'custom-list';
                
                const htmlParts = (pl.tracks || []).map((track, tIndex) => {
                    const titleText = escapeHTML(track.title || track.url);
                    const urlText = escapeHTML(track.url);
                    return `
                        <li class="custom-item" data-index="${tIndex}">
                            <span class="custom-item-name" title="${urlText}">${titleText}</span>
                            <button class="delete-btn" data-delete-index="${tIndex}">×</button>
                        </li>
                    `;
                });
                
                trackList.innerHTML = htmlParts.join('');
                
                trackList.addEventListener('click', (e) => {
                    const deleteBtn = e.target.closest('.delete-btn');
                    if (deleteBtn) {
                        e.stopPropagation();
                        const tIndex = parseInt(deleteBtn.getAttribute('data-delete-index'), 10);
                        pl.tracks.splice(tIndex, 1);
                        saveCustomPlaylists();
                        renderCustomPlaylists();
                        setTimeout(() => {
                            const newCard = customPlaylistsContainer.children[plIndex];
                            if (newCard) newCard.classList.add('expanded');
                        }, 50);
                        return;
                    }
                    
                    const item = e.target.closest('.custom-item');
                    if (item) {
                        const tIndex = parseInt(item.getAttribute('data-index'), 10);
                        playTrack(tIndex, pl.tracks);
                    }
                });
                
                body.appendChild(trackList);
            } else {
                const infoDiv = document.createElement('div');
                Object.assign(infoDiv.style, { fontSize: '12px', color: 'var(--text-muted)', opacity: '0.7' });
                infoDiv.textContent = 'SoundCloud Set. Track details are loaded dynamically inside the player.';
                body.appendChild(infoDiv);
            }
            
            header.addEventListener('click', () => {
                card.classList.toggle('expanded');
            });
            
            card.appendChild(header);
            card.appendChild(body);
            customPlaylistsContainer.appendChild(card);
        });
    }

    if (createNewPlaylistBtn) {
        createNewPlaylistBtn.addEventListener('click', () => {
            createNewPlaylistBtn.style.display = 'none';
            newPlaylistForm.style.display = 'block';
            newPlaylistNameInput.focus();
        });
    }

    if (cancelNewPlaylistBtn) {
        cancelNewPlaylistBtn.addEventListener('click', () => {
            newPlaylistForm.style.display = 'none';
            createNewPlaylistBtn.style.display = 'flex';
            newPlaylistNameInput.value = '';
        });
    }

    if (saveNewPlaylistBtn) {
        saveNewPlaylistBtn.addEventListener('click', () => {
            const name = newPlaylistNameInput.value.trim();
            if (name) {
                let type = 'custom';
                let url = '';
                if (name.includes('soundcloud.com') && name.includes('/sets/')) {
                    type = 'soundcloud_set';
                    url = name;
                }
                
                customPlaylists.push({
                    id: 'pl_' + Date.now(),
                    name: type === 'soundcloud_set' ? 'SoundCloud Set' : name,
                    type: type,
                    url: url,
                    tracks: []
                });
                
                saveCustomPlaylists();
                renderCustomPlaylists();
                
                newPlaylistForm.style.display = 'none';
                createNewPlaylistBtn.style.display = 'flex';
                newPlaylistNameInput.value = '';
            }
        });
    }

    playPauseBtn.addEventListener('click', () => {
        if (!activeSourceType) {
            if (defaultCards.length > 0) {
                defaultCards[0].click();
            }
            return;
        }
        if (activeSourceType === 'sc') {
            try { scWidget.toggle(); } catch(e) {}
        } else if (activeSourceType === 'html5') {
            if (html5Audio.paused) html5Audio.play();
            else html5Audio.pause();
        }
    });

    nextBtn.addEventListener('click', playNext);
    prevBtn.addEventListener('click', playPrev);

    volumeSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (activeSourceType === 'sc') {
            try { scWidget.setVolume(val); } catch(e) {}
        } else if (activeSourceType === 'html5') {
            html5Audio.volume = val / 100;
        }
    });

    // Auto-play default if specified in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autoplay') === 'true') {
        setTimeout(() => {
            if (defaultCards.length > 0) {
                defaultCards[0].click();
            }
        }, 500);
    }
});
