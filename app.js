var events = require('events');
var mqtt = require('mqtt');
var util = require('util');
var net = require('net');
var udp = require('dgram');
const logger = require('./logger');
var fs = require('fs');
var ip = require('ip');
var jsonpath = require('jsonpath');
var mobius = require('./MobiusConnector').mobius;
var _server = null;
global.conf = require('./conf.js');
var net_module = 'udp';

var event = new events.EventEmitter();
var keti_mobius = new mobius();
keti_mobius.set_mobius_info(conf.cse.host, conf.cse.port,conf.ae.id);

var tas_buffer = {};
// fs.readFile("./device_list.json", function(err, data) {
//     if (err) throw err;
//     dev_ids = JSON.parse(data);
//     console.log(dev_ids);
// });
function init_mqtt_client() {
    var mobius_connectOptions = {
        host: conf.cse.host,
        port: conf.cse.mqttport,
        protocol: "mqtt",
        keepalive: 10,
        protocolId: "MQTT",
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 2000,
        connectTimeout: 2000,
        rejectUnauthorized: false
    };
    mqtt_client = mqtt.connect(mobius_connectOptions);
    mqtt_client.on('connect', on_mqtt_connect);
    mqtt_client.on('message', on_mqtt_message_recv);
    console.log("init_mqtt_client!!!");
}

function on_mqtt_connect() {
    var noti_topic = util.format('/oneM2M/req/+/%s/#', conf.ae.id);
    mqtt_client.unsubscribe(noti_topic);
    mqtt_client.subscribe(noti_topic);
    console.log('[mqtt_connect] noti_topic : ' + noti_topic);
}

function on_mqtt_message_recv(topic, message) {
    console.log('receive message from topic: <- ' + topic);
    console.log('receive message: ' + message.toString());
    var topic_arr = topic.split("/");
    if (topic_arr[1] == 'oneM2M' && topic_arr[2] == 'req' && topic_arr[4] == conf.ae.id) {
        var jsonObj = JSON.parse(message.toString());
        if (jsonObj['m2m:rqp'] == null) {
            jsonObj['m2m:rqp'] = jsonObj;
        }

        mqtt_noti_action(jsonObj, function (path_arr, cinObj, rqi, sur) {
            if (cinObj) {
                var rsp_topic = '/oneM2M/resp/' + topic_arr[3] + '/' + topic_arr[4] + '/' + topic_arr[5];

                event.emit('upload', sur, cinObj);

                response_mqtt(rsp_topic, '2001', '', conf.ae.id, rqi, '', topic_arr[5]);
            }
        });
    }
    else {
        console.log('topic is not supported');
    }
}

function response_mqtt (rsp_topic, rsc, to, fr, rqi, inpcs) {
    var rsp_message = {};
    rsp_message['m2m:rsp'] = {};
    rsp_message['m2m:rsp'].rsc = rsc;
    rsp_message['m2m:rsp'].to = to;
    rsp_message['m2m:rsp'].fr = fr;
    rsp_message['m2m:rsp'].rqi = rqi;
    rsp_message['m2m:rsp'].pc = inpcs;

    mqtt_client.publish(rsp_topic, JSON.stringify(rsp_message['m2m:rsp']));

    console.log('noti publish -> ' + JSON.stringify(rsp_message));

}

function nb_socket() {
    if(net_module == 'tcp'){
        if(_server == null) {
            _server = net.createServer(function (socket) {
                console.log('socket connected');
                socket.id = Math.random() * 1000;
                tas_buffer[socket.id] = '';
                socket.on('data', tas_handler);
                socket.on('end', function() {
                    console.log('end');
                });
                socket.on('close', function() {
                    console.log('close');
                });
                socket.on('error', function(e) {
                    console.log('error ', e);
                });
            });

            _server.listen(conf.ae.socport, function() {
                console.log('TCP Server (' + ip.address() + ') for TAS is listening on port ' + conf.ae.socport);
            });
        }
    }
    else{
	    console.log('socket listening');
        if(_server == null){
            _server = udp.createSocket('udp4');
            _server.on('listening', function () {
                console.log('UDP Server(' + ip.address() + ") for TAS is listening on port" + conf.ae.socport);
            });
            _server.on('message', tas_handler_udp);
            _server.on('close', function(){
    	        console.log("close");
            });
            _server.bind(conf.ae.socport,"0.0.0.0");

        }
    }
}

function tas_handler_udp(data,remote) {
    console.log(remote.address + ":" + remote.port);
    str_data =  data.toString('hex').match(/../g).join(' ');
    replace_data = str_data.replace(/ /g,"");
    var data_arr = replace_data.split('a3');
    console.log(data_arr+"  "+JSON.stringify(remote));

    if(data_arr.length >= 2) {
        data_arr  = data_arr.filter(function(item) {
	    return item !== '';
        });
        var line = data_arr.pop();
        var device_id = payload_decode(line);
        logger.log('info',JSON.stringify({"ID":device_id,"MSG":line}));
        // console.log('----> got data for [' + device_id + '] from tas ---->');
        var parent = conf.ae.parent + '/' +conf.ae.name + '/'+conf.cnt.name +'/'+ device_id;
        var cin_obj = {
            'm2m:cin':{
                'con': line
            }
        }
        keti_mobius.create_cin(parent, cin_obj);
       // var meg = Buffer.from('server Data!!');
       // console.log(remote.address+":"+remote.port);
       //  _server.send(meg,0,meg.length,remote.port,remote.address,function(err,bytes){
       //     if(err){
       //         console.log(err);
       //     }
       //  });
    }
    else{
        logger.log('error',JSON.stringify({"MSG":data_arr}));
    }

}

function payload_decode(data){
    device_id = data.substring(58,68);
    return device_id;
}

function tas_handler (data) {
    str_data =  data.toString('hex').match(/../g).join(' ');
    replace_data = str_data.replace(/ /g,"");
    tas_buffer[this.id] += replace_data;
    console.log(replace_data);
    var data_arr = tas_buffer[this.id].split('a3');
	console.log(data_arr.length)
    if(data_arr.length >= 2) {
        data_arr  = data_arr.filter(function(item) {
		    return item !== '';
        });
        var line = data_arr.pop();
        tas_buffer[this.id] = tas_buffer[this.id].replace(line+'a3', '');
        var device_id = payload_decode(line)
        console.log('----> got data for [' + device_id + '] from tas ---->');
    var parent = conf.ae.parent + '/' +conf.ae.name + '/'+conf.cnt.name +'/'+ device_id;
        var cin_obj = {
            'm2m:cin':{
                'con': line
            }
        }
        keti_mobius.create_cin(parent, cin_obj);
    }
}

function init_resource(){
    var ae_obj = {
      'm2m:ae':{
        'api': conf.ae.id,
        'rr': true,
        'rn': conf.ae.name
      }
    };
    var ae_resp = keti_mobius.create_ae(conf.ae.parent, ae_obj);
    if(ae_resp.code == 201 || ae_resp.code == 409){
        // var cnt_parent_path = conf.ae.parent + '/' + conf.ae.name;
        // var cnt_obj = {
        //         'm2m:cnt':{
        //         'rn' : conf.cnt.name //meter
        //         }
        //     };
        //     var cnt_resp = keti_mobius.create_cnt(cnt_parent_path, cnt_obj);
        //     if (cnt_resp.code == 201 || cnt_resp.code == 409){
        //         for (var i = 0; i < dev_ids.length; i++) {
        //             var dev_parent_path = cnt_parent_path +'/'+conf.cnt.name;
        //             var cnt_devObj = {
        //                 'm2m:cnt':{
        //                 'rn' : dev_ids[i].id
        //                 }
        //             };
        //             console.log(dev_parent_path);
        //             var crt_dev_resp = keti_mobius.create_cnt(dev_parent_path, cnt_devObj);
        //             if(crt_dev_resp.code == 201 || crt_dev_resp.code == 409){
        //                     console.log(dev_ids[i].id + "Create!!");
        //             }
        //         }
        //     }

        var sub_path = conf.ae.parent + '/' + conf.ae.name + '/'+conf.cnt.name;
        var sub_body = {nu:['mqtt://' + conf.noti.host  +'/'+ conf.noti.id + '?ct=json']};
        // var sub_body = {nu:['mqtt://' + conf.noti.host  +'/'+ conf.ae.id + '?ct=json']};
        var sub_obj = {
            'm2m:sub':
                {
                    'rn' : "sub_crtdevice",
                    'enc': {'net': [1,2,3,4]},
                    'nu' : sub_body.nu,
                    'nct': 1,
                    'exc': 0
                }
        };
        var sub_rtvpath = sub_path +'/'+"sub_crtdevice";
        var resp_sub = keti_mobius.retrieve_sub(sub_rtvpath);

        if (resp_sub.code == 200) {
            resp_sub = keti_mobius.delete_res(sub_rtvpath);

            if (resp_sub.code == 200) {
                resp_sub = keti_mobius.create_sub(sub_path, sub_obj);

            }
        }
        else if (resp_sub.code == 404) {
            keti_mobius.create_sub(sub_path, sub_obj);
        }
        else{
        }
        if(resp_sub.code == 201 || resp_sub.code == 409){
           console.log("SUB_Complete!!");
        }
    }
    init_mqtt_client();
    nb_socket();
}

function parse_sgn(rqi, pc, callback) {
    if(pc.sgn) {
        var nmtype = pc['sgn'] != null ? 'short' : 'long';
        var sgnObj = {};
        var obj = {};
        sgnObj = pc['sgn'] != null ? pc['sgn'] : pc['singleNotification'];

        if (nmtype === 'long') {
            console.log('oneM2M spec. define only short name for resource')
        }
        else { // 'short'
            if (sgnObj.sur) {
                if(sgnObj.sur.charAt(0) != '/') {
                    sgnObj.sur = '/' + sgnObj.sur;
                }
                var path_arr = sgnObj.sur.split('/');
            }

            if (sgnObj.nev) {
                if (sgnObj.nev.rep) {
                    if (sgnObj.nev.rep['m2m:cin']) {
                        sgnObj.nev.rep.cin = sgnObj.nev.rep['m2m:cin'];
                        delete sgnObj.nev.rep['m2m:cin'];
                    }
                    else if (sgnObj.nev.rep['m2m:cnt']) {
                        sgnObj.nev.rep.cnt = sgnObj.nev.rep['m2m:cnt'];
                        delete sgnObj.nev.rep['m2m:cnt'];
                    }

                    if (sgnObj.nev.rep.cin) {
                        obj = sgnObj.nev.rep.cin;
                    }
                    else if(sgnObj.nev.rep.cnt){
                        obj = sgnObj.nev.rep.cnt;
                    }
                    else {
                        obj = null;
                    }
                }
                else {
                    console.log('[mqtt_noti_action] rep tag of m2m:sgn.nev is none. m2m:notification format mismatch with oneM2M spec.');
                    obj = null;
                }
            }
            // else if (sgnObj.sud) {
            //     console.log('[mqtt_noti_action] received notification of verification');
            //     cinObj = {};
            //     cinObj.sud = sgnObj.sud;
            // }
            // else if (sgnObj.vrq) {
            //     console.log('[mqtt_noti_action] received notification of verification');
            //     cinObj = {};
            //     cinObj.vrq = sgnObj.vrq;
            // }
            //
            // else {
            //     console.log('[mqtt_noti_action] nev tag of m2m:sgn is none. m2m:notification format mismatch with oneM2M spec.');
            //     cinObj = null;
            // }
        }
    }
    else {
        console.log('[mqtt_noti_action] m2m:sgn tag is none. m2m:notification format mismatch with oneM2M spec.');
        console.log(pc);
    }

    callback(path_arr, obj, rqi);
};

function mqtt_noti_action(jsonObj, callback) {
    if (jsonObj != null) {
        var op = (jsonObj['m2m:rqp']['op'] == null) ? '' : jsonObj['m2m:rqp']['op'];
        var to = (jsonObj['m2m:rqp']['to'] == null) ? '' : jsonObj['m2m:rqp']['to'];
        var fr = (jsonObj['m2m:rqp']['fr'] == null) ? '' : jsonObj['m2m:rqp']['fr'];
        var rqi = (jsonObj['m2m:rqp']['rqi'] == null) ? '' : jsonObj['m2m:rqp']['rqi'];
        var pc = {};
        pc = (jsonObj['m2m:rqp']['pc'] == null) ? {} : jsonObj['m2m:rqp']['pc'];
        if(pc['m2m:sgn']) {
            pc.sgn = {};
            pc.sgn = pc['m2m:sgn'];
            delete pc['m2m:sgn'];
        }
        parse_sgn(rqi, pc, function(path_arr, obj,rqi){
            if(obj) {
                if(obj.sud || obj.vrq) {
                    var resp_topic = '/oneM2M/resp/' + topic_arr[3] + '/' + topic_arr[4] + '/' + topic_arr[5];
                    // _this.response_mqtt(resp_topic, 2001, '', conf.ae.id, rqi, '', topic_arr[5]);
                }
                else {
                    console.log('mqtt ' + 'json' + ' notification <----');

                    var sur = pc.sgn.sur.split('/');
                    console.log(sur);
                    if(pc.sgn.nev.net == '3'){
                        console.log(obj);
                        if(obj.ty == '3'){
                            var id_obj = JSON.stringify({"id" : obj.rn});
                            fs.readFile("./device_list.json", function (err, data) {
                                var json = JSON.parse(data)
                                console.log(json)
                                json.push(id_obj);
                                fs.writeFile("./device_list.json", JSON.stringify(json))
                            })
                            // fs.writeFile('./device_list.json',id_obj,function (err) {
                            //     if(err) return console.log(err);
                            //     console.log("Deviceid list has been updated!")
                            //
                            // })
                        }
                        else if(obj.ty == '4'){

                        }
                        else{
                            console.log("[mqtt_noti_action] Exception type!")
                        }


                    }
                    callback(path_arr, obj, rqi, pc.sgn.sur);
                }
            }
        })
    }
    else {
        console.log('[mqtt_noti_action] message is not noti');
    }
}

setTimeout(init_resource,100)
