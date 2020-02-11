let https = require("https");
let xml2js = require("xml2js");
var querystring = require("querystring");

let httpquery = {
	
    getFile: function(file) {
        if (typeof file === 'string') {
            let url = file;
            file = { };
            if (url.startsWith("http://")) {
                url = url.substring("http://".length);
            }
            if (url.startsWith("https://")) {
                url = url.substring("https://".length);
            }
            file.host = url.split("/")[0];
            file.path = url.substring(file.host.length);
            file.type = url.split(".")[url.split(".").length -1];
        }
        let type = file.type ? file.type : "json";
        return httpquery.request(file.host, file.path, type);
    },
    
    get: function(host, path) {
        return httpquery.request(host, path, "json");
    },
    
    request: function(host, path, type, object) {
        
        return new Promise((resolve, reject) => {
            var data = undefined; 
            if (object != undefined) {
                data = JSON.stringify(object); 
            }
            var options = {
                host: host,
                port: 443,
                path: path,
                method: (data == undefined ? 'GET': 'POST'),
                headers: { }
            };
            if (data != undefined) {
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                options.headers['Content-Length'] = Buffer.byteLength(data);
            }
            
            var req = https.request(options, function(res) {
                let body = '';
                res.on('data', function(chunk) {
                    body += chunk;
                });
                res.on('end', function() {
                    if (type == "json") {
                        result = JSON.parse(body);
                    } else {
                        result = body;
                    }
                    if (res.statusCode == 404) {
                        reject(res.statusCode);
                    } else {
                        resolve(result);
                    }
                });
                
            }).on('error', function(e) {
                console.log("Got error: " + e.message);
                reject(e);
            });

            if (data != undefined) {
                req.write(data);
            }
            req.end();
        });
    }
};


let xmljs = {

    getTocs: function (url) {
        //Retrieve given url or null if error.
        return new Promise((resolve, reject) => {
            httpquery.getFile(url).then(result => {
                resolve(result);
            }).catch(err => {
                console.log(`${url} not found.`);
                resolve(null);
            });
         });
    },

    parseString: function (string) {
        //Parse given string as object or {} if null
        return new Promise((resolve, reject) => {
            if (string == null) {
                resolve({});
            } else {
                xml2js.parseString(string, function (err, result) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }).catch(err => console.error(err));
            }
         });
    }
}

exports.getRawTocs = function(urls) {
    //from urls to xmls then from xmls to json
    return new Promise((resolve, reject) => {
        Promise.all(urls.map(url => xmljs.getTocs(url))).then(results => {
            Promise.all(results.map(r => xmljs.parseString(r))).then(js => resolve(js)).catch(err => reject(err));
        }).catch(err => reject(err));
    });
}

exports.getPlugins = function(urls) {
    //from urls to xmls then from xmls to json
    return new Promise((resolve, reject) => {
        Promise.all(urls.map(url => httpquery.getFile(url))).then(results => {
            Promise.all(results.map(r => xmljs.parseString(r))).then(js => resolve(js)).catch(err => reject(err));
        }).catch(err => reject(err));
    });
}

exports.getTocsUrls = function(pluginsurls) {
    return new Promise((resolve, reject) => {
        exports.getPlugins(pluginsurls).then(e => {
            let plugins = Array.from(Array(pluginsurls.length).keys()).map(x => {
                let plugin = pluginsurls[x].split("/")[pluginsurls[x].split("/").length-2];
                let filename = pluginsurls[x].split("/")[pluginsurls[x].split("/").length-1];
                return {"url": pluginsurls[x], "plugin": plugin, "content": e[x] }
            });
            
            //Retrieve all extensions points
            let tocs2 = function(plugin) {
                let result = plugin.content.plugin.extension.filter(e => e["$"].point == "org.eclipse.help.toc");
                result.forEach(element => {
                    element.plugin = plugin.plugin;
                });
                return result;
            };
        
            //Retrieve all tocs points
            let plug2 = function(point) {
                let result = point.toc;
                result.forEach(topic => {
                    topic.plugin = point.plugin;
                });
                return result;
            };
        
            //Retrieve all extensions points, as a single array
            let result = plugins.map(p => tocs2(p)).reduce(function(pre, cur) {
                return pre.concat(cur);
            //Retrieve all toc points, as a single array
            }).map(point => plug2(point)).reduce(function(pre, cur) {
                return pre.concat(cur);
            //Retrieve all toc, as a single array of readable tocs
            }).map(toc => {
                return { plugin: toc.plugin, file: toc["$"].file };
            }).map(toc => {
                return `https://raw.githubusercontent.com/eclipse/capella/master/doc/plugins/${toc.plugin}/${toc.file}`;
            }).map(url => url.replace(/ /g,"%20"));
            resolve(result);
        });
    });
}


let plugins = [
    "org.polarsys.capella.commandline.doc", 
    "org.polarsys.capella.common.ui.massactions.doc", 
    "org.polarsys.capella.core.re.updateconnections.doc", 
    "org.polarsys.capella.core.ui.intro", 
    "org.polarsys.capella.developer.doc", 
    "org.polarsys.capella.diagrams.doc", 
    "org.polarsys.capella.diffmerge.doc", 
    "org.polarsys.capella.doc", 
    "org.polarsys.capella.git.doc", 
    "org.polarsys.capella.glossary.doc", 
    "org.polarsys.capella.mylyn.doc", 
    "org.polarsys.capella.preferences.doc", 
    "org.polarsys.capella.properties.doc", 
    "org.polarsys.capella.re.doc", 
    "org.polarsys.capella.th.doc", 
    "org.polarsys.capella.tipsandtricks.doc", 
    "org.polarsys.capella.transitions.doc", 
    "org.polarsys.capella.ui.doc", 
    "org.polarsys.capella.validation.doc", 
    "org.polarsys.capella.viewpoint.doc"
];

let pluginsUrls = plugins.map(p => `https://raw.githubusercontent.com/eclipse/capella/master/doc/plugins/${p}/plugin.xml`);


exports.getConsolidatedTocs = function(pluginsUrls) {

    return new Promise((resolve, reject) => {
        exports.getTocsUrls(pluginsUrls).then(tocs => {
            exports.getRawTocs(tocs).then(e => {
                
                {
                    let result = Array.from(Array(tocs.length).keys()).map(x => {
                        let plugin = tocs[x].split("/")[tocs[x].split("/").length-2];
                        let filename = tocs[x].split("/")[tocs[x].split("/").length-1];
                        return {"url": tocs[x], "plugin": plugin, "filename": filename, "content": e[x] }
                    });
            
            result = result.filter(x => x.content.toc);
            
                    let anchors = [];
                    let topics = [];
                
                    let proceedTopics = function(root, topic, parent) {
                        let currentTopic = { topic:topic["$"].label, href: topic["$"].href };
                
                        if (topic["$"].link_to) {
                            let plugin = topic["$"].link_to.split("/")[1];
                            let fragment = topic["$"].link_to.split("/")[2];
                            let filename = fragment.split("#")[0];
                            let anchor = fragment.split("#")[1];
                            currentTopic.link_to = {plugin:plugin, filename:filename, anchor:anchor};
                        }
                        if (topic.anchor && topic.anchor.length > 0) {
                            topic.anchor.forEach(a => anchors.push({ plugin:root.plugin, filename:root.filename, anchor:a["$"].id, topic:currentTopic}));
                        } 
                        if (parent) {
                            if (!parent.childs) parent.childs = [];
                            parent.childs.push(currentTopic);
                        } else {
                            topics.push(currentTopic);
                        }
                        if (topic.topic && topic.topic.length > 0) {
                            topic.topic.forEach(x => proceedTopics(root, x, currentTopic));
                        }
                    }
                
                    let attachTopic = function(topic) {
                        if (topic.link_to) {
                            let anchor = anchors.find(a => a.plugin == topic.link_to.plugin && a.filename == topic.link_to.filename && a.anchor == topic.link_to.anchor);
                            if (!anchor) {
                                console.error("Missing anchor: ");
                                console.error(topic.link_to);
                            } else {
                                if (anchor.topic) {
                                    if (!anchor.topic.childs) anchor.topic.childs = [];
                                    anchor.topic.childs.push(topic);
                                    topics = topics.filter(item => item !== topic);
                                }
                            }
                        }
                    }
                
                    result.filter(r => r.content).forEach(x => proceedTopics(x, x.content.toc, null));
                    topics.forEach(x => attachTopic(x));
                    resolve(topics);
                    //console.log(JSON.stringify(e, null, " "));
                };
        
            });
        });

    });
};


exports.getConsolidatedTocs(pluginsUrls).then(e => {
    console.log(e);
});