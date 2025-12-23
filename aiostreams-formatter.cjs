/**
 * AIOStreams Formatter Module
 * ===========================
 * Generates stream names compatible with AIOStreams addon.
 * 
 * AIOStreams parses debrid service and cache status from the stream `name` field.
 * It looks for known service names (RD, TB, AD) and cache symbols (⚡, ⏳).
 * 
 * Cached symbols: +, ⚡, 🚀, "cached"
 * Uncached symbols: ⏳, "download", "UNCACHED"
 * 
 * @version 1.0.0
 */

/**
 * Format stream name for AIOStreams compatibility
 * 
 * @param {Object} options - Formatting options
 * @param {string} options.addonName - Base addon name (e.g., "IlCorsaroViola")
 * @param {string} options.service - Debrid service: 'realdebrid', 'torbox', 'alldebrid', 'p2p'
 * @param {boolean} options.cached - Whether the torrent is cached
 * @param {string} options.quality - Quality string (e.g., "1080p", "4K")
 * @param {boolean} [options.hasError] - Whether there's an error with this stream
 * @returns {string} Formatted stream name for AIOStreams
 */
function formatStreamName({ addonName, service, cached, quality, hasError = false }) {
    // Map service to AIOStreams-recognized abbreviation
    const serviceAbbr = {
        'realdebrid': 'RD',
        'torbox': 'TB',
        'alldebrid': 'AD',
        'p2p': 'P2P'
    };

    const abbr = serviceAbbr[service.toLowerCase()] || 'P2P';

    // P2P doesn't have cache status
    if (abbr === 'P2P') {
        return `${addonName} P2P\n${quality || 'Unknown'}`;
    }

    // Cache symbol: ⚡ for cached, ⏳ for uncached
    const cacheSymbol = cached ? '⚡' : '⏳';

    // Error indicator (optional)
    const errorIndicator = hasError ? ' ⚠️' : '';

    // Format: "AddonName SERVICE⚡\nQuality"
    return `${addonName} ${abbr}${cacheSymbol}${errorIndicator}\n${quality || 'Unknown'}`;
}

/**
 * Format stream title for AIOStreams compatibility
 * Title remains mostly the same, but ensures proper structure
 * 
 * @param {Object} options - Formatting options
 * @param {string} options.title - Main title/filename
 * @param {string} options.size - File size string
 * @param {string} [options.language] - Language indicator
 * @param {string} [options.source] - Source/indexer
 * @param {number} [options.seeders] - Number of seeders
 * @param {boolean} [options.isPack] - Whether this is a pack/season
 * @param {string} [options.episodeTitle] - Episode filename for packs
 * @returns {string} Formatted stream title
 */
function formatStreamTitle({ title, size, language, source, seeders, isPack = false, episodeTitle }) {
    const lines = [];

    // Line 1: Main title (with pack indicator if applicable)
    if (isPack) {
        lines.push(`🗳️ ${title}`);
        if (episodeTitle) {
            lines.push(`📂 ${episodeTitle}`);
        }
    } else {
        lines.push(`🎬 ${title}`);
    }

    // Line 2: Size
    if (size) {
        lines.push(`💾 ${size}`);
    }

    // Line 3: Language (if available)
    if (language) {
        lines.push(`🗣️ ${language}`);
    }

    // Line 4: Source and seeders
    const sourceInfo = [];
    if (source) sourceInfo.push(`🔗 ${source}`);
    if (seeders !== undefined && seeders !== null) sourceInfo.push(`👥 ${seeders}`);
    if (sourceInfo.length > 0) {
        lines.push(sourceInfo.join(' '));
    }

    return lines.join('\n');
}

/**
 * Check if AIOStreams mode is enabled in config
 * 
 * @param {Object} config - User configuration
 * @returns {boolean} Whether AIOStreams mode is enabled
 */
function isAIOStreamsEnabled(config) {
    return config.aiostreams_mode === true;
}

// Export for Node.js
module.exports = {
    formatStreamName,
    formatStreamTitle,
    isAIOStreamsEnabled
};
