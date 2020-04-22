
var net = require('net');
var fs = require('fs');
var mysql = require('mysql');

var HTTP_PORT =  process.argv[4] || 1234;
var TAGS_FOLDER = "./tags"

var counter = 0;


/************************************** DATABASE STUFF **************************************/
var DB_HOST = "127.0.0.1";
var DB_USER = "root";
var DB_PW = "Azerty__";
var DB_NAME = "tags_database";
var DB_TABLE_NAME = "tags_table";


var db = mysql.createConnection ({
	host: DB_HOST,
	user: DB_USER,
	password: DB_PW,
	database: DB_NAME
});


function createTagsTable(callback)
{

	var query = "CREATE TABLE IF NOT EXISTS " + DB_TABLE_NAME + " (id MEDIUMINT PRIMARY KEY NOT NULL AUTO_INCREMENT, " +
					"start VARCHAR(255) NOT NULL, " +
					"end VARCHAR(255) NOT NULL)";

	db.query(query, function(err, results, fields) {
		var query = "SELECT COUNT(*) FROM " + DB_TABLE_NAME
		db.query(query, function(err, result) {
			if(result)
			{
				counter = result[0]["COUNT(*)"];
				console.log("Table contains " + counter + " rows!");
			}
			callback(err);
		});
	});

}

function saveTags(start, end, callback)
{
	var query = "INSERT INTO " +  DB_TABLE_NAME + " (start, end) VALUES ('" + start +"', " +
	   	end +")";
	db.query(query, function(err, results, fields) {
		if(err)
		{
			console.log("Couldn't write tags entry in database");
			callback(null);
		}
		else
			callback(results.insertId);
	});

}


/**************************************** http server stuff *******************************************/
var express = require('express');
var bodyParser = require("body-parser");
const cors = require('cors');
var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors({
	  origin: '*',
	  credentials: true
}));


app.post('/tags',function(req,res){

	var json = req.body;
	console.log(json);

	var start = Number.MAX_SAFE_INTEGER;
	var end = 0;
	for (var property in json) {
		if (json.hasOwnProperty(property))
		{
			var array = json[property];
			var segment = array[0];
			if(segment && segment.data)
			{
				first = segment.data[0];
				last = segment.data[segment.data.length -1];
				if(first)
				{
					console.log("First date: " + first.date);
					start = Math.min(start, Date.parse(first.date));
				}

				if(last)
				{
					console.log("Last date: " + last.date);
					end = Math.max(end, Date.parse(last.date));
				}

			}
		}
	}
	/* Read routers table */
	saveTags(start, end, (result) => {
		if(result)
		{
			counter = result;

			/* save tags on filesystem */
			fs.writeFile(TAGS_FOLDER + "/tags_" + counter + ".json" , JSON.stringify(json, null, 4), 'utf8', (err) => {  
				if (err)
				{
					//TODO remove entry from tags table
					res.end("error");
					throw err;
				}
				res.json({ "success": true });
			});
		}
		else
		{
			console.log("Can't right tags entry into table!");
			res.end("error");
		}

	});

});


app.get('/tags',function(req,res) {

	var token = parseInt(req.query.token);

	var response = {"token": counter, "response": null};

	if(token > 0 && token < counter)
	{
		var data = JSON.parse(fs.readFileSync(TAGS_FOLDER + "/tags_" + (token+1) + ".json" , 'utf8'));
		if(data)
		{
			response.response = data;
			response.token = token+1;
		}
		else
			response.token = token;
	}
	
	res.json(response);

});



/************************* Entry point ************************************/

function init(callback)
{
	if (!fs.existsSync(TAGS_FOLDER)){
		fs.mkdirSync(TAGS_FOLDER);
	}
	
	db.connect((err) => {
		if(err)
			throw err;

		console.log("Connected");

		createTagsTable( (err) => {
				if(err)
					throw err;
				startSystem();
			}
		);
	});
}


function startSystem()
{

	/* start the http server*/
	app.listen(HTTP_PORT, function () {
		console.log('Covid Shield http server listening on port ' + HTTP_PORT);
	});

}


init();
