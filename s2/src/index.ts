import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import {Keypair, Transaction, Connection, PublicKey} from '@solana/web3.js';
import * as bs58 from 'bs58';
import {getAssociatedTokenAddress, getAccount, createMintToCheckedInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { Client } from 'pg';





dotenv.config();

const app: Express = express();
const port = process.env.PORT;
const connection = new Connection(process.env.SOL_NETWORK || "", 'confirmed');
const walletKeyPair = Keypair.fromSecretKey(
 bs58.decode(process.env.WALLET_SPK as string)
); 

const client = new Client(
        {host: process.env.PG_HOST,
        port: 5432,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
        ssl: false}
);
client.connect();

// Token program ID (for Solana Devnet)
const tokenProgramId = TOKEN_PROGRAM_ID; //new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const mintAddr = new PublicKey(process.env.MINT_TOKEN_ADDR || "");


const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID: PublicKey = new PublicKey(
  process.env.SPL_ATAP_ID || "",
);

/*function findAssociatedTokenAddress(walletAddress: PublicKey, tokenMintAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [
            walletAddress.toBuffer(), // wallet address
            TOKEN_PROGRAM_ID.toBuffer(),
            tokenMintAddress.toBuffer(),
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )[0];
}*/



// Mint new token
async function mintToken(walletAddr: string, amount: number) {
  try {
  const walletAddr_pubKeyObj = new PublicKey(walletAddr);
 // const walletATA = findAssociatedTokenAddress(new PublicKey(walletAddr), mintAddr);
  
 console.log("1------"); 
  let ata = await getAssociatedTokenAddress(
      mintAddr, // mint
      walletAddr_pubKeyObj, // owner
      true // allow owner off curve
    ); 
console.log("2---------");
  
  let tx = new Transaction();
let checkAccountExists = false;
try{
await getAccount(connection, ata).then((obj) => {
  console.log(obj);
  checkAccountExists = obj.isInitialized;
});
console.log(checkAccountExists);
}catch (error) {
    console.error('ATA does not exist:', error);
  }
if(!checkAccountExists){
  tx.add(
    createAssociatedTokenAccountInstruction(
      //connection,
      //walletKeyPair,
      walletKeyPair.publicKey,
      ata,
      walletAddr_pubKeyObj,
      mintAddr
    )
  );
}

tx.add(
    createMintToCheckedInstruction(
      mintAddr,
      ata, //new PublicKey("CiL2siMDs6t2LVd5LdTuFJVbgePeas7KGgEYfPXXJTJ6"), //tokenAccount1Pubkey,
      walletKeyPair.publicKey, // mint auth
      amount*1000000000, // amount
      9 // decimals
    )
  );
  console.log(`txhash: ${await connection.sendTransaction(tx, [walletKeyPair, walletKeyPair])}`);

  } catch (error) {
    console.error('Error minting token:', error);
    throw error;
  }
}

app.use(express.json());

app.post('/score', async (req: Request, res: Response) => {

  const amount = req.body.amount;
  const walletAddr = req.body.walletAddr;
  const res2 = await client.query('SELECT * FROM users');
  console.log(res2);
  try {
    const mintingResponse = await mintToken(walletAddr, amount);
    return res.json({ message: 'Token minted successfully.', transaction: mintingResponse });
  } catch (error) {
    return res.status(500).json({ error: 'Error minting token.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
