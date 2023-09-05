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
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT;
const connection = new web3_js_1.Connection(process.env.SOL_NETWORK || "", 'confirmed');
const walletKeyPair = web3_js_1.Keypair.fromSecretKey(bs58.decode(process.env.WALLET_SPK));
const client = new pg_1.Client({ host: process.env.PG_HOST,
    port: 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    ssl: false });
client.connect();
// Token program ID (for Solana Devnet)
const tokenProgramId = spl_token_1.TOKEN_PROGRAM_ID; //new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const mintAddr = new web3_js_1.PublicKey(process.env.MINT_TOKEN_ADDR || "");
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new web3_js_1.PublicKey(process.env.SPL_ATAP_ID || "");
// Mint new token
function mintToken(walletAddr, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const walletAddr_pubKeyObj = new web3_js_1.PublicKey(walletAddr);
            let ata = yield (0, spl_token_1.getAssociatedTokenAddress)(mintAddr, // mint
            walletAddr_pubKeyObj, // owner
            false // allow owner off curve
            );
            let tx = new web3_js_1.Transaction();
            let checkAccountExists = false;
            try {
                yield (0, spl_token_1.getAccount)(connection, ata).then((obj) => {
                    console.log(obj);
                    checkAccountExists = obj.isInitialized;
                });
                console.log(checkAccountExists);
            }
            catch (error) {
                console.error('ATA does not exist:', error);
            }
            if (!checkAccountExists) {
                tx.add((0, spl_token_1.createAssociatedTokenAccountInstruction)(walletKeyPair.publicKey, ata, walletAddr_pubKeyObj, mintAddr));
            }
            tx.add((0, spl_token_1.createMintToCheckedInstruction)(mintAddr, ata, walletKeyPair.publicKey, // mint auth
            amount * 1000000000, // amount
            9 // decimals
            ));
            console.log(`txhash: ${yield connection.sendTransaction(tx, [walletKeyPair, walletKeyPair])}`);
        }
        catch (error) {
            console.error('Error minting token:', error);
            throw error;
        }
    });
}
app.use(express_1.default.json());
app.post('/score', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const amount = req.body.amount;
    const walletAddr = req.body.walletAddr;
    const res2 = yield client.query('SELECT * FROM users');
    console.log(res2);
    try {
        const mintingResponse = yield mintToken(walletAddr, amount);
        return res.json({ message: 'Token minted successfully.', transaction: mintingResponse });
    }
    catch (error) {
        return res.status(500).json({ error: 'Error minting token.' });
    }
}));
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
