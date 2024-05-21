function register(client,clientId,Collection,REST,Routes,path,fs) {
    client.commands = new Collection();
  
  
    const commandsPath = path.join(__dirname, 'commands')
    const commands = [];
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('js'));
  
    for (const file of commandFiles) {
      const command = require(`./commands/${file}`);
      commands.push(command.data.toJSON());
    }
    const rest = new REST({ version: '10' }).setToken(process.env['DISCORD_BOT_TOKEN']);
    (async () => {
      try {
        console.log(`${commandFiles}`);
        console.log(`${commands.length}個のアプリケーションコマンドを登録します`);
  
        const data = await rest.put(
          Routes.applicationCommands(clientId),
          { body: commands },
        );
  
        console.log(`${data.length}個のアプリケーションコマンドを登録しました。`);
      } catch (error) {
        console.error(error);
      }
    })();
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        console.log(`${filePath}に必要な"data"か"execute"がありません`)
      }
  
    }
    }

    function checkTime(client) {
        const japanTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        const japanDate = new Date(japanTime);
        const hours = japanDate.getHours();
        const minutes = japanDate.getMinutes();
        const nowtime = `${hours}:${String(minutes).padStart(2, '0')}`;
        const jsonData = JSON.parse(fs.readFileSync('data/bumpData.json', 'utf-8'));
    
        
        for (const guildId in jsonData) {
            if (jsonData.hasOwnProperty(guildId)) {
                if (jsonData[guildId].time === nowtime) {
                    bump (client,guildId)
                }
            }
        }
        return null;
    }
      function bump (client,guildId){
        const jsonData = JSON.parse(fs.readFileSync('data/bumpData.json', 'utf-8'));
        const cid = jsonData[guildId].cid
        const oid = jsonData[guildId].oid
        const channel = client.channels.cache.get(cid);
        const owner = client.users.cache.get(oid);
        channel.send(`${owner}先生 bumpの時間ですよ！`);
      
      }
      
module.exports = {
    bump,
    checkTime,
    register,
}