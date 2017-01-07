import * as assert from "assert";
import * as express from "express";
import * as expressSession from "express-session";
import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";
import * as handlebars from "express-handlebars";
import * as formidable from "formidable";
import * as morgan from "morgan";
import * as domain from "domain";
import * as cluster from "cluster";
import * as fs from "fs";
import * as mongoose from "mongoose";
import * as connectMongo from "connect-mongo";
import Vacation from "./model/vacation";
import VacationInSeasonListener from "./model/VacationInSeasonListener";
// import * as expressLogger from "express-logger";

let credentials = require("./credentials");


console.log("Start");

let app = express();
let server;

// set up handlebars view engine
let handlebarsViewEngine = handlebars.create({ defaultLayout: "main" });
app.engine("handlebars", handlebarsViewEngine.engine);
app.set("view engine", handlebarsViewEngine);


app.set("port", process.env.PORT || 3000);

// use domains for better error handling
app.use((req: any, res: express.Response, next: express.NextFunction) => {
    // create a domain for this request
    let mainDomain = domain.create();
    // handle errors on this domain
    mainDomain.on("error", function (err) {
        console.error("DOMAIN ERROR CAUGHT\n", err.stack);
        try {
            // failsafe shutdown in 5 seconds
            setTimeout(function () {
                console.error("Failsafe shutdown.");
                process.exit(1);
            }, 5000);

            // disconnect from the cluster
            let worker = cluster.worker;
            if (worker) worker.disconnect();

            // stop taking new requests
            server.close();

            try {
                // attempt to use Express error route
                next(err);
            } catch (error) {
                // if Express error route failed, try
                // plain Node response
                console.error("Express error mechanism failed.\n", error.stack);
                res.statusCode = 500;
                res.setHeader("content-type", "text/plain");
                res.end("Server error.");
            }
        } catch (error) {
            console.error("Unable to send 500 response.\n", error.stack);
        }
    });

    // add the request and response objects to the domain
    mainDomain.add(req);
    mainDomain.add(res);

    // execute the rest of the request chain in the domain
    mainDomain.run(next);
});

switch (app.get("env")) {
    case "development":
        // compact, colorful dev logging
        app.use(morgan("dev"));
        break;
    case "production":
        // module "express-logger" suports daily log rotation
        app.use(require("express-logger")({ path: __dirname + "/log/request.log" }));
        console.log("!!!!!!!!!!!!!!!");
        break;
}
let options = {
    server: {
        socketOptions: { keepAlive: 1 }
    }
};
switch (app.get("env")) {
    case "development":
        mongoose.connect(credentials.mongo.development.connectionString, options);
        break;
    case "production":
        mongoose.connect(credentials.mongo.production.connectionString, options);
        break;
    default:
        throw new Error("Unknown execution environment: " + app.get("env"));
}

// initialize vacations
Vacation.find(function (err, vacations) {
    if (vacations.length) return;

    new Vacation({
        name: "Hood River Day Trip",
        slug: "hood-river-day-trip",
        category: "Day Trip",
        sku: "HR199",
        description: "Spend a day sailing on the Columbia and " +
        "enjoying craft beers in Hood River!",
        priceInCents: 9995,
        tags: ["day trip", "hood river", "sailing", "windsurfing", "breweries"],
        inSeason: true,
        maximumGuests: 16,
        available: true,
        packagesSold: 0,
    }).save();

    new Vacation({
        name: "Oregon Coast Getaway",
        slug: "oregon-coast-getaway",
        category: "Weekend Getaway",
        sku: "OC39",
        description: "Enjoy the ocean air and quaint coastal towns!",
        priceInCents: 269995,
        tags: ["weekend getaway", "oregon coast", "beachcombing"],
        inSeason: false,
        maximumGuests: 8,
        available: true,
        packagesSold: 0,
    }).save();

    new Vacation({
        name: "Rock Climbing in Bend",
        slug: "rock-climbing-in-bend",
        category: "Adventure",
        sku: "B99",
        description: "Experience the thrill of rock climbing in the high desert.",
        priceInCents: 289995,
        tags: ["weekend getaway", "bend", "high desert", "rock climbing", "hiking", "skiing"],
        inSeason: true,
        requiresWaiver: true,
        maximumGuests: 4,
        available: false,
        packagesSold: 0,
        notes: "The tour guide is currently recovering from a skiing accident.",
    }).save();
});


app.use(express.static(__dirname + "/public"));
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.locals.showTests = app.get("env") !== "production" && req.query.test === "1";
    next();
});
app.use(bodyParser());
app.use(cookieParser(credentials.cookieSecret));
let sessionStore = connectMongo(expressSession);
app.use(expressSession({
    resave: false,
    saveUninitialized: false,
    secret: credentials.cookieSecret,
    store: new sessionStore({ url: credentials.mongo[app.get("env")].connectionString })
}));
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!res.locals.partials) res.locals.partials = {};
    res.locals.partials.weatherContext = getWeatherData();
    next();
});
// flash message middleware
app.use((req: any, res: express.Response, next: express.NextFunction) => {
    // if there's a flash message, transfer
    // it to the context, then clear it
    res.locals.flash = req.session.flash;
    delete req.session.flash;
    next();
});

// routes
app.get("/", (req, res: express.Response) => {
    // res.type("text/plain");
    // res.send("Meadowlark Travel");
    req.session.userName = "Anonymous";
    res.render("home.handlebars");
});

app.get("/tours/hood-river", (req: express.Request, res: express.Response) => {
    res.render("tours/hood-river.handlebars");
});

app.get("/tours/request-group-rate", (req: express.Request, res: express.Response) => {
    res.render("tours/request-group-rate.handlebars");
});

app.get("/about", (req: express.Request, res: express.Response) => {
    let randomeFortune =
        fortunes[Math.floor(Math.random() * fortunes.length)];
    res.render("about.handlebars", { fortune: randomeFortune });
});

app.get("/headers", (req: express.Request, res: express.Response) => {
    res.set("Content-Type", "text/plain");
    let s = "";
    for (let name in req.headers) {
        s += name + ": " + req.headers[name] + "\n";
    }
    res.send(s);
});

app.get("/thank-you", (req: express.Request, res: express.Response) => {
    res.render("thank-you.handlebars");
});

app.get("/newsletter", (req: express.Request, res: express.Response) => {
    // we will learn about CSRF later...for now, we just
    // provide a dummy value
    res.render("newsletter.handlebars", { csrf: "CSRF token goes here" });
});

app.get("/contest/vacation-photo", (req: express.Request, res: express.Response) => {
    let now = new Date();
    res.render("contest/vacation-photo.handlebars", { year: now.getFullYear(), month: now.getMonth() });
});

app.get("/newsletter/archive", (req: express.Request, res: express.Response) => {
    res.render("newsletter/archive.handlebars");
});

app.get("/fail", (req: express.Request, res: express.Response) => {
    throw new Error("Nope!");
});

app.get("/epic-fail", (req: express.Request, res: express.Response) => {
    process.nextTick(() => {
        throw new Error("Kaboon!");
    });
});

function convertFromUSD(value, currency) {
    switch (currency) {
        case "USD": return value * 1;
        case "GBP": return value * 0.6;
        case "BTC": return value * 0.0023707918444761;
        default: return NaN;
    }
}

app.get("/vacations", function (req: any, res) {
    Vacation.find({ available: true }, function (err, vacations: any) {
        let currency = req.session.currency || "USD";
        let context = {
            currency: currency,
            vacations: vacations.map(function (vacation) {
                return {
                    sku: vacation.sku,
                    name: vacation.name,
                    description: vacation.description,
                    inSeason: vacation.inSeason,
                    price: convertFromUSD(vacation.priceInCents / 100, currency),
                    qty: vacation.qty,
                };
            }),
            currencyUSD: "",
            currencyGBP: "",
            currencyBTC: ""
        };
        switch (currency) {
            case "USD": context.currencyUSD = "selected"; break;
            case "GBP": context.currencyGBP = "selected"; break;
            case "BTC": context.currencyBTC = "selected"; break;
        }
        res.render("vacations.handlebars", context);
    });
});

app.get("/notify-me-when-in-season", (req: express.Request, res: express.Response) => {
    res.render("notify-me-when-in-season.handlebars", { sku: req.query.sku });
});

app.post("/notify-me-when-in-season", (req: any, res: express.Response) => {
    VacationInSeasonListener.update(
        { email: req.body.email },
        { $push: { skus: req.body.sku } },
        { upsert: true },
        function (err) {
            if (err) {
                console.error(err.stack);
                req.session.flash = {
                    type: "danger",
                    intro: "Ooops!",
                    message: "There was an error processing your request.",
                };
                return res.redirect(303, "/vacations");
            }
            req.session.flash = {
                type: "success",
                intro: "Thank you!",
                message: "You will be notified when this vacation is in season.",
            };
            return res.redirect(303, "/vacations");
        }
    );
});

app.get("/set-currency/:currency", (req: any, res: express.Response) => {
    req.session.currency = req.params.currency;
    return res.redirect(303, "/vacations");
});

app.post("/tours/request-group-rate", (req: express.Request, res: express.Response) => {
    console.log("post data: " + req.body.name + " " + req.body.groupSize + " " + req.body.email);
    res.render("tours/request-group-rate.handlebars", { greeting: "thank you" });
});

// make sure data directory exists
let dataDir = __dirname + "/data";
let vacationPhotoDir = dataDir + "/vacation-photo";
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(vacationPhotoDir)) fs.mkdirSync(vacationPhotoDir);

function saveContestEntry(contestName, email, year, month, photoPath) {
    // TODO...this will come later
}

app.post("/contest/vacation-photo/:year/:month", (req: any, res: express.Response) => {
    let form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files: any) => {
        if (err) {
            req.session.flash = {
                type: "danger",
                intro: "Oops!",
                message: "There was an error processing your submission. " +
                "Pelase try again.",
            };
            return res.redirect(303, "/contest/vacation-photo");
        }
        let photo = files.photo;
        let dir = vacationPhotoDir + "/" + Date.now();
        let path = dir + "/" + photo.name;
        fs.mkdirSync(dir);
        fs.renameSync(photo.path, dir + "/" + photo.name);
        saveContestEntry("vacation-photo", fields.email,
            req.params.year, req.params.month, path);
        req.session.flash = {
            type: "success",
            intro: "Good luck!",
            message: "You have been entered into the contest.",
        };
        return res.redirect(303, "/contest/vacation-photo/entries");
    });
});


// app.post("/contest/vacation-photo/:year/:month", (req: express.Request, res: express.Response) => {
//     let form = new formidable.IncomingForm();
//     form.parse(req, function (err, fields, files) {
//         if (err) return res.redirect(303, "/error");
//         console.log("received fields:");
//         console.log(fields);
//         console.log("received files:");
//         console.log(files);
//         res.redirect(303, "/thank-you");
//     });
// });

app.post("/process", (req: express.Request, res: express.Response) => {
    // console.log("Form (from query string): " + req.query.form);
    // console.log("CSRF token(from hidden field): " + req.body._csrf);
    // console.log("Name (from visible field): " + req.body.name);
    // console.log("Email (from visible field): " + req.query.email);
    // res.redirect(303, "/thank-you");

    if (req.xhr || req.accepts("json,html") === "json") {
        // if there were an error, we would send { error: 'error description' }
        res.send({ success: true });
    } else {
        // if there were an error, we would redirect to an error page
        res.redirect(303, "/thank-you");
    }
});

// for now, we're mocking NewsletterSignup:
class NewsletterSignup {
    public constructor(name: string, email: string) { }
    public save(cb: (err) => void) {
        let error: string;
        cb(error);
    }
}


const VALID_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&"*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

app.post("/newsletter", (req, res: express.Response) => {
    let name = req.body.name || "", email = req.body.email || "";
    if (!email.match(VALID_EMAIL_REGEX)) {
        if (req.xhr) return res.json({ error: "Invalid name email address." });
        req.session.flash = {
            type: "danger",
            intro: "Validation error!",
            message: "The email address you entered was  not valid.",
        };
        return res.redirect(303, "/newsletter/archive");
    }
    new NewsletterSignup(name, email).save((err) => {
        if (err) {
            if (req.xhr) return res.json({ error: "Database error." });
            req.session.flash = {
                type: "danger",
                intro: "Database error!",
                message: "There was a database error; please try again later.",
            };
            return res.redirect(303, "/newsletter/archive");
        }
        if (req.xhr) return res.json({ success: true });
        req.session.flash = {
            type: "success",
            intro: "Thank you!",
            message: "You have now been signed up for the newsletter.",
        };
        return res.redirect(303, "/newsletter/archive");
    });
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

function startServer() {
    server = app.listen(app.get("port"), () => {
        console.log(`Express started in ${app.get("env")} mode on http://localhost:${app.get("port")}; press Ctrl+C toterminate`);
    });
}
if (require.main === module) {
    // application run directly; start app server
    startServer();
} else {
    // application imported as a module via "require": export function to create server
    module.exports = startServer;
}
// app.listen(app.get("port"), () => {
//     console.log(`Express started in ${app.get("env")} mode on http://localhost:${app.get("port")}; press Ctrl+C toterminate`);
// });

let fortunes = [
    "Rivers need spring",
    "Whenever possible, keep it simple",
    "Do not fears what you don't know"
];

// mocked weather data
function getWeatherData() {
    return {
        locations: [
            {
                name: "Portland",
                forecastUrl: "http://www.wunderground.com/US/OR/Portland.html",
                iconUrl: "http://icons-ak.wxug.com/i/c/k/cloudy.gif",
                weather: "Overcast",
                temp: "54.1 F (12.3 C)",
            },
            {
                name: "Bend",
                forecastUrl: "http://www.wunderground.com/US/OR/Bend.html",
                iconUrl: "http://icons-ak.wxug.com/i/c/k/partlycloudy.gif",
                weather: "Partly Cloudy",
                temp: "55.0 F (12.8 C)",
            },
            {
                name: "Manzanita",
                forecastUrl: "http://www.wunderground.com/US/OR/Manzanita.html",
                iconUrl: "http://icons-ak.wxug.com/i/c/k/rain.gif",
                weather: "Light Rain",
                temp: "55.0 F (12.8 C)",
            },
        ],
    };
}