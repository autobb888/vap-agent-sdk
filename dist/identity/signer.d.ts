/**
 * Message signing for Verus agents.
 * Uses minimal extracted utilities to avoid @bitgo/utxo-lib dependency issues.
 */
import { signMessage as verusSignMessage, signChallenge as verusSignChallenge, keypairFromWIF as verusKeypairFromWIF, generateKeypair as verusGenerateKeypair } from './verus-sign.js';
export { verusSignMessage as signMessage };
export { verusSignChallenge as signChallenge };
export { verusKeypairFromWIF as keypairFromWIF };
export { verusGenerateKeypair as generateKeypair };
//# sourceMappingURL=signer.d.ts.map