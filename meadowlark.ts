import * as assert from "assert";
import * as express from "express";
import * as handlebars from "express-handlebars";

console.log("Start");

let app = express();

// set up handlebars view engine
let handlebarsViewEngine = handlebars.create({defaultLayout: "main"});
app.engine("hbs", handlebarsViewEngine.engine);
app.set("view engine", handlebarsViewEngine);


app.set("port", process.env.PORT || 3000);
app.use(express.static(__dirname + "/public"));

// routes
app.get("/", (req:express.Request, res:express.Response) => {
    // res.type("text/plain");
    // res.send("Meadowlark Travel");
    res.render("home.hbs");
});

app.get("/about", (req:express.Request, res:express.Response) => {
    let randomeFortune = 
            fortunes[Math.floor(Math.random() * fortunes.length)];
    res.render("about.hbs", {fortune: randomeFortune});
});

// catch 404
app.use((req:express.Request, res:express.Response, next:express.NextFunction) => {    
    res.status(404);
    res.render("404.hbs");
});
// 500 error handler
app.use((err:any, req:express.Request, res:express.Response, next: express.NextFunction) => {   
    res.status(500);
    res.render("500.hbs");
});

app.listen(app.get("port"), () => {
    console.log("Express started on http://localhost:" + app.get("port"));
})

let fortunes = [
    "Rivers need spring",
    "Whenever possible, keep it simple",
    "Do not fears what you don't know"
];