var udp = require('dgram');
// creating a client socket
var client = udp.createSocket('udp4');
var PORT = 3105;
var IP = 'localhost';
//buffer msg
// var data = Buffer.from("a24870866416043072389f000001222992227f430087012dfd94ff8a00201200001701002620008685011300010415011a0c00010106001f00000000000000000000000000000095a3");
var data = ("a24870866416043072389f000001222992227f4b008701d9fc94ff7200201200001701002620008685011300010415011c0600020106001f0000000000000000000000000000002da3")
// var data = ("123444")
client.on('message',function(msg,info){
    console.log('Data received from server : ' + msg.toString());
    console.log('Received %d bytes from %s:%d\n',msg.length, info.address, info.port);
    client.close();
});

//sending msg

client.send(data,3105,'localhost',function(error){
    console.log(data);
    // client.close();
});
