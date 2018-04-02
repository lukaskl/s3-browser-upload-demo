var express = require('express');
var crypto = require('crypto');
var path = require('path');

var s3 = require('./s3');

var s3Config = {
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION
};

var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

app.get('/s3_credentials', function(request, response) {

  if (!request.query.md5) {
    throw new Error('md5 is required');
  }

  if (request.query.filename) {
    // var filename = "images/" +
    //   crypto.randomBytes(16).toString('hex') +
    //   path.extname(request.query.filename);

    const filename = 'images/test.jpg';
    response.json(s3.s3Credentials(s3Config, { filename: filename, contentType: request.query.content_type, md5: request.query.md5 }));
  } else {
    response.status(400).send('filename is required');
  }
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
