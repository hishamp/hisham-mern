const fs = require('fs')
const path = require('path')

const express = require('express')
const mongoose = require('mongoose')
const bodyparser = require('body-parser')

const usersRoutes = require('./routes/users-routes')
const placesRoutes = require('./routes/places-routes')
const HttpError = require('./models/http-error')

const app = express()

app.use(bodyparser.json())

app.use('/uploads/images', express.static(path.join('uploads', 'images')))

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000, https://hisham-mern.web.app')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  )
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE')
  next()
})

app.use('/api/places', placesRoutes)
app.use('/api/users', usersRoutes)

app.use((req, res, next) => {
  throw new HttpError('Could not find this route', 404)
})

app.use((error, req, res, next) => {
  if (req.file) {
    fs.unlink(req.file.path, (err) => {
      console.log(err);
    });
  }
  if (res.headerSend) {
    return next(error)
  }
  res.status(error.code || 500);
  res.json({ message: error.message || 'An unknown error occured!' })
})

mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.yq0ra.mongodb.net/${process.env.DB_NAME}`)
  .then(() => {
    console.log("Connected");
    app.listen(process.env.PORT || 5000)
  })
  .catch(err => {
    console.log(err);
  })