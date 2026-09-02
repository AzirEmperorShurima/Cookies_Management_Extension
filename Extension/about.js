// about.js - Xử lý đa ngôn ngữ cho trang About
const translations = {
    vi: {
        pageTitle: "Thanus Privacy Gauntlet",
        back: "⬅ Quay lại",
        aboutIntroTitle: "📖 Giới thiệu",
        aboutIntroDesc: "Privacy & Cookies Manager là một công cụ mạnh mẽ giúp bạn kiểm soát hoàn toàn quyền riêng tư và dữ liệu duyệt web của mình. Với các tính năng bảo mật tiên tiến, chúng tôi giúp bạn lướt web an toàn và sạch sẽ hơn.",
        aboutGuideTitle: "🛠 Hướng dẫn sử dụng",
        aboutGuide1: "Cookies Manager: Xem, sao chép, xuất và xóa cookies của trang web hiện tại hoặc toàn bộ trình duyệt.",
        aboutGuide2: "Privacy Player: Xem video, phim trong môi trường cách ly (Iframe) để tránh bị theo dõi.",
        aboutGuide3: "Privacy Vault: Lưu trữ các liên kết quan trọng trong một \"két sắt\" được bảo vệ bằng mật mã.",
        aboutGuide4: "Side Panel: Bạn có thể bật tính năng này trong cài đặt để sử dụng extension song song với việc lướt web.",
        aboutGuide5: "Security Protection: Bật tính năng chặn Clickjacking và Crypto Mining trong phần cài đặt để tăng cường bảo mật.",
        aboutTip: "💡 Mẹo nhỏ: Để có trải nghiệm tốt nhất và an toàn nhất, bạn nên sử dụng extension này kết hợp với các công cụ chặn quảng cáo như uBlock Origin hoặc các trình duyệt tích hợp sẵn tính năng chặn quảng cáo mạnh mẽ như Cốc Cốc hoặc Brave.",
        author: "Tác giả: Justinan - DrakeDev"
    },
    en: {
        pageTitle: "Thanus Privacy Gauntlet",
        back: "⬅ Back",
        aboutIntroTitle: "📖 Introduction",
        aboutIntroDesc: "Privacy & Cookies Manager is a powerful tool that helps you take full control of your privacy and browsing data. With advanced security features, we help you browse the web safer and cleaner.",
        aboutGuideTitle: "🛠 User Guide",
        aboutGuide1: "Cookies Manager: View, copy, export, and delete cookies for the current site or the entire browser.",
        aboutGuide2: "Privacy Player: Watch videos and movies in an isolated environment (Iframe) to avoid tracking.",
        aboutGuide3: "Privacy Vault: Store important links in a password-protected 'vault'.",
        aboutGuide4: "Side Panel: You can enable this in settings to use the extension alongside your browsing.",
        aboutGuide5: "Security Protection: Enable Clickjacking and Crypto Mining blocking in settings for enhanced security.",
        aboutTip: "💡 Quick Tip: For the best and safest experience, use this extension combined with ad-blocking tools like uBlock Origin or browsers with strong built-in ad-blocking like Coc Coc or Brave.",
        author: "Author: Justinan - DrakeDev"
    },
    ja: {
        pageTitle: "Thanus Privacy Gauntlet",
        back: "⬅ 戻る",
        aboutIntroTitle: "📖 紹介",
        aboutIntroDesc: "Privacy & Cookies Managerは、プライバシーとブラウジングデータを完全に制御するのに役立つ強力なツールです。高度なセキュリティ機能により、より安全でクリーンなウェブ閲覧を支援します。",
        aboutGuideTitle: "🛠 ユーザーガイド",
        aboutGuide1: "クッキー管理：現在のサイトまたはブラウザ全体のクッキーを表示、コピー、エクスポート、削除します。",
        aboutGuide2: "プライバシープレーヤー：追跡を避けるために、隔離された環境（Iframe）でビデオや映画を視聴します。",
        aboutGuide3: "保管庫：重要なリンクをパスワードで保護された「保管庫」に保存します。",
        aboutGuide4: "サイドパネル：設定でこれを有効にすると、ブラウジングと並行して拡張機能を使用できます。",
        aboutGuide5: "セキュリティ保護：セキュリティを強化するために、設定でクリックジャッキングと暗号通貨マイニングのブロックを有効にします。",
        aboutTip: "💡 クイックヒント：最高で最も安全な体験のために、uBlock Originのような広告ブロックツール、またはCoc CocやBraveのような強力な組み込み広告ブロックを備えたブラウザと組み合わせてこの拡張機能を使用してください。",
        author: "著者: Justinan - DrakeDev"
    },
    fr: {
        pageTitle: "Thanus Privacy Gauntlet",
        back: "⬅ Retour",
        aboutIntroTitle: "📖 Introduction",
        aboutIntroDesc: "Privacy & Cookies Manager est un outil puissant qui vous aide à prendre le contrôle total de votre vie privée et de vos données de navigation. Grâce à des fonctionnalités de sécurité avancées, nous vous aidons à naviguer sur le Web de manière plus sûre et plus propre.",
        aboutGuideTitle: "🛠 Guide de l'utilisateur",
        aboutGuide1: "Gestionnaire de cookies : Affichez, copiez, exportez et supprimez les cookies du site actuel ou de l'ensemble du navigateur.",
        aboutGuide2: "Lecteur privé : Regardez des vidéos et des films dans un environnement isolé (Iframe) pour éviter le suivi.",
        aboutGuide3: "Coffre-fort : Stockez les liens importants dans un « coffre-fort » protégé par mot de passe.",
        aboutGuide4: "Panneau latéral : Vous pouvez l'activer dans les paramètres pour utiliser l'extension parallèlement à votre navigation.",
        aboutGuide5: "Protection de sécurité : Activez le blocage du Clickjacking et du Crypto Mining dans les paramètres pour une sécurité renforcée.",
        aboutGuideTitle: "🛠 Guide de l'utilisateur",
        aboutTip: "💡 Astuce rapide : Pour une expérience optimale et plus sûre, utilisez cette extension en combinaison avec des outils de blocage de publicités comme uBlock Origin ou des navigateurs avec un blocage de publicités intégré puissant comme Coc Coc ou Brave.",
        author: "Auteur: Justinan - DrakeDev"
    },
    zh: {
        pageTitle: "Thanus Privacy Gauntlet",
        back: "⬅ 返回",
        aboutIntroTitle: "📖 介绍",
        aboutIntroDesc: "Privacy & Cookies Manager 是一款功能强大的工具，可帮助您完全控制隐私和浏览数据。凭借先进的安全功能，我们帮助您更安全、更干净地浏览网页。",
        aboutGuideTitle: "🛠 用户指南",
        aboutGuide1: "Cookie 管理器：查看、复制、导出和删除当前网站或整个浏览器的 Cookie。",
        aboutGuide2: "隐私播放器：在隔离环境 (Iframe) 中观看视频和电影，以避免跟踪。",
        aboutGuide3: "隐私保险库：将重要链接存储在受密码保护的“保险库”中。",
        aboutGuide4: "侧边栏：您可以在设置中启用此功能，以便在浏览时同时使用扩展程序。",
        aboutGuide5: "安全保护：在设置中启用点击劫持和加密货币挖掘阻止，以增强安全性。",
        aboutTip: "💡 小贴士：为了获得最佳和最安全的体验，请将此扩展程序与 uBlock Origin 等广告拦截工具或具有强大内置广告拦截功能的浏览器（如 Coc Coc 或 Brave）结合使用。",
        author: "作者: Justinan - DrakeDev"
    },
    ru: {
        pageTitle: "Thanus Privacy Gauntlet",
        back: "⬅ Назад",
        aboutIntroTitle: "📖 Введение",
        aboutIntroDesc: "Privacy & Cookies Manager — это мощный инструмент, который поможет вам полностью контролировать свою приватность и данные просмотра. Благодаря расширенным функциям безопасности мы помогаем вам пользоваться интернетом безопаснее и чище.",
        aboutGuideTitle: "🛠 Руководство пользователя",
        aboutGuide1: "Менеджер Cookie: просмотр, копирование, экспорт и удаление куки текущего сайта или всего браузера.",
        aboutGuide2: "Privacy Player: просмотр видео в изолированной среде (Iframe), чтобы избежать отслеживания.",
        aboutGuide3: "Privacy Vault: хранение важных ссылок в защищенном паролем «сейфе».",
        aboutGuide4: "Боковая панель: вы можете включить ее в настройках для использования расширения параллельно с просмотром сайтов.",
        aboutGuide5: "Защита: включите блокировку кликджекинга и криптомайнинга для повышения безопасности.",
        aboutTip: "💡 Совет: для наилучшего опыта используйте это расширение вместе с блокировщиками рекламы, такими как uBlock Origin.",
        author: "Автор: Justinan - DrakeDev"
    },
    de: {
        pageTitle: "Thanus Privacy Gauntlet",
        back: "⬅ Zurück",
        aboutIntroTitle: "📖 Einführung",
        aboutIntroDesc: "Privacy & Cookies Manager ist ein leistungsstarkes Tool, das Ihnen hilft, die volle Kontrolle über Ihre Privatsphäre und Browserdaten zu behalten.",
        aboutGuideTitle: "🛠 Benutzerhandbuch",
        aboutGuide1: "Cookie-Manager: Cookies der aktuellen Seite oder des gesamten Browsers anzeigen, kopieren und löschen.",
        aboutGuide2: "Privacy Player: Videos in einer isolierten Umgebung (Iframe) ansehen, um Tracking zu vermeiden.",
        aboutGuide3: "Privacy Vault: Wichtige Links in einem passwortgeschützten «Tresor» speichern.",
        aboutGuide4: "Seitenleiste: Nutzen Sie die Erweiterung parallel zum Browsen.",
        aboutGuide5: "Sicherheitsschutz: Aktivieren Sie den Schutz vor Clickjacking und Crypto-Mining.",
        aboutTip: "💡 Tipp: Verwenden Sie diese Erweiterung zusammen mit uBlock Origin für maximale Sicherheit.",
        author: "Autor: Justinan - DrakeDev"
    }
};

function updateUILanguage(lang) {
    const dict = translations[lang] || translations.vi;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.textContent = dict[key];
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['appSettings'], (result) => {
        const settings = result.appSettings || {};
        const lang = settings.language || 'vi';
        const activeTheme = settings.theme || (settings.darkMode ? 'cyber-dark' : 'sakura-light');
        document.documentElement.setAttribute('data-theme', activeTheme);
        document.body.setAttribute('data-theme', activeTheme);
        updateUILanguage(lang);
    });
});