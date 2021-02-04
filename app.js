var events = require('events');
var mqtt = require('mqtt');
var util = require('util');
var net = require('net');
var udp = require('dgram');
const logger = require('./logger');
var ip = require('ip');
var jsonpath = require('jsonpath');
var mobius = require('./MobiusConnector').mobius;
var _server = null;
global.conf = require('./conf.js');

var event = new events.EventEmitter();
var keti_mobius = new mobius();
keti_mobius.set_mobius_info(conf.cse.host, conf.cse.port,conf.ae.id);


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

function tas_handler_udp(data,remote) {
    console.log(remote.address + ":" + remote.port);
    // str_data =  data.toString('hex').match(/../g).join(' ');
    // replace_data = str_data.replace(/ /g,"");
    // var data_arr = replace_data.split('a3');
    // console.log(data_arr+"  "+JSON.stringify(remote));
    str_data = data.toString();
    console.log(str_data);
    var data_arr = str_data.split('a3');
    console.log(data_arr);
    if(data_arr.length >= 2) {
        data_arr  = data_arr.filter(function(item) {
	    return item !== '';
        });
        var line = data_arr.pop();
        var device_id = payload_decode(line);
        logger.log('info',JSON.stringify({"ID":device_id,"MSG":line}));
        // console.log('----> got data for [' + device_id + '] from tas ---->');
        var cin_path = conf.ae.parent + '/' +conf.ae.name + '/'+conf.cnt.name +'/'+ device_id+'/up';
        keti_mobius.create_cin(cin_path, line);
        console.log(pop_configure);
        for(var key in pop_configure){
            var keysp = key.split('/');
            if(keysp[0] == device_id){
                logger.log('info',JSON.stringify({"ID":device_id,"MSG":pop_configure[key]}));
                var msg = Buffer.from(pop_configure[key]);
                console.log(remote.address+":"+remote.port);
                _server.send(msg,0,msg.length,remote.port,remote.address,function(err,bytes){
                   if(err){
                       console.log(err);
                   }
                });
                delete pop_configure[key];
            }
        }

    }
    else{
        logger.log('error',JSON.stringify({"MSG":data_arr}));
    }

}

function payload_decode(data){
    device_id = data.substring(58,68);
    return device_id;
}


function cretation_dev_res(devlist){
    for(var i = 0; i < devlist.length; i++){
        var dev_parent_path = '/'+devlist[i];
        var upcrt_dev_resp = keti_mobius.create_cnt(dev_parent_path, 'up');
        var downcrt_dev_resp = keti_mobius.create_cnt(dev_parent_path, 'down');
        if(upcrt_dev_resp.code == 201 || upcrt_dev_resp.code == 409 && downcrt_dev_resp == 201 || downcrt_dev_resp ==409){
            console.log(devlist[i] + "Creation Complete!!");
        }
        var down_subpath = dev_parent_path + "/down"
        var sub_body = {nu:['mqtt://' + conf.noti.host  +'/'+ conf.noti.id + '?ct=json']};
        var sub_rtvpath = down_subpath +"/configure";
        var resp_sub = keti_mobius.retrieve_sub(sub_rtvpath);

        if (resp_sub.code == 200) {
            resp_sub = keti_mobius.delete_res(sub_rtvpath);

            if (resp_sub.code == 200) {
                resp_sub = keti_mobius.create_sub(down_subpath, "configure", sub_body.nu);

            }
        }
        else if (resp_sub.code == 404) {
            keti_mobius.create_sub(down_subpath, "configure", sub_body.nu);
        }
        else{
        }
        if(resp_sub.code == 201 || resp_sub.code == 409){
            console.log("SUB_Complete!!");
        }
    }
}

function get_device_resource(){
    var get_devlist_path = conf.ae.parent + '/' + conf.ae.name + '/' + conf.cnt.name +'?fu=1&ty=3&lvl=1';
    var resp_devlist = keti_mobius.retrieve_cnt(get_devlist_path);
    var devlist = JSON.parse(resp_devlist["body"])["m2m:uril"];
    cretation_dev_res(devlist);
}

function default_resource(){
    var ae_obj = {
      'm2m:ae':{
        'api': conf.ae.id,
        'rr': true,
        'rn': conf.ae.name
      }
    };
    var ae_resp = keti_mobius.create_ae(conf.ae.parent, ae_obj);
    if(ae_resp.code == 201 || ae_resp.code == 409){
        var sub_path = conf.ae.parent + '/' + conf.ae.name + '/'+conf.cnt.name;
        var sub_body = {nu:['mqtt://' + conf.noti.host  +'/'+ conf.noti.id + '?ct=json']};
        var sub_rtvpath = sub_path +'/'+"sub_crtdevice";
        var resp_sub = keti_mobius.retrieve_sub(sub_rtvpath);
        if (resp_sub.code == 200) {
            resp_sub = keti_mobius.delete_res(sub_rtvpath);
            if (resp_sub.code == 200) {
                resp_sub = keti_mobius.create_sub(sub_path, "sub_crtdevice", sub_body.nu);
            }
        }
        else if (resp_sub.code == 404) {
            keti_mobius.create_sub(sub_path, "sub_crtdevice", sub_body.nu);
        }
        else{
        }
        if(resp_sub.code == 201 || resp_sub.code == 409){
           console.log("SUB_Complete!!");
        }
    }
    get_device_resource();
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
        }
    }
    else {
        console.log('[mqtt_noti_action] m2m:sgn tag is none. m2m:notification format mismatch with oneM2M spec.');
        console.log(pc);
    }

    callback(path_arr, obj, rqi);
};
var pop_configure = [];
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
                    if(pc.sgn.nev.net == '3'){
                        if(obj.ty == '3'){
                            var devpath = [sur[1] + '/' + sur[2] + '/' + sur[3] + '/' + obj.rn];
                            console.log(devpath);
                            cretation_dev_res(devpath);

                        }
                        else if(obj.ty == '4'){
                            if(sur[5] == 'down'){
                                pop_configure[sur[4]+'/'+sur[5]] = obj.con;
                                console.log(pop_configure);
                                console.log("configure!");
                            }
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

setTimeout(default_resource,100)
