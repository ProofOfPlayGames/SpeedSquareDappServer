import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import {Keypair, Transaction, Connection, PublicKey} from '@solana/web3.js';
import * as bs58 from 'bs58';
import {getAssociatedTokenAddress, getAccount, createMintToCheckedInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { Client } from 'pg';
import * as fs from 'fs';
import * as https from "https";
import * as crypto from "crypto";
import * as encrypt from "./encrypt";

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
//  console.log(obj);
  checkAccountExists = obj.isInitialized;
});
//console.log(checkAccountExists);
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


app.use(express.json());

/*
app.post('/encrypt', async (req: Request, res: Response) => {
  try {
    return res.send({ message: encrypt.toHexString(encrypt.encryptDataRSA(req.body.amount))});
  } catch (error) {
      return res.status(500).json({ error: 'Error encrypting.' });
  }
});

app.post('/decrypt', async (req: Request, res: Response) => {
  //try {
    console.log(req.body.amount);
    const dec = encrypt.decryptDataRSA(req.body.amount).toString();
    console.log(dec);
    return res.send({ message: dec});
  //} catch (error) {
    //  return res.status(500).json({ error: 'Error decrypting.' });
 // }
});*/

app.post('/score', async (req: Request, res: Response) => {
  try {
    let username = req.body.username;
    let pub_key = req.body.pub_key;
    let sql3 = "";
    if (!username) {
	sql3 = "SELECT login_token, username from users WHERE pub_key='" + pub_key + "';";
    } else {
	sql3 = "SELECT login_token from users WHERE username='" + username + "';";
    }
    const res3 = await client.query(sql3);
    const loginT = res3.rows[0].login_token;
    if (res3.rows[0].username) {
	username = res3.rows[0].username;
    }
    const json = JSON.parse(encrypt.decryptGeneral(loginT, req.body.msg));
   const score = json["score"];

    let sql = "";
    //sql = sql + "INSERT INTO users (pub_key) SELECT ('" + walletAddr + "') WHERE NOT EXISTS (SELECT pub_key FROM users WHERE pub_key='" + walletAddr + "');";
    sql = sql + "UPDATE speed_square SET high_score=" + score + " WHERE username='" + username + "' AND high_score<" + score + ";";
    sql = sql + "UPDATE speed_square SET today_high_score=" + score + " WHERE username='" + username + "' AND today_high_score<" + score + ";";
    sql = sql + "UPDATE speed_square SET total_score=total_score+" + score + " WHERE username='" + username + "';";
    sql = sql + "UPDATE speed_square SET today_score=today_score+" + score + " WHERE username='" + username + "';";
    sql = sql + "UPDATE speed_square SET total_games=total_games+1 WHERE username='" + username + "';";
    sql = sql + "UPDATE speed_square SET today_games=today_games+1 WHERE username='" + username + "';";
    const res2 = await client.query(sql);
    return res.send({ message: 'Scores updated successfully.'});
  } catch (error) {
      return res.status(500).json({ error: 'Error updating scores.' });
  }
});

/*app.post('/claim', async (req: Request, res: Response) => {
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
});*/

app.get('/player_stats', async (req: Request, res: Response) => {
  try {
    const walletAddr = req.query.walletAddr;
    const res2 = await client.query("SELECT games_played, high_score, total_score FROM users WHERE pub_key='" + walletAddr + "';");
    const games_played = res2.rows[0].games_played;
    const high_score = res2.rows[0].high_score;
    const total_score = res2.rows[0].total_score;
    return res.send({ games_played: games_played, high_score: high_score, total_score: total_score});
  } catch (error) {
      return res.status(500).json({ error: 'Error getting player stats.' });
  }
});

/*app.get('/claim_status', async (req: Request, res: Response) => {
  try {
    const walletAddr = req.query.walletAddr;
    const res2 = await client.query("SELECT claimed_today, unclaimed_tokens FROM users WHERE pub_key='" + walletAddr + "';");
    const claimed_today = res2.rows[0].claimed_today;
    const unclaimed_tokens = res2.rows[0].unclaimed_tokens;
    return res.send({ claimed_today: claimed_today, unclaimed_tokens: unclaimed_tokens});
  } catch (error) {
      return res.status(500).json({ error: 'Error getting claim status.' });
  }
});*/



app.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const res2 = await client.query("SELECT username, high_score FROM speed_square ORDER BY high_score DESC;");
    return res.send(res2.rows);
  } catch (error) {
      return res.status(500).json({ error: 'Error getting claim status.' });
  }
});


async function sign_up(username: string, password: string, email: string, signature: string, pub_key: string, makeIdUsername: string): Promise<number> {
    try {
    let sql = "";
    if (!pub_key || !signature) {
	    sql = "INSERT INTO speed_square (high_score, today_score, total_score, today_games, total_games, username) SELECT 0, 0, 0, 0, 0, '" + username + "' WHERE NOT EXISTS (SELECT username FROM speed_square WHERE username='" + username + "');";
        sql = sql + "INSERT INTO users (username, password, email, signature, pub_key) SELECT '" + username + "', '" + password + "', '" + email + "', '', '' WHERE NOT EXISTS (SELECT username FROM users WHERE username='" + username + "' OR email='" + email + "');";
    } else {
	    //TODO verify signature and public key match cryptographically
	sql = "INSERT INTO speed_square (high_score, today_score, total_score, today_games, total_games, username) SELECT 0, 0, 0, 0, 0, '" + makeIdUsername + "' WHERE NOT EXISTS (SELECT username FROM users WHERE username='" + makeIdUsername + "' OR pub_key='" + pub_key + "');";
    	    sql = sql + "INSERT INTO users (username, password, email, signature, pub_key) SELECT '" + makeIdUsername + "', '', '', '" + signature + "', '" + pub_key + "' WHERE NOT EXISTS (SELECT username FROM users WHERE username='" + makeIdUsername + "' OR pub_key='" + pub_key + "');";
    }
    const res3 = await client.query(sql);
    return res3.rowCount; //rows.length;
    }catch (error) {
      console.log(error);
      return 0;
  }
}


app.post('/signup', async (req: Request, res: Response) => {
  try {
    const msg = req.body.msg;
    const epoch = req.body.epoch;
    let x = encrypt.decryptLoginDataAES(epoch, msg);
    let json = JSON.parse(x);
    const username = json.username;
    const password = json.password;
    const email = json.email;
    const signature = json.signature;
    const pub_key = json.pub_key;
    const inserted = await sign_up(username, password, email, signature, pub_key, pub_key).then(value => {return value;}); //"user"+makeid(18)
    if(inserted > 0){
      return res.send({success: true});
    }else{
      return res.status(500).json({ error: 'Wrong sign up info, moron' });
    }
  } catch (error) {
      return res.status(500).json({ error: 'Error signing up.' });
  }
});


app.post('/login', async (req: Request, res: Response) => {
  try {
    const msg = req.body.msg;
    const epoch = req.body.epoch;
    let x = encrypt.decryptLoginDataAES(epoch, msg);
    let json = JSON.parse(x);
    const username = json.username;
    const password = json.password;
    const signature = json.signature;
    const pub_key = json.pub_key;
    const email = json.email;
    const login_token = makeid(48);
    const makeIdUsername = pub_key; //"user"+makeid(18);
    let sql1 = "";
    console.log(email);
   if (email != null){
	    console.log("banana");
	await sign_up(username, password, email, null, null, username);
	sql1 = "SELECT username FROM users WHERE (username='" + username + "' OR email='" + username + "') AND password='" + password + "';";
    } else 
	    if(!signature || !pub_key){
	console.log("wwwwwww");
	    sql1 = "SELECT username FROM users WHERE (username='" + username + "' OR email='" + username + "') AND password='" + password + "';";
    	console.log(sql1);
    }else{
	await sign_up(username, password, "", signature, pub_key, makeIdUsername);  
	sql1 = "SELECT username FROM users WHERE signature='" + signature + "' AND pub_key='" + pub_key + "';";
    }
    const res3 = await client.query(sql1);
    if(res3.rows.length > 0){
      let sql2 = "";
      let usernameOrPubKey = "";
      if(!signature || !pub_key){
	sql2 = "UPDATE users SET login_token='" + login_token + "' WHERE username='" + username + "';";
	usernameOrPubKey = username;
      } else {
	sql2 = "UPDATE users SET login_token='" + login_token + "' WHERE pub_key='" + pub_key + "';";
        usernameOrPubKey = pub_key;
      }
      const res2 = await client.query(sql2);
      let encRes = encrypt.encryptLoginDataAES(usernameOrPubKey, epoch, login_token);
      return res.send({encRes: encRes});
    }else{
      console.log("1");
      return res.send({error: "Incorrect Credentials"});
    }
  } catch (error) {
	  console.log("2");
      return res.status(500).json({ error: 'Error logging in.' });
  }
});


app.post('/deleteUser', async (req: Request, res: Response) => {
  try {
    let username = req.body.username;
    let pub_key = req.body.pub_key;
    let sql3 = "";
    if (!username) {
        sql3 = "SELECT login_token, username from users WHERE pub_key='" + pub_key + "';";
    } else {
        sql3 = "SELECT login_token from users WHERE username='" + username + "';";
    }
    const res3 = await client.query(sql3);
    const loginT = res3.rows[0].login_token;
    if (res3.rows[0].username) {
        username = res3.rows[0].username;
    }
    const json = JSON.parse(encrypt.decryptGeneral(loginT, req.body.msg));
   const score = json["score"];

   if(score == 1738){
    let sql = "";
    sql = sql + "DELETE FROM users WHERE username='" + username + "';";
    sql = sql + "DELETE FROM speed_square WHERE username='" + username + "';";
    const res2 = await client.query(sql);
    return res.send({ message: 'Successfully deleted user.'});
   }else{
	return res.status(500).json({ error: 'Error deleting user2.' });
   }
  } catch (error) {
      return res.status(500).json({ error: 'Error deleting user.' });
  }
});

app.use(express.static(__dirname + '/public'));


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
