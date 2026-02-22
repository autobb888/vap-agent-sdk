"use strict";
/**
 * Validation functions matching verus-agent-platform rules.
 * Each returns null on valid, error message string on invalid.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_TYPES = exports.VALID_PROTOCOLS = exports.RESERVED_NAMES = exports.AGENT_NAME_REGEX = void 0;
exports.validateAgentName = validateAgentName;
exports.validateAgentType = validateAgentType;
exports.validateDescription = validateDescription;
exports.validateTags = validateTags;
exports.validateUrl = validateUrl;
exports.validateProtocols = validateProtocols;
exports.validateEndpoint = validateEndpoint;
exports.validateCapability = validateCapability;
exports.validateSessionInput = validateSessionInput;
exports.AGENT_NAME_REGEX = /^[a-zA-Z0-9._-]+$/;
exports.RESERVED_NAMES = ['admin', 'system', 'platform', 'verus', 'test', 'root', 'api', 'www'];
exports.VALID_PROTOCOLS = ['MCP', 'REST', 'A2A', 'WebSocket'];
exports.VALID_TYPES = ['autonomous', 'assisted', 'tool'];
function validateAgentName(name) {
    if (!name)
        return 'Name is required';
    if (name.length < 3)
        return 'Name must be at least 3 characters';
    if (name.length > 64)
        return 'Name must be at most 64 characters';
    if (!exports.AGENT_NAME_REGEX.test(name))
        return 'Name can only contain letters, numbers, dots, hyphens, and underscores';
    if (exports.RESERVED_NAMES.includes(name.toLowerCase()))
        return `"${name}" is a reserved name`;
    return null;
}
function validateAgentType(type) {
    if (!type)
        return 'Type is required';
    if (!exports.VALID_TYPES.includes(type)) {
        return `Type must be one of: ${exports.VALID_TYPES.join(', ')}`;
    }
    return null;
}
function validateDescription(desc) {
    if (!desc)
        return 'Description is required';
    if (desc.length < 10)
        return 'Description must be at least 10 characters';
    if (desc.length > 1000)
        return 'Description must be at most 1000 characters';
    return null;
}
function validateTags(tags) {
    if (tags.length > 20)
        return 'Maximum 20 tags allowed';
    for (const tag of tags) {
        if (tag.length > 32)
            return `Tag "${tag}" exceeds 32 character limit`;
        if (tag.length === 0)
            return 'Empty tags are not allowed';
    }
    return null;
}
function validateUrl(url) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return 'URL must use http or https protocol';
        }
        return null;
    }
    catch {
        return 'Invalid URL format';
    }
}
function validateProtocols(protocols) {
    if (protocols.length > 10)
        return 'Maximum 10 protocols allowed';
    for (const p of protocols) {
        if (!exports.VALID_PROTOCOLS.includes(p)) {
            return `Invalid protocol "${p}". Valid: ${exports.VALID_PROTOCOLS.join(', ')}`;
        }
    }
    return null;
}
function validateEndpoint(ep) {
    if (!ep.url)
        return 'Endpoint URL is required';
    const urlErr = validateUrl(ep.url);
    if (urlErr)
        return `Endpoint URL: ${urlErr}`;
    if (!ep.protocol)
        return 'Endpoint protocol is required';
    return null;
}
function validateCapability(cap) {
    if (!cap.id)
        return 'Capability ID is required';
    if (!cap.name)
        return 'Capability name is required';
    return null;
}
function isFinitePositive(v) {
    return typeof v === 'number' && Number.isFinite(v) && v > 0;
}
function isFinitePositiveInt(v) {
    return isFinitePositive(v) && Number.isInteger(v);
}
function validateSessionInput(session) {
    if (session.duration != null && !isFinitePositive(session.duration)) {
        return 'Session duration must be a finite positive number (seconds)';
    }
    if (session.tokenLimit != null && !isFinitePositiveInt(session.tokenLimit)) {
        return 'Token limit must be a finite positive integer';
    }
    if (session.imageLimit != null && !isFinitePositiveInt(session.imageLimit)) {
        return 'Image limit must be a finite positive integer';
    }
    if (session.messageLimit != null && !isFinitePositiveInt(session.messageLimit)) {
        return 'Message limit must be a finite positive integer';
    }
    if (session.maxFileSize != null && !isFinitePositiveInt(session.maxFileSize)) {
        return 'Max file size must be a finite positive integer (bytes)';
    }
    if (session.allowedFileTypes != null) {
        if (!Array.isArray(session.allowedFileTypes)) {
            return 'Allowed file types must be an array of MIME type strings';
        }
        for (const ft of session.allowedFileTypes) {
            if (typeof ft !== 'string' || ft.trim().length === 0) {
                return 'Each allowed file type must be a non-empty string';
            }
        }
    }
    return null;
}
//# sourceMappingURL=validation.js.map