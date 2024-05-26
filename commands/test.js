const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('テスト用'),
  execute: async function(interaction) {
    await interaction.reply("test")
  //await interaction.reply({ content: 'echo', ephemeral: true });
}};