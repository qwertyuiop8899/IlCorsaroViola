/**
 * ICV Custom Formatter Module - Full AIOStreams Syntax
 * 
 * Template parser completo con sintassi AIOStreams.
 * Supporta: ::and::, ::or::, ::xor::, ::~pattern, ::replace, ::truncate, 
 * ::length, ::reverse, ::time, ::bytes, ::hex, ::first, ::last, {tools.*}
 */

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatBytes(bytes, decimals = 2, base2 = false) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = base2 ? 1024 : 1000;
    const sizes = base2 ? ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'] : ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    seconds = Math.floor(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function getNestedValue(data, path) {
    if (!path) return null;
    const parts = path.split('.');
    let value = data;
    for (const part of parts) {
        if (value === null || value === undefined) return null;
        value = value[part];
    }
    return value;
}

// ============================================
// MODIFIER APPLICATION
// ============================================

function applySingleModifier(value, modifier, args) {
    if (value === null || value === undefined) return null;

    switch (modifier) {
        // String modifiers
        case 'upper':
            return String(value).toUpperCase();
        case 'lower':
            return String(value).toLowerCase();
        case 'title':
            return String(value).replace(/\w\S*/g, txt =>
                txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            );
        case 'replace':
            if (args.length >= 2) {
                return String(value).split(args[0]).join(args[1]);
            }
            return value;
        case 'truncate':
            const maxLen = parseInt(args[0]) || 20;
            const str = String(value);
            return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
        case 'length':
            if (Array.isArray(value)) return value.length;
            return String(value).length;
        case 'reverse':
            if (Array.isArray(value)) return [...value].reverse();
            return String(value).split('').reverse().join('');

        // Number modifiers
        case 'bytes':
            return formatBytes(Number(value), 2, false);
        case 'bytes2':
            return formatBytes(Number(value), 2, true);
        case 'rbytes':
            return formatBytes(Number(value), 0, false);
        case 'rbytes2':
            return formatBytes(Number(value), 0, true);
        case 'time':
            return formatTime(Number(value));
        case 'hex':
            return Number(value).toString(16);
        case 'octal':
            return Number(value).toString(8);
        case 'binary':
            return Number(value).toString(2);

        // Array modifiers
        case 'join':
            if (Array.isArray(value)) {
                return value.join(args[0] || ', ');
            }
            return value;
        case 'first':
            if (Array.isArray(value) && value.length > 0) return value[0];
            return value;
        case 'last':
            if (Array.isArray(value) && value.length > 0) return value[value.length - 1];
            return value;

        default:
            return value;
    }
}

function parseModifierArgs(argsString) {
    const args = [];
    const regex = /'([^']*)'|"([^"]*)"|([^,]+)/g;
    let match;
    while ((match = regex.exec(argsString)) !== null) {
        args.push(match[1] ?? match[2] ?? match[3]?.trim());
    }
    return args;
}

// ============================================
// CONDITION EVALUATION
// ============================================

function evaluateCondition(value, conditionExpr) {
    if (!conditionExpr) return true;

    // Pattern matching with ~
    if (conditionExpr.startsWith('~')) {
        const pattern = conditionExpr.substring(1);
        return String(value || '').toLowerCase().includes(pattern.toLowerCase());
    }

    // Comparison operators
    const opMatch = conditionExpr.match(/^([><!=]+)(.+)$/);
    if (opMatch) {
        const op = opMatch[1];
        const thresh = opMatch[2];
        switch (op) {
            case '>': return Number(value) > Number(thresh);
            case '>=': return Number(value) >= Number(thresh);
            case '<': return Number(value) < Number(thresh);
            case '<=': return Number(value) <= Number(thresh);
            case '=': return String(value) === String(thresh);
            case '!=': return String(value) !== String(thresh);
        }
    }

    // Boolean/existence checks
    switch (conditionExpr) {
        case 'exists':
            return value !== null && value !== undefined && value !== '' &&
                !(Array.isArray(value) && value.length === 0);
        case 'istrue':
            return value === true;
        case 'isfalse':
            return value === false;
        default:
            return true;
    }
}

/**
 * Evaluate a complete condition chain with ::and::, ::or::, ::xor::
 * Format: varPath::condition::and::varPath2::condition2...
 */
function evaluateConditionChain(expression, data) {
    // Split by ::and::, ::or::, ::xor:: preserving the operator
    const parts = [];
    const operators = [];

    // Regex to split while keeping track of logical operators
    const segments = expression.split(/::(and|or|xor)::/i);

    for (let i = 0; i < segments.length; i++) {
        if (i % 2 === 0) {
            // This is a condition segment
            parts.push(segments[i]);
        } else {
            // This is an operator
            operators.push(segments[i].toLowerCase());
        }
    }

    if (parts.length === 0) return true;

    // Evaluate first condition
    let result = evaluateSinglePart(parts[0], data);

    // Apply operators left to right
    for (let i = 0; i < operators.length; i++) {
        const nextResult = evaluateSinglePart(parts[i + 1], data);
        switch (operators[i]) {
            case 'and':
                result = result && nextResult;
                break;
            case 'or':
                result = result || nextResult;
                break;
            case 'xor':
                result = (result && !nextResult) || (!result && nextResult);
                break;
        }
    }

    return result;
}

function evaluateSinglePart(part, data) {
    // Part format: varPath::condition or just varPath
    const segments = part.split('::');
    const varPath = segments[0];
    const condition = segments.slice(1).join('::') || 'exists';

    const value = getNestedValue(data, varPath);
    return evaluateCondition(value, condition);
}

// ============================================
// MAIN PARSER
// ============================================

function parseTemplate(template, data, maxDepth = 15) {
    if (!template || maxDepth <= 0) return template || '';

    let result = template;

    // Handle {tools.*} first
    result = result.replace(/\{tools\.newLine\}/g, '\n');
    result = result.replace(/\{tools\.removeLine\}/g, ''); // Will be cleaned up later

    let lastResult = null;
    let iterations = 0;

    while (result !== lastResult && iterations < maxDepth) {
        lastResult = result;
        iterations++;

        // Match variable expressions: {varPath...["true"||"false"]}
        // This regex handles nested variables inside the true/false strings
        const varRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*(?:::[^\[\]{}]*)?)\s*(?:\["([^"]*)"\|\|"([^"]*)"\])?\}/g;

        let match;
        const replacements = [];

        while ((match = varRegex.exec(result)) !== null) {
            const fullMatch = match[0];
            const expression = match[1];
            const trueValue = match[2];
            const falseValue = match[3];

            const replacement = parseExpression(expression, trueValue, falseValue, data, maxDepth - 1);
            replacements.push({ from: fullMatch, to: replacement });
        }

        // Apply all replacements
        for (const rep of replacements) {
            result = result.replace(rep.from, rep.to);
        }
    }

    // Cleanup: remove lines that are entirely empty or whitespace-only
    result = result.split('\n')
        .filter(line => line.trim() !== '' || line === '')
        .join('\n');
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    return result;
}

function parseExpression(expression, trueValue, falseValue, data, maxDepth) {
    // Split expression into parts by ::
    const parts = expression.split('::');
    const varPath = parts[0];
    const modifierParts = parts.slice(1);

    let value = getNestedValue(data, varPath);

    // If we have conditional output ["true"||"false"]
    if (trueValue !== undefined) {
        // Check if this is a chained condition (has and/or/xor)
        const fullCondition = modifierParts.join('::');

        let conditionResult;
        if (/::(?:and|or|xor)::/i.test(fullCondition)) {
            // Chained condition: build full expression and evaluate
            conditionResult = evaluateConditionChain(varPath + '::' + fullCondition, data);
        } else if (fullCondition) {
            // Simple condition
            conditionResult = evaluateCondition(value, fullCondition);
        } else {
            // No condition specified, check existence
            conditionResult = evaluateCondition(value, 'exists');
        }

        let output = conditionResult ? trueValue : (falseValue || '');
        // Recursively parse the output for nested variables
        return parseTemplate(output, data, maxDepth);
    }

    // Apply modifiers without conditional
    for (const mod of modifierParts) {
        // Parse modifier name and arguments
        const argMatch = mod.match(/^([a-zA-Z_]+)\((.+)\)$/);
        if (argMatch) {
            const args = parseModifierArgs(argMatch[2]);
            value = applySingleModifier(value, argMatch[1], args);
        } else {
            value = applySingleModifier(value, mod, []);
        }
        if (value === null) return '';
    }

    // Handle arrays
    if (Array.isArray(value)) {
        value = value.join(', ');
    }

    return value ?? '';
}

// ============================================
// PRESET TEMPLATES
// ============================================

const PRESET_TEMPLATES = {
    default: {
        name: `{service.shortName::exists["[{service.shortName}] "||""]}📺 {stream.title}`,
        description: `{stream.quality} | 💾 {stream.size::bytes} | 👤 {stream.seeders} seeders`
    },
    torrentio: {
        name: `{service.shortName::exists["[{service.shortName}"||""]}{service.cached::istrue["+]"||"]"]} ICV {stream.quality}`,
        description: `{stream.filename}
💾 {stream.size::bytes} {stream.packSize::>0["/ 📦 {stream.packSize::bytes}"||""]} 👤 {stream.seeders}
{stream.languageEmojis::join(' ')}`
    },
    minimal: {
        name: `{stream.quality} {stream.codec}`,
        description: `{stream.size::bytes} • {stream.seeders} seeds`
    },
    verbose: {
        name: `{service.cached::istrue["⚡"||"⏳"]} [{service.shortName}] {stream.quality} {stream.codec}`,
        description: `📁 {stream.filename}
💾 Ep: {stream.size::bytes}{stream.packSize::>0[" / Pack: {stream.packSize::bytes}"||""]}
👤 {stream.seeders} • 🎬 {stream.source} • 🔊 {stream.audio}
🌍 {stream.languages::join(' | ')}`
    },
    italiano: {
        name: `{service.cached::istrue["⚡"||"⏳"]} {service.shortName::exists["[{service.shortName}]"||""]} {stream.quality} {stream.codec}`,
        description: `📺 {stream.title}
📁 {stream.filename}
💾 {stream.size::bytes}{stream.isPack::istrue[" (Pack: {stream.packSize::bytes})"||""]}
🌍 {stream.languageEmojis::join(' ')} | 👤 {stream.seeders} | ⏰ {stream.age}
🎬 {stream.source} | 🔊 {stream.audio} | 🏷️ {stream.releaseGroup::exists["{stream.releaseGroup}"||"N/A"]}`
    },
    fra: {
        name: `{service.cached::istrue["⚡️"||"⏳"]} {addon.name} {stream.quality::=1080p["FHD"||""]}{stream.quality::=720p["HD"||""]}{stream.quality::=2160p["4K"||""]}{stream.quality::exists[""||"UNK"]}`,
        description: `📄 ❯ {stream.filename}
{stream.languages::exists["🌎 ❯ {stream.languages::join(' • ')}"||""]}
✨ ❯ {service.shortName::exists["{service.shortName}"||""]}{stream.releaseGroup::exists[" • {stream.releaseGroup}"||""]}{stream.indexer::exists[" • {stream.indexer}"||""]}
{stream.quality::exists["🔥 ❯ {stream.quality}"||""]}{stream.visualTags::exists[" • {stream.visualTags::join(' • ')}"||""]}
{stream.size::>0["💾 ❯ {stream.size::bytes}"||""]}{service.cached::isfalse[" / 👥 ❯ {stream.seeders}"||""]}
{stream.audioTags::exists["🔉 ❯ {stream.audioTags::join(' • ')}"||""]}`
    },
    dav: {
        name: `{stream.quality::=2160p["🔥4K UHD"||""]}{stream.quality::=1080p["🚀 FHD"||""]}{stream.quality::=720p["💿 HD"||""]}{stream.quality::exists[""||"💩 Unknown"]}`,
        description: `{stream.quality::exists["🎥 {stream.quality} "||""]}{stream.visualTags::exists["📺 {stream.visualTags::join(' | ')} "||""]}{stream.codec::exists["🎞️ {stream.codec} "||""]}
{stream.audioTags::exists["🎧 {stream.audioTags::join(' | ')} "||""]}{stream.languageEmojis::exists["🗣️ {stream.languageEmojis::join(' / ')}"||""]}
{stream.size::>0["📦 {stream.size::bytes} "||""]}{stream.packSize::>0["/ 📦 {stream.packSize::bytes} "||""]}{stream.seeders::>0["👥 {stream.seeders} "||""]}{stream.releaseGroup::exists["🏷️ {stream.releaseGroup} "||""]}
{service.cached::istrue["⚡"||"⏳"]}{service.shortName::exists["{service.shortName} "||""]}🔍{addon.name}
📄 {stream.folderName::exists["{stream.folderName}/"||""]}{stream.filename}`
    },
    and: {
        name: `{stream.title::exists["🎬 {stream.title}"||""]} S{stream.season}E{stream.episode}`,
        description: `{stream.quality} {service.cached::istrue["/⚡"||"/⏳"]}
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
{stream.languageEmojis::exists["Lingue: {stream.languageEmojis::join(' | ')}"||""]}
Specifiche: {stream.quality}{stream.visualTags::exists[" | 📺 {stream.visualTags::join(' ')}"||""]}{stream.audioTags::exists[" | 🔊 {stream.audioTags::join(', ')}"||""]}
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
📂 {stream.size::>0["{stream.size::bytes}"||""]}{service.name::exists[" | ☁️ {service.name}"||""]}{addon.name::exists[" | 🛰️ {addon.name}"||""]}`
    },
    lad: {
        name: `{stream.quality::=2160p["🖥️ 4K"||""]}{stream.quality::=1080p["🖥️ 1080p"||""]}{stream.quality::=720p["🖥️ 720p"||""]}{stream.quality::exists[""||"🖥️ Unknown"]}`,
        description: `{stream.title::exists["🎟️ {stream.title}"||""]}
📜 S{stream.season}E{stream.episode}
{stream.quality::exists["🎥 {stream.quality} "||""]}{stream.codec::exists["🎞️ {stream.codec} "||""]}{stream.audioTags::exists["🎧 {stream.audioTags::join(' | ')}"||""]}
{stream.size::>0["📦 {stream.size::bytes}"||""]}
🔗 {addon.name}
{stream.languageEmojis::exists["🌐 {stream.languageEmojis::join(' ')}"||""]}`
    },
    pri: {
        name: `{service.shortName::exists["[{service.shortName}"||""]}{service.cached::istrue["⚡️"||"❌️"]}{service.shortName::exists["☁️]"||""]}
{stream.quality::=2160p["4K🔥UHD"||""]}{stream.quality::=1080p["FHD🚀1080p"||""]}{stream.quality::=720p["HD💿720p"||""]}{stream.quality::=480p["SD📺"||""]}{stream.quality::exists[""||"Unknown💩"]}
[{addon.name}]`,
        description: `{stream.title::exists["🎬 {stream.title} "||""]}
{stream.quality::~Remux["💎 ʀᴇᴍᴜx "||""]}{stream.quality::~BluRay["📀 ʙʟᴜʀᴀʏ "||""]}{stream.quality::~WEB["🖥 ᴡᴇʙ "||""]}{stream.codec::exists["| 🎞️ {stream.codec} "||""]}{stream.visualTags::exists["| 🔆 {stream.visualTags::join(' | ')} "||""]}
{stream.audioTags::exists["🎧 {stream.audioTags::join(' | ')} "||""]}{stream.languageEmojis::exists["| 🗣️ {stream.languageEmojis::join(' / ')}"||""]}
{stream.size::>0["📁 {stream.size::bytes} "||""]}{stream.releaseGroup::exists["| 🏷️ {stream.releaseGroup} "||""]}{stream.duration::>0["| ⏱️ {stream.duration::time} "||""]}
📄 ▶️{stream.filename}◀️`
    }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
    parseTemplate,
    formatBytes,
    formatTime,
    evaluateCondition,
    evaluateConditionChain,
    PRESET_TEMPLATES
};
