var crypto = require('crypto');

global.Buffer = global.Buffer || require('buffer').Buffer;

if (typeof btoa === 'undefined') {
  global.btoa = function(str) {
    return new Buffer(str, 'binary').toString('base64');
  };
}

if (typeof atob === 'undefined') {
  global.atob = function(b64Encoded) {
    return new Buffer(b64Encoded, 'base64').toString('binary');
  };
}

function hexToBase64(hexstring) {
  return btoa(hexstring.match(/\w{2}/g).map(function(a) {
    return String.fromCharCode(parseInt(a, 16));
  }).join(""));
}


// This is the entry function that produces data for the frontend
// config is hash of S3 configuration:
// * bucket
// * region
// * accessKey
// * secretKey
function s3Credentials(config, params) {
  return {
    endpoint_url: "https://" + config.bucket + ".s3.amazonaws.com",
    params: s3Params(config, params)
  }
}

// Returns the parameters that must be passed to the API call
function s3Params(config, params) {
  var credential = amzCredential(config);
  var policy = s3UploadPolicy(config, params, credential);
  console.log('params', JSON.stringify(params));
  var policyBase64 = new Buffer(JSON.stringify(policy)).toString('base64');
  return {
    key: params.filename,
    acl: 'public-read',
    'Content-MD5': hexToBase64(params.md5),
    success_action_status: '201',
    policy: policyBase64,
    // TODO: give a list of possible content types (and text/html should not be one of those)
    "content-type": 'image/jpeg',
    'x-amz-algorithm': 'AWS4-HMAC-SHA256',
    'x-amz-credential': credential,
    'x-amz-date': dateString() + 'T000000Z',
    'x-amz-signature': s3UploadSignature(config, policyBase64, credential)
  }
}

function dateString() {
  var date = new Date().toISOString();
  return date.substr(0, 4) + date.substr(5, 2) + date.substr(8, 2);
}

function amzCredential(config) {
  return [config.accessKey, dateString(), config.region, 's3/aws4_request'].join('/')
}

// Constructs the policy
function s3UploadPolicy(config, params, credential) {
  return {
    // 5 minutes into the future
    expiration: new Date((new Date).getTime() + (5 * 60 * 1000)).toISOString(),
    conditions: [
      { bucket: config.bucket },
      { key: params.filename },
      { acl: 'public-read' },
      { 'Content-MD5': hexToBase64(params.md5) },
      { success_action_status: "201" },
      // Optionally control content type and file size
      // A content-type clause is required (even if it's all-permissive)
      // so that the uploader can specify a content-type for the file
      ['starts-with', '$Content-Type', 'image/jpeg'],
      ['content-length-range', 0, 20971520], // 20 MB limit
      { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
      { 'x-amz-credential': credential },
      { 'x-amz-date': dateString() + 'T000000Z' }
    ],
  }
}

function hmac(key, string) {
  var hmac = require('crypto').createHmac('sha256', key);
  hmac.end(string);
  return hmac.read();
}

// Signs the policy with the credential
function s3UploadSignature(config, policyBase64, credential) {
  var dateKey = hmac('AWS4' + config.secretKey, dateString());
  var dateRegionKey = hmac(dateKey, config.region);
  var dateRegionServiceKey = hmac(dateRegionKey, 's3');
  var signingKey = hmac(dateRegionServiceKey, 'aws4_request');
  return hmac(signingKey, policyBase64).toString('hex');
}

module.exports = {
  s3Credentials: s3Credentials
}
