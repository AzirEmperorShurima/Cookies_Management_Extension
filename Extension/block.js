document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('goBackBtn').addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.close();
        }
    });
    
    // Optional: Parse URL params to override text if block.html is used for Zen Mode
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    if (reason === 'zen') {
        const shieldIcon = document.querySelector('.shield-icon');
        if (shieldIcon) {
            shieldIcon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line>';
            shieldIcon.style.color = '#a29bfe';
            shieldIcon.style.filter = 'drop-shadow(0 0 20px rgba(162, 155, 254, 0.6))';
        }
        
        // Remove data-i18n so it doesn't get overwritten by localization script
        const pageTitle = document.getElementById('pageTitle');
        const pageDesc = document.getElementById('pageDesc');
        const goBackBtn = document.getElementById('goBackBtn');
        
        if (pageTitle) {
            pageTitle.removeAttribute('data-i18n');
            pageTitle.innerText = 'Zen Mode Active';
        }
        
        if (pageDesc) {
            pageDesc.removeAttribute('data-i18n');
            pageDesc.innerText = 'Stay focused! This website has been blocked temporarily to help you maintain your flow state.';
        }
        
        if (goBackBtn) {
            goBackBtn.removeAttribute('data-i18n');
            goBackBtn.innerText = 'Return to Work';
        }
    }
});
