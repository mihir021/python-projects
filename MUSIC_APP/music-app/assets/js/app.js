/**
 * App.js
 * Application entry point. Ties controllers together and registers Service Worker.
 */

async function initApp() {
    try {
        // 1. Init Data
        const playlistManager = new PlaylistManager();
        const player = new MusicPlayer();
        
        // Wait slightly to ensure UI class is loaded
        window.UI = new UIManager(player, playlistManager);
        
        // Use globally loaded MOCK_SONGS array defined in data/songs.js
        playlistManager.setLibrary(window.MOCK_SONGS || []);
        
        // Init UI
        window.UI.init();

    } catch (e) {
        console.error("FATAL INITIALIZATION ERROR:", e);
        if(window.UI && window.UI.showToast) window.UI.showToast("Failed to initialize app: " + e.message);
    }

    // 2. Unregister Service Worker to avoid caching issues during debugging
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
                registration.unregister();
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
