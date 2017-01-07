module.exports = {
    cookieSecret: "secret",
    mongo: {
        development: {
            connectionString: "mongodb://<dbuser>:<dbpassword>@ds035036.mlab.com:35036/medowlark",
        },
        production: {
            connectionString: "mongodb://Juraj:1234dan@ds035036.mlab.com:35036/medowlark",
        },
    }
};