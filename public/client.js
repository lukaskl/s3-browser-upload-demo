// Requires jQuery and blueimp's jQuery.fileUpload

// client-side validation by fileUpload should match the policy
// restrictions so that the checks fail early
var acceptFileType = /.*/i;
var maxFileSize = 1000;
// The URL to your endpoint that maps to s3Credentials function
var credentialsUrl = '/s3_credentials';
// The URL to your endpoint to register the uploaded file
var uploadUrl = '/upload';

window.initS3FileUpload = async function($fileInput) {
  $fileInput.fileupload({
    // acceptFileTypes: acceptFileType,
    // maxFileSize: maxFileSize,
    paramName: 'file',
    add: s3add,
    dataType: 'xml',
    done: onS3Done
  });
};

// This function retrieves s3 parameters from our server API and appends them
// to the upload form.
function s3add(e, data) {
  var filename = data.files[0].name;
  var contentType = data.files[0].type;
  var params = [];
  calculateHash(data).then(md5 => {
    $.ajax({
      url: credentialsUrl,
      type: 'GET',
      dataType: 'json',
      data: {
        filename: filename,
        content_type: contentType,
        md5: md5
      },
      success: function(s3Data) {
        data.url = s3Data.endpoint_url;
        data.formData = s3Data.params;
        data.submit();
      }
    });
  })
};

function onS3Done(e, data) {
  var s3Url = $(data.jqXHR.responseXML).find('Location').text();
  var s3Key = $(data.jqXHR.responseXML).find('Key').text();
  // Typically, after uploading a file to S3, you want to register that file with
  // your backend. Remember that we did not persist anything before the upload.
  console.log($('<a/>').attr('href', s3Url).text('File uploaded at ' + s3Url).appendTo($('body')));
};

function calculateHash(data) {
  return new Promise((res, rej) => {
    var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
      file = data.files[0],
      chunkSize = 2097152,                             // Read in chunks of 2MB
      chunks = Math.ceil(file.size / chunkSize),
      currentChunk = 0,
      spark = new SparkMD5.ArrayBuffer(),
      fileReader = new FileReader();

    fileReader.onload = function(e) {
      console.log('read chunk nr', currentChunk + 1, 'of', chunks);
      spark.append(e.target.result);                   // Append array buffer
      currentChunk++;

      if (currentChunk < chunks) {
        loadNext();
      } else {
        console.log('finished loading');
        const md5 = spark.end();
        console.info('computed hash', md5);  // Compute hash
        res(md5);
      }
    };

    fileReader.onerror = function() {
      console.warn('oops, something went wrong.');
      rej('oops, something went wrong.')
    };

    function loadNext() {
      var start = currentChunk * chunkSize,
        end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;

      fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
    }

    loadNext();
  })

}

