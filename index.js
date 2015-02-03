
var fs = require('fs'),
    request = require('request'),
    process = require('process'),
    path = require('path'),
    http = require('http'),
    url = require('url'),
    q = require('q'),
    jsdom = require('jsdom'),
    iconv = require('iconv-lite'),
    BufferHelper = require('bufferhelper'),
    mkdirp = require('mkdirp');

var download = function(uri, filename) {
  var deferred = q.defer();
  request.head(uri, function(err, res, body) {

    if (err) {
      console.log(err);
      deferred.resolve();
    } else {
      console.log('content-type:', res.headers['content-type']);
      console.log('content-length:', res.headers['content-length']);

      request(uri).pipe(fs.createWriteStream(filename));

      deferred.resolve(filename);
    }
  });
  return deferred.promise;
};

var args = process.argv;

var CONFIG = {
  URL: args[2],
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36'
};

var getHtmlByUrl = function(siteUrl) {

  var deferred = q.defer();

  var parts = url.parse(siteUrl);

  var options = {
    host: parts.host,
    port: 80,
    path: parts.path,
    headers: {
      'Referer': siteUrl,
      'User-Agent': CONFIG.USER_AGENT
    }
  };

  http.get(options, function(res) {
    var bufferhelper = new BufferHelper();
    res.on('data', function(chunk) {
      bufferhelper.concat(chunk);
    });
    res.on('end', function() {
      var html = iconv.decode(bufferhelper.toBuffer(), 'Big5');
      deferred.resolve(html);
    });
    res.on('error', function() {
      deferred.reject();
    });
  });

  return deferred.promise;
};

var getRegExp = function() {
  var parts = url.parse(CONFIG.URL);
  var rex;

  switch (parts.host) {
    case 'share.youthwant.com.tw':
      rex = /src="?(http:\/\/sp\d+\.youthwant.com[^"\s]+(jpg|gif))"/g;
      break;
    case 'beauty.zones.gamebase.com.tw':
      rex = /src="?([^"\s]+(jpg|gif))"/g;
      break;
    case 'ck101.com':
      rex = /file="?(http:\/\/s\d+\.imgs.cc[^"\s]+(jpg))"/g;
      break;
    default:
      throw new Error('unsupported host');
  }
  return rex;
};

var getJquerySelector = function() {

  var parts = url.parse(CONFIG.URL);

  switch (parts.host) {
    case 'share.youthwant.com.tw':
      return '.article img';
    case 'beauty.zones.gamebase.com.tw':
      return '.img_group img';
    case 'ck101.com':
      return 'img[file]';
    default:
      throw new Error('unsupported host');
  }
};

var downloadImagsByHtml = function(html, link) {

    var dir = process.env.HOME + '/Pictures/' + path.basename(link);
    mkdirp(dir);

    jsdom.env({
      html: html,
      scripts: ['http://code.jquery.com/jquery.js'],
      done: function(err, window) {

        var imgArr = [];

        if (err) {
          var rex = getRegExp();
          var m;
          while (m = rex.exec(html)) {
            imgArr.push(m[1]);
          }
          console.log(imgArr);
        } else {

          var $ = window.$;
          var imgs = $(getJquerySelector());

          imgs.each(function(index, img) {
            imgArr.push(img.src || img.file);
          });
        }

        var total = 0;
        var recursiveDownload = function(arr) {
          if (0 == arr.length) {
            console.log('done, total: ' + total);
            window.close();
            return;
          }
          total++;
          var src = arr.shift();
          var filename = dir + '/' +  path.basename(src);

          console.log('downloading ' + src + '...');
          download(src, filename).then(function(filename) {
            recursiveDownload(arr);
          });
        };

        recursiveDownload(imgArr);
      }
    });
};

getHtmlByUrl(CONFIG.URL).then(function(html) {
  downloadImagsByHtml(html, CONFIG.URL);
});
