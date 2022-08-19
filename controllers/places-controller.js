const fs = require('fs')

const { validationResult } = require('express-validator')

const HttpError = require('../models/http-error');
const getCordsForAddress = require('../util/location');

const Place = require('../models/place')
const User = require('../models/user');
const { default: mongoose } = require('mongoose');

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place
  try {
    place = await Place.findById(placeId)
    if (!place) {
      return next(new HttpError('Could not find a place for the provided place id.', 404))
    }
  } catch (err) {
    return next(new HttpError('Something went wrong,could not find a place', 500))
  }

  res.json({ place: place.toObject({ getters: true }) })
}

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate('places')
    if (!userWithPlaces || userWithPlaces.length === 0) {
      return next(
        new HttpError('Could not find places for the provided user id.', 404)
      );
    }
  } catch (err) {
    return next(new HttpError('Something went wrong. Could not find places.', 500))
  }

  res.json({ user: userWithPlaces.toObject({ getters: true }) })
}

const createPlace = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    next(new HttpError('Invalid inputs passed', 422))
  }
  const { title, description, address } = req.body

  let coordinates
  try {
    coordinates = await getCordsForAddress(address)
  } catch (err) {
    console.log('f');
    return next(err)
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId
  })

  let user;
  try {
    user = await User.findById(req.userData.userId);
    if (!user) {
      return next(new HttpError('Could not find user for provided id', 404))
    }
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess })
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (error) {
    return next(new HttpError('Creating place failed, please try again', 500))
  }

  res.status(201).json({ place: createdPlace })
}

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new HttpError('Invalid inputs passed', 422))
  }

  const placeId = req.params.pid
  const { title, description } = req.body;

  let place
  try {
    place = await Place.findById(placeId)
  } catch (err) {
    return next(new HttpError('Something went wrong, could not update place', 500))
  }

  if (place.creator.toString() !== req.userData.userId) {
    return next(new HttpError('You are not allowed to edit this place.', 401))
  }

  place.title = title;
  place.description = description;

  try {
    await place.save()
  } catch (err) {
    return next(new HttpError('Something went wrong, could not update place', 500))
  }

  res.status(200).json({ palce: place.toObject({ getters: true }) })
}

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid

  let place;
  try {
    place = await Place.findById(placeId).populate('creator')
  } catch (error) {
    return next(new HttpError('Something went wrong, could not update place', 500))
  }

  if (!place) {
    return next(new HttpError('Could not find place for this id', 404))
  }

  console.log(place.image);

  if (place.creator.id !== req.userData.userId) {
    return next(new HttpError('You are not allowed to delete this place.', 401))
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction()
    await place.remove({ session: sess })
    place.creator.places.pull(place);
    await place.creator.save({ session: sess })
    await sess.commitTransaction()
  } catch (error) {
    return next(new HttpError('Something went wrong, could not update place', 500))
  }

  fs.unlink(imagePath, err => console.log(err))

  res.status(200).json({ message: 'Place deleted!' })
}

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace