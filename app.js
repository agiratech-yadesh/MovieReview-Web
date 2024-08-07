const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const { sequelize } = require("./util/database");
const Review = require("./models/reviews");
const User = require("./models/users");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const { error404 } = require("./controller/error404");
const csrf = require("csurf");
const flash = require("connect-flash");
const multer = require("multer");

const app = express();
app.use(bodyParser.json());
const store = new SequelizeStore({
  db: sequelize,
  expiration: 60 * 5 * 100,
});

const csrfProtection = csrf();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const homePage = require("./routes/home");
const adminPage = require("./routes/admin");
const authRoutes = require("./routes/auth");

app.use(express.urlencoded({ extended: false }));
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use(express.static("public"));
app.use("/images", express.static("images"));
app.use(
  session({
    secret: "mySecret",
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }

  User.findAll({ where: { id: req.session.user.id } })
    .then((user) => {
      req.user = user[0];
      next();
    })
    .catch((err) => console.log(err));
});

User.hasMany(Review, { as: "Reviews", foreignKey: "userId" });

// console.log(User.associations.Reviews);

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.isAuthenticated2 = req.query.logged;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use(adminPage.routes);
app.use(homePage.routes);
app.use(authRoutes);
app.use(error404);

sequelize
  .sync()
  .then((user) => {
    app.listen(process.env.PORT || 4000);
  })
  .catch((error) => {
    console.error("Error synchronizing the model with the database:", error);
  });

  