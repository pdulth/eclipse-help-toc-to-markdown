let https = require("https");
let xml2js = require("xml2js");

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
        console.log(file);
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
                    resolve(result);
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

    parseString: function (string) {
        return new Promise((resolve, reject) => {
            xml2js.parseString(string, function (err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            }).catch(err => console.error(err));
         });
    }
}

exports.getRawTocs = function(urls) {
    return new Promise((resolve, reject) => {
        //from urls to xmls then from xmls to json
        Promise.all(tocs.map(url => httpquery.getFile(url))).then(results => {
            Promise.all(results.map(r => xmljs.parseString(r))).then(js => resolve(js)).catch(err => reject(err));
        }).catch(err => reject(err));
    });
}

let tocs = [
    "https://raw.githubusercontent.com/eclipse/capella/master/doc/plugins/org.polarsys.capella.commandline.doc/toc.xml", 
    "https://raw.githubusercontent.com/eclipse/capella/master/doc/plugins/org.polarsys.capella.common.ui.massactions.doc/me.xml",
    "https://raw.githubusercontent.com/eclipse/capella/master/doc/plugins/org.polarsys.capella.core.re.updateconnections.doc/toc.xml",
    "https://raw.githubusercontent.com/eclipse/capella/master/doc/plugins/org.polarsys.capella.doc/toc.xml"
];

exports.getRawTocs(tocs).then(e => {
    let result = Array.from(Array(tocs.length).keys()).map(x => {
        return {"url": tocs[x], "content": e[x]}
    });
    console.log(JSON.stringify(result, null, " "));
});