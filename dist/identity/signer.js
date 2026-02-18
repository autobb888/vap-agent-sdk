"use strict";
/**
 * Message signing for Verus agents.
 * Uses minimal extracted utilities to avoid @bitgo/utxo-lib dependency issues.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKeypair = exports.keypairFromWIF = exports.signChallenge = exports.signMessage = void 0;
const verus_sign_js_1 = require("./verus-sign.js");
Object.defineProperty(exports, "signMessage", { enumerable: true, get: function () { return verus_sign_js_1.signMessage; } });
Object.defineProperty(exports, "signChallenge", { enumerable: true, get: function () { return verus_sign_js_1.signChallenge; } });
Object.defineProperty(exports, "keypairFromWIF", { enumerable: true, get: function () { return verus_sign_js_1.keypairFromWIF; } });
Object.defineProperty(exports, "generateKeypair", { enumerable: true, get: function () { return verus_sign_js_1.generateKeypair; } });
//# sourceMappingURL=signer.js.map