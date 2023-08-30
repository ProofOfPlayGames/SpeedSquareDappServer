import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import {Keypair, Transaction, Connection, PublicKey} from '@solana/web3.js';
import * as bs58 from 'bs58';
import {createMintToCheckedInstruction, createAssociatedTokenAccount} from "@solana/spl-token";

dotenv.config();

const app: Express = express();
const port = process.env.PORT;

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const walletKeyPair = Keypair.fromSecretKey(
 bs58.decode(process.env.WALLET_SPK)
); 

// Token program ID (for Solana Devnet)
const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Mint new token
async function mintToken(tokenId: string, amount: number) {
  try {
    console.log(tokenId);
    const mint = new PublicKey(tokenId);
    const recipientPublicKey = Keypair.generate().publicKey;


console.log("meh");
console.log(mint);
console.log(walletKeyPair.publicKey);
  let tx = new Transaction();
console.log("ttt");  

   /* createAssociatedTokenAccount(
        connection,
        walletKeyPair,
        mint,
        walletKeyPair.publicKey
    );*/

tx.add(
    createMintToCheckedInstruction(
      mint,
      new PublicKey("CiL2siMDs6t2LVd5LdTuFJVbgePeas7KGgEYfPXXJTJ6"), //tokenAccount1Pubkey,
      walletKeyPair.publicKey, // mint auth
      amount*1000000000, // amount
      9 // decimals
    )
  );
  console.log(`txhash: ${await connection.sendTransaction(tx, [walletKeyPair, walletKeyPair])}`);

  } catch (error) {
    console.error('Error minting token:', error);
    throw error;
    //return res.status(500).json({ error: 'Error minting token.' });
  }
}

app.use(express.json());

app.post('/mint', async (req: Request, res: Response) => {
  const tokenId = req.body.tokenId;
  const amount = req.body.amount;
  console.log(req.body);
  if (!tokenId) {
    return res.status(400).json({ error: 'Token ID is required.' });
  }

  try {
    const mintingResponse = await mintToken(tokenId, amount);
    return res.json({ message: 'Token minted successfully.', transaction: mintingResponse });
  } catch (error) {
    return res.status(500).json({ error: 'Error minting token.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
