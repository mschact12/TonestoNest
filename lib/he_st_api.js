const platformName = 'SmartThings-2.0';
const http = (platformName === 'SmartThings-2.0') ? require('https') : require('http');
const reqPromise = require('request-promise');
const url = require('url');
let app_host, app_port, app_path, access_token, localHubIp, useLocalCmds;

let logger = {};
logger.log = console.log;
logger.log.debug = console.log;

function _http(data, callback) {
    //console.log("Calling " + platformName);
    let options = {
        hostname: app_host,
        port: app_port,
        path: app_path + data.path + "?access_token=" + access_token,
        method: data.method,
        headers: {}
    };
    if (data.data) {
        data.data = JSON.stringify(data.data);
        options.headers['Content-Length'] = Buffer.byteLength(data.data);
        options.headers['Content-Type'] = "application/json";
    }
    if (data.debug) {
        logger.log.debug('_http options: ', JSON.stringify(options));
    }
    let str = '';
    let req = http.request(options, function(response) {
        response.on('data', function(chunk) {
            str += chunk;
        });

        response.on('end', function() {
            if (data.debug) {
                logger.log.debug("response in http:", str);
            }
            try {
                str = JSON.parse(str);
            } catch (e) {
                if (data.debug) {
                    logger.log.debug(e.stack);
                    logger.log.debug("raw message", str);
                }
                str = undefined;
            }

            if (callback) {
                callback(str);
                callback = undefined;
            };
        });
    });

    if (data.data) {
        req.write(data.data);
    }

    req.end();

    req.on('error', function(e) {
        logger.log.debug("error at req: ", e.message);
        if (callback) {
            callback();
            callback = undefined;
        };
    });
}

function _httpLocalPost(data, callback) {
    let options = {
        method: data.method,
        uri: data.uri,
        headers: data.headers || {},
        body: data.body || {},
        json: true
    };
    reqPromise(options)
        .then(function(body) {
            if (callback) {
                callback(body);
                callback = undefined;
            };
        })
        .catch(function(err) {
            logger.log.debug("reqPromise Error: ", err.message);
            if (callback) {
                callback();
                callback = undefined;
            };
        });
}

function POST(data, callback) {
    data.method = "POST";
    if (data.useLocal === true) {
        _httpLocalPost(data, callback);
    } else {
        _http(data, callback);
    }
}

function GET(data, callback) {
    data.method = "GET";
    _http(data, callback);
}

let he_st_api = {
    init: function(inURL, inAppID, inAccess_Token, hubIp, useLocal = false, inLog = null) {
        if (inLog) {
            logger.log = inLog;
        }

        useLocalCmds = (useLocal === true);
        localHubIp = hubIp;
        var appURL = url.parse(inURL);
        if (platformName === 'SmartThings-2.0') {
            app_host = appURL.hostname || "graph.api.smartthings.com";
            app_port = appURL.port || 443;
            app_path = (appURL.path || "/api/smartapps/installations/") + inAppID + "/";
        } else {
            app_host = appURL.hostname;
            app_port = appURL.port || 80;
            app_path = appURL.path;
        }
        access_token = inAccess_Token;
    },
    updateGlobals: function(hubIp, useLocal = false) {
        logger.log.debug("Updating globals: " + hubIp + ", " + useLocal);
        localHubIp = hubIp;
        useLocalCmds = (useLocal === true);
    },
    getDevices: function(callback) {
        GET({
            debug: false,
            path: 'devices'
        }, function(data) {
            if (callback) {
                callback(data);
                callback = undefined;
            };
        });
    },
    getDevice: function(deviceid, callback) {
        GET({
            debug: false,
            path: deviceid + '/query'
        }, function(data) {
            if (data) {
                if (callback) {
                    callback(data);
                    callback = undefined;
                };
            } else {
                if (callback) {
                    callback();
                    callback = undefined;
                };
            }
        });
    },
    getUpdates: function(callback) {
        GET({
            debug: false,
            path: 'getUpdates'
        }, function(data) {
            if (callback) {
                callback(data);
                callback = undefined;
            };
        });
    },
    runCommand: function(callback, deviceid, command, values) {
        logger.log.debug("[" + platformName + " Plugin Action] Command: " + command + " | Value: " + (values !== undefined ? JSON.stringify(values) : "Nothing") + " | DeviceID: (" + deviceid + ") | local_cmd: " + useLocalCmds);
        let useLocal = (useLocalCmds === true && localHubIp !== undefined && platformName === 'SmartThings-2.0');
        let config = {};
        if (useLocal === true) {
            config = {
                debug: false,
                uri: 'http://' + localHubIp + ':39500/event',
                body: {
                    deviceid: deviceid,
                    command: command,
                    values: values
                },
                headers: {
                    evtSource: 'Homebridge_' + platformName,
                    evtType: 'hkCommand'
                },
                useLocal: true
            };
        } else {
            config = {
                debug: false,
                path: deviceid + '/command/' + command,
                data: values
            };
        }
        POST(config, function() {
            if (callback) {
                callback();
                callback = undefined;
            };
        });
    },
    startDirect: function(callback, myIP, myPort) {
        let useLocal = (useLocalCmds === true && localHubIp !== undefined && platformName === 'SmartThings-2.0');

        if (useLocal) {
            POST({
                debug: false,
                uri: 'http://' + localHubIp + ':39500/event',
                body: {
                    ip: myIP,
                    port: myPort
                },
                headers: {
                    evtSource: 'Homebridge_' + platformName,
                    evtType: 'enableDirect'
                },
                useLocal: true
            }, function() {
                if (callback) {
                    callback();
                    callback = undefined;
                };
            });
        } else {
            GET({
                debug: false,
                path: 'startDirect/' + myIP + '/' + myPort
            }, function() {
                if (callback) {
                    callback();
                    callback = undefined;
                };
            });
        }
    },
    getSubscriptionService: function(callback) {
        GET({
            debug: false,
            path: 'getSubcriptionService'
        }, function(data) {
            if (callback) {
                callback(data);
                callback = undefined;
            };
        });
    }
};
module.exports = he_st_api;