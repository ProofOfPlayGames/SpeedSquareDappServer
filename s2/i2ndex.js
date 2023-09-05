"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const web3_js_1 = require("@solana/web3.js");
const bs58 = __importStar(require("bs58"));
const spl_token_1 = require("@solana/spl-token");
const pg_1 = require("pg");
const client = new pg_1.Client();
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT;
const wallet = process.env.WALLET_SPK;
const connection = new web3_js_1.Connection('https://api.devnet.solana.com', 'confirmed');
const walletKeyPair = web3_js_1.Keypair.fromSecretKey(bs58.decode(wallet));
// Token program ID (for Solana Devnet)
const tokenProgramId = new web3_js_1.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
// Mint new token
function mintToken(tokenId, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(tokenId);
            const mint = new web3_js_1.PublicKey(tokenId);
            const recipientPublicKey = web3_js_1.Keypair.generate().publicKey;
            console.log("meh");
            console.log(mint);
            console.log(walletKeyPair.publicKey);
            let tx = new web3_js_1.Transaction();
            console.log("ttt");
            /* createAssociatedTokenAccount(
                 connection,
                 walletKeyPair,
                 mint,
                 walletKeyPair.publicKey
             );*/
            tx.add((0, spl_token_1.createMintToCheckedInstruction)(mint, new web3_js_1.PublicKey("CiL2siMDs6t2LVd5LdTuFJVbgePeas7KGgEYfPXXJTJ6"), //tokenAccount1Pubkey,
            walletKeyPair.publicKey, // mint auth
            amount * 1000000000, // amount
            9 // decimals
            ));
            console.log(`txhash: ${yield connection.sendTransaction(tx, [walletKeyPair, walletKeyPair])}`);
        }
        catch (error) {
            console.error('Error minting token:', error);
            throw error;
            //return res.status(500).json({ error: 'Error minting token.' });
        }
    });
}
app.use(express_1.default.json());
app.post('/score', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield client.connect();
    const res2 = yield client.query('SELECT * FROM users');
    console.log(res2);
    yield client.end();
    const tokenId = req.body.tokenId;
    const amount = req.body.amount;
    console.log(req.body);
    if (!tokenId) {
        return res.status(400).json({ error: 'Token ID is required.' });
    }
    try {
        const mintingResponse = yield mintToken(tokenId, amount);
        return res.json({ message: 'Token minted successfully.', transaction: mintingResponse });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error minting token.' });
    }
}));
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
