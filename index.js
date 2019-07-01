/* 
The MIT License (MIT)

Copyright (c) 2019 atarumix

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
"use strict";
const request = require('request')
const parse5 = require('parse5')
const xmlser = require('xmlserializer')
const dom = require('xmldom').DOMParser
const xpath = require('xpath')

require('./loc-path')
require('./loc-aliases')
let pathlist = global.pathlist
let aliases = global.aliases

function init() {
  // do nothing now.
}

// convert location name to tenki.jp path
function getlocpath(name) {
  name = name.toLowerCase();
  // check aliases
  if (aliases[name]) {
    name = aliases[name];
  }
  if (pathlist[name]) {
    return pathlist[name];
  } else {
    return '';
  }
}

// synchronous version of http request
function doRequest(options) {
  return new Promise(function (resolve, reject) {
    request(options, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

module.exports = async (req, res) => {
  //console.log(req.method);
  //console.log(req.query);
  //console.log(req.body);
  let locpath = '';
  let tmppath;
  // get location text from slack slash command
  if (req.method == 'POST' && req.body.text) {
    let text = req.body.text.trim();
    tmppath = getlocpath(text);
    if (tmppath.length > 0) {
      locpath = tmppath;
    }
  }
  // get location text from query parameter
  if (locpath.length == 0 && req.query.loc) {
    tmppath = getlocpath(req.query.loc);
    if (tmppath.length > 0) {
      locpath = tmppath;
    }
  }
  // if location is blank, set to tokyo
  if (locpath.length == 0) {
    locpath = getlocpath('tokyo'); // tokyo
  }

  let url = 'https://tenki.jp/lite' + locpath;
  const reqOpt = {
    url: url,
    method: "GET"
  }
  try {
    // let's get html from tenki.jp
    const body = await doRequest(reqOpt);
    // and parse it.
    const ast = parse5.parse(body);
    const xhtml = xmlser.serializeToString(ast);
    const doc = new dom().parseFromString(xhtml);
    const select = xpath.useNamespaces({'x': 'http://www.w3.org/1999/xhtml'});
    // get node of radar image
    const nodes = select('(//*[@id="radar-image"])', doc)
    if (nodes.length < 1) {
      throw "node not found";
    }
    // construct result
    const attributes = nodes[0]["attributes"];
    let imageurl = '';
    let imagealt = '';
    for (let i = 0; i < attributes.length; i++) {
      if (attributes[i].name == 'src') {
        imageurl = attributes[i].value;
      } else if (attributes[i].name == 'alt') {
        imagealt = attributes[i].value;
      }
    }
    console.log(imageurl);
    console.log(imagealt);
    const regexp = /([0-9]{4}\/[0-9]{2}\/[0-9]{2})\/([0-9]{2})\/([0-9]{2})/;
    let timetext = '';
    let match = regexp.exec(imageurl);
    if (match !== null) {
      timetext = match[1] + ' ' + match[2] + ':' + match[3]
    }
    //console.log(timetext);
    let buf = '{"text": "' + imagealt + ' ' + timetext + 
	'", "attachments":[{"image_url":"'+imageurl+
	'", "title":"' + imagealt + '", "title_link": "'+url+'"}]}';
    // return result
    res.writeHead(200, {'Content-Type': 'application/json' });
    res.end(buf);
  } catch (err) {
    console.log(err);
    buf = '{"text": "request failed."}';
    res.writeHead(200, {'Content-Type': 'application/json' });
    res.end(buf);
  }
}

init();
