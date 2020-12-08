require('dotenv').config();
const fs = require('fs'),
    request = require('request');
const exif = require('exif-reader');
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base('appcA7yarlB6awdwZ');

// string => Date
const getExifData = function(imageName, callback){
    var JPEGDecoder = require('jpg-stream/decoder');
    // todo: what if its png etc
    let result = new Date()
    try {
        fs.createReadStream(imageName)
        .pipe(new JPEGDecoder)
        .on('meta', function(meta) {
          if (meta.exif){
            callback(meta.exif.DateTimeOriginal)
          } else {
            console.log("Image does not contain exif data")
          }
        })
    } catch (error){
        console.log(error)
    }
}

const photoDates = []
const fetchPhotos = function(callback){
    base('Photos').select({
        // Selecting the first 3 records in Grid view:
        maxRecords: 3,
        view: "Grid view"
    }).eachPage(function page(records, fetchNextPage) {
        // This function (`page`) will get called for each page of records.
        records.forEach(function (record) {
            const photoName = record.get("Name")
            console.log('Retrieved', record.id);
            const photo = record.get("Photo File")
            if (photo && photoName){
                const photoUrl = photo[0].url
                const imageFile = `${photoName}.jpg`
                console.log(photoUrl)
                downloadImage(photoUrl, imageFile, function(){
                    getExifData(imageFile, function(exifDataDate){
                        photoDates.push({
                            id: record.id, 
                            fields: {   
                                "Date": exifDataDate.toISOString(),
                            }
                        })
                        callback(photoDates)
                    })
                })
            }
        });

        // To fetch the next page of records, call `fetchNextPage`.
        // If there are more records, `page` will get called again.
        // If there are no more records, `done` will get called.
        fetchNextPage();
    }, function done(err) {
        if (err) { console.error(err); return; }
    })
}

const uploadPhotos = function(photoDates){

    base('Photos').update(photoDates, function(err, records) {
        if (err) {
            console.log(typeof photoDates[0].fields.Date)
            console.log(photoDates)
            console.error(err);
            return;
        }
        records.forEach(function(record) {
            return record.get('Date');
        });
    });
}



const downloadImage = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);
    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

fetchPhotos(uploadPhotos)
