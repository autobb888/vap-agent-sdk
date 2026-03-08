"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VDXF_KEYS = void 0;
exports.getCanonicalVdxfDefinitionCount = getCanonicalVdxfDefinitionCount;
exports.encodeVdxfValue = encodeVdxfValue;
exports.decodeVdxfValue = decodeVdxfValue;
exports.buildAgentContentMultimap = buildAgentContentMultimap;
exports.buildCanonicalAgentUpdate = buildCanonicalAgentUpdate;
exports.verifyPublishedIdentity = verifyPublishedIdentity;
exports.buildUpdateIdentityPayload = buildUpdateIdentityPayload;
exports.buildUpdateIdentityCommand = buildUpdateIdentityCommand;
exports.VDXF_KEYS = {
    agent: {
        version: 'iBShCc1dESnTq25WkxzrKGjHvHwZFSoq6b',
        type: 'i9YN6ovGcotCnFdNyUtNh72Nw11WcBuD8y',
        name: 'i3oa8uNjgZjmC1RS8rg1od8czBP8bsh5A8',
        description: 'i9Ww2jR4sFt7nzdc5vRy5MHUCjTWULXCqH',
        status: 'iNCvffXEYWNBt1K5izxKFSFKBR5LPAAfxW',
        capabilities: 'i7Aumh6Akeq7SC8VJBzpmJrqKNCvREAWMA',
        endpoints: 'i9n5Vu8fjXLP5CxzcdpwHbSzaW22dJxvHc',
        protocols: 'iFQzXU4V6am1M9q6LGBfR4uyNAtjhJiW2d',
        owner: 'i5uUotnF2LzPci3mkz9QaozBtFjeFtAw45',
        services: 'iGVUNBQSNeGzdwjA4km5z6R9h7T2jao9Lz',
        tags: 'iJ3Vh2auC5VRbTKtjvKr9tWg515xAHKzN7',
        website: 'iMGHWAQgGM4VSDfsRTHwBipbwMemt9WdP8',
        avatar: 'iR5a34uDHJLquQgvffXWZ7pSU8spiFEgzh',
        category: 'iGzkSnpGYjTy3eG2FakUDQrXgFMGyCvTGi',
    },
    service: {
        name: 'iNTrSV1bqDAoaGRcpR51BeoS5wQvQ4P9Qj',
        description: 'i7ZUWAqwLu9b4E8oXZq4uX6X5W6BJnkuHz',
        price: 'iLjLxTk1bkEd7SAAWT27VQ7ECFuLtTnuKv',
        currency: 'iANfkUFM797eunQt4nFV3j7SvK8pUkfsJe',
        category: 'iGiUqVQcdLC3UAj8mHtSyWNsAKdEVXUFVC',
        turnaround: 'iNGq3xh28oV2U3VmMtQ3gjMX8jrH1ohKfp',
        status: 'iNbPugdyVSCv54zsZs68vAfvifcf14btX2',
    },
    review: {
        buyer: 'iPbx6NP7ZVLySKJU5Rfbt3saxNLaxHHV85',
        jobHash: 'iFgEMF3Fbj1EFU7bAPjmrvMKUU9QfZumNP',
        message: 'iKokqh2YmULa4HkSWRRJaywNMvGzRv7JTt',
        rating: 'iDznRwvMsTaMmQ6zkfQTJKWb5YCh8RHyp5',
        signature: 'iJZHVjWN22cLXx3MPWjpq7VeSBndjFtZB5',
        timestamp: 'iL13pKpKAQZ4hm2vECGQ5EmFBqRzEneJrq',
    },
    platform: {
        datapolicy: 'i6y4XPg5m9YeeP1Rk2iqJGiZwtWWK8pBoC',
        trustlevel: 'iDDiY2y6Juo9vUprbB69utX55pzcpkNKoW',
        disputeresolution: 'iJjCHbDoE6r4PqWe2i7SXGuPCn4Fw48Krw',
    },
    session: {
        duration: 'iEfV7FSNNorTcoukVXpUadneaCB44GJXRt',
        tokenLimit: 'iK7AVbtFj9hKxy7XaCyzc4iPo8jfpeENQG',
        imageLimit: 'i733ccahSD96tjGLvypVFozZ5i15xPSzZu',
        messageLimit: 'iLrDehY12RhJJ5XGi49QTfZsasY1L7RKWz',
        maxFileSize: 'i6iGYRcbtaPHyagDsv77Sja66HNFcA73Fw',
        allowedFileTypes: 'i4WmLAEe78myVEPKdWSfRBTEb5sRoWhwjR',
    },
};
function getCanonicalVdxfDefinitionCount() {
    return Object.values(exports.VDXF_KEYS).reduce((n, group) => n + Object.keys(group).length, 0);
}
function encodeVdxfValue(value) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('hex');
}
function decodeVdxfValue(hex) {
    try {
        return JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
    }
    catch {
        return Buffer.from(hex, 'hex').toString('utf8');
    }
}
function buildAgentContentMultimap(profile, services = []) {
    const contentmultimap = {};
    if (profile) {
        contentmultimap[exports.VDXF_KEYS.agent.version] = [encodeVdxfValue('1')];
        contentmultimap[exports.VDXF_KEYS.agent.type] = [encodeVdxfValue(profile.type)];
        contentmultimap[exports.VDXF_KEYS.agent.name] = [encodeVdxfValue(profile.name)];
        contentmultimap[exports.VDXF_KEYS.agent.description] = [encodeVdxfValue(profile.description)];
        contentmultimap[exports.VDXF_KEYS.agent.status] = [encodeVdxfValue('active')];
        if (profile.category) {
            contentmultimap[exports.VDXF_KEYS.agent.category] = [encodeVdxfValue(profile.category)];
        }
        if (profile.owner) {
            contentmultimap[exports.VDXF_KEYS.agent.owner] = [encodeVdxfValue(profile.owner)];
        }
        if (profile.tags?.length) {
            contentmultimap[exports.VDXF_KEYS.agent.tags] = [encodeVdxfValue(profile.tags)];
        }
        if (profile.website) {
            contentmultimap[exports.VDXF_KEYS.agent.website] = [encodeVdxfValue(profile.website)];
        }
        if (profile.avatar) {
            contentmultimap[exports.VDXF_KEYS.agent.avatar] = [encodeVdxfValue(profile.avatar)];
        }
        if (profile.protocols?.length) {
            contentmultimap[exports.VDXF_KEYS.agent.protocols] = [encodeVdxfValue(profile.protocols)];
        }
        if (profile.endpoints?.length) {
            contentmultimap[exports.VDXF_KEYS.agent.endpoints] = profile.endpoints.map(ep => encodeVdxfValue(ep));
        }
        if (profile.capabilities?.length) {
            contentmultimap[exports.VDXF_KEYS.agent.capabilities] = profile.capabilities.map(cap => encodeVdxfValue(cap));
        }
        if (profile.session) {
            if (profile.session.duration != null) {
                contentmultimap[exports.VDXF_KEYS.session.duration] = [encodeVdxfValue(profile.session.duration)];
            }
            if (profile.session.tokenLimit != null) {
                contentmultimap[exports.VDXF_KEYS.session.tokenLimit] = [encodeVdxfValue(profile.session.tokenLimit)];
            }
            if (profile.session.imageLimit != null) {
                contentmultimap[exports.VDXF_KEYS.session.imageLimit] = [encodeVdxfValue(profile.session.imageLimit)];
            }
            if (profile.session.messageLimit != null) {
                contentmultimap[exports.VDXF_KEYS.session.messageLimit] = [encodeVdxfValue(profile.session.messageLimit)];
            }
            if (profile.session.maxFileSize != null) {
                contentmultimap[exports.VDXF_KEYS.session.maxFileSize] = [encodeVdxfValue(profile.session.maxFileSize)];
            }
            if (profile.session.allowedFileTypes?.length) {
                contentmultimap[exports.VDXF_KEYS.session.allowedFileTypes] = [encodeVdxfValue(profile.session.allowedFileTypes)];
            }
        }
        // Platform-level keys
        if (profile.datapolicy) {
            contentmultimap[exports.VDXF_KEYS.platform.datapolicy] = [encodeVdxfValue(profile.datapolicy)];
        }
        if (profile.trustlevel) {
            contentmultimap[exports.VDXF_KEYS.platform.trustlevel] = [encodeVdxfValue(profile.trustlevel)];
        }
        if (profile.disputeresolution) {
            contentmultimap[exports.VDXF_KEYS.platform.disputeresolution] = [encodeVdxfValue(profile.disputeresolution)];
        }
    }
    if (services.length > 0) {
        contentmultimap[exports.VDXF_KEYS.agent.services] = services.map((svc) => encodeVdxfValue({
            name: svc.name,
            description: svc.description,
            category: svc.category,
            price: svc.price,
            currency: svc.currency,
            turnaround: svc.turnaround,
            status: 'active',
        }));
    }
    return contentmultimap;
}
function buildCanonicalAgentUpdate(params) {
    const { fullName, parent, primaryaddresses, minimumsignatures = 1, vdxfKeys, fields = {}, } = params;
    const clean = (fullName || '').replace(/@$/, '');
    const inferredName = clean ? clean.split('.')[0] : '';
    const inferredParent = clean.includes('.') ? clean.split('.').slice(1).join('.') : parent;
    if (!inferredName)
        throw new Error('Missing subID name');
    if (!inferredParent)
        throw new Error('Missing parent');
    if (!Array.isArray(primaryaddresses) || primaryaddresses.length === 0) {
        throw new Error('primaryaddresses required');
    }
    const contentmultimap = {};
    for (const [field, value] of Object.entries(fields)) {
        if (value == null)
            continue;
        if (typeof value === 'string' && value.trim() === '')
            continue;
        if (Array.isArray(value) && value.length === 0)
            continue;
        const key = vdxfKeys[field];
        if (!key)
            continue;
        if (field === 'services' && Array.isArray(value)) {
            const encoded = value
                .filter((svc) => svc && typeof svc === 'object' && Object.keys(svc).length > 0)
                .map((svc) => encodeVdxfValue(svc));
            if (encoded.length > 0) {
                contentmultimap[key] = encoded;
            }
        }
        else {
            contentmultimap[key] = [encodeVdxfValue(value)];
        }
    }
    return {
        name: inferredName,
        parent: inferredParent,
        primaryaddresses,
        minimumsignatures,
        contentmultimap,
    };
}
function verifyPublishedIdentity(params) {
    const { identity, expectedPayload } = params;
    const errors = [];
    if (identity.name !== expectedPayload.name)
        errors.push('name mismatch');
    if (identity.parent !== expectedPayload.parent)
        errors.push('parent mismatch');
    const expectedCmm = (expectedPayload.contentmultimap || {});
    const onchain = identity.contentmultimap || {};
    for (const [key, value] of Object.entries(expectedCmm)) {
        if (!onchain[key] || onchain[key].length === 0) {
            errors.push(`missing key ${key}`);
            continue;
        }
        if (!Array.isArray(value) || value.length === 0)
            continue;
        if (onchain[key].length !== value.length) {
            errors.push(`array length mismatch on ${key}: expected ${value.length}, got ${onchain[key].length}`);
            continue;
        }
        for (let i = 0; i < value.length; i++) {
            if (onchain[key][i] !== value[i]) {
                const e = decodeVdxfValue(value[i]);
                const a = decodeVdxfValue(onchain[key][i]);
                if (JSON.stringify(e) !== JSON.stringify(a)) {
                    errors.push(`value mismatch on ${key}[${i}]`);
                }
            }
        }
    }
    return { ok: errors.length === 0, errors };
}
function buildUpdateIdentityPayload(identityName, contentmultimap) {
    const clean = identityName.replace(/@$/, '');
    const parts = clean.split('.');
    const name = parts[0] || clean;
    const parent = parts.length > 1 ? parts.slice(1).join('.') : 'agentplatform';
    return {
        name,
        parent,
        contentmultimap,
    };
}
function buildUpdateIdentityCommand(payload, chain = 'verustest') {
    const args = ['verus'];
    // Only pass -chain for testnet; mainnet is the default and doesn't need a chain argument
    if (chain === 'verustest')
        args.push('-chain=vrsctest');
    args.push('updateidentity', JSON.stringify(payload));
    return args;
}
//# sourceMappingURL=vdxf.js.map