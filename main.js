//必要モジュールなど

const { promises: fsPromises, ...fs } = require('fs');
var request = require('request');
const path = require("path")
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cheerio = require('cheerio');


//ファイルの読み込み

const {clientId} = require('./config.json');
const func = require("./func.js")
const server = require('./server.js'); 



//Google API 

const DISCOVERY_URL = 'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1';
const API_KEY = process.env['PERSPECTIVE_KEY'];//GoogleCloudのToken
const Y_API_KEY =  process.env['YOUTUBE_DATA_API'];
const { google } = require('googleapis');

//Discord

const {
  REST,
  Routes,
  Client,
  Collection,
  ButtonBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ActivityType,
  GatewayIntentBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require("discord.js");

//intents設定
const client = new Client({
  ws: { properties: { $browser: "Discord iOS" } },
  intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

//変数
const timeouts = new Map();//スパム対策
const userTokenWarningMap = new Map();
let count = 0;
server.server();

//Token設定の確認

if (process.env['DISCORD_BOT_TOKEN'] == undefined) {
  console.error("TOKENが設定されていません。");
  process.exit(0);
}//token照合

console.log("起動準備中...")

//ログイン
client.login(process.env['DISCORD_BOT_TOKEN']);

//Readyイベント発火

client.on("ready", () => {
    
    setInterval(function(){
        func.checkTime(client)
      },1000*60)
    func.register(client,clientId,Collection,REST,Routes,path,fs)
  function readyLog() { console.log("―――起動完了―――") }
  setTimeout(readyLog, 2500)

});

client.on('interactionCreate', async interaction => {
    try{
    if (!interaction.isChatInputCommand()) return;
  
    const command = interaction.client.commands.get(interaction.commandName);
  
    if (!command) {
      console.error(`${interaction.commandName} が見つかりません。`);
      return;
    }
  
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
    }
    }catch(e){
      
      interaction.channel.send("先生…システムエラーが発生したようです…修正されるまで少しお時間いただけますか？")
    }
  });//スラッシュコマンド設定

  client.on('messageCreate', (message) => {
    const { content, author, guild } = message;
    const tokenPattern = /[a-zA-Z0-9_-]{23,28}\.[a-zA-Z0-9_-]{6,7}\.[a-zA-Z0-9_-]{27}/;
  
    // メッセージの内容で正規表現を検査
    if (tokenPattern.test(content)) {
      message.delete()
      const userId = author.id;
  
      // ユーザーの警告情報を取得または初期化
      let userWarnings = userTokenWarningMap.get(userId) || 0;
  
      if (userWarnings === 0) {
        // ユーザーが初めてトークンを貼り付けた場合、警告を送信
        message.channel.send(`<@${message.author.id}>`+'先生？いたずらは駄目ですよね？次同じことしたらアロナ怒りますよ！');
        userWarnings++;
        userTokenWarningMap.set(userId, userWarnings);
      } else if (userWarnings === 1) {
        // ユーザーが2度目にトークンを貼り付けた場合、キック
        const member = guild.members.cache.get(userId);
        if (member) {
          member.ban('トークンの公開が続いたため対象のユーザーをBANしました。').then(() => {
            message.channel.send('いたずらはダメって言ったじゃないですか！悪い大人は成敗です！');
          }).catch((error) => {
            console.error('キックエラー:', error);
          });
        }
        // 警告情報をリセット
        userTokenWarningMap.delete(userId);
      }
    }
  });//Token検出
  
  client.on('messageCreate', async (message) => {
    // ボット自身のメッセージは無視
    if (message.author.bot) return;
  
    // メッセージの解析リクエストを作成
    const analyzeRequest = {
      comment: {
        text: message.content     
      },
      requestedAttributes: {
        TOXICITY: {}
      }
    };
  
    try {
      const googleClient = await google.discoverAPI(DISCOVERY_URL);
  
      // コメントの解析リクエストを送信
      const response = await googleClient.comments.analyze({
        key: API_KEY,
        resource: analyzeRequest,
      });
  
      // 評価点数が一定以上の場合に　警告 を送信
      const toxicityScore = response.data.attributeScores.TOXICITY.summaryScore.value;
      const threshold = 0.7; // この値は適切な閾値に調整
      if (toxicityScore >= threshold) {
  
        message.channel.send(`<@!${message.member.user.id}>先生！ちょっと言動がひどいと思いますよ？`);
  
      }
      if (toxicityScore >= threshold) {
        message.delete();
      }
    } catch (err) {
      console.error(err);
      console.log('An error occurred while analyzing the message.');
    }
  });//誹謗中傷防止
  
  client.on('messageCreate', async (message) => {
    // 現在の日本時間を取得
    const japanTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const japanDate = new Date(japanTime);
    const hours = japanDate.getHours();
    const minutes = japanDate.getMinutes();

    // 現在時刻に2時間を加えて、24時間を超える場合は調整する
    let time;
    if (hours + 2 >= 24) {
        time = `${hours + 2 - 24}:${String(minutes).padStart(2, '0')}`;
    } else {
        time = `${hours + 2}:${String(minutes).padStart(2, '0')}`;
    }

    // Embedがないメッセージは無視する
    if (message.embeds.length === 0) return;

    // Embedのタイトルが指定したものであるかをチェックする
    if (message.embeds[0].title === 'DISBOARD: Discordサーバー掲示板') {
        try {
            // メッセージに返信して通知する
            await message.channel.send('/bumpを検知しました！');
            await message.channel.send('2時間後にお知らせしますね！');

            // ファイルから既存のデータを読み込む
            let bumpData = {};
            try {
                const data = await fsPromises.readFile(`data/bumpData.json`, 'utf8');
                bumpData = JSON.parse(data);
            } catch (error) {
                // ファイルが存在しない場合や読み込みエラーが発生した場合に備えて、空のオブジェクトを使用します
                console.error('Error reading bumpData.json:', error);
            }

            // 新しいデータを既存のデータに追加
            bumpData[message.guild.id] = {
                "oid": `${message.guild.ownerId}`,
                "cid": `${message.channel.id}`,
                "time": `${time}`
            };

            // 更新されたデータをファイルに書き込む
            await fsPromises.writeFile(`data/bumpData.json`, JSON.stringify(bumpData, null, 2));
        } catch (error) {
            console.error('Error processing /bump:', error);
        }
    }
});//bump

client.on('voiceStateUpdate', async (oldState, newState) => {
  if(newState.guild.id === "1065321622736732250")return;
  if(oldState.guild.id === "1065321622736732250")return;
  try{
  const newUserChannel = newState.channel;
  const oldUserChannel = oldState.channel;
  let newChannel;
  
  
  if (!oldUserChannel && newUserChannel ) {
    const guild = newUserChannel.guild;
    const channelName = `${newState.channel.name}-聞き専`; // 取得したいチャンネル名
    console.log("new:"+channelName)
    const existingChannel = guild.channels.cache.find(ch => ch.name === channelName);
    console.log(existingChannel)
    if(existingChannel) return;

    const category = newUserChannel.parent;
    const random = Math.floor(Math.random() * 10000) + 1;
    if(newUserChannel.name === "密談")return;
    if(newUserChannel.name.includes("多機能VC")){
     try {
        if(newUserChannel.members.size === 1){
         newChannel = await guild.channels.create(
          {
            name:`グループVC#`+random, 
            type: ChannelType.GuildVoice,
            parent: category.id,

            }
        );

        }

        console.log(`Created new text channel: ${newChannel.name}  in category ${category.name}`);
      } catch (error) {
        console.error('Error creating channel:', error);
      }
     



    }
    
    try {
      if(newUserChannel.members.size === 1){

        if(newUserChannel.name.includes("多機能VC"))return;
       newChannel = await guild.channels.create(
        {
          name:`${newState.channel.name}-聞き専`, 
          type: 0,
          parent: category.id,

          }

      );
      }

      console.log(`Created new text channel: ${newChannel.name}  in category ${category.name}`);
    } catch (error) {
      console.error('Error creating channel:', error);
    }
    
  }//VC join
  else if (oldState.channel && !newUserChannel) {

    const guild = oldUserChannel.guild;
  
    try {
    

      if(oldUserChannel.members.size === 0){
        const channelName = `${oldState.channel.name}-聞き専`; // 取得したいチャンネル名
        const channel = guild.channels.cache.find(ch => ch.name === channelName);
        const mitudan = guild.channels.cache.find(ch => ch.name === "密談");
        
        if(channel){
          //console.log(channel)
          channel.delete();
        }
        else if(mitudan){
          mitudan.delete();
        }
        else if(oldState.channel.name.includes("グループVC#")){
          const channelName = oldState.channel.name;
          const numberMatch = channelName.match(/\d+/);
          console.log(numberMatch)
          const textCName = `グループvc${numberMatch}-聞き専`;
          const groupVc = guild.channels.cache.find(ch => ch.name === channelName);
          const groupVc2 = guild.channels.cache.find(ch => ch.name === textCName);
          groupVc.delete();
          groupVc2.delete();
          
        
        
      }
      }

    } catch (error) {
      console.error('Error delete channel:', error);
    }
  }//VC leave
  else{
    const category = newUserChannel.parent;

    const guild = newUserChannel.guild;
    const channelName = `${newState.channel.name}-聞き専`; // 取得したいチャンネル名
    console.log("new:"+channelName)
    const existingChannel = guild.channels.cache.find(ch => ch.name === channelName);
    console.log(existingChannel)
    if(existingChannel) return;

    if(!newUserChannel.name === "密談" || !newUserChannel.name.includes("多機能VC")){
      try {
        if(newUserChannel.members.size === 1){
         newChannel = await guild.channels.create(
          {
            name:`${newState.channel.name}-聞き専`, 
            type: 0,
            parent: category.id,

            }

        );
        }

        console.log(`Created new text channel: ${newChannel.name}  in category ${category.name}`);
      } catch (error) {
        console.error('Error creating channel:', error);
      }
    }

   

    if(oldUserChannel.members.size === 0){
    if(oldUserChannel.name.includes("多機能")||newUserChannel.name.includes("密談"))return;
    
    if(oldState.channel.name.includes("グループVC#")){
        const gchannelName = oldState.channel.name;
        const numberMatch = gchannelName.match(/\d+/);
        console.log(numberMatch)
        const textCName = `グループvc${numberMatch}-聞き専`;
        const groupVc = guild.channels.cache.find(ch => ch.name === gchannelName);
        const groupVc2 = guild.channels.cache.find(ch => ch.name === textCName);
        groupVc.delete();
        groupVc2.delete();
      }
  
      
    const channelName = `${oldState.channel.name}-聞き専`; // 取得したいチャンネル名
    const channel = guild.channels.cache.find(ch => ch.name === channelName);
    console.log(channel)
    channel.delete();
      
    }
  }
  }catch(e){console.log("Error"+e)}
});//VC

/*
// 監視するURL
const ba_url = 'https://bluearchive.jp/news/newsJump';

// 前回のページ内容を初期化
let previousContent = '';

// ページを取得して比較する関数
async function checkForUpdates() {
    try {
        // ページの取得
        const response = await axios.get(ba_url);
        
        if (response.status === 200) {
            // ページの内容を取得
            const currentContent = response.data;
            
            // 前回の内容と比較して変更があるか確認
            if (currentContent !== previousContent) {
                console.log("ページが更新されました！");
                // 変更があった場合、新しい内容を表示するか他の処理を行うことができます
                
                // 更新後の内容を保存
                previousContent = currentContent;
            }
        } else {
            console.log("ページにアクセスできません。ステータスコード:", response.status);
        }
    } catch (error) {
        console.error("エラーが発生しました:", error);
    }
}


// 一定の間隔でページを監視
setInterval(checkForUpdates, 1000*60*60*24); 

// 最初のページチェックを実行
checkForUpdates();
*/

