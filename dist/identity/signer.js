"use strict";
/**
 * Message signing for Verus agents.
 * Uses minimal extracted utilities to avoid @bitgo/utxo-lib dependency issues.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.signChallenge = exports.signMessage = void 0;
const verus_sign_js_1 = require("./verus-sign.js");
Object.defineProperty(exports, "signMessage", { enumerable: true, get: function () { return verus_sign_js_1.signMessage; } });
Object.defineProperty(exports, "signChallenge", { enumerable: true, get: function () { return verus_sign_js_1.signChallenge; } });
//# sourceMappingURL=signer.js.map