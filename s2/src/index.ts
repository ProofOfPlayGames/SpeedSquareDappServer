import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import {Keypair, Transaction, Connection, PublicKey} from '@solana/web3.js';
import * as bs58 from 'bs58';
import {getAssociatedTokenAddress, getAccount, createMintToCheckedInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { Client } from 'pg';
import * as fs from 'fs';
import * as https from "https";
import * as crypto from "crypto";

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
const tokenProgramId = TOKEN_PROGRAM_ID; 
const mintAddr = new PublicKey(process.env.MINT_TOKEN_ADDR || "");

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID: PublicKey = new PublicKey(
  process.env.SPL_ATAP_ID || "",
);


const publicKey = fs.readFileSync(process.env.PUBLIC_KEY!,{ encoding: 'utf8', flag: 'r' }).toString();
const privateKey = fs.readFileSync(process.env.PRIVATE_KEY!,{ encoding: 'utf8', flag: 'r' }).toString();


// Mint new token
async function mintToken(walletAddr: string, amount: number) {
  try {
  const walletAddr_pubKeyObj = new PublicKey(walletAddr);
  
  let ata = await getAssociatedTokenAddress(
      mintAddr, // mint
      walletAddr_pubKeyObj, // owner
      false // allow owner off curve
    ); 
  
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
      ata,
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

function encryptData (data: string): Buffer {
    return crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      // We convert the data string to a buffer using `Buffer.from`
      Buffer.from(data)
    )
};

function decryptData (encryptedData: string): Buffer {
    return crypto.privateDecrypt(
      {
        key: privateKey,
        // In order to decrypt the data, we need to specify the
        // same hashing function and padding scheme that we used to
        // encrypt the data in the previous step
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encryptedData, "hex")
    )
};

function toHexString(bytes: Buffer): string {
  return Array.from(bytes, (byte) => {
    return ('0' + (byte & 0xff).toString(16)).slice(-2);
  }).join('');
};

app.use(express.json());


app.post('/encrypt', async (req: Request, res: Response) => {
  try {
    return res.send({ message: toHexString(encryptData(req.body.amount))});
  } catch (error) {
      return res.status(500).json({ error: 'Error encrypting.' });
  }
});

app.post('/decrypt', async (req: Request, res: Response) => {
  //try {
    console.log(req.body.amount);
    const dec = decryptData(req.body.amount).toString();
    console.log(dec);
    return res.send({ message: dec});
  //} catch (error) {
    //  return res.status(500).json({ error: 'Error decrypting.' });
 // }
});

app.post('/score', async (req: Request, res: Response) => {
  try {
    const amount = req.body.amount;
    const walletAddr = req.body.walletAddr;
    console.log(req.body);
    let sql = "";
    sql = sql + "INSERT INTO users (pub_key) SELECT ('" + walletAddr + "') WHERE NOT EXISTS (SELECT pub_key FROM users WHERE pub_key='" + walletAddr + "');";
    sql = sql + "UPDATE users SET high_score=" + amount + " WHERE pub_key='" + walletAddr + "' AND high_score<" + amount + ";";
    sql = sql + "UPDATE users SET total_score=total_score+" + amount + ", unclaimed_tokens=unclaimed_tokens+" + amount + " WHERE pub_key='" + walletAddr + "';";
    sql = sql + "UPDATE users SET games_played=games_played+1 WHERE pub_key='" + walletAddr + "';";
    const res2 = await client.query(sql);
    return res.send({ message: 'Scores updated successfully.'});
  } catch (error) {
      return res.status(500).json({ error: 'Error updating scores.' });
  }
});

app.post('/claim', async (req: Request, res: Response) => {
  try {
      const walletAddr = req.body.walletAddr;
      const res2 = await client.query("SELECT unclaimed_tokens, claimed_today FROM users WHERE pub_key='" + walletAddr + "';");
      const unclaimed_tokens = res2.rows[0].unclaimed_tokens;
      const claimed_today = res2.rows[0].claimed_today;
      if (!claimed_today){
        const res3 = await client.query("UPDATE users SET unclaimed_tokens=0, claimed_today=true WHERE pub_key='" + walletAddr + "';");
        const mintingResponse = await mintToken(walletAddr, unclaimed_tokens);
        return res.json({ message: 'Tokens minted successfully.', transaction: mintingResponse });
      } else {
	return res.status(500).json({ error: 'Claimed today already. No tokens minted.' });
      }
  } catch (error) {
      return res.status(500).json({ error: 'Error claiming tokens.' });
  }
});

app.get('/player_stats', async (req: Request, res: Response) => {
  try {
    const walletAddr = req.query.walletAddr;
    const res2 = await client.query("SELECT games_played, high_score, total_score FROM users WHERE pub_key='" + walletAddr + "';");
    const games_played = res2.rows[0].games_played;
    const high_score = res2.rows[0].high_score;
    const total_score = res2.rows[0].total_score;
    console.log({ games_played: games_played, high_score: high_score, total_score: total_score});
    return res.send({ games_played: games_played, high_score: high_score, total_score: total_score});
  } catch (error) {
      return res.status(500).json({ error: 'Error getting player stats.' });
  }
});

app.get('/claim_status', async (req: Request, res: Response) => {
  try {
    const walletAddr = req.query.walletAddr;
    const res2 = await client.query("SELECT claimed_today, unclaimed_tokens FROM users WHERE pub_key='" + walletAddr + "';");
    const claimed_today = res2.rows[0].claimed_today;
    const unclaimed_tokens = res2.rows[0].unclaimed_tokens;
    return res.send({ claimed_today: claimed_today, unclaimed_tokens: unclaimed_tokens});
  } catch (error) {
      return res.status(500).json({ error: 'Error getting claim status.' });
  }
});



app.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const res2 = await client.query("SELECT username, high_score FROM users;");
    return res.send(res2.rows);
  } catch (error) {
      return res.status(500).json({ error: 'Error getting claim status.' });
  }
});


app.post('/login', async (req: Request, res: Response) => {
  try {
    const username = req.body.username;
    const password = req.body.password;
    const login_token = makeid(72);
    const res3 = await client.query("SELECT username, password FROM users WHERE username='" + username + "' AND password='" + password + "';");
    if(res3.rows && res3.rows.length > 0){
      const res2 = await client.query("UPDATE users SET login_token='" + login_token + "' where username='" + username + "';");
      return res.send({login_token: login_token});
    }else{
      return res.status(501).json({ error: 'Wrong login info moron' });
    }
  } catch (error) {
      return res.status(500).json({ error: 'Error logging in.' });
  }
});


function makeid(length: number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}


https
  .createServer(
    {
      key: fs.readFileSync("server.key"),
      cert: fs.readFileSync("server.cert"),
    },
    app
  ).listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
