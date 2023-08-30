const express = require('express');
const solanaWeb3 = require('@solana/web3.js');
const bs58 = require('bs58');
const dotenv = require('dotenv');
const fs = require("fs");
const spl = require("@solana/spl-token");

dotenv.config();

const app = express();
const port = 3000;

// Solana network connection
const connection = new solanaWeb3.Connection('https://api.devnet.solana.com', 'confirmed');
const walletPrivateKey = new solanaWeb3.Keypair.fromSecretKey(
 bs58.decode("TOKEN_PRIVATE_KEY_REPLACEEEEEE")
); //process.env.WALLET_PRIVATE_KEY); //getKey(process.env.WALLET_PRIVATE_KEY);


async function getKey(file){
  var s = [];
  await fs.readFile(file, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(data);
    s = data;
  });
  console.log(s);
  return s;
}

// Decoded wallet private key
const walletKeyPair = walletPrivateKey; //solanaWeb3.Keypair.fromSecretKey(bs58.decode(walletPrivateKey));

// Token program ID (for Solana Devnet)
const tokenProgramId = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Mint new token
async function mintToken(tokenId, amount) {
  try {
    console.log(tokenId);
    const mint = new solanaWeb3.PublicKey(tokenId);
   // const token = new solanaWeb3.Token(connection, mint, tokenProgramId, walletKeyPair);

    const recipientPublicKey = solanaWeb3.Keypair.generate().publicKey;


console.log("meh");
console.log(mint);
console.log(walletKeyPair.publicKey);
  let tx = new solanaWeb3.Transaction();
console.log("ttt");  
tx.add(
    new spl.createAssociatedTokenAccount(
        connection,
	walletKeyPair.publicKey,
	mint,
	walletKeyPair.publicKey
    )
);
tx.add(
    new spl.createMintToCheckedInstruction(
      mint,
      new solanaWeb3.PublicKey("CiL2siMDs6t2LVd5LdTuFJVbgePeas7KGgEYfPXXJTJ6"), //tokenAccount1Pubkey,
      walletKeyPair.publicKey, // mint auth
      amount*1000000000, // amount
      9 // decimals
    )
  );
  console.log(`txhash: ${await connection.sendTransaction(tx, [walletKeyPair, walletKeyPair])}`);






	  /*    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: walletKeyPair.publicKey,
        toPubkey: recipientPublicKey,
        lamports: amount
      })
    );

    transaction.feePayer = walletKeyPair.publicKey;

  console.log(transaction);
    const signature = await solanaWeb3.sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeyPair]
    );
    console.log("jjj");
    console.log('Token minting transaction signature:', signature);
    return res.json({ message: 'Token minted successfully.', transactionSignature: signature });
  */ 

  } catch (error) {
    console.error('Error minting token:', error);
    return res.status(500).json({ error: 'Error minting token.' });
  }



/*    const mintingResponse = await token.mintTo(
      recipientPublicKey,
      walletKeyPair,
      [],
      amount
    );

    console.log('Token minting transaction:', mintingResponse);
    return mintingResponse;
  } catch (error) {
    console.error('Error minting token:', error);
    throw error;
  }*/
}

app.use(express.json());

app.post('/mint', async (req, res) => {
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

