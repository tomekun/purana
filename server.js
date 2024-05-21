const http = require("http");
const axios = require('axios');
const fs = require('node:fs')
function keepServer(){
try {
http.createServer(function(req, res) {
  res.write("OK！");
  res.end();
}).listen(8080);
} catch(e){console.log('エラーが発生しました。\nエラー内容:'+e)}
}
exports.server = keepServer;