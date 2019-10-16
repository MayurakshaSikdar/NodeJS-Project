const express = require('express');
const {
    check,
    body
} = require('express-validator');

const User = require('../models/user');

const router = express.Router();


const authController = require('../controllers/auth');

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignUp);

router.get('/reset', authController.getReset);

router.get('/reset/:token', authController.getNewPassword);


// *************************************************


router.post('/login',
    [
        check('email')
        .isEmail()
        .withMessage('Please enter Valid E-Mail')
        .normalizeEmail(),
        

        check('password')
        .isLength({min: 4})
        .withMessage('Please enter Valid Password')
        .trim(),
    ],

    authController.postLogin
);


router.post('/logout', authController.postLogout);


router.post('/signup',
    [
        check('email')
        .isEmail()
        .withMessage('Please enter Valid E-Mail')
        .custom((value, {
            req
        }) => {
            return User.findOne({
                    email: value
                })
                .then(user => {
                    if (user) {
                        return Promise.reject('User Already Exists');
                    }
                })
        })
        .normalizeEmail(),

        body('name')
        .isAlpha()
        .withMessage('Name Already Taken')
        .custom((value, {
            req
        }) => {
            return User.findOne({
                email: req.email,
                name: value
            })
            .then(user => {
                if(user) {
                    return Promise.reject();
                }
            })
        }),

        body('password', 'Please enter a password with 5 characters and Alphanumeric').isLength({
            min: 5
        })
        .isAlphanumeric()
        .trim(),


        body('confirmPassword').custom((value, {
            req
        }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords must match');
            }
            return true;
        })
        .trim()

    ], authController.postSignUp

);

router.post('/reset', authController.postReset);

router.post('/new-password', authController.postNewPassword);

// ****************************************************

module.exports = router;