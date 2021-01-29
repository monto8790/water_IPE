/**
 * Created by demo on 2017/2/6.
 */
var request = require('sync-request');
// var uuid = require('uuid/v1');
var http = require('http');
var requestId = Math.floor(Math.random() * 10000);
exports.mobius = function () {

    var server_ip = '';
    var server_port = 7579;
    var ae_id = '';


    this.set_mobius_info = function (ip, port, aeid) {
        server_ip = ip;
        server_port = parseInt(port, 10);

        if (aeid == undefined) {
            ae_id = 'S';
        } else if (aeid.length == 0) {
            ae_id = 'S';
        } else {
            ae_id = aeid;
        }
    };
    this.retrieve_cse = function (path) {

        var data = null;

        try {
            var url = 'http://' + server_ip + ':' + server_port + path;

            console.log('retrieve cse: GET -> ' + url);

            var resp = request('GET', url, {
                'headers': {
                    'Accept': 'application/json',
                    'X-M2M-RI': requestId,
                    'X-M2M-Origin': 'S'
                }
            });

            var status_code = resp.statusCode;
            var str = '';
            try {
                str = String(resp.getBody());
            } catch (err) {
                str = String(err.body);
                //console.error(err);
            }
            var data = {'code': status_code, 'body': str};

            console.log('retrieve cse: ' + status_code + ' <- ' + str);
        } catch (exp) {
            console.error(exp);
        }

        return data;
    };

    this.retrieve_ae_async = function (path, callback) {

        console.log('retrieve ae: GET -> ' + path);

        var options = {
            hostname: server_ip,
            port: server_port,
            path: path,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-M2M-RI': requestId,
                'X-M2M-Origin': ae_id
            }
        };

        var req = http.request(options, function (resp) {
            var serverData = '';
            resp.on('data', function (chunk) {
                serverData += chunk;
            });
            resp.on('end', function () {
                var data = {'code': resp.statusCode, 'body': serverData};
                callback(data);
                console.log('retrieve ae: ' + resp.statusCode + ' <- ' + serverData);
            });
        });

        req.end();
    };

    this.retrieve_ae = function (path) {

        var url = 'http://' + server_ip + ':' + server_port + path;

        console.log('retrieve ae: GET -> ' + url);

        var resp = request('GET', url, {
            'headers': {
                'Accept': 'application/json',
                'X-M2M-RI': requestId,
                'X-M2M-Origin': ae_id
            }
        });

        var status_code = resp.statusCode;
        var str = '';
        try {
            str = String(resp.getBody());
        } catch (err) {
            str = String(err.body);
            //console.error(err);
        }
        var data = {'code': status_code, 'body': str};

        console.log('retrieve ae: ' + status_code + ' <- ' + str);

        return data;
    };

    this.create_ae = function (path, ae) {

        var url = 'http://' + server_ip + ':' + server_port + path;

        console.log('create ae: POST -> ' + url);

        var resp = request('POST', url, {
            'headers': {
                'Accept': 'application/json',
                'X-M2M-RI': requestId,
                'X-M2M-Origin': ae_id,
                'Content-Type': 'application/json;ty=2;'
            },
            'body': JSON.stringify(ae)
        });

        var status_code = resp.statusCode;
        var str = '';
        try {
            str = String(resp.getBody());
        } catch (err) {
            str = String(err.body);
            //console.error(err);
        }
        var data = {'code': status_code, 'body': str};

        console.log('create ae: ' + status_code + ' <- ' + str);

        return data;
    };

    this.retrieve_cnt = function (path) {

        var url = 'http://' + server_ip + ':' + server_port + path;

        console.log('retrieve cnt: GET -> ' + url);

        var resp = request('GET', url, {
            'headers': {
                'Accept': 'application/json',
                'X-M2M-RI': requestId,
                'X-M2M-Origin': ae_id
            }
        });

        var status_code = resp.statusCode;
        var str = '';
        try {
            str = String(resp.getBody());
        } catch (err) {
            str = String(err.body);
            //console.error(err);
        }
        var data = {'code': status_code, 'body': str};

        console.log('retrieve cnt: ' + status_code + ' <- ' + str);

        return data;
    };

    this.create_cnt = function (path, rn) {

        var url = 'http://' + server_ip + ':' + server_port + path;

        console.log('create cnt: POST -> ' + url);
        var cnt_Obj = {
            'm2m:cnt': {
                'rn': rn
            }
        };
        var resp = request('POST', url, {
            'headers': {
                'Accept': 'application/json',
                'X-M2M-RI': requestId,
                'X-M2M-Origin': ae_id,
                'Content-Type': 'application/json;ty=3;'
            },
            'body': JSON.stringify(cnt_Obj)
        });

        var status_code = resp.statusCode;
        var str = '';
        try {
            str = String(resp.getBody());
        } catch (err) {
            str = String(err.body);
            //console.error(err);
        }
        var data = {'code': status_code, 'body': str};

        console.log('create cnt: ' + status_code + ' <- ' + str);

        return data;
    };
    this.retrieve_sub = function (path) {

        var url = 'http://' + server_ip + ':' + server_port + path;

        console.log('retrieve sub: GET -> ' + url);

        var resp = request('GET', url, {
            'headers': {
                'Accept': 'application/json',
                'X-M2M-RI': requestId,
                'X-M2M-Origin': ae_id
            }
        });

        var status_code = resp.statusCode;
        var str = '';
        try {
            str = String(resp.getBody());
        } catch (err) {
            str = String(err.body);
            //console.error(err);
        }
        var data = {'code': status_code, 'body': str};

        console.log('retrieve sub: ' + status_code + ' <- ' + str);

        return data;
    };

    this.create_sub = function (path, rn, nu) {

        var url = 'http://' + server_ip + ':' + server_port + path;

        console.log('create sub: POST -> ' + url);
        var sub_obj = {
            'm2m:sub':
                {
                    'rn' : rn,
                    'enc': {'net': [1,2,3,4]},
                    'nu' : nu,
                    'nct': 1,
                    'exc': 0
                }
        };
        var resp = request('POST', url, {
            'headers': {
                'Accept': 'application/json',
                'X-M2M-RI': requestId,
                'X-M2M-Origin': ae_id,
                'Content-Type': 'application/json;ty=23;'
            },
            'body': JSON.stringify(sub_obj)
        });

        var status_code = resp.statusCode;
        var str = '';
        try {
            str = String(resp.getBody());
        } catch (err) {
            str = String(err.body);
            //console.error(err);
        }
        var data = {'code': status_code, 'body': str};

        console.log('create sub: ' + status_code + ' <- ' + str);

        return data;
    };


    this.create_cin = function (path, data) {
        var cin_obj = {
            'm2m:cin':{
                'con': data
            }
        }

        var options = {
            hostname: server_ip,
            port: server_port,
            path: path,
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'X-M2M-RI': 'S',
                'X-M2M-Origin': 'S',
                'Content-Type': 'application/json; ty=4'
                // 'Content-Length': Buffer.byteLength(data)
            }
        }

        var req = http.request(options, res => {
            console.log(`<---- x-m2m-rsc : ${res.statusCode}`)
            res.on('data', data => {
                //console.log(data)
            })
        })
        req.on('error', error => {
            console.error(error)
        })
        req.write(JSON.stringify(cin_obj))
        req.end()
    }

    this.delete_res = function (path) {

        var url = 'http://' + server_ip + ':' + server_port + path;

        console.log('delete resc: DELETE -> ' + url);

        var resp = request('DELETE', url, {
            'headers': {
                'Accept': 'application/json',
                'X-M2M-RI': requestId,
                'X-M2M-Origin': ae_id
            }
        });

        var status_code = resp.statusCode;
        var str = '';
        try {
            str = String(resp.getBody());
        } catch (err) {
            str = String(err.body);
            //console.error(err);
        }
        var data = {'code': status_code, 'body': str};

        console.log('delete resc: ' + status_code + ' <- ' + str);

        return data;
    };

};
