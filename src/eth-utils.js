import { firmwareAPI, HARDENED } from './bitbox02';

const getCoinFromChainId = chainId => {
    switch(chainId) {
        case 1:
            return firmwareAPI.messages.ETHCoin.ETH;
        case 3:
            return firmwareAPI.messages.ETHCoin.RopstenETH;
        case 4:
            return firmwareAPI.messages.ETHCoin.RinkebyETH;
        default:
            throw new Error('Unsupported network');
    }
}

/**
 * @param keypathString keypath in string format e.g. m/44'/1'/0'/0
 * @returns keypath as array e.g. [2147483692, 2147483649, 2147483648, 0]
 */
export const getKeypathFromString = keypathString => {
    let levels = keypathString.toLowerCase().split('/');
    if (levels[0] !== 'm') throw new Error('Invalid keypath');
    levels = levels.slice(1);

    return levels.map(level => {
        let hardened = false;
        if (level.substring(level.length - 1) === "'") {
            hardened = true
        }
        level = parseInt(level);
        if (isNaN(level) || level < 0 || level >= HARDENED) {
            throw new Error('Invalid keypath');
        }
        if (hardened) level += HARDENED;
        return level;
    })
}

/**
 * @param keypathArray keypath as an array of ints e.g. [2147483692, 2147483649, 2147483648, 0]
 * FIXME: This is a slight hack until the device is provided with the network by the integrating service
 * The only noticeable consequence is that when using the Rinkeby testnet, the user would see 'Ropsten' on device
 * @returns ETHCoin.ETH for mainnet ([44, 60]) and ETHCoin.RopstenETH for testnets ([44, 1])
 */
export const getCoinFromKeypath = keypathArray => {
    if (keypathArray[0] !== 44 + HARDENED) {
        throw new Error('Invalid keypath');
    }
    switch(keypathArray[1]) {
        case 60 + HARDENED:
            return firmwareAPI.messages.ETHCoin.ETH;
        case 1 + HARDENED:
            return firmwareAPI.messages.ETHCoin.RopstenETH;
        default:
            throw new Error('Invalid keypath');
    }
}

/**
 * Sanitizes signature data provided by the 'ethereumjs' library's Transaction type
 * https://github.com/ethereumjs/ethereumjs-tx/blob/master/src/transaction.ts
 * and returns them in the format needed by BB02's AsyncETHSign
 *
 * @param sigData should include the following:
 *
 * ```
 * const signatureData = {
 *     account: id,      // id: number, account number in the ETH keypath m/44'/60'/0'/0/<id>
 *     recipient: tx.to, // Buffer(Uint8Array(20))
 *     tx: {
 *       value           // hex
 *       data            // hex
 *       chainId         // number
 *       nonce           // hex
 *       gasLimit        // hex
 *       gasPrice        // hex
 *      },
 *     data: tx.data // Buffer(Uint8Array)
 *   }
 * ```
 */
export const sanitizeEthTransactionData = sigData => {
    try {
        let sanitizedData = {};
        sanitizedData.nonce = 0;
        sanitizedData.value = '0';
        sanitizedData.coin = getCoinFromChainId(sigData.tx.chainId);
        sanitizedData.keypath = getKeypathFromString(sigData.keypath);
        if (sigData.tx.nonce) {
            sanitizedData.nonce = parseInt(sigData.tx.nonce, 16)
        }
        sanitizedData.gasPrice = parseInt(sigData.tx.gasPrice, 16).toString();
        sanitizedData.gasLimit = parseInt(sigData.tx.gasLimit, 16);
        sanitizedData.recipient = new Buffer(sigData.recipient);
        if (sigData.tx.value) {
            sanitizedData.value = parseInt(sigData.tx.value, 16).toString();
        }
        sanitizedData.data = new Buffer(sigData.data);
        sanitizedData.chainId = sigData.tx.chainId;
        return sanitizedData;
    } catch (e) {
        throw new Error('ethTx data sanitization failed: ', e);
    }
}
