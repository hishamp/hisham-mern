const HttpError = require("../models/http-error");
const { validationResult } = require('express-validator')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const User = require('../models/user')

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, '-password')
  } catch (error) {
    return next(new HttpError('Fetching users failed, please try again', 500))
  }

  res.json({ users: users.map(u => u.toObject({ getters: true })) })
}

const signup = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(HttpError('Invalid inputs passed', 422))
  }

  const { name, email, password } = req.body;

  let existingUser
  try {
    existingUser = await User.findOne({ email: email })
  } catch (error) {
    return next(new HttpError('Signing up failed, please try again.', 500))
  }

  if (existingUser) {
    return next(new HttpError('User already exists, please login.', 422))
  }

  let hashedPassword
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (error) {
    return next(new HttpError("Could not create user, please try again", 500))
  }

  const createdUser = new User({
    name,
    email,
    password: hashedPassword,
    image: req.file.path,
    places: []
  })

  try {
    await createdUser.save()
  } catch (err) {
    return next(new HttpError('Signing Up failed, try again', 500))
  }

  let token;
  try {
    token = jwt.sign({ userId: createdUser.id, email: createdUser.email }, process.env.JWT_KEY, { expiresIn: '1h' })
  } catch (error) {
    return next(new HttpError('Signing Up failed, try again', 500))
  }

  res.status(201).json({ userId: createdUser.id, email: createdUser.email, token })
}

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let identifiedUser
  try {
    identifiedUser = await User.findOne({ email: email })
  } catch (error) {
    return next(new HttpError('Logging in failed, please try again.', 500))
  }
  if (!identifiedUser) {
    return next(new HttpError("Could not find a user with the given credentials", 403));
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, identifiedUser.password)
  } catch (error) {
    return next(new HttpError('Could not log you in, please check the credentials and try again.', 500))
  }

  if (!isValidPassword) {
    return next(new HttpError('Invalid Credentials, could not log you in.'))
  }

  let token;
  try {
    token = jwt.sign({ userId: identifiedUser.id, email: identifiedUser.email }, process.env.JWT_KEY, { expiresIn: '1h' })
  } catch (error) {
    return next(new HttpError('logging in failed, try again', 500))
  }

  res.json({ userId: identifiedUser.id, email: identifiedUser.email, token })
}

exports.getUsers = getUsers;
exports.login = login;
exports.signup = signup