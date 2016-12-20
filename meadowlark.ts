import * as assert from "assert";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as handlebars from "express-handlebars";

console.log("Start");

let app = express();

// set up handlebars view engine
let handlebarsViewEngine = handlebars.create({defaultLayout: "main"});
app.engine("handlebars", handlebarsViewEngine.engine);
app.set("view engine", handlebarsViewEngine);


app.set("port", process.env.PORT || 3000);
app.use(express.static(__dirname + "/public"));
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.locals.showTests = app.get("env") !== "production" && req.query.test === "1";
    next();
});
 app.use(bodyParser());

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!res.locals.partials) res.locals.partials = {};
    res.locals.partials.weatherContext = getWeatherData();
    next();
});

// routes
app.get("/", (req: express.Request, res: express.Response) => {
    // res.type("text/plain");
    // res.send("Meadowlark Travel");
    res.render("home.handlebars");
});

app.get("/tours/hood-river", (req: express.Request, res: express.Response) => {
    res.render("tours/hood-river.handlebars");
});

app.post("/tours/request-group-rate", (req: express.Request, res: express.Response) => {
    console.log("post data: " + req.body.name + " " +  req.body.groupSize + " " + req.body.email);
    res.render("tours/request-group-rate.handlebars", {greeting: "thank you"});
});

app.get("/tours/request-group-rate", (req: express.Request, res: express.Response) => {
    res.render("tours/request-group-rate.handlebars");
});

app.get("/about", (req: express.Request, res: express.Response) => {
    let randomeFortune =
            fortunes[Math.floor(Math.random() * fortunes.length)];
    res.render("about.handlebars", {fortune: randomeFortune});
});

app.get("/headers", (req: express.Request, res: express.Response) => {
    res.set("Content-Type", "text/plain");
    let s = "";
    for (let name in req.headers) {
        s += name + ": " + req.headers[name] + "\n";
    }
    res.send(s);
});

// catch 404
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(404).render("404.handlebars");
});
// 500 error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log(err);
    res.status(500).render("500.handlebars");
});

app.listen(app.get("port"), () => {
    console.log("Express started on http://localhost:" + app.get("port"));
});

let fortunes = [
    "Rivers need spring",
    "Whenever possible, keep it simple",
    "Do not fears what you don't know"
];

// mocked weather data
function getWeatherData(){
    return {
        locations: [
            {
                name: 'Portland',
                forecastUrl: 'http://www.wunderground.com/US/OR/Portland.html',
                iconUrl: 'http://icons-ak.wxug.com/i/c/k/cloudy.gif',
                weather: 'Overcast',
                temp: '54.1 F (12.3 C)',
            },
            {
                name: 'Bend',
                forecastUrl: 'http://www.wunderground.com/US/OR/Bend.html',
                iconUrl: 'http://icons-ak.wxug.com/i/c/k/partlycloudy.gif',
                weather: 'Partly Cloudy',
                temp: '55.0 F (12.8 C)',
            },
            {
                name: 'Manzanita',
                forecastUrl: 'http://www.wunderground.com/US/OR/Manzanita.html',
                iconUrl: 'http://icons-ak.wxug.com/i/c/k/rain.gif',
                weather: 'Light Rain',
                temp: '55.0 F (12.8 C)',
            },
        ],
    };
}