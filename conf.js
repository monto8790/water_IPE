var conf = {};
var cse = {};
var ae = {};
var cnt = {};
var noti = {};
//cse config
cse.host = "15.165.186.108";
cse.port = "7579";
cse.name = "Mobius";
cse.id = "/Mobius2";
cse.mqttport = "1883";

//ae config
ae.name = "shindongah";
ae.id = "umay";
ae.parent = "/" + cse.name;
ae.appid = "shindongah"
ae.socport = "3105"
//cnt config
cnt.name = 'community';

//noti host ip
noti.host = '15.165.186.108';
noti.id = "umay";

conf.cse = cse;
conf.ae = ae;
conf.cnt = cnt;
conf.noti = noti;

module.exports = conf;
